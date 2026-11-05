import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { first,database,insert,newId,now } from '../../../../server/db';
import { rentalAccess,rentalAccessGuard } from '../../../../server/client-access';
import { apiError } from '../../../../server/api';
import { requireCondition } from '../../../../server/domain';
export const dynamic='force-dynamic';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
  const user=await getChatGPTUser();requireCondition(user,'UNAUTHENTICATED','Connexion requise.',401);const {id}=await params;
  const photo=await first<{tenant_id:string;rental_id:string;object_key:string;mime:string}>('SELECT tenant_id,rental_id,object_key,mime FROM attachments WHERE id=?',id);requireCondition(photo&&env.BUCKET,'NOT_FOUND','Photo introuvable.',404);
  const access=await rentalAccess(user,photo.rental_id);requireCondition(access&&access.tenantId===photo.tenant_id,'NOT_FOUND','Photo introuvable.',404);
  const object=await env.BUCKET.get(photo.object_key);requireCondition(object,'NOT_FOUND','Photo introuvable.',404);
  await database().batch([...rentalAccessGuard(access),insert('audit',{id:newId('audit'),tenantId:photo.tenant_id,actor:user.displayName,action:access.client?'client.photo.viewed':'photo.viewed',entityType:'attachment',entityId:id,detail:'Consultation de photo privée du dossier.',createdAt:now()})]);
  return new Response(object.body,{headers:{'Content-Type':photo.mime,'Content-Length':String(object.size),'Content-Disposition':`inline; filename="zenlo-${id}.${photo.mime==='image/png'?'png':'jpg'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(error){return apiError(error);}}
