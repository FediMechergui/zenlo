export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PIXELS = 40_000_000;

function validDimensions(width: number, height: number) {
  if (!width || !height || width * height > MAX_PIXELS || width > 16000 || height > 16000) {
    throw new Error('Image trop grande : maximum 40 mégapixels et 16 000 pixels par côté.');
  }
}

/** Keep image pixels and display orientation; discard GPS, text and identifying metadata. */
export function sanitizeInspectionImage(input: Uint8Array): {bytes: Uint8Array; mime: 'image/jpeg' | 'image/png'} {
  if (!input.length || input.length > MAX_IMAGE_BYTES) throw new Error('La photo doit faire au maximum 5 Mo.');
  const chunks: Uint8Array[] = [];
  const view = new DataView(input.buffer, input.byteOffset, input.byteLength);
  if (input.length >= 33 && input[0] === 137 && input[1] === 80 && input[2] === 78 && input[3] === 71 && input[4]===13 && input[5]===10 && input[6]===26 && input[7]===10) {
    chunks.push(input.slice(0,8));
    let offset = 8; let hasHeader = false; let hasData = false; let ended = false;
    while (offset+12 <= input.length) {
      const size = view.getUint32(offset); const end = offset+12+size;
      if (end > input.length) throw new Error('Fichier PNG incomplet.');
      const type = String.fromCharCode(...input.slice(offset+4,offset+8));
      if (!hasHeader && type !== 'IHDR') throw new Error('En-tête PNG invalide.');
      if (type === 'IHDR') {
        if (hasHeader || size !== 13) throw new Error('En-tête PNG invalide.');
        validDimensions(view.getUint32(offset+8),view.getUint32(offset+12)); hasHeader = true;
      }
      if (type === 'IDAT') hasData = true;
      // Whitelist pixel and colour chunks. Ancillary text, EXIF and animation removed.
      if (['IHDR','PLTE','IDAT','IEND','tRNS','gAMA','cHRM','sRGB'].includes(type)) chunks.push(input.slice(offset,end));
      offset = end;
      if (type === 'IEND') { if (size !== 0) throw new Error('Fichier PNG invalide.'); ended=true; break; }
    }
    if (!ended || !hasData) throw new Error('Fichier PNG incomplet.');
    return {bytes:concat(chunks),mime:'image/png'};
  }
  if (input.length >= 4 && input[0] === 0xff && input[1] === 0xd8) {
    chunks.push(input.slice(0,2)); let offset=2; let foundFrame=false; let savedOrientation=false;
    while (offset+4<=input.length) {
      if(input[offset]!==0xff) throw new Error('Fichier JPEG invalide.');
      let markerOffset=offset+1;
      while(input[markerOffset]===0xff) markerOffset++;
      const marker=input[markerOffset];
      if(markerOffset+2>=input.length) throw new Error('Fichier JPEG incomplet.');
      if(marker===0xda) {
        if(!foundFrame || input[input.length-2]!==0xff || input[input.length-1]!==0xd9) throw new Error('Fichier JPEG incomplet.');
        // JPEG scan data is retained verbatim; reject metadata markers between progressive scans.
        for(let n=markerOffset+3;n<input.length-1;n++) {
          if(input[n]===0xff && (input[n+1]===0xe1 || input[n+1]===0xed || input[n+1]===0xfe)) throw new Error('Réenregistrez cette photo en JPEG standard avant de la joindre.');
        }
        chunks.push(input.slice(offset)); return {bytes:concat(chunks),mime:'image/jpeg'};
      }
      const size=view.getUint16(markerOffset+1); const end=markerOffset+1+size;
      if(size<2 || end>input.length) throw new Error('Fichier JPEG incomplet.');
      if(marker===0xe1&&!savedOrientation){
        const orientation=exifOrientation(input.slice(markerOffset+3,end));
        if(orientation>1){chunks.push(orientationSegment(orientation));savedOrientation=true;}
      }
      if([0xc0,0xc1,0xc2].includes(marker)) {
        if(size<8) throw new Error('En-tête JPEG invalide.');
        validDimensions(view.getUint16(markerOffset+6),view.getUint16(markerOffset+4)); foundFrame=true;
      }
      if(!((marker>=0xe0 && marker<=0xef) || marker===0xfe)) chunks.push(input.slice(offset,end));
      offset=end;
    }
    throw new Error('Fichier JPEG incomplet.');
  }
  throw new Error('Seules les images JPEG et PNG sont acceptées.');
}
function concat(chunks:Uint8Array[]) { const bytes=new Uint8Array(chunks.reduce((n,x)=>n+x.length,0)); let offset=0; for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;} return bytes; }

function exifOrientation(data:Uint8Array):number {
  if(data.length<20||String.fromCharCode(...data.slice(0,6))!=='Exif\0\0')return 1;
  const little=data[6]===0x49&&data[7]===0x49;
  if(!little&&!(data[6]===0x4d&&data[7]===0x4d))return 1;
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength);
  if(view.getUint16(8,little)!==42)return 1;
  const offset=6+view.getUint32(10,little);if(offset<14||offset+2>data.length)return 1;
  const count=Math.min(view.getUint16(offset,little),100);
  for(let i=0;i<count;i++){
    const entry=offset+2+i*12;if(entry+12>data.length)return 1;
    if(view.getUint16(entry,little)===0x112&&view.getUint16(entry+2,little)===3&&view.getUint32(entry+4,little)===1){const value=view.getUint16(entry+8,little);return value>=1&&value<=8?value:1;}
  }
  return 1;
}
function orientationSegment(value:number):Uint8Array {
  // Fresh EXIF IFD containing only Orientation; no GPS, serial number or timestamp.
  return Uint8Array.from([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,value,0,0,0,0,0,0,0]);
}

export async function sha256(bytes: Uint8Array | string): Promise<string> {
  const value = typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes;
  const hash=await crypto.subtle.digest('SHA-256',value as BufferSource);
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
