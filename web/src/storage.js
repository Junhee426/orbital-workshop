import {Mission} from './mission.js';
export const SAVE_KEY='orbital-workshop-save-v1';
export const freshProfile=()=>({credits:0,precision:false,completed:0,awardedRuns:[]});
export function award(profile,mission){
 if(mission.stage!=='complete'||profile.awardedRuns.includes(mission.runId))return 0;
 const reward=400+Math.max(0,100-mission.impacts*15-mission.rescues*25);
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
  return {profile,mission:Mission.restore(s.active)};
 }catch{return null;}
}
export function encodeSave(profile,mission){return JSON.stringify({version:1,profile,active:mission?.snapshot()??null});}
