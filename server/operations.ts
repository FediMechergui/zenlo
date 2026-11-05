import { validateDiagramReference } from './diagram-assets';
import { z } from 'zod';
import { diagramFingerprint } from '../lib/inspection';
import type { AgencySettings, Vehicle, Maintenance, Supplier, Customer } from '../lib/types';
import { type Context,type Mutation,authorize,entity,guard,versionGuard,insert,statement,update,commit,newId,now,first } from './db';
import { vehicleSchema,vehiclePatch,customerSchema,maintenanceSchema,expenseSchema,settingsSchema,memberSchema,money,short,text,required } from './validation';
import { requireCondition,rentalDays,tunisDate } from './domain';

export async function createVehicle(ctx:Context,m:Mutation,body:unknown){
  authorize(ctx,['owner','manager']);const value=vehicleSchema.parse(body),id=newId('vehicle');
  return commit(ctx,m,[...await validateDiagramReference(ctx,value),insert('vehicles',{...value,id,tenantId:ctx.workspace.id,status:'ready',version:1,createdAt:now()})],{id},{action:'vehicle.created',type:'vehicle',id,detail:`${value.make} ${value.model} · ${value.registration}`});
}
export async function patchVehicle(ctx:Context,m:Mutation,id:string,body:unknown){
  authorize(ctx,['owner','manager']);const {expectedVersion,...value}=vehiclePatch.parse(body);requireCondition(Object.keys(value).length>0,'NO_CHANGES','Aucune modification reçue.');const t=ctx.workspace.id,old=await entity<Vehicle>('vehicles',t,id);
  requireCondition(old.version===expectedVersion,'STALE_VERSION','Ce véhicule a été modifié. Actualisez la fiche.',409);if(value.odometer!==undefined)requireCondition(value.odometer>=old.odometer,'ODOMETER_DECREASE','Une correction négative exige une procédure de rectification documentée.');
  const sql=[...versionGuard('vehicles',t,id,expectedVersion),...await validateDiagramReference(ctx,{...old,...value})];
  if(value.bodyType!==undefined||value.diagramProfile!==undefined||value.rentalPolicy!==undefined){
    const changed=(value.bodyType!==undefined&&value.bodyType!==old.bodyType)||(value.diagramProfile!==undefined&&diagramFingerprint(value.diagramProfile)!==diagramFingerprint(old.diagramProfile))||(value.rentalPolicy!==undefined&&JSON.stringify(value.rentalPolicy??null)!==JSON.stringify(old.rentalPolicy??null));
    if(changed){requireCondition(!await first("SELECT id FROM rentals WHERE tenant_id=? AND vehicle_id=? AND status='active'",t,id),'VEHICLE_IN_USE','Terminez la location en cours avant de modifier la silhouette ou les règles de location de ce véhicule.',409);sql.push(...guard("NOT EXISTS(SELECT 1 FROM rentals WHERE tenant_id=? AND vehicle_id=? AND status='active')",t,id));}
  }
  if(value.status&&value.status!=='ready')sql.push(...guard("NOT EXISTS(SELECT 1 FROM rentals WHERE tenant_id=? AND vehicle_id=? AND status='active')",t,id));
  sql.push(update('vehicles',{...value,version:expectedVersion+1},'tenant_id=? AND id=?',t,id));
  return commit(ctx,m,sql,{id},{action:'vehicle.updated',type:'vehicle',id,detail:`${old.registration} · champs : ${Object.keys(value).join(', ')}`});
}
export async function createCustomer(ctx:Context,m:Mutation,body:unknown){
  authorize(ctx,['owner','manager','agent']);const value=customerSchema.parse(body),id=newId('customer');
  if(ctx.workspace.mode==='live')requireCondition(ctx.workspace.settings.hostingValidated,'HOSTING_VALIDATION_REQUIRED','Validez le traitement des données personnelles avant d’enregistrer un client réel.');
  return commit(ctx,m,[...guard('EXISTS(SELECT 1 FROM workspaces WHERE id=? AND version=?)',ctx.workspace.id,ctx.workspaceVersion),insert('customers',{...value,id,tenantId:ctx.workspace.id,createdAt:now()})],{id},{action:'customer.created',type:'customer',id,detail:`Fiche client créée · ${value.type}`});
}
export async function patchCustomer(ctx:Context,m:Mutation,id:string,body:unknown){
  authorize(ctx,['owner','manager','agent']);const data=customerSchema.partial().strict().parse(body);requireCondition(Object.keys(data).length>0,'NO_CHANGES','Aucune modification reçue.');const old=await entity<Customer>('customers',ctx.workspace.id,id);
  if(ctx.workspace.mode==='live')requireCondition(ctx.workspace.settings.hostingValidated,'HOSTING_VALIDATION_REQUIRED','Validez le traitement des données personnelles avant de modifier un client réel.');
  const identityChanged=(['name','identityType','identityNumber','identityUntil','issuingCountry','birthDate','licenseCountry','licenseIssuedAt'] as const).some(k=>data[k]!==undefined&&data[k]!==old[k]);
  const proofReset=identityChanged?statement("UPDATE agency_files SET verified_at=NULL,verified_by=NULL WHERE tenant_id=? AND customer_id=? AND kind IN ('identity_front','identity_back','license_front','license_back') AND revoked_at IS NULL",ctx.workspace.id,id):data.licenseNumber!==undefined&&data.licenseNumber!==old.licenseNumber||data.licenseUntil!==undefined&&data.licenseUntil!==old.licenseUntil?statement("UPDATE agency_files SET verified_at=NULL,verified_by=NULL WHERE tenant_id=? AND customer_id=? AND kind IN ('license_front','license_back') AND revoked_at IS NULL",ctx.workspace.id,id):null;
  return commit(ctx,m,[...guard('EXISTS(SELECT 1 FROM workspaces WHERE id=? AND version=?)',ctx.workspace.id,ctx.workspaceVersion),...(proofReset?[proofReset]:[]),update('customers',data,'tenant_id=? AND id=?',ctx.workspace.id,id)],{id},{action:'customer.updated',type:'customer',id,detail:`Champs : ${Object.keys(data).join(', ')}. Documents historiques conservés.${proofReset?' Pièces à vérifier à nouveau.':''}`});
}
export async function createMaintenance(ctx:Context,m:Mutation,body:unknown){
  authorize(ctx,['owner','manager','mechanic']);const data=maintenanceSchema.parse(body),t=ctx.workspace.id;rentalDays(data.startAt,data.endAt);const vehicle=await entity<Vehicle>('vehicles',t,data.vehicleId);requireCondition(vehicle.status!=='retired','VEHICLE_RETIRED','Ce véhicule est retiré du parc.');requireCondition(data.odometer>=vehicle.odometer,'ODOMETER_DECREASE','Le kilométrage de maintenance ne peut pas diminuer.');const id=newId('maintenance');
  const sql=[...versionGuard('vehicles',t,vehicle.id,vehicle.version),insert('maintenance',{...data,id,tenantId:t,status:'planned',createdAt:now()}),insert('vehicle_blocks',{id:newId('block'),tenantId:t,vehicleId:vehicle.id,rentalId:null,maintenanceId:id,kind:'maintenance',startMs:Date.parse(data.startAt),endMs:Date.parse(data.endAt)}),update('vehicles',{odometer:data.odometer,version:vehicle.version+1},'tenant_id=? AND id=?',t,vehicle.id)];
  return commit(ctx,m,sql,{id},{action:'maintenance.planned',type:'maintenance',id,detail:`${vehicle.registration} · ${data.title}`});
}
export async function completeMaintenance(ctx:Context,m:Mutation,id:string,body:unknown){
  authorize(ctx,['owner','manager','mechanic']);const data=z.object({cost:money.optional(),supplierId:required.nullable().optional(),reference:short.default(''),note:text.default('')}).strict().parse(body);const t=ctx.workspace.id,work=await entity<Maintenance>('maintenance',t,id);requireCondition(work.status!=='completed','INVALID_TRANSITION','Cette intervention est déjà terminée.');const supplier=data.supplierId?await entity<Supplier>('suppliers',t,data.supplierId):null;if(supplier)requireCondition(supplier.active,'SUPPLIER_INACTIVE','Ce fournisseur est désactivé.');const cost=data.cost??work.cost;
  const sql=[...guard("EXISTS(SELECT 1 FROM maintenance WHERE tenant_id=? AND id=? AND status<>'completed')",t,id),...(supplier?guard('EXISTS(SELECT 1 FROM suppliers WHERE tenant_id=? AND id=? AND active=1)',t,supplier.id):[]),update('maintenance',{status:'completed',cost,supplier:supplier?.name||work.supplier,notes:[work.notes,data.note].filter(Boolean).join('\n')},'tenant_id=? AND id=?',t,id),statement('DELETE FROM vehicle_blocks WHERE tenant_id=? AND maintenance_id=?',t,id)];
  if(cost>0)sql.push(insert('expenses',{id:newId('expense'),tenantId:t,vehicleId:work.vehicleId,category:'Maintenance',supplier:supplier?.name||work.supplier,supplierId:supplier?.id||null,amount:cost,date:tunisDate(),dueDate:tunisDate(),reference:data.reference,note:[work.title,data.note].filter(Boolean).join(' · '),maintenanceId:id,obligationId:null,createdAt:now()}));
  return commit(ctx,m,sql,{id},{action:'maintenance.completed',type:'maintenance',id,detail:`Contrôle et remise en service · ${work.title}`});
}
export async function createExpense(ctx:Context,m:Mutation,body:unknown){
  authorize(ctx,['owner','manager','accountant']);const data=expenseSchema.parse(body),id=newId('expense'),t=ctx.workspace.id;if(data.vehicleId)await entity<Vehicle>('vehicles',t,data.vehicleId);const supplier=data.supplierId?await entity<Supplier>('suppliers',t,data.supplierId):null;if(supplier)requireCondition(supplier.active,'SUPPLIER_INACTIVE','Ce fournisseur est désactivé.');requireCondition(!data.dueDate||data.dueDate>=data.date,'INVALID_DUE_DATE','L’échéance doit être postérieure ou égale à la date de la charge.');
  return commit(ctx,m,[...(supplier?guard('EXISTS(SELECT 1 FROM suppliers WHERE tenant_id=? AND id=? AND active=1)',t,supplier.id):[]),insert('expenses',{...data,supplier:supplier?.name||data.supplier,id,tenantId:t,maintenanceId:null,obligationId:null,createdAt:now()})],{id},{action:'expense.recorded',type:'expense',id,detail:`${data.category} · ${data.amount} millimes · ${supplier?.name||data.supplier}`});
}
export async function patchSettings(ctx:Context,m:Mutation,body:unknown){
  authorize(ctx,['owner']);const data=settingsSchema.parse(body),old=ctx.workspace.settings;requireCondition(Object.keys(data).length>0,'NO_CHANGES','Aucune modification reçue.');const settings:AgencySettings={...old,...data};
  if(data.logoFileId)requireCondition(await first('SELECT id FROM agency_files WHERE tenant_id=? AND id=? AND kind=\'logo\' AND revoked_at IS NULL',ctx.workspace.id,data.logoFileId),'INVALID_LOGO','Choisissez un logo importé dans cette agence.');
  const fiscalKeys:(keyof AgencySettings)[]=['taxRateBps','stampMillimes','dailyLevyRate','dailyLevyEnabled','dailyLevyTaxable','invoiceWorkflow','invoiceWorkflowEvidence'];const changedFiscal=fiscalKeys.some(k=>settings[k]!==old[k]);
  if(changedFiscal&&data.fiscalValidated!==true){settings.fiscalValidated=false;settings.fiscalValidatedAt='';}
  if(settings.fiscalValidated){requireCondition(settings.fiscalReviewer.trim().length>=3&&settings.fiscalSource.trim().length>=5,'VALIDATION_SOURCE_REQUIRED','Identifiez le validateur fiscal et sa source de référence.');if(!old.fiscalValidated||changedFiscal||data.fiscalValidated===true)settings.fiscalValidatedAt=now();}
  else settings.fiscalValidatedAt='';
  if(settings.invoiceWorkflow==='paper')requireCondition(settings.invoiceWorkflowEvidence.trim().length>=10,'INVOICE_WORKFLOW_EVIDENCE_REQUIRED','Documentez la validation du circuit de facturation papier pour cette agence.');
  if(settings.hostingValidated)requireCondition(settings.retentionDays>0&&settings.retentionPolicy.trim().length>=20,'RETENTION_POLICY_REQUIRED','Documentez la durée, les catégories de données et la justification de conservation avant de valider le traitement et l’hébergement.');
  if(settings.contractTerms!==old.contractTerms){requireCondition(settings.termsVersion!==old.termsVersion,'TERMS_VERSION_REQUIRED','Attribuez une nouvelle version lorsque le texte contractuel change.');if(data.legalValidated!==true)settings.legalValidated=false;}
  if(settings.legalValidated)requireCondition(settings.contractTerms.trim().length>=30,'CONTRACT_REQUIRED','Ajoutez les conditions contractuelles validées.');
  const t=ctx.workspace.id;return commit(ctx,m,[...guard('EXISTS(SELECT 1 FROM workspaces WHERE id=? AND version=?)',t,ctx.workspaceVersion),...(data.logoFileId?guard("EXISTS(SELECT 1 FROM agency_files WHERE tenant_id=? AND id=? AND kind='logo' AND revoked_at IS NULL)",t,data.logoFileId):[]),update('workspaces',{name:settings.name,settings:JSON.stringify(settings),version:ctx.workspaceVersion+1},'id=?',t)],{ok:true},{action:'settings.updated',type:'workspace',id:t,detail:`Champs : ${Object.keys(data).join(', ')} · validation fiscale : ${settings.fiscalValidated?'oui':'non'}`});
}
export async function createMember(ctx:Context,m:Mutation,body:unknown){
  authorize(ctx,['owner']);const data=memberSchema.parse(body),id=newId('member');return commit(ctx,m,[insert('members',{...data,id,tenantId:ctx.workspace.id,userId:null,createdAt:now()})],{id},{action:'member.added',type:'member',id,detail:`${data.email} · ${data.role}. Accès au site à configurer séparément.`});
}
export async function patchMember(ctx:Context,m:Mutation,id:string,body:unknown){
  authorize(ctx,['owner']);const {role}=z.object({role:z.enum(['manager','agent','accountant','mechanic','viewer'])}).strict().parse(body);const t=ctx.workspace.id;const old=await first<{role:string;email:string}>('SELECT role,email FROM members WHERE tenant_id=? AND id=?',t,id);requireCondition(old,'NOT_FOUND','Utilisateur introuvable.',404);requireCondition(old.role!=='owner','OWNER_PROTECTED','Le rôle du propriétaire ne peut pas être modifié.');
  return commit(ctx,m,[update('members',{role},"tenant_id=? AND id=? AND role<>'owner'",t,id)],{id},{action:'member.role_changed',type:'member',id,detail:`${old.email} · ${old.role} → ${role}`});
}
export async function revokeMember(ctx:Context,m:Mutation,id:string,body:unknown){authorize(ctx,['owner']);z.object({}).strict().parse(body);const t=ctx.workspace.id,old=await first<{role:string;email:string}>('SELECT role,email FROM members WHERE tenant_id=? AND id=?',t,id);requireCondition(old,'NOT_FOUND','Utilisateur introuvable.',404);requireCondition(old.role!=='owner','OWNER_PROTECTED','L’accès du propriétaire ne peut pas être retiré.');return commit(ctx,m,[...guard("EXISTS(SELECT 1 FROM members WHERE tenant_id=? AND id=? AND role<>'owner')",t,id),statement("DELETE FROM members WHERE tenant_id=? AND id=? AND role<>'owner'",t,id)],{id},{action:'member.revoked',type:'member',id,detail:`Accès retiré pour ${old.email}. Historique d’audit conservé.`});}
