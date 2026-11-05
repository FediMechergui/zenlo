import { z } from 'zod';

export const BODY_TYPE_VALUES = ['hatchback','sedan','suv','van','pickup','coupe','convertible','truck','flatbed','tipper','motorcycle','scooter','minibus','bus','quad'] as const;
export type BodyType = typeof BODY_TYPE_VALUES[number];
export const BODY_TYPES: {value:BodyType;label:string}[] = [
  {value:'hatchback',label:'Citadine / compacte'}, {value:'sedan',label:'Berline'},
  {value:'suv',label:'SUV / crossover'}, {value:'van',label:'Monospace / utilitaire'},
  {value:'pickup',label:'Pick-up'}, {value:'coupe',label:'Coupé'}, {value:'convertible',label:'Cabriolet'},
  {value:'truck',label:'Camion fourgon'}, {value:'flatbed',label:'Camion plateau'}, {value:'tipper',label:'Camion benne'},
  {value:'motorcycle',label:'Moto'}, {value:'scooter',label:'Scooter'}, {value:'quad',label:'Quad'},
  {value:'minibus',label:'Minibus'}, {value:'bus',label:'Autobus / autocar'},
];
export const diagramProfileSchema=z.object({version:z.literal(1),label:z.string().trim().max(100),length:z.number().int().min(70).max(110),width:z.number().int().min(65).max(115),height:z.number().int().min(70).max(110),wheelScale:z.number().int().min(75).max(120),roofRack:z.boolean()}).strict();
export type DiagramProfile=z.infer<typeof diagramProfileSchema>;
export const vehicleRentalPolicySchema=z.object({reviewed:z.boolean(),reviewer:z.string().trim().max(180),evidence:z.string().trim().max(2000),taxRateBps:z.number().int().min(0).max(10000),stampMillimes:z.number().int().min(0).max(1000000),dailyLevyRate:z.number().int().min(0).max(1000000),dailyLevyTaxable:z.boolean()}).strict();
export type VehicleRentalPolicy=z.infer<typeof vehicleRentalPolicySchema>;
export const DEFAULT_DIAGRAM_PROFILE:DiagramProfile={version:1,label:'',length:100,width:100,height:100,wheelScale:100,roofRack:false};
export function diagramFingerprint(value:DiagramProfile|null|undefined){return JSON.stringify(diagramProfileSchema.parse(value||DEFAULT_DIAGRAM_PROFILE));}
export const vehicleTemplateSchema=z.object({make:z.string().trim().min(1).max(180),model:z.string().trim().min(1).max(180),bodyType:z.enum(BODY_TYPE_VALUES),diagramProfile:diagramProfileSchema}).strict();
export interface VehicleTemplate extends z.infer<typeof vehicleTemplateSchema>{id:string;version:number;updatedAt:string;}
export function vehicleFamily(body:BodyType){return ['motorcycle','scooter'].includes(body)?'two_wheeler':['truck','flatbed','tipper'].includes(body)?'truck':['minibus','bus'].includes(body)?'bus':body==='quad'?'quad':'car';}
export function checkLabelsFor(body:BodyType):Record<CheckKey,string>{
  const family=vehicleFamily(body);
  if(family==='two_wheeler'||family==='quad')return {...CHECK_LABELS,glass:'Rétroviseurs et bulle',body:'Cadre et carénage',interior:'Selle et repose-pieds',safety:'Direction et commandes',spare:'Transmission / chaîne / courroie',keys:'Clés, casque et accessoires'};
  if(family==='truck')return {...CHECK_LABELS,body:'Cabine et caisse / plateau',interior:'Cabine et chargement',safety:'Direction et dispositifs de sécurité',spare:'Roues, attelage et équipement',keys:'Clés et accessoires de chargement'};
  if(family==='bus')return {...CHECK_LABELS,interior:'Sièges et propreté',safety:'Issues et équipements de sécurité',keys:'Clés et accessoires passagers'};
  return CHECK_LABELS;
}
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
  diagramProfile:diagramProfileSchema.nullable().optional(),
}).strict();
export type DamageMark=z.infer<typeof damageMarkSchema>;
export type InspectionData=z.infer<typeof inspectionDataSchema>;

/** A previous condition is carried forward, while every safety check must be performed again. */
export function makeInspectionData(bodyType:BodyType='hatchback',previous?:InspectionData|null,profile?:DiagramProfile|null):InspectionData {
  const carry=!!previous?.marks.some(m=>m.status!=='repaired');
  const selected=carry?previous?.diagramProfile:profile;
  return {version:1,bodyType:carry?previous!.bodyType:bodyType,...(selected?{diagramProfile:structuredClone(selected)}:{}),marks:(previous?.marks||[]).filter(m=>m.status!=='repaired').map(m=>({...m,status:'existing'})),checks:Object.fromEntries(CHECK_KEYS.map(k=>[k,'not_checked'])) as InspectionData['checks'],notes:''};
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
