import {DOSSIERS,type DossierKind,type DossierDefinition} from '../lib/dossiers';
import { first } from './db';
import { requireCondition } from './domain';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { context,authorize,guard,hash,type Context } from './db';
import { BusinessError } from './domain';
import type { Role } from '../lib/types';

export const FILE_KINDS=['logo','identity_front','identity_back','license_front','license_back','expense_receipt','dossier_document'] as const;
export type FileKind=typeof FILE_KINDS[number];
export interface PrivateFile {dossier_id?:string|null;deleted_at?:string|null;id:string;tenant_id:string;customer_id:string|null;expense_id:string|null;kind:FileKind;object_key:string;mime:string;size:number;hash:string;label:string;verified_at:string|null;verified_by:string|null;revoked_at:string|null;created_at:string;}
export const privateHeaders={'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'};
export const fileRoles=(kind:FileKind,write=false):Role[]=>kind==='logo'?(write?['owner']:['owner','manager','agent','accountant','mechanic','viewer']):kind==='dossier_document'?['owner','manager','accountant','agent']:kind==='expense_receipt'?['owner','manager','accountant']:['owner','manager','agent'];
export type ProofIdentity={name:string;license_number:string;license_until:string;identity_type?:string;identity_number?:string;identity_until?:string;issuing_country?:string;license_country?:string;birth_date?:string;license_issued_at?:string};
export function proofFingerprint(customer:ProofIdentity){return hash(JSON.stringify([customer.name,customer.license_number,customer.license_until,customer.identity_type,customer.identity_number,customer.identity_until,customer.issuing_country,customer.license_country,customer.birth_date,customer.license_issued_at]));}
export async function fileContext(){const user=await getChatGPTUser();if(!user)throw new BusinessError('UNAUTHENTICATED','Connectez-vous pour accéder aux pièces.',401);const ctx=await context(user);if(!ctx)throw new BusinessError('NOT_FOUND','Agence inaccessible.',404);return ctx;}
export function fileGuard(ctx:Context,includeSettings=false){return [
  ...guard('EXISTS(SELECT 1 FROM members WHERE tenant_id=? AND id=? AND user_id=? AND role=?)',ctx.workspace.id,ctx.memberId,ctx.user.userId,ctx.role),
  ...(includeSettings?guard('EXISTS(SELECT 1 FROM workspaces WHERE id=? AND version=?)',ctx.workspace.id,ctx.workspaceVersion):[]),
];}
export function authorizeFile(ctx:Context,kind:FileKind,write=false){authorize(ctx,fileRoles(kind,write));}
export function fileMetadata(file:PrivateFile){return {dossierId:file.dossier_id,deletedAt:file.deleted_at,id:file.id,customerId:file.customer_id,expenseId:file.expense_id,kind:file.kind,mime:file.mime,size:file.size,label:file.label,verifiedAt:file.verified_at,verifiedBy:file.verified_by,revokedAt:file.revoked_at,createdAt:file.created_at};}

export async function authorizeDossierFile(ctx:Context,id:string){const record=await first<{kind:DossierKind}>('SELECT kind FROM dossiers WHERE tenant_id=? AND id=?',ctx.workspace.id,id);requireCondition(record,'NOT_FOUND','Dossier introuvable.',404);authorize(ctx,(DOSSIERS[record.kind] as DossierDefinition).roles);}
