import type { ChatGPTUser } from '../app/chatgpt-auth';
import type { AgencySettings,Rental,Customer,Vehicle,Inspection,Invoice,Payment,Quote,CreditNote } from '../lib/types';
import { first,all,hash,camelRow,database } from './db';
import { defaultSettings } from './domain';
import { rentalAccess,rentalAccessGuard } from './client-access';
export const DOCUMENT_KINDS=['contract','invoice','deposit','quote','delivery','inspection','credit'] as const;
export type DocumentKind=typeof DOCUMENT_KINDS[number];
export interface DocumentData {rental:Rental;customer:Customer;vehicle:Vehicle;settings:AgencySettings;inspection?:Inspection;inspections?:Inspection[];vehicles?:Vehicle[];invoice?:Invoice;quote?:Quote;credit?:CreditNote;payments?:Payment[];kilometres?:number;mode?:string;}
export interface PrintableDocument {data:DocumentData;hash:string;version:number;createdAt:string;draft:boolean;client:boolean;versions:number[];}
export async function printableDocument(user:ChatGPTUser,kind:DocumentKind,id:string,version?:number):Promise<PrintableDocument|null>{
  const table=kind==='invoice'?'invoices':kind==='quote'?'quotes':kind==='credit'?'credit_notes':null;
  const raw=table?await first<Record<string,unknown>>(`SELECT * FROM ${table} WHERE id=?`,id):null;if(table&&!raw)return null;
  let rentalId=String(raw?.rental_id||id),invoiceRaw:Record<string,unknown>|null=null;
  if(kind==='credit'){invoiceRaw=await first<Record<string,unknown>>('SELECT * FROM invoices WHERE tenant_id=? AND id=?',raw!.tenant_id,raw!.invoice_id);if(!invoiceRaw)return null;rentalId=String(invoiceRaw.rental_id);}
  const access=await rentalAccess(user,rentalId);if(!access)return null;if(raw&&raw.tenant_id!==access.tenantId)return null;
  if(access.ctx?.role==='mechanic'&&kind!=='inspection')return null;
  if(access.client&&kind==='invoice'&&raw?.status==='draft')return null;
  const t=access.tenantId;let data:DocumentData,stamp='',createdAt='',snapshotVersion=1,draft=false,versions:number[]=[];
  if(kind==='invoice'||kind==='quote'||kind==='credit'){
    const source=kind==='credit'?invoiceRaw!:raw!;data=JSON.parse(String(source.snapshot)) as DocumentData;
    if(kind==='invoice')data.invoice=camelRow<Invoice>(raw!);if(kind==='quote')data.quote=camelRow<Quote>(raw!);
    if(kind==='credit'){data.invoice=camelRow<Invoice>(invoiceRaw!);data.credit=camelRow<CreditNote>(raw!);}
    createdAt=String(raw!.issued_at||raw!.created_at);draft=kind==='invoice'&&raw!.status==='draft';
  }else if(kind==='contract'||kind==='delivery'){
    const items=await all<{data:string;hash:string;version:number;created_at:string}>('SELECT data,hash,version,created_at FROM document_snapshots WHERE tenant_id=? AND rental_id=? AND kind=? ORDER BY version DESC',t,rentalId,'contract');
    const valid=kind==='delivery'?items.filter(row=>JSON.parse(row.data).inspection?.type==='departure'):items;
    const snapshot=version?valid.find(row=>row.version===version):valid[0];versions=valid.map(row=>row.version).reverse();if(version&&!snapshot)return null;
    if(snapshot){data=JSON.parse(snapshot.data);stamp=snapshot.hash;snapshotVersion=snapshot.version;createdAt=snapshot.created_at;}
    else if(kind==='delivery')return null;
    else{const live=await liveData(t,rentalId);if(!live)return null;data=live;draft=true;snapshotVersion=0;createdAt=data.rental.createdAt;}
  }else{const live=await liveData(t,rentalId);if(!live)return null;data=live;createdAt=new Date().toISOString();
    if(kind==='deposit')data.payments=(await all<Record<string,unknown>>("SELECT * FROM payments WHERE tenant_id=? AND rental_id=? AND kind LIKE 'deposit_%' ORDER BY created_at",t,rentalId)).map(row=>camelRow<Payment>(row));
    else{data.inspections=(await all<Record<string,unknown>>('SELECT * FROM inspections WHERE tenant_id=? AND rental_id=? ORDER BY created_at,id',t,rentalId)).map(row=>camelRow<Inspection>(row));
      const assignments=await all<{vehicle_id:string;start_odometer:number;end_odometer:number|null}>('SELECT vehicle_id,start_odometer,end_odometer FROM assignments WHERE tenant_id=? AND rental_id=? ORDER BY start_at',t,rentalId);
      data.kilometres=assignments.reduce((sum,a)=>sum+(a.end_odometer===null?0:a.end_odometer-a.start_odometer),0);
      data.vehicles=(await all<Record<string,unknown>>('SELECT v.* FROM vehicles v WHERE v.tenant_id=? AND (v.id=? OR EXISTS(SELECT 1 FROM assignments a WHERE a.tenant_id=v.tenant_id AND a.vehicle_id=v.id AND a.rental_id=?))',t,data.vehicle.id,rentalId)).map(row=>camelRow<Vehicle>(row));
    }
  }
  data.settings={...defaultSettings(data.settings?.name||''),...data.settings};if(!data.rental||!data.customer||!data.vehicle)return null;
  if(access.ctx&&['mechanic','viewer'].includes(access.ctx.role)){data.customer={...data.customer,licenseNumber:'',licenseUntil:'',email:'',phone:'',address:'',taxId:'',notes:''};}
  else if(access.ctx?.role==='accountant'){data.customer={...data.customer,licenseNumber:'',licenseUntil:'',notes:''};}
  await database().batch(rentalAccessGuard(access));return {data,hash:stamp||await hash(JSON.stringify(data)),version:snapshotVersion,createdAt,draft,client:access.client,versions};
}
async function liveData(tenant:string,id:string):Promise<DocumentData|null>{
  const raw=await first<Record<string,unknown>>('SELECT * FROM rentals WHERE tenant_id=? AND id=?',tenant,id);if(!raw)return null;const rental=camelRow<Rental>(raw);
  const [customer,vehicle,workspace]=await Promise.all([first<Record<string,unknown>>('SELECT * FROM customers WHERE tenant_id=? AND id=?',tenant,rental.customerId),first<Record<string,unknown>>('SELECT * FROM vehicles WHERE tenant_id=? AND id=?',tenant,rental.vehicleId),first<{settings:string;mode:string}>('SELECT settings,mode FROM workspaces WHERE id=?',tenant)]);
  if(!customer||!vehicle||!workspace)return null;return {rental,customer:camelRow<Customer>(customer),vehicle:camelRow<Vehicle>(vehicle),settings:JSON.parse(workspace.settings),mode:workspace.mode};
}
