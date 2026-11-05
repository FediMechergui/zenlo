import type { ChatGPTUser } from '../app/chatgpt-auth';
import type { AgencySettings,Rental,Inspection,Vehicle,Customer,Invoice,Quote } from '../lib/types';
import { first,all,context,camelRow,guard,hash,database,type Context } from './db';
import { requireCondition,defaultSettings } from './domain';

export interface RentalAccess {tenantId:string;rentalId:string;ctx:Context|null;email:string;client:boolean;grantId?:string;}
export async function rentalAccess(user:ChatGPTUser,rentalId:string,clientOnly=false):Promise<RentalAccess|null>{
  const ctx=await context(user);
  if(!clientOnly&&ctx&&await first('SELECT id FROM rentals WHERE tenant_id=? AND id=?',ctx.workspace.id,rentalId))return {tenantId:ctx.workspace.id,rentalId,ctx,email:user.email.toLowerCase(),client:false};
  const grant=await first<{id:string;tenant_id:string}>('SELECT id,tenant_id FROM client_access WHERE rental_id=? AND email=? AND revoked_at IS NULL AND expires_at>?',rentalId,user.email.toLowerCase(),new Date().toISOString());
  return grant?{tenantId:grant.tenant_id,rentalId,ctx:null,email:user.email.toLowerCase(),client:true,grantId:grant.id}:null;
}
export function rentalAccessGuard(access:RentalAccess){return access.client?
  guard('EXISTS(SELECT 1 FROM client_access WHERE id=? AND tenant_id=? AND rental_id=? AND email=? AND revoked_at IS NULL AND expires_at>?)',access.grantId,access.tenantId,access.rentalId,access.email,new Date().toISOString()):
  guard('EXISTS(SELECT 1 FROM members WHERE tenant_id=? AND id=? AND user_id=? AND role=?)',access.tenantId,access.ctx!.memberId,access.ctx!.user.userId,access.ctx!.role);
}
export async function inspectionFingerprint(tenantId:string,rentalId:string){
  const inspections=await all<Record<string,unknown>>('SELECT * FROM inspections WHERE tenant_id=? AND rental_id=? ORDER BY created_at,id',tenantId,rentalId);
  return hash(JSON.stringify(inspections));
}
export async function clientRentals(user:ChatGPTUser){
  const grants=await all<{id:string;tenant_id:string;rental_id:string;expires_at:string}>('SELECT id,tenant_id,rental_id,expires_at FROM client_access WHERE email=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 100',user.email.toLowerCase(),new Date().toISOString());
  return Promise.all(grants.map(async grant=>{
    const t=grant.tenant_id,id=grant.rental_id;
    const [raw,workspace,inspectionRows,assignmentRows,invoices,quotes,photos,acks]=await Promise.all([
      first<Record<string,unknown>>('SELECT * FROM rentals WHERE tenant_id=? AND id=?',t,id),
      first<{name:string;settings:string}>('SELECT name,settings FROM workspaces WHERE id=?',t),
      all<Record<string,unknown>>('SELECT * FROM inspections WHERE tenant_id=? AND rental_id=? ORDER BY created_at,id',t,id),
      all<{vehicle_id:string;start_odometer:number;end_odometer:number|null}>('SELECT vehicle_id,start_odometer,end_odometer FROM assignments WHERE tenant_id=? AND rental_id=? ORDER BY start_at',t,id),
      all<Record<string,unknown>>("SELECT id,number,status,total,issued_at FROM invoices WHERE tenant_id=? AND rental_id=? AND status<>'draft'",t,id),
      all<Record<string,unknown>>('SELECT id,number,status,valid_until,total FROM quotes WHERE tenant_id=? AND rental_id=?',t,id),
      all<{id:string;label:string;inspection_id:string|null}>('SELECT id,label,inspection_id FROM attachments WHERE tenant_id=? AND rental_id=? ORDER BY created_at',t,id),
      all<{inspection_hash:string;created_at:string}>('SELECT inspection_hash,created_at FROM client_acknowledgments WHERE tenant_id=? AND rental_id=? AND user_id=? ORDER BY created_at DESC',t,id,user.userId),
    ]);
    requireCondition(raw&&workspace,'NOT_FOUND','Dossier introuvable.',404);const rental=camelRow<Rental>(raw);
    const customer=await first<Pick<Customer,'name'>>('SELECT name FROM customers WHERE tenant_id=? AND id=?',t,rental.customerId);
    const vehicle=await first<Record<string,unknown>>('SELECT id,registration,make,model,body_type,year,color FROM vehicles WHERE tenant_id=? AND id=?',t,rental.vehicleId);
    const settings={...defaultSettings(workspace.name),...JSON.parse(workspace.settings)} as AgencySettings;
    const kmCompleted=assignmentRows.filter(a=>a.end_odometer!==null).reduce((sum,a)=>sum+(a.end_odometer!-a.start_odometer),0);
    const fingerprint=await hash(JSON.stringify(inspectionRows));
    await database().batch(rentalAccessGuard({tenantId:t,rentalId:id,ctx:null,email:user.email.toLowerCase(),client:true,grantId:grant.id}));
    return {id:rental.id,number:rental.number,status:rental.status,startAt:rental.startAt,endAt:rental.endAt,actualStartAt:rental.actualStartAt,actualEndAt:rental.actualEndAt,pickupLocation:rental.pickupLocation,returnLocation:rental.returnLocation,includedKm:rental.includedKm,extraKmRate:rental.extraKmRate,total:rental.total,customerName:customer?.name||'',vehicle:vehicle?camelRow<Vehicle>(vehicle):null,
      agency:{name:settings.name,address:settings.address,phone:settings.phone,email:settings.email,fax:settings.fax,logoFileId:settings.logoFileId,documentAccent:settings.documentAccent},
      inspections:inspectionRows.map(r=>camelRow<Inspection>(r)),kilometres:kmCompleted,kilometresFinal:rental.status==='returned',invoices:invoices.map(r=>camelRow<Invoice>(r)),quotes:quotes.map(r=>camelRow<Quote>(r)),photos:photos.map(p=>({id:p.id,label:p.label,inspectionId:p.inspection_id})),expiresAt:grant.expires_at,inspectionHash:fingerprint,acknowledgedAt:acks.find(a=>a.inspection_hash===fingerprint)?.created_at||null};
  }));
}
