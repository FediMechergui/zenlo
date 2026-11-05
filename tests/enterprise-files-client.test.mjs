import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtempSync,mkdirSync,readFileSync,readdirSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve,join,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';

// Run the actual route/service code with native SQLite and a private object-store adapter.
// Only the platform identity and Cloudflare bindings are replaced, never access decisions.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const emitted=mkdtempSync(join(tmpdir(),'zenlo-enterprise-access-qa-'));
after(()=>{assert.equal(dirname(resolve(emitted)),resolve(tmpdir()));assert.ok(basename(emitted).startsWith('zenlo-enterprise-access-qa-'));rmSync(emitted,{recursive:true,force:true});});
writeFileSync(join(emitted,'cloudflare.mjs'),'export const env=new Proxy({}, {get(_,key){return globalThis.__enterpriseEnvironment?.[key]}});');
mkdirSync(join(emitted,'app'),{recursive:true});
writeFileSync(join(emitted,'app/chatgpt-auth.mjs'),'export async function getChatGPTUser(){return globalThis.__enterpriseUser;}');
const routes=['app/api/diagram-assets/route.ts','app/api/diagram-assets/[id]/route.ts','app/api/vehicle-templates/route.ts','app/api/files/route.ts','app/api/files/[id]/route.ts','app/api/files/[id]/action/route.ts','app/api/client-access/route.ts','app/api/client-access/[id]/revoke/route.ts','app/api/client/route.ts','app/api/client/[id]/acknowledge/route.ts'];
const files=[...readdirSync(join(root,'server')).filter(n=>n.endsWith('.ts')).map(n=>'server/'+n),...readdirSync(join(root,'lib')).filter(n=>n.endsWith('.ts')).map(n=>'lib/'+n),...routes];
for(const file of files){
  const output=join(emitted,file.replace(/\.ts$/,'.mjs'));mkdirSync(dirname(output),{recursive:true});
  const js=ts.transpileModule(readFileSync(join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,verbatimModuleSyntax:false}}).outputText;
  const resolved=js.replace(/\bfrom\s+(['"])([^'"]+)\1/g,(_m,q,s)=>{let dest=s;if(s==='cloudflare:workers')dest=pathToFileURL(join(emitted,'cloudflare.mjs')).href;else if(s.startsWith('.'))dest=s+'.mjs';else dest=import.meta.resolve(s);return `from ${q}${dest}${q}`;});
  writeFileSync(output,resolved);
}
const load=path=>import(pathToFileURL(join(emitted,path+'.mjs')).href);
const setup=await load('server/setup'),dbServices=await load('server/db'),clientServices=await load('server/client-access'),documents=await load('server/document-data'),enterprise=await load('server/enterprise');
const fileRoutes=await load('app/api/files/route'),fileGet=await load('app/api/files/[id]/route'),fileAction=await load('app/api/files/[id]/action/route'),accessRoutes=await load('app/api/client-access/route'),clientRoute=await load('app/api/client/route'),ackRoute=await load('app/api/client/[id]/acknowledge/route');

class Prepared {
  constructor(adapter,sql,values=[]){this.adapter=adapter;this.sql=sql;this.values=values;}
  bind(...values){return new Prepared(this.adapter,this.sql,values);}
  async first(column){const row=this.adapter.db.prepare(this.sql).get(...this.values);this.adapter.afterRead?.(this.sql,row);return column?row?.[column]??null:row??null;}
  async all(){const results=this.adapter.db.prepare(this.sql).all(...this.values);this.adapter.afterRead?.(this.sql,results);return {results,success:true,meta:{}};}
  async run(){return this.execute();}
  execute(){const result=this.adapter.db.prepare(this.sql).run(...this.values);return {success:true,results:[],meta:{changes:Number(result.changes)}};}
}
class Database {
  constructor(db){this.db=db;this.beforeBatch=null;this.afterRead=null;}
  prepare(sql){return new Prepared(this,sql);}
  async batch(items){const hook=this.beforeBatch;this.beforeBatch=null;hook?.(this.db);this.db.exec('BEGIN IMMEDIATE');try{const result=items.map(x=>x.execute());this.db.exec('COMMIT');return result;}catch(e){this.db.exec('ROLLBACK');throw e;}}
}
class Bucket {
  objects=new Map();deleted=[];onPut=null;onGet=null;
  async put(key,bytes,options){this.objects.set(key,new Uint8Array(bytes));await this.onPut?.(key,bytes,options);}
  async get(key){await this.onGet?.(key);const bytes=this.objects.get(key);return bytes?{body:bytes,size:bytes.length}:null;}
  async delete(key){this.deleted.push(key);this.objects.delete(key);}
}
const origin='https://zenlo.test';
const dossierServices=await load('server/dossiers'),rentalDossier=await load('server/rental-dossier'),rentalServices=await load('server/rentals'),financeServices=await load('server/finances'),retentionServices=await load('server/retention'),operationServices=await load('server/operations');
async function saveCase(f,kind,data,status,links={},existing){const ctx=await dbServices.context(f.owner);return dossierServices.saveDossier(ctx,mutation(),existing?.id||null,{kind,data,status,...links,...(existing?{expectedVersion:existing.version}:{})});}
async function caseRow(f,id){return dossierServices.dossier(await dbServices.context(f.owner),id);}
async function freshRental(f){const ctx=await dbServices.context(f.owner),customer=f.data.customers.find(c=>c.type==='individual'),vehicle=f.data.vehicles[0];const result=await rentalServices.createRental(ctx,mutation(),{customerId:customer.id,vehicleId:vehicle.id,startAt:'2032-01-01T10:00:00Z',endAt:'2032-01-04T10:00:00Z',dailyRate:100000,depositRequired:100000,pickupLocation:'QA',returnLocation:'QA',status:'draft'});return dbServices.entity('rentals',f.tenant,result.id);}

test('tourist drivers have independent identity validation and company payer snapshots',async t=>{
 const f=await fixture(t),ctx=await dbServices.context(f.owner),rental=await freshRental(f),driver=await operationServices.createCustomer(ctx,mutation(),{name:'Tourist QA',phone:'000000',identityType:'passport',identityNumber:'FICTIONAL',identityUntil:'2035-01-01',issuingCountry:'FR',licenseCountry:'FR',licenseNumber:'FAKE-PERMIT',licenseUntil:'2035-01-01'}),company=await operationServices.createCustomer(ctx,mutation(),{type:'company',name:'QA corporate payer',phone:'000000',taxId:'QA',address:'Fictional'});
 const parties={driverIds:[rental.customerId,driver.id],signatoryId:rental.customerId,payerId:company.id};await rentalDossier.changeParties(ctx,mutation(),rental.id,{parties,expectedVersion:1,reason:'QA authorized driver',accepted:true});const next=await dbServices.entity('rentals',f.tenant,rental.id),snapshot=await rentalDossier.partySnapshot(ctx,next);assert.equal(snapshot.drivers.length,2);assert.equal(snapshot.payer.type,'company');
 await operationServices.patchCustomer(ctx,mutation(),driver.id,{licenseUntil:'2020-01-01'});await assert.rejects(rentalDossier.validateParties(ctx,next,next.endAt),e=>e.code==='LICENSE_EXPIRED');
 await assert.rejects(rentalDossier.changeParties(ctx,mutation(),rental.id,{parties:{...parties,driverIds:[company.id]},expectedVersion:2,reason:'Invalid corporate driver',accepted:true}),e=>e.code==='DRIVER_PERSON_REQUIRED');
 await assert.rejects(rentalDossier.changeParties(ctx,mutation(),rental.id,{parties,expectedVersion:1,reason:'Stale edit',accepted:true}),e=>e.code==='STALE_VERSION');
});
test('cheques cannot count as money before clearance and settlement is atomic and non-repeatable',async t=>{
 const f=await fixture(t),r=await freshRental(f),ctx=await dbServices.context(f.owner);f.db.prepare("UPDATE rentals SET status='confirmed' WHERE id=?").run(r.id);
 const data={instrumentType:'cheque',purpose:'payment',amount:50000,reference:'QA-CHEQUE',validUntil:'2035-01-01',ceiling:60000,verification:'Bank verification QA',settlementReference:'QA-CLEAR',settledAt:'2026-11-05'};let result=await saveCase(f,'instrument',data,'received',{rentalId:r.id}),item=await caseRow(f,result.id);
 await assert.rejects(saveCase(f,'instrument',data,'cleared',{rentalId:r.id},item),e=>e.code==='INVALID_TRANSITION');assert.equal(f.db.prepare('SELECT COUNT(*) n FROM payments WHERE rental_id=?').get(r.id).n,0);
 for(const status of ['verified','deposited']){await saveCase(f,'instrument',data,status,{rentalId:r.id},item);item=await caseRow(f,item.id);}
 f.adapter.beforeBatch=db=>db.prepare('UPDATE dossiers SET version=version+1 WHERE id=?').run(item.id);await assert.rejects(saveCase(f,'instrument',data,'cleared',{rentalId:r.id},item),/operation_precondition/);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM payments WHERE rental_id=?').get(r.id).n,0);
 item=await caseRow(f,item.id);await saveCase(f,'instrument',data,'cleared',{rentalId:r.id},item);item=await caseRow(f,item.id);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM payments WHERE rental_id=?').get(r.id).n,1);await assert.rejects(saveCase(f,'instrument',data,'cleared',{rentalId:r.id},item),e=>e.code==='DOSSIER_LOCKED');
 const bank={account:'QA',statementReference:'line-1',date:'2026-11-05',direction:'credit',amount:50000,paymentId:item.data.paymentId,evidence:'Statement QA'};const b=await saveCase(f,'bank',bank,'unmatched');await saveCase(f,'bank',bank,'matched',{},await caseRow(f,b.id));const b2=await saveCase(f,'bank',{...bank,statementReference:'line-2'},'unmatched');await assert.rejects(saveCase(f,'bank',{...bank,statementReference:'line-2'},'matched',{},await caseRow(f,b2.id)),/operation_precondition|UNIQUE/);
});
test('preauthorizations are guarantees, not receipts, and only cover rentals before their expiry',async t=>{
 const f=await fixture(t),r=await freshRental(f),ctx=await dbServices.context(f.owner),data={instrumentType:'preauthorization',purpose:'deposit_received',amount:100000,reference:'QA-AUTH',validUntil:'2032-01-05',verification:'QA authorization',reservation:'QA provider reference'};
 const d=await saveCase(f,'instrument',data,'received',{rentalId:r.id});await saveCase(f,'instrument',data,'authorized',{rentalId:r.id},await caseRow(f,d.id));assert.equal(await rentalDossier.authorizationHeld(ctx,r.id,r.endAt),100000);assert.equal(await rentalDossier.authorizationHeld(ctx,r.id,'2032-01-06T10:00:00Z'),0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM payments WHERE rental_id=?').get(r.id).n,0);
});
test('claims require responsibility and coverage review; disputes block any applied charge',async t=>{
 const f=await fixture(t),r=await freshRental(f),ctx=await dbServices.context(f.owner);f.db.prepare("UPDATE rentals SET status='returned' WHERE id=?").run(r.id);
 const data={occurredAt:'2026-11-05T10:00:00Z',declaration:'QA incident',expert:'QA assessor',responsibility:'QA reviewed',coverageDecision:'QA insurance decision',customerAmount:20000,customerResponse:'QA response',reviewer:'QA manager',evidence:'QA evidence'};const c=await saveCase(f,'claim',data,'reported',{rentalId:r.id});await saveCase(f,'claim',data,'investigating',{rentalId:r.id},await caseRow(f,c.id));
 const dispute=await saveCase(f,'dispute',{claimId:c.id,reason:'QA dispute'},'open',{rentalId:r.id});await assert.rejects(saveCase(f,'claim',data,'approved',{rentalId:r.id},await caseRow(f,c.id)),e=>e.code==='DISPUTE_OPEN');
 let d=await caseRow(f,dispute.id);await saveCase(f,'dispute',{claimId:c.id,reason:'QA dispute',response:'QA reviewed',resolution:'QA agreement',reviewer:'QA',evidence:'QA'},'reviewing',{rentalId:r.id},d);d=await caseRow(f,d.id);await saveCase(f,'dispute',{claimId:c.id,reason:'QA dispute',response:'QA reviewed',resolution:'QA agreement',reviewer:'QA',evidence:'QA'},'resolved',{rentalId:r.id},d);await saveCase(f,'claim',data,'approved',{rentalId:r.id},await caseRow(f,c.id));
 const before=f.db.prepare('SELECT total FROM rentals WHERE id=?').get(r.id).total;let claim=await caseRow(f,c.id);assert.equal(f.db.prepare('SELECT total FROM rentals WHERE id=?').get(r.id).total,before);await dossierServices.applyDossierCharge(ctx,mutation(),c.id,{expectedVersion:claim.version});assert.ok(f.db.prepare('SELECT total FROM rentals WHERE id=?').get(r.id).total>before);claim=await caseRow(f,c.id);await assert.rejects(dossierServices.applyDossierCharge(ctx,mutation(),c.id,{expectedVersion:claim.version}),e=>e.code==='ALREADY_APPLIED');
 await assert.rejects(saveCase(f,'claim',{...data,customerAmount:1},'closed',{rentalId:r.id},claim),e=>e.code==='CHARGE_LOCKED');await saveCase(f,'claim',data,'closed',{rentalId:r.id},claim);const closed=await caseRow(f,c.id);assert.equal(closed.status,'closed');assert.equal(closed.data.appliedAmount,20000);await assert.rejects(dossierServices.applyDossierCharge(ctx,mutation(),c.id,{expectedVersion:closed.version}),e=>e.code==='ALREADY_APPLIED');
});
test('certified withholding settles receivables without becoming bank receipts or refundable cash',async t=>{
 const f=await fixture(t),r=await freshRental(f),ctx=await dbServices.context(f.owner);f.db.prepare("UPDATE rentals SET status='returned' WHERE id=?").run(r.id);ctx.workspace.settings={...ctx.workspace.settings,fiscalValidated:true,fiscalReviewer:'QA accountant',fiscalSource:'QA approved source',address:'QA address',taxId:'QA tax'};const inv=await financeServices.createInvoice(ctx,mutation(),{rentalId:r.id});await financeServices.issueInvoice(ctx,mutation(),inv.id,{});
 const d={invoiceId:inv.id,base:100000,rateBps:100,amount:1000,certificate:'QA-CERT',certificateDate:'2026-11-05',payerTaxId:'QA',account:'432',reviewer:'QA accountant',evidence:'QA certificate checked'};const c=await saveCase(f,'withholding',d,'draft',{rentalId:r.id});await saveCase(f,'withholding',d,'certified',{rentalId:r.id},await caseRow(f,c.id));const p=f.db.prepare('SELECT * FROM payments WHERE rental_id=?').get(r.id);assert.equal(p.method,'withholding');assert.equal(p.amount,1000);await assert.rejects(financeServices.createPayment(ctx,mutation(),{rentalId:r.id,kind:'refund',method:'bank',amount:1000,reference:'QA-REFUND',note:'Cannot refund certificate'}),/operation_precondition|référence/);
 await saveCase(f,'withholding',{...d,correctionReason:'QA erroneous certificate'},'voided',{rentalId:r.id},await caseRow(f,c.id));const movements=f.db.prepare('SELECT kind,method,amount FROM payments WHERE rental_id=?').all(r.id);assert.equal(movements.length,2);assert.ok(movements.every(p=>p.method==='withholding'));assert.equal(movements.find(p=>p.kind==='refund').amount,1000);
});
test('seasonal rates and approved translated terms are frozen and reject mismatched rentals',async t=>{
 const f=await fixture(t),ctx=await dbServices.context(f.owner),r=await freshRental(f),v=f.data.vehicles[0],data={name:'QA summer',validFrom:'2032-01-01',validUntil:'2032-01-31',minimumDays:2,maximumDays:10,dailyRate:90000,extensionRate:80000};const rate=await saveCase(f,'rate',data,'draft');await saveCase(f,'rate',data,'active',{},await caseRow(f,rate.id));
 const selected=await rentalDossier.selectCommercialPolicy(ctx,{...r,ratePlanId:rate.id,dailyRate:90000},v);assert.equal(selected.policy.extensionRate,80000);await assert.rejects(rentalDossier.selectCommercialPolicy(ctx,{...r,ratePlanId:rate.id,dailyRate:1},v),e=>e.code==='RATE_CHANGED');await assert.rejects(saveCase(f,'rate',{...data,dailyRate:1},'active',{},await caseRow(f,rate.id)),e=>e.code==='DOSSIER_LOCKED');
 const terms={language:'ar',version:'AR-QA-1',text:'شروط تجريبية تمت مراجعتها لأغراض الاختبار فقط',reviewer:'QA',evidence:'QA review'};const c=await saveCase(f,'terms',terms,'draft');await saveCase(f,'terms',terms,'approved',{},await caseRow(f,c.id));assert.equal((await rentalDossier.selectTerms(ctx,'ar')).text,terms.text);
});
test('levy exports use frozen values, Tunis calendar months and later credit dates',async t=>{
 const f=await fixture(t),ctx=await dbServices.context(f.owner),r=await freshRental(f);f.db.prepare("UPDATE rentals SET status='returned' WHERE id=?").run(r.id);
 const {id}=await financeServices.createInvoice(ctx,mutation(),{rentalId:r.id});const raw=f.db.prepare('SELECT * FROM invoices WHERE id=?').get(id),snapshot=JSON.parse(raw.snapshot);snapshot.rental.dailyLevyRate=2000;snapshot.rental.days=3;
 f.db.prepare("UPDATE invoices SET status='issued',number='QA-LEVY',issued_at='2032-01-31T23:30:00.000Z',daily_levy=6000,snapshot=? WHERE id=?").run(JSON.stringify(snapshot),id);
 insert(f.db,'credit_notes',{id:'qa-credit-month',tenant_id:f.tenant,invoice_id:id,number:'QA-CREDIT',amount:raw.total,reason:'QA month correction',snapshot:'{}',created_at:'2032-02-29T23:30:00.000Z'});f.db.prepare("UPDATE invoices SET status='credited' WHERE id=?").run(id);
 const {exportCsv}=await load('server/export'),csv=async month=>(await exportCsv(ctx,new URL(origin+'/api/export?kind=daily-levy&month='+month))).text();assert.ok(!(await csv('2032-01')).includes('QA-LEVY'));const feb=await csv('2032-02');assert.ok(feb.includes('QA-LEVY'));assert.ok(feb.includes('6000'));assert.ok(!feb.includes('QA-CREDIT'));const march=await csv('2032-03');assert.ok(march.includes('QA-CREDIT'));assert.ok(march.includes('-6000'));assert.ok(!march.includes('QA-LEVY'));
});
test('electronic preparation is explicitly unsubmitted and excludes identity and permit details',async t=>{
 const f=await fixture(t),ctx=await dbServices.context(f.owner),r=await freshRental(f);f.db.prepare("UPDATE rentals SET status='returned' WHERE id=?").run(r.id);const inv=await financeServices.createInvoice(ctx,mutation(),{rentalId:r.id});const c=await saveCase(f,'einvoice',{invoiceId:inv.id,applicability:'QA pending review'},'unconfigured',{rentalId:r.id});const {electronicPreparation}=await load('server/dossier-export');const result=await (await electronicPreparation(ctx,c.id)).json();assert.equal(result.submitted,false);assert.equal(result.connectorStatus,'unconfigured');assert.match(result.sha256,/^[a-f0-9]{64}$/);for(const key of ['licenseNumber','identityNumber','drivers','signatory','people'])assert.ok(!JSON.stringify(result).includes('"'+key+'"'));
});
test('dossier evidence is private, tenant-bound and scoped to its domain role',async t=>{
 const f=await fixture(t),d=await saveCase(f,'agency',{authority:'QA'},'draft'),form=new FormData();form.set('kind','dossier_document');form.set('dossierId',d.id);form.set('file',new File([png],'qa.png',{type:'image/png'}));const response=await fileRoutes.POST(new Request(origin+'/api/files',{method:'POST',headers:{Origin:origin},body:form}));assert.equal(response.status,201,await response.clone().text());const {id}=await response.json();assert.equal((await fileGet.GET(new Request(origin+'/api/files/'+id),params(id))).status,200);
 f.db.prepare("UPDATE members SET role='accountant' WHERE tenant_id=?").run(f.tenant);assert.equal((await fileGet.GET(new Request(origin+'/api/files/'+id),params(id))).status,403);await assert.rejects(dossierServices.saveDossier(await dbServices.context(f.owner),mutation(),d.id,{kind:'agency',data:{},status:'approved',expectedVersion:1}),e=>e.code==='FORBIDDEN');
});
test('branch transfers reserve capacity and update branch and odometer only at completion',async t=>{
 const f=await fixture(t),v=f.data.vehicles.find(v=>!f.data.rentals.some(r=>r.vehicleId===v.id&&r.status==='active')),a=await saveCase(f,'branch',{name:'QA Tunis',address:'QA'},'active'),b=await saveCase(f,'branch',{name:'QA Sousse',address:'QA'},'active'),profile=await saveCase(f,'vehicle',{branchId:a.id},'draft',{vehicleId:v.id});
 const data={fromBranch:a.id,toBranch:b.id,startAt:'2034-01-01T10:00:00Z',endAt:'2034-01-01T14:00:00Z',odometer:v.odometer+20,employee:'QA operator',handover:'QA received'};const tr=await saveCase(f,'transfer',data,'planned',{vehicleId:v.id});assert.equal(f.db.prepare('SELECT COUNT(*) n FROM vehicle_blocks WHERE id=?').get(tr.id).n,1);await assert.rejects(saveCase(f,'transfer',data,'planned',{vehicleId:v.id}),/CAPACITY_CONFLICT/);
 await saveCase(f,'transfer',data,'in_transit',{vehicleId:v.id},await caseRow(f,tr.id));await saveCase(f,'transfer',data,'completed',{vehicleId:v.id},await caseRow(f,tr.id));assert.equal((await caseRow(f,profile.id)).data.branchId,b.id);assert.equal(f.db.prepare('SELECT odometer FROM vehicles WHERE id=?').get(v.id).odometer,data.odometer);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM vehicle_blocks WHERE id=?').get(tr.id).n,0);
});
test('late fines match actual assignment timestamps and reject unrelated rentals',async t=>{
 const f=await fixture(t),r=f.rental,assignment=f.db.prepare('SELECT * FROM assignments WHERE rental_id=? LIMIT 1').get(r.id),time=new Date((Date.parse(assignment.start_at)+Date.parse(assignment.end_at))/2).toISOString(),data={occurredAt:time,authority:'QA authority',reference:'QA notice',amount:10000,rentalId:r.id,responsibleDriver:'QA checked driver',evidence:'QA notice',decision:'QA approved'};
 const fine=await saveCase(f,'fine',data,'received',{vehicleId:assignment.vehicle_id});await saveCase(f,'fine',data,'matched',{vehicleId:assignment.vehicle_id},await caseRow(f,fine.id));const wrong=await freshRental(f);await assert.rejects(saveCase(f,'fine',{...data,rentalId:wrong.id},'approved',{vehicleId:assignment.vehicle_id},await caseRow(f,fine.id)),e=>e.code==='FINE_MATCH');
});
test('retention removes private copies, preserves historical records, honours holds and retries storage failures',async t=>{
 const f=await fixture(t),ctx=await dbServices.context(f.owner),c=await operationServices.createCustomer(ctx,mutation(),{name:'QA expired copies',phone:'000000'}),data={identityDays:30,formalities:'QA formalities',hosting:'QA host',transfers:'QA transfer assessment',notice:'QA notice',noticeVersion:'1',reviewer:'QA',evidence:'QA signed policy'};const p=await saveCase(f,'privacy',data,'draft');await saveCase(f,'privacy',data,'approved',{},await caseRow(f,p.id));
 const fileId='retention_file',key='qa-retention';f.bucket.objects.set(key,png);insert(f.db,'agency_files',{id:fileId,tenant_id:f.tenant,customer_id:c.id,expense_id:null,kind:'identity_front',object_key:key,mime:'image/png',size:png.length,hash:'qa',label:'QA',created_at:'2020-01-01T00:00:00Z'});
 const hold=await saveCase(f,'hold',{customerId:c.id,until:'2035-01-01',reason:'QA legal hold'},'active');assert.equal((await retentionServices.retentionPreview(ctx)).items.length,0);await saveCase(f,'hold',{customerId:c.id,until:'2035-01-01',reason:'QA legal hold'},'released',{},await caseRow(f,hold.id));assert.equal((await retentionServices.retentionPreview(ctx)).items.length,1);
 const originalDelete=f.bucket.delete.bind(f.bucket);let fail=true;f.bucket.delete=async key=>{if(fail){fail=false;throw new Error('QA interrupted storage');}return originalDelete(key);};await assert.rejects(retentionServices.executeRetention(ctx,mutation(),{ids:[fileId]}),/QA interrupted/);assert.equal((await fileGet.GET(new Request(origin+'/api/files/'+fileId),params(fileId))).status,404);await retentionServices.executeRetention(ctx,mutation(),{ids:[fileId]});assert.equal(f.bucket.objects.has(key),false);assert.equal((await retentionServices.retentionPreview(ctx)).items.length,0);assert.ok(f.db.prepare('SELECT * FROM customers WHERE id=?').get(c.id));assert.ok(f.db.prepare('SELECT COUNT(*) n FROM document_snapshots').get().n>0);
});
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF1sAAAAASUVORK5CYII=','base64');
const client={userId:'enterprise-client',email:'client-qa@example.test',displayName:'Client QA'};
const mutation=()=>({key:crypto.randomUUID(),requestHash:crypto.randomUUID()});
const params=id=>({params:Promise.resolve({id})});
const templateRoute=await load('app/api/vehicle-templates/route');
const diagramUpload=await load('app/api/diagram-assets/route'),diagramGet=await load('app/api/diagram-assets/[id]/route'),diagramService=await load('server/diagram-assets');
const templateInput={make:'Yamaha',model:'MT-07',bodyType:'motorcycle',diagramProfile:{version:1,label:'QA model',length:90,width:100,height:100,wheelScale:100,roofRack:false}};

test('original library templates validate model identity, revision, year and review evidence',async t=>{
 const f=await fixture(t),ctx=await dbServices.context(f.owner),input={...templateInput,diagramProfile:{...templateInput.diagramProfile,detailVersion:2,original:{id:'yamaha-mt07-2021',revision:1,reviewed:false,reviewer:'',evidence:''}}};
 assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',input))).status,200);
 assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',{...input,model:'MT-09'}))).status,422);
 await assert.rejects(()=>diagramService.validateDiagramReference(ctx,{...input,year:2024}),e=>e.code==='DIAGRAM_MODEL_MISMATCH');
 assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',{...input,diagramProfile:{...input.diagramProfile,original:{...input.diagramProfile.original,id:'unknown-model'}}}))).status,422);
 assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',{...input,diagramProfile:{...input.diagramProfile,original:{...input.diagramProfile.original,reviewed:true}}}))).status,422);
});
function insert(db,table,object){const entries=Object.entries(object);db.prepare(`INSERT INTO ${table} (${entries.map(([k])=>k).join(',')}) VALUES (${entries.map(()=>'?').join(',')})`).run(...entries.map(([,v])=>v));}
function jsonRequest(path,body,extra={}){return new Request(origin+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID()},body:JSON.stringify(body),...extra});}
function uploadRequest({customerId,expenseId,kind='identity_front',bytes=png,mime='image/png'}={}){const form=new FormData();form.set('kind',kind);if(customerId)form.set('customerId',customerId);if(expenseId)form.set('expenseId',expenseId);form.set('label','Test image only, no personal data');form.set('file',new File([bytes],'qa.png',{type:mime}));return new Request(origin+'/api/files',{method:'POST',headers:{Origin:origin},body:form});}
async function fixture(t){
  const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON');
  for(const f of readdirSync(join(root,'drizzle')).filter(x=>x.endsWith('.sql')).sort())db.exec(readFileSync(join(root,'drizzle',f),'utf8'));
  const adapter=new Database(db),bucket=new Bucket();globalThis.__enterpriseEnvironment={DB:adapter,BUCKET:bucket};
  const owner={userId:'enterprise-owner',email:'owner-qa@example.test',displayName:'Owner QA'};globalThis.__enterpriseUser=owner;
  const data=await setup.setupWorkspace(owner,mutation(),{mode:'demo',name:'Enterprise QA'});
  t.after(()=>{globalThis.__enterpriseEnvironment=undefined;globalThis.__enterpriseUser=undefined;db.close();});
  return {db,adapter,bucket,data,owner,tenant:data.workspace.id,rental:data.rentals.find(r=>r.status==='returned')};
}
async function upload(f,kind='identity_front'){const response=await fileRoutes.POST(uploadRequest({customerId:kind==='logo'?undefined:f.data.customers[0].id,kind}));assert.ok(response.ok,await response.clone().text());return (await response.json()).id;}

test('model-reference images are private, immutable, deduplicated and isolated by enterprise',async t=>{
 const f=await fixture(t),uploaded=await diagramUpload.POST(uploadRequest());assert.equal(uploaded.status,201);const {id}=await uploaded.json();assert.match(id,/^diagram_/);
 assert.equal((await (await diagramUpload.POST(uploadRequest())).json()).id,id);assert.equal(f.bucket.objects.size,1);
 const get=()=>diagramGet.GET(new Request(origin+'/api/diagram-assets/'+id),params(id));
 assert.equal((await get()).status,200);assert.equal((await get()).headers.get('cache-control'),'private, no-store');
 globalThis.__enterpriseUser=null;assert.equal((await get()).status,401);
 const second=await setup.setupWorkspace(f.owner,mutation(),{mode:'demo',name:'Other diagrams'},true);globalThis.__enterpriseUser={...f.owner,workspaceId:second.workspace.id};assert.equal((await get()).status,404);
 globalThis.__enterpriseUser=f.owner;f.db.prepare("UPDATE members SET role='agent' WHERE tenant_id=?").run(f.tenant);assert.equal((await diagramUpload.POST(uploadRequest())).status,403);
});
test('reference writes enforce model/year binding and reject foreign assets and executable uploads',async t=>{
 const f=await fixture(t),{id}=await (await diagramUpload.POST(uploadRequest())).json();
 const reference={make:'Yamaha',model:'MT-07',bodyType:'motorcycle',generation:'2025',variant:'Standard',yearFrom:2025,yearTo:2026,source:'Licensed QA',reviewer:'QA',reviewed:false,sheets:[{view:'left',assetId:id}],zones:[]};
 const input={...templateInput,diagramProfile:{...templateInput.diagramProfile,detailVersion:2,reference}};
 assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',input))).status,200);
 assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',{...input,model:'MT-09'}))).status,422);
 const ctx=await dbServices.context(f.owner);await assert.rejects(()=>diagramService.validateDiagramReference(ctx,{...input,year:2024}),e=>e.code==='DIAGRAM_MODEL_MISMATCH');
 const second=await setup.setupWorkspace(f.owner,mutation(),{mode:'demo',name:'Other refs'},true);globalThis.__enterpriseUser={...f.owner,workspaceId:second.workspace.id};assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',input))).status,404);
 assert.equal((await diagramUpload.POST(uploadRequest({bytes:Buffer.from('<svg onload="alert(1)"/>'),mime:'image/svg+xml'}))).status,422);
});
test('diagram upload removes its object when a concurrent role revocation prevents commit',async t=>{
 const f=await fixture(t);f.bucket.onPut=()=>f.db.prepare("UPDATE members SET role='viewer' WHERE tenant_id=?").run(f.tenant);
 assert.equal((await diagramUpload.POST(uploadRequest())).status,409);assert.equal(f.bucket.objects.size,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM vehicle_diagram_assets').get().n,0);
});
test('clients read only reference sheets in their granted inspections and revocation is rechecked after storage reads',async t=>{
 const f=await fixture(t),{id}=await (await diagramUpload.POST(uploadRequest())).json(),grantId=await grant(f);
 globalThis.__enterpriseUser=client;const get=()=>diagramGet.GET(new Request(origin+'/api/diagram-assets/'+id),params(id));assert.equal((await get()).status,404);
 const row=f.db.prepare('SELECT * FROM inspections WHERE rental_id=? LIMIT 1').get(f.rental.id);
 insert(f.db,'inspections',{...row,id:'inspection_reference_qa',inspection_data:JSON.stringify({diagramProfile:{reference:{sheets:[{view:'left',assetId:id}]}}})});
 assert.equal((await get()).status,200);
 f.bucket.onGet=()=>f.db.prepare('UPDATE client_access SET revoked_at=? WHERE id=?').run(new Date().toISOString(),grantId);
 assert.equal((await get()).status,409);assert.equal((await get()).status,404);
});

test('model templates persist with optimistic versions, safe payloads and repeatable requests',async t=>{
  await fixture(t);const request=jsonRequest('/api/vehicle-templates',templateInput);const first=await templateRoute.POST(request.clone());assert.equal(first.status,200);const {id}=await first.json();assert.equal((await (await templateRoute.POST(request.clone())).json()).id,id);
  let items=(await (await templateRoute.GET()).json()).items;assert.equal(items[0].diagramProfile.length,90);
  assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',{...templateInput,id,expectedVersion:1,diagramProfile:{...templateInput.diagramProfile,length:105}}))).status,200);
  assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',{...templateInput,id,expectedVersion:1}))).status,409);
  assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',{...templateInput,diagramProfile:{...templateInput.diagramProfile,svg:'<script/>'}}))).status,422);
  assert.equal((await templateRoute.DELETE(jsonRequest('/api/vehicle-templates',{id,expectedVersion:2},{method:'DELETE'}))).status,200);assert.deepEqual((await (await templateRoute.GET()).json()).items,[]);
});
test('templates reject cross-enterprise access and unauthorized writes',async t=>{
  const f=await fixture(t);const {id}=await (await templateRoute.POST(jsonRequest('/api/vehicle-templates',templateInput))).json();const second=await setup.setupWorkspace(f.owner,mutation(),{mode:'demo',name:'Second fleet'},true);globalThis.__enterpriseUser={...f.owner,workspaceId:second.workspace.id};assert.deepEqual((await (await templateRoute.GET()).json()).items,[]);
  assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',{...templateInput,id,expectedVersion:1}))).status,404);assert.equal((await templateRoute.DELETE(jsonRequest('/api/vehicle-templates',{id,expectedVersion:1},{method:'DELETE'}))).status,404);
  f.db.prepare("UPDATE members SET role='mechanic' WHERE tenant_id=?").run(second.workspace.id);assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',templateInput))).status,403);
  globalThis.__enterpriseUser=null;assert.equal((await templateRoute.GET()).status,401);
});
test('template commit rechecks membership and rolls back after concurrent revocation',async t=>{
  const f=await fixture(t);f.adapter.beforeBatch=db=>db.prepare('DELETE FROM members WHERE tenant_id=?').run(f.tenant);
  assert.equal((await templateRoute.POST(jsonRequest('/api/vehicle-templates',templateInput))).status,409);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM vehicle_templates').get().n,0);
});
async function verificationFingerprint(f){const response=await fileRoutes.GET(new Request(origin+`/api/files?customerId=${f.data.customers[0].id}`));assert.equal(response.status,200);const value=(await response.json()).verificationFingerprint;assert.match(value,/^[a-f0-9]{64}$/);return value;}
async function grant(f,rental=f.rental,expiresAt=new Date(Date.now()+86400000).toISOString()){
  globalThis.__enterpriseUser=f.owner;const response=await accessRoutes.POST(jsonRequest('/api/client-access',{rentalId:rental.id,email:client.email,name:client.displayName,expiresAt}));assert.equal(response.status,201,await response.clone().text());return (await response.json()).id;
}

test('private files reject anonymous users and document readers cannot bypass kind-specific permission',async t=>{
  const f=await fixture(t),id=await upload(f);
  globalThis.__enterpriseUser=null;assert.equal((await fileGet.GET(new Request(origin+`/api/files/${id}`),params(id))).status,401);
  globalThis.__enterpriseUser=f.owner;f.db.prepare("UPDATE members SET role='accountant' WHERE tenant_id=? AND user_id=?").run(f.tenant,f.owner.userId);
  assert.equal((await fileGet.GET(new Request(origin+`/api/files/${id}`),params(id))).status,403);
  assert.equal((await fileRoutes.GET(new Request(origin+'/api/files?kind=identity_front'))).status,403);
  assert.equal((await fileRoutes.POST(uploadRequest({customerId:f.data.customers[0].id}))).status,403);
});
test('switching enterprises cannot expose or attach the other enterprise CIN copies',async t=>{
  const f=await fixture(t),id=await upload(f);
  const second=await setup.setupWorkspace(f.owner,mutation(),{mode:'demo',name:'Other enterprise'},true);
  globalThis.__enterpriseUser={...f.owner,workspaceId:second.workspace.id};
  assert.equal((await fileGet.GET(new Request(origin+`/api/files/${id}`),params(id))).status,404);
  const list=await fileRoutes.GET(new Request(origin+`/api/files?customerId=${f.data.customers[0].id}`));assert.deepEqual((await list.json()).items,[]);
  assert.equal((await fileRoutes.POST(uploadRequest({customerId:f.data.customers[0].id}))).status,404);
});
test('upload rolls back database and object storage after a concurrent membership downgrade',async t=>{
  const f=await fixture(t);f.bucket.onPut=()=>f.db.prepare("UPDATE members SET role='viewer' WHERE tenant_id=? AND user_id=?").run(f.tenant,f.owner.userId);
  const response=await fileRoutes.POST(uploadRequest({customerId:f.data.customers[0].id}));assert.equal(response.status,409);
  assert.equal(f.db.prepare('SELECT count(*) n FROM agency_files').get().n,0);assert.equal(f.bucket.objects.size,0);assert.equal(f.bucket.deleted.length,1);
});
test('upload rolls back when privacy hosting approval changes before commit',async t=>{
  const f=await fixture(t),settings={...f.data.workspace.settings,hostingValidated:true};f.db.prepare("UPDATE workspaces SET mode='live',settings=? WHERE id=?").run(JSON.stringify(settings),f.tenant);
  f.bucket.onPut=()=>f.db.prepare('UPDATE workspaces SET settings=?,version=version+1 WHERE id=?').run(JSON.stringify({...settings,hostingValidated:false}),f.tenant);
  const response=await fileRoutes.POST(uploadRequest({customerId:f.data.customers[0].id}));assert.equal(response.status,409);assert.equal(f.bucket.objects.size,0);assert.equal(f.db.prepare('SELECT count(*) n FROM agency_files').get().n,0);
});
test('concurrent duplicate upload retains only the winning private object and returns its identifier',async t=>{
  const f=await fixture(t);let winner='';
  f.bucket.onPut=(key,bytes,options)=>{winner='winner_file';const winnerKey=f.tenant+'/private-files/winner';f.bucket.objects.set(winnerKey,new Uint8Array(bytes));insert(f.db,'agency_files',{id:winner,tenant_id:f.tenant,customer_id:f.data.customers[0].id,expense_id:null,kind:'identity_front',object_key:winnerKey,mime:'image/png',size:bytes.byteLength,hash:options.customMetadata.sha256,label:'Race winner',verified_at:null,verified_by:null,revoked_at:null,created_at:new Date().toISOString()});};
  const response=await fileRoutes.POST(uploadRequest({customerId:f.data.customers[0].id}));assert.equal(response.status,200);assert.equal((await response.json()).id,winner);
  assert.equal(f.db.prepare('SELECT count(*) n FROM agency_files').get().n,1);assert.equal(f.bucket.objects.size,1);assert.equal(f.bucket.deleted.length,1);
});
test('archiving a proof is irreversible and prevents later verification while preserving its audit history',async t=>{
  const f=await fixture(t),id=await upload(f),fingerprint=await verificationFingerprint(f);let response=await fileAction.POST(jsonRequest(`/api/files/${id}/action`,{action:'verify',verificationFingerprint:fingerprint}),params(id));assert.equal(response.status,200);
  response=await fileAction.POST(jsonRequest(`/api/files/${id}/action`,{action:'revoke'}),params(id));assert.equal(response.status,200);
  response=await fileAction.POST(jsonRequest(`/api/files/${id}/action`,{action:'verify'}),params(id));assert.equal(response.status,409);
  assert.ok(f.db.prepare('SELECT revoked_at FROM agency_files WHERE id=?').get(id).revoked_at);assert.ok(f.db.prepare("SELECT count(*) n FROM audit WHERE entity_id=? AND action IN ('file.verified','file.revoked')").get(id).n===2);
});
test('proof verification rejects a stale displayed identity and a customer changed during verification commit',async t=>{
  const f=await fixture(t),id=await upload(f),fingerprint=await verificationFingerprint(f),customer=f.data.customers[0].id;
  f.db.prepare('UPDATE customers SET license_number=? WHERE id=?').run('CHANGED-AFTER-DISPLAY',customer);
  let response=await fileAction.POST(jsonRequest(`/api/files/${id}/action`,{action:'verify',verificationFingerprint:fingerprint}),params(id));assert.equal(response.status,409);assert.equal((await response.json()).error.code,'CUSTOMER_CHANGED');
  const refreshed=await verificationFingerprint(f);assert.notEqual(refreshed,fingerprint);
  f.adapter.beforeBatch=db=>db.prepare('UPDATE customers SET name=? WHERE id=?').run('Changed during approval',customer);
  response=await fileAction.POST(jsonRequest(`/api/files/${id}/action`,{action:'verify',verificationFingerprint:refreshed}),params(id));assert.equal(response.status,409);
  assert.equal(f.db.prepare('SELECT verified_at FROM agency_files WHERE id=?').get(id).verified_at,null);
  assert.equal(f.db.prepare("SELECT count(*) n FROM audit WHERE action='file.verified'").get().n,0);
});
test('proof uploads reject active SVG and stop an oversized stream early',async t=>{
  const f=await fixture(t);const svg=await fileRoutes.POST(uploadRequest({customerId:f.data.customers[0].id,bytes:Buffer.from('<svg onload="alert(1)"></svg>'),mime:'image/svg+xml'}));assert.equal(svg.status,422);
  let cancelled=false,pulls=0;const body=new ReadableStream({pull(controller){pulls++;controller.enqueue(new Uint8Array(1_000_000));},cancel(){cancelled=true;}});
  const response=await fileRoutes.POST(new Request(origin+'/api/files',{method:'POST',headers:{Origin:origin,'Content-Type':'multipart/form-data; boundary=x'},body,duplex:'half'}));assert.equal(response.status,413);assert.equal(cancelled,true);assert.ok(pulls<=8);assert.equal(f.bucket.objects.size,0);
});
test('private file download checks membership again after object storage responds',async t=>{
  const f=await fixture(t),id=await upload(f);f.bucket.onGet=()=>f.db.prepare("UPDATE members SET role='viewer' WHERE tenant_id=? AND user_id=?").run(f.tenant,f.owner.userId);
  const response=await fileGet.GET(new Request(origin+`/api/files/${id}`),params(id));assert.equal(response.status,409);assert.equal(response.headers.get('content-type')?.includes('image'),false);
});
test('client grants are tenant scoped and cannot be created after concurrent hosting approval revocation',async t=>{
  const f=await fixture(t),second=await setup.setupWorkspace(f.owner,mutation(),{mode:'demo',name:'Other agency'},true);
  globalThis.__enterpriseUser={...f.owner,workspaceId:second.workspace.id};let response=await accessRoutes.POST(jsonRequest('/api/client-access',{rentalId:f.rental.id,email:client.email,expiresAt:new Date(Date.now()+86400000).toISOString()}));assert.equal(response.status,404);
  globalThis.__enterpriseUser={...f.owner,workspaceId:f.tenant};const settings={...f.data.workspace.settings,hostingValidated:true};f.db.prepare("UPDATE workspaces SET mode='live',settings=? WHERE id=?").run(JSON.stringify(settings),f.tenant);
  f.adapter.beforeBatch=db=>db.prepare('UPDATE workspaces SET settings=?,version=version+1 WHERE id=?').run(JSON.stringify({...settings,hostingValidated:false}),f.tenant);
  response=await accessRoutes.POST(jsonRequest('/api/client-access',{rentalId:f.rental.id,email:client.email,expiresAt:new Date(Date.now()+86400000).toISOString()}));assert.equal(response.status,409);assert.equal(f.db.prepare('SELECT count(*) n FROM client_access').get().n,0);
});
test('client portal exposes only granted dossiers, distance and checks without customer identity copies or internal notes',async t=>{
  const f=await fixture(t);await grant(f);globalThis.__enterpriseUser=client;
  const response=await clientRoute.GET();assert.equal(response.status,200);const result=await response.json();assert.equal(result.items.length,1);const dossier=result.items[0];
  assert.equal(dossier.id,f.rental.id);assert.equal(dossier.kilometres,320);assert.equal(dossier.kilometresFinal,true);assert.equal(dossier.inspections.length,2);
  assert.equal(dossier.customer,undefined);assert.equal(dossier.licenseNumber,undefined);assert.equal(dossier.notes,undefined);assert.equal(dossier.settings,undefined);assert.equal(dossier.files,undefined);
  assert.equal(dossier.invoices.some(invoice=>invoice.status==='draft'),false);
  const id=await (async()=>{globalThis.__enterpriseUser=f.owner;const result=await upload(f);globalThis.__enterpriseUser=client;return result;})();
  assert.equal((await fileGet.GET(new Request(origin+`/api/files/${id}`),params(id))).status,404);
  assert.equal(await documents.printableDocument(client,'contract',f.data.rentals.find(r=>r.id!==f.rental.id).id),null);
});
test('revoked or expired portal grants cannot retrieve documents or private agency logos',async t=>{
  const f=await fixture(t),logo=await upload(f,'logo'),grantId=await grant(f);globalThis.__enterpriseUser=client;
  assert.ok(await documents.printableDocument(client,'inspection',f.rental.id));assert.equal((await fileGet.GET(new Request(origin+`/api/files/${logo}`),params(logo))).status,200);
  f.db.prepare('UPDATE client_access SET revoked_at=? WHERE id=?').run(new Date().toISOString(),grantId);
  assert.equal(await documents.printableDocument(client,'inspection',f.rental.id),null);assert.equal((await fileGet.GET(new Request(origin+`/api/files/${logo}`),params(logo))).status,404);
  insert(f.db,'client_access',{id:'expired',tenant_id:f.tenant,rental_id:f.rental.id,email:client.email,name:'Expired',expires_at:'2000-01-01T00:00:00.000Z',revoked_at:null,created_at:'1999-01-01T00:00:00.000Z'});
  assert.deepEqual((await (await clientRoute.GET()).json()).items,[]);assert.equal(await documents.printableDocument(client,'contract',f.rental.id),null);
});
test('portal rechecks grant after reading rental rows and discloses no dossier when access is revoked mid-read',async t=>{
  const f=await fixture(t),grantId=await grant(f);globalThis.__enterpriseUser=client;
  f.adapter.afterRead=(sql)=>{if(sql.includes('SELECT * FROM inspections')){f.adapter.afterRead=null;f.db.prepare('UPDATE client_access SET revoked_at=? WHERE id=?').run(new Date().toISOString(),grantId);}};
  const response=await clientRoute.GET();assert.equal(response.status,409);const result=await response.json();assert.equal(result.items,undefined);
});
test('client acknowledgement is bound to current report, is repeatable and cannot succeed after revocation',async t=>{
  const f=await fixture(t),grantId=await grant(f);globalThis.__enterpriseUser=client;const fingerprint=await clientServices.inspectionFingerprint(f.tenant,f.rental.id);
  let response=await ackRoute.POST(jsonRequest(`/api/client/${f.rental.id}/acknowledge`,{inspectionHash:'0'.repeat(64)}),params(f.rental.id));assert.equal(response.status,409);
  response=await ackRoute.POST(jsonRequest(`/api/client/${f.rental.id}/acknowledge`,{inspectionHash:fingerprint}),params(f.rental.id));assert.equal(response.status,200);const acknowledged=await response.json();
  response=await ackRoute.POST(jsonRequest(`/api/client/${f.rental.id}/acknowledge`,{inspectionHash:fingerprint}),params(f.rental.id));assert.equal(response.status,200);assert.equal((await response.json()).id,acknowledged.id);assert.equal(f.db.prepare('SELECT count(*) n FROM client_acknowledgments').get().n,1);
  f.db.prepare('UPDATE client_access SET revoked_at=? WHERE id=?').run(new Date().toISOString(),grantId);
  response=await ackRoute.POST(jsonRequest(`/api/client/${f.rental.id}/acknowledge`,{inspectionHash:fingerprint}),params(f.rental.id));assert.equal(response.status,403);
});
test('acknowledgement transaction rejects a rental changed after the fingerprint was read',async t=>{
  const f=await fixture(t);await grant(f);globalThis.__enterpriseUser=client;const fingerprint=await clientServices.inspectionFingerprint(f.tenant,f.rental.id);
  f.adapter.beforeBatch=db=>db.prepare('UPDATE rentals SET version=version+1 WHERE id=?').run(f.rental.id);
  const response=await ackRoute.POST(jsonRequest(`/api/client/${f.rental.id}/acknowledge`,{inspectionHash:fingerprint}),params(f.rental.id));assert.equal(response.status,409);assert.equal(f.db.prepare('SELECT count(*) n FROM client_acknowledgments').get().n,0);
});
test('issued quotes preserve the agency profile snapshot and draft invoices stay unavailable to clients',async t=>{
  const f=await fixture(t),rental=f.data.rentals.find(r=>r.status==='confirmed'),ctx=await dbServices.context(f.owner);
  const quote=await enterprise.createQuote(ctx,mutation(),{rentalId:rental.id,validUntil:new Date(Date.now()+86400000*7).toISOString().slice(0,10),notes:'Quote QA'});
  const before=await documents.printableDocument(f.owner,'quote',quote.id);assert.ok(before);assert.equal(before.data.settings.name,'Enterprise QA');
  f.db.prepare('UPDATE workspaces SET settings=?,version=version+1 WHERE id=?').run(JSON.stringify({...f.data.workspace.settings,name:'Renamed agency',taxId:'NEW'}),f.tenant);
  const after=await documents.printableDocument(f.owner,'quote',quote.id);assert.equal(after.data.settings.name,'Enterprise QA');assert.equal(after.data.settings.taxId,before.data.settings.taxId);
  await grant(f);globalThis.__enterpriseUser=client;const invoice=f.data.invoices.find(i=>i.rentalId===f.rental.id);assert.equal(await documents.printableDocument(client,'invoice',invoice.id),null);
});
test('mechanic can print condition reports with contact and identity fields removed, but not financial documents',async t=>{
  const f=await fixture(t);f.db.prepare("UPDATE members SET role='mechanic' WHERE tenant_id=? AND user_id=?").run(f.tenant,f.owner.userId);
  const report=await documents.printableDocument(f.owner,'inspection',f.rental.id);assert.ok(report);for(const key of ['licenseNumber','licenseUntil','email','phone','address','taxId','notes'])assert.equal(report.data.customer[key],'');
  assert.equal(await documents.printableDocument(f.owner,'contract',f.rental.id),null);assert.equal(await documents.printableDocument(f.owner,'deposit',f.rental.id),null);assert.equal(await documents.printableDocument(f.owner,'delivery',f.rental.id),null);
});
test('an enterprise member may acknowledge a personal rental only with an explicit client grant',async t=>{
  const f=await fixture(t),fingerprint=await clientServices.inspectionFingerprint(f.tenant,f.rental.id);
  let response=await ackRoute.POST(jsonRequest(`/api/client/${f.rental.id}/acknowledge`,{inspectionHash:fingerprint}),params(f.rental.id));assert.equal(response.status,403);
  insert(f.db,'client_access',{id:'staff_customer_grant',tenant_id:f.tenant,rental_id:f.rental.id,email:f.owner.email,name:f.owner.displayName,expires_at:new Date(Date.now()+86400000).toISOString(),revoked_at:null,created_at:new Date().toISOString()});
  response=await ackRoute.POST(jsonRequest(`/api/client/${f.rental.id}/acknowledge`,{inspectionHash:fingerprint}),params(f.rental.id));assert.equal(response.status,200);
  assert.equal(f.db.prepare('SELECT user_id FROM client_acknowledgments').get().user_id,f.owner.userId);
});
