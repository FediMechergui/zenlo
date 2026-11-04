import { z } from 'zod';
import type { Rental, Invoice, Customer, Vehicle, Payment, CashSession } from '../lib/types';
import { type Context,type Mutation,authorize,entity,rows,guard,insert,statement,update,commit,newId,now,first } from './db';
import { paymentSchema,required,cashSchema } from './validation';
import { requireCondition,financialBalance,fiscalGate } from './domain';

export async function createPayment(ctx:Context,m:Mutation,body:unknown){
  authorize(ctx,['owner','manager','agent','accountant']);const data=paymentSchema.parse(body);const tenant=ctx.workspace.id;
  if(['refund','deposit_returned','deposit_applied'].includes(data.kind))authorize(ctx,['owner','manager','accountant']);
  requireCondition(data.method!=='cheque','CHEQUE_CLEARANCE_REQUIRED','Les chèques en attente ne sont pas des fonds encaissés. Enregistrez le virement de compensation bancaire avec sa référence après confirmation.');
  if(data.method!=='cash')requireCondition(data.reference.length>=3,'PAYMENT_REFERENCE_REQUIRED','Indiquez la référence de confirmation du paiement.');
  if(['refund','deposit_returned','deposit_applied'].includes(data.kind))requireCondition(data.note.length>=3,'REASON_REQUIRED','Indiquez le motif de cette restitution ou affectation.');
  const rental=await entity<Rental>('rentals',tenant,data.rentalId);const ledger=(await rows<Payment>('payments',tenant)).filter(p=>p.rentalId===rental.id);const balance=financialBalance(ledger);
  const invoiceHistory=(await rows<Invoice>('invoices',tenant)).filter(i=>i.rentalId===rental.id);const issued=invoiceHistory.find(i=>i.status==='issued');const receivable=issued?issued.total:invoiceHistory.some(i=>i.status==='credited')?0:rental.total;
  if(['payment','deposit_received'].includes(data.kind))requireCondition(rental.status!=='cancelled','RENTAL_CANCELLED','Cette réservation est annulée. Seules les restitutions restent possibles.');
  if(data.kind==='refund')requireCondition(data.amount<=balance.paid,'REFUND_EXCEEDS_PAYMENT','Le remboursement dépasse les règlements disponibles.');
  if(['deposit_returned','deposit_applied'].includes(data.kind))requireCondition(data.amount<=balance.deposit,'DEPOSIT_INSUFFICIENT','La caution disponible ne couvre pas ce montant.');
  if(data.kind==='deposit_applied'){requireCondition(rental.status==='returned','RENTAL_NOT_RETURNED','L’affectation de caution nécessite un retour enregistré et une somme due justifiée.');requireCondition(data.amount<=Math.max(0,receivable-balance.paid),'PAYMENT_EXCEEDS_BALANCE','L’affectation dépasse le solde de la location.');}
  if(data.kind==='payment')requireCondition(data.amount<=Math.max(0,receivable-balance.paid),'PAYMENT_EXCEEDS_BALANCE','Ce montant dépasse le solde à régler.');
  if(data.kind==='deposit_received')requireCondition(data.amount<=Math.max(0,rental.depositRequired-balance.deposit),'DEPOSIT_EXCEEDS_REQUIRED','Ce montant dépasse la caution demandée.');
  const invoice=await first<{id:string}>("SELECT id FROM invoices WHERE tenant_id=? AND rental_id=? AND status='issued'",tenant,rental.id);
  const cash=await first<{id:string}>('SELECT id FROM cash_sessions WHERE tenant_id=? AND closed_at IS NULL',tenant);
  if(data.method==='cash'&&data.kind!=='deposit_applied')requireCondition(cash,'CASH_SESSION_REQUIRED','Ouvrez une session de caisse avant un mouvement en espèces.');
  const id=newId('payment');const sql=[insert('payments',{...data,id,tenantId:tenant,invoiceId:invoice?.id||null,cashSessionId:data.method==='cash'&&data.kind!=='deposit_applied'?cash!.id:null,createdAt:now()})];
  return commit(ctx,m,sql,{id},{action:`finance.${data.kind}`,type:'payment',id,detail:`${rental.number} · ${data.amount} millimes · ${data.method} · ${data.note}`});
}
export async function createInvoice(ctx:Context,m:Mutation,body:unknown){
  authorize(ctx,['owner','manager','accountant']);const {rentalId}=z.object({rentalId:required}).strict().parse(body);const t=ctx.workspace.id;
  const rental=await entity<Rental>('rentals',t,rentalId);requireCondition(rental.status==='returned','RENTAL_NOT_RETURNED','La facture finale est préparée après le retour du véhicule. Les paiements anticipés restent inscrits au dossier.');
  const [customer,vehicle]=await Promise.all([entity<Customer>('customers',t,rental.customerId),entity<Vehicle>('vehicles',t,rental.vehicleId)]);
  const id=newId('invoice');const invoice:Invoice={id,number:`BRO-${id.slice(-8).toUpperCase()}`,rentalId,customerId:rental.customerId,status:'draft',subtotal:rental.subtotal,tax:rental.tax,stamp:rental.stamp,dailyLevy:rental.dailyLevy,total:rental.total,taxRateBps:rental.taxRateBps,externalStatus:'not_configured',issuedAt:null,createdAt:now()};
  const snapshot=JSON.stringify({rental,customer,vehicle,settings:ctx.workspace.settings,invoice,mode:ctx.workspace.mode});
  return commit(ctx,m,[insert('invoices',{...invoice,tenantId:t,snapshot})],{id},{action:'invoice.draft',type:'invoice',id,detail:`Brouillon pour ${rental.number}`});
}
export async function issueInvoice(ctx:Context,m:Mutation,id:string,body:unknown){
  authorize(ctx,['owner','manager','accountant']);z.object({}).strict().parse(body);fiscalGate(ctx.workspace.settings,ctx.workspace.mode,true);const t=ctx.workspace.id;
  const invoice=await entity<Invoice>('invoices',t,id);requireCondition(invoice.status==='draft','INVALID_TRANSITION','Seule une facture brouillon peut être émise.');
  const rental=await entity<Rental>('rentals',t,invoice.rentalId);requireCondition(rental.status==='returned'&&rental.total===invoice.total,'STALE_INVOICE','Le dossier a changé : vérifiez la facture avant émission.');
  const settings=ctx.workspace.settings;requireCondition(settings.name.trim()&&settings.address.trim()&&settings.taxId.trim(),'ISSUER_INCOMPLETE','Renseignez le nom, l’adresse et le matricule fiscal de l’agence.');
  if(ctx.workspace.mode==='live'){
    requireCondition(settings.invoiceWorkflow&&settings.invoiceWorkflow!=='unreviewed','INVOICE_WORKFLOW_REVIEW_REQUIRED','Le comptable doit qualifier le circuit de facturation applicable à l’agence.');
    requireCondition(settings.invoiceWorkflow!=='electronic','EINVOICE_NOT_CONFIGURED','L’agence requiert la facturation électronique. Le connecteur El Fatoora doit être configuré et validé avant toute émission.');
    requireCondition(settings.invoiceWorkflowEvidence.trim().length>=10,'INVOICE_WORKFLOW_EVIDENCE_REQUIRED','Documentez la décision validant le circuit de facturation papier pour cette agence.');
  }
  const customer=await entity<Customer>('customers',t,invoice.customerId);if(ctx.workspace.mode==='live'){requireCondition(customer.address.trim(),'CUSTOMER_ADDRESS_REQUIRED','Renseignez l’adresse du client avant l’émission de sa facture.');if(customer.type==='company')requireCondition(customer.taxId.trim(),'CUSTOMER_TAX_ID_REQUIRED','Renseignez le matricule fiscal du client entreprise.');}
  const year=new Date().getUTCFullYear();const kind=`invoice-${year}`;const issuedAt=now();
  const raw=await first<{snapshot:string}>('SELECT snapshot FROM invoices WHERE tenant_id=? AND id=?',t,id);const snapshot=JSON.parse(raw!.snapshot);snapshot.settings=settings;snapshot.customer=customer;
  const sql=[...guard("EXISTS(SELECT 1 FROM invoices WHERE tenant_id=? AND id=? AND status='draft')",t,id),...guard('EXISTS(SELECT 1 FROM workspaces WHERE id=? AND version=?)',t,ctx.workspaceVersion),statement('INSERT INTO sequences (id,tenant_id,kind,value) VALUES (?,?,?,0) ON CONFLICT(tenant_id,kind) DO NOTHING',newId('seq'),t,kind),statement('UPDATE sequences SET value=value+1 WHERE tenant_id=? AND kind=?',t,kind),statement("UPDATE invoices SET number=? || printf('%06d',(SELECT value FROM sequences WHERE tenant_id=? AND kind=?)),status='issued',issued_at=?,snapshot=? WHERE tenant_id=? AND id=?",`${ctx.workspace.mode==='demo'?'DEMO-':''}FAC-${year}-`,t,kind,issuedAt,JSON.stringify(snapshot),t,id)];
  return commit(ctx,m,sql,{id},{action:'invoice.issued',type:'invoice',id,detail:`Facture émise · ${invoice.total} millimes · acceptation externe non configurée`});
}
export async function creditInvoice(ctx:Context,m:Mutation,id:string,body:unknown){
  authorize(ctx,['owner','manager','accountant']);const {reason}=z.object({reason:required}).strict().parse(body);const t=ctx.workspace.id;const invoice=await entity<Invoice>('invoices',t,id);requireCondition(invoice.status==='issued','INVALID_TRANSITION','Un avoir s’applique à une facture émise.');
  const creditId=newId('credit'),year=new Date().getUTCFullYear(),kind=`credit-${year}`;
  const sql=[...guard("EXISTS(SELECT 1 FROM invoices WHERE tenant_id=? AND id=? AND status='issued')",t,id),statement('INSERT INTO sequences (id,tenant_id,kind,value) VALUES (?,?,?,0) ON CONFLICT(tenant_id,kind) DO NOTHING',newId('seq'),t,kind),statement('UPDATE sequences SET value=value+1 WHERE tenant_id=? AND kind=?',t,kind),statement("INSERT INTO credit_notes(id,tenant_id,invoice_id,number,amount,reason,snapshot,created_at) VALUES(?,?,?,? || printf('%06d',(SELECT value FROM sequences WHERE tenant_id=? AND kind=?)),?,?,?,?)",creditId,t,id,`${ctx.workspace.mode==='demo'?'DEMO-':''}AV-${year}-`,t,kind,invoice.total,reason,JSON.stringify(invoice),now()),update('invoices',{status:'credited'},'tenant_id=? AND id=?',t,id)];
  return commit(ctx,m,sql,{id:creditId},{action:'invoice.credited',type:'invoice',id,detail:`Avoir intégral · ${invoice.total} millimes · ${reason}. Remboursement distinct.`});
}
export async function cashAction(ctx:Context,m:Mutation,body:unknown){
  authorize(ctx,['owner','manager','accountant']);const data=cashSchema.parse(body);const tenant=ctx.workspace.id;
  if(data.action==='open'){
    const id=newId('cash');return commit(ctx,m,[insert('cash_sessions',{id,tenantId:tenant,openedAt:now(),closedAt:null,openingAmount:data.openingAmount,expectedAmount:null,countedAmount:null,note:data.note,createdAt:now()})],{id},{action:'cash.opened',type:'cash',id,detail:`Fond de caisse ${data.openingAmount} millimes`});
  }
  const current=await first<{id:string}>('SELECT id FROM cash_sessions WHERE tenant_id=? AND closed_at IS NULL',tenant);requireCondition(current,'CASH_SESSION_REQUIRED','Aucune session de caisse ouverte.');
  const sql=[...guard('EXISTS(SELECT 1 FROM cash_sessions WHERE tenant_id=? AND id=? AND closed_at IS NULL)',tenant,current.id),statement("UPDATE cash_sessions SET closed_at=?,counted_amount=?,note=?,expected_amount=opening_amount+COALESCE((SELECT SUM(CASE WHEN kind IN ('payment','deposit_received') THEN amount WHEN kind IN ('refund','deposit_returned') THEN -amount ELSE 0 END) FROM payments WHERE tenant_id=? AND cash_session_id=? AND method='cash'),0) WHERE tenant_id=? AND id=?",now(),data.countedAmount,data.note,tenant,current.id,tenant,current.id)];
  return commit(ctx,m,sql,{id:current.id},{action:'cash.closed',type:'cash',id:current.id,detail:`Comptage ${data.countedAmount} millimes · ${data.note}`});
}
