import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,join,resolve,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),folder=mkdtempSync(join(tmpdir(),'zenlo-report-qa-'));
after(()=>{assert.equal(dirname(resolve(folder)),resolve(tmpdir()));assert.ok(basename(folder).startsWith('zenlo-report-qa-'));rmSync(folder,{recursive:true,force:true});});
writeFileSync(join(folder,'reports.mjs'),ts.transpileModule(readFileSync(join(root,'lib/reports.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText);
const {calculateReport,reportPeriod}=await import(pathToFileURL(join(folder,'reports.mjs')).href);
const empty=()=>({invoices:[],creditNotes:[],expenses:[],expensePayments:[],payments:[],rentals:[],maintenance:[]});

test('report dates use inclusive Tunis calendar days and reject normalized impossible dates',()=>{
  const period=reportPeriod('2026-11-01','2026-11-01');
  assert.equal(new Date(period.start).toISOString(),'2026-10-31T23:00:00.000Z');
  assert.equal(new Date(period.end).toISOString(),'2026-11-01T22:59:59.999Z');
  for(const [from,to] of [['2026-02-31','2026-03-01'],['2026-01-02','2026-01-01'],['2026-99-99','2026-99-99'],['2020-01-01','2026-01-01']])assert.throws(()=>reportPeriod(from,to));
});
test('credited invoice stays in its issue month and later credit reduces only its own month',()=>{
  const data=empty();data.invoices=[{id:'invoice',status:'credited',issuedAt:'2026-10-01T10:00:00Z',total:120000},{id:'draft',status:'draft',issuedAt:null,total:900000}];
  data.creditNotes=[{invoiceId:'invoice',createdAt:'2026-11-01T10:00:00Z',amount:120000}];
  assert.equal(calculateReport(data,'2026-10-01','2026-10-31').netInvoiced,120000);
  assert.equal(calculateReport(data,'2026-11-01','2026-11-30').netInvoiced,-120000);
  assert.equal(calculateReport(data,'2026-10-01','2026-11-30').netInvoiced,0);
});
test('receipt boundaries respect Tunis midnight and deposits never invent rental cash receipts',()=>{
  const data=empty();data.payments=[{kind:'payment',amount:1000,createdAt:'2026-10-31T22:59:59.999Z'},{kind:'payment',amount:2000,createdAt:'2026-10-31T23:00:00.000Z'},{kind:'payment',amount:4000,createdAt:'2026-11-01T22:59:59.999Z'},{kind:'payment',amount:8000,createdAt:'2026-11-01T23:00:00.000Z'},{kind:'refund',amount:500,createdAt:'2026-11-01T10:00:00Z'},...['deposit_received','deposit_returned','deposit_applied'].map(kind=>({kind,amount:99000,createdAt:'2026-11-01T12:00:00Z'}))];
  assert.equal(calculateReport(data,'2026-11-01','2026-11-01').receipts,5500);
});
test('completed maintenance and recurrent fees count once through their linked expenses',()=>{
  const data=empty();data.maintenance=[{id:'maintenance',status:'completed',cost:50000,endAt:'2026-11-01T12:00:00Z'},{id:'future',status:'planned',cost:200000,endAt:'2026-11-15T12:00:00Z'}];
  data.expenses=[{id:'linked',maintenanceId:'maintenance',date:'2026-11-01',category:'Maintenance',amount:50000},{id:'insurance',obligationId:'obligation',date:'2026-11-02',category:'Assurance',amount:75000}];
  const report=calculateReport(data,'2026-11-01','2026-11-30');assert.equal(report.expenseTotal,125000);assert.deepEqual(report.costByCategory,[['Assurance',75000],['Maintenance',50000]]);
});
test('supplier settlement period and current outstanding balance have distinct explicit meanings',()=>{
  const data=empty();data.expenses=[{id:'older',date:'2026-10-01',category:'Assurance',amount:100000},{id:'current',date:'2026-11-01',category:'Maintenance',amount:70000}];
  data.expensePayments=[{expenseId:'older',date:'2026-10-02',amount:20000},{expenseId:'older',date:'2026-11-02',amount:30000},{expenseId:'current',date:'2026-12-01',amount:10000}];
  const report=calculateReport(data,'2026-11-01','2026-11-30');assert.equal(report.expenseTotal,70000);assert.equal(report.settled,30000);assert.equal(report.supplierDue,110000);
});
test('activity period uses half-open rentals and labels pending drafts without canceled dossiers',()=>{
  const data=empty();data.rentals=[{id:'ended',status:'returned',startAt:'2026-10-01T10:00:00Z',endAt:'2026-10-31T23:00:00Z'},{id:'crossing',status:'active',startAt:'2026-10-31T22:00:00Z',endAt:'2026-11-01T10:00:00Z'},{id:'draft',status:'draft',startAt:'2026-11-01T10:00:00Z',endAt:'2026-11-02T10:00:00Z'},{id:'cancelled',status:'cancelled',startAt:'2026-11-01T10:00:00Z',endAt:'2026-11-02T10:00:00Z'}];
  assert.deepEqual(calculateReport(data,'2026-11-01','2026-11-30').rentals.map(r=>r.id),['crossing','draft']);
});
test('custom expense categories resembling object properties retain exact numeric totals',()=>{
  const data=empty();data.expenses=[{id:'one',category:'__proto__',date:'2026-11-01',amount:3000},{id:'two',category:'constructor',date:'2026-11-01',amount:1000},{id:'three',category:'constructor',date:'2026-11-01',amount:1000}];
  assert.deepEqual(calculateReport(data,'2026-11-01','2026-11-30').costByCategory,[['__proto__',3000],['constructor',2000]]);
});
