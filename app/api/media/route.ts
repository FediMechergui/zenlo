import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../chatgpt-auth';
import { context, authorize, database, first, all, insert, auditStatement, guard, newId, now, type Context } from '../../../server/db';
import { BusinessError } from '../../../server/domain';
import { MAX_IMAGE_BYTES, sanitizeInspectionImage, sha256 } from '../../../lib/media';

export const dynamic = 'force-dynamic';
const headers = {'Cache-Control':'private, no-store'};
const failure = (error:unknown) => {
  const known=error instanceof BusinessError;
  return Response.json({error:{code:known?error.code:'MEDIA_ERROR',message:known?error.message:'Impossible de traiter cette photo. Vérifiez le fichier et réessayez.',correlationId:crypto.randomUUID()}},{status:known?error.status:400,headers});
};
async function auth() {
  const user=await getChatGPTUser(); if(!user) throw new BusinessError('UNAUTHENTICATED','Connectez-vous pour accéder aux photos.',401);
  const ctx=await context(user); if(!ctx) throw new BusinessError('NOT_FOUND','Configurez votre agence.',404);
  return ctx;
}
function writeGuards(ctx:Context){return [
  ...guard('EXISTS(SELECT 1 FROM members WHERE tenant_id=? AND id=? AND user_id=? AND role=?)',ctx.workspace.id,ctx.memberId,ctx.user.userId,ctx.role),
  ...guard('EXISTS(SELECT 1 FROM workspaces WHERE id=? AND version=?)',ctx.workspace.id,ctx.workspaceVersion),
];}
export async function GET(request:Request) {
  try {
    const ctx=await auth(); const rentalId=new URL(request.url).searchParams.get('rentalId');
    if(!rentalId || !await first('SELECT id FROM rentals WHERE id=? AND tenant_id=?',rentalId,ctx.workspace.id)) throw new BusinessError('NOT_FOUND','Location introuvable.',404);
    const items=await all('SELECT id,rental_id AS rentalId,inspection_id AS inspectionId,label,mime,size,created_at AS createdAt FROM attachments WHERE tenant_id=? AND rental_id=? ORDER BY created_at DESC',ctx.workspace.id,rentalId);
    return Response.json({items},{headers});
  } catch(error){return failure(error);}
}
export async function POST(request:Request) {
  let objectKey:string|null=null;
  try {
    if(request.headers.get('origin')!==new URL(request.url).origin) throw new BusinessError('INVALID_ORIGIN','Origine de la demande invalide.',403);
    const ctx=await auth(); authorize(ctx,['owner','manager','agent']);
    if(ctx.workspace.mode==='live'&&!ctx.workspace.settings.hostingValidated)throw new BusinessError('HOSTING_VALIDATION_REQUIRED','Validez le traitement et l’hébergement des données avant de joindre une photo réelle.',422);
    if(!env.BUCKET) throw new BusinessError('STORAGE_UNAVAILABLE','Le stockage des photos est indisponible.',503);
    if(!request.headers.get('content-type')?.startsWith('multipart/form-data')) throw new BusinessError('INVALID_FILE','Envoyez une photo JPEG ou PNG.',400);
    const reader=request.body?.getReader(); if(!reader) throw new BusinessError('INVALID_FILE','Aucun fichier reçu.',400);
    const parts:Uint8Array[]=[]; let total=0;
    try { while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_IMAGE_BYTES+65536){await reader.cancel();throw new BusinessError('FILE_TOO_LARGE','La photo doit faire au maximum 5 Mo.',413);}parts.push(value);} } finally {reader.releaseLock();}
    const body=new Uint8Array(total);let at=0;for(const part of parts){body.set(part,at);at+=part.length;}
    const form=await new Response(body,{headers:{'Content-Type':request.headers.get('content-type')!}}).formData();
    const file=form.get('file'); const rentalId=String(form.get('rentalId')||''); const inspectionId=String(form.get('inspectionId')||'')||null;
    const label=String(form.get('label')||'Photo du dossier').trim().slice(0,120);
    if(!(file instanceof File)) throw new BusinessError('INVALID_FILE','Choisissez une photo JPEG ou PNG.',400);
    if(!await first('SELECT id FROM rentals WHERE id=? AND tenant_id=?',rentalId,ctx.workspace.id)) throw new BusinessError('NOT_FOUND','Location introuvable.',404);
    if(inspectionId && !await first('SELECT id FROM inspections WHERE tenant_id=? AND rental_id=? AND id=?',ctx.workspace.id,rentalId,inspectionId)) throw new BusinessError('NOT_FOUND','État des lieux introuvable.',404);
    const {bytes,mime}=sanitizeInspectionImage(new Uint8Array(await file.arrayBuffer())); const hash=await sha256(bytes);
    const existing=await first<{id:string}>('SELECT id FROM attachments WHERE tenant_id=? AND rental_id=? AND hash=?',ctx.workspace.id,rentalId,hash);
    if(existing){await database().batch(writeGuards(ctx));return Response.json({id:existing.id},{headers});}
    const count=await first<{n:number}>('SELECT COUNT(*) n FROM attachments WHERE tenant_id=? AND rental_id=?',ctx.workspace.id,rentalId);
    if((count?.n||0)>=40) throw new BusinessError('PHOTO_LIMIT','Ce dossier contient déjà 40 photos.',422);
    const id=newId('photo'); objectKey=`${ctx.workspace.id}/${rentalId}/${id}`;
    await env.BUCKET.put(objectKey,bytes as ArrayBufferView,{httpMetadata:{contentType:mime},customMetadata:{sha256:hash}});
    try{await database().batch([
        ...writeGuards(ctx),
        ...guard('(SELECT COUNT(*) FROM attachments WHERE tenant_id=? AND rental_id=?)<40',ctx.workspace.id,rentalId),
        insert('attachments',{id,tenantId:ctx.workspace.id,rentalId,inspectionId,objectKey,mime,size:bytes.length,hash,label,createdAt:now()}),
        auditStatement(ctx,'photo.added','rental',rentalId,`Photo ajoutée : ${label}. Empreinte SHA-256 ${hash}.`),
      ]);
    }catch(error){
      const duplicate=await first<{id:string}>('SELECT id FROM attachments WHERE tenant_id=? AND rental_id=? AND hash=?',ctx.workspace.id,rentalId,hash);
      if(!duplicate)throw error;
      await database().batch(writeGuards(ctx));
      await env.BUCKET.delete(objectKey);objectKey=null;
      return Response.json({id:duplicate.id},{headers});
    }
    objectKey=null;return Response.json({id},{status:201,headers});
  }catch(error){if(objectKey&&env.BUCKET)await env.BUCKET.delete(objectKey).catch(()=>{});return failure(error);}
}
