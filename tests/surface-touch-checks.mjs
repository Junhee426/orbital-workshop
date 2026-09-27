import assert from 'node:assert/strict';
export async function checkMobileControls(browser,root,base,errors=[]){
 const context=await browser.newContext({viewport:{width:360,height:640},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 try{
  const page=await context.newPage(),cdp=await context.newCDPSession(page);
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const state=()=>page.evaluate(()=>window.surfaceCourier.getSnapshot()),controls=()=>page.evaluate(()=>window.surfaceCourier.getControls());
  // Callers describe remaining active fingers. CDP touchEnd takes the released fingers.
  let active=new Map();
  const send=async(type,points)=>{
   const next=new Map(points.map(p=>[p.id,p]));
   const changed=type==='touchStart'?points.filter(p=>!active.has(p.id)):type==='touchEnd'?[...active.values()].filter(p=>!next.has(p.id)):points;
   await cdp.send('Input.dispatchTouchEvent',{type,touchPoints:changed});active=type==='touchCancel'?new Map():next;
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  };
  const point=async(selector,id)=>{const r=await page.locator(selector).boundingBox();return {x:r.x+r.width/2,y:r.y+r.height/2,id};};
  async function layout(){
   const boxes=await page.evaluate(()=>['.objective','.map-panel','.vitals','#loadout','#moveStick','.touch-actions','.bottom-center','.look-hint'].map(selector=>{
    const el=document.querySelector(selector),r=el.getBoundingClientRect();return {selector,x:r.x,y:r.y,w:r.width,h:r.height,visible:!el.hidden&&getComputedStyle(el).display!=='none'};
   }).filter(b=>b.visible));
   const size=page.viewportSize();
   for(const b of boxes)assert.ok(b.x>=0&&b.y>=0&&b.x+b.w<=size.width+1&&b.y+b.h<=size.height+1,`offscreen ${JSON.stringify(b)} at ${JSON.stringify(size)}`);
   for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
    const a=boxes[i],b=boxes[j];assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),`overlap ${a.selector} ${b.selector} at ${JSON.stringify(size)}`);
   }
   const buttons=await page.locator('.touch-actions button').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {id:e.id,x:r.x,y:r.y,w:r.width,h:r.height};}));
   for(const b of buttons)assert.ok(b.w>=48&&b.h>=48,`undersized touch target ${b.id}`);
   for(let i=0;i<buttons.length;i++)for(let j=i+1;j<buttons.length;j++){
    const a=buttons[i],b=buttons[j];assert.ok(!(a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y),`action overlap ${a.id} ${b.id}`);
   }
  }
  await page.goto(`${base}/surface.html`);await page.waitForFunction(()=>!!window.surfaceCourier);await page.tap('#begin');
  await layout();await page.screenshot({path:`${root}test-results/surface-mobile-load.png`});
  await page.tap('#touchInteract');assert.equal((await state()).stage,'delivery');assert.equal(await page.locator('#touchInteract').isDisabled(),true);
  const center=await point('#moveStick',1),initial=await state();
  await send('touchStart',[center]);await send('touchMove',[{...center,x:center.x+3}]);
  assert.equal((await controls()).x,0);await page.waitForTimeout(180);assert.equal((await state()).z,initial.z,'dead zone must not move');
  const half={...center,y:center.y-23};await send('touchMove',[half]);
  assert.ok((await controls()).y<-.3&&(await controls()).y>-.65,'proportional analog input');
  await page.waitForFunction(z=>window.surfaceCourier.getSnapshot().z<z-.1,initial.z,{timeout:15000});
  let move={...center,y:center.y-44};await send('touchMove',[move]);
  let look={id:2,x:270,y:340};const yaw=(await state()).cameraYaw;
  await send('touchStart',[move,look]);
  await page.waitForFunction(()=>window.surfaceCourier.getControls().lookingPointer!==null);
  look={...look,x:310,y:347};await send('touchMove',[move,look]);
  await page.waitForFunction(yaw=>Math.abs(window.surfaceCourier.getSnapshot().cameraYaw-yaw)>.1,yaw,{timeout:5000});
  assert.ok(Math.abs((await state()).cameraYaw-yaw)>.1,'second finger rotates camera while walking');
  await send('touchEnd',[move]);assert.equal((await controls()).lookingPointer,null);assert.notEqual((await controls()).movingPointer,null);
  const continued=await state();await page.waitForFunction(s=>{const n=window.surfaceCourier.getSnapshot();return Math.hypot(n.x-s.x,n.z-s.z)>.1;},continued,{timeout:15000});
  look={id:2,x:260,y:340};await send('touchStart',[move,look]);await send('touchEnd',[look]);
  assert.equal((await controls()).movingPointer,null);assert.notEqual((await controls()).lookingPointer,null);
  const stopped=await state();look={...look,x:290};await send('touchMove',[look]);assert.ok(Math.abs((await state()).cameraYaw-stopped.cameraYaw)>.05,'releasing joystick does not cancel camera');
  await page.waitForTimeout(180);assert.equal((await state()).z,stopped.z);await send('touchEnd',[]);
  console.log('Analog speed, dead zone, concurrent movement/look and independent release passed');
  await send('touchStart',[center]);await send('touchMove',[move]);
  const sprint=await point('#touchSprint',3);await send('touchStart',[move,sprint]);await send('touchEnd',[move]);
  assert.equal((await controls()).sprint,true);assert.notEqual((await controls()).movingPointer,null,'action tap preserves joystick');
  const brace=await point('#touchBrace',3);await send('touchStart',[move,brace]);await send('touchEnd',[move]);
  assert.equal((await controls()).brace,true);assert.equal((await controls()).sprint,false);
  await send('touchCancel',[]);assert.equal((await controls()).movingPointer,null);assert.equal((await controls()).sprint,false);
  await page.tap('#touchBrace');await page.tap('#centerCamera');assert.equal((await state()).cameraYaw,(await state()).heading);
  await send('touchStart',[center]);await send('touchMove',[move]);
  const pause=await point('#pause',3);await send('touchStart',[move,pause]);await send('touchEnd',[move]);
  assert.equal((await state()).paused,true);assert.equal((await controls()).movingPointer,null);assert.equal((await controls()).lookingPointer,null);await send('touchCancel',[]);
  await page.locator('#lookSensitivity').evaluate(el=>{el.value='1.7';el.dispatchEvent(new Event('input',{bubbles:true}));});assert.equal((await controls()).sensitivity,1.7);
  await page.tap('#resume');await page.screenshot({path:`${root}test-results/surface-mobile.png`});
  const start=await point('#moveStick',1);await send('touchStart',[start]);await send('touchMove',[{...start,y:start.y-44}]);
  await page.setViewportSize({width:800,height:450});await page.waitForTimeout(120);
  assert.equal((await controls()).movingPointer,null,'orientation clears stick');assert.equal((await controls()).lookingPointer,null);await send('touchCancel',[]);
  await layout();await page.screenshot({path:`${root}test-results/surface-landscape.png`});
  for(const viewport of [{width:640,height:360},{width:430,height:932},{width:320,height:568}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(120);await layout();
   await page.tap('#pause');await page.tap('#restart');await layout();await page.tap('#touchInteract');
  }
  await page.reload();await page.waitForFunction(()=>!!window.surfaceCourier);assert.equal((await controls()).sensitivity,1.7);assert.equal((await controls()).x,0);assert.equal((await controls()).y,0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  console.log('Action multitouch, cancellation, pause, recenter, sensitivity persistence and five viewport layouts passed');
 }finally{await context.close();}
}
