import {World} from './scene.js';
import {Mission,STAGES,labels,clamp} from './mission.js';
import {SAVE_KEY,freshProfile,decodeSave,encodeSave,award,purchasePrecision} from './storage.js';
import {Sound} from './audio.js';

const $=id=>document.getElementById(id),all=q=>[...document.querySelectorAll(q)];
const world=new World($('space')),sound=new Sound();
let profile=freshProfile(),game=new Mission(),hasActive=false,mode='home',paused=false,selected='drive';
let repairHeld=false,lastSave=0,saveAvailable=true,helpWasPaused=false,toastTimer;
const keys=new Set(),touchKeys=new Set(),touchPointers=new Map();
let repairPointer=null;
function clearTouch(){touchKeys.clear();touchPointers.clear();repairPointer=null;all('[data-key]').forEach(b=>b.classList.remove('held'));}
try {const saved=decodeSave(localStorage.getItem(SAVE_KEY));if(saved){profile=saved.profile;if(saved.mission){game=saved.mission;hasActive=true;award(profile,game);}}}catch{saveAvailable=false;}
const setText=(id,text)=>{if($(id).textContent!==String(text))$(id).textContent=text;};
const timeLabel=n=>`${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`;
const rewardFor=g=>400+Math.max(0,100-g.impacts*15-g.rescues*25);
function toast(text){setText('toast',text);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3300);}
function save(){
 try{localStorage.setItem(SAVE_KEY,encodeSave(profile,hasActive?game:null));saveAvailable=true;setText('saveStatus','이 브라우저에 자동 저장');}
 catch{if(saveAvailable)toast('자동 저장을 사용할 수 없습니다. 일시정지 메뉴에서 진행 파일을 내려받으세요.');saveAvailable=false;setText('saveStatus','자동 저장 불가 · 진행 파일을 내려받으세요');}
}
function updateHome(){
 $('home').hidden=!['home','hangar'].includes(mode);$('homeFooter').hidden=$('home').hidden;$('homeSceneLabel').hidden=$('home').hidden;
 $('hud').hidden=mode!=='play';$('result').hidden=mode!=='result';$('restoredLabel').hidden=mode!=='result';
 $('pauseButton').hidden=mode!=='play';$('workshop').hidden=profile.completed===0;
 $('continueButton').hidden=!hasActive;
 $('continueButton').textContent=game.stage==='complete'?'복구 결과 다시 보기 →':'저장된 작업 이어하기 →';
 if(profile.completed>0){$('homeTitle').innerHTML='다음 궤도가<br><em>기다립니다.</em>';setText('homeCopy',`복구 완료 ${profile.completed}건. 다음 의뢰를 준비해 볼까요?`);}
 setText('credits',`${profile.credits.toLocaleString()} CR`);
 setText('upgradeCost',profile.precision?'장착 완료':'180 CR');
 $('upgradeButton').disabled=profile.precision||profile.credits<180;
 setText('workshopStatus',profile.precision?'다음 출항부터 정밀 추진기가 적용됩니다.':'첫 임무의 보상으로 작업선을 업그레이드할 수 있습니다.');
 setText('topStatus',mode==='play'?'OW-01 / METEO-07 · 근접 작업 중':mode==='result'?'METEO-07 · 서비스 복구 완료':'작은 정비소, 다시 연결되는 세계');
 document.body.dataset.mode=mode;
}
function launch(training=false,resume=false){
 sound.unlock();sound.click();
 if(!resume)game=new Mission({precision:profile.precision,training});
 hasActive=true;mode=game.stage==='complete'?'result':'play';paused=false;selected='drive';repairHeld=false;
 world.orbit={x:0,y:0,zoom:1};keys.clear();clearTouch();$('pauseOverlay').hidden=true;
 $('torque').value=String(Math.round(game.torque*100));
 if(mode==='result')showResult();else{updateHome();renderUI();save();}
}
function showResult(){
 award(profile,game);sound.complete();mode='result';paused=false;repairHeld=false;
 setText('resultTime',timeLabel(game.elapsed));setText('resultReward',`${rewardFor(game)} CR`);updateHome();save();
}
function events(){
 for(const e of game.events.splice(0)){
  if(e.type==='stage'){sound.stage();repairHeld=false;save();}
  if(e.type==='complete')showResult();
 }
 renderUI();
}
function action(){if(mode!=='play'||paused)return;if(game.stage==='release')return;game.act(selected);sound.click();events();}
function selectPart(part){if(mode!=='play'||paused)return;selected=part;repairHeld=false;sound.click();renderUI();}
function pause(value){
 if(mode!=='play')return;paused=value;keys.clear();clearTouch();repairHeld=false;
 $('pauseOverlay').hidden=!paused;setText('pauseButton',paused?'▷':'Ⅱ');$('pauseButton').setAttribute('aria-label',paused?'작업 계속':'일시정지');save();
}
function openHelp(){helpWasPaused=paused;if(mode==='play'){paused=true;keys.clear();clearTouch();repairHeld=false;save();}$('pauseOverlay').hidden=true;$('helpOverlay').hidden=false;}
function closeHelp(){$('helpOverlay').hidden=true;if(mode==='play'){paused=helpWasPaused;$('pauseOverlay').hidden=!paused;}}
const stageHelp={
 approach:'안내 링을 따라 접근 · Space로 제동 · A/D로 좌우 보정',
 survey:'위성의 전원부와 전개부 표식을 각각 선택한 뒤 스캔하세요.',
 diagnose:'오른쪽 측정값을 비교하고 고장의 원인을 선택하세요.',
 isolate:'전원부 표식을 선택하고 구동 전원을 분리하세요.',
 brace:'고정점 표식을 선택해 작업 팔로 전개부를 지지하세요.',
 release:'래치 선택 → 토크 40–60% → F 또는 작업 버튼 길게 누르기',
 restore:'전원부를 선택해 구동 전원을 다시 연결하세요.',
 test:'발전 상태와 신호가 회복되는지 작동 시험을 진행하세요.',
 complete:'기상위성이 정상 서비스를 재개했습니다.'
};
const actionLabels={approach:'포획 시도',survey:'선택 부위 스캔',diagnose:'원인 선택 대기',isolate:'전원 분리',brace:'전개부 고정',release:'길게 눌러 작업',restore:'전원 연결',test:'전개 시험',complete:'복구 완료'};
function renderUI(){
 if(mode!=='play')return;
 document.body.dataset.phase=game.stage;
 const m=game.metrics(),flight=game.stage==='approach',index=STAGES.indexOf(game.stage);
 setText('radioText',game.notice);setText('modeTag',game.training?'회전 표적 훈련':'기본 작업');
 setText('distanceValue',m.distance.toFixed(1));setText('speedValue',m.speed.toFixed(2));setText('angleValue',m.angle.toFixed(1));
 [['distanceCheck',m.distance<1.15,'거리'],['speedCheck',m.speed<.48,'속도'],['angleCheck',m.angle<14&&m.spin<.14,'방향']].forEach(([id,ok,label])=>{$(id).classList.toggle('pass',ok);setText(id,`${ok?'✓':'○'} ${label}`);});
 $('flightData').hidden=!flight;$('repairData').hidden=flight;$('rescueButton').hidden=!flight;
 setText('telemetryTitle',flight?'RELATIVE NAVIGATION':'SYSTEM DIAGNOSTICS');setText('cameraLabel',flight?'CHASE CAM':'TOOL CAM');
 $('touchControls').hidden=!flight;
 setText('assistButton',`자세 보조 ${game.assist?'ON':'OFF'}  · T`);$('assistButton').setAttribute('aria-pressed',String(game.assist));
 setText('fuelValue',`${game.fuel.toFixed(0)}%`);$('fuelBar').style.width=`${game.fuel}%`;setText('integrityValue',`${game.integrity}%`);
 setText('powerScanned',game.scanned.power?'확인 완료':'미확인');setText('driveScanned',game.scanned.drive?'확인 완료':'미확인');
 setText('voltageValue',game.scanned.power?(game.powerOn?'28.2 V · 정상':'0.0 V · 분리됨'):'— V');
 setText('driveValue',game.scanned.drive?(game.panel>.9?'전개 완료 · 발전 정상':game.repaired?'래치 해제 · 시험 대기':'명령 수신 / 위치 고정'):'—');
 setText('powerState',game.powerOn?'연결':'분리');setText('braceState',game.braced?'고정 완료':'대기');
 $('diagnosisChoices').hidden=game.stage!=='diagnose';$('torqueControl').hidden=game.stage!=='release';
 setText('torqueValue',`${Math.round(game.torque*100)}%`);
 const torqueSafe=game.torque>=.4&&game.torque<=.6;
 $('torqueValue').style.color=torqueSafe?'var(--mint)':'var(--orange)';
 setText('torqueHint',torqueSafe?'안전 구간 · 래치 선택 후 작업 버튼을 길게 누르세요.':'안전 구간 40–60% · 게임용 작업 게이지');
 const groupIndex=flight?0:index<=2?1:index<=6?2:3;
 all('#checklist li').forEach((el,i)=>{el.classList.toggle('active',i===groupIndex);el.classList.toggle('done',i<groupIndex);el.firstElementChild.textContent=i<groupIndex?'✓':String(i+1).padStart(2,'0');});
 setText('stepNumber',`STEP ${String(index+1).padStart(2,'0')} / 09`);setText('stageName',labels[game.stage]);setText('stageHint',stageHelp[game.stage]);
 setText('actionLabel',game.job?(game.job.kind==='test'?'기능 시험 중…':'작업 중…'):actionLabels[game.stage]);
 $('actionButton').disabled=Boolean(game.job)||game.stage==='diagnose'||game.stage==='complete';
 if(game.stage==='release')$('actionButton').disabled=selected!=='latch';
 $('actionButton').classList.toggle('ready',m.ready);
 const progress=game.job?game.job.time/game.job.duration:game.stage==='release'?game.repairProgress:0;
 $('taskBar').style.width=`${progress*100}%`;
 all('.part-tag').forEach(el=>el.classList.toggle('selected',el.dataset.part===selected));
}
function updateTags(){
 if(mode!=='play')return;
 const flight=game.stage==='approach';$('targetTag').hidden=!flight;
 if(flight){
  const p=world.project(world.sat.root.localToWorld(world.sat.parts.power.clone().set(0,0,1.5)));
  $('targetTag').style.left=`${clamp(p.x,35,window.innerWidth-100)}px`;$('targetTag').style.top=`${clamp(p.y,150,window.innerHeight-170)}px`;
  setText('targetDistance',`${game.metrics().distance.toFixed(1)} m`);$('targetTag').classList.toggle('ready',game.metrics().ready);
 }
 const allowed={survey:['power','drive'],diagnose:['power','drive'],isolate:['power'],brace:['brace'],release:['latch','brace'],restore:['power'],test:[],complete:[],approach:[]}[game.stage];
 const offset={power:[-38,-28],drive:[50,-42],brace:[60,12],latch:[48,38]};
 for(const el of all('.part-tag')){
  const id=el.dataset.part,p=world.project(world.partPosition(id));el.hidden=!allowed.includes(id)||!p.visible;
  el.style.left=`${clamp(p.x+offset[id][0],50,window.innerWidth-65)}px`;el.style.top=`${clamp(p.y+offset[id][1],155,window.innerHeight-150)}px`;
 }
}

