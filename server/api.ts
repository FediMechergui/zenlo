import { ZodError } from 'zod';
import { getChatGPTUser } from '../app/chatgpt-auth';
import { context,hash,previous } from './db';
import { BusinessError,requireCondition } from './domain';
import { getWorkspaceData } from './read';
import { setupWorkspace } from './setup';
import { createRental,rentalAction } from './rentals';
import { createPayment,createInvoice,issueInvoice,creditInvoice,cashAction } from './finances';
import { createVehicle,patchVehicle,createCustomer,patchCustomer,createMaintenance,completeMaintenance,createExpense,patchSettings,createMember,patchMember } from './operations';
import { exportCsv } from './export';

const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
async function requestBody(request:Request){
  requireCondition(request.headers.get('content-type')?.split(';')[0].trim()==='application/json','CONTENT_TYPE_REQUIRED','Envoyez une requête JSON.',415);
  const reader=request.body?.getReader();if(!reader)return '{}';let size=0;const chunks:Uint8Array[]=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>131072){await reader.cancel();throw new BusinessError('REQUEST_TOO_LARGE','La demande dépasse la taille autorisée.',413);}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}return new TextDecoder().decode(bytes)||'{}';
}
const sqlErrors:Record<string,[string,string,number]>={
  CAPACITY_CONFLICT:['CAPACITY_CONFLICT','Ce véhicule est déjà réservé, en location, en préparation ou en maintenance sur ce créneau.',409],
  DEPOSIT_INSUFFICIENT:['DEPOSIT_INSUFFICIENT','La caution disponible est insuffisante pour cette opération.',422],
  DEPOSIT_EXCEEDS_REQUIRED:['DEPOSIT_EXCEEDS_REQUIRED','La caution enregistrée dépasserait le montant demandé.',422],
  REFUND_EXCEEDS_PAYMENT:['REFUND_EXCEEDS_PAYMENT','Le remboursement dépasse les paiements disponibles.',422],
  PAYMENT_EXCEEDS_BALANCE:['PAYMENT_EXCEEDS_BALANCE','Le montant dépasse le solde restant après les avoirs et règlements.',422],
  CASH_SESSION_REQUIRED:['CASH_SESSION_REQUIRED','Ouvrez une session de caisse avant un mouvement en espèces.',422],
  CASH_INSUFFICIENT:['CASH_INSUFFICIENT','La caisse ne contient pas assez d’espèces pour cette sortie.',422],
  CASH_CLOSED:['CASH_CLOSED','Cette session est déjà clôturée.',409],
  IMMUTABLE_INVOICE:['IMMUTABLE_INVOICE','Une facture émise ne peut pas être modifiée. Établissez un avoir.',409],
  INVOICED_RENTAL_LOCKED:['INVOICED_RENTAL_LOCKED','Cette location est déjà facturée. Corrigez la pièce par avoir avant toute modification commerciale.',409],
  ODOMETER_DECREASE:['ODOMETER_DECREASE','Le kilométrage ne peut pas diminuer.',422],
  RENTAL_CANCELLED:['RENTAL_CANCELLED','La réservation a été annulée. Aucun nouvel encaissement n’est autorisé.',409],
  RENTAL_NOT_RETURNED:['RENTAL_NOT_RETURNED','Cette opération nécessite un retour enregistré.',409],
  operation_precondition:['STALE_VERSION','Le dossier ou ses autorisations ont changé. Actualisez et vérifiez les conditions de l’opération.',409],
  'vehicles.tenant_id, vehicles.registration':['DUPLICATE_REGISTRATION','Cette immatriculation existe déjà dans le parc.',409],
  'invoices.tenant_id, invoices.rental_id':['INVOICE_EXISTS','Une facture existe déjà pour cette location.',409],
  'cash_sessions.tenant_id':['CASH_ALREADY_OPEN','Une session de caisse est déjà ouverte.',409],
  'members.email':['MEMBER_EXISTS','Cette adresse possède déjà un accès à une agence.',409],
};
export function apiError(error:unknown){
  const correlationId=crypto.randomUUID();if(error instanceof ZodError){const fields:Record<string,string>={};for(const issue of error.issues)fields[issue.path.join('.')]=issue.message;return json({error:{code:'VALIDATION_ERROR',message:'Vérifiez les champs renseignés.',fields,correlationId}},422);}
  if(error instanceof BusinessError)return json({error:{code:error.code,message:error.message,fields:error.fields,correlationId}},error.status);
  const raw=error instanceof Error?error.message:String(error);for(const [match,[code,message,status]] of Object.entries(sqlErrors))if(raw.includes(match))return json({error:{code,message,correlationId}},status);
  if(raw.includes('FOREIGN KEY'))return json({error:{code:'INVALID_REFERENCE',message:'Un élément lié est introuvable ou inaccessible.',correlationId}},422);
  if(raw.includes('UNIQUE constraint'))return json({error:{code:'CONFLICT',message:'Cette opération a déjà été enregistrée ou entre en conflit avec un dossier existant.',correlationId}},409);
  console.error(JSON.stringify({event:'zenlo.api.error',correlationId,category:'unhandled'}));
  return json({error:{code:'INTERNAL_ERROR',message:'L’opération n’a pas abouti. Réessayez avec la même demande ou transmettez la référence au support.',correlationId}},500);
}
export async function handleApi(request:Request){
  try{
    const user=await getChatGPTUser();requireCondition(user,'UNAUTHENTICATED','Connectez-vous pour accéder à votre agence.',401);
    const url=new URL(request.url),path=url.pathname.replace(/^\/api\/?/,'').split('/').filter(Boolean),method=request.method;
    if(method==='GET'&&path.length===1&&path[0]==='workspace')return json(await getWorkspaceData(user)||{needsSetup:true,user:{id:user.userId,name:user.displayName,email:user.email}});
    const ctx=await context(user);
    if(method==='GET'&&path.length===1&&path[0]==='export'){requireCondition(ctx,'SETUP_REQUIRED','Configurez votre agence avant de continuer.',409);return exportCsv(ctx,url);}
    requireCondition(['POST','PATCH'].includes(method),'METHOD_NOT_ALLOWED','Méthode indisponible.',405);
    const origin=request.headers.get('origin');requireCondition(origin===url.origin,'ORIGIN_REJECTED','L’origine de cette demande n’est pas autorisée.',403);
    const key=request.headers.get('idempotency-key')||'';requireCondition(/^[A-Za-z0-9_-]{16,128}$/.test(key),'IDEMPOTENCY_REQUIRED','Une clé de reprise est requise pour cette opération.',400);
    const raw=await requestBody(request);let body:unknown;try{body=JSON.parse(raw);}catch{throw new BusinessError('INVALID_JSON','Le contenu JSON est invalide.',400);}
    const mutation={key,requestHash:await hash(`${method}:${url.pathname}:${raw}`)};
    if(method==='POST'&&path.length===1&&path[0]==='setup')return json(await setupWorkspace(user,mutation,body));
    requireCondition(ctx,'SETUP_REQUIRED','Configurez votre agence avant de continuer.',409);const replay=await previous(ctx,mutation);if(replay)return json(replay);
    let result:unknown;
    if(method==='POST'&&path.length===1&&path[0]==='vehicles')result=await createVehicle(ctx,mutation,body);
    else if(method==='PATCH'&&path.length===2&&path[0]==='vehicles')result=await patchVehicle(ctx,mutation,path[1],body);
    else if(method==='POST'&&path.length===1&&path[0]==='customers')result=await createCustomer(ctx,mutation,body);
    else if(method==='PATCH'&&path.length===2&&path[0]==='customers')result=await patchCustomer(ctx,mutation,path[1],body);
    else if(method==='POST'&&path.length===1&&path[0]==='rentals')result=await createRental(ctx,mutation,body);
    else if(method==='POST'&&path.length===3&&path[0]==='rentals'&&path[2]==='action')result=await rentalAction(ctx,mutation,path[1],body);
    else if(method==='POST'&&path.length===1&&path[0]==='payments')result=await createPayment(ctx,mutation,body);
    else if(method==='POST'&&path.length===1&&path[0]==='invoices')result=await createInvoice(ctx,mutation,body);
    else if(method==='POST'&&path.length===3&&path[0]==='invoices'&&path[2]==='issue')result=await issueInvoice(ctx,mutation,path[1],body);
    else if(method==='POST'&&path.length===3&&path[0]==='invoices'&&path[2]==='credit')result=await creditInvoice(ctx,mutation,path[1],body);
    else if(method==='POST'&&path.length===1&&path[0]==='cash')result=await cashAction(ctx,mutation,body);
    else if(method==='POST'&&path.length===1&&path[0]==='maintenance')result=await createMaintenance(ctx,mutation,body);
    else if(method==='POST'&&path.length===3&&path[0]==='maintenance'&&path[2]==='complete')result=await completeMaintenance(ctx,mutation,path[1],body);
    else if(method==='POST'&&path.length===1&&path[0]==='expenses')result=await createExpense(ctx,mutation,body);
    else if(method==='PATCH'&&path.length===1&&path[0]==='settings')result=await patchSettings(ctx,mutation,body);
    else if(method==='POST'&&path.length===1&&path[0]==='members')result=await createMember(ctx,mutation,body);
    else if(method==='PATCH'&&path.length===2&&path[0]==='members')result=await patchMember(ctx,mutation,path[1],body);
    else throw new BusinessError('NOT_FOUND','Cette opération est introuvable.',404);
    return json(result);
  }catch(error){return apiError(error);}
}
