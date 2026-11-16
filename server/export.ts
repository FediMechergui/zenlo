import { type Context,authorize,all,rows } from './db';
import { BusinessError,csvRows } from './domain';

export async function exportCsv(ctx:Context,url:URL){
  authorize(ctx,['owner','manager','accountant']);const kind=url.searchParams.get('kind')||'rentals';const tenant=ctx.workspace.id;
  const definitions:Record<string,{table:string;keys:string[]}>={
    vehicles:{table:'vehicles',keys:['id','registration','make','model','category','year','odometer','status','dailyRate','deposit','insuranceUntil','inspectionUntil']},
    customers:{table:'customers',keys:['id','type','name','email','phone','address','country','taxId']},
    rentals:{table:'rentals',keys:['id','number','customerId','vehicleId','startAt','endAt','actualStartAt','actualEndAt','status','days','dailyRate','discount','extras','subtotal','dailyLevy','tax','stamp','total','depositRequired']},
    payments:{table:'payments',keys:['id','rentalId','invoiceId','kind','method','amount','reference','note','createdAt']},
    invoices:{table:'invoices',keys:['id','number','rentalId','customerId','status','subtotal','dailyLevy','tax','stamp','total','taxRateBps','externalStatus','issuedAt']},
    audit:{table:'audit',keys:['id','actor','action','entityType','entityId','detail','createdAt']},
    suppliers:{table:'suppliers',keys:['id','name','contact','email','phone','address','taxId','category','active']},
    expenses:{table:'expenses',keys:['id','vehicleId','category','supplierId','supplier','reference','amount','date','dueDate','maintenanceId','obligationId','note']},
    'expense-payments':{table:'expense_payments',keys:['id','expenseId','amount','method','reference','date','note']},
    obligations:{table:'obligations',keys:['id','vehicleId','title','kind','dueDate','dueKm','status','completedAt','completedOdometer','actualCost','nextId']},
    quotes:{table:'quotes',keys:['id','number','rentalId','customerId','status','validUntil','total','decidedAt','createdAt']},
  };
  if(kind==='audit')authorize(ctx,['owner','manager']);
  let csv:string;
  if(kind==='daily-levy'){
    const month=url.searchParams.get('month');if(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new BusinessError('INVALID_MONTH','Indiquez un mois au format AAAA-MM.');
    const filter=month?"AND substr(datetime(i.issued_at,'+1 hour'),1,7)=?":'',creditFilter=month?"AND substr(datetime(c.created_at,'+1 hour'),1,7)=?":'';
    const result=await all<Record<string,unknown>>(`SELECT i.number AS piece,'facture' AS nature,i.issued_at AS date_piece,r.number AS contrat,json_extract(i.snapshot,'$.rental.createdAt') AS date_conclusion,json_extract(i.snapshot,'$.rental.days') AS jours_factures,json_extract(i.snapshot,'$.rental.dailyLevyRate') AS taux_millimes,i.daily_levy AS contribution_millimes,json_extract(i.snapshot,'$.rental.dailyLevyTaxable') AS incluse_base_tva FROM invoices i JOIN rentals r ON r.tenant_id=i.tenant_id AND r.id=i.rental_id WHERE i.tenant_id=? AND i.issued_at IS NOT NULL ${filter}
    UNION ALL SELECT c.number,'avoir',c.created_at,r.number,json_extract(i.snapshot,'$.rental.createdAt'),json_extract(i.snapshot,'$.rental.days'),json_extract(i.snapshot,'$.rental.dailyLevyRate'),-i.daily_levy,json_extract(i.snapshot,'$.rental.dailyLevyTaxable') FROM credit_notes c JOIN invoices i ON i.tenant_id=c.tenant_id AND i.id=c.invoice_id JOIN rentals r ON r.tenant_id=i.tenant_id AND r.id=i.rental_id WHERE c.tenant_id=? ${creditFilter} ORDER BY date_piece`,tenant,...(month?[month]:[]),tenant,...(month?[month]:[]));
    csv=csvRows(result,['piece','nature','date_piece','contrat','date_conclusion','jours_factures','taux_millimes','contribution_millimes','incluse_base_tva']);
  }else{
    const d=definitions[kind];if(!d)throw new BusinessError('INVALID_EXPORT','Cet export est indisponible.');csv=csvRows(await rows<Record<string,unknown>>(d.table,tenant),d.keys);
  }
  return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="zenlo-${kind}-${new Date().toISOString().slice(0,10)}.csv"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
