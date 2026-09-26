export const CAPTURE = Object.freeze({distance:1.15, speed:0.48, angle:14, spin:0.14});
export const TORQUE = Object.freeze({min:0.4, max:0.6});
export const torqueIsSafe = value => value >= TORQUE.min && value <= TORQUE.max;
export const torqueRangeLabel = `${TORQUE.min*100}–${TORQUE.max*100}%`;
export const rewardFor = mission => 400 + Math.max(0,100-mission.impacts*15-mission.rescues*25);
export function captureChecks({distance,speed,angle,spin}) {
 return {distance:distance<CAPTURE.distance, speed:speed<CAPTURE.speed, alignment:angle<CAPTURE.angle&&spin<CAPTURE.spin};
}