$('startButton').addEventListener('click',()=>launch());$('continueButton').addEventListener('click',()=>launch(false,true));
$('trainingButton').addEventListener('click',()=>launch(true));
$('upgradeButton').addEventListener('click',()=>{if(purchasePrecision(profile)){save();sound.stage();toast('정밀 추진기를 장착했습니다. 다음 출항부터 적용됩니다.');updateHome();}});
$('returnButton').addEventListener('click',()=>{hasActive=false;mode='hangar';save();updateHome();sound.click();});
$('homeButton').addEventListener('click',()=>{paused=false;mode='home';$('pauseOverlay').hidden=true;save();updateHome();});
$('brand').addEventListener('click',e=>{e.preventDefault();if(mode==='play')pause(true);});
$('pauseButton').addEventListener('click',()=>pause(!paused));$('resumeButton').addEventListener('click',()=>pause(false));
$('helpButton').addEventListener('click',openHelp);$('closeHelp').addEventListener('click',closeHelp);$('helpDone').addEventListener('click',closeHelp);
$('soundButton').addEventListener('click',()=>{sound.unlock();sound.enabled=!sound.enabled;setText('soundButton',`소리 ${sound.enabled?'ON':'OFF'}`);$('soundButton').setAttribute('aria-pressed',String(sound.enabled));sound.click();});
$('lowQuality').addEventListener('change',e=>world.setQuality(e.target.checked));
$('assistButton').addEventListener('click',()=>{game.assist=!game.assist;renderUI();});
$('rescueButton').addEventListener('click',()=>{game.rescue();events();save();});
all('.part-tag').forEach(el=>el.addEventListener('click',()=>selectPart(el.dataset.part)));
all('[data-diagnosis]').forEach(el=>el.addEventListener('click',()=>{if(paused)return;game.diagnose(el.dataset.diagnosis);events();}));
$('torque').addEventListener('input',e=>{game.torque=Number(e.target.value)/100;renderUI();});
$('actionButton').addEventListener('click',action);
$('actionButton').addEventListener('pointerdown',e=>{if(game.stage==='release'&&mode==='play'&&!paused){e.currentTarget.setPointerCapture(e.pointerId);repairPointer=e.pointerId;repairHeld=true;sound.click();}});
// Release only what the lifted pointer was holding, so other fingers keep their controls.
const release=e=>{
 if(e.pointerId===repairPointer){repairPointer=null;repairHeld=false;}
 const key=touchPointers.get(e.pointerId);if(!key)return;touchPointers.delete(e.pointerId);
 if(![...touchPointers.values()].includes(key)){touchKeys.delete(key);document.querySelector(`[data-key="${key}"]`)?.classList.remove('held');}
};
document.addEventListener('pointerup',release);document.addEventListener('pointercancel',release);
all('[data-key]').forEach(el=>el.addEventListener('pointerdown',e=>{e.preventDefault();el.setPointerCapture(e.pointerId);touchPointers.set(e.pointerId,el.dataset.key);touchKeys.add(el.dataset.key);el.classList.add('held');}));
$('exportButton').addEventListener('click',()=>{
 const blob=new Blob([encodeSave(profile,hasActive?game:null)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='orbital-workshop-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
});
document.addEventListener('keydown',e=>{
 if(e.code==='Escape'){e.preventDefault();if(!$('helpOverlay').hidden)closeHelp();else pause(!paused);return;}
 if(e.code==='KeyH'&&!e.repeat){$('helpOverlay').hidden?openHelp():closeHelp();return;}
 // Range sliders keep their own arrow/paging keys; game keys like F still work while one has focus.
 if(e.target.matches('input:not([type=range]),textarea,select'))return;
 if(e.target.matches('input[type=range]')&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.code))return;
 if(mode!=='play'||paused)return;
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','KeyF','KeyT','KeyR'].includes(e.code))e.preventDefault();
 keys.add(e.code);
 if(e.repeat)return;
 if(e.code==='KeyF'){if(game.stage==='release')repairHeld=true;else action();}
 if(e.code==='KeyT'){game.assist=!game.assist;renderUI();}
 if(e.code==='KeyR'){game.rescue();events();save();}
});
document.addEventListener('keyup',e=>{keys.delete(e.code);if(e.code==='KeyF')repairHeld=false;});
window.addEventListener('blur',()=>{if(mode==='play'&&!paused)pause(true);keys.clear();clearTouch();repairHeld=false;});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='play')pause(true);});
window.addEventListener('pagehide',save);window.addEventListener('resize',()=>world.resize());
let drag=null;
$('space').addEventListener('contextmenu',e=>e.preventDefault());
$('space').addEventListener('pointerdown',e=>{if(mode!=='play'||paused)return;drag={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);});
$('space').addEventListener('pointermove',e=>{if(!drag)return;world.orbit.x+=(e.clientX-drag.x)*.005;world.orbit.y=clamp(world.orbit.y+(e.clientY-drag.y)*.004,-.3,1);drag={x:e.clientX,y:e.clientY};});
$('space').addEventListener('pointerup',()=>drag=null);$('space').addEventListener('pointercancel',()=>drag=null);
$('space').addEventListener('wheel',e=>{e.preventDefault();world.orbit.zoom=clamp(world.orbit.zoom+e.deltaY*.001,.7,1.65);},{passive:false});
function input(){const down=k=>keys.has(k)||touchKeys.has(k);return{
 forward:Number(down('KeyW'))-Number(down('KeyS')),strafe:Number(down('KeyD'))-Number(down('KeyA')),up:Number(down('KeyE'))-Number(down('KeyQ')),
 yaw:Number(down('ArrowLeft'))-Number(down('ArrowRight')),pitch:Number(down('ArrowUp'))-Number(down('ArrowDown')),brake:down('Space'),slow:down('ShiftLeft')||down('ShiftRight'),repairHeld,part:selected
};}
let previous=performance.now(),accumulator=0,lastUI=0;
function frame(now){
 const dt=Math.min((now-previous)/1000,.08);previous=now;
 if(mode==='play'&&!paused){
  accumulator+=dt;while(accumulator>=1/60){game.tick(1/60,input());accumulator-=1/60;}
  if(game.events.length)events();
  if(now-lastSave>2500){save();lastSave=now;}
 }else accumulator=0;
 world.render(game,mode,selected,paused?0:dt);updateTags();
 if(now-lastUI>80){renderUI();lastUI=now;}
 requestAnimationFrame(frame);
}
// Read-only inspection is useful for support and browser integration tests.
Object.defineProperty(window,'orbitalWorkshop',{value:Object.freeze({getSnapshot:()=>game.snapshot(),getProfile:()=>structuredClone(profile),getStatus:()=>({mode,paused,selected,saveAvailable,renderer:world.renderer.info.render})})});
updateHome();$('boot').hidden=true;save();requestAnimationFrame(frame);
