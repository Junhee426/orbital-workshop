import {contractFor} from './contracts.js';
export const CAPTURE = Object.freeze({distance:1.15, speed:0.48, angle:14, spin:0.14});
export const rewardFor = mission => mission.training?0:contractFor(mission.contractId).baseReward + Math.max(0,100-mission.impacts*15-mission.rescues*25);
export function captureChecks({distance,speed,angle,spin}) {
 return {distance:distance<CAPTURE.distance, speed:speed<CAPTURE.speed, alignment:angle<CAPTURE.angle&&spin<CAPTURE.spin};
}
