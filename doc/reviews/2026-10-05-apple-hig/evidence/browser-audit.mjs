import {createRequire} from 'node:module';
import {writeFile} from 'node:fs/promises';
const root='/Users/berksakalli/Projects/GitHub/EnesSakalliUniWien/Quirk';
const require=createRequire(root+'/package.json');
const {default:puppeteer}=await import(require.resolve('puppeteer'));
const {preview}=await import(require.resolve('vite'));
const {setAppOrigin,withQuirkPage,waitForQuirk}=await import(root+'/test_e2e/harness.js');
const out='/tmp/quirk-hig-audit-2026-10-05';
const serve=await preview({root,preview:{host:'127.0.0.1',port:0,open:false}});
setAppOrigin(serve.resolvedUrls.local[0]);
const browser=await puppeteer.launch({executablePath:'/Users/berksakalli/.cache/puppeteer/chrome/mac_arm-154.0.8037.57/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing'});
const evidence={browser:await browser.version(),checks:[]};
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function check(name,body){try{const context=await browser.createBrowserContext();try{const result=await body(context);evidence.checks.push({name,result});}finally{await context.close();}}catch(e){evidence.checks.push({name,error:e.stack});} await writeFile(out+'/browser-evidence.json',JSON.stringify(evidence,null,2));console.log(name,JSON.stringify(evidence.checks.at(-1)));}
async function records(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('shadow-quant-tape',1);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result;const read=db.transaction('takes').objectStore('takes').getAll();read.onsuccess=()=>{db.close();resolve(read.result);};};}));}
try{
await check('Tape delete recovery',async ctx=>{let result;await withQuirkPage(ctx,{cols:[['H'],['X']]},async page=>{
 let dialogs=0;page.on('dialog',async d=>{dialogs++;await d.dismiss();});
 await page.click('#record-button');await page.waitForSelector('#record-take',{visible:true});await page.click('#record-take');await page.waitForSelector('.take-card');
 const before=await records(page);const id=before.find(r=>!r.ghost).id;
 await page.evaluate(id=>[...document.querySelector(`[data-take-id="${id}"]`).querySelectorAll('button')].find(e=>e.textContent==='Delete').click(),id);
 await page.waitForFunction(id=>!document.querySelector(`[data-take-id="${id}"]`),{},id);
 const after=await records(page);
 await page.focus('#canvasDiv');await page.keyboard.down('Meta');await page.keyboard.press('z');await page.keyboard.up('Meta');await pause(250);
 const afterUndo=await records(page);await page.reload();await waitForQuirk(page);const afterReload=await records(page);
 result={before:before.length,after:after.length,afterUndo:afterUndo.length,afterReload:afterReload.length,deletedId:id,confirmationDialogs:dialogs};
});return result;});
await check('Clipboard failure feedback',async ctx=>{let result;await withQuirkPage(ctx,{cols:[['H']]},async page=>{
 await page.click('#export-button');await page.waitForSelector('#export-link-copy-button',{visible:true});
 await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw new DOMException('Permission denied for audit','NotAllowedError');};});
 await page.click('#export-link-copy-button');await page.waitForFunction(()=>document.querySelector('#export-link-copy-result')?.textContent.includes('didn'));
 const immediate=await page.$eval('#export-link-copy-result',e=>({text:e.textContent,role:e.getAttribute('role'),live:e.getAttribute('aria-live'),parentLive:e.closest('[aria-live],[role="alert"],[role="status"]')?.outerHTML??null,describedBy:document.querySelector('#export-link-copy-button').getAttribute('aria-describedby')}));
 await page.screenshot({path:out+'/clipboard-failure.png'});await pause(1200);const later=await page.$eval('#export-link-copy-result',e=>e.textContent);result={immediate,after1200ms:later};
});return result;});
await check('Virtualized state table',async ctx=>{let result;await withQuirkPage(ctx,{cols:[Array(8).fill('H')]},async page=>{
 await page.click('#state-button');await page.waitForSelector('#state-table',{visible:true});await pause(250);
 const inspect=()=>page.$eval('#state-table',e=>({ariaRowCount:e.getAttribute('aria-rowcount'),renderedRows:e.querySelectorAll('tbody tr[aria-rowindex]').length,first:e.querySelector('tbody tr[aria-rowindex]')?.getAttribute('aria-rowindex'),last:[...e.querySelectorAll('tbody tr[aria-rowindex]')].at(-1)?.getAttribute('aria-rowindex'),scrollTabIndex:e.parentElement.getAttribute('tabindex'),nearbyControls:[...e.closest('[data-panel-id]').querySelectorAll('button,input')].map(e=>e.getAttribute('aria-label')||e.textContent)}));
 const initial=await inspect();await page.$eval('.state-table-scroll',e=>e.scrollTop=e.scrollHeight);await pause(150);const scrolled=await inspect();result={initial,scrolled,qualification:'DOM evidence only; VoiceOver navigation not tested'};
});return result;});
await check('Responsive widths and coarse-pointer controls',async ctx=>{let result=[];await withQuirkPage(ctx,{cols:[['H'],['•','X']]},async page=>{
 for(const width of [1280,768,390,320,1280]){await page.setViewport({width,height:800,deviceScaleFactor:1,hasTouch:true,isMobile:false});await pause(300);result.push(await page.evaluate(()=>({width:innerWidth,documentWidth:document.documentElement.scrollWidth,inspect:(()=>{const r=document.querySelector('#inspect-button').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})(),toolbarHeight:document.querySelector('.app-toolbar')?.getBoundingClientRect().height,visibleButtons:[...document.querySelectorAll('button')].filter(e=>e.getBoundingClientRect().width>0 && e.getBoundingClientRect().height>0).filter(e=>{const r=e.getBoundingClientRect();return r.width<28||r.height<28;}).map(e=>({label:e.getAttribute('aria-label')||e.textContent.slice(0,40),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})).slice(0,15)})));if(width===390||width===1280)await page.screenshot({path:out+`/layout-${width}.png`});}
 });return result;});
}finally{await browser.close();await serve.close();}
