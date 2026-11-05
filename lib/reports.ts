import type { WorkspaceData } from './types';
export function reportPeriod(from:string,to:string){if(!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to))throw new Error('Période invalide.');for(const d of [from,to])if(new Date(d).toISOString().slice(0,10)!==d)throw new Error('Date invalide.');if(to<from)throw new Error('La fin doit suivre le début.');const start=Date.parse(`${from}T00:00:00+01:00`),end=Date.parse(`${to}T23:59:59.999+01:00`);if(end-start>366*3*86400000)throw new Error('Choisissez une période de trois ans au maximum.');return {from,to,start,end};}
export function calculateReport(data:WorkspaceData,from:string,to:string){
  const period=reportPeriod(from,to),inPeriod=(date:string)=>Date.parse(date)>=period.start&&Date.parse(date)<=period.end;
  const invoices=data.invoices.filter(i=>i.status!=='draft'&&i.issuedAt&&inPeriod(i.issuedAt));
  const credits=data.creditNotes.filter(c=>inPeriod(c.createdAt));
  const expenses=data.expenses.filter(e=>e.date>=from&&e.date<=to);
  const payments=data.payments.filter(p=>inPeriod(p.createdAt));
  const rentals=data.rentals.filter(r=>r.status!=='cancelled'&&Date.parse(r.startAt)<=period.end&&Date.parse(r.endAt)>period.start);
  const netInvoiced=invoices.reduce((s,i)=>s+i.total,0)-credits.reduce((s,c)=>s+c.amount,0);
  const expenseTotal=expenses.reduce((s,e)=>s+e.amount,0);
  const settled=data.expensePayments.filter(p=>p.date>=from&&p.date<=to).reduce((s,p)=>s+p.amount,0);
  const receipts=payments.reduce((s,p)=>s+(p.kind==='payment'?p.amount:p.kind==='refund'?-p.amount:0),0);
  const supplierDue=data.expenses.reduce((s,e)=>s+Math.max(0,e.amount-data.expensePayments.filter(p=>p.expenseId===e.id).reduce((a,p)=>a+p.amount,0)),0);
  const costByCategory=Object.entries(expenses.reduce<Record<string,number>>((out,e)=>{out[e.category]=(out[e.category]||0)+e.amount;return out;},Object.create(null) as Record<string,number>)).sort((a,b)=>b[1]-a[1]);
  return {period,invoices,credits,expenses,payments,rentals,netInvoiced,expenseTotal,settled,receipts,supplierDue,costByCategory};
}
