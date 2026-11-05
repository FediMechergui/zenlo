import { z } from 'zod';

export const BODY_TYPE_VALUES = ['hatchback','sedan','suv','van','pickup','coupe','convertible'] as const;
export type BodyType = typeof BODY_TYPE_VALUES[number];
export const BODY_TYPES: {value:BodyType;label:string}[] = [
  {value:'hatchback',label:'Citadine / compacte'}, {value:'sedan',label:'Berline'},
  {value:'suv',label:'SUV / crossover'}, {value:'van',label:'Monospace / utilitaire'},
  {value:'pickup',label:'Pick-up'}, {value:'coupe',label:'Coupé'}, {value:'convertible',label:'Cabriolet'},
];
export const INSPECTION_VIEWS = ['front','rear','left','right'] as const;
export type InspectionView = typeof INSPECTION_VIEWS[number];
export const VIEW_LABELS:Record<InspectionView,string> = {front:'Avant',rear:'Arrière',left:'Côté gauche',right:'Côté droit'};
export const DAMAGE_TYPES = {scratch:'Rayure',dent:'Enfoncement',crack:'Fissure / bris',missing:'Élément manquant',mechanical:'Anomalie mécanique',modification:'Modification'} as const;
export const SEVERITY_LABELS = {light:'Légère',moderate:'À surveiller',major:'Importante'} as const;
export const MARK_STATUS_LABELS = {existing:'Déjà présent',new:'Nouveau constat',repaired:'Réparé / résolu'} as const;
export const CHECK_KEYS = ['tires','brakes','lights','fluids','glass','body','interior','safety','spare','keys','documents'] as const;
export type CheckKey = typeof CHECK_KEYS[number];
export const CHECK_LABELS:Record<CheckKey,string> = {
  tires:'Pneus et pression',brakes:'Freinage',lights:'Éclairage et clignotants',fluids:'Niveaux et fuites',glass:'Vitres et rétroviseurs',body:'Carrosserie',interior:'Habitacle et propreté',safety:'Voyants et sécurité',spare:'Roue / kit de secours',keys:'Clés et accessoires',documents:'Documents du véhicule',
};
export const CHECK_STATUS_LABELS = {not_checked:'À contrôler',pass:'Conforme',attention:'Observation',fail:'Défaut bloquant'} as const;
const checkStatusSchema=z.enum(['not_checked','pass','attention','fail']);
export const damageMarkSchema=z.object({
  id:z.string().min(1).max(80).regex(/^[A-Za-z0-9_-]+$/),
  view:z.enum(INSPECTION_VIEWS),x:z.number().finite().min(0).max(100),y:z.number().finite().min(0).max(100),
  type:z.enum(['scratch','dent','crack','missing','mechanical','modification']),
  severity:z.enum(['light','moderate','major']),note:z.string().trim().max(500),
  status:z.enum(['existing','new','repaired']),
}).strict();
export const inspectionDataSchema=z.object({
  version:z.literal(1),bodyType:z.enum(BODY_TYPE_VALUES),
  marks:z.array(damageMarkSchema).max(80).refine(marks=>new Set(marks.map(m=>m.id)).size===marks.length,'Chaque repère doit avoir un identifiant unique.'),
  checks:z.object({tires:checkStatusSchema,brakes:checkStatusSchema,lights:checkStatusSchema,fluids:checkStatusSchema,glass:checkStatusSchema,body:checkStatusSchema,interior:checkStatusSchema,safety:checkStatusSchema,spare:checkStatusSchema,keys:checkStatusSchema,documents:checkStatusSchema}).strict(),
  notes:z.string().trim().max(2000),
}).strict();
export type DamageMark=z.infer<typeof damageMarkSchema>;
export type InspectionData=z.infer<typeof inspectionDataSchema>;

/** A previous condition is carried forward, while every safety check must be performed again. */
export function makeInspectionData(bodyType:BodyType='hatchback',previous?:InspectionData|null):InspectionData {
  return {version:1,bodyType,marks:(previous?.marks||[]).filter(m=>m.status!=='repaired').map(m=>({...m,status:'existing'})),checks:Object.fromEntries(CHECK_KEYS.map(k=>[k,'not_checked'])) as InspectionData['checks'],notes:''};
}
export function parseInspectionData(value:unknown):InspectionData|null {
  let parsed=value;
  if(typeof value==='string'){try{parsed=JSON.parse(value);}catch{return null;}}
  const result=inspectionDataSchema.safeParse(parsed);return result.success?result.data:null;
}
export function inspectionProgress(data:InspectionData){
  const statuses=Object.values(data.checks);
  return {total:CHECK_KEYS.length,reviewed:statuses.filter(s=>s!=='not_checked').length,failed:statuses.filter(s=>s==='fail').length,attention:statuses.filter(s=>s==='attention').length,newMarks:data.marks.filter(m=>m.status==='new').length};
}
export function compareInspectionMarks(previous:InspectionData|null|undefined,current:InspectionData){
  const earlier=new Map((previous?.marks||[]).map(m=>[m.id,m]));
  return current.marks.map(mark=>({mark,change:mark.status==='repaired'?'resolved':!earlier.has(mark.id)?'added':'carried'} as const));
}
