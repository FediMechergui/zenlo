import { z } from 'zod';
import { first,authorize,hash,commit,update,guard,now,previous } from '../../../../../server/db';
import { requireCondition } from '../../../../../server/domain';
import { apiError } from '../../../../../server/api';
import { authorizeDossierFile,fileContext,authorizeFile,fileGuard,privateHeaders,proofFingerprint,type ProofIdentity,type PrivateFile } from '../../../../../server/file-access';
import { boundedJson,requireOrigin,requestKey } from '../../../../../lib/request';

export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
  requireOrigin(request);const ctx=await fileContext();authorize(ctx,['owner','manager']);const {id}=await params;
  const {raw,body}=await boundedJson(request);const input=z.object({action:z.enum(['verify','revoke']),verificationFingerprint:z.string().regex(/^[a-f0-9]{64}$/).optional()}).strict().parse(body);
  const mutation={key:requestKey(request),requestHash:await hash(`file-action:${id}:${raw}`)};const replay=await previous(ctx,mutation);if(replay)return Response.json(replay,{headers:privateHeaders});
  const file=await first<PrivateFile>('SELECT * FROM agency_files WHERE tenant_id=? AND id=?',ctx.workspace.id,id);requireCondition(file,'NOT_FOUND','Pièce introuvable.',404);authorizeFile(ctx,file.kind,true);if(file.dossier_id)await authorizeDossierFile(ctx!,file.dossier_id);requireCondition(!file.deleted_at,'NOT_FOUND','Pièce supprimée.',404);
  requireCondition(!file.revoked_at,'FILE_REVOKED','Cette pièce est déjà archivée.',409);
  const identityGuard:D1PreparedStatement[]=[];
  if(input.action==='verify'&&file.customer_id){const customer=await first<ProofIdentity>('SELECT * FROM customers WHERE tenant_id=? AND id=?',ctx.workspace.id,file.customer_id);requireCondition(customer,'NOT_FOUND','Client introuvable.',404);requireCondition(input.verificationFingerprint===await proofFingerprint(customer),'CUSTOMER_CHANGED','La fiche du conducteur a changé. Actualisez ses pièces et contrôlez-les à nouveau.',409);identityGuard.push(...guard('EXISTS(SELECT 1 FROM customers WHERE tenant_id=? AND id=? AND name=? AND license_number=? AND license_until=? AND identity_type=? AND identity_number=? AND identity_until=? AND issuing_country=? AND license_country=? AND birth_date=? AND license_issued_at=?)',ctx.workspace.id,file.customer_id,customer.name,customer.license_number,customer.license_until,customer.identity_type,customer.identity_number,customer.identity_until,customer.issuing_country,customer.license_country,customer.birth_date,customer.license_issued_at));}
  const change=input.action==='verify'?{verifiedAt:now(),verifiedBy:ctx.user.userId}:{revokedAt:now()};
  const result=await commit(ctx,mutation,[...fileGuard(ctx),...identityGuard,...guard('EXISTS(SELECT 1 FROM agency_files WHERE tenant_id=? AND id=? AND revoked_at IS NULL)',ctx.workspace.id,id),update('agency_files',change,'tenant_id=? AND id=?',ctx.workspace.id,id)],{id},{action:`file.${input.action==='verify'?'verified':'revoked'}`,type:'file',id,detail:`${file.kind} : ${input.action==='verify'?'copie contrôlée par le responsable':'pièce retirée des justificatifs actifs'}.`});
  return Response.json(result,{headers:privateHeaders});
}catch(error){return apiError(error);}}
