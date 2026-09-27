import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {checkMobileControls} from './surface-touch-checks.mjs';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url)),port='8136',base=`http://127.0.0.1:${port}`;
await mkdir(`${root}test-results`,{recursive:true});
const server=spawn(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),['server.py','--port',port],{cwd:root});server.stderr.on('data',()=>{});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',c=>reject(new Error(`Server exited ${c}`)));});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.ORBITAL_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[];await checkMobileControls(browser,root,base,errors);
 const page=await browser.newPage({viewport:{width:960,height:720}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto(pathToFileURL(`${root}SURFACE.html`).href);await page.waitForFunction(()=>!!window.surfaceCourier);await page.click('#begin');await page.click('#interact');assert.equal(await page.evaluate(()=>window.surfaceCourier.getSnapshot().stage),'delivery');
 await page.keyboard.down('w');await page.waitForFunction(()=>window.surfaceCourier.getSnapshot().z<45.5);await page.keyboard.up('w');
 await page.keyboard.press('Escape');for(let i=0;i<8;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#pauseDialog')),true);}
 await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>window.surfaceCourier.getSnapshot().paused),false);
 assert.deepEqual(errors,[]);console.log('Standalone build, desktop keyboard and updated menu focus passed without browser errors');
}finally{await browser?.close();server.kill();}
