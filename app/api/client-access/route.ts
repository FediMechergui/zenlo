import { z } from 'zod';
import { fileContext,privateHeaders,fileGuard } from '../../../server/file-access';
import { all,first,authorize,commit,hash,insert,newId,now,database } from '../../../server/db';
import { requireCondition } from '../../../server/domain';
import { apiError } from '../../../server/api';
import { boundedJson,requestKey,requireOrigin } from '../../../lib/request';
export const dynamic='force-dynamic';
export async function GET(request:Request){try{const ctx=await fileContext();authorize(ctx,['owner','manager','agent']);const rentalId=new URL(request.url).searchParams.get('rentalId');requireCondition(rentalId,'FILTER_REQUIRED','Choisissez une location.',400);const items=await all('SELECT id,email,name,expires_at AS expiresAt,revoked_at AS revokedAt,created_at AS createdAt FROM client_access WHERE tenant_id=? AND rental_id=? ORDER BY created_at DESC',ctx.workspace.id,rentalId);await database().batch(fileGuard(ctx));return Response.json({items},{headers:privateHeaders});}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
  requireOrigin(request);const ctx=await fileContext();authorize(ctx,['owner','manager','agent']);const {raw,body}=await boundedJson(request);
  const input=z.object({rentalId:z.string().min(1).max(100),email:z.string().trim().email().max(254).transform(x=>x.toLowerCase()),name:z.string().trim().max(180).default(''),expiresAt:z.string().datetime({offset:true}).transform(s=>new Date(s).toISOString())}).strict().parse(body);
  requireCondition(Date.parse(input.expiresAt)>Date.now()&&Date.parse(input.expiresAt)<Date.now()+366*2*86400000,'INVALID_EXPIRY','La fin d’accès doit se situer dans les deux prochaines années.');
  requireCondition(ctx.workspace.mode==='demo'||ctx.workspace.settings.hostingValidated,'HOSTING_VALIDATION_REQUIRED','Validez le traitement des données avant de partager un dossier réel.');
  requireCondition(await first('SELECT id FROM rentals WHERE tenant_id=? AND id=?',ctx.workspace.id,input.rentalId),'NOT_FOUND','Location introuvable.',404);
  const id=newId('access');const result=await commit(ctx,{key:requestKey(request),requestHash:await hash(raw)},[...fileGuard(ctx,true),insert('client_access',{id,tenantId:ctx.workspace.id,rentalId:input.rentalId,email:input.email,name:input.name,expiresAt:input.expiresAt,revokedAt:null,createdAt:now()})],{id},{action:'client.access.granted',type:'rental',id:input.rentalId,detail:`Accès au dossier accordé à ${input.email} jusqu’au ${input.expiresAt}.`});
  return Response.json(result,{status:201,headers:privateHeaders});
}catch(error){return apiError(error);}}
