import { env } from 'cloudflare:workers';
import { first,database,insert,auditStatement,newId,now,guard,authorize } from '../../../server/db';
import { BusinessError,requireCondition } from '../../../server/domain';
import { apiError } from '../../../server/api';
import { fileContext,fileGuard,privateHeaders } from '../../../server/file-access';
import { boundedBody,requireOrigin } from '../../../lib/request';
import { MAX_IMAGE_BYTES,sanitizeInspectionImage,sha256 } from '../../../lib/media';
export const dynamic='force-dynamic';
export async function POST(request:Request){let objectKey:string|null=null;try{
 requireOrigin(request);const ctx=await fileContext();authorize(ctx,['owner','manager']);
 requireCondition(env.BUCKET,'STORAGE_UNAVAILABLE','Stockage indisponible.',503);
 requireCondition(ctx.workspace.mode==='demo'||ctx.workspace.settings.hostingValidated,'HOSTING_VALIDATION_REQUIRED','Validez le traitement et l’hébergement des données avant l’import.');
 const contentType=request.headers.get('content-type')||'';requireCondition(contentType.startsWith('multipart/form-data'),'INVALID_FILE','Choisissez un fichier JPEG ou PNG.',415);
 const raw=await boundedBody(request,MAX_IMAGE_BYTES+65536),form=await new Response(raw as BodyInit,{headers:{'Content-Type':contentType}}).formData(),file=form.get('file');
 requireCondition(file instanceof File,'INVALID_FILE','Choisissez un fichier JPEG ou PNG.');
 let clean;try{clean=sanitizeInspectionImage(new Uint8Array(await file.arrayBuffer()));}catch(error){throw new BusinessError('INVALID_FILE',error instanceof Error?error.message:'Image invalide.');}
 const {bytes,mime}=clean,hash=await sha256(bytes),t=ctx.workspace.id;
 const findDuplicate=()=>first<{id:string}>('SELECT id FROM vehicle_diagram_assets WHERE tenant_id=? AND hash=?',t,hash);
 const duplicate=await findDuplicate();if(duplicate){await database().batch(fileGuard(ctx,true));return Response.json({id:duplicate.id},{headers:privateHeaders});}
 const count=await first<{n:number}>('SELECT COUNT(*) n FROM vehicle_diagram_assets WHERE tenant_id=?',t);requireCondition((count?.n||0)<2000,'DIAGRAM_ASSET_LIMIT','La bibliothèque contient déjà 2 000 images.');
 const id=newId('diagram');objectKey=`${t}/diagram-assets/${id}`;
 await env.BUCKET.put(objectKey,bytes as ArrayBufferView,{httpMetadata:{contentType:mime},customMetadata:{sha256:hash}});
 try{await database().batch([...fileGuard(ctx,true),...guard('(SELECT COUNT(*) FROM vehicle_diagram_assets WHERE tenant_id=?)<2000',t),insert('vehicle_diagram_assets',{id,tenantId:t,createdAt:now(),objectKey,mime,size:bytes.length,hash,label:String(form.get('label')||file.name).slice(0,120)}),auditStatement(ctx,'diagram.asset.uploaded','diagram_asset',id,'Vue de référence ajoutée à la bibliothèque privée.')]);}
 catch(error){const existing=await findDuplicate();if(!existing)throw error;await database().batch(fileGuard(ctx,true));await env.BUCKET.delete(objectKey);objectKey=null;return Response.json({id:existing.id},{headers:privateHeaders});}
 objectKey=null;return Response.json({id},{status:201,headers:privateHeaders});
}catch(error){if(objectKey&&env.BUCKET)await env.BUCKET.delete(objectKey).catch(()=>{});return apiError(error);}}
