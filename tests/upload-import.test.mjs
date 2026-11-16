import test, {after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve,join,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const emitted=mkdtempSync(join(tmpdir(),'zenlo-upload-qa-'));
after(()=>{assert.equal(dirname(resolve(emitted)),resolve(tmpdir()));assert.ok(basename(emitted).startsWith('zenlo-upload-qa-'));rmSync(emitted,{recursive:true,force:true});});
writeFileSync(join(emitted,'cloudflare.mjs'),'export const env=new Proxy({}, {get(_,key){return globalThis.__zenloUploadEnvironment?.[key]}});');
mkdirSync(join(emitted,'app'),{recursive:true});
writeFileSync(join(emitted,'app/chatgpt-auth.mjs'),'export async function getChatGPTUser(){return globalThis.__zenloUploadUser;}');
const files=[...readdirSync(join(root,'server')).filter(n=>n.endsWith('.ts')).map(n=>'server/'+n),...readdirSync(join(root,'lib')).filter(n=>n.endsWith('.ts')).map(n=>'lib/'+n),'app/api/import/route.ts','app/api/media/route.ts'];
for(const file of files){
  const output=join(emitted,file.replace(/\.ts$/,'.mjs'));mkdirSync(dirname(output),{recursive:true});
  const js=ts.transpileModule(readFileSync(join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,verbatimModuleSyntax:false}}).outputText;
  const resolved=js.replace(/\bfrom\s+(['"])([^'"]+)\1/g,(_m,q,s)=>{let dest=s;if(s==='cloudflare:workers')dest=pathToFileURL(join(emitted,'cloudflare.mjs')).href;else if(s.startsWith('.'))dest=s+'.mjs';else dest=import.meta.resolve(s);return `from ${q}${dest}${q}`;});
  writeFileSync(output,resolved);
}
const setup=await import(pathToFileURL(join(emitted,'server/setup.mjs')).href);
const importer=await import(pathToFileURL(join(emitted,'app/api/import/route.mjs')).href);
const media=await import(pathToFileURL(join(emitted,'app/api/media/route.mjs')).href);

class Prepared {
  constructor(db,sql,values=[]){this.db=db;this.sql=sql;this.values=values;}
  bind(...values){return new Prepared(this.db,this.sql,values);}
  async first(column){const row=this.db.prepare(this.sql).get(...this.values);return column?row?.[column]??null:row??null;}
  async all(){return {results:this.db.prepare(this.sql).all(...this.values),success:true,meta:{}};}
  async run(){return this.execute();}
  execute(){const result=this.db.prepare(this.sql).run(...this.values);return {success:true,results:[],meta:{changes:Number(result.changes)}};}
}
class Database {
  constructor(db){this.db=db;this.beforeBatch=null;}
  prepare(sql){return new Prepared(this.db,sql);}
  async batch(items){const hook=this.beforeBatch;this.beforeBatch=null;hook?.(this.db);this.db.exec('BEGIN IMMEDIATE');try{const result=items.map(x=>x.execute());this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
class Bucket {
  objects=new Map();deleted=[];onPut=null;
  async put(key,bytes,options){this.objects.set(key,new Uint8Array(bytes));await this.onPut?.(key,bytes,options);}
  async delete(key){this.deleted.push(key);this.objects.delete(key);}
}
async function fixture(t){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  for(const f of readdirSync(join(root,'drizzle')).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(join(root,'drizzle',f),'utf8'));
  const adapter=new Database(db),bucket=new Bucket();globalThis.__zenloUploadEnvironment={DB:adapter,BUCKET:bucket};
  const user={userId:'upload-qa-user',email:'upload@example.test',displayName:'Upload QA'};globalThis.__zenloUploadUser=user;
  const data=await setup.setupWorkspace(user,{key:crypto.randomUUID(),requestHash:'setup-demo'},{mode:'demo',name:'Upload QA'});
  t.after(()=>db.close());return {db,adapter,bucket,data,user};
}
const origin='https://zenlo.test';
function importRequest(body,extra={}){return new Request(origin+'/api/import',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body),...extra});}
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1sAAAAASUVORK5CYII=','base64');
function photoRequest(rentalId){const form=new FormData();form.set('rentalId',rentalId);form.set('label','Photo QA');form.set('file',new File([png],'test.png',{type:'image/png'}));return new Request(origin+'/api/media',{method:'POST',headers:{Origin:origin},body:form});}

test('chunked oversized import is cancelled before the whole body is consumed',async t=>{
  await fixture(t);let cancelled=false,pulls=0;
  const stream=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(100000));},cancel(){cancelled=true;}});
  const request=new Request(origin+'/api/import',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:stream,duplex:'half'});
  const response=await importer.POST(request);assert.equal(response.status,413);assert.equal(cancelled,true);assert.ok(pulls<=11);
});
test('CSV import rejects row 101 even without a trailing newline and changes nothing',async t=>{
  const {db}=await fixture(t);const before=db.prepare('SELECT COUNT(*) n FROM customers').get().n;
  const csv=['name;phone',...Array.from({length:101},(_,i)=>`QA ${i};+2160000${i}`)].join('\n');
  const response=await importer.POST(importRequest({kind:'customers',csv,apply:true}));assert.equal(response.status,422);assert.equal((await response.json()).error.code,'INVALID_CSV');assert.equal(db.prepare('SELECT COUNT(*) n FROM customers').get().n,before);
});
test('CSV import rolls back when hosting validation is revoked before commit',async t=>{
  const {db,adapter,data}=await fixture(t);const settings={...data.workspace.settings,hostingValidated:true,retentionDays:180,retentionPolicy:'Politique fictive validée uniquement pour ce test.'};
  db.prepare("UPDATE workspaces SET mode='live',settings=? WHERE id=?").run(JSON.stringify(settings),data.workspace.id);
  adapter.beforeBatch=db=>db.prepare('UPDATE workspaces SET version=version+1,settings=? WHERE id=?').run(JSON.stringify({...settings,hostingValidated:false}),data.workspace.id);
  const response=await importer.POST(importRequest({kind:'customers',csv:'name;phone\nConcurrent QA;+2160000999',apply:true}));assert.equal(response.status,409);assert.equal(db.prepare("SELECT COUNT(*) n FROM customers WHERE name='Concurrent QA'").get().n,0);
});
test('real photo upload is rejected until hosting is validated, without storing any object',async t=>{
  const {db,bucket,data}=await fixture(t);db.prepare("UPDATE workspaces SET mode='live' WHERE id=?").run(data.workspace.id);
  const response=await media.POST(photoRequest(data.rentals[0].id));assert.equal(response.status,422);assert.equal((await response.json()).error.code,'HOSTING_VALIDATION_REQUIRED');assert.equal(bucket.objects.size,0);
});
test('upload cleans its object when agent role is revoked between upload and commit',async t=>{
  const {db,adapter,bucket,data}=await fixture(t);
  adapter.beforeBatch=db=>db.prepare("UPDATE members SET role='viewer' WHERE tenant_id=?").run(data.workspace.id);
  const response=await media.POST(photoRequest(data.rentals[0].id));assert.notEqual(response.status,201);assert.equal(db.prepare('SELECT COUNT(*) n FROM attachments').get().n,0);assert.equal(bucket.objects.size,0);assert.equal(bucket.deleted.length,1);
});
test('two concurrent copies of the same image return the winning id and remove the losing object',async t=>{
  const {db,adapter,bucket,data}=await fixture(t);const rentalId=data.rentals[0].id;
  bucket.onPut=(key,bytes,options)=>{
    bucket.objects.set('winner-object',new Uint8Array(bytes));
    adapter.beforeBatch=db=>db.prepare('INSERT INTO attachments(id,tenant_id,rental_id,inspection_id,object_key,mime,size,hash,label,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run('winning-photo',data.workspace.id,rentalId,null,'winner-object','image/png',bytes.length,options.customMetadata.sha256,'Concurrent QA',new Date().toISOString());
  };
  const response=await media.POST(photoRequest(rentalId));assert.equal(response.status,200);assert.deepEqual(await response.json(),{id:'winning-photo'});assert.equal(db.prepare('SELECT COUNT(*) n FROM attachments').get().n,1);assert.deepEqual([...bucket.objects.keys()],['winner-object']);assert.equal(bucket.deleted.length,1);
});
