import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { all,first,database,insert,auditStatement,newId,now,guard } from '../../../server/db';
import { BusinessError,requireCondition } from '../../../server/domain';
import { apiError } from '../../../server/api';
import { authorizeDossierFile,FILE_KINDS,fileContext,authorizeFile,fileGuard,fileMetadata,privateHeaders,proofFingerprint,type ProofIdentity,type PrivateFile } from '../../../server/file-access';
import { boundedBody,requireOrigin } from '../../../lib/request';
import { MAX_IMAGE_BYTES,sanitizeInspectionImage,sha256 } from '../../../lib/media';

export const dynamic='force-dynamic';
export async function GET(request:Request){try{
  const ctx=await fileContext(),query=new URL(request.url).searchParams;
  const kind=z.enum(FILE_KINDS).optional().parse(query.get('kind')||undefined),customerId=query.get('customerId'),expenseId=query.get('expenseId'),dossierId=query.get('dossierId');
  requireCondition(kind||customerId||expenseId||dossierId,'FILTER_REQUIRED','Indiquez le dossier concerné.',400);
  authorizeFile(ctx,kind||(dossierId?'dossier_document':customerId?'identity_front':'expense_receipt'));
  const where=['tenant_id=?'],values:unknown[]=[ctx.workspace.id];
  if(dossierId){await authorizeDossierFile(ctx,dossierId);where.push('dossier_id=?');values.push(dossierId);}where.push('deleted_at IS NULL');
  if(kind){where.push('kind=?');values.push(kind);}if(customerId){where.push('customer_id=?');values.push(customerId);}if(expenseId){where.push('expense_id=?');values.push(expenseId);}
  const items=await all<PrivateFile>(`SELECT * FROM agency_files WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT 100`,...values);
  // Recheck each kind: combined filters must never widen identity-document permissions.
  for(const item of items){authorizeFile(ctx,item.kind);if(item.dossier_id)await authorizeDossierFile(ctx,item.dossier_id);}
  const customer=customerId?await first<ProofIdentity>('SELECT * FROM customers WHERE tenant_id=? AND id=?',ctx.workspace.id,customerId):null;
  const verificationFingerprint=customer?await proofFingerprint(customer):null;
  await database().batch(fileGuard(ctx));
  return Response.json({items:items.map(fileMetadata),verificationFingerprint},{headers:privateHeaders});
}catch(error){return apiError(error);}}
export async function POST(request:Request){let objectKey:string|null=null;try{
  requireOrigin(request);const ctx=await fileContext();
  requireCondition(env.BUCKET,'STORAGE_UNAVAILABLE','Le stockage des pièces est indisponible.',503);
  const contentType=request.headers.get('content-type')||'';requireCondition(contentType.startsWith('multipart/form-data'),'INVALID_FILE','Envoyez un fichier JPEG ou PNG.',415);
  const raw=await boundedBody(request,MAX_IMAGE_BYTES+65536);
  const form=await new Response(raw as BodyInit,{headers:{'Content-Type':contentType}}).formData();
  const kind=z.enum(FILE_KINDS).parse(form.get('kind'));
  authorizeFile(ctx,kind,true);
  requireCondition(ctx.workspace.mode==='demo'||ctx.workspace.settings.hostingValidated,'HOSTING_VALIDATION_REQUIRED','Validez le traitement et l’hébergement des données avant d’ajouter une pièce réelle.');
  const customerId=String(form.get('customerId')||'')||null,expenseId=String(form.get('expenseId')||'')||null,dossierId=String(form.get('dossierId')||'')||null;
  requireCondition(kind==='dossier_document'||!dossierId,'INVALID_REFERENCE','Lien de dossier incompatible.');
  if(kind==='dossier_document'){requireCondition(dossierId&&!customerId&&!expenseId,'INVALID_REFERENCE','Choisissez le dossier.');await authorizeDossierFile(ctx,dossierId);}
  else if(kind==='logo')requireCondition(!customerId&&!expenseId,'INVALID_REFERENCE','Un logo appartient au profil de l’agence.');
  else if(kind==='expense_receipt')requireCondition(expenseId&&!customerId&&await first('SELECT id FROM expenses WHERE tenant_id=? AND id=?',ctx.workspace.id,expenseId),'NOT_FOUND','Dépense introuvable.',404);
  else requireCondition(customerId&&!expenseId&&await first('SELECT id FROM customers WHERE tenant_id=? AND id=?',ctx.workspace.id,customerId),'NOT_FOUND','Client introuvable.',404);
  const file=form.get('file');requireCondition(file instanceof File,'INVALID_FILE','Choisissez une image JPEG ou PNG.');
  let clean;try{clean=sanitizeInspectionImage(new Uint8Array(await file.arrayBuffer()));}catch(error){throw new BusinessError('INVALID_FILE',error instanceof Error?error.message:'Image invalide.');}
  const {bytes,mime}=clean,hash=await sha256(bytes),label=String(form.get('label')||file.name).trim().slice(0,120)||'Pièce jointe';
  const duplicateQuery='SELECT * FROM agency_files WHERE tenant_id=? AND customer_id IS ? AND expense_id IS ? AND dossier_id IS ? AND kind=? AND hash=? AND revoked_at IS NULL AND deleted_at IS NULL';
  const duplicateValues=[ctx.workspace.id,customerId,expenseId,dossierId,kind,hash];
  const existing=await first<PrivateFile>(duplicateQuery,...duplicateValues);
  if(existing){await database().batch(fileGuard(ctx,true));return Response.json({id:existing.id,item:fileMetadata(existing)},{headers:privateHeaders});}
  const id=newId('file');objectKey=`${ctx.workspace.id}/private-files/${id}`;
  const countSql='(SELECT COUNT(*) FROM agency_files WHERE tenant_id=? AND customer_id IS ? AND expense_id IS ? AND dossier_id IS ? AND revoked_at IS NULL)<40';
  const count=await first<{n:number}>('SELECT COUNT(*) n FROM agency_files WHERE tenant_id=? AND customer_id IS ? AND expense_id IS ? AND dossier_id IS ? AND revoked_at IS NULL',ctx.workspace.id,customerId,expenseId,dossierId);
  requireCondition((count?.n||0)<40,'FILE_LIMIT','Ce dossier contient déjà 40 pièces actives. Archivez les pièces obsolètes.');
  await env.BUCKET.put(objectKey,bytes as ArrayBufferView,{httpMetadata:{contentType:mime},customMetadata:{sha256:hash}});
  try{await database().batch([...fileGuard(ctx,true),...guard(countSql,ctx.workspace.id,customerId,expenseId,dossierId),insert('agency_files',{id,tenantId:ctx.workspace.id,customerId,expenseId,dossierId,kind,objectKey,mime,size:bytes.length,hash,label,verifiedAt:null,verifiedBy:null,revokedAt:null,createdAt:now()}),auditStatement(ctx,'file.uploaded','file',id,`Pièce ${kind} ajoutée au dossier ${customerId||expenseId||'agence'}.`)]);}catch(error){
    const duplicate=await first<PrivateFile>(duplicateQuery,...duplicateValues);if(!duplicate)throw error;
    await database().batch(fileGuard(ctx,true));await env.BUCKET.delete(objectKey);objectKey=null;return Response.json({id:duplicate.id,item:fileMetadata(duplicate)},{headers:privateHeaders});
  }
  objectKey=null;return Response.json({id},{status:201,headers:privateHeaders});
}catch(error){if(objectKey&&env.BUCKET)await env.BUCKET.delete(objectKey).catch(()=>{});return apiError(error);}}
