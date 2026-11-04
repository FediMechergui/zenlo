const BUSINESS_TIMEZONE = 'Africa/Tunis';
const money = new Intl.NumberFormat('fr-TN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export function formatMoney(millimes: number): string { return `${money.format(millimes / 1000)} TND`; }
export function formatDate(value: string): string {
  if (!value) return '—';
  const date = new Date(value.length === 10 ? `${value}T12:00:00+01:00` : value);
  return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat('fr-TN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: BUSINESS_TIMEZONE }).format(date);
}
export function formatTime(value: string): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return '—';
  return new Intl.DateTimeFormat('fr-TN', {hour:'2-digit',minute:'2-digit', hourCycle:'h23', timeZone:BUSINESS_TIMEZONE}).format(new Date(value));
}
export function formatDateTime(value: string): string { return value ? `${formatDate(value)} · ${formatTime(value)}` : '—'; }
export function toLocalInput(value: string): string {
  if (!value || Number.isNaN(new Date(value).getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: BUSINESS_TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(new Date(value));
  const p = Object.fromEntries(parts.map(x=>[x.type,x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
export function fromLocalInput(value: string): string {
  // The pilot uses the specified Africa/Tunis civil time (UTC+01:00).
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw new Error('Date et heure invalides.');
  const parsed = new Date(`${value}:00+01:00`);
  if (Number.isNaN(parsed.getTime()) || toLocalInput(parsed.toISOString()) !== value) throw new Error('Date et heure invalides.');
  return parsed.toISOString();
}
export function dayLabel(value: string): string {
  return new Intl.DateTimeFormat('fr-TN', { weekday:'long', day:'numeric', month:'long', timeZone:BUSINESS_TIMEZONE }).format(new Date(value));
}
export function parseMillimes(value: string): number {
  const normalized = value.trim().replace(/\s/g, '').replace(',', '.');
  if (!/^\d+(\.\d{1,3})?$/.test(normalized)) throw new Error('Utilisez un montant positif avec au plus trois décimales.');
  const [whole, fraction=''] = normalized.split('.');
  const result = Number(whole) * 1000 + Number(fraction.padEnd(3,'0'));
  if (!Number.isSafeInteger(result)) throw new Error('Montant trop élevé.');
  return result;
}
export function paidForRental(payments: {rentalId:string; kind:string; amount:number}[], rentalId:string):number {
  return payments.filter(p=>p.rentalId===rentalId).reduce((sum,p)=>sum+(p.kind==='payment'||p.kind==='deposit_applied'?p.amount:p.kind==='refund'?-p.amount:0),0);
}
export function heldForRental(payments: {rentalId:string; kind:string; amount:number}[], rentalId:string):number {
  return payments.filter(p=>p.rentalId===rentalId).reduce((sum,p)=>sum+(p.kind==='deposit_received'?p.amount:p.kind==='deposit_returned'||p.kind==='deposit_applied'?-p.amount:0),0);
}
export function rentalReceivable(rental:{id:string;status:string;total:number},invoices:{rentalId:string;status:string;total:number;issuedAt:string|null}[]):number {
  if(rental.status==='cancelled')return 0;
  const linked=invoices.filter(i=>i.rentalId===rental.id);
  const issued=linked.filter(i=>i.status==='issued').sort((a,b)=>(b.issuedAt||'').localeCompare(a.issuedAt||''));
  if(issued.length)return issued[0].total;
  if(linked.some(i=>i.status==='credited'))return 0;
  return rental.total;
}
