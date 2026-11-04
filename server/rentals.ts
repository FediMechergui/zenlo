import type { Customer, Rental, Vehicle, Inspection } from '../lib/types';
import { rentalSchema, actionSchema } from './validation';
import { type Context,type Mutation,authorize,entity,rows,guard,versionGuard,insert,statement,update,commit,newId,now,hash,first } from './db';
import { requireCondition,priceFromSettings,priceFromRental,ensureDocuments,fiscalGate,financialBalance,tunisDate,safeMoney } from './domain';

const operations=['owner','manager','agent'] as const;
const assertRole=(ctx:Context)=>authorize(ctx,[...operations]);
export async function snapshotStatement(ctx:Context,rental:Rental,vehicle:Vehicle,customer:Customer,inspection?:Inspection){
  const data=JSON.stringify({rental,vehicle,customer,settings:ctx.workspace.settings,inspection:inspection||null,mode:ctx.workspace.mode});
  return insert('document_snapshots',{id:newId('doc'),tenantId:ctx.workspace.id,rentalId:rental.id,kind:'contract',version:rental.version,data,hash:await hash(data),createdAt:now()});
}
function occupation(ctx:Context,rental:Rental,kind='rental',startMs=Date.parse(rental.startAt),endMs=Date.parse(rental.endAt)+ctx.workspace.settings.preparationMinutes*60000){return insert('vehicle_blocks',{id:newId('block'),tenantId:ctx.workspace.id,vehicleId:rental.vehicleId,rentalId:rental.id,maintenanceId:null,kind,startMs,endMs});}
function vehicleReady(v:Vehicle){requireCondition(v.status==='ready','VEHICLE_UNAVAILABLE','Ce véhicule est immobilisé ou retiré du parc.');}
function customerEligible(c:Customer,until:string){requireCondition(!!c.licenseNumber&&!!c.licenseUntil,'LICENSE_REQUIRED','Renseignez le permis du conducteur avant le départ.');requireCondition(c.licenseUntil>=tunisDate(new Date(until)),'LICENSE_EXPIRED','Le permis du conducteur doit couvrir toute la location.');}
export async function createRental(ctx:Context,m:Mutation,body:unknown){
  assertRole(ctx);const input=rentalSchema.parse(body);const tenant=ctx.workspace.id;
  const [vehicle,customer]=await Promise.all([entity<Vehicle>('vehicles',tenant,input.vehicleId),entity<Customer>('customers',tenant,input.customerId)]);
  vehicleReady(vehicle);if(input.status==='confirmed'){fiscalGate(ctx.workspace.settings,ctx.workspace.mode);ensureDocuments(vehicle,input.endAt);}
  const price=priceFromSettings(input,ctx.workspace.settings);const id=newId('rental');
  const rental:Rental={...input,...price,id,number:`LOC-${new Date().getUTCFullYear()}-${id.slice(-8).toUpperCase()}`,actualStartAt:null,actualEndAt:null,termsVersion:ctx.workspace.settings.termsVersion,termsSnapshot:ctx.workspace.settings.contractTerms,version:1,createdAt:now()};
  const sql=[...guard('EXISTS(SELECT 1 FROM workspaces WHERE id=? AND version=?)',tenant,ctx.workspaceVersion),...versionGuard('vehicles',tenant,vehicle.id,vehicle.version),insert('rentals',{...rental,tenantId:tenant,pricingSnapshot:JSON.stringify({settings:ctx.workspace.settings,quotedAt:now(),durationRule:'24h-ceiling'})})];
  if(rental.status==='confirmed')sql.push(occupation(ctx,rental));
  return commit(ctx,m,sql,{id},{action:'rental.created',type:'rental',id,detail:`${rental.number} · ${rental.status} · ${customer.name}`});
}
export async function rentalAction(ctx:Context,m:Mutation,id:string,body:unknown){
  assertRole(ctx);const input=actionSchema.parse(body);const tenant=ctx.workspace.id;
  const rental=await entity<Rental>('rentals',tenant,id);requireCondition(rental.version===input.expectedVersion,'STALE_VERSION','Ce dossier a été modifié. Actualisez avant de recommencer.',409);
  const [vehicle,customer]=await Promise.all([entity<Vehicle>('vehicles',tenant,rental.vehicleId),entity<Customer>('customers',tenant,rental.customerId)]);
  const sql:D1PreparedStatement[]=[...versionGuard('rentals',tenant,id,input.expectedVersion),...guard('EXISTS(SELECT 1 FROM workspaces WHERE id=? AND version=?)',tenant,ctx.workspaceVersion)];
  const changed:Rental={...rental,version:rental.version+1};const time=now();let inspection:Inspection|undefined;
  if(input.action==='confirm'){
    requireCondition(rental.status==='draft','INVALID_TRANSITION','Seul un devis brouillon peut être confirmé.');fiscalGate(ctx.workspace.settings,ctx.workspace.mode);vehicleReady(vehicle);ensureDocuments(vehicle,rental.endAt);
    const fiscal=ctx.workspace.settings;requireCondition(rental.taxRateBps===fiscal.taxRateBps&&rental.stamp===fiscal.stampMillimes&&rental.dailyLevyRate===(fiscal.dailyLevyEnabled?fiscal.dailyLevyRate:0)&&rental.dailyLevyTaxable===fiscal.dailyLevyTaxable,'QUOTE_FISCAL_CHANGED','Les paramètres fiscaux ont changé depuis ce devis. Créez un nouveau devis et faites accepter son montant avant confirmation.');
    changed.status='confirmed';sql.push(...versionGuard('vehicles',tenant,vehicle.id,vehicle.version),occupation(ctx,changed));
  }else if(input.action==='cancel'){
    requireCondition(['draft','confirmed'].includes(rental.status),'INVALID_TRANSITION','Seule une réservation non commencée peut être annulée.');changed.status='cancelled';changed.notes=[rental.notes,`Annulation : ${input.reason}`].filter(Boolean).join('\n');sql.push(statement('DELETE FROM vehicle_blocks WHERE tenant_id=? AND rental_id=?',tenant,id));
  }else if(input.action==='checkout'){
    requireCondition(rental.status==='confirmed','INVALID_TRANSITION','Confirmez la réservation avant le départ.');fiscalGate(ctx.workspace.settings,ctx.workspace.mode);vehicleReady(vehicle);ensureDocuments(vehicle,rental.endAt);customerEligible(customer,rental.endAt);
    requireCondition(Date.parse(rental.endAt)>Date.now(),'RENTAL_ENDED','La période prévue est terminée. Prolongez la réservation avant le départ.');
    requireCondition(Date.parse(rental.startAt)<=Date.now()+15*60000,'TOO_EARLY','Le départ peut être enregistré à partir de 15 minutes avant l’heure prévue.');
    requireCondition(input.inspection.customerAccepted,'ACCEPTANCE_REQUIRED','L’acceptation de l’état des lieux doit être constatée avant la remise.');
    requireCondition(input.inspection.odometer>=vehicle.odometer,'ODOMETER_DECREASE','Le kilométrage ne peut pas diminuer.');
    const balance=financialBalance((await rows<{rentalId:string;kind:string;amount:number}>('payments',tenant)).filter(p=>p.rentalId===id));
    requireCondition(balance.deposit>=rental.depositRequired,'DEPOSIT_REQUIRED',`La caution doit être constituée avant le départ. Il reste ${((rental.depositRequired-balance.deposit)/1000).toFixed(3)} TND à enregistrer.`);
    // Rechecked atomically; a concurrent refund cannot bypass the departure guarantee requirement.
    sql.push(...guard(`COALESCE((SELECT SUM(CASE WHEN kind='deposit_received' THEN amount WHEN kind IN ('deposit_returned','deposit_applied') THEN -amount ELSE 0 END) FROM payments WHERE tenant_id=? AND rental_id=?),0)>=?`,tenant,id,rental.depositRequired));
    changed.status='active';changed.actualStartAt=time;inspection={...input.inspection,id:newId('inspection'),rentalId:id,vehicleId:vehicle.id,type:'departure',createdAt:time};
    sql.push(...versionGuard('vehicles',tenant,vehicle.id,vehicle.version),update('vehicles',{odometer:input.inspection.odometer,version:vehicle.version+1},'tenant_id=? AND id=?',tenant,vehicle.id),insert('inspections',{...inspection,tenantId:tenant}),insert('assignments',{id:newId('assignment'),tenantId:tenant,rentalId:id,vehicleId:vehicle.id,startAt:time,endAt:null,startOdometer:input.inspection.odometer,endOdometer:null,reason:'Départ',createdAt:time}));
    sql.push(update('vehicle_blocks',{startMs:Math.min(Date.parse(rental.startAt),Date.now())},'tenant_id=? AND rental_id=?',tenant,id));
  }else if(input.action==='checkin'){
    requireCondition(rental.status==='active','INVALID_TRANSITION','Seule une location en cours peut être retournée.');requireCondition(input.inspection.odometer>=vehicle.odometer,'ODOMETER_DECREASE','Le kilométrage de retour est inférieur au dernier relevé.');
    const assignments=await rows<{rentalId:string;startOdometer:number;endOdometer:number|null}>('assignments',tenant);
    const travelled=assignments.filter(a=>a.rentalId===id).reduce((sum,a)=>sum+(a.endOdometer===null?input.inspection.odometer-a.startOdometer:a.endOdometer-a.startOdometer),0);
    const kmExtra=Math.max(0,travelled-rental.includedKm)*rental.extraKmRate;
    const extras=safeMoney(rental.extras+(input.extras??0)+kmExtra);const price=priceFromRental(rental,rental.endAt,extras);Object.assign(changed,price,{extras,status:'returned',actualEndAt:time});
    inspection={...input.inspection,id:newId('inspection'),rentalId:id,vehicleId:vehicle.id,type:'return',createdAt:time};
    sql.push(...versionGuard('vehicles',tenant,vehicle.id,vehicle.version),update('vehicles',{odometer:input.inspection.odometer,version:vehicle.version+1},'tenant_id=? AND id=?',tenant,vehicle.id),insert('inspections',{...inspection,tenantId:tenant}),update('assignments',{endAt:time,endOdometer:input.inspection.odometer},'tenant_id=? AND rental_id=? AND end_at IS NULL',tenant,id),statement('DELETE FROM vehicle_blocks WHERE tenant_id=? AND rental_id=?',tenant,id));
    if(ctx.workspace.settings.preparationMinutes>0)sql.push(occupation(ctx,changed,'cleanup',Date.parse(time),Date.parse(time)+ctx.workspace.settings.preparationMinutes*60000));
    changed.notes=[rental.notes,kmExtra>0?`Kilométrage supplémentaire : ${Math.max(0,travelled-rental.includedKm)} km (${kmExtra} millimes).`:'',input.inspection.customerAccepted?'':'État de retour contesté : validation financière requise.'].filter(Boolean).join('\n');
  }else if(input.action==='extend'){
    requireCondition(['confirmed','active'].includes(rental.status),'INVALID_TRANSITION','Seule une location confirmée ou en cours peut être prolongée.');requireCondition(Date.parse(input.endAt)>Date.parse(rental.endAt),'INVALID_DATES','La nouvelle fin doit être postérieure à la fin actuelle.');ensureDocuments(vehicle,input.endAt);if(rental.status==='active')customerEligible(customer,input.endAt);
    Object.assign(changed,priceFromRental(rental,input.endAt),{endAt:input.endAt});
    sql.push(...versionGuard('vehicles',tenant,vehicle.id,vehicle.version),update('vehicle_blocks',{endMs:Date.parse(input.endAt)+ctx.workspace.settings.preparationMinutes*60000},'tenant_id=? AND rental_id=?',tenant,id));
  }else if(input.action==='swap'){
    requireCondition(rental.status==='active','INVALID_TRANSITION','Un remplacement nécessite une location en cours.');requireCondition(Date.parse(rental.endAt)>Date.now(),'RENTAL_ENDED','Prolongez la location en retard avant de remettre un véhicule de remplacement.');requireCondition(input.vehicleId!==rental.vehicleId,'SAME_VEHICLE','Choisissez un autre véhicule.');requireCondition(input.oldOdometer>=vehicle.odometer,'ODOMETER_DECREASE','Le kilométrage de l’ancien véhicule ne peut pas diminuer.');
    const next=await entity<Vehicle>('vehicles',tenant,input.vehicleId);vehicleReady(next);ensureDocuments(next,rental.endAt);requireCondition(input.newOdometer>=next.odometer,'ODOMETER_DECREASE','Le kilométrage du véhicule de remplacement ne peut pas diminuer.');
    changed.vehicleId=next.id;changed.notes=[rental.notes,`Remplacement ${vehicle.registration} → ${next.registration} : ${input.reason}`].filter(Boolean).join('\n');
    sql.push(...versionGuard('vehicles',tenant,vehicle.id,vehicle.version),...versionGuard('vehicles',tenant,next.id,next.version),update('vehicles',{odometer:input.oldOdometer,version:vehicle.version+1},'tenant_id=? AND id=?',tenant,vehicle.id),update('vehicles',{odometer:input.newOdometer,version:next.version+1},'tenant_id=? AND id=?',tenant,next.id),update('assignments',{endAt:time,endOdometer:input.oldOdometer},'tenant_id=? AND rental_id=? AND end_at IS NULL',tenant,id),insert('assignments',{id:newId('assignment'),tenantId:tenant,rentalId:id,vehicleId:next.id,startAt:time,endAt:null,startOdometer:input.newOdometer,endOdometer:null,reason:input.reason,createdAt:time}),statement('DELETE FROM vehicle_blocks WHERE tenant_id=? AND rental_id=?',tenant,id),occupation(ctx,changed,'rental',Date.parse(time),Math.max(Date.parse(rental.endAt)+ctx.workspace.settings.preparationMinutes*60000,Date.parse(time)+60000)));
    requireCondition(input.oldInspection.odometer===input.oldOdometer&&input.newInspection.odometer===input.newOdometer,'ODOMETER_MISMATCH','Les relevés doivent correspondre aux états des lieux.');requireCondition(input.newInspection.customerAccepted,'ACCEPTANCE_REQUIRED','L’état des lieux du véhicule de remplacement doit être accepté.');
    if(ctx.workspace.settings.preparationMinutes>0)sql.push(insert('vehicle_blocks',{id:newId('block'),tenantId:tenant,vehicleId:vehicle.id,rentalId:null,maintenanceId:null,kind:'cleanup',startMs:Date.parse(time),endMs:Date.parse(time)+ctx.workspace.settings.preparationMinutes*60000}));
    let replacementInspection:Inspection|undefined;
    for(const [v,details,type] of [[vehicle,input.oldInspection,'return'],[next,input.newInspection,'departure']] as const){const record:Inspection={...details,id:newId('inspection'),rentalId:id,vehicleId:v.id,type,createdAt:time};sql.push(insert('inspections',{...record,tenantId:tenant}));if(type==='departure')replacementInspection=record;}
    sql.push(await snapshotStatement(ctx,changed,{...next,odometer:input.newOdometer},customer,replacementInspection));
  }
  const {createdAt,...fields}=changed;sql.push(update('rentals',fields,'tenant_id=? AND id=?',tenant,id));
  if(['checkout','checkin','extend'].includes(input.action))sql.push(await snapshotStatement(ctx,changed,vehicle,customer,inspection));
  return commit(ctx,m,sql,{id},{action:`rental.${input.action}`,type:'rental',id,detail:`${rental.number} · version ${changed.version}`});
}
