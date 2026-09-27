import test from 'node:test';
import assert from 'node:assert/strict';
import {SurfaceGame} from '../web/src/surface-game.js';
import {DEPOT,RELAY,SHELTER,ROUTES,ROCKS,heightAt,distance} from '../web/src/surface-world.js';
function walk(game,point,options={}){
 for(let i=0;i<24000&&distance(game,point)>1;i++){
  const d=distance(game,point);game.tick(1/60,{x:(point.x-game.x)/d,z:(point.z-game.z)/d,...options});
 }
 assert.ok(distance(game,point)<1.1,`could not reach ${JSON.stringify(point)} from ${game.x},${game.z}`);
}
test('cargo pickup and delivery require proximity and happen once',()=>{
 const g=new SurfaceGame();assert.equal(g.interact(),true);assert.equal(g.stage,'delivery');
 assert.equal(g.interact(),false);g.setLoad(32);assert.equal(g.mass,18);
 g.x=RELAY.x;g.z=RELAY.z;assert.equal(g.interact(),true);assert.equal(g.interact(),false);
 const before=g.snapshot();g.tick(1,{x:1});assert.deepEqual(g.snapshot(),before);
});
test('safe walking route reaches shelter and relay without damaging cargo',()=>{
 const g=new SurfaceGame();g.interact();
 for(const point of ROUTES.valley.slice(1)){
  walk(g,point);
  if(point===SHELTER){g.stamina=10;assert.equal(g.interact(),true);assert.equal(g.stamina,100);assert.equal(g.shelterUsed,true);}
 }
 assert.equal(g.condition,100);assert.equal(g.interact(),true);assert.equal(g.stage,'complete');
});
test('heavy cargo slows movement and costs more stamina when running',()=>{
 const light=new SurfaceGame(),heavy=new SurfaceGame();heavy.setLoad(32);light.interact();heavy.interact();
 for(let i=0;i<150;i++){light.tick(1/60,{z:-1,sprint:true});heavy.tick(1/60,{z:-1,sprint:true});}
 assert.ok(light.z<heavy.z);assert.ok(light.stamina>heavy.stamina);
});
test('bracing recovers balance and prevents slope stumbles',()=>{
 const unsteady=new SurfaceGame(),braced=new SurfaceGame();
 for(const g of [unsteady,braced]){g.setLoad(32);g.interact();g.x=25;g.z=-35;g.balance=9;}
 for(let i=0;i<90;i++){unsteady.tick(1/60,{z:-1,sprint:true});braced.tick(1/60,{z:-1,brace:true});}
 assert.ok(unsteady.stumbles>0);assert.equal(braced.stumbles,0);assert.equal(braced.condition,100);assert.ok(braced.balance>9);
});
test('terrain height follows walking and diagonal input has no speed bonus',()=>{
 const a=new SurfaceGame(),b=new SurfaceGame();a.tick(.05,{x:1});b.tick(.05,{x:1,z:1});
 assert.ok(Math.abs(distance(a,{x:0,z:46})-distance(b,{x:0,z:46}))<.001);
 assert.equal(b.y,heightAt(b.x,b.z));const before=b.snapshot();b.tick(NaN,{x:1});assert.deepEqual(b.snapshot(),before);
});
test('rock collisions remain finite even from the obstacle centre',()=>{
 const g=new SurfaceGame(),rock=ROCKS[0];g.x=rock.x;g.z=rock.z;g.tick(1/60,{x:1});
 assert.ok(Number.isFinite(g.x)&&Number.isFinite(g.z));assert.ok(distance(g,rock)>=rock.r+.41);
});
test('walking bounds, route validation and rest prevent invalid states',()=>{
 const g=new SurfaceGame();g.x=72;g.z=61;g.tick(.05,{x:1,z:1});assert.ok(g.x<=72&&g.z<=61);
 g.setRoute('__proto__');assert.equal(g.route,'valley');g.setRoute('ridge');assert.equal(g.route,'ridge');
 g.stamina=0;g.tick(.05,{});assert.ok(g.stamina>0);g.setLoad(999);assert.equal(g.mass,18);
});

test('station cabin walls block walking while the loading terminal stays reachable',()=>{
 const g=new SurfaceGame();g.x=1.8;g.z=DEPOT.z;
 for(let i=0;i<90;i++)g.tick(1/60,{x:1});
 assert.ok(g.x<=2.11);assert.equal(g.interact(),true);
});
