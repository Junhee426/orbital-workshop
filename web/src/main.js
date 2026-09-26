import {World} from './scene.js';
import {Mission,STAGES,labels,clamp} from './mission.js';
import {SaveStore,freshProfile,encodeSave,decodeSave,MAX_IMPORT_BYTES,award,purchaseUpgrade} from './storage.js';
import {CAPTURE,captureChecks,rewardFor} from './rules.js';
import {CONTRACTS,UPGRADES,PART_NAMES,contractFor,isUnlocked,availableParts,repairIsSafe,repairHint} from './contracts.js';
import {tutorialFor} from './tutorial.js';
import {Sound} from './audio.js';

const $=id=>document.getElementById(id),all=q=>[...document.querySelectorAll(q)];
const world=new World($('space')),sound=new Sound();
let profile=freshProfile(),game=new Mission(),hasActive=false,mode='home',paused=false,selected='drive';
let repairHeld=false,lastSave=0,saveAvailable=true,helpWasPaused=false,toastTimer;
const keys=new Set(),touchKeys=new Set(),touchPointers=new Map();
let repairPointer=null,activeModal=null,selectedContract='solar',fineMode=false,pendingImport=null,importReturnModal=null;
const saves=new SaveStore(()=>localStorage);
function clearTouch(){touchKeys.clear();touchPointers.clear();repairPointer=null;all('[data-key]').forEach(b=>b.classList.remove('held'));}
try {const saved=saves.load();if(saved){profile=saved.profile;if(saved.mission){game=saved.mission;hasActive=true;award(profile,game);}}}catch{/* save() reports the read failure without replacing existing data. */}
const setText=(id,text)=>{if($(id).textContent!==String(text))$(id).textContent=text;};
const timeLabel=n=>`${Math.floor(n/60).toString().padStart(2,'0')}:${Math.floor(n%60).toString().padStart(2,'0')}`;
function toast(text){setText('toast',text);$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,3300);}
function save(){
 try{saves.write(profile,hasActive?game:null);saveAvailable=true;setText('saveStatus','이 브라우저에 자동 저장');}
 catch{
  const message=saves.blocked?'저장 데이터를 읽지 못해 원본을 보호하고 있습니다. 새 작업을 시작하면 원본을 별도로 보관합니다.':'자동 저장을 사용할 수 없습니다. 일시정지 메뉴에서 진행 파일을 내려받으세요.';
  if(saveAvailable)toast(message);saveAvailable=false;
  setText('saveStatus',saves.blocked?'기존 저장 보호 중 · 새 작업 시작 시 원본 보관':'자동 저장 불가 · 진행 파일을 내려받으세요');
 }
}
function updateHome(){
 const config=contractFor(selectedContract);world.previewContract=selectedContract;
 $('home').hidden=!['home','hangar'].includes(mode);$('homeFooter').hidden=$('home').hidden;$('homeSceneLabel').hidden=$('home').hidden;
 $('hud').hidden=mode!=='play';$('result').hidden=mode!=='result';$('restoredLabel').hidden=mode!=='result';
 $('pauseButton').hidden=mode!=='play';$('workshop').hidden=profile.completed===0;$('continueButton').hidden=!hasActive;
 setText('continueButton',game.stage==='complete'?'지난 정비 결과 다시 보기 →':`저장된 ${contractFor(game.contractId).number}번 작업 이어하기 →`);
 setText('contractTitle',config.title);setText('contractSatellite',`${config.satellite} · ${config.repairName}`);
 setText('contractNumber',config.number);setText('contractCopy',config.description);setText('sceneSatellite',config.satellite);
 setText('contractReward',`${config.baseReward}–${config.baseReward+100} CR`);
 const best=profile.bestTimes[selectedContract];
 setText('contractProgress',best!==undefined?`완료한 의뢰 · 최고 기록 ${timeLabel(best)}`:`${profile.completedContracts.length} / 3 의뢰 완료 · 완료하면 다음 의뢰가 열립니다.`);
 for(const button of all('[data-contract]')){
  const id=button.dataset.contract,unlocked=isUnlocked(profile,id);
  button.disabled=!unlocked;button.setAttribute('aria-pressed',String(id===selectedContract));
  button.title=unlocked?CONTRACTS[id].title:`${CONTRACTS[CONTRACTS[id].prerequisite].title} 완료 후 열립니다.`;
  button.textContent=`${CONTRACTS[id].number} ${unlocked?CONTRACTS[id].repairName:'잠김'}`;
 }
 setText('credits',`${profile.credits.toLocaleString()} CR`);
 for(const [id,upgrade] of Object.entries(UPGRADES)){
  document.querySelector(`[data-upgrade="${id}"]`).disabled=profile[id]||profile.credits<upgrade.cost;
  setText(id==='precision'?'upgradeCost':`${id}Cost`,profile[id]?'장착 완료':`${upgrade.cost} CR`);
 }
 setText('workshopStatus','구매한 장비는 다음 출항부터 적용됩니다. 훈련에는 보상이 없습니다.');
 const active=contractFor(game.contractId);
 setText('topStatus',mode==='play'?`OW-01 / ${active.satellite} · 정비 작업 중`:mode==='result'?`${active.satellite} · 정비 완료`:'작은 정비소, 다시 이어지는 궤도');
 setText('restoredLabel',`${active.satellite} · 전력과 통신 정상`);
 setText('tutorialToggle',profile.tutorialDismissed?'실습 안내 다시 켜기':'실습 안내 숨기기');
 document.body.dataset.mode=mode;
}
for(const config of Object.values(CONTRACTS)){
 const button=document.createElement('button');button.dataset.contract=config.id;
 button.addEventListener('click',()=>{if(isUnlocked(profile,config.id)){selectedContract=config.id;updateHome();sound.click();}});
 $('contractChoices').append(button);
}
function launch(training=false,resume=false){
 sound.unlock();sound.click();
 if(!resume){
  if(!training&&!isUnlocked(profile,selectedContract))return;
  try{saves.beginNew();}catch{/* Existing saves stay protected if backup fails. */}
  game=new Mission({precision:profile.precision,efficiency:profile.efficiency,shield:profile.shield,contractId:training?'solar':selectedContract,training});
 }
 hasActive=true;mode=game.stage==='complete'?'result':'play';paused=false;selected=contractFor(game.contractId).scans[1];repairHeld=false;fineMode=false;
 world.orbit={x:0,y:0,zoom:1};keys.clear();clearTouch();setModal(null);
 $('torque').value=String(Math.round(game.torque*100));
 if(mode==='result')showResult();else{updateHome();renderUI();save();}
}
function showResult(){
 award(profile,game);sound.complete();mode='result';paused=false;repairHeld=false;
 setText('resultContract',`${contractFor(game.contractId).title} · ${game.training?'훈련 완료 · 보상 없음':'정비소에서 다음 의뢰와 장비를 확인하세요.'}`);
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
function setModal(id){
 if(activeModal===id)return;
 if(activeModal){const previous=$(activeModal);previous.close();previous.hidden=true;}
 activeModal=id;paused=mode==='play'&&id!==null;
 keys.clear();clearTouch();repairHeld=false;
 if(id){$(id).hidden=false;$(id).showModal();}
 setText('pauseButton',paused?'▷':'Ⅱ');
 $('pauseButton').setAttribute('aria-label',paused?'작업 계속':'일시정지');
}
function pause(value){
 if(mode!=='play')return;
 if(activeModal==='importOverlay')return;
 if(activeModal==='helpOverlay'){if(value)helpWasPaused=true;return;}
 setModal(value?'pauseOverlay':null);save();
}
function openHelp(){
 if(activeModal==='helpOverlay'||activeModal==='importOverlay')return;
 helpWasPaused=paused;setModal('helpOverlay');if(mode==='play')save();
}
function closeHelp(){
 if(activeModal!=='helpOverlay')return;
 setModal(mode==='play'&&helpWasPaused?'pauseOverlay':null);
}
for(const id of ['pauseOverlay','helpOverlay','importOverlay'])$(id).addEventListener('cancel',event=>{
 event.preventDefault();if(id==='importOverlay')closeImport();else if(id==='helpOverlay')closeHelp();else pause(false);
});
const stageHelp={
 approach:'안내 링을 따라 접근 · Space로 제동 · A/D로 좌우 보정',
 survey:'위성의 전원부와 전개부 표식을 각각 선택한 뒤 스캔하세요.',
 diagnose:'오른쪽 측정값을 비교하고 고장의 원인을 선택하세요.',
 isolate:'전원부 표식을 선택하고 구동 전원을 분리하세요.',
 brace:'고정점 표식을 선택해 작업 팔로 정비 부위를 지지하세요.',
 release:'선택한 부위를 정비하세요.',
 restore:'전원부를 선택해 구동 전원을 다시 연결하세요.',
 test:'발전 상태와 신호가 회복되는지 작동 시험을 진행하세요.',
 complete:'기상위성이 정상 서비스를 재개했습니다.'
};
const actionLabels={approach:'포획 시도',survey:'선택 부위 스캔',diagnose:'원인 선택 대기',isolate:'전원 분리',brace:'작업부 고정',release:'길게 눌러 작업',restore:'전원 연결',test:'작동 시험',complete:'복구 완료'};
function renderUI(){
 if(mode!=='play')return;
 document.body.dataset.phase=game.stage;
 const config=contractFor(game.contractId),m=game.metrics(),checks=captureChecks(m),flight=game.stage==='approach',index=STAGES.indexOf(game.stage);
 setText('missionNumber',`CONTRACT ${config.number}`);setText('missionTitle',config.title);setText('missionSatellite',`${config.satellite} · ${config.repairName}`);
 setText('captureHint',`결합부 ${CAPTURE.distance}m 미만 · 상대속도 ${CAPTURE.speed}m/s 미만`);
 setText('radioText',game.notice);setText('modeTag',game.training?'회전 표적 훈련':'기본 작업');
 setText('distanceValue',m.distance.toFixed(1));setText('speedValue',m.speed.toFixed(2));setText('angleValue',m.angle.toFixed(1));
 [['distanceCheck',checks.distance,'거리'],['speedCheck',checks.speed,'속도'],['angleCheck',checks.alignment,'방향']].forEach(([id,ok,label])=>{$(id).classList.toggle('pass',ok);setText(id,`${ok?'✓':'○'} ${label}`);});
 $('flightData').hidden=!flight;$('repairData').hidden=flight;$('rescueButton').hidden=!flight;
 setText('telemetryTitle',flight?'RELATIVE NAVIGATION':'SYSTEM DIAGNOSTICS');setText('cameraLabel',flight?'CHASE CAM':'TOOL CAM');
 $('touchControls').hidden=!flight;
 setText('assistButton',`자세 보조 ${game.assist?'ON':'OFF'}  · T`);$('assistButton').setAttribute('aria-pressed',String(game.assist));
 setText('fuelValue',`${game.fuel.toFixed(0)}%`);$('fuelBar').style.width=`${game.fuel}%`;setText('integrityValue',`${Math.round(game.integrity)}%`);
 setText('brakingHint',flight?`예상 제동거리 ${(m.speed*m.speed/(2*(game.precision?2.2:1.6))).toFixed(1)} m · ${fineMode?'미세 모드':'일반 모드'}`:'');
 setText('fineButton',fineMode?'미세 ON':'미세 OFF');$('fineButton').setAttribute('aria-pressed',String(fineMode));
 setText('powerScanned',game.scanned.power?'확인 완료':'미확인');
 setText('scanPartName',PART_NAMES[config.scans[1]]);setText('driveScanned',game.scanned[config.scans[1]]?'확인 완료':'미확인');
 setText('voltageValue',game.scanned.power?(game.powerOn?(game.repaired?'28.2 V · 정상':config.voltage):'0.0 V · 분리됨'):'— V');
 setText('driveValue',game.scanned[config.scans[1]]?(game.stage==='complete'?'전력 · 신호 정상':game.repaired?'정비 완료 · 시험 대기':config.evidence):'—');
 setText('powerState',game.powerOn?'연결':'분리');setText('braceState',game.braced?'고정 완료':'대기');
 $('diagnosisChoices').hidden=game.stage!=='diagnose';$('torqueControl').hidden=game.stage!=='release'||!config.range;
 setText('repairControlName',config.controlName??'작업');$('torque').setAttribute('aria-label',config.controlName??'작업 조절');setText('torqueValue',`${Math.round(game.torque*100)}%`);
 if(config.range){document.documentElement.style.setProperty('--torque-min',`${config.range[0]*100}%`);document.documentElement.style.setProperty('--torque-width',`${(config.range[1]-config.range[0])*100}%`);}
 $('torqueValue').style.color=repairIsSafe(game)?'var(--mint)':'var(--orange)';setText('torqueHint',repairHint(game));
 const tutorial=tutorialFor(game);$('tutorialCoach').hidden=profile.tutorialDismissed;setText('tutorialTitle',tutorial.title);setText('tutorialText',tutorial.text);
 const parts=availableParts(game),signature=parts.join(',');
 if($('partPicker').dataset.parts!==signature){
  $('partPicker').dataset.parts=signature;$('partPicker').replaceChildren();
  for(const id of parts){const button=document.createElement('button');button.dataset.selectPart=id;button.textContent=PART_NAMES[id];$('partPicker').append(button);}
 }
 $('partPicker').hidden=parts.length===0;all('[data-select-part]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.selectPart===selected)));
 const groupIndex=flight?0:index<=2?1:index<=6?2:3;
 all('#checklist li').forEach((el,i)=>{el.classList.toggle('active',i===groupIndex);el.classList.toggle('done',i<groupIndex);el.firstElementChild.textContent=i<groupIndex?'✓':String(i+1).padStart(2,'0');});
 setText('stepNumber',`STEP ${String(index+1).padStart(2,'0')} / 09`);setText('stageName',game.stage==='release'?config.repairName:labels[game.stage]);setText('stageHint',game.stage==='release'?repairHint(game):game.stage==='survey'?`${config.scans.map(id=>PART_NAMES[id]).join('와 ')}를 선택해 스캔하세요.`:stageHelp[game.stage]);
 setText('actionLabel',game.job?(game.job.kind==='test'?'기능 시험 중…':'작업 중…'):game.stage==='release'?config.repairName+' (길게)':actionLabels[game.stage]);
 $('actionButton').disabled=Boolean(game.job)||game.stage==='diagnose'||game.stage==='complete';
 if(game.stage==='release')$('actionButton').disabled=selected!==config.repairPart;
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
 const allowed=availableParts(game);
 const offset={power:[-38,-28],drive:[50,-42],brace:[60,12],latch:[48,38],battery:[-50,45],antenna:[0,-28]};
 for(const el of all('.part-tag')){
  const id=el.dataset.part,p=world.project(world.partPosition(id));el.hidden=!allowed.includes(id)||!p.visible;
  el.style.left=`${clamp(p.x+offset[id][0],50,window.innerWidth-65)}px`;el.style.top=`${clamp(p.y+offset[id][1],155,window.innerHeight-150)}px`;
 }
}

$('startButton').addEventListener('click',()=>launch());$('continueButton').addEventListener('click',()=>launch(false,true));
$('trainingButton').addEventListener('click',()=>launch(true));
all('[data-upgrade]').forEach(button=>button.addEventListener('click',()=>{if(purchaseUpgrade(profile,button.dataset.upgrade)){save();sound.stage();toast('장비를 구매했습니다. 다음 출항부터 적용됩니다.');updateHome();}}));
$('returnButton').addEventListener('click',()=>{hasActive=false;mode='hangar';save();updateHome();sound.click();});
$('homeButton').addEventListener('click',()=>{mode='home';updateHome();setModal(null);save();});
$('brand').addEventListener('click',e=>{e.preventDefault();if(mode==='play')pause(true);});
$('pauseButton').addEventListener('click',()=>pause(!paused));$('resumeButton').addEventListener('click',()=>pause(false));
$('helpButton').addEventListener('click',openHelp);$('closeHelp').addEventListener('click',closeHelp);$('helpDone').addEventListener('click',closeHelp);
$('soundButton').addEventListener('click',()=>{sound.unlock();sound.enabled=!sound.enabled;setText('soundButton',`소리 ${sound.enabled?'ON':'OFF'}`);$('soundButton').setAttribute('aria-pressed',String(sound.enabled));sound.click();});
$('lowQuality').addEventListener('change',e=>world.setQuality(e.target.checked));
$('assistButton').addEventListener('click',()=>{game.assist=!game.assist;renderUI();});
$('rescueButton').addEventListener('click',()=>{game.rescue();events();save();});
all('.part-tag').forEach(el=>el.addEventListener('click',()=>selectPart(el.dataset.part)));
all('[data-diagnosis]').forEach(el=>el.addEventListener('click',()=>{if(paused)return;game.diagnose(el.dataset.diagnosis);events();}));
$('partPicker').addEventListener('click',event=>{const button=event.target.closest('[data-select-part]');if(button&&availableParts(game).includes(button.dataset.selectPart))selectPart(button.dataset.selectPart);});
$('fineButton').addEventListener('click',()=>{fineMode=!fineMode;renderUI();});
$('dismissTutorial').addEventListener('click',()=>{profile.tutorialDismissed=true;save();renderUI();});
$('tutorialToggle').addEventListener('click',()=>{profile.tutorialDismissed=!profile.tutorialDismissed;save();updateHome();renderUI();});
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
function exportProgress(){
 const blob=new Blob([encodeSave(profile,hasActive?game:null)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='orbital-workshop-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
$('exportButton').addEventListener('click',exportProgress);$('homeExportButton').addEventListener('click',exportProgress);
function chooseImport(){if(mode==='play')pause(true);$('importFile').value='';$('importFile').click();}
$('importButton').addEventListener('click',chooseImport);$('pauseImportButton').addEventListener('click',chooseImport);
function closeImport(){if(activeModal!=='importOverlay')return;pendingImport=null;setModal(importReturnModal);}
$('cancelImport').addEventListener('click',closeImport);
$('importFile').addEventListener('change',async event=>{
 const file=event.target.files[0];if(!file)return;
 importReturnModal=activeModal;pendingImport=null;setModal('importOverlay');
 $('confirmImport').disabled=true;setText('importSummary','파일을 확인하고 있습니다.');setText('importError','');
 try{
  if(file.size>MAX_IMPORT_BYTES)throw new Error('1 MB 이하의 진행 파일을 선택하세요.');
  const raw=await file.text();if(activeModal!=='importOverlay')return;
  const parsed=decodeSave(raw);if(!parsed)throw new Error('유효한 v0.1 / v0.2 진행 파일이 아닙니다. 현재 진행은 유지됩니다.');
  pendingImport=raw;setText('importSummary',`${parsed.profile.credits.toLocaleString()} CR · 정비 ${parsed.profile.completed}회 · ${parsed.mission?contractFor(parsed.mission.contractId).title+' / '+labels[parsed.mission.stage]:'진행 중인 임무 없음'}`);
  $('confirmImport').disabled=false;
 }catch(error){setText('importSummary','파일을 불러올 수 없습니다.');setText('importError',error.message);}
});
$('confirmImport').addEventListener('click',()=>{
 if(!pendingImport)return;
 try{
  const saved=saves.importSave(pendingImport);profile=saved.profile;game=saved.mission??new Mission();hasActive=Boolean(saved.mission);
  if(hasActive)award(profile,game);
  selectedContract=isUnlocked(profile,game.contractId)?game.contractId:'solar';mode='home';pendingImport=null;updateHome();setModal(null);save();toast('진행 파일을 불러왔습니다. 이어하기로 계속하세요.');
 }catch{setText('importError','기존 저장을 백업하거나 새 진행을 저장하지 못했습니다. 현재 진행은 유지됩니다.');}
});
document.addEventListener('keydown',e=>{
 if(e.code==='Tab'&&activeModal){
  const controls=[...$(activeModal).querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')].filter(el=>el.getClientRects().length);
  const first=controls[0],last=controls.at(-1);
  if(first&&((e.shiftKey&&document.activeElement===first)||(!e.shiftKey&&document.activeElement===last))){
   e.preventDefault();(e.shiftKey?last:first).focus();
  }
  return;
 }
 if(e.code==='Escape'){e.preventDefault();if(activeModal==='importOverlay'){closeImport();return;}if(!$('helpOverlay').hidden)closeHelp();else pause(!paused);return;}
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
window.addEventListener('blur',()=>{if(mode==='play')pause(true);keys.clear();clearTouch();repairHeld=false;});
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
 yaw:Number(down('ArrowLeft'))-Number(down('ArrowRight')),pitch:Number(down('ArrowUp'))-Number(down('ArrowDown')),brake:down('Space'),slow:fineMode||down('ShiftLeft')||down('ShiftRight'),repairHeld,part:selected
};}
let previous=performance.now(),accumulator=0,lastUI=0;
function frame(now){
 const dt=Math.min((now-previous)/1000,.08);previous=now;
 if(mode==='play'&&!paused){
  accumulator+=dt;while(accumulator>=1/60){game.tick(1/60,input());accumulator-=1/60;}
  if(game.events.length)events();
  if(now-lastSave>2500){save();lastSave=now;}
 }else accumulator=0;
 if(!document.hidden){world.render(game,mode,selected,paused?0:dt);updateTags();}
 if(now-lastUI>80){renderUI();lastUI=now;}
 requestAnimationFrame(frame);
}
// Read-only inspection is useful for support and browser integration tests.
Object.defineProperty(window,'orbitalWorkshop',{value:Object.freeze({getSnapshot:()=>game.snapshot(),getProfile:()=>structuredClone(profile),getStatus:()=>({mode,paused,selected,saveAvailable,renderer:world.renderer.info.render})})});
updateHome();$('boot').hidden=true;save();requestAnimationFrame(frame);
