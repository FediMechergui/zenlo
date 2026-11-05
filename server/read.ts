import type { ChatGPTUser } from '../app/chatgpt-auth';
import type { WorkspaceData, AvailabilityBlock, Vehicle, Customer, Rental, Inspection, Invoice, CreditNote, Payment, Maintenance, Expense, AuditEntry, CashSession, Member, Supplier, ExpensePayment, Obligation, Quote, Assignment } from '../lib/types';
import { context, rows, first, entity, camelRow, hash, authorize, availableWorkspaces,database,guard } from './db';

export async function getWorkspaceData(user:ChatGPTUser,workspaceId?:string):Promise<WorkspaceData|null>{
  const ctx=await context(user,workspaceId);if(!ctx)return null;const t=ctx.workspace.id;
  const [vehicles,customers,rentals,inspections,invoices,payments,maintenance,expenses,audit,cashSessions,members,creditNotes,blocks,suppliers,expensePayments,obligations,quotes,access,assignments]=await Promise.all([
    rows<Vehicle>('vehicles',t,'make,model'),rows<Customer>('customers',t,'name'),rows<Rental>('rentals',t,'start_at DESC'),rows<Inspection>('inspections',t),
    rows<Invoice>('invoices',t),rows<Payment>('payments',t),rows<Maintenance>('maintenance',t,'start_at DESC'),rows<Expense>('expenses',t,'date DESC'),
    rows<AuditEntry>('audit',t),rows<CashSession>('cash_sessions',t),rows<Member>('members',t,'name'),rows<CreditNote>('credit_notes',t),rows<AvailabilityBlock>('vehicle_blocks',t,'start_ms'),
    rows<Supplier>('suppliers',t,'name'),rows<ExpensePayment>('expense_payments',t,'date DESC'),rows<Obligation>('obligations',t,'due_date'),rows<Quote>('quotes',t),availableWorkspaces(user),rows<Assignment>('assignments',t,'start_at'),
  ]);
  const canFinance=['owner','manager','accountant'].includes(ctx.role);const canAudit=['owner','manager'].includes(ctx.role);
  const canIdentity=['owner','manager','agent'].includes(ctx.role),mechanic=ctx.role==='mechanic';
  const safeCustomers=canIdentity?customers:customers.map(c=>({...c,licenseNumber:'',licenseUntil:'',notes:'',...(ctx.role==='accountant'?{}:{email:'',phone:'',address:'',taxId:''})}));
  await database().batch(guard('EXISTS(SELECT 1 FROM members WHERE tenant_id=? AND id=? AND user_id=? AND role=?)',t,ctx.memberId,user.userId,ctx.role));
  const workspace=mechanic?{...ctx.workspace,settings:{...ctx.workspace.settings,bankName:'',bankAccount:'',fiscalReviewer:'',fiscalSource:'',invoiceWorkflowEvidence:'',taxRateBps:0,stampMillimes:0,dailyLevyRate:0}}:ctx.workspace;
  return {workspace,user:{id:user.userId,name:user.displayName,email:user.email,role:ctx.role},availableWorkspaces:access,vehicles:mechanic?vehicles.map(v=>({...v,dailyRate:0,deposit:0,rentalPolicy:null})):vehicles,customers:safeCustomers,rentals:mechanic?rentals.map(r=>({...r,dailyRate:0,discount:0,extras:0,subtotal:0,tax:0,stamp:0,dailyLevy:0,dailyLevyRate:0,extraKmRate:0,taxRateBps:0,total:0,depositRequired:0,notes:'',termsSnapshot:''})):rentals,inspections,assignments,invoices:mechanic?[]:invoices,creditNotes:mechanic?[]:creditNotes,payments:mechanic?[]:payments,maintenance,blocks,
    expenses:canFinance?expenses:[],audit:canAudit?audit:[],cashSessions:canFinance?cashSessions:[],members:canAudit?members:[],suppliers:['owner','manager','accountant','mechanic'].includes(ctx.role)?suppliers:[],expensePayments:canFinance?expensePayments:[],obligations,quotes:mechanic?[]:quotes};
}

export interface DocumentSnapshot {data:Record<string,unknown>;hash:string;version:number;createdAt:string;}
export async function getDocumentSnapshot(user:ChatGPTUser,kind:'contract'|'invoice'|'deposit',id:string,version?:number):Promise<DocumentSnapshot|null>{
  const ctx=await context(user);if(!ctx)return null;const tenant=ctx.workspace.id;
  if(kind==='contract'){
    const r=await first<{data:string;hash:string;version:number;created_at:string}>(`SELECT * FROM document_snapshots WHERE tenant_id=? AND rental_id=? AND kind='contract' ${version?'AND version=?':''} ORDER BY version DESC LIMIT 1`,tenant,id,...(version?[version]:[]));
    return r?{data:JSON.parse(r.data),hash:r.hash,version:r.version,createdAt:r.created_at}:null;
  }
  if(kind==='invoice'){
    const raw=await first<Record<string,unknown>>('SELECT * FROM invoices WHERE tenant_id=? AND id=?',tenant,id);if(!raw)return null;
    const snapshot=JSON.parse(String(raw.snapshot)) as Record<string,unknown>;
    const data={...snapshot,invoice:camelRow<Invoice>(raw),mode:ctx.workspace.mode};
    return {data,hash:await hash(JSON.stringify(data)),version:1,createdAt:String(raw.issued_at||raw.created_at)};
  }
  const rental=await entity<Rental>('rentals',tenant,id),customer=await entity<Customer>('customers',tenant,rental.customerId),vehicle=await entity<Vehicle>('vehicles',tenant,rental.vehicleId);
  const payments=(await rows<Payment>('payments',tenant)).filter(p=>p.rentalId===id&&p.kind.startsWith('deposit_'));
  const data={rental,customer,vehicle,payments,settings:ctx.workspace.settings,mode:ctx.workspace.mode};return {data,hash:await hash(JSON.stringify(data)),version:payments.length,createdAt:payments[0]?.createdAt||rental.createdAt};
}
