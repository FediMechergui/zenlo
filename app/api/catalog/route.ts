import { getChatGPTUser } from '../../chatgpt-auth';
import { catalogModels, mergeMakes, mergeModels, normalizeCatalogName, CATALOG_SOURCE_URL } from '../../../lib/vehicle-catalog';

export const dynamic='force-dynamic';
type CacheEntry={expires:number;values:string[]};
const cache=new Map<string,CacheEntry>();
const pending=new Map<string,Promise<string[]>>();
const REMOTE_TIMEOUT_MS=6500;
const cleanName=(value:unknown)=>typeof value==='string'&&value.length<=120&&!/[\u0000-\u001f]/.test(value)?value.trim():'';

async function remoteNames(make:string):Promise<string[]>{
  const key=normalizeCatalogName(make)||'__makes';
  const existing=cache.get(key);if(existing&&existing.expires>Date.now())return existing.values;
  const running=pending.get(key);if(running)return running;
  if(pending.size>=8)throw new Error('CATALOG_BUSY');
  const promise=(async()=>{
    // The origin is fixed: user input is only one URL-encoded path segment.
    const path=make?`GetModelsForMake/${encodeURIComponent(make)}`:'GetMakesForVehicleType/car';
    const response=await fetch(`https://vpic.nhtsa.dot.gov/api/vehicles/${path}?format=json`,{signal:AbortSignal.timeout(REMOTE_TIMEOUT_MS),headers:{Accept:'application/json'}});
    if(!response.ok)throw new Error('CATALOG_UNAVAILABLE');
    const contentLength=Number(response.headers.get('content-length')||0);if(contentLength>2_000_000)throw new Error('CATALOG_TOO_LARGE');
    const reader=response.body?.getReader();if(!reader)throw new Error('CATALOG_EMPTY');
    const chunks:Uint8Array[]=[];let total=0;
    try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>2_000_000){await reader.cancel();throw new Error('CATALOG_TOO_LARGE');}chunks.push(part.value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(total);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const result=JSON.parse(new TextDecoder().decode(bytes)) as {Results?:unknown[]};
    if(!Array.isArray(result.Results))throw new Error('CATALOG_INVALID');
    const requested=normalizeCatalogName(make);
    const values=result.Results.slice(0,3000).flatMap(row=>{
      if(!row||typeof row!=='object')return [];
      const r=row as Record<string,unknown>;
      // vPIC's MakeName endpoint matches LIKE; discard unrelated partial matches.
      if(make&&normalizeCatalogName(cleanName(r.Make_Name))!==requested)return [];
      const name=cleanName(make?r.Model_Name:r.MakeName??r.Make_Name);return name?[name]:[];
    });
    if(cache.size>=40)cache.delete(cache.keys().next().value!);
    cache.set(key,{expires:Date.now()+24*60*60*1000,values});return values;
  })();
  pending.set(key,promise);try{return await promise;}finally{pending.delete(key);}
}

export async function GET(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:{message:'Connectez-vous pour consulter le catalogue.'}},{status:401,headers:{'Cache-Control':'no-store'}});
  const make=new URL(request.url).searchParams.get('make')?.trim()||'';
  if(make.length>100||/[\u0000-\u001f/\\*]/.test(make))return Response.json({error:{message:'Marque invalide.'}},{status:422,headers:{'Cache-Control':'no-store'}});
  let remote:string[]=[];let remoteAvailable=true;
  try{remote=await remoteNames(make);}catch{remoteAvailable=false;}
  return Response.json({
    ...(make?{models:mergeModels(make,remote)}:{makes:mergeMakes(remote)}),
    source:CATALOG_SOURCE_URL,remoteAvailable,
    localModelCount:make?catalogModels(make).length:undefined,
    note:'Suggestions locales et catalogue NHTSA vPIC. La couverture varie selon les marchés et les années. La saisie libre reste disponible.',
  },{headers:{'Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'}});
}
