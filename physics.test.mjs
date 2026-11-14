import test from 'node:test';
import assert from 'node:assert/strict';
import {G,SWING,createSwing,stepSwing,swingAmplitude,swingOffset,HOIST_DYNAMICS,stepHoistSpeed,hoistMassFactor,createFerryState,stepFerry} from './physics.js';

const run=(n,fn)=>{for(let i=0;i<n;i++)fn(i);};

test('small swings follow the pendulum period 2*pi*sqrt(L/g)',()=>{
  const L=8,s=createSwing();s.lon=.05;
  const dt=1/240;let prev=s.lon,crossings=[],t=0;
  run(240*20,()=>{stepSwing(s,{length:L},dt);t+=dt;if(prev>0&&s.lon<=0)crossings.push(t);prev=s.lon;});
  const period=(crossings[3]-crossings[0])/3;
  const expected=2*Math.PI*Math.sqrt(L/G);
  assert.ok(Math.abs(period-expected)/expected<.02,`period ${period} vs ${expected}`);
});

test('damping removes energy until the load is settled',()=>{
  const L=8,s=createSwing();s.lon=.2;s.lat=-.1;
  const start=swingAmplitude(s,L);
  let last=start;
  for(let sec=0;sec<40;sec++){run(60,()=>stepSwing(s,{length:L},1/60));const a=swingAmplitude(s,L);assert.ok(a<=last+1e-9);last=a;}
  assert.ok(start>.2&&last<SWING.settled,`amplitude ${start} -> ${last}`);
});

test('accelerating forward swings the load back; turning swings it outward',()=>{
  const fwd=createSwing();run(30,()=>stepSwing(fwd,{accel:1.5,length:8},1/60));
  assert.ok(fwd.lon<0,'load should lag behind when the lift accelerates');
  const brake=createSwing();run(30,()=>stepSwing(brake,{accel:-1.5,length:8},1/60));
  assert.ok(brake.lon>0,'load should swing forward when the lift brakes');
  const turn=createSwing();run(30,()=>stepSwing(turn,{lateral:1,length:8},1/60));
  assert.ok(turn.lat<0&&Math.abs(turn.lon)<1e-12,'load should swing outward only');
  // An instant game "snap" to zero speed is clamped to a physical decel.
  const snap=createSwing();stepSwing(snap,{accel:-500,length:8},1/60);
  const clamped=createSwing();stepSwing(clamped,{accel:-SWING.maxInputAccel,length:8},1/60);
  assert.deepEqual(snap,clamped);
  const o=swingOffset({lon:.1,lonVel:0,lat:0,latVel:0},8);
  assert.ok(o.z>0&&o.y>0&&Math.abs(o.x)<1e-12);
});

test('a loaded lift accelerates and brakes more slowly than an empty one',()=>{
  assert.ok(hoistMassFactor(true)<hoistMassFactor(false));
  let empty=0,loaded=0;
  run(60,()=>{empty=stepHoistSpeed(empty,{throttle:1},1/60);loaded=stepHoistSpeed(loaded,{throttle:1,loaded:true},1/60);});
  assert.ok(empty>loaded*1.3,`after 1 s: empty ${empty}, loaded ${loaded}`);
  let e=4,l=4;run(30,()=>{e=stepHoistSpeed(e,{brake:true},1/60);l=stepHoistSpeed(l,{brake:true,loaded:true},1/60);});
  assert.ok(e<l,'loaded lift needs longer to stop');
  assert.ok(stepHoistSpeed(99,{throttle:1},1/60)<=HOIST_DYNAMICS.maxForward);
  assert.equal(stepHoistSpeed(.03,{throttle:0},1/60),0);
});

test('ferry drag sets a top speed, the rudder needs flow, and a crash stop takes time',()=>{
  const f=createFerryState();
  run(60*40,()=>stepFerry(f,{throttle:1},1/60));
  assert.ok(f.speed>5.5&&f.speed<=6.25,`top speed ${f.speed}`);
  const still=createFerryState();run(60,()=>stepFerry(still,{steer:1},1/60));
  const moving=createFerryState();moving.speed=4;run(60,()=>stepFerry(moving,{throttle:.5,steer:1},1/60));
  assert.ok(still.yawRate>0&&still.yawRate<.07,'bow thruster only at standstill');
  assert.ok(moving.yawRate>still.yawRate*3,'rudder far stronger with way on');
  assert.ok(moving.heel<0,'heels outward in the turn');
  const stop=createFerryState();stop.speed=6;let t=0;
  while(stop.speed>0&&t<20){stepFerry(stop,{brake:true},1/60);t+=1/60;}
  assert.ok(t>2.5&&t<5,`crash stop took ${t.toFixed(2)} s`);
});
