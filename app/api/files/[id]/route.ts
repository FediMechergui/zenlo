import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { context,first,database,auditStatement,guard,insert,newId,now } from '../../../../server/db';
import { authorizeFile,fileGuard,privateHeaders,type PrivateFile } from '../../../../server/file-access';
import { apiError } from '../../../../server/api';
import { requireCondition } from '../../../../server/domain';

export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
  const user=await getChatGPTUser();requireCondition(user,'UNAUTHENTICATED','Connexion requise.',401);const {id}=await params,ctx=await context(user);
  let file=ctx?await first<PrivateFile>('SELECT * FROM agency_files WHERE tenant_id=? AND id=?',ctx.workspace.id,id):null;
  let clientLogo=false;
  if(!file){file=await first<PrivateFile>("SELECT f.* FROM agency_files f WHERE f.id=? AND f.kind='logo' AND EXISTS(SELECT 1 FROM client_access c WHERE c.tenant_id=f.tenant_id AND c.email=? AND c.revoked_at IS NULL AND c.expires_at>?)",id,user.email.toLowerCase(),now());clientLogo=!!file;}
  requireCondition(file&&env.BUCKET,'NOT_FOUND','Pièce introuvable.',404);
  if(!clientLogo)authorizeFile(ctx!,file.kind);
  const object=await env.BUCKET.get(file.object_key);requireCondition(object,'NOT_FOUND','Pièce introuvable.',404);
  await database().batch(clientLogo?[
    ...guard('EXISTS(SELECT 1 FROM client_access WHERE tenant_id=? AND email=? AND revoked_at IS NULL AND expires_at>?)',file.tenant_id,user.email.toLowerCase(),now()),
    insert('audit',{id:newId('audit'),tenantId:file.tenant_id,actor:user.displayName,action:'client.logo.viewed',entityType:'file',entityId:id,detail:'Consultation du logo depuis l’espace client.',createdAt:now()}),
  ]:[...fileGuard(ctx!),auditStatement(ctx!,'file.viewed','file',id,`Consultation de pièce privée : ${file.kind}.`)]);
  return new Response(object.body,{headers:{...privateHeaders,'Content-Type':file.mime,'Content-Length':String(object.size),'Content-Disposition':`inline; filename="zenlo-${id}.${file.mime==='image/png'?'png':'jpg'}"`,'Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(error){return apiError(error);}}
