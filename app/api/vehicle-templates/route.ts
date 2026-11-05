import { validateDiagramReference } from '../../../server/diagram-assets';
import { z } from 'zod';
import { vehicleTemplateSchema } from '../../../lib/inspection';
import { fileContext, fileGuard, privateHeaders } from '../../../server/file-access';
import { rows, authorize, commit, hash, insert, newId, now, update, guard, versionGuard, previous, entity, database, statement } from '../../../server/db';
import { requireCondition } from '../../../server/domain';
import { apiError } from '../../../server/api';
import { boundedJson, requestKey, requireOrigin } from '../../../lib/request';
import type { VehicleTemplate } from '../../../lib/inspection';
export const dynamic='force-dynamic';
export async function GET(){try{const ctx=await fileContext();const items=await rows<VehicleTemplate>('vehicle_templates',ctx.workspace.id,'make,model,created_at');await database().batch(fileGuard(ctx));return Response.json({items},{headers:privateHeaders});}catch(error){return apiError(error);}}
const saveSchema=vehicleTemplateSchema.extend({id:z.string().min(1).max(100).optional(),expectedVersion:z.number().int().positive().optional()}).strict();
export async function POST(request:Request){try{
  requireOrigin(request);const ctx=await fileContext();authorize(ctx,['owner','manager']);const {raw,body}=await boundedJson(request,65536);const input=saveSchema.parse(body);
  const mutation={key:requestKey(request),requestHash:await hash(raw)};const replay=await previous(ctx,mutation);if(replay)return Response.json(replay,{headers:privateHeaders});
  const {id:existing,expectedVersion,...data}=input;const id=existing||newId('template'),time=now();const statements=[...fileGuard(ctx),...await validateDiagramReference(ctx,data)];
  if(existing){const old=await entity<VehicleTemplate>('vehicle_templates',ctx.workspace.id,existing);requireCondition(expectedVersion===old.version,'STALE_VERSION','Ce modèle a été modifié. Actualisez la liste.',409);statements.push(...versionGuard('vehicle_templates',ctx.workspace.id,existing,old.version),update('vehicle_templates',{...data,version:old.version+1,updatedAt:time},'tenant_id=? AND id=?',ctx.workspace.id,existing));}
  else{requireCondition(expectedVersion===undefined,'INVALID_VERSION','Un nouveau modèle ne possède pas de version.');statements.push(...guard('(SELECT COUNT(*) FROM vehicle_templates WHERE tenant_id=?)<200',ctx.workspace.id),insert('vehicle_templates',{...data,id,tenantId:ctx.workspace.id,version:1,createdAt:time,updatedAt:time}));}
  const result=await commit(ctx,mutation,statements,{id},{action:existing?'vehicle.template.updated':'vehicle.template.created',type:'vehicle_template',id,detail:`${data.make} ${data.model} · ${data.bodyType}`});return Response.json(result,{headers:privateHeaders});
}catch(error){return apiError(error);}}
export async function DELETE(request:Request){try{
  requireOrigin(request);const ctx=await fileContext();authorize(ctx,['owner','manager']);const {raw,body}=await boundedJson(request);const input=z.object({id:z.string().min(1).max(100),expectedVersion:z.number().int().positive()}).strict().parse(body);const mutation={key:requestKey(request),requestHash:await hash('delete|'+raw)};const replay=await previous(ctx,mutation);if(replay)return Response.json(replay,{headers:privateHeaders});
  await entity('vehicle_templates',ctx.workspace.id,input.id);const result=await commit(ctx,mutation,[...fileGuard(ctx),...versionGuard('vehicle_templates',ctx.workspace.id,input.id,input.expectedVersion),statement('DELETE FROM vehicle_templates WHERE tenant_id=? AND id=?',ctx.workspace.id,input.id)],{id:input.id},{action:'vehicle.template.deleted',type:'vehicle_template',id:input.id,detail:'Modèle retiré de la bibliothèque. Les copies véhicule et constats restent conservés.'});return Response.json(result,{headers:privateHeaders});
}catch(error){return apiError(error);}}
