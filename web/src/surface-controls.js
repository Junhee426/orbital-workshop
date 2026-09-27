// Pointer ownership and radial dead zone are independent of DOM and frame rate.
export class AnalogStick {
 constructor(deadZone=.12){this.deadZone=deadZone;this.reset();}
 reset(){this.pointer=null;this.x=0;this.y=0;this.knobX=0;this.knobY=0;}
 start(id,x,y,radius){
  if(this.pointer!==null||!Number.isFinite(radius)||radius<=0)return false;
  this.pointer=id;this.origin={x,y};this.radius=radius;return true;
 }
 move(id,x,y){
  if(id!==this.pointer||this.pointer===null||!Number.isFinite(x)||!Number.isFinite(y))return false;
  const dx=x-this.origin.x,dy=y-this.origin.y,length=Math.hypot(dx,dy),extent=Math.min(1,length/this.radius);
  const strength=Math.max(0,(extent-this.deadZone)/(1-this.deadZone));
  this.x=length?dx/length*strength:0;this.y=length?dy/length*strength:0;
  this.knobX=length?dx/length*extent*this.radius:0;this.knobY=length?dy/length*extent*this.radius:0;
  return true;
 }
 end(id){if(id!==this.pointer||this.pointer===null)return false;this.reset();return true;}
}
export function cameraRelative(x,forward,yaw){
 const magnitude=Math.hypot(x,forward);if(magnitude>1){x/=magnitude;forward/=magnitude;}
 return {x:x*Math.cos(yaw)-forward*Math.sin(yaw),z:-x*Math.sin(yaw)-forward*Math.cos(yaw)};
}
