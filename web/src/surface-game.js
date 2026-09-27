import {DEPOT,RELAY,SHELTER,ROUTES,ROCKS,CABINS,heightAt,slopeAt,clamp,distance} from './surface-world.js';
export class SurfaceGame {
 constructor(){
  this.x=DEPOT.x;this.z=DEPOT.z+4;this.y=heightAt(this.x,this.z);this.heading=0;
  this.stage='pickup';this.mass=18;this.stamina=100;this.balance=100;this.condition=100;
  this.speed=0;this.elapsed=0;this.steps=0;this.stumbles=0;this.cooldown=0;this.bracing=false;
  this.shelterUsed=false;this.route='valley';this.waypoint=1;
  this.notice='보급소에서 E를 눌러 배터리를 적재하세요.';
 }
 setLoad(mass){if(this.stage==='pickup'&&[18,32].includes(mass))this.mass=mass;}
 setRoute(route){if(Object.hasOwn(ROUTES,route)){this.route=route;this.waypoint=1;}}
 get target(){return this.stage==='pickup'?DEPOT:RELAY;}
 get remaining(){return distance(this,this.target);}
 get slope(){const s=slopeAt(this.x,this.z);return Math.hypot(s.x,s.z);}
 get guide(){
  if(this.stage!=='delivery')return this.target;
  const route=ROUTES[this.route];
  return route[this.waypoint]??RELAY;
 }
 get interaction(){
  if(this.stage==='pickup'&&distance(this,DEPOT)<7)return '배터리 적재';
  if(this.stage==='delivery'&&distance(this,RELAY)<7)return '배터리 연결 · 배송 완료';
  if(this.stage==='delivery'&&distance(this,SHELTER)<6)return this.shelterUsed?'쉼터에서 휴식':'쉼터 활성화 · 휴식';
  return null;
 }
 interact(){
  if(!this.interaction)return false;
  if(this.stage==='pickup'){this.stage='delivery';this.notice='북쪽 중계소로 출발하세요. 청록색 표식은 안전한 계곡길입니다.';}
  else if(distance(this,RELAY)<7){
   this.stage='complete';this.speed=0;this.notice='전력이 돌아왔습니다. 이제 이 계곡에서도 무전을 받을 수 있습니다.';
  }else{this.shelterUsed=true;this.stamina=100;this.balance=100;this.notice='쉼터 연결 완료. 체력과 균형을 회복했습니다.';}
  return true;
 }
 tick(dt,input={}){
  if(!Number.isFinite(dt)||dt<=0||this.stage==='complete')return;
  dt=Math.min(dt,.05);this.elapsed+=dt;this.cooldown=Math.max(0,this.cooldown-dt);
  let dx=Number.isFinite(input.x)?clamp(input.x,-1,1):0,dz=Number.isFinite(input.z)?clamp(input.z,-1,1):0;
  const length=Math.hypot(dx,dz),strength=Math.min(1,length);if(length>0){dx/=length;dz/=length;}
  const moving=length>.01,loaded=this.stage==='delivery',mass=loaded?this.mass:0;
  this.bracing=!!input.brace;const slope=this.slope;
  const running=!!input.sprint&&this.stamina>5&&!this.bracing&&moving&&strength>.65;
  const pace=(running?5.6:3.15)/(1+mass*.014)*(this.bracing?.57:1)/(1+slope*.9);
  const speed=moving?pace*strength:0;this.speed+=(speed-this.speed)*(1-Math.exp(-dt*10));
  const previous={x:this.x,z:this.z};
  if(moving){
   this.x=clamp(this.x+dx*this.speed*dt,-72,72);this.z=clamp(this.z+dz*this.speed*dt,-124,61);
   this.heading=Math.atan2(-dx,-dz);
   for(const rock of ROCKS){
    const rx=this.x-rock.x,rz=this.z-rock.z,d=Math.hypot(rx,rz),radius=rock.r+.42;
    if(d<radius){this.x=rock.x+(d?rx/d:1)*radius;this.z=rock.z+(d?rz/d:0)*radius;}
   }
  }
  for(const cabin of CABINS){
   const left=cabin.x-cabin.hx-.4,right=cabin.x+cabin.hx+.4,near=cabin.z-cabin.hz-.4,far=cabin.z+cabin.hz+.4;
   if(this.x>left&&this.x<right&&this.z>near&&this.z<far){
    const pushes=[{d:this.x-left,axis:'x',value:left},{d:right-this.x,axis:'x',value:right},{d:this.z-near,axis:'z',value:near},{d:far-this.z,axis:'z',value:far}];
    const exit=pushes.reduce((a,b)=>a.d<b.d?a:b);this[exit.axis]=exit.value;
   }
  }
  this.steps+=distance(this,previous);this.y=heightAt(this.x,this.z);
  this.stamina=clamp(this.stamina+dt*(running?-(8+mass*.15+slope*7):(!moving?15:this.bracing?7:3)),0,100);
  const risk=loaded&&moving&&!this.bracing?(Math.max(0,slope-.22)*22+(running?8:0))*(mass/18):0;
  this.balance=clamp(this.balance+dt*((this.bracing?25:(!moving?23:7))-risk),0,100);
  if(this.balance<8&&this.cooldown===0){
   this.condition=Math.max(1,this.condition-(this.mass===32?12:8));this.stumbles++;this.balance=48;this.cooldown=2.5;
   this.notice='발을 헛디뎠습니다. Space로 짐을 붙잡고 천천히 이동하세요.';
  }
  if(loaded){
   const route=ROUTES[this.route];
   if(this.waypoint<route.length-1&&distance(this,route[this.waypoint])<8)this.waypoint++;
  }
 }
 snapshot(){return {x:this.x,z:this.z,stage:this.stage,mass:this.mass,stamina:this.stamina,balance:this.balance,condition:this.condition,elapsed:this.elapsed,stumbles:this.stumbles,shelterUsed:this.shelterUsed,route:this.route,waypoint:this.waypoint};}
}
