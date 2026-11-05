import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectionDataSchema, makeInspectionData, parseInspectionData, inspectionProgress, compareInspectionMarks,DEFAULT_DIAGRAM_PROFILE,diagramProfileSchema,checkLabelsFor } from '../lib/inspection.ts';
import { LOCAL_MAKES, catalogModels, inferBodyType, mergeMakes, mergeModels } from '../lib/vehicle-catalog.ts';

const mark=(id='mark_one')=>({id,view:'left',x:25,y:50,type:'scratch',severity:'light',note:'Rayure sur la porte',status:'new'});

test('mixed fleet model suggestions infer distinct types and relevant inspection labels',()=>{
  for(const [make,model,body] of [['Yamaha','MT-07','motorcycle'],['Yamaha','NMAX','scooter'],['Iveco','Daily Benne','tipper'],['Mercedes-Benz','Actros','truck'],['Toyota','Coaster','minibus'],['Polaris','Sportsman 570','quad']])assert.equal(inferBodyType(make,model),body);
  assert.match(checkLabelsFor('motorcycle').spare,/chaîne/);assert.match(checkLabelsFor('truck').body,/plateau/);assert.match(checkLabelsFor('bus').safety,/Issues/);
});
test('open damage retains the previous geometry while repaired histories allow a new model profile',()=>{
  const old=makeInspectionData('motorcycle',null,{...DEFAULT_DIAGRAM_PROFILE,label:'Original',length:85});old.marks=[mark()];
  const revised={...DEFAULT_DIAGRAM_PROFILE,label:'Revised',length:105};
  const next=makeInspectionData('scooter',old,revised);assert.equal(next.bodyType,'motorcycle');assert.equal(next.diagramProfile.length,85);next.diagramProfile.label='Independent';assert.equal(old.diagramProfile.label,'Original');
  old.marks[0].status='repaired';const fresh=makeInspectionData('scooter',old,revised);assert.equal(fresh.bodyType,'scooter');assert.equal(fresh.diagramProfile.length,105);assert.equal(fresh.marks.length,0);
});
test('diagram configuration rejects unsafe geometry and arbitrary image or code payloads',()=>{
  for(const value of [{...DEFAULT_DIAGRAM_PROFILE,width:0},{...DEFAULT_DIAGRAM_PROFILE,length:500},{...DEFAULT_DIAGRAM_PROFILE,svg:'<script/>'},{...DEFAULT_DIAGRAM_PROFILE,label:'x'.repeat(101)}])assert.equal(diagramProfileSchema.safeParse(value).success,false);
  assert.equal(inspectionDataSchema.safeParse({...makeInspectionData('truck'),diagramProfile:DEFAULT_DIAGRAM_PROFILE}).success,true);
});

test('next inspection preserves unresolved mark identity but never copies completed safety checks',()=>{
  const previous=makeInspectionData('suv');previous.marks=[mark(),{...mark('mark_fixed'),status:'repaired'}];previous.checks.tires='pass';previous.checks.brakes='fail';previous.notes='Previous inspection';
  const next=makeInspectionData('suv',previous);
  assert.equal(next.marks.length,1);assert.equal(next.marks[0].id,'mark_one');assert.equal(next.marks[0].status,'existing');
  assert.equal(next.checks.tires,'not_checked');assert.equal(next.checks.brakes,'not_checked');assert.equal(next.notes,'');
  next.marks[0].note='Changed';assert.equal(previous.marks[0].note,'Rayure sur la porte');
});
test('inspection input rejects out-of-diagram points, unknown keys and duplicate evidence identities',()=>{
  const input=makeInspectionData();input.marks=[mark()];assert.equal(inspectionDataSchema.safeParse(input).success,true);
  assert.equal(inspectionDataSchema.safeParse({...input,marks:[{...mark(),x:101}]}).success,false);
  assert.equal(inspectionDataSchema.safeParse({...input,marks:[{...mark(),y:-1}]}).success,false);
  assert.equal(inspectionDataSchema.safeParse({...input,marks:[mark(),mark()]}).success,false);
  assert.equal(inspectionDataSchema.safeParse({...input,marks:[{...mark(),type:'fake'}]}).success,false);
  assert.equal(inspectionDataSchema.safeParse({...input,checks:{...input.checks,hidden:'pass'}}).success,false);
  assert.equal(inspectionDataSchema.safeParse({...input,marks:[{...mark(),note:'x'.repeat(501)}]}).success,false);
});
test('legacy inspection metadata stays explicitly unavailable instead of implying a completed inspection',()=>{
  for(const value of [null,undefined,'','bad JSON',{},'{}'])assert.equal(parseInspectionData(value),null);
  const data=makeInspectionData('van');assert.deepEqual(parseInspectionData(JSON.stringify(data)),data);
  assert.equal(inspectionProgress(data).reviewed,0);
});
test('inspection progress and changes separate unresolved, new and repaired findings',()=>{
  const previous=makeInspectionData();previous.marks=[mark()];
  const next=makeInspectionData('hatchback',previous);next.marks[0].status='repaired';next.marks.push(mark('mark_two'));next.checks.brakes='fail';next.checks.tires='attention';next.checks.lights='pass';
  assert.deepEqual(inspectionProgress(next),{total:11,reviewed:3,failed:1,attention:1,newMarks:1});
  assert.deepEqual(compareInspectionMarks(previous,next).map(x=>x.change),['resolved','added']);
});
test('local catalog covers common Tunisian brands and keeps model body types distinct',()=>{
  assert.ok(LOCAL_MAKES.length>=80);
  for(const make of ['Renault','Peugeot','Citroën','Dacia','Hyundai','Kia','Toyota','Volkswagen','Geely','Chery','Fiat','Suzuki'])assert.ok(catalogModels(make).length>0,make);
  assert.equal(inferBodyType('Toyota','Hilux'),'pickup');assert.equal(inferBodyType('Renault','Clio V'),'hatchback');
  assert.equal(inferBodyType('Peugeot','3008'),'suv');assert.equal(inferBodyType('Citroen','Berlingo'),'van');
  assert.equal(inferBodyType('Unknown','Custom vehicle','Berline'),'sedan');
});
test('remote enrichment deduplicates accents and keeps curated model hints with unrestricted custom entry',()=>{
  const makes=mergeMakes(['CITROEN','SKODA','New brand']);assert.equal(makes.filter(x=>/^citro/i.test(x)).length,1);assert.ok(makes.includes('New brand'));
  const models=mergeModels('Toyota',['HILUX','New model']);assert.equal(models.filter(x=>x.name.toLowerCase()==='hilux').length,1);
  assert.equal(models.find(x=>x.name==='Hilux').bodyType,'pickup');assert.equal(models.find(x=>x.name==='New model').source,'vpic');
  assert.deepEqual(catalogModels('Unlisted local importer'),[]);
});
