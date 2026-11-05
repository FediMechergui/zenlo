import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '../../../chatgpt-auth';
import { first,context,database,guard } from '../../../../server/db';
import { fileGuard,privateHeaders } from '../../../../server/file-access';
import { requireCondition } from '../../../../server/domain';
import { apiError } from '../../../../server/api';
export const dynamic='force-dynamic';
// A client may read only sheets frozen into an inspection of their own granted rental.
const clientPredicate=`EXISTS(SELECT 1 FROM client_access ca JOIN inspections i ON i.tenant_id=ca.tenant_id AND i.rental_id=ca.rental_id, json_each(CASE WHEN json_valid(i.inspection_data) THEN json_extract(i.inspection_data,'$.diagramProfile.reference.sheets') ELSE '[]' END) sheet WHERE ca.tenant_id=? AND ca.email=? AND ca.revoked_at IS NULL AND ca.expires_at>? AND json_extract(sheet.value,'$.assetId')=?)`;
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
 const user=await getChatGPTUser();requireCondition(user,'UNAUTHENTICATED','Connectez-vous.',401);const {id}=await params;
 requireCondition(/^diagram_[A-Za-z0-9_-]{1,80}$/.test(id),'NOT_FOUND','Vue introuvable.',404);
 const asset=await first<{id:string;tenant_id:string;object_key:string;mime:string}>('SELECT id,tenant_id,object_key,mime FROM vehicle_diagram_assets WHERE id=?',id);requireCondition(asset,'NOT_FOUND','Vue introuvable.',404);
 const ctx=await context(user),staff=ctx?.workspace.id===asset.tenant_id;
 const values=()=>[asset.tenant_id,user.email.toLowerCase(),new Date().toISOString(),id];
 if(!staff)requireCondition(await first(`SELECT 1 WHERE ${clientPredicate}`,...values()),'NOT_FOUND','Vue introuvable.',404);
 requireCondition(env.BUCKET,'STORAGE_UNAVAILABLE','Stockage indisponible.',503);const object=await env.BUCKET.get(asset.object_key);requireCondition(object,'NOT_FOUND','Vue introuvable.',404);
 await database().batch(staff?fileGuard(ctx!):guard(clientPredicate,...values()));
 return new Response(object.body,{headers:{...privateHeaders,'Content-Type':asset.mime,'Content-Disposition':`inline; filename="${id}.${asset.mime==='image/png'?'png':'jpg'}"`,'Content-Security-Policy':"default-src 'none'; sandbox"}});
}catch(error){return apiError(error);}}
