import { originalVehicle,originalMatches } from '../lib/original-vehicles';
import type { DiagramProfile,BodyType } from '../lib/inspection';
import { first,guard,type Context } from './db';
import { requireCondition } from './domain';

export async function validateDiagramReference(ctx:Context,value:{make:string;model:string;bodyType?:BodyType;year?:number;diagramProfile?:DiagramProfile|null}){
 const original=value.diagramProfile?.original;if(original){const drawing=originalVehicle(original.id,original.revision);requireCondition(drawing&&originalMatches(drawing,value.make,value.model,value.bodyType,value.year),'DIAGRAM_MODEL_MISMATCH','Le dessin Zenlo doit correspondre à la marque, au modèle, à la carrosserie et à l’année du véhicule.');}
 const ref=value.diagramProfile?.reference;if(!ref)return [];
 const equal=(a:string,b:string)=>a.trim().toLocaleLowerCase()===b.trim().toLocaleLowerCase();
 requireCondition(equal(ref.make,value.make)&&equal(ref.model,value.model)&&ref.bodyType===value.bodyType&&(value.year===undefined||value.year>=ref.yearFrom&&value.year<=ref.yearTo),'DIAGRAM_MODEL_MISMATCH','La référence doit correspondre à la marque, au modèle, à la carrosserie et à l’année du véhicule.');
 const statements=[];
 for(const id of new Set(ref.sheets.map(s=>s.assetId))){
  requireCondition(await first('SELECT id FROM vehicle_diagram_assets WHERE tenant_id=? AND id=?',ctx.workspace.id,id),'DIAGRAM_ASSET_NOT_FOUND','Une vue de référence est inaccessible dans cette entreprise.',404);
  statements.push(...guard('EXISTS(SELECT 1 FROM vehicle_diagram_assets WHERE tenant_id=? AND id=?)',ctx.workspace.id,id));
 }
 return statements;
}
