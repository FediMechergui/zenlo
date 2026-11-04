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
  };
  if(kind==='audit')authorize(ctx,['owner','manager']);
  let csv:string;
  if(kind==='daily-levy'){
    const month=url.searchParams.get('month');if(month&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new BusinessError('INVALID_MONTH','Indiquez un mois au format AAAA-MM.');
    const result=await all<Record<string,unknown>>(`SELECT r.number AS contrat,r.created_at AS date_conclusion,r.start_at AS depart,r.end_at AS retour,r.status AS statut_location,r.days AS jours_factures,r.daily_levy_rate AS taux_millimes,r.daily_levy AS contribution_millimes,r.daily_levy_taxable AS incluse_base_tva,i.number AS facture,i.status AS statut_facture,i.issued_at AS date_emission,COALESCE(c.number,'') AS avoir,COALESCE(c.created_at,'') AS date_avoir FROM rentals r JOIN invoices i ON i.tenant_id=r.tenant_id AND i.rental_id=r.id LEFT JOIN credit_notes c ON c.tenant_id=i.tenant_id AND c.invoice_id=i.id WHERE r.tenant_id=? AND i.issued_at IS NOT NULL ${month?"AND substr(datetime(i.issued_at,'+1 hour'),1,7)=?":''} ORDER BY i.issued_at`,tenant,...(month?[month]:[]));
    csv=csvRows(result,['contrat','date_conclusion','depart','retour','statut_location','jours_factures','taux_millimes','contribution_millimes','incluse_base_tva','facture','statut_facture','date_emission','avoir','date_avoir']);
  }else{
    const d=definitions[kind];if(!d)throw new BusinessError('INVALID_EXPORT','Cet export est indisponible.');csv=csvRows(await rows<Record<string,unknown>>(d.table,tenant),d.keys);
  }
  return new Response(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="zenlo-${kind}-${new Date().toISOString().slice(0,10)}.csv"`,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
