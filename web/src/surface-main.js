import {SurfaceGame} from './surface-game.js';
import {SurfaceScene} from './surface-scene.js';
import {AnalogStick,cameraRelative} from './surface-controls.js';
import {DEPOT,RELAY,SHELTER,ROUTES,clamp} from './surface-world.js';
const $=id=>document.getElementById(id);
let game=new SurfaceGame(),scene,started=false,last=0,accumulator=0,uiTime=0,wasComplete=false;
const keys=new Set(),stick=new AnalogStick();let touchSprint=false,touchBrace=false,drag=null;
const stickPad=$('moveStick'),knob=$('stickKnob'),actionCancels=new Set();
let sensitivity=1;
try{const value=Number(localStorage.getItem('orbital-surface-camera-sensitivity'));if(value>=.5&&value<=2)sensitivity=value;}catch{}
const dialog=$('pauseDialog');
const paused=()=>!started||dialog.open||document.hidden;
function paintStick(){
 knob.style.transform=`translate(${stick.knobX}px,${stick.knobY}px)`;
 stickPad.classList.toggle('active',stick.pointer!==null);
 $('stickState').textContent=stick.pointer===null?'이동':Math.hypot(stick.x,stick.y)<.01?'중립':touchBrace?'천천히':touchSprint?'달리기':'걷기';
}
function clearInput(){
 keys.clear();const moveId=stick.pointer,lookId=drag?.id;stick.reset();drag=null;touchSprint=false;touchBrace=false;
 if(moveId!==null&&stickPad.hasPointerCapture(moveId))stickPad.releasePointerCapture(moveId);
 const canvas=$('terrain');if(lookId!==undefined&&canvas.hasPointerCapture(lookId))canvas.releasePointerCapture(lookId);
 for(const cancel of actionCancels)cancel();
 paintStick();updateToggles();
}
// A secondary touch does not reliably generate a click while the primary thumb moves.
// Activate touch actions on their own pointerup and suppress the compatibility click.
function bindTouchAction(button,action){
 let pointer=null,suppressUntil=0;
 const cancel=()=>{
  const id=pointer;pointer=null;button.classList.remove('touch-held');
  if(id!==null&&button.hasPointerCapture(id))button.releasePointerCapture(id);
 };
 actionCancels.add(cancel);
 button.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'||button.disabled||pointer!==null)return;
  e.preventDefault();pointer=e.pointerId;button.setPointerCapture(pointer);button.classList.add('touch-held');
 });
 button.addEventListener('pointerup',e=>{
  if(e.pointerId!==pointer)return;
  const r=button.getBoundingClientRect(),inside=e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom;
  suppressUntil=performance.now()+750;cancel();e.preventDefault();
  if(inside&&!button.disabled)action();
 });
 for(const event of ['pointercancel','lostpointercapture'])button.addEventListener(event,e=>{if(e.pointerId===pointer)cancel();});
 button.addEventListener('click',e=>{
  if(e.pointerType==='touch'||(e.detail>0&&performance.now()<suppressUntil)){e.preventDefault();return;}
  action();
 });
}
function openPause(){if(!started||game.stage==='complete')return;clearInput();if(!dialog.open)dialog.showModal();}
function reset(){clearInput();game=new SurfaceGame();wasComplete=false;scene.yaw=0;started=true;$('complete').hidden=true;$('briefing').hidden=true;$('hud').hidden=false;if(dialog.open)dialog.close();renderUI();}
$('begin').onclick=()=>{started=true;$('briefing').hidden=true;$('hud').hidden=false;renderUI();$('terrain').focus();};
bindTouchAction($('pause'),openPause);$('restart').onclick=reset;$('again').onclick=reset;
// Input is cleared when the dialog opens and ignored while it is open. Chrome dispatches close on a
// later frame, so clearing here would drop keys or a stick touch that arrived right after closing.
dialog.addEventListener('close',()=>{accumulator=0;});
dialog.addEventListener('keydown',e=>{
 if(e.key!=='Tab')return;
 const items=[...dialog.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled)')],first=items[0],last=items.at(-1);
 if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
 else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
});
const interact=()=>{if(!paused()&&game.stage!=='complete')game.interact();renderUI();};
$('interact').onclick=interact;bindTouchAction($('touchInteract'),interact);
for(const [id,mass] of [['lightLoad',18],['heavyLoad',32]])$(id).onclick=()=>{game.setLoad(mass);renderUI();};
for(const route of ['valley','ridge'])$(route).onclick=()=>{game.setRoute(route);renderUI();};
const controls=['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ArrowDown','ArrowRight','Space','ShiftLeft','ShiftRight'];
window.addEventListener('keydown',e=>{
 if(e.code==='Escape'){if(started&&!dialog.open){e.preventDefault();openPause();}return;}
 if(paused()||game.stage==='complete')return;
 if(controls.includes(e.code)){e.preventDefault();keys.add(e.code);}
 if(e.code==='KeyE'&&!e.repeat){e.preventDefault();game.interact();renderUI();}
});
window.addEventListener('keyup',e=>keys.delete(e.code));
window.addEventListener('blur',()=>{clearInput();if(started)openPause();});
document.addEventListener('visibilitychange',()=>{clearInput();if(document.hidden&&started)openPause();});
window.addEventListener('resize',clearInput);
const available=()=>!paused()&&game.stage!=='complete';
stickPad.addEventListener('pointerdown',e=>{
 if(!available()||e.button>0)return;
 const r=stickPad.getBoundingClientRect();
 if(!stick.start(e.pointerId,r.x+r.width/2,r.y+r.height/2,r.width*.32))return;
 e.preventDefault();stickPad.setPointerCapture(e.pointerId);stick.move(e.pointerId,e.clientX,e.clientY);paintStick();
});
stickPad.addEventListener('pointermove',e=>{if(stick.move(e.pointerId,e.clientX,e.clientY)){e.preventDefault();paintStick();}});
for(const event of ['pointerup','pointercancel','lostpointercapture'])stickPad.addEventListener(event,e=>{
 if(stick.end(e.pointerId)){touchSprint=false;paintStick();updateToggles();}
});
bindTouchAction($('touchSprint'),()=>{if(!available())return;touchSprint=!touchSprint;if(touchSprint)touchBrace=false;updateToggles();paintStick();});
bindTouchAction($('touchBrace'),()=>{if(!available())return;touchBrace=!touchBrace;if(touchBrace)touchSprint=false;updateToggles();paintStick();});
bindTouchAction($('centerCamera'),()=>{if(available()){scene.yaw=game.heading;scene.pitch=.31;}});
function updateToggles(){
 $('touchSprint').setAttribute('aria-pressed',String(touchSprint));$('touchBrace').setAttribute('aria-pressed',String(touchBrace));
 $('touchSprint').querySelector('small').textContent=touchSprint?'ON':'OFF';
 $('touchBrace').querySelector('small').textContent=touchBrace?'ON':'OFF';
}
$('lookSensitivity').value=String(sensitivity);$('sensitivityValue').textContent=`${Math.round(sensitivity*100)}%`;
$('lookSensitivity').addEventListener('input',e=>{
 sensitivity=clamp(Number(e.target.value)||1,.5,2);$('sensitivityValue').textContent=`${Math.round(sensitivity*100)}%`;
 try{localStorage.setItem('orbital-surface-camera-sensitivity',String(sensitivity));}catch{}
});
const canvas=$('terrain');canvas.tabIndex=-1;
canvas.addEventListener('pointerdown',e=>{
 if(!available()||drag||e.button>0||(e.pointerType==='touch'&&e.clientX<innerWidth*.45))return;
 drag={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove',e=>{
 if(!drag||e.pointerId!==drag.id||!available())return;
 scene.orbit((e.clientX-drag.x)*sensitivity,(e.clientY-drag.y)*sensitivity);drag.x=e.clientX;drag.y=e.clientY;
});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,e=>{if(drag?.id===e.pointerId)drag=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(scene)scene.zoom=clamp(scene.zoom+e.deltaY*.008,5,12);},{passive:false});
canvas.addEventListener('contextmenu',e=>e.preventDefault());stickPad.addEventListener('contextmenu',e=>e.preventDefault());
function input(){
 const pressed=(a,b)=>keys.has(a)||keys.has(b);
 const x=Number(pressed('KeyD','ArrowRight'))-Number(pressed('KeyA','ArrowLeft'))+stick.x;
 const forward=Number(pressed('KeyW','ArrowUp'))-Number(pressed('KeyS','ArrowDown'))-stick.y;
 return {...cameraRelative(x,forward,scene.yaw),sprint:keys.has('ShiftLeft')||keys.has('ShiftRight')||touchSprint,brace:keys.has('Space')||touchBrace};
}
const map=$('map'),ctx=map.getContext('2d');
function drawMap(){
 const at=p=>[100+p.x*1.1,18+(p.z+115)*1.15];
 ctx.clearRect(0,0,200,224);ctx.lineWidth=.5;ctx.strokeStyle='#bdd7c31a';
 for(let i=0;i<7;i++){ctx.beginPath();ctx.ellipse(116,95,12+i*9,20+i*11,-.2,0,Math.PI*2);ctx.stroke();}
 for(const [id,route] of Object.entries(ROUTES)){
  ctx.beginPath();route.forEach((p,i)=>{const [x,y]=at(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.strokeStyle=id===game.route?'#b1ecc7':'#b6c8b64a';ctx.lineWidth=id===game.route?2:1;ctx.setLineDash(id==='ridge'?[3,4]:[]);ctx.stroke();ctx.setLineDash([]);
 }
 ctx.font='10px Pretendard, sans-serif';
 for(const [point,label] of [[DEPOT,'보급소'],[SHELTER,'쉼터'],[RELAY,'중계소']]){
  const [x,y]=at(point);ctx.fillStyle='#d0e6d2';ctx.fillRect(x-3,y-3,6,6);ctx.fillText(label,x+7,y+3);
 }
 const [x,y]=at(game);ctx.save();ctx.translate(x,y);ctx.rotate(-game.heading);ctx.beginPath();ctx.moveTo(0,-6);ctx.lineTo(4,5);ctx.lineTo(0,3);ctx.lineTo(-4,5);ctx.closePath();ctx.fillStyle='#f6b380';ctx.fill();ctx.restore();
 ctx.fillStyle='#b7d0c0';ctx.font='9px Pretendard, sans-serif';ctx.fillText('N ↑',9,16);
}
function text(id,value){const el=$(id),v=String(value);if(el.textContent!==v)el.textContent=v;}
function renderUI(){
 const complete=game.stage==='complete';
 if(complete&&!wasComplete){
  wasComplete=true;clearInput();$('hud').hidden=true;$('complete').hidden=false;
  text('finalCondition',`${Math.round(game.condition)}%`);text('finalTime',`${Math.floor(game.elapsed/60)}:${String(Math.floor(game.elapsed%60)).padStart(2,'0')}`);text('finalConnections',game.shelterUsed?'2 / 2':'1 / 2');$('again').focus();
 }
 $('pause').hidden=!started||complete;
 text('phase',game.stage==='pickup'?'01 / LOAD UP':'02 / CROSS THE VALLEY');
 text('objectiveCopy',game.stage==='pickup'?'보급소에서 배터리를 적재하세요.':'배터리를 북쪽 중계소에 전달하세요.');
 text('distance',Math.round(game.remaining));text('destinationName',game.stage==='pickup'?'보급소':'중계소');
 $('loadout').hidden=game.stage!=='pickup';
 for(const [id,mass] of [['lightLoad',18],['heavyLoad',32]])$(id).setAttribute('aria-pressed',String(game.mass===mass));
 for(const route of ['valley','ridge'])$(route).setAttribute('aria-pressed',String(game.route===route));
 text('routeNote',game.route==='valley'?'완만한 우회로 · 쉼터 경유':'짧은 능선길 · 균형에 주의');
 for(const id of ['stamina','balance']){$(id).value=game[id];text(`${id}Value`,Math.round(game[id]));}
 text('cargoLabel',game.stage==='pickup'?'적재 대기':`${game.mass} kg 적재`);text('condition',game.stage==='pickup'?'화물 —':`화물 ${Math.round(game.condition)}%`);
 text('terrainState',game.bracing?'짐을 붙잡고 이동 중':game.balance<40?'균형 위험 · 짐을 붙잡으세요':game.slope>.35?'가파른 경사 · 천천히 이동':'완만한 지형');
 text('radio',game.notice);
 const action=game.interaction;
 $('touchInteract').disabled=!action;
 $('touchInteract').setAttribute('aria-label',action||'주변에 상호작용 대상이 없습니다');
 text('touchActionLabel',action?(game.stage==='pickup'?'적재':game.remaining<7?'연결':'휴식'):'작업');
 text('touchActionHint',action?'탭하여 실행':'거점에 접근');
 $('interact').hidden=!action;if(action&&$('interact').dataset.action!==action){$('interact').replaceChildren(document.createTextNode(action+' '));const k=document.createElement('kbd');k.textContent='E';$('interact').append(k);$('interact').dataset.action=action;}
 drawMap();
 const projected=scene.project(game.guide),waypoint=$('waypoint');waypoint.hidden=!projected.visible||game.stage==='complete'||game.remaining<9;
 waypoint.style.left=`${clamp(projected.x,innerWidth>800?340:30,innerWidth>800?innerWidth-240:innerWidth-30)}px`;waypoint.style.top=`${clamp(projected.y,innerWidth>800?150:280,innerHeight-170)}px`;
 waypoint.querySelector('small').textContent=game.stage==='delivery'&&game.guide!==RELAY?'다음 경로 표식':'중계소';
}
function frame(ms){
 const dt=Math.min(.1,last?(ms-last)/1000:.016);last=ms;
 if(!paused()){
  accumulator+=dt;while(accumulator>=1/60){game.tick(1/60,input());accumulator-=1/60;}
 }else accumulator=0;
 if(!document.hidden){scene.update(game,dt,started);uiTime+=dt;if(uiTime>.09){renderUI();uiTime=0;}}
 requestAnimationFrame(frame);
}
try{
 scene=new SurfaceScene(canvas);$('boot').hidden=true;renderUI();
 // Read-only telemetry for browser verification and diagnostics.
 window.surfaceCourier=Object.freeze({getSnapshot:()=>({...game.snapshot(),paused:paused(),heading:game.heading,cameraYaw:scene.yaw}),getControls:()=>({x:stick.x,y:stick.y,movingPointer:stick.pointer,lookingPointer:drag?.id??null,sprint:touchSprint,brace:touchBrace,sensitivity})});
 requestAnimationFrame(frame);
}catch(error){console.error(error);$('boot').textContent='3D 화면을 시작하지 못했습니다. WebGL 2를 지원하는 브라우저에서 다시 열어주세요.';}
