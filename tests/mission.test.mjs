import test from 'node:test';
import assert from 'node:assert/strict';
import {Mission} from '../web/src/mission.js';
import {award,freshProfile,purchasePrecision,decodeSave,encodeSave} from '../web/src/storage.js';
function step(g,seconds,input={}) {for(let t=0;t<seconds;t+=1/60)g.tick(1/60,input);}
function dock(){const g=new Mission();g.pos=g.dockPosition();assert.equal(g.capture(),true);return g;}
function diagnose(g){g.act('power');step(g,1.5);g.act('drive');step(g,1.5);assert.equal(g.stage,'diagnose');g.diagnose('latch');}

test('thrust accelerates, releasing preserves inertia, braking reduces relative speed',()=>{
 const g=new Mission();step(g,1,{forward:1});assert.ok(g.vel[2]<-.9);const speed=Math.hypot(...g.vel),fuel=g.fuel;
 step(g,.5);assert.ok(Math.abs(Math.hypot(...g.vel)-speed)<1e-9);assert.equal(g.fuel,fuel);
 step(g,1,{brake:true});assert.ok(Math.hypot(...g.vel)<.02);assert.ok(g.fuel<fuel);
});
test('capture refuses excessive distance, speed, misalignment and relative rotation',()=>{
 const g=new Mission();assert.equal(g.capture(),false);g.pos=g.dockPosition();g.vel=[0,0,-1];assert.equal(g.capture(),false);
 g.vel=[0,0,0];g.yaw=.4;assert.equal(g.capture(),false);g.yaw=0;g.yawRate=1;assert.equal(g.capture(),false);
 g.yawRate=0;assert.equal(g.capture(),true);assert.equal(g.stage,'survey');
});
test('diagnosis requires both evidence scans; wrong answer remains recoverable',()=>{
 const g=dock();assert.equal(g.diagnose('latch'),false);g.act('power');step(g,1.5);assert.equal(g.stage,'survey');
 g.act('drive');step(g,1.5);assert.equal(g.diagnose('battery'),false);assert.equal(g.stage,'diagnose');
 assert.equal(g.diagnose('latch'),true);assert.equal(g.stage,'isolate');
});
test('full repair requires isolation, bracing, safe torque, reconnection, and timed test',()=>{
 const g=dock();diagnose(g);assert.equal(g.act('brace'),false);g.act('power');step(g,1.1);assert.equal(g.powerOn,false);
 g.act('brace');step(g,1.3);assert.equal(g.stage,'release');assert.equal(g.act('power'),false);
 g.torque=.9;step(g,4,{repairHeld:true,part:'latch'});assert.equal(g.repairProgress,0);
 g.torque=.5;step(g,1,{repairHeld:true,part:'power'});assert.equal(g.repairProgress,0);
 step(g,3.1,{repairHeld:true,part:'latch'});assert.equal(g.stage,'restore');assert.equal(g.repaired,true);
 g.act('power');assert.equal(g.stage,'test');assert.equal(g.powerOn,true);g.act();step(g,2);assert.ok(g.panel>0&&g.panel<1);
 step(g,4.2);assert.equal(g.stage,'complete');assert.equal(g.signal,1);assert.equal(g.panel,1);
 const p=freshProfile();assert.equal(award(p,g),500);assert.equal(award(p,g),0);assert.equal(p.credits,500);
 assert.equal(purchasePrecision(p),true);assert.equal(p.credits,320);assert.equal(purchasePrecision(p),false);
});
test('saving restarts unfinished timed jobs and preserves completed steps',()=>{
 const g=dock();diagnose(g);g.act('power');step(g,1.1);g.act('brace');step(g,1.3);g.torque=.5;step(g,1,{repairHeld:true,part:'latch'});
 const restored=decodeSave(encodeSave(freshProfile(),g));assert.equal(restored.mission.stage,'release');assert.ok(restored.mission.repairProgress>.3);assert.equal(restored.mission.braced,true);
 assert.equal(decodeSave('invalid'),null);assert.equal(decodeSave('{"version":999}'),null);
 const invalid=g.snapshot();invalid.powerOn=true;assert.equal(Mission.restore(invalid),null);
 const nan=g.snapshot();nan.pos=[NaN,0,0];assert.equal(Mission.restore(nan),null);
});
test('rescue returns to an approach point and cannot skip repair stages',()=>{
 const g=new Mission();g.pos=[100,0,100];g.fuel=0;assert.equal(g.rescue(),true);assert.equal(g.fuel,40);assert.equal(g.rescues,1);
 assert.ok(Math.hypot(...g.pos)<17);const d=dock();assert.equal(d.rescue(),false);assert.equal(d.stage,'survey');
});
test('invalid or stalled-frame timesteps do not teleport the player',()=>{
 const g=new Mission(),initial=g.snapshot();g.tick(NaN,{forward:1});g.tick(-1,{forward:1});assert.deepEqual(g.snapshot(),initial);
 g.tick(600,{forward:1});assert.ok(Math.abs(g.pos[2]-20)<.01);assert.equal(g.elapsed,.05);
});
