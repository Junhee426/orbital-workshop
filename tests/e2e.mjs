// Optional browser test. Run after installing Playwright and its Chromium.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {Mission} from '../web/src/mission.js';
import {encodeSave} from '../web/src/storage.js';
import {CONTRACTS} from '../web/src/contracts.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=fileURLToPath(new URL('../',import.meta.url));
const output=process.env.ORBITAL_SCREENSHOT_DIR||`${root}test-results`;
await mkdir(output,{recursive:true});
const port=process.env.ORBITAL_TEST_PORT||'8123';
const server=spawn(process.env.PYTHON||(process.platform==='win32'?'python':'python3'),['server.py','--port',port],{cwd:root});
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
 const saveKey='orbital-workshop-save-v1',broken='{broken save';
 // Seed before app initialization; a running page legitimately saves on pagehide.
 await context.addInitScript(({saveKey,broken})=>{
  if(localStorage.getItem(saveKey)===null)localStorage.setItem(saveKey,broken);
 },{saveKey,broken});
 await go();console.log('Initial render ready');await page.screenshot({path:`${output}/01-home.png`});
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),saveKey),broken);
 await page.reload();await page.waitForFunction(()=>!!window.orbitalWorkshop);
 assert.equal(await page.evaluate(key=>localStorage.getItem(key),saveKey),broken,'reload/pagehide must preserve a broken save');
 await page.click('#startButton');
 assert.equal(await page.evaluate(({saveKey,broken})=>Object.keys(localStorage).some(key=>key.startsWith(`${saveKey}-recovery-`)&&localStorage.getItem(key)===broken),{saveKey,broken}),true);
 await page.keyboard.press('f');assert.equal((await state()).stage,'approach');
 await page.screenshot({path:`${output}/02-approach.png`});
 console.log('Boot/render, save recovery and premature capture: passed');
 await page.click('#helpButton');
 const helpTime=(await state()).elapsed;
 assert.equal(await page.locator('#helpOverlay').evaluate(el=>el.matches(':modal')),true);
 for(let i=0;i<8;i++){
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#helpOverlay')),true,'focus must stay inside help');
 }
 await page.keyboard.press('Shift+Tab');
 assert.equal(await page.evaluate(()=>!!document.activeElement.closest('#helpOverlay')),true);
 await page.screenshot({path:`${output}/09-help.png`});
 await page.waitForTimeout(200);assert.equal((await state()).elapsed,helpTime);
 await page.keyboard.press('Escape');
 assert.equal(await page.evaluate(()=>document.activeElement.id),'helpButton');
 assert.equal(await page.evaluate(()=>window.orbitalWorkshop.getStatus().paused),false);
 await page.keyboard.press('Escape');await page.keyboard.press('h');await page.keyboard.press('Escape');
 assert.equal(await page.locator('#pauseOverlay').evaluate(el=>el.matches(':modal')),true);
 assert.equal(await page.evaluate(()=>window.orbitalWorkshop.getStatus().paused),true);
 await page.keyboard.press('Escape');
 console.log('Modal focus containment and nested pause restoration: passed');
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

 await page.keyboard.press('Escape');await page.click('#homeButton');
 assert.equal(await page.locator('[data-contract="battery"]').isDisabled(),false);
 assert.equal(await page.locator('[data-contract="antenna"]').isDisabled(),true);
 const importFile=async(target,contents)=>{
  await target.locator('#importFile').setInputFiles({name:'progress.json',mimeType:'application/json',buffer:Buffer.from(contents)});
  await target.waitForFunction(()=>!document.getElementById('confirmImport').disabled);
 };
 const originalProfile=await page.evaluate(()=>window.orbitalWorkshop.getProfile());
 await page.locator('#importFile').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{invalid')});
 await page.waitForFunction(()=>document.getElementById('importError').textContent.length>0);
 assert.equal(await page.locator('#confirmImport').isDisabled(),true);await page.click('#cancelImport');
 assert.deepEqual(await page.evaluate(()=>window.orbitalWorkshop.getProfile()),originalProfile);
 for(const id of ['battery','antenna']){
  await page.click(`[data-contract="${id}"]`);await page.click('#startButton');assert.equal((await state()).contractId,id);
  await page.keyboard.press('Escape');await page.click('#homeButton');
  const fixture=new Mission({contractId:id,precision:true});fixture.pos=fixture.dockPosition();assert.equal(fixture.capture(),true);
  const profile=await page.evaluate(()=>window.orbitalWorkshop.getProfile());
  await importFile(page,encodeSave(profile,fixture));
  assert.match(await page.locator('#importSummary').textContent(),new RegExp(CONTRACTS[id].title));
  await page.click('#confirmImport');await page.click('#continueButton');await stage('survey');
  for(const part of CONTRACTS[id].scans){await page.click(`[data-select-part="${part}"]`);await page.click('#actionButton');await page.waitForFunction(part=>window.orbitalWorkshop.getSnapshot().scanned[part],part);}
  await stage('diagnose');await page.click(`[data-diagnosis="${CONTRACTS[id].answer}"]`);await stage('isolate');
  await page.click('[data-select-part="power"]');await page.click('#actionButton');await stage('brace');
  await page.click('[data-select-part="brace"]');await page.click('#actionButton');await stage('release');
  await page.click(`[data-select-part="${id}"]`);
  if(id==='antenna'){await page.locator('#torque').focus();await page.keyboard.press('Home');for(let i=0;i<72;i++)await page.keyboard.press('ArrowRight');}
  else assert.equal(await page.locator('#torqueControl').isVisible(),false);
  await page.screenshot({path:`${output}/10-${id}-repair.png`});
  await page.keyboard.down('f');await stage('restore');await page.keyboard.up('f');
  await page.click('[data-select-part="power"]');await page.click('#actionButton');await stage('test');await page.click('#actionButton');await stage('complete');
  await page.waitForFunction(()=>window.orbitalWorkshop.getStatus().mode==='result');await page.click('#returnButton');
  assert.equal(await page.evaluate(id=>window.orbitalWorkshop.getProfile().completedContracts.includes(id),id),true);
 }
 await page.click('[data-upgrade="efficiency"]');await page.click('[data-upgrade="shield"]');
 await page.click('[data-contract="antenna"]');await page.click('#startButton');
 assert.equal((await state()).efficiency,true);assert.equal((await state()).shield,true);
 await page.keyboard.press('Escape');await page.click('#homeButton');
 const downloadPromise=page.waitForEvent('download');await page.click('#homeExportButton');const download=await downloadPromise;
 assert.equal(download.suggestedFilename(),'orbital-workshop-save.json');
 console.log('Contract unlocks, all repair types, equipment, invalid import and export: passed');

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

 await mobile.click('#fineButton');assert.equal(await mobile.locator('#fineButton').getAttribute('aria-pressed'),'true');
 const beforeYaw=await mobile.evaluate(()=>window.orbitalWorkshop.getSnapshot().yaw);
 const turn=await mobile.locator('[data-key="ArrowLeft"]').boundingBox();await mobile.mouse.move(turn.x+turn.width/2,turn.y+turn.height/2);await mobile.mouse.down();await mobile.waitForTimeout(400);await mobile.mouse.up();
 assert.ok((await mobile.evaluate(()=>window.orbitalWorkshop.getSnapshot().yaw))>beforeYaw);
 await mobile.click('#dismissTutorial');await mobile.keyboard.press('Escape');await mobile.click('#homeButton');
 const mp=await mobile.evaluate(()=>window.orbitalWorkshop.getProfile()),mg=new Mission({contractId:'antenna'});mg.pos=mg.dockPosition();mg.capture();
 await importFile(mobile,encodeSave(mp,mg));await mobile.click('#confirmImport');await mobile.click('#continueButton');
 await mobile.click('[data-select-part="antenna"]');assert.equal(await mobile.evaluate(()=>window.orbitalWorkshop.getStatus().selected),'antenna');
 await mobile.setViewportSize({width:360,height:640});await mobile.screenshot({path:`${output}/11-mobile-small.png`});
 assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 const tray=await mobile.locator('#partPicker').boundingBox();assert.ok(tray.x>=0&&tray.x+tray.width<=360&&tray.y+tray.height<=640);
 console.log('Mobile fine control, attitude, import and small-screen component tray: passed');

 await mobile.keyboard.press('Escape');await mobile.click('#homeButton');await mobile.click('#startButton');
 await mobile.setViewportSize({width:800,height:450});
 assert.equal(await mobile.locator('#touchControls').isVisible(),true,'landscape touch controls remain available');
 const touchBox=await mobile.locator('#touchControls').boundingBox(),actionBox=await mobile.locator('.action-panel').boundingBox();
 assert.ok(touchBox.x+touchBox.width<=actionBox.x,'landscape flight and action controls must not overlap');
 await mobile.screenshot({path:`${output}/12-mobile-landscape.png`});

 await context.close();await mobileContext.close();

 const standalone=await browser.newPage({viewport:{width:1000,height:800}}),standaloneRequests=[];
 standalone.on('pageerror',error=>errors.push(error.message));
 standalone.on('request',request=>{if(/^https?:/.test(request.url()))standaloneRequests.push(request.url());});
 await standalone.goto(new URL('../PLAY.html',import.meta.url).href);
 await standalone.waitForFunction(()=>!!window.orbitalWorkshop);
 await standalone.click('#startButton');await standalone.keyboard.press('h');
 assert.equal(await standalone.locator('#helpOverlay').evaluate(el=>el.matches(':modal')),true);
 await standalone.keyboard.press('Escape');
 assert.equal(await standalone.evaluate(()=>window.orbitalWorkshop.getStatus().paused),false);
 assert.deepEqual(errors,[]);assert.deepEqual(standaloneRequests,[]);
 console.log('Standalone file launch and modal controls: passed');
 console.log('ALL BROWSER CHECKS PASSED');
} catch(error){if(testPage)await testPage.screenshot({path:`${output}/failure.png`}).catch(()=>{});throw error;}
finally {await browser?.close();server.kill();}
