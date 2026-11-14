import test from 'node:test';
import assert from 'node:assert/strict';
import {canWalkAt,canFerryAt,canHoistAt,circleOverlapsRect,rectangleOverlapsRect,sweepVehicle,WORKSHOPS} from './collision.js';

const p=(x,z)=>({x,z});
test('circle/rectangle collision boundaries',()=>{
  const rect={x:0,z:0,w:10,d:8};
  assert.equal(circleOverlapsRect(p(6,0),.9,rect),false);
  assert.equal(circleOverlapsRect(p(5.2,0),.6,rect),true);
  assert.equal(rectangleOverlapsRect(p(8,0),0,2,2,rect),false);
  assert.equal(rectangleOverlapsRect(p(6,0),Math.PI/4,2,2,rect),true);
});
test('player cannot enter buildings or water; traverses connected quays',()=>{
  assert.equal(canWalkAt(p(-18,37)),true);
  assert.equal(canWalkAt(p(-16.5,52)),true);
  assert.equal(canWalkAt(p(-49,101)),false);
  assert.equal(canWalkAt(p(0,20)),false);
  assert.equal(canWalkAt(p(-18,31.9)),true);
  assert.equal(canWalkAt(p(-80,110)),false);
});
test('ferry stays on water and can berth without clipping piers',()=>{
  assert.equal(canFerryAt(p(0,-49),0),true);
  assert.equal(canFerryAt(p(0,16),0),true);
  assert.equal(canFerryAt(p(8,16),0),false);
  assert.equal(canFerryAt(p(0,23),0),false);
  assert.equal(canFerryAt(p(0,-49),0.2),true);
});
test('travel lift straddles basin and docks without clipping obstacles',()=>{
  assert.equal(canHoistAt(p(0,63),0),true);
  assert.equal(canHoistAt(p(0,16),0),true);
  assert.equal(canHoistAt(p(0,16),.5),false); // turning into basin would leave a wheel over water
  assert.equal(canHoistAt(p(0,94),0),true);
  assert.equal(canHoistAt(p(34,108),0),true);
  assert.equal(canHoistAt(p(34,70),0),false);
  assert.equal(canHoistAt(p(-45,101),0),false);
  for(let z=16;z<=96;z+=2)assert.equal(canHoistAt(p(0,z),0),true,`blocked main corridor at ${z}`);
  for(let x=0;x<=34;x+=2)assert.equal(canHoistAt(p(x,108),0),true,`blocked Bay 03 approach at ${x}`);
  assert.equal(WORKSHOPS.length,4);
});
test('continuous movement catches tunneling and steering collisions',()=>{
  assert.equal(sweepVehicle(p(-20,101),p(-80,101),0,0,canHoistAt),false);
  assert.equal(sweepVehicle(p(0,63),p(0,16),0,0,canHoistAt),true);
  assert.equal(sweepVehicle(p(0,16),p(0,108),0,0,canHoistAt),true);
  assert.equal(sweepVehicle(p(0,108),p(34,108),0,0,canHoistAt),true);
  assert.equal(sweepVehicle(p(0,-49),p(0,16),0,0,canFerryAt),true);
  assert.equal(sweepVehicle(p(0,16),p(15,16),0,0,canFerryAt),false);
});

test('v0.4 yard vessels are solid, sit on land, and keep mission routes clear',async()=>{
  const {HARDSTAND_VESSELS,MOORED_VESSELS,WALKABLE_GROUND,vesselFootprint}=await import('./collision.js');
  const inside=(x,z,r)=>Math.abs(x-r.x)<=r.w/2&&Math.abs(z-r.z)<=r.d/2;
  for(const v of HARDSTAND_VESSELS){
    const f=vesselFootprint(v);
    assert.equal(canWalkAt(p(v.x,v.z)),false,`${v.id}: player walks through hull`);
    for(const [dx,dz] of [[-1,-1],[1,-1],[1,1],[-1,1]]){
      const x=f.x+dx*f.w/2,z=f.z+dz*f.d/2;
      assert.ok(WALKABLE_GROUND.some(r=>inside(x,z,r)),`${v.id}: stand over water at ${x},${z}`);
    }
  }
  for(const v of MOORED_VESSELS){
    assert.equal(canFerryAt(p(v.x,v.z),0),false,`${v.id}: ferry sails through moored vessel`);
  }
  // Walk from harbor dispatch to the hoist boarding point along the west quay.
  for(let z=37;z<=63;z+=1)assert.equal(canWalkAt(p(-17,z)),true,`walk route blocked at z=${z}`);
});
