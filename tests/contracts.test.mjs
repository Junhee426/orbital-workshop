import test from 'node:test';
import assert from 'node:assert/strict';
import {Mission} from '../web/src/mission.js';
import {CONTRACTS,isUnlocked} from '../web/src/contracts.js';
import {freshProfile,award,purchaseUpgrade,decodeSave,encodeSave,SaveStore,SAVE_KEY} from '../web/src/storage.js';
import {resolveCollision} from '../web/src/physics.js';
import {tutorialFor} from '../web/src/tutorial.js';
const step=(game,seconds,input={})=>{for(let i=0;i<Math.ceil(seconds*60);i++)game.tick(1/60,input);};
function repairToRelease(id){
 const game=new Mission({contractId:id});game.pos=game.dockPosition();assert.equal(game.capture(),true);
 for(const part of CONTRACTS[id].scans){assert.equal(game.act(part),true);step(game,1.5);}
 assert.equal(game.stage,'diagnose');assert.equal(game.diagnose('unknown'),false);
 assert.equal(game.diagnose(CONTRACTS[id].answer),true);game.act('power');step(game,1.1);game.act('brace');step(game,1.3);
 assert.equal(game.stage,'release');return game;
}
for(const id of Object.keys(CONTRACTS))test(`${id}: correct evidence, repair, save/resume and completion`,()=>{
 const config=CONTRACTS[id];let game=repairToRelease(id);
 step(game,1,{repairHeld:true,part:'drive'});assert.equal(game.repairProgress,0);
 if(config.range){game.torque=0;step(game,1,{repairHeld:true,part:config.repairPart});assert.equal(game.repairProgress,0);game.torque=(config.range[0]+config.range[1])/2;}
 step(game,1,{repairHeld:true,part:config.repairPart});assert.ok(game.repairProgress>0);
 game=decodeSave(encodeSave(freshProfile(),game)).mission;assert.equal(game.contractId,id);
 step(game,config.duration,{repairHeld:true,part:config.repairPart});assert.equal(game.stage,'restore');
 game.act('power');game.act('power');step(game,2);assert.equal(game.stage,'test');
 game=Mission.restore(game.snapshot());assert.equal(game.job,null);game.act('power');step(game,6.1);
 assert.equal(game.stage,'complete');assert.equal(game.signal,1);assert.equal(game.panel,1);
 const profile=freshProfile();assert.equal(award(profile,game),config.baseReward+100);assert.equal(award(profile,game),0);
 assert.deepEqual(profile.completedContracts,[id]);assert.ok(profile.bestTimes[id]>0);
});
test('contracts unlock in sequence and training grants no progression',()=>{
 const p=freshProfile();assert.equal(isUnlocked(p,'solar'),true);assert.equal(isUnlocked(p,'battery'),false);
 const g=new Mission();g.stage='complete';award(p,g);assert.equal(isUnlocked(p,'battery'),true);assert.equal(isUnlocked(p,'antenna'),false);
 const training=new Mission({training:true,contractId:'battery'});training.stage='complete';const before=structuredClone(p);
 assert.equal(award(p,training),0);assert.deepEqual(p,before);
 const battery=new Mission({contractId:'battery'});battery.stage='complete';award(p,battery);assert.equal(isUnlocked(p,'antenna'),true);
});
test('equipment purchases charge once, and fuel and armor have measurable effects',()=>{
 const p=freshProfile();assert.equal(purchaseUpgrade(p,'shield'),false);p.credits=1000;
 for(const id of ['precision','efficiency','shield']){assert.equal(purchaseUpgrade(p,id),true);assert.equal(purchaseUpgrade(p,id),false);}
 assert.equal(p.credits,260);assert.equal(purchaseUpgrade(p,'unknown'),false);
 const base=new Mission(),efficient=new Mission({efficiency:true});step(base,5,{forward:1});step(efficient,5,{forward:1});
 assert.ok(Math.abs((100-efficient.fuel)/(100-base.fuel)-.65)<1e-8);assert.deepEqual(base.pos,efficient.pos);
 const armored=new Mission({shield:true}),plain=new Mission();
 for(const g of [armored,plain]){g.omega=0;g.pos=[0,0,2.76];g.vel=[0,0,-2];g.tick(1/60);}
 assert.equal(plain.impacts,1);assert.ok(Math.abs((100-armored.integrity)*2-(100-plain.integrity))<1e-8);
});
test('contact preserves tangential velocity and resolves both solar wings',()=>{
 const hit=resolveCollision([0,0,2.7],[1,0,-2],0,0,0);assert.equal(hit.velocity[0],1);assert.ok(hit.velocity[2]>0);assert.ok(hit.position[2]>2.75);
 const retreat=resolveCollision([0,0,2.7],[0,0,1],0,0,0);assert.deepEqual(retreat.velocity,[0,0,1]);
 for(const x of [-3.48,3.48]){const wing=resolveCollision([x,0,.6],[0,0,-2],0,0,1);assert.equal(wing.contact,true);assert.ok(wing.position[2]>.8);}
 const origin=resolveCollision([0,0,0],[0,0,0],0,0,0);assert.ok(origin.position.every(Number.isFinite));
});
test('pitch rate contributes to port speed and angular capture checks',()=>{
 const g=new Mission();g.pos=g.dockPosition();g.pitchRate=.2;
 assert.equal(g.metrics().ready,false);assert.ok(g.metrics().spin>.19);
 g.yaw=.7;g.pitch=.2;g.yawRate=.11;g.pitchRate=.13;g.omega=0;g.vel=[0,0,0];
 const f=g.forward(),epsilon=1e-6;g.yaw+=g.yawRate*epsilon;g.pitch+=g.pitchRate*epsilon;
 const numerical=Math.hypot(...g.forward().map((v,i)=>(v-f[i])*1.6/epsilon));
 g.yaw-=g.yawRate*epsilon;g.pitch-=g.pitchRate*epsilon;
 assert.ok(Math.abs(g.metrics().speed-numerical)<1e-6);
});
test('tutorial follows real movement and braking',()=>{
 const g=new Mission();assert.match(tutorialFor(g).title,/1 \/ 3/);step(g,.4,{forward:1});assert.match(tutorialFor(g).title,/2 \/ 3/);
 step(g,.2,{brake:true});assert.match(tutorialFor(g).title,/3 \/ 3/);
});
test('v1 saves migrate without losing credits, precision or current mission',()=>{
 const g=new Mission().snapshot();delete g.contractId;delete g.tutorial;
 const saved=decodeSave(JSON.stringify({version:1,profile:{credits:320,precision:true,completed:1,awardedRuns:['past']},active:g}));
 assert.equal(saved.profile.credits,320);assert.equal(saved.profile.precision,true);assert.deepEqual(saved.profile.completedContracts,['solar']);assert.equal(saved.mission.contractId,'solar');
 assert.ok(decodeSave(encodeSave(saved.profile,saved.mission)));
});
test('import validates before writing and preserves current save when persistence fails',()=>{
 const original=encodeSave(freshProfile(),new Mission()),data=new Map([[SAVE_KEY,original]]);
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)},store=new SaveStore(()=>storage);store.load();
 assert.throws(()=>store.importSave('{bad'));assert.equal(data.size,1);
 const next=encodeSave({...freshProfile(),credits:900},new Mission({contractId:'battery'}));
 const write=storage.setItem;storage.setItem=(key,value)=>{if(key===SAVE_KEY)throw new Error('quota');write(key,value);};
 assert.throws(()=>store.importSave(next));assert.equal(data.get(SAVE_KEY),original);
 storage.setItem=write;const imported=store.importSave(next);assert.equal(imported.profile.credits,900);
 assert.ok([...data].some(([key,value])=>key!==SAVE_KEY&&value===original));
 assert.equal(decodeSave(data.get(SAVE_KEY)).mission.contractId,'battery');
});
