import {contractFor,availableParts} from './contracts.js';
import * as T from '../vendor/three.module.min.js';
const C={ivory:0xc8c8b6,dark:0x26313b,orange:0xef9a4b,blue:0x123450,gold:0x9e7841,green:0x91dfb3};
const mat=(color,metalness=.35,roughness=.6)=>new T.MeshStandardMaterial({color,metalness,roughness});
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
function box(parent,size,pos,material){const m=new T.Mesh(new T.BoxGeometry(...size),material);m.position.set(...pos);parent.add(m);return m;}
function cyl(parent,r1,r2,height,pos,material){const m=new T.Mesh(new T.CylinderGeometry(r1,r2,height,20),material);m.position.set(...pos);parent.add(m);return m;}
function torus(parent,r,t,pos,material){const m=new T.Mesh(new T.TorusGeometry(r,t,8,48),material);m.position.set(...pos);parent.add(m);return m;}
function label(text,width=2,height=.6){
 const c=document.createElement('canvas');c.width=512;c.height=128;const x=c.getContext('2d');
 x.fillStyle='#c9cecd';x.font='bold 40px monospace';x.textAlign='center';x.textBaseline='middle';x.fillText(text,256,64);
 const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
 return new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false}));
}
function panelMaterial(){
 const c=document.createElement('canvas');c.width=768;c.height=384;const x=c.getContext('2d');
 x.fillStyle='#244250';x.fillRect(0,0,768,384);
 for(let i=0;i<12;i++)for(let j=0;j<6;j++){
  const gx=i*64+3,gy=j*64+3;const g=x.createLinearGradient(gx,gy,gx+60,gy+60);
  g.addColorStop(0,'#183b60');g.addColorStop(.5,'#294e73');g.addColorStop(1,'#102943');x.fillStyle=g;x.fillRect(gx,gy,58,58);
  x.strokeStyle='#7697b566';x.lineWidth=.6;
  for(let k=1;k<6;k++){x.beginPath();x.moveTo(gx+k*9,gy);x.lineTo(gx+k*9,gy+58);x.stroke();}
 }
 const tex=new T.CanvasTexture(c);tex.colorSpace=T.SRGBColorSpace;tex.anisotropy=4;
 return new T.MeshStandardMaterial({map:tex,metalness:.62,roughness:.37});
}
function satellite(){
 const root=new T.Group(),white=mat(C.ivory),dark=mat(C.dark),gold=mat(C.gold,.7,.4),orange=mat(C.orange),solar=panelMaterial();
 box(root,[2.4,1.9,1.9],[0,0,0],white);
 for(const x of [-1.24,1.24])box(root,[.1,1.75,1.65],[x,0,0],gold);
 for(const y of [-.98,.98])box(root,[2.55,.12,2.05],[0,y,0],dark);
 for(const x of [-1.08,1.08])for(const y of [-.78,.78]){
  box(root,[.18,.24,.15],[x,y,1.02],orange);
  const screw=cyl(root,.045,.045,.08,[x,y,1.12],dark);screw.rotation.x=Math.PI/2;
 }
 const plate=label('METEO · 07',1.3,.33);plate.position.set(0,.64,1.03);root.add(plate);
 const docking=torus(root,.42,.085,[0,-.12,1.25],mat(0xe0a252,.6,.3));
 const insert=cyl(root,.32,.32,.12,[0,-.12,1.16],dark);insert.rotation.x=Math.PI/2;
 const light=new T.MeshBasicMaterial({color:0xefab58});
 const status=box(root,[.26,.07,.04],[.74,.63,1.02],light);
 function wing(side){
  const pivot=new T.Group();pivot.position.set(side*1.3,0,0);root.add(pivot);
  box(pivot,[.8,.12,.16],[side*.4,0,0],dark);
  box(pivot,[3.5,1.7,.09],[side*2.18,0,0],dark);
  box(pivot,[3.37,1.57,.105],[side*2.18,0,.015],solar);
  for(const n of [-1,1])box(pivot,[3.52,.035,.14],[side*2.18,n*.86,0],white);
  box(pivot,[.04,1.75,.14],[side*2.18,0,0],white);
  return pivot;
 }
 wing(-1);const folded=wing(1);folded.rotation.y=-1.34;
 const hinge=cyl(root,.23,.23,.55,[1.3,0,0],orange);hinge.rotation.x=Math.PI/2;
 const power=box(root,[.34,.3,.14],[-.67,.19,1.08],dark);
 const switchHandle=box(root,[.07,.21,.11],[-.67,.22,1.22],orange);
 const latch=box(root,[.4,.13,.13],[1.32,-.42,1.09],orange);
 box(root,[.12,.45,.12],[1.22,-.48,.97],dark);
 const antenna=new T.Group();antenna.position.set(0,1.03,0);root.add(antenna);
 cyl(antenna,.08,.11,.55,[0,.2,0],dark);
 const dish=new T.Mesh(new T.SphereGeometry(.65,24,12,0,Math.PI*2,0,.9),white);dish.position.y=.45;dish.rotation.x=.5;antenna.add(dish);
 cyl(antenna,.03,.035,.75,[0,.8,0],orange);
 const battery=box(root,[.55,.38,.24],[-.65,-.45,1.13],mat(C.orange));
 const parts={battery:V(-.65,-.45,1.4),antenna:V(0,2.05,.45),power:V(-.67,.26,1.27),drive:V(1.3,.38,1.13),brace:V(1.17,-.08,1.18),latch:V(1.44,-.46,1.2)};
 const markers={};
 for(const [id,p] of Object.entries(parts)){
  const marker=torus(root,.18,.014,p.toArray(),new T.MeshBasicMaterial({color:0xf1b174,transparent:true,opacity:.7,depthTest:false}));
  markers[id]=marker;
 }
 return {root,folded,docking,status,switchHandle,latch,antenna,battery,plate,parts,markers};
}
function tug(){
 const root=new T.Group(),white=mat(0xc9d0cd),dark=mat(0x263847),orange=mat(C.orange),metal=mat(0x6f8594,.8,.3);
 box(root,[1.5,.8,2.1],[0,0,0],white);
 box(root,[1.2,.6,.95],[0,.56,-.25],dark);
 box(root,[1.04,.33,.04],[0,.59,-.74],new T.MeshStandardMaterial({color:0x518896,emissive:0x183b43,metalness:.75,roughness:.2}));
 box(root,[.9,.13,2.15],[0,-.43,0],orange);
 for(const x of [-.93,.93]){
  box(root,[.32,.65,1.55],[x,0,.15],dark);
  box(root,[.35,.11,1.6],[x,.37,.15],orange);
  const e=cyl(root,.25,.16,.44,[x,0,1.12],metal);e.rotation.x=Math.PI/2;
 }
 const dock=cyl(root,.22,.27,.4,[0,0,-1.25],dark);dock.rotation.x=Math.PI/2;
 torus(root,.24,.05,[0,0,-1.49],orange);
 const tag=label('OW — 01',1,.25);tag.position.set(0,.06,1.065);tag.rotation.y=Math.PI;root.add(tag);
 const plumes=[];
 for(const x of [-.93,.93]){
  const m=new T.Mesh(new T.ConeGeometry(.2,1.3,16),new T.MeshBasicMaterial({color:0x8bdef5,transparent:true,opacity:.7,depthWrite:false}));
  m.rotation.x=Math.PI/2;m.position.set(x,0,1.75);root.add(m);plumes.push(m);
 }
 box(root,[.1,.9,.1],[.56,.9,.55],dark);
 return {root,plumes};
}
const noiseShader=`
 float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm(vec3 p){return .53*noise(p)+.27*noise(p*2.03)+.13*noise(p*4.07)+.07*noise(p*8.11);}
`;
function makeEarth(scene){
 const uniforms={time:{value:0}};
 const planet=new T.Mesh(new T.SphereGeometry(86,96,64),new T.ShaderMaterial({uniforms,
  vertexShader:'varying vec3 vN; varying vec3 vP; void main(){vN=normal;vP=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:`varying vec3 vN;varying vec3 vP;uniform float time;${noiseShader}
  void main(){vec3 n=normalize(vN);float sun=dot(n,normalize(vec3(-.7,.75,.6)));float day=smoothstep(-.18,.4,sun);
  float land=fbm(n*3.6+vec3(1.3,2.1,0.));float coast=smoothstep(.49,.535,land);
  vec3 sea=mix(vec3(.014,.065,.14),vec3(.035,.24,.36),smoothstep(.39,.52,land));
  vec3 ground=mix(vec3(.07,.19,.16),vec3(.32,.32,.21),smoothstep(.52,.7,land));
  vec3 color=mix(sea,ground,coast);float clouds=smoothstep(.53,.65,fbm(n*9.+vec3(time*.003,0.,0.)));
  color=mix(color,vec3(.79,.88,.89),clouds*.88);color*=mix(.065,1.12,day);
  float cities=step(.77,noise(n*170.))*coast*(1.-day);color+=vec3(.8,.38,.08)*cities*.3;
  gl_FragColor=vec4(color,1.);}`
 }));
 planet.position.set(-15,-98,-112);scene.add(planet);
 const atmosphere=new T.Mesh(new T.SphereGeometry(87.5,64,48),new T.ShaderMaterial({
  vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
  fragmentShader:'varying vec3 n;varying vec3 v;void main(){float a=pow(1.-abs(dot(normalize(n),normalize(v))),4.);gl_FragColor=vec4(.12,.5,.85,a*.72);}',
  transparent:true,depthWrite:false,side:T.FrontSide,blending:T.AdditiveBlending
 }));atmosphere.position.copy(planet.position);scene.add(atmosphere);
 return uniforms;
}
function station(scene){
 const g=new T.Group(),m=mat(0x8a999e),dark=mat(C.dark),solar=panelMaterial();
 const b=cyl(g,.75,.75,7,[0,0,0],m);b.rotation.z=Math.PI/2;
 torus(g,2.6,.18,[0,0,0],dark).rotation.y=Math.PI/2;
 for(const x of [-3,3])for(const y of [-2,2]){box(g,[.08,4,.1],[x,0,0],m);box(g,[2.3,2.7,.08],[x,y,0],solar);}
 g.position.set(-23,8,-28);g.rotation.set(.2,.7,.25);scene.add(g);return g;
}
export class World {
 constructor(canvas){
  this.renderer=new T.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.7));
  this.renderer.outputColorSpace=T.SRGBColorSpace;this.renderer.toneMapping=T.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.3;
  this.scene=new T.Scene();this.scene.background=new T.Color(0x040b14);
  this.camera=new T.PerspectiveCamera(48,1,.1,1400);this.camera.position.set(10,6,16);
  this.scene.add(new T.HemisphereLight(0xa6c1de,0x32414e,2.1));
  const sun=new T.DirectionalLight(0xffe2b8,3.8);sun.position.set(-20,30,18);this.scene.add(sun);
  const fill=new T.DirectionalLight(0x7cbcf4,1.5);fill.position.set(5,-10,15);this.scene.add(fill);
  let seed=421;const rand=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const a=[],colors=[];for(let i=0;i<2200;i++){
   const z=rand()*2-1,p=rand()*Math.PI*2,r=Math.sqrt(1-z*z)*550;a.push(r*Math.cos(p),z*550,r*Math.sin(p));
   const v=.3+rand()*.65;colors.push(v*.8,v*.9,v);
  }
  const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(a,3));geom.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  this.scene.add(new T.Points(geom,new T.PointsMaterial({size:.8,sizeAttenuation:true,vertexColors:true,transparent:true,opacity:.85})));
  this.earth=makeEarth(this.scene);this.station=station(this.scene);
  this.sat=satellite();this.scene.add(this.sat.root);this.ship=tug();this.scene.add(this.ship.root);
  this.guides=new T.Group();this.sat.root.add(this.guides);
  for(const z of [4.2,7.5,11,15])torus(this.guides,.85,.012,[0,0,z],new T.MeshBasicMaterial({color:0x80cbbb,transparent:true,opacity:.2,depthWrite:false}));
  this.arm=new T.Group();this.scene.add(this.arm);this.armSegments=[];
  for(let i=0;i<2;i++){const b=cyl(this.arm,.075,.075,1,[0,0,0],mat(C.orange));this.armSegments.push(b);}
  this.gripper=box(this.arm,[.27,.2,.25],[0,0,0],mat(0x94a1a8));
  this.time=0;this.orbit={x:0,y:0,zoom:1};this.focus=V();this.lastMode=null;
  this.resize();
 }
 resize(){this.renderer.setSize(window.innerWidth,window.innerHeight);this.camera.aspect=window.innerWidth/window.innerHeight;this.camera.fov=window.innerWidth<760?55:48;this.camera.updateProjectionMatrix();}
 setQuality(low){this.renderer.setPixelRatio(low?1:Math.min(window.devicePixelRatio||1,1.7));this.resize();}
 project(v){const p=v.clone().project(this.camera);return{x:(p.x*.5+.5)*window.innerWidth,y:(-.5*p.y+.5)*window.innerHeight,visible:p.z<1&&p.z>-1&&Math.abs(p.x)<.97&&Math.abs(p.y)<.95};}
 partPosition(id){return this.sat.root.localToWorld(this.sat.parts[id].clone());}
 render(g,mode,selected,dt){
  this.time+=dt;this.earth.time.value=this.time;
  const playing=mode==='play'||mode==='result';
  const config=contractFor(playing?g.contractId:this.previewContract);
  if(this.lastContract!==config.id){
   this.sat.root.remove(this.sat.plate);this.sat.plate.geometry.dispose();this.sat.plate.material.map.dispose();this.sat.plate.material.dispose();
   this.sat.plate=label(config.satellite,1.3,.33);this.sat.plate.position.set(0,.64,1.03);this.sat.root.add(this.sat.plate);this.lastContract=config.id;
  }
  const a=playing?g.targetYaw:.22+Math.sin(this.time*.1)*.16;
  this.sat.root.rotation.y=a;
  const panel=playing?g.panel:config.id==='solar'?(mode==='hangar'&&g?.stage==='complete'?1:0):1;
  this.sat.folded.rotation.y=-1.34*(1-panel);
  this.sat.latch.position.x=1.32+(playing&&g.contractId==='solar'?g.repairProgress*.25:0);
  this.sat.switchHandle.rotation.z=playing&&!g.powerOn?Math.PI/2:0;
  this.sat.status.material.color.setHex(playing&&g.stage==='complete'?0x83dfb5:0xf2a958);
  this.sat.docking.material.color.setHex(playing&&g.stage!=='approach'?0x88cdaa:0xe0a252);
  this.sat.antenna.rotation.y=config.id==='antenna'?(playing&&g.repaired?0:playing&&g.stage==='release'?(g.torque-.72)*Math.PI:1.1):panel*.4;
  this.sat.battery.position.z=1.13+(playing&&config.id==='battery'?Math.sin(g.repairProgress*Math.PI)*.65:0);
  this.sat.battery.material.color.setHex(playing&&config.id==='battery'&&g.repaired?0x83dfb5:C.orange);
  this.guides.visible=playing&&g.stage==='approach';
  this.ship.root.position.set(...(playing?g.pos:[-7,-3,6]));
  this.ship.root.rotation.set(playing?g.pitch:0,playing?g.yaw:-.35,0,'YXZ');
  this.ship.plumes.forEach(p=>{p.visible=playing&&g.thrust>.05;p.scale.y=.7+g?.thrust*.6+Math.sin(this.time*40)*.1;});
  for(const [id,m] of Object.entries(this.sat.markers)){
   m.visible=playing&&availableParts(g).includes(id);
   m.material.opacity=id===selected?.95:.2;m.scale.setScalar(id===selected?1.05+Math.sin(this.time*4)*.08:1);
  }
  this.arm.visible=playing&&g.braced;
  if(this.arm.visible){
   this.ship.root.updateMatrixWorld();this.sat.root.updateMatrixWorld();
   const start=this.ship.root.localToWorld(V(.9,.25,-.45)),end=this.partPosition('brace'),mid=start.clone().add(end).multiplyScalar(.5).add(V(1,.65,0));
   [[start,mid],[mid,end]].forEach(([p,q],i)=>{const d=q.clone().sub(p),m=this.armSegments[i];m.position.copy(p).add(q).multiplyScalar(.5);m.scale.y=d.length();m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());});
   this.gripper.position.copy(end);
  }
  let desired=V(),focus=V();
  const mobile=window.innerWidth<760;
  if(!playing){desired.set(mobile?11:10,mobile?8:5.5,mobile?23:16);focus.set(mobile?0:-3.8,0,0);}
  else if(g.stage==='approach'){
   const a=g.yaw+this.orbit.x;
   const lateral=mobile?1.5:4.3,back=mobile?10:7.8,height=mobile?4.2:3.1;
   const off=V((lateral*Math.cos(a)+back*Math.sin(a))*this.orbit.zoom,(height+this.orbit.y*4)*this.orbit.zoom,(-lateral*Math.sin(a)+back*Math.cos(a))*this.orbit.zoom);
   desired.copy(this.ship.root.position).add(off);focus.copy(this.ship.root.position).multiplyScalar(.45);
  }else{
   const angle=.56+this.orbit.x,r=(mobile?16:11.5)*this.orbit.zoom;
   desired.set(Math.sin(angle)*r,(.32+this.orbit.y*.5)*r,Math.cos(angle)*r);focus.set(0,.1,0);
  }
  if(this.lastMode!==mode){this.camera.position.copy(desired);this.focus.copy(focus);this.lastMode=mode;}
  this.camera.position.lerp(desired,1-Math.exp(-dt*5));this.focus.lerp(focus,1-Math.exp(-dt*5));this.camera.lookAt(this.focus);
  this.scene.updateMatrixWorld();this.renderer.render(this.scene,this.camera);
 }
}
