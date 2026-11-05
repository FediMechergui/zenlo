import { BusinessError } from '../server/domain';

export async function boundedBody(request:Request,limit:number):Promise<Uint8Array>{
  const reader=request.body?.getReader();if(!reader)throw new BusinessError('EMPTY_BODY','La demande est vide.',400);
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw new BusinessError('REQUEST_TOO_LARGE','La demande dépasse la taille autorisée.',413);}chunks.push(value);}}finally{reader.releaseLock();}
  const result=new Uint8Array(size);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}return result;
}
export async function boundedJson(request:Request,limit=16384){
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')throw new BusinessError('CONTENT_TYPE_REQUIRED','Envoyez une demande JSON.',415);
  const raw=new TextDecoder().decode(await boundedBody(request,limit));
  try{return {raw,body:JSON.parse(raw) as unknown};}catch{throw new BusinessError('INVALID_JSON','La demande JSON est invalide.',400);}
}
export function requireOrigin(request:Request){if(request.headers.get('origin')!==new URL(request.url).origin)throw new BusinessError('ORIGIN_REJECTED','L’origine de cette demande n’est pas autorisée.',403);}
export function requestKey(request:Request){const key=request.headers.get('idempotency-key')||'';if(!/^[A-Za-z0-9_-]{16,128}$/.test(key))throw new BusinessError('IDEMPOTENCY_REQUIRED','Une clé de reprise est requise.',400);return key;}
