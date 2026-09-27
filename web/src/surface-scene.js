import * as T from '../vendor/three.module.min.js';
import {DEPOT,RELAY,SHELTER,ROUTES,ROCKS,heightAt,pathDistance,clamp} from './surface-world.js';
const material=(color,extra={})=>new T.MeshStandardMaterial({color,roughness:.88,...extra});
function box(parent,size,position,mat){const mesh=new T.Mesh(new T.BoxGeometry(...size),mat);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function sphere(parent,r,position,mat){const mesh=new T.Mesh(new T.SphereGeometry(r,16,12),mat);mesh.position.set(...position);mesh.castShadow=true;parent.add(mesh);return mesh;}
function cylinder(parent,top,bottom,height,position,mat){const mesh=new T.Mesh(new T.CylinderGeometry(top,bottom,height,12),mat);mesh.position.set(...position);mesh.castShadow=true;parent.add(mesh);return mesh;}
function courier(){
 const root=new T.Group(),body=new T.Group();root.add(body);
 const suit=material(0xc7cdbb),dark=material(0x273c3e),trim=material(0xde7846),boots=material(0x233033),glass=material(0x284b55,{metalness:.8,roughness:.19});
 box(body,[.64,.76,.4],[0,1.32,0],suit);box(body,[.69,.16,.45],[0,.93,0],dark);
 box(body,[.43,.38,.035],[0,1.42,-.218],dark);box(body,[.17,.055,.04],[.1,1.51,-.24],trim);
 const helmet=sphere(body,.3,[0,1.99,0],suit);helmet.scale.set(1,1.05,.96);
 const visor=sphere(body,.256,[0,2,-.105],glass);visor.scale.set(1,.66,.84);
 box(body,[.13,.18,.31],[-.3,1.98,0],dark);box(body,[.13,.18,.31],[.3,1.98,0],dark);
 const legs=[],arms=[];
 for(const side of [-1,1]){
  const leg=new T.Group();leg.position.set(side*.19,.9,0);body.add(leg);
  box(leg,[.25,.42,.26],[0,-.22,0],suit);const shin=new T.Group();shin.position.y=-.43;leg.add(shin);
  box(shin,[.225,.35,.24],[0,-.16,0],dark);box(shin,[.28,.16,.43],[0,-.36,-.065],boots);legs.push({leg,shin});
  const arm=new T.Group();arm.position.set(side*.43,1.65,0);body.add(arm);
  box(arm,[.23,.37,.27],[0,-.18,0],suit);box(arm,[.24,.09,.28],[0,-.12,0],trim);
  const forearm=new T.Group();forearm.position.y=-.36;arm.add(forearm);forearm.rotation.x=-.25;
  box(forearm,[.2,.3,.23],[0,-.14,0],dark);sphere(forearm,.12,[0,-.33,0],boots);arms.push({arm,forearm});
  box(body,[.07,.8,.055],[side*.22,1.33,-.24],dark);
 }
 const cargo=new T.Group();body.add(cargo);box(cargo,[.71,.85,.51],[0,1.42,.45],dark);
 function crate(y){
  const g=new T.Group();g.position.set(0,y,.48);cargo.add(g);
  box(g,[.74,.45,.58],[0,0,0],trim);box(g,[.62,.34,.025],[0,0,.3],suit);
  for(const x of [-.25,.25])box(g,[.055,.46,.6],[x,0,0],dark);
  box(g,[.15,.06,.03],[0,0,.32],material(0xd5f8dc,{emissive:0x8dd4b0,emissiveIntensity:.6}));return g;
 }
 crate(1.38);crate(1.88);const extra=crate(2.38);
 return {root,body,legs,arms,cargo,extra};
}
function station(scene,point,type){
 const root=new T.Group();root.position.set(point.x+5,heightAt(point.x+5,point.z),point.z);scene.add(root);
 const concrete=material(0x727c73),dark=material(0x293e3f),white=material(0xbdc4b5),orange=material(0xc77849);
 box(root,[7,.35,6],[0,.15,0],concrete);box(root,[4.7,2.6,3.6],[0,1.6,.3],dark);box(root,[5.3,.25,4.2],[0,3.05,.3],white);
 box(root,[2.6,1.3,.07],[0,1.9,2.13],material(0x375756,{metalness:.4}));
 for(const x of [-2.2,2.2])box(root,[.25,2.9,3.7],[x,1.6,.3],white);
 const lamp=material(type==='depot'?0xb8efb1:0x7b5e48,{emissive:type==='depot'?0xb8efb1:0x000000,emissiveIntensity:.8});
 box(root,[2.5,.08,.1],[0,2.85,2.2],lamp);
 cylinder(root,.06,.12,8,[1.7,6,0],dark);
 const ring=new T.Mesh(new T.TorusGeometry(1,.06,6,32),orange);ring.position.set(1.7,9,0);ring.rotation.x=.25;root.add(ring);
 for(const x of [-.35,.35])box(root,[.26,1.8,.3],[-3.7+x,1,0],white);
 box(root,[1.2,.6,.65],[-3.7,1.55,0],dark);box(root,[.78,.32,.04],[-3.7,1.6,.35],lamp);
 if(type==='depot')for(let i=0;i<4;i++)box(root,[.65,.6,.7],[-1.4+(i%2)*.8,.65+Math.floor(i/2)*.62,3],orange);
 return {root,lamp};
}
export class SurfaceScene {
 constructor(canvas){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.6));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=T.PCFSoftShadowMap;
  this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
  this.scene=new T.Scene();this.scene.background=new T.Color(0xa6b8ad);this.scene.fog=new T.Fog(0xa6b8ad,45,195);
  this.camera=new T.PerspectiveCamera(52,1,.1,450);this.yaw=0;this.pitch=.31;this.zoom=7.8;
  this.scene.add(new T.HemisphereLight(0xe2eee6,0x424d39,1.2));
  this.sun=new T.DirectionalLight(0xffedcd,2.0);this.sun.position.set(-35,65,-40);this.sun.castShadow=true;
  this.sun.shadow.mapSize.set(1024,1024);this.sun.shadow.camera.left=-18;this.sun.shadow.camera.right=18;this.sun.shadow.camera.top=18;this.sun.shadow.camera.bottom=-18;this.sun.shadow.camera.far=180;this.sun.shadow.normalBias=.045;this.scene.add(this.sun,this.sun.target);
  const ground=new T.PlaneGeometry(190,230,160,190);ground.rotateX(-Math.PI/2);ground.translate(0,0,-30);
  const positions=ground.attributes.position,colors=[];const color=new T.Color();
  for(let i=0;i<positions.count;i++){
   const x=positions.getX(i),z=positions.getZ(i),h=heightAt(x,z);positions.setY(i,h);
   const trail=Math.exp(-((pathDistance(x,z)/2)**2)),grain=Math.sin(x*2.1+z*.74)*.025;
   color.setRGB(.235+h*.006+trail*.065+grain,.285+h*.004+trail*.045+grain,.21+h*.006+trail*.035+grain);colors.push(color.r,color.g,color.b);
  }
  ground.setAttribute('color',new T.Float32BufferAttribute(colors,3));ground.computeVertexNormals();
  const terrain=new T.Mesh(ground,material(0xffffff,{vertexColors:true}));terrain.receiveShadow=true;this.scene.add(terrain);
  const rockMat=material(0x66736a),rockGeo=new T.DodecahedronGeometry(1,0);
  const rocks=new T.InstancedMesh(rockGeo,rockMat,ROCKS.length),dummy=new T.Object3D();
  ROCKS.forEach((r,i)=>{dummy.position.set(r.x,heightAt(r.x,r.z)+r.r*.3,r.z);dummy.scale.set(r.r,r.r*.78,r.r);dummy.rotation.set(i*.17,i*2.4,i*.34);dummy.updateMatrix();rocks.setMatrixAt(i,dummy.matrix);});
  rocks.castShadow=true;rocks.receiveShadow=true;this.scene.add(rocks);
  for(let i=0;i<28;i++){
   const x=i%2?-100-(i%5)*9:100+(i%4)*12,z=62-i*9,h=24+(Math.sin(i*8)*.5+.5)*42;
   const mesh=new T.Mesh(new T.ConeGeometry(25+i%7*4,h,5),material(0x637d76));mesh.position.set(x,h*.38-3,z);mesh.rotation.y=i*1.7;this.scene.add(mesh);
  }
  for(let i=0;i<11;i++){
   const h=25+(i%3)*13,mesh=new T.Mesh(new T.ConeGeometry(35,h,5),material(0x738c83));mesh.position.set(-150+i*30,h*.34,-165);mesh.rotation.y=i;this.scene.add(mesh);
  }
  const moon=new T.Mesh(new T.SphereGeometry(16,32,24),new T.MeshBasicMaterial({color:0xdce3ce,fog:false}));moon.position.set(85,95,-230);this.scene.add(moon);
  const stalkGeo=new T.ConeGeometry(.1,.48,3),grass=new T.InstancedMesh(stalkGeo,material(0x727d51),1100);
  for(let i=0;i<1100;i++){
   const x=Math.sin(i*137.3)*74,z=-120+(Math.sin(i*53.7)*.5+.5)*180;
   dummy.position.set(x,heightAt(x,z)+.18,z);dummy.scale.setScalar(pathDistance(x,z)<2?.1:.8+(i%7)*.15);dummy.rotation.set(0,i,0);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
  }
  this.scene.add(grass);
  const pole=material(0x283e38),marker=material(0xb7ebc6,{emissive:0x83bf9d,emissiveIntensity:.4});
  const route=ROUTES.valley;
  for(let i=1;i<route.length;i++){
   const a=route[i-1],b=route[i],length=Math.hypot(b.x-a.x,b.z-a.z);
   for(let d=3;d<length;d+=9){const t=d/length,x=a.x+(b.x-a.x)*t+2.3,z=a.z+(b.z-a.z)*t,y=heightAt(x,z);cylinder(this.scene,.035,.05,.75,[x,y+.375,z],pole);box(this.scene,[.19,.12,.1],[x,y+.72,z],marker);}
  }
  this.depot=station(this.scene,DEPOT,'depot');this.relay=station(this.scene,RELAY,'relay');
  this.shelter=new T.Group();this.shelter.position.set(SHELTER.x+4,heightAt(SHELTER.x+4,SHELTER.z),SHELTER.z);this.scene.add(this.shelter);
  const shelterMat=material(0x9da88d);for(const x of [-1.4,1.4])box(this.shelter,[.15,2.5,3],[x,1.25,0],pole);box(this.shelter,[3.2,.15,3.3],[0,2.5,0],shelterMat);box(this.shelter,[2,.35,.6],[0,.5,1],shelterMat);
  this.shelterLamp=material(0x886d4c,{emissive:0x000000});box(this.shelter,[1,.09,.09],[0,2.25,1.5],this.shelterLamp);
  this.person=courier();this.scene.add(this.person.root);this.camera.position.set(8,7,DEPOT.z+12);
  this.shadow=new T.Mesh(new T.CircleGeometry(.62,24),new T.MeshBasicMaterial({color:0x14241b,transparent:true,opacity:.23,depthWrite:false}));this.shadow.rotation.x=-Math.PI/2;this.scene.add(this.shadow);
  this.resize();this.resizeHandler=()=>this.resize();window.addEventListener('resize',this.resizeHandler);
 }
 resize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight,false);}
 orbit(dx,dy){this.yaw-=dx*.005;this.pitch=clamp(this.pitch+dy*.003,.12,.8);}
 project(point){const v=new T.Vector3(point.x,heightAt(point.x,point.z)+3,point.z).project(this.camera);return {x:(v.x*.5+.5)*innerWidth,y:(-.5*v.y+.5)*innerHeight,visible:v.z<1&&v.z>-1};}
 update(game,dt,playing){
  const p=this.person,walk=game.steps*3.5,motion=Math.min(1,game.speed/2),loaded=game.stage!=='pickup';
  p.root.position.set(game.x,game.y+.035,game.z);p.root.rotation.y+=Math.atan2(Math.sin(game.heading-p.root.rotation.y),Math.cos(game.heading-p.root.rotation.y))*(1-Math.exp(-dt*12));
  p.body.position.y=Math.sin(walk*2)*.025*motion;
  p.body.rotation.x=loaded?-.08-(game.bracing?.1:0):0;
  p.body.rotation.z=Math.sin(walk)*.025*motion+(game.cooldown>1.7?Math.sin(game.cooldown*13)*.16:0);
  p.legs.forEach(({leg,shin},i)=>{const swing=Math.sin(walk+i*Math.PI);leg.rotation.x=swing*.55*motion;shin.rotation.x=Math.max(0,-swing)*.55*motion;});
  p.arms.forEach(({arm,forearm},i)=>{arm.rotation.x=game.bracing?-1.05:-Math.sin(walk+i*Math.PI)*.35*motion;forearm.rotation.x=game.bracing?-1.1:-.25;});
  p.cargo.visible=loaded&&game.stage!=='complete';p.extra.visible=game.mass===32;
  this.shadow.position.set(game.x,game.y+.035,game.z);
  const target=new T.Vector3(game.x,game.y+1.5,game.z);
  const offset=playing?new T.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch)*this.zoom,Math.sin(this.pitch)*this.zoom,Math.cos(this.yaw)*Math.cos(this.pitch)*this.zoom):new T.Vector3(6,3.8,8);
  const desired=target.clone().add(offset);desired.y=Math.max(desired.y,heightAt(desired.x,desired.z)+1.1);
  this.camera.position.lerp(desired,1-Math.exp(-dt*5));this.camera.lookAt(target);
  this.sun.position.set(game.x-30,game.y+60,game.z-25);this.sun.target.position.set(game.x,game.y,game.z);
  if(game.stage==='complete'){this.relay.lamp.color.set(0xb6ffca);this.relay.lamp.emissive.set(0xb6ffca);}
  else{this.relay.lamp.color.set(0x7b5e48);this.relay.lamp.emissive.set(0x000000);}
  this.shelterLamp.color.set(game.shelterUsed?0xb6ffca:0x886d4c);this.shelterLamp.emissive.set(game.shelterUsed?0xb6ffca:0x000000);
  this.renderer.render(this.scene,this.camera);
 }
}
