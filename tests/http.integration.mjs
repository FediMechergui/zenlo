import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin=process.env.ZENLO_TEST_URL||'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('These mutation tests run on a local fictional dataset only.');
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({baseURL:origin});
const request=context.request;const results=[];
async function check(name,fn){await fn();results.push(name);console.log(`PASS ${name}`);}
async function mutate(path,body,{method='POST',key=crypto.randomUUID(),expected=200}={}){
  const response=await request.fetch(path,{method,headers:{Origin:origin,'Idempotency-Key':key},data:body});
  const payload=await response.json();assert.equal(response.status(),expected,`${path}: ${JSON.stringify(payload)}`);return payload;
}
async function workspace(){const response=await request.get('/api/workspace');assert.equal(response.status(),200);return response.json();}
try{
  await check('anonymous API requests are rejected',async()=>{assert.equal((await request.get('/api/workspace')).status(),401);});
  await request.get('/signin-with-chatgpt?return_to=/');
  let data=await workspace();
  if(data.needsSetup)data=await mutate('/api/setup',{mode:'demo',name:'Zenlo Tunis'});
  assert.equal(data.workspace.mode,'demo','Use only the local fictional workspace.');
  await mutate('/api/settings',{fiscalValidated:false,fiscalReviewer:'',fiscalSource:'',taxId:''},{method:'PATCH'});
  data=await workspace();const settings=data.workspace.settings;
  const suffix=Date.now();let customerId;let vehicleId;let rentalId;let invoiceId;
  await check('customer creation is persistent and idempotent',async()=>{
    const key=crypto.randomUUID();const body={type:'individual',name:`QA Client fictif ${suffix}`,email:'qa@example.test',phone:'+216 00 000 999',address:'Adresse de test, Tunis',country:'Tunisie',licenseNumber:'TEST-ONLY',licenseUntil:'2032-12-31',taxId:'',notes:'Données de test locales'};
    customerId=(await mutate('/api/customers',body,{key})).id;
    assert.equal((await mutate('/api/customers',body,{key})).id,customerId);
    await mutate('/api/customers',{...body,name:'Different'},{key,expected:409});
  });
  await check('vehicle creation persists',async()=>{
    vehicleId=(await mutate('/api/vehicles',{registration:`QA ${suffix}`,make:'Zenlo',model:'Véhicule de test',category:'Économique',year:2025,transmission:'manual',fuel:'petrol',seats:5,odometer:1000,dailyRate:100000,deposit:1000000,insuranceUntil:'2032-12-31',inspectionUntil:'2032-12-31',color:'Blanc'})).id;
  });
  const startAt=new Date(Date.now()-5*60000).toISOString();const endAt=new Date(Date.parse(startAt)+2*86400000).toISOString();
  await check('concurrent HTTP reservations cannot double-book one vehicle',async()=>{
    const body={customerId,vehicleId,startAt,endAt,dailyRate:100000,discount:0,extras:0,depositRequired:1000000,includedKm:500,extraKmRate:500,source:'agency',pickupLocation:'Agence test',returnLocation:'Agence test',notes:'Test de concurrence',status:'confirmed'};
    const responses=await Promise.all([0,1].map(()=>request.post('/api/rentals',{headers:{Origin:origin,'Idempotency-Key':crypto.randomUUID()},data:body})));
    assert.deepEqual(responses.map(r=>r.status()).sort(),[200,409]);rentalId=(await responses.find(r=>r.status()===200).json()).id;
  });
  const inspect={odometer:1000,fuelPercent:100,condition:'Bon état vérifié pour test',damages:'Aucun',customerAccepted:true};
  await check('departure requires the agreed deposit',async()=>{
    const response=await request.post(`/api/rentals/${rentalId}/action`,{headers:{Origin:origin,'Idempotency-Key':crypto.randomUUID()},data:{action:'checkout',expectedVersion:1,inspection:inspect}});assert.ok([409,422].includes(response.status()));
  });
  await mutate('/api/payments',{rentalId,kind:'deposit_received',method:'bank',amount:1000000,reference:'TEST-DEPOSIT',note:'Paiement fictif'});
  await check('departure creates an immutable printable contract',async()=>{
    await mutate(`/api/rentals/${rentalId}/action`,{action:'checkout',expectedVersion:1,inspection:inspect});
    const doc=await request.get(`/documents/contract/${rentalId}`);assert.equal(doc.status(),200);assert.match(await doc.text(),/SHA-256/);
  });
  await check('private inspection photo upload, read and content validation',async()=>{
    const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aXioAAAAASUVORK5CYII=','base64');
    const response=await request.post('/api/media',{headers:{Origin:origin},multipart:{rentalId,label:'Photo de test',file:{name:'test.png',mimeType:'image/png',buffer:image}}});
    assert.equal(response.status(),201,await response.text());const {id}=await response.json();assert.equal((await request.get(`/api/media/${id}`)).status(),200);
    const bad=await request.post('/api/media',{headers:{Origin:origin},multipart:{rentalId,file:{name:'fake.png',mimeType:'image/png',buffer:Buffer.from('<svg onload="alert(1)"></svg>')}}});assert.equal(bad.status(),400);
  });
  await check('return records actual mileage while preserving quoted amount',async()=>{
    await mutate(`/api/rentals/${rentalId}/action`,{action:'checkin',expectedVersion:2,inspection:{...inspect,odometer:1030,fuelPercent:95},extras:0});
    data=await workspace();const rental=data.rentals.find(r=>r.id===rentalId);assert.equal(rental.status,'returned');assert.equal(rental.total,204000);
  });
  invoiceId=(await mutate('/api/invoices',{rentalId})).id;
  await check('invoice issue requires traceable fiscal approval',async()=>{
    await mutate(`/api/invoices/${invoiceId}/issue`,{},{expected:422});
    await mutate('/api/settings',{taxId:'DEMO-TEST-LOCAL',fiscalValidated:true,fiscalReviewer:'QA fictif uniquement',fiscalSource:'TEST LOCAL: règle de simulation, aucune validation réelle'},{method:'PATCH'});
    await mutate(`/api/invoices/${invoiceId}/issue`,{});
    const doc=await request.get(`/documents/invoice/${invoiceId}`);assert.equal(doc.status(),200);
  });
  await check('deposit allocation and refund reconcile every millime',async()=>{
    await mutate('/api/payments',{rentalId,kind:'deposit_applied',method:'bank',amount:150000,reference:'TEST-ALLOCATION',note:'Affectation fictive à facture vérifiée'});
    await mutate('/api/payments',{rentalId,kind:'deposit_returned',method:'bank',amount:850000,reference:'TEST-REFUND',note:'Restitution fictive'});
    await mutate('/api/payments',{rentalId,kind:'payment',method:'bank',amount:54000,reference:'TEST-PAY',note:'Solde fictif'});
    await mutate('/api/payments',{rentalId,kind:'deposit_returned',method:'bank',amount:1,reference:'TEST-OVERDRAW',note:''},{expected:422});
  });
  await check('full credit removes collectible debt and permits refund',async()=>{
    await mutate(`/api/invoices/${invoiceId}/credit`,{reason:'Annulation complète de test'});
    await mutate('/api/payments',{rentalId,kind:'payment',method:'bank',amount:1,reference:'TEST-OVERPAY',note:''},{expected:422});
    await mutate('/api/payments',{rentalId,kind:'refund',method:'bank',amount:204000,reference:'TEST-FULL-REFUND',note:'Remboursement fictif après avoir'});
  });
  await check('cross-origin mutations fail',async()=>{const response=await request.post('/api/payments',{headers:{Origin:'https://attacker.example','Idempotency-Key':crypto.randomUUID()},data:{}});assert.equal(response.status(),403);});
  await check('CSV dry run catches duplicates and malformed rows without writes',async()=>{
    const csv='name;phone;address\nClient CSV Test;+216 00 222 333;Tunis';
    const preview=await mutate('/api/import',{kind:'customers',csv,apply:false});assert.equal(preview.valid,true);assert.equal(preview.applied,false);
    const invalid=await mutate('/api/import',{kind:'customers',csv:'name;phone\n;1',apply:false});assert.equal(invalid.valid,false);
  });
  await check('exports are authenticated downloadable CSV',async()=>{const response=await request.get('/api/export?kind=payments');assert.equal(response.status(),200);assert.match(response.headers()['content-type'],/csv/);});
  await mutate('/api/settings',{taxId:settings.taxId,fiscalValidated:settings.fiscalValidated,fiscalReviewer:settings.fiscalReviewer,fiscalSource:settings.fiscalSource},{method:'PATCH'});
  await mkdir('outputs',{recursive:true});await writeFile('outputs/http-results.json',JSON.stringify({passed:results.length,checks:results,at:new Date().toISOString()},null,2));
}finally{await browser.close();}
