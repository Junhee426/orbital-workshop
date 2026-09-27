import assert from 'node:assert/strict';
import {checkMobileControls} from './surface-touch-checks.mjs';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),port='8134',base=`http://127.0.0.1:${port}`;
await mkdir(`${root}test-results`,{recursive:true});
const server=spawn(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),['server.py','--port',port],{cwd:root});
server.stderr.on('data',()=>{});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited: ${code}`)));});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.ORBITAL_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1280,height:800}}),page=await context.newPage(),errors=[],outside=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(!r.url().startsWith(base)&&!r.url().startsWith('data:')&&!r.url().startsWith('file:'))outside.push(r.url());});
 const state=()=>page.evaluate(()=>window.surfaceCourier.getSnapshot());
 await page.goto(`${base}/surface.html`);await page.waitForFunction(()=>!!window.surfaceCourier);await page.evaluate(()=>document.fonts.ready);
 await page.screenshot({path:`${root}test-results/surface-home.png`});
 await page.evaluate(()=>localStorage.setItem('orbital-workshop-save-v1','untouched-orbital-save'));
 await page.click('#begin');await page.click('#heavyLoad');assert.equal((await state()).mass,32);await page.click('#lightLoad');
 await page.keyboard.press('e');assert.equal((await state()).stage,'delivery');
 await page.screenshot({path:`${root}test-results/surface-walk.png`});
 await page.keyboard.down('w');await page.waitForFunction(()=>window.surfaceCourier.getSnapshot().z<45.5,{},{timeout:15000});await page.keyboard.up('w');
 await page.mouse.move(690,380);await page.mouse.down();await page.mouse.move(750,380,{steps:6});await page.mouse.up();
 assert.ok(Math.abs((await state()).cameraYaw)>.15,'drag rotates camera');
 const before=await state();await page.keyboard.down('w');await page.waitForFunction(x=>window.surfaceCourier.getSnapshot().x>x+.1,before.x,{timeout:15000});await page.keyboard.up('w');
 await page.keyboard.press('Escape');assert.equal(await page.locator('#pauseDialog').evaluate(e=>e.matches(':modal')),true);
 const paused=await state();await page.waitForTimeout(250);assert.equal((await state()).elapsed,paused.elapsed);
 for(let i=0;i<6;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#pauseDialog')),true);}
 await page.click('#restart');await page.keyboard.press('e');assert.equal((await state()).stage,'delivery');
 console.log('Boot, pickup, camera-relative walking, pause and focus passed');
 const held=new Set();
 async function setKeys(next){for(const key of held)if(!next.has(key)){await page.keyboard.up(key);held.delete(key);}for(const key of next)if(!held.has(key)){await page.keyboard.down(key);held.add(key);}}
 // Real keyboard navigation; telemetry is read-only. No teleporting or simulation mutation.
 for(const target of [{x:-30,z:15},{x:-34,z:-35},{x:-30,z:-76},{x:0,z:-108}]){
  let arrived=false;
  for(let i=0;i<300;i++){
   const s=await state(),dx=target.x-s.x,dz=target.z-s.z,d=Math.hypot(dx,dz);
   if(d<2.2){arrived=true;break;}
   const next=new Set();if(Math.abs(dx)>Math.max(.65,Math.abs(dz)*.4))next.add(dx>0?'d':'a');if(Math.abs(dz)>Math.max(.65,Math.abs(dx)*.4))next.add(dz>0?'s':'w');
   await setKeys(next);await page.waitForTimeout(500);
  }
  await setKeys(new Set());assert.ok(arrived,`could not reach ${JSON.stringify(target)}: ${JSON.stringify(await state())}`);
  if(target.z===-35){await page.keyboard.press('e');assert.equal((await state()).shelterUsed,true);await page.screenshot({path:`${root}test-results/surface-shelter.png`});}
  console.log(`Walked to ${target.x}, ${target.z}`);
 }
 await page.keyboard.press('e');assert.equal((await state()).stage,'complete');assert.equal(await page.locator('#complete').isVisible(),true);assert.equal((await state()).condition,100);
 await page.screenshot({path:`${root}test-results/surface-complete.png`});
 assert.equal(await page.evaluate(()=>localStorage.getItem('orbital-workshop-save-v1')),'untouched-orbital-save');
 console.log('Complete keyboard delivery via shelter passed');
 await context.close();
 await checkMobileControls(browser,root,base,errors);
 const offline=await browser.newPage({viewport:{width:1280,height:800}});offline.on('pageerror',e=>errors.push(e.message));
 await offline.goto(pathToFileURL(`${root}SURFACE.html`).href);await offline.waitForFunction(()=>!!window.surfaceCourier);await offline.click('#begin');await offline.click('#interact');assert.equal(await offline.evaluate(()=>window.surfaceCourier.getSnapshot().stage),'delivery');
 assert.equal(await offline.locator('.wordmark').getAttribute('href'),'PLAY.html');
 await offline.goto(`${base}/`);await offline.waitForFunction(()=>!!window.orbitalWorkshop);assert.equal(await offline.locator('#surfaceLink').getAttribute('href'),'surface.html');
 await offline.click('#surfaceLink');await offline.waitForFunction(()=>!!window.surfaceCourier);
 assert.deepEqual(errors,[]);assert.deepEqual(outside,[]);console.log('Offline build, orbital entry link and no browser errors passed');
}finally{await browser?.close();server.kill();}
