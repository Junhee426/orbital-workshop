import {rewardFor} from './rules.js';
import {Mission} from './mission.js';
import {CONTRACTS,UPGRADES} from './contracts.js';
// Retain the original key so v0.1 players are migrated in place.
export const SAVE_KEY='orbital-workshop-save-v1';
export const MAX_IMPORT_BYTES=1024*1024;
export const freshProfile=()=>({credits:0,precision:false,efficiency:false,shield:false,completed:0,awardedRuns:[],completedContracts:[],bestTimes:{},tutorialDismissed:false});
export function award(profile,mission){
 if(mission.stage!=='complete'||mission.training||profile.awardedRuns.includes(mission.runId))return 0;
 const reward=rewardFor(mission);
 profile.credits+=reward;profile.completed++;profile.awardedRuns.push(mission.runId);
 profile.awardedRuns=profile.awardedRuns.slice(-100);
 if(!profile.completedContracts.includes(mission.contractId))profile.completedContracts.push(mission.contractId);
 const previous=profile.bestTimes[mission.contractId];
 profile.bestTimes[mission.contractId]=previous===undefined?mission.elapsed:Math.min(previous,mission.elapsed);
 return reward;
}
export function purchaseUpgrade(profile,id){
 if(!Object.hasOwn(UPGRADES,id))return false;
 const upgrade=UPGRADES[id];
 if(profile[id]||profile.credits<upgrade.cost)return false;
 profile.credits-=upgrade.cost;profile[id]=true;return true;
}
export const purchasePrecision=profile=>purchaseUpgrade(profile,'precision');
export function decodeSave(raw){
 try {
  if(typeof raw!=='string'||raw.length>MAX_IMPORT_BYTES)return null;
  const s=JSON.parse(raw);if(![1,2].includes(s?.version))return null;
  const p=s.profile;
  if(!p||!Number.isFinite(p.credits)||p.credits<0||p.credits>1e9||!Number.isFinite(p.completed)||p.completed<0||p.completed>1e6||!Array.isArray(p.awardedRuns))return null;
  const profile={...freshProfile(),credits:Math.floor(p.credits),completed:Math.floor(p.completed),precision:p.precision===true,awardedRuns:p.awardedRuns.filter(v=>typeof v==='string').slice(-100)};
  if(s.version===1){if(profile.completed>0)profile.completedContracts=['solar'];}
  else {
   if(!Array.isArray(p.completedContracts)||!p.completedContracts.every(id=>Object.hasOwn(CONTRACTS,id)))return null;
   profile.completedContracts=[...new Set(p.completedContracts)];
   for(const id of ['efficiency','shield','tutorialDismissed'])profile[id]=p[id]===true;
   if(p.bestTimes!==undefined&&(!p.bestTimes||typeof p.bestTimes!=='object'||Array.isArray(p.bestTimes)))return null;
   for(const [id,time] of Object.entries(p.bestTimes??{})){
    if(!Object.hasOwn(CONTRACTS,id)||!Number.isFinite(time)||time<0)return null;
    profile.bestTimes[id]=time;
   }
  }
  const mission=Mission.restore(s.active);
  if(s.active!=null&&!mission)return null;
  return {profile,mission};
 }catch{return null;}
}
export function encodeSave(profile,mission){return JSON.stringify({version:2,profile,active:mission?.snapshot()??null});}
export class SaveStore {
 constructor(getStorage){this.getStorage=getStorage;this.blocked=true;this.readFailed=true;this.raw=null;}
 load(){
  this.blocked=true;this.readFailed=true;
  this.raw=this.getStorage().getItem(SAVE_KEY);
  const saved=decodeSave(this.raw);
  this.readFailed=false;this.blocked=this.raw!==null&&!saved;
  return saved;
 }
 backup(raw){
  if(raw===null)return;
  const storage=this.getStorage(),base=`${SAVE_KEY}-recovery-${Date.now()}`;
  let key=base,index=0;
  while(storage.getItem(key)!==null)key=`${base}-${++index}`;
  storage.setItem(key,raw);
 }
 beginNew(){
  if(this.readFailed)this.load();
  if(this.blocked)this.backup(this.raw);
  this.blocked=false;
 }
 write(profile,mission){
  if(this.blocked)throw new Error('Existing save is protected');
  this.getStorage().setItem(SAVE_KEY,encodeSave(profile,mission));
 }
 importSave(raw){
  const saved=decodeSave(raw);
  if(!saved)throw new Error('유효한 진행 파일이 아닙니다. v0.1 또는 v0.2 JSON 파일을 선택하세요.');
  const storage=this.getStorage();
  // Back up and persist before the caller replaces its live state.
  this.backup(storage.getItem(SAVE_KEY));
  const normalized=encodeSave(saved.profile,saved.mission);
  storage.setItem(SAVE_KEY,normalized);
  this.raw=normalized;this.blocked=false;this.readFailed=false;
  return saved;
 }
}
