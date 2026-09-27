import test from 'node:test';
import assert from 'node:assert/strict';
import {AnalogStick,cameraRelative} from '../web/src/surface-controls.js';
import {SurfaceGame} from '../web/src/surface-game.js';
test('radial dead zone removes thumb jitter and supports gradual speed',()=>{
 const s=new AnalogStick();s.start(1,100,100,50);s.move(1,103,100);assert.equal(s.x,0);assert.equal(s.y,0);
 s.move(1,128,100);assert.ok(Math.abs(s.x-.5)<1e-10);assert.equal(s.y,0);
 s.move(1,300,300);assert.ok(Math.abs(Math.hypot(s.x,s.y)-1)<1e-10);assert.ok(Math.hypot(s.knobX,s.knobY)<=50.00001);
});
test('unrelated fingers cannot steal or cancel the movement pointer',()=>{
 const s=new AnalogStick();assert.equal(s.start(1,0,0,50),true);assert.equal(s.start(2,1,1,50),false);
 s.move(1,0,-50);assert.equal(s.move(2,50,0),false);assert.equal(s.end(2),false);assert.equal(s.y,-1);
 assert.equal(s.end(1),true);assert.equal(s.x,0);assert.equal(s.y,0);assert.equal(s.pointer,null);
});
test('cancelling resets every direction and permits a fresh gesture',()=>{
 const s=new AnalogStick();s.start(8,10,10,40);s.move(8,50,10);s.reset();assert.equal(s.move(8,50,10),false);
 assert.equal(s.start(9,10,10,40),true);s.move(9,10,10);assert.equal(Math.hypot(s.x,s.y),0);
});
test('camera-relative analog motion retains magnitude and caps combined inputs',()=>{
 const a=cameraRelative(.3,.4,Math.PI/2);assert.ok(Math.abs(Math.hypot(a.x,a.z)-.5)<1e-10);assert.ok(Math.abs(a.x+.4)<1e-10);
 const b=cameraRelative(2,2,0);assert.ok(Math.abs(Math.hypot(b.x,b.z)-1)<1e-10);
});
test('half stick walks at half speed without a sprint or animation speed mismatch',()=>{
 const slow=new SurfaceGame(),full=new SurfaceGame();
 slow.tick(.05,{z:-.5,sprint:true});full.tick(.05,{z:-1});
 assert.ok(Math.abs(slow.speed/full.speed-.5)<1e-10);assert.ok(Math.abs((46-slow.z)/(46-full.z)-.5)<1e-8);
 assert.equal(slow.stamina,100);
});
