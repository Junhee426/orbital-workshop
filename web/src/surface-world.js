// Shared, deterministic terrain for rendering and walking physics (metres).
export const DEPOT = Object.freeze({x:0,z:42});
export const RELAY = Object.freeze({x:0,z:-108});
export const SHELTER = Object.freeze({x:-34,z:-35});
export const ROUTES = Object.freeze({
 valley:[DEPOT,{x:-30,z:15},SHELTER,{x:-30,z:-76},RELAY],
 ridge:[DEPOT,{x:9,z:8},{x:12,z:-40},{x:8,z:-78},RELAY]
});
export const clamp=(n,a,b)=>Math.min(b,Math.max(a,n));
function segmentDistance(x,z,a,b){
 const dx=b.x-a.x,dz=b.z-a.z,t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
 return Math.hypot(x-a.x-dx*t,z-a.z-dz*t);
}
export function pathDistance(x,z,route=ROUTES.valley){
 return Math.min(...route.slice(1).map((p,i)=>segmentDistance(x,z,route[i],p)));
}
export function heightAt(x,z){
 const rolling=1.1*Math.sin(x*.065)+.65*Math.cos(z*.067)+.55*Math.sin((x+z)*.12);
 const ridge=12*Math.exp(-(((x-10)/18)**2)-((z+35)/35)**2);
 const path=1-Math.exp(-((pathDistance(x,z)/5)**2));
 return rolling+ridge*(.17+.83*path);
}
export function slopeAt(x,z){
 const e=.3;return {x:(heightAt(x+e,z)-heightAt(x-e,z))/(2*e),z:(heightAt(x,z+e)-heightAt(x,z-e))/(2*e)};
}
export const ROCKS=Object.freeze(Array.from({length:100},(_,i)=>{
 const x=Math.sin(i*127.1+3)*66,z=-113+(Math.sin(i*311.7+9)*.5+.5)*165;
 return {x,z,r:.65+(Math.sin(i*43.3)*.5+.5)*1.3};
}).filter(p=>pathDistance(p.x,p.z)>5&&[DEPOT,RELAY,SHELTER].every(q=>Math.hypot(p.x-q.x,p.z-q.z)>9)));
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);

// Cabin footprints match the visible station buildings; terminals stay reachable.
export const CABINS=Object.freeze([DEPOT,RELAY].map(p=>({x:p.x+5,z:p.z+.3,hx:2.5,hz:1.9})));
