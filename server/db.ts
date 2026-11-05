import { env } from 'cloudflare:workers';
import type { ChatGPTUser } from '../app/chatgpt-auth';
import type { AgencySettings, Role, Workspace, WorkspaceAccess } from '../lib/types';
import { BusinessError, requireCondition, defaultSettings } from './domain';

export const now=()=>new Date().toISOString();
export const newId=(prefix='rec')=>`${prefix}_${crypto.randomUUID().replaceAll('-','')}`;
export function database():D1Database{if(!env.DB)throw new BusinessError('DATABASE_UNAVAILABLE','La base de données est indisponible. Réessayez dans quelques instants.',503);return env.DB;}
export function statement(sql:string,...values:unknown[]){return database().prepare(sql).bind(...values.map(v=>typeof v==='boolean'?Number(v):v===undefined?null:v));}
export async function all<T>(sql:string,...values:unknown[]){return (await statement(sql,...values).all<T>()).results;}
export async function first<T>(sql:string,...values:unknown[]){return statement(sql,...values).first<T>();}
export function camelRow<T>(raw:Record<string,unknown>):T{const out:Record<string,unknown>={};for(const [k,v] of Object.entries(raw)){if(k==='tenant_id'||k==='pricing_snapshot'||k==='snapshot'||k==='cash_session_id')continue;const key=k.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase());out[key]=['inspectionData','diagramProfile','rentalPolicy'].includes(key)?(v?JSON.parse(String(v)):null):['customerAccepted','dailyLevyTaxable','active'].includes(key)?!!v:v;}return out as T;}
export async function rows<T>(table:string,tenantId:string,order='created_at DESC'){return (await all<Record<string,unknown>>(`SELECT * FROM ${table} WHERE tenant_id=? ORDER BY ${order}`,tenantId)).map(r=>camelRow<T>(r));}
export async function entity<T>(table:string,tenantId:string,id:string){const r=await first<Record<string,unknown>>(`SELECT * FROM ${table} WHERE tenant_id=? AND id=?`,tenantId,id);if(!r)throw new BusinessError('NOT_FOUND','Ce dossier est introuvable ou inaccessible.',404);return camelRow<T>(r);}
export function insert(table:string,obj:Record<string,unknown>){const entries=Object.entries(obj);const cols=entries.map(([k])=>k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase()));return statement(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(()=>'?').join(',')})`,...entries.map(([k,v])=>['inspectionData','diagramProfile','rentalPolicy'].includes(k)?JSON.stringify(v||null):v));}
export function update(table:string,obj:Record<string,unknown>,where:string,...values:unknown[]){const entries=Object.entries(obj);return statement(`UPDATE ${table} SET ${entries.map(([k])=>k.replace(/[A-Z]/g,c=>'_'+c.toLowerCase())+'=?').join(',')} WHERE ${where}`,...entries.map(([k,v])=>['diagramProfile','rentalPolicy'].includes(k)?JSON.stringify(v||null):v),...values);}
export interface Context {user:ChatGPTUser;workspace:Workspace;role:Role;memberId:string;workspaceVersion:number;}
export async function availableWorkspaces(user:ChatGPTUser):Promise<WorkspaceAccess[]>{return all<WorkspaceAccess>("SELECT w.id,w.name,w.mode,m.role FROM members m JOIN workspaces w ON w.id=m.tenant_id WHERE m.user_id=? OR (m.user_id IS NULL AND m.email=?) ORDER BY w.created_at,w.id",user.userId,user.email.toLowerCase());}
export async function context(user:ChatGPTUser,workspaceId:string|null|undefined=(user as ChatGPTUser & {workspaceId?:string}).workspaceId):Promise<Context|null>{
  const member=await first<{id:string;tenant_id:string;role:Role;user_id:string|null}>(`SELECT * FROM members WHERE (user_id=? OR (user_id IS NULL AND email=?)) ${workspaceId?'AND tenant_id=?':''} ORDER BY created_at,tenant_id LIMIT 1`,user.userId,user.email.toLowerCase(),...(workspaceId?[workspaceId]:[]));
  if(!member)return null;
  // Platform-authenticated email may accept a pre-provisioned membership once. Stable ID is used thereafter.
  if(!member.user_id)await statement('UPDATE members SET user_id=? WHERE id=? AND user_id IS NULL',user.userId,member.id).run();
  const w=await first<{id:string;name:string;mode:'demo'|'live';settings:string;created_at:string;version:number}>('SELECT * FROM workspaces WHERE id=?',member.tenant_id);
  requireCondition(w,'NOT_FOUND','Agence introuvable.',404);
  return {user,role:member.role,memberId:member.id,workspaceVersion:w.version,workspace:{id:w.id,name:w.name,mode:w.mode,settings:{...defaultSettings(w.name),...JSON.parse(w.settings)} as AgencySettings,createdAt:w.created_at}};
}
export function authorize(ctx:Context,roles:Role[]){requireCondition(roles.includes(ctx.role),'FORBIDDEN','Votre rôle ne permet pas cette opération.',403);}
export function guard(conditionSql:string,...values:unknown[]){const id=newId('guard');return [statement(`INSERT INTO operation_guards (id,ok) SELECT ?,CASE WHEN (${conditionSql}) THEN 1 ELSE 0 END`,id,...values),statement('DELETE FROM operation_guards WHERE id=?',id)];}
export function versionGuard(table:string,tenantId:string,id:string,version:number){return guard(`EXISTS(SELECT 1 FROM ${table} WHERE tenant_id=? AND id=? AND version=?)`,tenantId,id,version);}
export function auditStatement(ctx:Context,action:string,entityType:string,entityId:string,detail:string){return insert('audit',{id:newId('audit'),tenantId:ctx.workspace.id,actor:ctx.user.displayName,action,entityType,entityId,detail,createdAt:now()});}
export async function hash(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export interface Mutation {key:string;requestHash:string;}
export async function previous(ctx:Context,m:Mutation){const r=await first<{request_hash:string;response:string}>('SELECT request_hash,response FROM idempotency WHERE tenant_id=? AND actor_id=? AND key=?',ctx.workspace.id,ctx.user.userId,m.key);if(!r)return null;requireCondition(r.request_hash===m.requestHash,'IDEMPOTENCY_MISMATCH','Cette clé de reprise correspond à une demande différente.',409);return JSON.parse(r.response);}
export async function commit(ctx:Context,m:Mutation,statements:D1PreparedStatement[],response:Record<string,unknown>,auditEvent:{action:string;type:string;id:string;detail:string}){
  const replay=await previous(ctx,m);if(replay)return replay;
  try{await database().batch([
    insert('idempotency',{id:newId('idem'),tenantId:ctx.workspace.id,actorId:ctx.user.userId,key:m.key,requestHash:m.requestHash,response:JSON.stringify(response),createdAt:now()}),
    ...(ctx.workspaceVersion>0?guard('EXISTS(SELECT 1 FROM members WHERE tenant_id=? AND id=? AND user_id=? AND role=?)',ctx.workspace.id,ctx.memberId,ctx.user.userId,ctx.role):[]),
    ...statements,auditStatement(ctx,auditEvent.action,auditEvent.type,auditEvent.id,auditEvent.detail),
  ]);return response;}catch(error){const existing=await previous(ctx,m);if(existing)return existing;throw error;}
}
