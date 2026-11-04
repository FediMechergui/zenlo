import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeInspectionImage } from '../lib/media.ts';

const pixel=Uint8Array.from(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64'));
test('accepts PNG pixels and removes text/GPS metadata',()=>{
  const text=Buffer.from('GPS\0sensitive location');
  const metadata=Buffer.alloc(text.length+12);metadata.writeUInt32BE(text.length);metadata.write('tEXt',4);text.copy(metadata,8);
  const withMeta=Uint8Array.from(Buffer.concat([pixel.slice(0,33),metadata,pixel.slice(33)]));
  const sanitized=sanitizeInspectionImage(withMeta);
  assert.equal(sanitized.mime,'image/png');
  assert.deepEqual(sanitized.bytes,pixel);
});
test('rejects script payloads and truncated images',()=>{
  assert.throws(()=>sanitizeInspectionImage(new TextEncoder().encode('<svg onload="alert(1)"></svg>')));
  assert.throws(()=>sanitizeInspectionImage(pixel.slice(0,50)));
  assert.throws(()=>sanitizeInspectionImage(new Uint8Array(5*1024*1024+1)));
});
test('rejects excessive decoded dimensions',()=>{
  const huge=pixel.slice(); new DataView(huge.buffer).setUint32(16,16001);
  assert.throws(()=>sanitizeInspectionImage(huge),/grande/);
});
test('phone image orientation survives stripping identifying metadata',()=>{
  const orientation=[255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0];
  const comment=Buffer.from('Private GPS coordinates');
  const image=Uint8Array.from([255,216,...orientation,255,254,0,comment.length+2,...comment,255,192,0,17,8,0,1,0,1,3,1,17,0,2,17,0,3,17,0,255,218,0,8,1,1,0,0,63,0,0,255,217]);
  const result=sanitizeInspectionImage(image);
  assert.equal(result.mime,'image/jpeg');
  assert.ok(Buffer.from(result.bytes).includes(Buffer.from(orientation)));
  assert.ok(!Buffer.from(result.bytes).includes(comment));
});
