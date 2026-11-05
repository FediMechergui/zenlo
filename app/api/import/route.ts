import { z } from 'zod';
import { getChatGPTUser } from '../../chatgpt-auth';
import { context,authorize,first,insert,commit,hash,now,guard,previous } from '../../../server/db';
import { BusinessError,csvRows } from '../../../server/domain';
import { vehicleSchema,customerSchema } from '../../../server/validation';
import { parseCsv } from '../../../lib/csv';
import { parseMillimes } from '../../../lib/format';
import { inferBodyType } from '../../../lib/vehicle-catalog';

export const dynamic='force-dynamic';
const columns={vehicles:['registration','make','model','category','year','transmission','fuel','seats','odometer','dailyRateTND','depositTND','insuranceUntil','inspectionUntil','color','bodyType','vin'],customers:['type','name','email','phone','address','country','licenseNumber','licenseUntil','taxId','notes']};
const schema=z.object({kind:z.enum(['vehicles','customers']),csv:z.string().max(750000),apply:z.boolean().default(false)}).strict();
const responseHeaders={'Cache-Control':'private, no-store'};
async function getContext(){const user=await getChatGPTUser();if(!user)throw new BusinessError('UNAUTHENTICATED','Connectez-vous pour importer.',401);const ctx=await context(user);if(!ctx)throw new BusinessError('NOT_FOUND','Agence introuvable.',404);authorize(ctx,['owner','manager']);return ctx;}
function errorResponse(error:unknown){const known=error instanceof BusinessError;const invalid=error instanceof z.ZodError||error instanceof SyntaxError;return Response.json({error:{code:known?error.code:invalid?'IMPORT_INVALID':'IMPORT_FAILED',message:known?error.message:invalid?'Vérifiez le format JSON, les colonnes et la taille du fichier.':'L’import n’a pas abouti. Actualisez les données et relancez la vérification.',correlationId:crypto.randomUUID()}},{status:known?error.status:invalid?422:409,headers:responseHeaders});}
async function readBoundedBody(request:Request){
  const reader=request.body?.getReader();if(!reader)throw new BusinessError('EMPTY_IMPORT','Aucun fichier reçu.');
  let size=0;const parts:Uint8Array[]=[];
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>900000){await reader.cancel();throw new BusinessError('FILE_TOO_LARGE','Import limité à 750 Ko.',413);}parts.push(value);}}finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}return new TextDecoder().decode(bytes);
}
export async function GET(request:Request){try{await getContext();const kind=new URL(request.url).searchParams.get('kind');if(kind!=='vehicles'&&kind!=='customers')throw new BusinessError('INVALID_KIND','Choisissez véhicules ou clients.');return new Response(csvRows([],columns[kind]),{headers:{...responseHeaders,'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="zenlo-modele-${kind}.csv"`}});}catch(error){return errorResponse(error);}}
export async function POST(request:Request){
  try{
    if(request.headers.get('origin')!==new URL(request.url).origin)throw new BusinessError('INVALID_ORIGIN','Origine invalide.',403);
    const ctx=await getContext();
    if(ctx.workspace.mode==='live'&&!ctx.workspace.settings.hostingValidated)throw new BusinessError('HOSTING_VALIDATION_REQUIRED','Validez le traitement et l’hébergement des données avant l’import réel.');
    const contentLength=Number(request.headers.get('content-length')||0);if(contentLength>900000)throw new BusinessError('FILE_TOO_LARGE','Import limité à 750 Ko.',413);
    if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new BusinessError('INVALID_CONTENT_TYPE','Envoyez un fichier CSV dans une requête JSON.',415);
    const body=await readBoundedBody(request);const input=schema.parse(JSON.parse(body));
    if(new TextEncoder().encode(input.csv).length>750000)throw new BusinessError('FILE_TOO_LARGE','Import limité à 750 Ko.',413);
    const key=request.headers.get('Idempotency-Key')||'';
    if(input.apply&&!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new BusinessError('IDEMPOTENCY_REQUIRED','Clé de reprise manquante ou invalide.',400);
    const mutation={key,requestHash:await hash('import|'+input.kind+'|'+input.csv)};
    if(input.apply){const replay=await previous(ctx,mutation);if(replay)return Response.json(replay,{headers:responseHeaders});}
    let raw:Record<string,string>[];try{raw=parseCsv(input.csv);}catch(error){throw new BusinessError('INVALID_CSV',error instanceof Error?error.message:'Le fichier CSV est invalide.');}
    if(raw.length>100)throw new BusinessError('TOO_MANY_ROWS','Import limité à 100 lignes.');
    const required=input.kind==='vehicles'?columns.vehicles.filter(k=>!['color','bodyType','vin'].includes(k)):['name','phone'];
    const keys=Object.keys(raw[0]);const missing=required.filter(k=>!keys.includes(k));if(missing.length)throw new BusinessError('MISSING_COLUMNS',`Colonnes manquantes : ${missing.join(', ')}.`);
    const unknown=keys.filter(k=>!(columns[input.kind] as string[]).includes(k));if(unknown.length)throw new BusinessError('UNKNOWN_COLUMNS',`Colonnes non reconnues : ${unknown.join(', ')}.`);
    const errors:{line:number;message:string}[]=[];const duplicates:{line:number;label:string}[]=[];const accepted:{line:number;id:string;data:Record<string,unknown>}[]=[];const seen=new Set<string>();
    for(let i=0;i<raw.length;i++){
      try{
        const row=raw[i];let data:Record<string,unknown>;let identity:string;
        if(input.kind==='vehicles'){
          const {dailyRateTND,depositTND,...rest}=row;
          data=vehicleSchema.parse({...rest,bodyType:row.bodyType||inferBodyType(row.make,row.model,row.category),year:Number(row.year),seats:Number(row.seats),odometer:Number(row.odometer),dailyRate:parseMillimes(dailyRateTND),deposit:parseMillimes(depositTND)});
          identity=String(data.registration);
        }else{data=customerSchema.parse(row);identity=`${String(data.name).toLocaleLowerCase('fr-TN')}|${String(data.phone).replace(/\s/g,'')}`;}
        const existing=input.kind==='vehicles'?await first('SELECT id FROM vehicles WHERE tenant_id=? AND registration=?',ctx.workspace.id,data.registration):await first('SELECT id FROM customers WHERE tenant_id=? AND lower(name)=lower(?) AND replace(phone,\' \',\'\')=?',ctx.workspace.id,data.name,String(data.phone).replace(/\s/g,''));
        if(existing||seen.has(identity)){duplicates.push({line:i+2,label:input.kind==='vehicles'?String(data.registration):String(data.name)});continue;}
        seen.add(identity);accepted.push({line:i+2,id:`${input.kind==='vehicles'?'veh':'client'}_import_${(await hash(ctx.workspace.id+'|'+input.kind+'|'+identity)).slice(0,32)}`,data});
      }catch(error){errors.push({line:i+2,message:error instanceof z.ZodError?error.issues.map(e=>`${e.path.join('.')}: ${e.message}`).join(' · '):error instanceof Error?error.message:'Ligne invalide.'});}
    }
    const result={valid:errors.length===0,totalRows:raw.length,accepted:accepted.length,duplicates,errors,preview:accepted.slice(0,8).map(r=>({line:r.line,...r.data})),applied:false};
    if(!input.apply||errors.length)return Response.json(result,{headers:responseHeaders});
    const statements=[...guard('EXISTS(SELECT 1 FROM workspaces WHERE id=? AND version=?)',ctx.workspace.id,ctx.workspaceVersion),...accepted.flatMap(row=>[
      ...(input.kind==='customers'?guard('NOT EXISTS(SELECT 1 FROM customers WHERE tenant_id=? AND lower(name)=lower(?) AND replace(phone,\' \',\'\')=?)',ctx.workspace.id,row.data.name,String(row.data.phone).replace(/\s/g,'')):[]),
      insert(input.kind,{...row.data,id:row.id,tenantId:ctx.workspace.id,createdAt:now(),...(input.kind==='vehicles'?{status:'ready',version:1}:{})}),
    ])];
    const applied=await commit(ctx,mutation,statements,{...result,applied:true},{action:'data.imported',type:input.kind,id:await hash(input.csv),detail:`Import CSV : ${accepted.length} créations, ${duplicates.length} doublons ignorés.`});
    return Response.json(applied,{headers:responseHeaders});
  }catch(error){return errorResponse(error);}
}
