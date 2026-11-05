import type { AgencySettings, Rental, Vehicle } from '../lib/types';

export class BusinessError extends Error {
  constructor(public code:string,message:string,public status=422,public fields?:Record<string,string>){super(message);this.name='BusinessError';}
}
export function requireCondition(value:unknown,code:string,message:string,status=422):asserts value {if(!value)throw new BusinessError(code,message,status);}
export const DAY=86_400_000;
export function rentalDays(startAt:string,endAt:string){const start=Date.parse(startAt),end=Date.parse(endAt);requireCondition(Number.isFinite(start)&&Number.isFinite(end)&&end>start,'INVALID_DATES','La restitution doit être postérieure au départ.');return Math.max(1,Math.ceil((end-start)/DAY));}
export function safeMoney(value:number){requireCondition(Number.isSafeInteger(value)&&value>=0&&value<=999_999_999_999,'INVALID_AMOUNT','Montant invalide ou trop élevé.');return value;}
export function computePrice(input:{startAt:string;endAt:string;dailyRate:number;discount:number;extras:number;dailyLevyRate:number;dailyLevyTaxable:boolean;taxRateBps:number;stamp:number}){
  const days=rentalDays(input.startAt,input.endAt);const subtotal=safeMoney(days*input.dailyRate-input.discount+input.extras);const dailyLevy=safeMoney(days*input.dailyLevyRate);
  // Integer arithmetic: the 1e12 ceiling keeps all intermediate products below Number.MAX_SAFE_INTEGER.
  const taxable=subtotal+(input.dailyLevyTaxable?dailyLevy:0);requireCondition(taxable<=90_000_000_000,'INVALID_AMOUNT','Base taxable trop élevée.');
  const tax=safeMoney(Math.floor((taxable*input.taxRateBps+5000)/10000));const total=safeMoney(subtotal+dailyLevy+tax+input.stamp);return {days,subtotal,dailyLevy,tax,total};
}
export function priceFromSettings(input:{startAt:string;endAt:string;dailyRate:number;discount:number;extras:number},settings:AgencySettings){
  const snapshot={dailyLevyRate:settings.dailyLevyEnabled?settings.dailyLevyRate:0,dailyLevyTaxable:settings.dailyLevyTaxable,taxRateBps:settings.taxRateBps,stamp:settings.stampMillimes};
  return {...snapshot,...computePrice({...input,...snapshot})};
}
export function vehicleRentalSettings(settings:AgencySettings,vehicle:Pick<Vehicle,'bodyType'|'rentalPolicy'>,mode:'demo'|'live'):AgencySettings{
  if(!['truck','flatbed','tipper','motorcycle','scooter','quad','minibus','bus'].includes(vehicle.bodyType||''))return settings;
  const p=vehicle.rentalPolicy;
  if(mode==='live')requireCondition(p?.reviewed&&p.reviewer.trim().length>=3&&p.evidence.trim().length>=20,'VEHICLE_POLICY_REQUIRED','Validez les règles fiscales, le permis requis et les conditions d’exploitation de cette catégorie dans la fiche véhicule.');
  // Car-specific levy is never silently applied to an additional vehicle family.
  return {...settings,taxRateBps:p?.taxRateBps??settings.taxRateBps,stampMillimes:p?.stampMillimes??settings.stampMillimes,dailyLevyRate:p?.dailyLevyRate??0,dailyLevyEnabled:(p?.dailyLevyRate??0)>0,dailyLevyTaxable:p?.dailyLevyTaxable??true};
}
export function priceFromRental(rental:Rental,endAt=rental.endAt,extras=rental.extras){return computePrice({...rental,endAt,extras});}
export function tunisDate(value=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Tunis',year:'numeric',month:'2-digit',day:'2-digit'}).format(value);}
export function ensureDocuments(vehicle:{insuranceUntil:string;inspectionUntil:string},until:string){const end=tunisDate(new Date(until));requireCondition(vehicle.insuranceUntil>=end,'INSURANCE_EXPIRED','L’assurance doit couvrir toute la période de location.');requireCondition(vehicle.inspectionUntil>=end,'INSPECTION_EXPIRED','La visite technique doit couvrir toute la période de location.');}
export function defaultSettings(name:string):AgencySettings{return {name,address:'',phone:'',taxId:'',email:'',fax:'',website:'',rne:'',legalForm:'',capital:'',bankName:'',bankAccount:'',logoFileId:'',documentAccent:'#204c42',documentFooter:'',quoteValidityDays:15,requireIdentityBack:false,requireLicenseBack:false,currency:'TND',timezone:'Africa/Tunis',preparationMinutes:60,taxRateBps:0,stampMillimes:0,dailyLevyRate:2000,dailyLevyEnabled:true,dailyLevyTaxable:true,fiscalValidated:false,fiscalReviewer:'',fiscalSource:'',fiscalValidatedAt:'',invoiceWorkflow:'unreviewed',invoiceWorkflowEvidence:'',contractTerms:'',termsVersion:'1',retentionDays:0,retentionPolicy:'',hostingValidated:false,legalValidated:false};}
export function fiscalGate(settings:AgencySettings,mode:'demo'|'live',always=false){if(mode==='demo'&&!always)return;requireCondition(settings.fiscalValidated&&!!settings.fiscalReviewer&&!!settings.fiscalSource,'FISCAL_VALIDATION_REQUIRED','Les paramètres fiscaux doivent être validés et documentés dans les paramètres.');if(mode==='live'){requireCondition(settings.hostingValidated,'HOSTING_VALIDATION_REQUIRED','Validez les conditions de traitement et d’hébergement des données avant toute opération réelle.');requireCondition(settings.legalValidated&&settings.contractTerms.trim().length>=30,'CONTRACT_VALIDATION_REQUIRED','Les conditions contractuelles doivent être renseignées et validées avant toute opération réelle.');}}
export function financialBalance(payments:{kind:string;amount:number}[]){return payments.reduce((a,p)=>{if(p.kind==='payment'||p.kind==='deposit_applied')a.paid+=p.amount;if(p.kind==='refund')a.paid-=p.amount;if(p.kind==='deposit_received')a.deposit+=p.amount;if(p.kind==='deposit_returned'||p.kind==='deposit_applied')a.deposit-=p.amount;return a;},{paid:0,deposit:0});}
export function csvCell(value:unknown){let s=String(value??'');if(/^[\s]*[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
export function csvRows(rows:Record<string,unknown>[],keys:string[]){return '\uFEFF'+[keys.map(csvCell).join(';'),...rows.map(r=>keys.map(k=>csvCell(r[k])).join(';'))].join('\r\n');}
