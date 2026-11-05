import { z } from 'zod';
import type { ChatGPTUser } from '../app/chatgpt-auth';
import type { Vehicle, Customer, Rental, Invoice, Inspection, Payment } from '../lib/types';
import { type Context,type Mutation,context,insert,commit,newId,now,hash,guard,first,previous } from './db';
import { defaultSettings,priceFromSettings,tunisDate,DAY,requireCondition } from './domain';
import { snapshotStatement } from './rentals';
import { getWorkspaceData } from './read';

const dateAt=(offset:number,hour=10)=>new Date(`${tunisDate(new Date(Date.now()+offset*DAY))}T${String(hour).padStart(2,'0')}:00:00+01:00`).toISOString();
const expiry=(days:number)=>tunisDate(new Date(Date.now()+days*DAY));
export async function setupWorkspace(user:ChatGPTUser,m:Mutation,body:unknown,additional=false){
  const input=z.object({mode:z.enum(['demo','live']),name:z.string().trim().min(2).max(120)}).strict().parse(body);
  const existing=await context(user,null);if(existing&&!additional){requireCondition(existing.workspace.mode===input.mode&&existing.workspace.name===input.name,'ALREADY_CONFIGURED','Votre agence est déjà configurée.',409);return getWorkspaceData(user,existing.workspace.id);}
  const id=`tenant_${(await hash(additional?`${user.userId}:${m.key}`:user.userId)).slice(0,24)}`,memberId=newId('member'),time=now();const settings=defaultSettings(input.name);
  if(input.mode==='demo'){settings.address='Adresse fictive · Les Berges du Lac, Tunis';settings.phone='+216 00 000 000';settings.contractTerms='DOCUMENT DE DÉMONSTRATION. Ces conditions fictives illustrent le parcours de location et ne constituent pas un contrat validé. Le véhicule doit être restitué à la date prévue. Toute modification exige un accord tracé.';settings.termsVersion='demo-1';}
  const ctx:Context={user,workspace:{id,name:input.name,mode:input.mode,settings,createdAt:time},role:'owner',memberId,workspaceVersion:0};
  if(await previous(ctx,m))return getWorkspaceData(user,id);
  const count=await first<{n:number}>('SELECT count(*) n FROM workspaces WHERE owner_id=?',user.userId);requireCondition((count?.n||0)<25,'WORKSPACE_LIMIT','La limite de 25 entreprises par propriétaire est atteinte.');
  const sql:D1PreparedStatement[]=[...guard('(SELECT count(*) FROM workspaces WHERE owner_id=?)<25',user.userId),insert('workspaces',{id,ownerId:user.userId,name:input.name,mode:input.mode,settings:JSON.stringify(settings),version:1,createdAt:time}),insert('members',{id:memberId,tenantId:id,userId:user.userId,email:user.email.toLowerCase(),name:user.displayName,role:'owner',createdAt:time})];
  if(input.mode==='demo')sql.push(...await demoStatements(ctx));
  await commit(ctx,m,sql,{id},{action:'workspace.created',type:'workspace',id,detail:input.mode==='demo'?'Espace de démonstration créé avec des données entièrement fictives.':'Agence créée. Paramètres fiscaux, contrats et traitement des données à valider.'});
  return getWorkspaceData(user,id);
}

