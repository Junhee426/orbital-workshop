// Conservative ship-expanded colliders in the satellite's rotating frame.
const dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0);
const rotate=(v,a)=>[Math.cos(a)*v[0]+Math.sin(a)*v[2],v[1],-Math.sin(a)*v[0]+Math.cos(a)*v[2]];
function boxContact(point,center,half,angle=0){
 const local=rotate(point.map((v,i)=>v-center[i]),-angle);
 if(local.some((v,i)=>Math.abs(v)>=half[i]))return null;
 const depths=half.map((v,i)=>v-Math.abs(local[i]));
 const axis=depths.indexOf(Math.min(...depths)),normal=[0,0,0];normal[axis]=local[axis]>=0?1:-1;
 return {normal:rotate(normal,angle),depth:depths[axis]};
}
export function resolveCollision(position,velocity,targetYaw,omega,panel){
 let point=rotate(position,-targetYaw),normal=null,depth=0;
 const distance=Math.hypot(...point);
 if(distance<2.75){normal=distance>1e-8?point.map(v=>v/distance):[0,0,1];depth=2.75-distance;}
 else {
  const angle=-1.34*(1-panel),wingCenter=rotate([2.18,0,0],angle);wingCenter[0]+=1.3;
  const contact=boxContact(point,[-3.48,0,0],[2.22,1.9,0.8])||boxContact(point,wingCenter,[2.22,1.9,0.8],angle);
  if(contact)({normal,depth}=contact);
 }
 if(!normal)return {position,velocity,impactSpeed:0,contact:false};
 normal=rotate(normal,targetYaw);
 const corrected=position.map((v,i)=>v+normal[i]*(depth+0.01));
 const surface=[omega*corrected[2],0,-omega*corrected[0]];
 const closing=dot(velocity.map((v,i)=>v-surface[i]),normal);
 // Preserve tangential motion; never reverse a ship already moving away.
 const bounced=closing<0?velocity.map((v,i)=>v-1.25*closing*normal[i]):velocity;
 return {position:corrected,velocity:bounced,impactSpeed:Math.max(0,-closing),contact:true};
}
