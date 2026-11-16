import type {Customer,Rental,Vehicle} from '../lib/types';
import {all,entity,first,guard,versionGuard,type Context} from './db';
import {requireCondition,tunisDate,rentalDays} from './domain';
import {z} from 'zod';
import {partiesSchema} from './validation';
import {authorize,commit,update,insert,hash,newId,now,type Mutation} from './db';
export function rentalParties(r:Pick<Rental,'parties'|'customerId'>){return r.parties||{driverIds:[r.customerId],signatoryId:r.customerId,payerId:r.customerId};}
export async function partySnapshot(ctx:Context,r:Pick<Rental,'parties'|'customerId'>){const p=rentalParties(r);const drivers=await Promise.all(p.driverIds.map(id=>entity<Customer>('customers',ctx.workspace.id,id)));const signatory=await entity<Customer>('customers',ctx.workspace.id,p.signatoryId),payer=await entity<Customer>('customers',ctx.workspace.id,p.payerId);return {drivers,signatory,payer};}
export async function validateParties(ctx:Context,r:Pick<Rental,'parties'|'customerId'>,until?:string){
 const p=rentalParties(r),people=await partySnapshot(ctx,r),sql:D1PreparedStatement[]=[];
 requireCondition(people.signatory.type==='individual','SIGNATORY_REQUIRED','Le signataire doit avoir une fiche personne distincte de la société.');
 for(const c of people.drivers){
  requireCondition(c.type==='individual','DRIVER_PERSON_REQUIRED','Chaque conducteur doit avoir sa propre fiche personne.');
  if(!until)continue;
  const end=tunisDate(new Date(until));requireCondition(c.licenseNumber&&c.licenseUntil>=end,'LICENSE_EXPIRED',`Le permis de ${c.name} doit couvrir la location.`);
  if(ctx.workspace.mode==='live'){
   requireCondition(c.identityNumber&&c.issuingCountry&&c.licenseCountry,'IDENTITY_DETAILS_REQUIRED',`Complétez la CIN ou le passeport et les pays de délivrance de ${c.name}.`);
   requireCondition(c.identityType!=='passport'||!!c.identityUntil,'PASSPORT_EXPIRY_REQUIRED','Renseignez la date d’expiration du passeport.');
   requireCondition(!c.identityUntil||c.identityUntil>=end,'IDENTITY_EXPIRED',`La pièce d’identité de ${c.name} expire avant la fin de location.`);
   for(const kind of ['identity_front','license_front',...(ctx.workspace.settings.requireIdentityBack&&c.identityType!=='passport'?['identity_back']:[]),...(ctx.workspace.settings.requireLicenseBack?['license_back']:[])]){
    const proof=await first('SELECT id FROM agency_files WHERE tenant_id=? AND customer_id=? AND kind=? AND verified_at IS NOT NULL AND revoked_at IS NULL',ctx.workspace.id,c.id,kind);
    requireCondition(proof,'IDENTITY_DOCUMENTS_REQUIRED',`Ajoutez et vérifiez les pièces de ${c.name}.`);
    sql.push(...guard('EXISTS(SELECT 1 FROM agency_files WHERE tenant_id=? AND customer_id=? AND kind=? AND verified_at IS NOT NULL AND revoked_at IS NULL)',ctx.workspace.id,c.id,kind));
   }
  }
  sql.push(...guard('EXISTS(SELECT 1 FROM customers WHERE tenant_id=? AND id=? AND type=? AND name=? AND license_number=? AND license_until=? AND identity_type=? AND identity_number=? AND identity_until=? AND issuing_country=? AND license_country=?)',ctx.workspace.id,c.id,c.type,c.name,c.licenseNumber,c.licenseUntil,c.identityType||'cin',c.identityNumber||'',c.identityUntil||'',c.issuingCountry||'',c.licenseCountry||''));
 }
 return {people,sql,parties:p};
}
export async function complianceGuards(ctx:Context,vehicle:Vehicle,until:string){
 if(ctx.workspace.mode!=='live')return [];const t=ctx.workspace.id,end=tunisDate(new Date(until)),sql:D1PreparedStatement[]=[];
 for(const kind of ['agency','vehicle','insurance','fiscal','privacy']){
  const local=['vehicle','insurance'].includes(kind),status=kind==='insurance'?'active':'approved';
  const row=await first<{id:string;version:number;data:string}>(`SELECT * FROM dossiers WHERE tenant_id=? AND kind=? AND status=? ${local?'AND vehicle_id=?':''} ORDER BY updated_at DESC LIMIT 1`,t,kind,status,...(local?[vehicle.id]:[]));
  requireCondition(row,'COMPLIANCE_DOSSIER_REQUIRED',`Complétez le dossier ${kind} dans Conformité & opérations avant une remise réelle.`);
  const d=JSON.parse(row.data);const expiry=kind==='vehicle'?d.operatingUntil:d.validUntil;if(expiry)requireCondition(expiry>=end,'COMPLIANCE_EXPIRED','Un dossier réglementaire expire avant la fin de location.');
  if(kind==='insurance')requireCondition(d.validFrom<=tunisDate(),'INSURANCE_NOT_STARTED','La police ne couvre pas encore le véhicule.');
  sql.push(...versionGuard('dossiers',t,row.id,row.version));
 }
 return sql;
}
export async function selectCommercialPolicy(ctx:Context,input:{ratePlanId?:string;startAt:string;endAt:string;customerId:string;parties?:Rental['parties'];dailyRate:number},vehicle:Vehicle){
 if(!input.ratePlanId)return {policy:null,sql:[] as D1PreparedStatement[]};
 const row=await first<{id:string;version:number;status:string;data:string}>("SELECT * FROM dossiers WHERE tenant_id=? AND id=? AND kind='rate'",ctx.workspace.id,input.ratePlanId);requireCondition(row?.status==='active','RATE_UNAVAILABLE','Cette grille n’est pas active.');const d=JSON.parse(row.data),days=rentalDays(input.startAt,input.endAt);
 requireCondition(d.validFrom<=tunisDate(new Date(input.startAt))&&d.validUntil>=tunisDate(new Date(input.endAt))&&days>=d.minimumDays&&days<=d.maximumDays&&(!d.category||d.category===vehicle.category)&&(!d.customerId||d.customerId===(input.parties?.payerId||input.customerId)),'RATE_NOT_APPLICABLE','La saison, durée, catégorie ou le payeur ne correspond pas à cette grille.');
 requireCondition(input.dailyRate===d.dailyRate,'RATE_CHANGED','Le tarif doit correspondre à la grille choisie.');return {policy:{...d,id:row.id,version:row.version},sql:versionGuard('dossiers',ctx.workspace.id,row.id,row.version)};
}
export async function selectTerms(ctx:Context,language:string){if(language==='fr')return {text:ctx.workspace.settings.contractTerms,version:ctx.workspace.settings.termsVersion,sql:[] as D1PreparedStatement[]};const row=await first<{id:string;version:number;data:string}>("SELECT * FROM dossiers WHERE tenant_id=? AND kind='terms' AND status='approved' AND json_extract(data,'$.language')=? ORDER BY updated_at DESC LIMIT 1",ctx.workspace.id,language);requireCondition(row,'TRANSLATION_REQUIRED','Ajoutez une version approuvée des conditions dans cette langue.');const d=JSON.parse(row.data);return {text:d.text,version:d.version,sql:versionGuard('dossiers',ctx.workspace.id,row.id,row.version)};}
export async function authorizationHeld(ctx:Context,rentalId:string,until:string){const row=await first<{amount:number}>("SELECT COALESCE(SUM(CAST(json_extract(data,'$.amount') AS INTEGER)),0) amount FROM dossiers WHERE tenant_id=? AND kind='instrument' AND rental_id=? AND status='authorized' AND json_extract(data,'$.instrumentType')='preauthorization' AND json_extract(data,'$.purpose')='deposit_received' AND json_extract(data,'$.validUntil')>=?",ctx.workspace.id,rentalId,tunisDate(new Date(until)));return row?.amount||0;}
export async function changeParties(ctx:Context,m:Mutation,id:string,body:unknown){
 authorize(ctx,['owner','manager','agent']);const input=z.object({parties:partiesSchema,expectedVersion:z.number().int().positive(),reason:z.string().trim().min(3).max(1000),accepted:z.literal(true)}).strict().parse(body),r=await entity<Rental>('rentals',ctx.workspace.id,id);
 requireCondition(['draft','confirmed','active'].includes(r.status),'RENTAL_CLOSED','Les parties d’un dossier clôturé sont figées.');requireCondition(r.version===input.expectedVersion,'STALE_VERSION','Le dossier a changé.',409);
 const next={...r,parties:input.parties,version:r.version+1},checked=await validateParties(ctx,next,r.status==='active'?r.endAt:undefined),sql=[...versionGuard('rentals',ctx.workspace.id,id,r.version),...checked.sql,update('rentals',{parties:input.parties,version:next.version},'tenant_id=? AND id=?',ctx.workspace.id,id)];
 if(r.status==='active'){const vehicle=await entity<Vehicle>('vehicles',ctx.workspace.id,r.vehicleId),customer=await entity<Customer>('customers',ctx.workspace.id,r.customerId),data=JSON.stringify({rental:next,customer,vehicle,people:checked.people,settings:ctx.workspace.settings,mode:ctx.workspace.mode,amendment:{reason:input.reason,acceptedAt:now(),actor:ctx.user.userId}});sql.push(insert('document_snapshots',{id:newId('doc'),tenantId:ctx.workspace.id,rentalId:id,kind:'contract',version:next.version,data,hash:await hash(data),createdAt:now()}));}
 return commit(ctx,m,sql,{id},{action:'rental.parties_amended',type:'rental',id,detail:`Avenant accepté · ${input.reason}`});
}
