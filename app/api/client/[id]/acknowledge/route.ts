import { z } from 'zod';
import { getChatGPTUser } from '../../../../chatgpt-auth';
import { rentalAccess,rentalAccessGuard,inspectionFingerprint } from '../../../../../server/client-access';
import { requireCondition } from '../../../../../server/domain';
import { apiError } from '../../../../../server/api';
import { first,database,insert,newId,now,versionGuard } from '../../../../../server/db';
import { privateHeaders } from '../../../../../server/file-access';
import { boundedJson,requireOrigin } from '../../../../../lib/request';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
  requireOrigin(request);const user=await getChatGPTUser();requireCondition(user,'UNAUTHENTICATED','Connexion requise.',401);const {id}=await params;
  const access=await rentalAccess(user,id,true);requireCondition(access?.client,'FORBIDDEN','Cette lecture doit être confirmée depuis le compte du client.',403);
  const {body}=await boundedJson(request);const input=z.object({inspectionHash:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(body);
  const rental=await first<{version:number}>('SELECT version FROM rentals WHERE tenant_id=? AND id=?',access.tenantId,id);requireCondition(rental,'NOT_FOUND','Dossier introuvable.',404);
  const current=await inspectionFingerprint(access.tenantId,id);requireCondition(input.inspectionHash===current,'STALE_REPORT','L’état des lieux a changé. Actualisez avant de confirmer votre lecture.',409);
  requireCondition(await first('SELECT id FROM inspections WHERE tenant_id=? AND rental_id=? LIMIT 1',access.tenantId,id),'NO_INSPECTION','Aucun état des lieux n’a encore été enregistré.');
  const existing=await first<{id:string;created_at:string}>('SELECT id,created_at FROM client_acknowledgments WHERE tenant_id=? AND rental_id=? AND user_id=? AND inspection_hash=?',access.tenantId,id,user.userId,current);
  if(existing){await database().batch(rentalAccessGuard(access));return Response.json({id:existing.id,createdAt:existing.created_at},{headers:privateHeaders});}
  const recordId=newId('ack'),createdAt=now();
  await database().batch([...rentalAccessGuard(access),...versionGuard('rentals',access.tenantId,id,rental.version),insert('client_acknowledgments',{id:recordId,tenantId:access.tenantId,rentalId:id,userId:user.userId,email:user.email.toLowerCase(),inspectionHash:current,createdAt}),insert('audit',{id:newId('audit'),tenantId:access.tenantId,actor:user.displayName,action:'client.report.read',entityType:'rental',entityId:id,detail:`Lecture de l’état des lieux confirmée. Empreinte ${current}.`,createdAt})]);
  return Response.json({id:recordId,createdAt},{headers:privateHeaders});
}catch(error){return apiError(error);}}
