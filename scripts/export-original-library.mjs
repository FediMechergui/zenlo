import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,dirname,basename} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),output=join(root,'outputs','zenlo-original-library'),temporary=await mkdtemp(join(tmpdir(),'zenlo-original-export-'));
const escape=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
try{
 for(const [input,name] of [['lib/original-vehicles.ts','catalog'],['app/components/original-vehicle-drawing.tsx','drawing']]){
  const source=await readFile(join(root,input),'utf8');const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText.replace(/from (['"])([^'"]+)\1/g,(_,q,s)=>`from ${q}${import.meta.resolve(s)}${q}`);await writeFile(join(temporary,name+'.mjs'),js);
 }
 const {ORIGINAL_VEHICLES}=await import(pathToFileURL(join(temporary,'catalog.mjs')).href),{OriginalVehicleDrawing}=await import(pathToFileURL(join(temporary,'drawing.mjs')).href);await mkdir(output,{recursive:true});const manifest=[];
 for(const entry of ORIGINAL_VEHICLES){const folder=`${entry.id}-r${entry.revision}`;await mkdir(join(output,folder),{recursive:true});const sheets=[];
  for(const view of entry.views){const title=`Zenlo · ${entry.make} ${entry.model} · ${view} · révision ${entry.revision} · à vérifier`;
   const markup=renderToStaticMarkup(createElement(OriginalVehicleDrawing,{id:entry.id,revision:entry.revision,view}));const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 190" width="1200" height="570" role="img" aria-label="${escape(title)}"><title>${escape(title)}</title><desc>${escape(entry.limitations)}</desc><g fill="none" stroke="#455149" stroke-width="1.15" stroke-linecap="round" stroke-linejoin="round">${markup}</g></svg>\n`;
   const file=`${folder}/${view}.svg`;await writeFile(join(output,file),svg);sheets.push({view,file,sha256:createHash('sha256').update(svg).digest('hex')});
  }manifest.push({...entry,sheets});
 }
 await writeFile(join(output,'manifest.json'),JSON.stringify({collection:'Zenlo original vehicle illustrations',release:1,status:'draft-unverified',note:'Original SVG artwork authored in Zenlo. Manufacturer names identify the illustrated vehicle; no manufacturer certification or engineering accuracy is claimed.',entries:manifest},null,2)+'\n');
 const html=`<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Zenlo · Bibliothèque originale 01</title><style>body{font:14px/1.6 system-ui;color:#293d31;background:#f4f6f1;margin:0;padding:36px}main{max-width:1200px;margin:auto}h1{font-size:36px;font-weight:500;letter-spacing:-1px}h2{font-size:24px;font-weight:500;margin-top:48px}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:#dce3d9;border:1px solid #dce3d9}figure{margin:0;background:#fff;padding:15px}img{width:100%;display:block}figcaption{font-size:12px;color:#5e7462}p{max-width:850px}small{color:#68786c}@media(max-width:650px){body{padding:18px}.grid{grid-template-columns:1fr}}</style><main><small>ZENLO · COLLECTION 01</small><h1>Bibliothèque de dessins originaux</h1><p>4 modèles, 32 vues et pièces nommées. Première collection non vérifiée : contrôler chaque variante sur le véhicule réel avant de confirmer sa correspondance. Les fichiers SVG et le manifeste sont conservés avec leur révision.</p>${manifest.map(v=>`<section><h2>${escape(v.make+' '+v.model+' · '+v.generation)}</h2><p>${escape(v.variant)} · ${v.yearFrom}–${v.yearTo}</p><small>${escape(v.limitations)}</small><div class="grid">${v.sheets.map(s=>`<figure><figcaption>${escape(s.view)} · r${v.revision} · à vérifier</figcaption><img src="${s.file}" alt="${escape(v.make+' '+v.model+' '+s.view)}"></figure>`).join('')}</div></section>`).join('')}</main></html>`;
 await writeFile(join(output,'index.html'),html);console.log(`Exported ${manifest.length} models / ${manifest.reduce((n,e)=>n+e.sheets.length,0)} SVG views to ${output}`);
}finally{if(dirname(resolve(temporary))!==resolve(tmpdir())||!basename(temporary).startsWith('zenlo-original-export-'))throw new Error('Unexpected temporary path');await rm(temporary,{recursive:true,force:true});}
