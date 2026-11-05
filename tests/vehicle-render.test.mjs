import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname,resolve,join,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import {createHash} from 'node:crypto';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const emitted=mkdtempSync(join(tmpdir(),'zenlo-diagram-ssr-qa-'));
after(()=>{assert.equal(dirname(resolve(emitted)),resolve(tmpdir()));assert.ok(basename(emitted).startsWith('zenlo-diagram-ssr-qa-'));rmSync(emitted,{recursive:true,force:true});});
for(const file of ['lib/original-vehicles.ts','app/components/original-vehicle-drawing.tsx','lib/inspection.ts','app/components/vehicle-detail.tsx','app/components/vehicle-diagram.tsx']){
  const output=join(emitted,file.replace(/\.tsx?$/,'.mjs'));mkdirSync(dirname(output),{recursive:true});
  const js=ts.transpileModule(readFileSync(join(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  const resolved=js.replace(/import\s+['"][^'"]+\.css['"];?/g,'').replace(/\bfrom\s+(['"])([^'"]+)\1/g,(_m,q,s)=>{const dest=s.startsWith('@/')?pathToFileURL(join(emitted,s.slice(2)+'.mjs')).href:s.startsWith('.')?pathToFileURL(resolve(dirname(output),s+'.mjs')).href:import.meta.resolve(s);return `from ${q}${dest}${q}`;});
  writeFileSync(output,resolved);
}
const {VehicleDiagram}=await import(pathToFileURL(join(emitted,'app/components/vehicle-diagram.mjs')).href);
const inspection=await import(pathToFileURL(join(emitted,'lib/inspection.mjs')).href);
const originals=await import(pathToFileURL(join(emitted,'lib/original-vehicles.mjs')).href);
const {OriginalVehicleDrawing}=await import(pathToFileURL(join(emitted,'app/components/original-vehicle-drawing.mjs')).href);
const originalHashes=Object.fromEntries(originals.ORIGINAL_VEHICLES.flatMap(v=>v.views.map(view=>[`${v.id}@${v.revision}/${view}`,createHash('sha256').update(renderToStaticMarkup(createElement(OriginalVehicleDrawing,{id:v.id,revision:v.revision,view}))).digest('hex')])));
test('published original drawing revisions retain their exact geometry and part labels',()=>{
 const frozen=JSON.parse(readFileSync(join(root,'tests/fixtures/original-vehicle-v1.sha256.json'),'utf8'));
 for(const [key,hash] of Object.entries(frozen))assert.equal(originalHashes[key],hash,`${key}: preserve the published revision; add a new revision for changes`);
});

test('original library has distinct eight-view geometry and supports immutable inspection profiles',()=>{
 assert.equal(originals.ORIGINAL_VEHICLES.length,4);assert.equal(new Set(Object.values(originalHashes)).size,32);
 for(const v of originals.ORIGINAL_VEHICLES){
  const profile={...inspection.DETAILED_DIAGRAM_PROFILE,original:{id:v.id,revision:v.revision,reviewed:false,reviewer:'',evidence:''}};
  assert.ok(inspection.diagramProfileSchema.safeParse(profile).success);
  const html=renderToStaticMarkup(createElement(VehicleDiagram,{bodyType:v.bodyType,profile,readOnly:true}));assert.equal((html.match(/data-original=/g)||[]).length,8);assert.ok(!html.includes('Gabarit générique'));assert.ok(html.includes('à vérifier sur le véhicule'));assert.ok(!html.includes('NaN'));assert.ok((html.match(/data-part=/g)||[]).length>40);
  const old=inspection.makeInspectionData(v.bodyType,null,profile);old.marks=[{id:'mirror',view:'left',x:30,y:40,type:'scratch',severity:'light',status:'new',part:'Rétroviseur gauche',note:''}];const next=inspection.makeInspectionData(v.bodyType,old,inspection.DETAILED_DIAGRAM_PROFILE);assert.deepEqual(next.diagramProfile,profile);assert.equal(next.marks[0].part,'Rétroviseur gauche');
  assert.equal(originals.originalMatches(v,v.make,v.model,v.bodyType,v.yearFrom),true);assert.equal(originals.originalMatches(v,v.make,v.model,v.bodyType,v.yearTo+1),false);
  assert.equal(inspection.diagramProfileSchema.safeParse({...profile,original:{...profile.original,reviewed:true}}).success,false);
  assert.equal(inspection.diagramProfileSchema.safeParse({...profile,original:{...profile.original,revision:2}}).success,false);
 }
});

test('detailed diagrams cover all eight views and named interior/exterior parts for every family',()=>{
 for(const bodyType of inspection.BODY_TYPE_VALUES){
  const html=renderToStaticMarkup(createElement(VehicleDiagram,{bodyType,profile:inspection.DETAILED_DIAGRAM_PROFILE,readOnly:true}));
  assert.equal((html.match(/aria-labelledby=/g)||[]).length,8);assert.ok((html.match(/data-part=/g)||[]).length>30);assert.ok(html.includes('Rétroviseur'));assert.ok(html.includes('Gabarit générique'));assert.ok(!html.includes('NaN'));
 }
});
test('reference sheets replace generic geometry per view, retain coordinates, and validate completeness',()=>{
 const reference={make:'Renault',model:'Clio',bodyType:'hatchback',generation:'V',variant:'5 portes',yearFrom:2020,yearTo:2025,source:'Licensed QA reference',reviewer:'QA agency',reviewed:true,sheets:inspection.INSPECTION_VIEWS.map(view=>({view,assetId:'diagram_qa_'+view})),zones:[{view:'left',name:'Rétroviseur conducteur',x:10,y:20,width:5,height:8}]};
 const profile=inspection.diagramProfileSchema.parse({...inspection.DETAILED_DIAGRAM_PROFILE,reference});
 const html=renderToStaticMarkup(createElement(VehicleDiagram,{bodyType:'hatchback',profile,marks:[{id:'refmark',view:'cabin',x:20,y:30,type:'dent',severity:'light',status:'new',note:'',part:'Siège'}],readOnly:true}));
 assert.equal((html.match(/<image /g)||[]).length,8);assert.ok(!html.includes('vehicle-outline'));assert.ok(html.includes('translate(80 57)'));assert.ok(html.includes('data-part="Rétroviseur conducteur"'));
 assert.equal(inspection.diagramProfileSchema.safeParse({...profile,reference:{...reference,sheets:reference.sheets.slice(0,7)}}).success,false);
 assert.equal(inspection.diagramProfileSchema.safeParse({...profile,reference:{...reference,yearTo:2019}}).success,false);
 assert.equal(inspection.diagramProfileSchema.safeParse({...profile,reference:{...reference,sheets:reference.sheets.map(s=>({...s,assetId:'https://evil.test/draw.svg'}))}}).success,false);
 assert.equal(inspection.diagramProfileSchema.safeParse({...profile,reference:{...reference,zones:[{view:'left',name:'Off-sheet',x:99,y:10,width:10,height:10}]}}).success,false);
 const data=inspection.makeInspectionData('hatchback',null,profile);data.marks=[{id:'seat',view:'cabin',x:20,y:30,type:'scratch',severity:'light',status:'new',note:'',part:'Siège'}];
 assert.ok(inspection.inspectionDataSchema.safeParse(data).success);assert.equal(inspection.inspectionDataSchema.safeParse({...data,diagramProfile:inspection.DEFAULT_DIAGRAM_PROFILE}).success,false);
 const next=inspection.makeInspectionData('hatchback',data,inspection.DETAILED_DIAGRAM_PROFILE);assert.deepEqual(next.diagramProfile,profile);assert.equal(next.marks[0].part,'Siège');assert.equal(next.marks[0].status,'existing');
});

test('server-rendered vehicle diagrams have scalar accessible titles matching client text',()=>{
  for(const bodyType of ['hatchback','sedan','suv','van','pickup','coupe','convertible','truck','flatbed','tipper','motorcycle','scooter','minibus','bus','quad']){
    const html=renderToStaticMarkup(createElement(VehicleDiagram,{bodyType,readOnly:true}));
    const titles=[...html.matchAll(/<title[^>]*>(.*?)<\/title>/g)].map(m=>m[1]);
    assert.deepEqual(titles,['Avant du véhicule','Arrière du véhicule','Côté gauche du véhicule','Côté droit du véhicule']);
    assert.equal((html.match(/aria-labelledby=/g)||[]).length,4);
  }
});
test('custom dimensions change the silhouette without transforming evidence coordinates',()=>{
  const profile={version:1,label:'QA model',length:85,width:75,height:90,wheelScale:110,roofRack:true};
  const mark={id:'point',view:'left',x:20,y:30,type:'dent',severity:'light',status:'existing',note:''};
  const html=renderToStaticMarkup(createElement(VehicleDiagram,{bodyType:'truck',profile,marks:[mark],readOnly:true}));
  assert.ok(html.includes('scale(0.85 0.9)'));assert.ok(html.includes('translate(80 57)'));assert.ok(html.includes('QA model'));
  assert.ok(!html.includes('NaN'));assert.ok(!html.includes('undefined'));
});
test('damage and interactive diagram titles survive SSR without missing text or injected markup',()=>{
  const marks=[{id:'mark_qa',view:'left',x:25,y:50,type:'scratch',severity:'light',status:'new',note:'Porte <avant> & aile'}];
  const html=renderToStaticMarkup(createElement(VehicleDiagram,{bodyType:'sedan',marks,onAdd(){}}));
  const titles=[...html.matchAll(/<title[^>]*>(.*?)<\/title>/g)].map(m=>m[1]);
  assert.equal(titles.length,5);assert.ok(titles.every(Boolean));
  assert.ok(titles.some(t=>t==='1. Rayure — Porte &lt;avant&gt; &amp; aile'));
  assert.ok(titles.filter(t=>t.includes('cliquez pour positionner')).length===4);
});
