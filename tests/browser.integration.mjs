import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';

const origin=process.env.ZENLO_TEST_URL||'http://127.0.0.1:5173';
if(!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw new Error('Run this browser QA against a local fictional dataset.');
await mkdir('outputs',{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},baseURL:origin});
const page=await context.newPage();const errors=[];const failed=[];const tabs=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=500)failed.push(`${r.status()} ${r.url()}`);});
try{
  await page.goto('/signin-with-chatgpt?return_to=/');
  await page.getByRole('navigation',{name:'Navigation principale'}).waitFor();
  for(const label of ['Tableau de bord','Planning','Réservations','Parc automobile','Clients','Finance','Maintenance','Rapports','Paramètres']){
    await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:new RegExp('^'+label)}).click();
    await page.locator('.main-content h1').waitFor();
    assert.ok(await page.locator('.main-content h1').innerText());
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
    assert.ok(overflow<2,`${label}: horizontal overflow ${overflow}px`);
    tabs.push(label);console.log(`PASS desktop tab ${label}`);
    if(['Planning','Parc automobile','Finance','Rapports'].includes(label))await page.screenshot({path:`outputs/${label==='Planning'?'planning':label==='Finance'?'finance':label==='Rapports'?'reports':'fleet'}-desktop.png`,fullPage:true});
  }
  await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:/^Tableau de bord/}).click();
  await page.screenshot({path:'outputs/dashboard-desktop.png',fullPage:true});
  await page.getByRole('button',{name:/Rechercher/}).first().click();
  await page.getByRole('dialog').waitFor();await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  console.log('PASS global search dialog keyboard dismissal');
  await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:/^Réservations/}).click();
  await page.locator('.clickable-row button').first().click();
  await page.getByRole('dialog').waitFor();await page.screenshot({path:'outputs/rental-drawer.png',fullPage:true});await page.keyboard.press('Escape');
  console.log('PASS reservation detail drawer');
  await page.setViewportSize({width:390,height:844});
  await page.getByRole('button',{name:'Ouvrir le menu'}).click();
  await page.getByRole('navigation',{name:'Navigation principale'}).getByRole('button',{name:/^Tableau de bord/}).click();
  await page.waitForTimeout(350);
  await page.screenshot({path:'outputs/dashboard-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Mobile page overflows horizontally');
  console.log('PASS mobile navigation and layout');
  assert.deepEqual(errors,[],'Browser runtime exceptions');assert.deepEqual(failed,[],'HTTP server errors');
  await writeFile('outputs/browser-results.json',JSON.stringify({tabs,errors,failed,checks:12,at:new Date().toISOString()},null,2));
}finally{await browser.close();}
