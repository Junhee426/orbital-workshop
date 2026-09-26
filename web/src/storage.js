import {rewardFor} from './rules.js';
import {Mission} from './mission.js';
export const SAVE_KEY='orbital-workshop-save-v1';
export const freshProfile=()=>({credits:0,precision:false,completed:0,awardedRuns:[]});
export function award(profile,mission){
 if(mission.stage!=='complete'||profile.awardedRuns.includes(mission.runId))return 0;
 const reward=rewardFor(mission);
 profile.credits+=reward;profile.completed++;profile.awardedRuns.push(mission.runId);
 profile.awardedRuns=profile.awardedRuns.slice(-100);return reward;
}
export function purchasePrecision(profile){
 if(profile.precision||profile.credits<180)return false;
 profile.credits-=180;profile.precision=true;return true;
}
export function decodeSave(raw){
 try {
  const s=JSON.parse(raw);if(s?.version!==1)return null;
  const p=s.profile;
  if(!p||!Number.isFinite(p.credits)||!Number.isFinite(p.completed)||!Array.isArray(p.awardedRuns))return null;
  const profile={credits:Math.max(0,Math.floor(p.credits)),completed:Math.max(0,Math.floor(p.completed)),precision:p.precision===true,awardedRuns:p.awardedRuns.filter(v=>typeof v==='string').slice(-100)};
  const mission=Mission.restore(s.active);
  if(s.active!=null&&!mission)return null;
  return {profile,mission};
 }catch{return null;}
}
export function encodeSave(profile,mission){return JSON.stringify({version:1,profile,active:mission?.snapshot()??null});}

// A failed read or decode must never authorize overwriting the original save.
export class SaveStore {
 constructor(getStorage){this.getStorage=getStorage;this.blocked=true;this.readFailed=true;this.raw=null;}
 load(){
  this.blocked=true;this.readFailed=true;
  this.raw=this.getStorage().getItem(SAVE_KEY);
  const saved=decodeSave(this.raw);
  this.readFailed=false;this.blocked=this.raw!==null&&!saved;
  return saved;
 }
 beginNew(){
  if(this.readFailed)this.load();
  if(this.blocked){
   // Keep every recovery copy, including when multiple bad saves are encountered.
   const storage=this.getStorage(),base=`${SAVE_KEY}-recovery-${Date.now()}`;
   let key=base,index=0;
   while(storage.getItem(key)!==null)key=`${base}-${++index}`;
   storage.setItem(key,this.raw);
  }
  this.blocked=false;
 }
 write(profile,mission){
  if(this.blocked)throw new Error('Existing save is protected');
  this.getStorage().setItem(SAVE_KEY,encodeSave(profile,mission));
 }
}