async function demoStatements(ctx:Context){
  const t=ctx.workspace.id,time=now(),sql:D1PreparedStatement[]=[];
  const fleet=[['Hyundai','i20','Citadine',85000],['Kia','Picanto','Citadine',70000],['Renault','Clio V','Économique',95000],['Peugeot','208','Économique',100000],['Dacia','Sandero','Économique',80000],['Volkswagen','Polo','Citadine',110000],['Toyota','Yaris','Hybride',125000],['Hyundai','Tucson','SUV',210000],['Kia','Sportage','SUV',220000],['Peugeot','3008','SUV',230000],['Citroën','C3','Citadine',90000],['Renault','Mégane','Berline',145000],['Volkswagen','Golf','Berline',160000],['Škoda','Octavia','Berline',170000],['Dacia','Duster','SUV',150000],['Toyota','Corolla','Hybride',180000]] as const;
  const vehicles:Vehicle[]=fleet.map(([make,model,category,dailyRate],i)=>({id:newId('vehicle'),registration:`DÉMO ${String(i+1).padStart(3,'0')}`,make,model,category,dailyRate,year:2022+i%4,transmission:i%3===0?'automatic':'manual',fuel:category==='Hybride'?'hybrid':i%5===0?'diesel':'petrol',seats:5,odometer:18000+i*3700,status:'ready',deposit:category==='SUV'?1500000:1000000,insuranceUntil:expiry(i===14?4:120+i*3),inspectionUntil:expiry(i===15?7:180+i*2),color:['Blanc','Gris','Noir','Bleu'][i%4],version:1,createdAt:dateAt(-90)}));
  vehicles.forEach(v=>sql.push(insert('vehicles',{...v,bodyType:v.category==='SUV'?'suv':v.category==='Berline'?'sedan':'hatchback',vin:'',tenantId:t})));
  const names=['Amine Ben Salah','Sarra Trabelsi','Youssef Mansour','Lina Haddad','Karim Bouslama','Inès Jaziri','Nour Ben Ali','Mehdi Ferjani','Atlas Conseil','Rim Khelifi'];
  const customers:Customer[]=names.map((name,i)=>({id:newId('customer'),type:i===8?'company':'individual',name:`${name} · Démo`,email:`client${i+1}@example.test`,phone:`+216 00 000 ${String(i+1).padStart(3,'0')}`,country:i===3?'France':'Tunisie',address:'Adresse fictive de démonstration, Tunis',licenseNumber:`DEMO-PERMIS-${i+1}`,licenseUntil:expiry(730),taxId:i===8?'DEMO-ENTREPRISE':'',notes:'Personne fictive. Ne pas utiliser pour une opération réelle.',createdAt:dateAt(-45)}));
  customers.forEach(c=>sql.push(insert('customers',{...c,tenantId:t})));
  const plans:[number,number,number,Rental['status'],number][]=[[0,-3,2,'active',10],[1,-2,1,'active',10],[2,-1,0,'active',17],[3,0,2,'confirmed',11],[4,0,4,'confirmed',15],[5,1,4,'confirmed',10],[6,2,7,'confirmed',10],[7,-8,-4,'returned',10],[8,-6,-3,'returned',10],[9,-10,-5,'returned',10],[10,-4,-1,'active',10],[11,3,6,'draft',10]];
  let n=0;
  for(const [vi,start,end,status,hour] of plans){
    const vehicle=vehicles[vi],customer=customers[n%customers.length],rentalId=newId('rental');
    const startAt=dateAt(start,hour),endAt=dateAt(end,hour);const base={startAt,endAt,dailyRate:vehicle.dailyRate,discount:0,extras:0};const pricing=priceFromSettings(base,ctx.workspace.settings);
    const rental:Rental={id:rentalId,number:`DEMO-LOC-${String(++n).padStart(4,'0')}`,customerId:customer.id,vehicleId:vehicle.id,...base,...pricing,status,actualStartAt:['active','returned'].includes(status)?startAt:null,actualEndAt:status==='returned'?endAt:null,depositRequired:vehicle.deposit,includedKm:pricing.days*200,extraKmRate:500,source:n%3===0?'website':'agency',pickupLocation:n%4===0?'Aéroport Tunis-Carthage':'Agence Tunis · Lac 1',returnLocation:'Agence Tunis · Lac 1',notes:'Dossier fictif de démonstration.',termsVersion:ctx.workspace.settings.termsVersion,termsSnapshot:ctx.workspace.settings.contractTerms,version:status==='returned'?3:status==='active'?2:1,createdAt:dateAt(start-3)};
    sql.push(insert('rentals',{...rental,tenantId:t,pricingSnapshot:JSON.stringify({settings:ctx.workspace.settings,quotedAt:rental.createdAt,durationRule:'24h-ceiling'})}));
    if(['active','confirmed'].includes(status))sql.push(insert('vehicle_blocks',{id:newId('block'),tenantId:t,vehicleId:vehicle.id,rentalId,maintenanceId:null,kind:'rental',startMs:Date.parse(startAt),endMs:Date.parse(endAt)+3600000}));
    if(['active','returned'].includes(status)){
      const inspection:Inspection={id:newId('inspection'),rentalId,vehicleId:vehicle.id,type:'departure',odometer:vehicle.odometer-(status==='returned'?320:0),fuelPercent:100,condition:'Bon état · données fictives',damages:'Aucun dommage signalé dans cet exemple.',customerAccepted:true,createdAt:startAt};
      sql.push(insert('inspections',{...inspection,tenantId:t}),insert('assignments',{id:newId('assignment'),tenantId:t,rentalId,vehicleId:vehicle.id,startAt,endAt:status==='returned'?endAt:null,startOdometer:inspection.odometer,endOdometer:status==='returned'?vehicle.odometer:null,reason:'Démonstration',createdAt:startAt}),await snapshotStatement(ctx,rental,vehicle,customer,inspection));
      if(status==='returned')sql.push(insert('inspections',{...inspection,id:newId('inspection'),type:'return',odometer:vehicle.odometer,createdAt:endAt,tenantId:t}));
    }
    const makePayment=(kind:Payment['kind'],amount:number,createdAt:string)=>sql.push(insert('payments',{id:newId('payment'),tenantId:t,rentalId,invoiceId:null,kind,method:'bank',amount,reference:'DEMO-VIREMENT',note:'Mouvement fictif de démonstration',cashSessionId:null,createdAt}));
    if(['active','returned'].includes(status)){makePayment('deposit_received',vehicle.deposit,startAt);makePayment('payment',status==='returned'?rental.total:Math.floor(rental.total/2),startAt);}
    if(status==='returned'){
      makePayment('deposit_returned',vehicle.deposit,endAt);
      const invoice:Invoice={id:newId('invoice'),number:`DEMO-BRO-${String(n).padStart(4,'0')}`,rentalId,customerId:customer.id,status:'draft',subtotal:rental.subtotal,tax:rental.tax,stamp:rental.stamp,dailyLevy:rental.dailyLevy,total:rental.total,taxRateBps:rental.taxRateBps,externalStatus:'not_configured',issuedAt:null,createdAt:endAt};
      sql.push(insert('invoices',{...invoice,tenantId:t,snapshot:JSON.stringify({rental,customer,vehicle,settings:ctx.workspace.settings,invoice,mode:'demo'})}));
    }
  }
  for(const [vi,start,end,title,cost] of [[12,0,2,'Révision et vidange',180000],[13,2,3,'Contrôle pneumatiques',45000]] as const){const id=newId('maintenance');sql.push(insert('maintenance',{id,tenantId:t,vehicleId:vehicles[vi].id,title,startAt:dateAt(start,8),endAt:dateAt(end,18),status:'planned',cost,supplier:'Atelier Démo',odometer:vehicles[vi].odometer,notes:'Intervention fictive',createdAt:time}),insert('vehicle_blocks',{id:newId('block'),tenantId:t,vehicleId:vehicles[vi].id,rentalId:null,maintenanceId:id,kind:'maintenance',startMs:Date.parse(dateAt(start,8)),endMs:Date.parse(dateAt(end,18))}));}
  for(const [category,amount,note] of [['Assurance',240000,'Échéance fictive'],['Lavage',45000,'Préparation des véhicules'],['Carburant',120000,'Livraisons de démonstration']] as const)sql.push(insert('expenses',{id:newId('expense'),tenantId:t,vehicleId:vehicles[0].id,category,supplier:'Prestataire Démo',amount,date:expiry(-2),note,createdAt:time}));
  sql.push(insert('cash_sessions',{id:newId('cash'),tenantId:t,openedAt:time,closedAt:null,openingAmount:250000,expectedAmount:null,countedAmount:null,note:'Fond de caisse fictif de démonstration',createdAt:time}));
  return sql;
}
