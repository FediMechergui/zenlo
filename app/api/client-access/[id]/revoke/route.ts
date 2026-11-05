import { fileContext,privateHeaders } from '../../../../../server/file-access';
import { first,authorize,commit,hash,update,now } from '../../../../../server/db';
import { requireCondition } from '../../../../../server/domain';
import { apiError } from '../../../../../server/api';
import { requireOrigin,requestKey } from '../../../../../lib/request';
export const dynamic='force-dynamic';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{requireOrigin(request);const ctx=await fileContext();authorize(ctx,['owner','manager','agent']);const {id}=await params;const grant=await first<{rental_id:string;email:string}>('SELECT rental_id,email FROM client_access WHERE tenant_id=? AND id=?',ctx.workspace.id,id);requireCondition(grant,'NOT_FOUND','Accès introuvable.',404);const result=await commit(ctx,{key:requestKey(request),requestHash:await hash(`revoke:${id}`)},[update('client_access',{revokedAt:now()},'tenant_id=? AND id=? AND revoked_at IS NULL',ctx.workspace.id,id)],{id},{action:'client.access.revoked',type:'rental',id:grant.rental_id,detail:`Accès retiré pour ${grant.email}.`});return Response.json(result,{headers:privateHeaders});}catch(error){return apiError(error);}}
