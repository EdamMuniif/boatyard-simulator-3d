import test from 'node:test';
import assert from 'node:assert/strict';
import {HOIST_TURN,proposeHoistMotion,wheelSteeringTarget} from './hoist-steering.js';
import {canHoistAt,sweepVehicle} from './collision.js';
const here={x:0,z:63,heading:0,speed:0};
test('left/right can pivot in place with no throttle or speed',()=>{
  const left=proposeHoistMotion(here,{steer:-1,throttle:0},.05);
  const right=proposeHoistMotion(here,{steer:1,throttle:0},.05);
  assert.equal(left.pivot,true);assert.equal(right.pivot,true);
  assert.equal(left.x,here.x);assert.equal(left.z,here.z);
  assert.ok(left.heading<0&&right.heading>0);
  assert.ok(sweepVehicle(here,right,here.heading,right.heading,canHoistAt));
});
test('driving retains forward and reverse motion and curved steering',()=>{
  const forward=proposeHoistMotion({...here,speed:3},{steer:.7,throttle:1},.05);
  const reverse=proposeHoistMotion({...here,speed:-2},{steer:.7,throttle:-1},.05);
  assert.equal(forward.pivot,false);
  assert.equal(reverse.pivot,false);
  assert.ok(forward.z>here.z&&forward.heading>0);
  assert.ok(reverse.z<here.z&&reverse.heading<0);
});
test('suspended lift and ferry cannot rotate through a blocked yard footprint',()=>{
  const nearBuilding={x:34,z:70,heading:0,speed:0};
  assert.equal(canHoistAt({x:34,z:70},0),false);
  const proposed=proposeHoistMotion({x:0,z:16,heading:0,speed:0},{steer:1,throttle:0},.05);
  assert.equal(proposed.pivot,true);
  assert.ok(sweepVehicle(here,{...here,heading:.02},0,.02,canHoistAt));
  assert.equal(sweepVehicle({x:0,z:16},{x:0,z:16},0,Math.PI/2,canHoistAt),false);
});
test('pivot stops with deadzone, residual speed, or throttle active',()=>{
  assert.equal(proposeHoistMotion(here,{steer:.05,throttle:0},.05).pivot,false);
  assert.equal(proposeHoistMotion({...here,speed:.5},{steer:1,throttle:0},.05).pivot,false);
  assert.equal(proposeHoistMotion(here,{steer:1,throttle:1},.05).pivot,false);
  assert.equal(proposeHoistMotion(here,{steer:1,throttle:0,brake:true},.05).pivot,false);
  assert.equal(proposeHoistMotion(here,{steer:0,throttle:0},.05).heading,0);
});
test('steering station angles are finite and remain bounded',()=>{
  for(const x of [-12.85,12.85])for(const z of [-15.75,-12.85,12.85,15.75]){
    const angle=wheelSteeringTarget(x,z,1,true);
    assert.ok(Number.isFinite(angle));
    assert.ok(Math.abs(angle)<=Math.PI/2);
  }
  assert.equal(wheelSteeringTarget(12,14,1,false),HOIST_TURN.wheelSteerLimit);
  assert.equal(wheelSteeringTarget(12,14,-1,false),-HOIST_TURN.wheelSteerLimit);
});
test('large frame gaps are clamped and the helper cannot produce NaN motion',()=>{
  const a=proposeHoistMotion(here,{steer:1,throttle:0},1);
  assert.ok(a.deltaHeading<=HOIST_TURN.pivotRate*.05+1e-10);
  const b=proposeHoistMotion(here,{steer:NaN,throttle:NaN},NaN);
  assert.deepEqual({x:b.x,z:b.z,heading:b.heading},{x:0,z:63,heading:0});
});
