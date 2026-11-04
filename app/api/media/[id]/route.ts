import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { context, first, auditStatement, database, guard } from '../../../../server/db';

export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}) {
  const user=await getChatGPTUser(); if(!user)return new Response('Connexion requise',{status:401});
  const ctx=await context(user); if(!ctx)return new Response('Introuvable',{status:404});
  const {id}=await params;
  const photo=await first<{object_key:string;mime:string;hash:string}>('SELECT object_key,mime,hash FROM attachments WHERE tenant_id=? AND id=?',ctx.workspace.id,id);
  if(!photo||!env.BUCKET)return new Response('Introuvable',{status:404});
  const object=await env.BUCKET.get(photo.object_key);if(!object)return new Response('Introuvable',{status:404});
  try{await database().batch([
    ...guard('EXISTS(SELECT 1 FROM members WHERE tenant_id=? AND id=? AND user_id=? AND role=?)',ctx.workspace.id,ctx.memberId,ctx.user.userId,ctx.role),
    auditStatement(ctx,'photo.viewed','attachment',id,'Consultation de photo privée.'),
  ]);}catch{return new Response('Autorisation modifiée. Actualisez votre session.',{status:403,headers:{'Cache-Control':'private, no-store'}});}
  return new Response(object.body,{headers:{'Content-Type':photo.mime,'Content-Length':String(object.size),'Content-Disposition':`inline; filename="zenlo-${id}.${photo.mime==='image/png'?'png':'jpg'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'ETag':`"${photo.hash}"`}});
}
