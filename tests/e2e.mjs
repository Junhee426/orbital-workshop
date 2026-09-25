// Optional browser test. Run after installing Playwright and its Chromium.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.ORBITAL_SCREENSHOT_DIR||`${root}test-results`;
await mkdir(output,{recursive:true});
const port=process.env.ORBITAL_TEST_PORT||'8123';
const server=spawn(process.env.PYTHON||'python3',['server.py','--port',port],{cwd:root});
server.stderr.on('data',()=>{});
await new Promise((resolve,reject)=>{server.stdout.once('data',resolve);server.once('error',reject);server.once('exit',code=>reject(new Error(`Server exited: ${code}`)));});
let browser,testPage;
try {
 browser=await chromium.launch({headless:true,executablePath:process.env.ORBITAL_CHROMIUM_EXECUTABLE||undefined,args:['--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1440,height:960}}),page=await context.newPage(),errors=[],outsideRequests=[];
 testPage=page;
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 page.on('request',r=>{if(!r.url().startsWith(`http://127.0.0.1:${port}`)&&!r.url().startsWith('data:'))outsideRequests.push(r.url());});
 const go=async()=>{await page.goto(`http://127.0.0.1:${port}`);await page.waitForFunction(()=>!!window.orbitalWorkshop);await page.evaluate(()=>document.fonts.ready);};
 const state=()=>page.evaluate(()=>window.orbitalWorkshop.getSnapshot());
 const stage=async value=>page.waitForFunction(s=>window.orbitalWorkshop.getSnapshot().stage===s,value,{timeout:20000});
 await go();await page.screenshot({path:`${output}/01-home.png`});
 await page.click('#startButton');await page.keyboard.press('f');assert.equal((await state()).stage,'approach');
 await page.screenshot({path:`${output}/02-approach.png`});
 console.log('Boot/render and premature capture: passed');
 // Closed-loop keyboard pilot. Reads telemetry; never changes simulation state.
 const held=new Set();
 async function setKeys(next){for(const key of held)if(!next.has(key)){await page.keyboard.up(key);held.delete(key);}for(const key of next)if(!held.has(key)){await page.keyboard.down(key);held.add(key);}}
 let captured=false;
 for(let i=0;i<270;i++){
  const s=await state(),a=s.yaw,target=[Math.sin(s.targetYaw)*3.56,0,Math.cos(s.targetYaw)*3.56];
  const error=target.map((v,j)=>v-s.pos[j]),f=[-Math.sin(a),0,-Math.cos(a)],r=[Math.cos(a),0,-Math.sin(a)];
  const dot=(a,b)=>a.reduce((sum,v,j)=>sum+v*b[j],0),speed=Math.hypot(...s.vel);
  if(Math.hypot(...error)<.42&&speed<.2){await setKeys(new Set());await page.keyboard.press('f');if((await state()).stage==='survey'){captured=true;break;}}
  const uF=dot(error,f)*.5-dot(s.vel,f)*1.9,uR=dot(error,r)*.65-dot(s.vel,r)*1.9;
  const next=new Set();if(uF>.08)next.add('w');if(uF<-.08)next.add('s');if(uR>.09)next.add('d');if(uR<-.09)next.add('a');
  if(Math.hypot(...error)<.45&&speed>.15)next.add('Space');
  await setKeys(next);await page.waitForTimeout(160);
  if(i%30===0)console.log('Approach',i,s.pos.map(n=>n.toFixed(2)),speed.toFixed(2));
 }
 await setKeys(new Set());assert.equal(captured,true,'keyboard approach must allow capture');console.log('Keyboard flight/capture: passed');
 await page.keyboard.press('Escape');const before=(await state()).elapsed;await page.waitForTimeout(350);assert.equal((await state()).elapsed,before);await page.keyboard.press('Escape');
 await page.click('#partPower');await page.click('#actionButton');await page.waitForFunction(()=>window.orbitalWorkshop.getSnapshot().scanned.power);
 await page.click('#partDrive');await page.click('#actionButton');await stage('diagnose');
 await page.click('[data-diagnosis="battery"]');assert.equal((await state()).stage,'diagnose');
 await page.click('[data-diagnosis="latch"]');await stage('isolate');
 await page.click('#partPower');await page.click('#actionButton');await stage('brace');
 await page.click('#partBrace');await page.click('#actionButton');await stage('release');
 await page.keyboard.press('Escape');await page.reload();await page.waitForFunction(()=>!!window.orbitalWorkshop);
 await page.click('#continueButton');await stage('release');assert.equal((await state()).powerOn,false);
 await page.click('#partLatch');const slider=await page.locator('#torque').boundingBox();await page.mouse.click(slider.x+slider.width/2,slider.y+slider.height/2);
 assert.equal(await page.evaluate(()=>document.activeElement.id),'torque','F must work while the torque slider keeps focus');
 await page.screenshot({path:`${output}/03-repair.png`});
 await page.keyboard.down('f');await stage('restore');await page.keyboard.up('f');
 await page.click('#partPower');await page.click('#actionButton');await stage('test');await page.click('#actionButton');await stage('complete');
 await page.waitForFunction(()=>window.orbitalWorkshop.getStatus().mode==='result');
 await page.screenshot({path:`${output}/04-complete.png`});
 assert.equal((await state()).signal,1);assert.equal((await state()).panel,1);console.log('Diagnosis, pause/reload, repair and service restoration: passed');
 const credits=await page.evaluate(()=>window.orbitalWorkshop.getProfile().credits);assert.ok(credits>=400);
 await page.reload();await page.waitForFunction(()=>!!window.orbitalWorkshop);await page.click('#continueButton');
 assert.equal(await page.evaluate(()=>window.orbitalWorkshop.getProfile().credits),credits);
 await page.click('#returnButton');await page.click('#upgradeButton');assert.equal(await page.evaluate(()=>window.orbitalWorkshop.getProfile().credits),credits-180);
 assert.equal(await page.locator('#upgradeButton').isDisabled(),true);
 await page.screenshot({path:`${output}/05-workshop.png`});
 await page.click('#trainingButton');assert.equal((await state()).training,true);assert.equal((await state()).precision,true);
 console.log('Reward idempotency and functional upgrade: passed');
 const mobileContext=await browser.newContext({viewport:{width:430,height:932},isMobile:true,hasTouch:true}),mobile=await mobileContext.newPage();
 mobile.on('pageerror',e=>errors.push(e.message));await mobile.goto(`http://127.0.0.1:${port}`);await mobile.waitForFunction(()=>!!window.orbitalWorkshop);await mobile.evaluate(()=>document.fonts.ready);
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await mobile.screenshot({path:`${output}/06-mobile.png`});await mobile.click('#startButton');
 const forward=await mobile.locator('[data-key="KeyW"]').boundingBox();await mobile.mouse.move(forward.x+forward.width/2,forward.y+forward.height/2);await mobile.mouse.down();await mobile.waitForTimeout(700);await mobile.mouse.up();
 assert.ok((await mobile.evaluate(()=>window.orbitalWorkshop.getSnapshot().vel[2]))<0);
 await mobile.screenshot({path:`${output}/07-mobile-flight.png`});
 // Lifting a second finger must not release the control still held by the first.
 const cdp=await mobileContext.newCDPSession(mobile),brake=await mobile.locator('[data-key="Space"]').boundingBox();
 const finger1={x:forward.x+forward.width/2,y:forward.y+forward.height/2,id:1},finger2={x:brake.x+brake.width/2,y:brake.y+brake.height/2,id:2};
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger1]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger1,finger2]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[finger2]});
 await mobile.waitForTimeout(100);
 assert.equal(await mobile.locator('[data-key="KeyW"]').evaluate(el=>el.classList.contains('held')),true);
 assert.equal(await mobile.locator('[data-key="Space"]').evaluate(el=>el.classList.contains('held')),false);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(100);
 assert.equal(await mobile.locator('[data-key="KeyW"]').evaluate(el=>el.classList.contains('held')),false);
 assert.deepEqual(errors,[]);assert.deepEqual(outsideRequests,[]);
 console.log('Responsive touch control, no console errors, no external runtime requests: passed');
 console.log('ALL BROWSER CHECKS PASSED');
} catch(error){if(testPage)await testPage.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally {await browser?.close();server.kill();}
