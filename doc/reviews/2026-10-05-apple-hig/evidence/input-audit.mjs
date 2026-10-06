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
async function check(name,body){try{const context=await browser.createBrowserContext();try{const result=await body(context);evidence.checks.push({name,result});}finally{await context.close();}}catch(e){evidence.checks.push({name,error:e.stack});} await writeFile(out+'/input-evidence.json',JSON.stringify(evidence,null,2));console.log(name,JSON.stringify(evidence.checks.at(-1)));}
async function records(page){return page.evaluate(()=>new Promise((resolve,reject)=>{const req=indexedDB.open('shadow-quant-tape',1);req.onerror=()=>reject(req.error);req.onsuccess=()=>{const db=req.result;const read=db.transaction('takes').objectStore('takes').getAll();read.onsuccess=()=>{db.close();resolve(read.result);};};}));}
const {waitForCanvasViewport,circuitTopForWires,circuitMetrics}=await import(root+'/test_e2e/harness.js');
const {Layout}=await import(root+'/src/config/Layout.js');
async function origin(page){await waitForCanvasViewport(page);return page.$eval('#drawCanvas canvas',e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y};});}
try{
await check('Rotation dial accessibility range',async ctx=>{let result=[];for(const arg of ['pi','4pi','-pi/2'])await withQuirkPage(ctx,{cols:[[{id:'Rx',arg}]]},async page=>{
 await page.waitForSelector('.wire-dial',{visible:true});const dom=await page.$eval('.wire-dial',e=>({role:e.getAttribute('role'),min:e.getAttribute('aria-valuemin'),max:e.getAttribute('aria-valuemax'),value:e.getAttribute('aria-valuenow'),text:e.getAttribute('aria-valuetext')}));
 const cdp=await page.createCDPSession();await cdp.send('Accessibility.enable');const tree=await cdp.send('Accessibility.getFullAXTree');const dial=tree.nodes.filter(n=>n.role?.value==='slider'&&n.name?.value?.includes('angle'));result.push({arg,dom,accessibility:dial.map(n=>({role:n.role,name:n.name,value:n.value,properties:n.properties}))});
});return result;});
await check('Rename composition Enter',async ctx=>{let result;await withQuirkPage(ctx,{cols:[['X']]},async page=>{
 const o=await origin(page),top=await circuitTopForWires(page,2);const x=o.x+Layout.REGISTER_MARGIN+Layout.REGISTER_INDEX_WIDTH/2;
 await page.mouse.move(x,o.y+top+circuitMetrics.wireSpacing*.5);await page.mouse.down();await page.mouse.move(x,o.y+top+circuitMetrics.wireSpacing*1.5,{steps:6});await page.mouse.up();await page.waitForSelector('.gutter-rename');
 const before=await page.$eval('.gutter-rename',e=>e.value);const resultEvent=await page.$eval('.gutter-rename',e=>{e.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:''}));const ev=new KeyboardEvent('keydown',{key:'Enter',code:'Enter',bubbles:true,cancelable:true,isComposing:true});e.dispatchEvent(ev);return{isComposing:ev.isComposing,defaultPrevented:ev.defaultPrevented};});await pause(100);
 result={before,event:resultEvent,editorStillOpen:!!await page.$('.gutter-rename'),qualification:'Synthetic browser composition event; physical CJK IME not tested'};
});return result;});
await check('Control click vs right click',async ctx=>{let result=[];for(const kind of ['control','right'])await withQuirkPage(ctx,{cols:[['X']]},async page=>{
 const o=await origin(page),top=await circuitTopForWires(page,2);const x=o.x+circuitMetrics.firstColumnLeft+circuitMetrics.gateSize/2,y=o.y+top+circuitMetrics.wireSpacing/2;
 await page.evaluate(()=>{window.auditEvents=[];for(const name of ['pointerdown','pointerup','contextmenu'])document.addEventListener(name,e=>window.auditEvents.push({type:e.type,button:e.button,ctrl:e.ctrlKey}),true);});
 if(kind==='control')await page.keyboard.down('Control');await page.mouse.click(x,y,{button:kind==='right'?'right':'left'});if(kind==='control')await page.keyboard.up('Control');await pause(150);
 result.push(await page.evaluate(kind=>({kind,menu:!!document.querySelector('.gate-menu'),hash:location.hash,events:window.auditEvents}),kind));
});return result;});
await check('Browser preferred font size',async ctx=>{let result;await withQuirkPage(ctx,{cols:[['H']]},async page=>{
 await page.click('#gate-forge-button');await page.waitForSelector('.forge-panel',{visible:true});const cdp=await page.createCDPSession();
 const sizes=()=>page.evaluate(()=>({root:getComputedStyle(document.documentElement).fontSize,body:getComputedStyle(document.body).fontSize,forgeDescription:getComputedStyle(document.querySelector('.forge-panel .panel-description')).fontSize}));
 const before=await sizes();await cdp.send('Page.setFontSizes',{fontSizes:{standard:32,fixed:26}});await pause(150);const after=await sizes();await page.screenshot({path:out+'/font-preference-32.png'});result={before,after,preference:'CDP standard32/fixed26'};
});return result;});
}finally{await browser.close();await serve.close();}
