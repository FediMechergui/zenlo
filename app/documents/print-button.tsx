'use client';
import { useState } from 'react';
export default function PrintButton(){
 const [busy,setBusy]=useState(false),[error,setError]=useState('');
 async function print(){setBusy(true);setError('');try{
  // SVG images are not in document.images; wait for private sheets before printing.
  const urls=new Set([...document.querySelectorAll<HTMLImageElement>('img')].map(i=>i.currentSrc||i.src).concat([...document.querySelectorAll<SVGImageElement>('svg image')].map(i=>i.href.baseVal)).filter(Boolean));
  await Promise.all([...urls].map(src=>new Promise<void>((resolve,reject)=>{const img=new Image();const timeout=setTimeout(()=>reject(new Error('Le chargement des images prend trop de temps. Réessayez avant d’imprimer.')),15000);img.onload=()=>{clearTimeout(timeout);resolve();};img.onerror=()=>{clearTimeout(timeout);reject(new Error('Une image du document est indisponible. Rechargez le document avant d’imprimer.'));};img.src=src;})));
  await document.fonts.ready;window.print();
 }catch(e){setError(e instanceof Error?e.message:'Impression indisponible.');}finally{setBusy(false);}}
 return <div><button type="button" onClick={()=>void print()} disabled={busy}>{busy?'Préparation des images…':'Imprimer / enregistrer en PDF'}</button>{error&&<p role="alert">{error}</p>}</div>;
}
