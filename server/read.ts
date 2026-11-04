import type { ChatGPTUser } from '../app/chatgpt-auth';
import type { WorkspaceData, AvailabilityBlock, Vehicle, Customer, Rental, Inspection, Invoice, CreditNote, Payment, Maintenance, Expense, AuditEntry, CashSession, Member } from '../lib/types';
import { context, rows, first, entity, camelRow, hash, authorize } from './db';

export async function getWorkspaceData(user:ChatGPTUser):Promise<WorkspaceData|null>{
  const ctx=await context(user);if(!ctx)return null;const t=ctx.workspace.id;
  const [vehicles,customers,rentals,inspections,invoices,payments,maintenance,expenses,audit,cashSessions,members,creditNotes,blocks]=await Promise.all([
    rows<Vehicle>('vehicles',t,'make,model'),rows<Customer>('customers',t,'name'),rows<Rental>('rentals',t,'start_at DESC'),rows<Inspection>('inspections',t),
    rows<Invoice>('invoices',t),rows<Payment>('payments',t),rows<Maintenance>('maintenance',t,'start_at DESC'),rows<Expense>('expenses',t,'date DESC'),
    rows<AuditEntry>('audit',t),rows<CashSession>('cash_sessions',t),rows<Member>('members',t,'name'),rows<CreditNote>('credit_notes',t),rows<AvailabilityBlock>('vehicle_blocks',t,'start_ms'),
  ]);
  const canFinance=['owner','manager','accountant'].includes(ctx.role);const canAudit=['owner','manager'].includes(ctx.role);
  return {workspace:ctx.workspace,user:{id:user.userId,name:user.displayName,email:user.email,role:ctx.role},vehicles,customers,rentals,inspections,invoices,creditNotes,payments,maintenance,blocks,
    expenses:canFinance?expenses:[],audit:canAudit?audit:[],cashSessions:canFinance?cashSessions:[],members:canAudit?members:[]};
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
