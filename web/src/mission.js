import {CAPTURE,captureChecks} from './rules.js';
import {CONTRACTS,contractFor,PART_NAMES,repairIsSafe,repairHint} from './contracts.js';
import {resolveCollision} from './physics.js';
// Pure simulation: no DOM or rendering dependencies. Distances are game metres.
export const STAGES = ['approach','survey','diagnose','isolate','brace','release','restore','test','complete'];
export const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
export const wrap = a => Math.atan2(Math.sin(a),Math.cos(a));
const norm = v => Math.hypot(...v);
export const labels = {
 approach:'접근 · 포획', survey:'상태 스캔', diagnose:'고장 진단', isolate:'전원 분리',
 brace:'작업부 고정', release:'래치 해제', restore:'전원 복구', test:'작동 시험', complete:'서비스 복구 완료'
};
export class Mission {
 constructor({precision=false,training=false,contractId='solar',efficiency=false,shield=false}={}) {
  this.contractId=Object.hasOwn(CONTRACTS,contractId)?contractId:'solar';this.efficiency=efficiency;this.shield=shield;
  this.tutorial={moved:false,braked:false};
  this.runId = `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  this.stage='approach'; this.precision=precision; this.training=training;
  this.pos=[0,0,20]; this.vel=[0,0,0]; this.yaw=0; this.pitch=0;
  this.yawRate=0; this.pitchRate=0; this.targetYaw=0; this.omega=training?0.045:contractFor(this.contractId).omega;
  this.assist=true; this.fuel=100; this.integrity=100; this.elapsed=0; this.impacts=0;
  this.rescues=0; this.collisionCooldown=0; this.scanned={power:false,drive:false,battery:false,antenna:false};
  this.diagnosed=false; this.powerOn=true; this.braced=false; this.repaired=false;
  this.repairProgress=0; this.torque=0.18; this.panel=this.contractId==='solar'?0:1; this.signal=0; this.job=null;
  this.notice='W로 접근하고 Space로 감속하세요. 목표 결합부에 가까워지면 F로 포획합니다.';
  this.events=[]; this.thrust=0;
 }
 notify(text) {this.notice=text; this.events.push({type:'notice',text});}
 transition(stage,text) {this.stage=stage;this.job=null;this.notify(text);this.events.push({type:'stage',stage});}
 forward(){return [-Math.sin(this.yaw)*Math.cos(this.pitch),Math.sin(this.pitch),-Math.cos(this.yaw)*Math.cos(this.pitch)];}
 port(){return [Math.sin(this.targetYaw)*1.46,0,Math.cos(this.targetYaw)*1.46];}
 dockPosition(){return [Math.sin(this.targetYaw)*3.56,0,Math.cos(this.targetYaw)*3.56];}
 metrics(){
  const f=this.forward(),p=this.port(),tip=this.pos.map((v,i)=>v+f[i]*1.6);
  const distance=norm(tip.map((v,i)=>v-p[i]));
  const offset=f.map(v=>v*1.6);
  const pitchVelocity=[Math.sin(this.yaw)*Math.sin(this.pitch),Math.cos(this.pitch),Math.cos(this.yaw)*Math.sin(this.pitch)].map(v=>v*this.pitchRate*1.6);
  const tipVelocity=[this.vel[0]+this.yawRate*offset[2]+pitchVelocity[0],this.vel[1]+pitchVelocity[1],this.vel[2]-this.yawRate*offset[0]+pitchVelocity[2]];
  const pv=[Math.cos(this.targetYaw)*1.46*this.omega,0,-Math.sin(this.targetYaw)*1.46*this.omega];
  const speed=norm(tipVelocity.map((v,i)=>v-pv[i]));
  const angle=Math.hypot(wrap(this.yaw-this.targetYaw),this.pitch)*180/Math.PI;
  const spin=Math.hypot(this.yawRate-this.omega,this.pitchRate);
  const metrics={distance,speed,angle,spin};
  return {...metrics,ready:Object.values(captureChecks(metrics)).every(Boolean)};
 }
 capture(){
  if(this.stage!=='approach')return false;
  const m=this.metrics();
  if(!m.ready){this.notify(m.distance>=CAPTURE.distance?'결합부까지 조금 더 접근하세요.':m.speed>=CAPTURE.speed?'상대속도가 높습니다. Space로 감속하세요.': '방향을 맞춰 주세요. T로 자세 보조를 켤 수 있습니다.');return false;}
  this.transition('survey',`결합 확인. ${contractFor(this.contractId).scans.map(id=>PART_NAMES[id]).join('와 ')}를 스캔하세요.`);
  return true;
 }
 act(part){
  if(this.job)return false;
  if(this.stage==='approach')return this.capture();
  if(this.stage==='survey'){
   if(!contractFor(this.contractId).scans.includes(part)){this.notify('이번 임무의 스캔 부위를 선택하세요.');return false;}
   this.job={kind:'scan',part,time:0,duration:1.4};return true;
  }
  if(this.stage==='isolate'&&part==='power'){this.job={kind:'isolate',time:0,duration:1};return true;}
  if(this.stage==='brace'&&part==='brace'){this.job={kind:'brace',time:0,duration:1.2};return true;}
  if(this.stage==='restore'&&part==='power'&&this.repaired){this.powerOn=true;this.transition('test','전원 복구 완료. 작동 시험으로 전력과 신호를 확인하세요.');return true;}
  if(this.stage==='test'&&this.repaired&&this.braced&&this.diagnosed&&this.powerOn){this.job={kind:'test',time:0,duration:6};return true;}
  this.notify('이번 단계에 필요한 부품 표식을 선택하세요.');return false;
 }
 diagnose(answer){
  if(this.stage!=='diagnose')return false;
  if(answer!==contractFor(this.contractId).answer){this.notify(contractFor(this.contractId).diagnosis);return false;}
  this.diagnosed=true;this.transition('isolate',`${contractFor(this.contractId).repairName} 작업이 필요합니다. 전원부를 선택해 구동 전원을 분리하세요.`);return true;
 }
 rescue(){
  if(this.stage!=='approach')return false;
  const a=this.targetYaw;
  this.pos=[Math.sin(a)*16,0,Math.cos(a)*16];this.vel=[0,0,0];this.yaw=a;this.pitch=0;this.yawRate=0;this.pitchRate=0;this.collisionCooldown=0;
  this.fuel=Math.max(40,this.fuel);this.rescues++;this.notify('본부 견인 완료. 접근 지점에서 다시 시작합니다.');return true;
 }
 tick(dt,input={}){
  if(!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,0.05);if(this.stage!=='complete')this.elapsed+=dt;this.collisionCooldown=Math.max(0,this.collisionCooldown-dt);
  if(this.stage==='approach')this.fly(dt,input);
  else {
   this.omega*=Math.exp(-dt*2);this.targetYaw+=this.omega*dt;
   const p=this.dockPosition();this.pos=this.pos.map((v,i)=>v+(p[i]-v)*(1-Math.exp(-dt*4)));
   this.yaw+=wrap(this.targetYaw-this.yaw)*(1-Math.exp(-dt*4));this.pitch*=Math.exp(-dt*4);
   this.vel=this.vel.map(v=>v*Math.exp(-dt*5));this.thrust=0;
  }
  if(this.job){
   const j=this.job;j.time+=dt;
   if(j.kind==='test'){this.panel=this.contractId==='solar'?clamp(j.time/4,0,1):1;this.signal=clamp((j.time-2)/4,0,1);}
   if(j.time>=j.duration){
    this.job=null;
    if(j.kind==='scan'){
     this.scanned[j.part]=true;
     if(contractFor(this.contractId).scans.every(part=>this.scanned[part]))this.transition('diagnose',contractFor(this.contractId).diagnosis);
     else this.notify(`${PART_NAMES[j.part]} 스캔 완료. 나머지 부위도 스캔하세요.`);
    }
    if(j.kind==='isolate'){this.powerOn=false;this.transition('brace','구동 전원 분리 완료. 고정점을 선택해 작업 팔로 정비 부위를 지지하세요.');}
    if(j.kind==='brace'){this.braced=true;this.transition('release',repairHint(this));}
    if(j.kind==='test'){this.panel=1;this.signal=1;this.transition('complete','관제팀입니다. 전력과 신호가 정상입니다. 정비를 완료했습니다.');this.events.push({type:'complete'});}
   }
  }
  if(this.stage==='release'&&input.repairHeld&&input.part===contractFor(this.contractId).repairPart&&!this.powerOn&&this.braced){
   if(repairIsSafe(this))this.repairProgress=clamp(this.repairProgress+dt/contractFor(this.contractId).duration,0,1);
   else this.repairProgress=clamp(this.repairProgress-dt*0.2,0,1);
   if(this.repairProgress>=1){this.repaired=true;this.transition('restore',`${contractFor(this.contractId).repairName} 완료. 전원부를 선택해 전원을 다시 연결하세요.`);}
  }
 }
 fly(dt,input){
  this.targetYaw=wrap(this.targetYaw+this.omega*dt);
  const manualYaw=clamp(input.yaw||0,-1,1),manualPitch=clamp(input.pitch||0,-1,1);
  if(manualYaw||manualPitch)this.assist=false;
  const yawTarget=this.assist?clamp(wrap(this.targetYaw-this.yaw)*3+this.omega,-0.7,0.7):manualYaw*0.7;
  const pitchTarget=this.assist?clamp(-this.pitch*3,-0.6,0.6):manualPitch*0.6;
  const response=1-Math.exp(-dt*8);
  this.yawRate+=(yawTarget-this.yawRate)*response;this.pitchRate+=(pitchTarget-this.pitchRate)*response;
  this.yaw=wrap(this.yaw+this.yawRate*dt);this.pitch=clamp(this.pitch+this.pitchRate*dt,-1.1,1.1);
  if(Math.abs(this.pitch)>=1.1)this.pitchRate=0;
  const move=[clamp(input.strafe||0,-1,1),clamp(input.up||0,-1,1),clamp(input.forward||0,-1,1)];
  const magnitude=norm(move);if(magnitude>1)for(let i=0;i<3;i++)move[i]/=magnitude;
  const f=this.forward(),right=[Math.cos(this.yaw),0,-Math.sin(this.yaw)];
  const acc=(this.precision?0.9:1.2)*(input.slow?0.32:1);
  this.thrust=this.fuel>0?norm(move):0;
  if(this.thrust>0)this.tutorial.moved=true;
  if(input.brake&&norm(this.vel)>0.05)this.tutorial.braked=true;
  if(this.fuel>0){
   for(let i=0;i<3;i++)this.vel[i]+=(f[i]*move[2]+right[i]*move[0]+(i===1?move[1]:0))*acc*dt;
   this.fuel=clamp(this.fuel-this.thrust*dt*0.55*(this.efficiency?0.65:1),0,100);
   if(input.brake){
    const dock=this.dockPosition(),target=[this.omega*dock[2],0,-this.omega*dock[0]];
    const relative=this.vel.map((v,i)=>v-target[i]),speed=norm(relative);
    const factor=speed>0?Math.max(0,1-(this.precision?2.2:1.6)*dt/speed):0;
    this.vel=relative.map((v,i)=>target[i]+v*factor);this.fuel=clamp(this.fuel-(speed>0.01?dt*0.25*(this.efficiency?0.65:1):0),0,100);
   }
  }
  const speed=norm(this.vel);if(speed>4.5)this.vel=this.vel.map(v=>v*4.5/speed);
  this.pos=this.pos.map((v,i)=>v+this.vel[i]*dt);
  const collision=resolveCollision(this.pos,this.vel,this.targetYaw,this.omega,this.panel);
  this.pos=collision.position;this.vel=collision.velocity;
  if(collision.contact&&collision.impactSpeed>0.05&&this.collisionCooldown<=0){
   this.impacts++;const damage=clamp(collision.impactSpeed*4,1,12)*(this.shield?0.5:1);
   this.integrity=clamp(this.integrity-damage,40,100);this.collisionCooldown=1.5;
   this.notify('접촉 감지. 제동 후 결합부 방향으로 접근하세요.');
  }
 }
 snapshot(){const result={};for(const k of Object.keys(this))if(k!=='events')result[k]=structuredClone(this[k]);return result;}
 static restore(s){
  if(!s||typeof s!=='object'||!STAGES.includes(s.stage)||typeof s.runId!=='string')return null;
  if(s.contractId!==undefined&&!Object.hasOwn(CONTRACTS,s.contractId))return null;
  const g=new Mission({precision:s.precision===true,training:s.training===true,contractId:s.contractId??'solar',efficiency:s.efficiency===true,shield:s.shield===true});
  for(const k of ['pos','vel'])if(!Array.isArray(s[k])||s[k].length!==3||!s[k].every(Number.isFinite))return null;
  const bools=['assist','diagnosed','powerOn','braced','repaired'];
  for(const k of bools)if(typeof s[k]!=='boolean')return null;
  const nums=['yaw','pitch','targetYaw','omega','fuel','integrity','elapsed','impacts','rescues','repairProgress','torque','panel','signal'];
  for(const k of nums)if(!Number.isFinite(s[k]))return null;
  g.runId=s.runId.slice(0,100);g.stage=s.stage;
  for(const k of bools)g[k]=s[k];
  for(const k of nums)g[k]=s[k];
  g.pos=s.pos.map(v=>clamp(v,-500,500));g.vel=s.vel.map(v=>clamp(v,-4.5,4.5));
  g.yaw=wrap(g.yaw);g.targetYaw=wrap(g.targetYaw);g.pitch=clamp(g.pitch,-1.1,1.1);
  g.omega=clamp(g.omega,-0.1,0.1);g.fuel=clamp(g.fuel,0,100);g.integrity=clamp(g.integrity,0,100);
  for(const k of ['repairProgress','torque','panel','signal'])g[k]=clamp(g[k],0,1);
  for(const k of ['elapsed','impacts','rescues'])g[k]=Math.max(0,g[k]);
  g.scanned=Object.fromEntries(['power','drive','battery','antenna'].map(id=>[id,s.scanned?.[id]===true]));
  g.tutorial={moved:s.tutorial?.moved===true,braked:s.tutorial?.braked===true};
  for(const k of ['yawRate','pitchRate'])g[k]=Number.isFinite(s[k])?clamp(s[k],-0.7,0.7):0;
  // Save only stable checkpoints; scans/tests can safely be restarted after reload.
  g.job=null;g.notice='저장된 작업을 이어갑니다.';
  const index=STAGES.indexOf(g.stage);
  if(index>=2&&!contractFor(g.contractId).scans.every(id=>g.scanned[id]))return null;
  if(index>=3&&!g.diagnosed)return null;
  if(index>=5&&!g.braced)return null;
  if(index>=6&&!g.repaired)return null;
  if(['brace','release','restore'].includes(g.stage)&&g.powerOn)return null;
  if(['test','complete'].includes(g.stage)&&!g.powerOn)return null;
  if(g.stage==='test'){g.panel=g.contractId==='solar'?0:1;g.signal=0;}
  if(g.stage==='complete'&&(g.panel<1||g.signal<1))return null;
  return g;
 }
}
