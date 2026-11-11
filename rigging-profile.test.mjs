import test from 'node:test';
import assert from 'node:assert/strict';
import {SLING_STATIONS,SLING_HALF_SPAN,rigPose,slingPoint} from './rigging-profile.js';

test('visual lifting stations have consistent spacing and no duplicate',()=>{
  assert.equal(SLING_STATIONS.length,4);
  assert.deepEqual([...new Set(SLING_STATIONS)],SLING_STATIONS);
  assert.equal(SLING_STATIONS[0],-SLING_STATIONS[3]);
});
test('unloaded fabric loops hang near the ground',()=>{
  const pose=rigPose(0,false);
  assert.ok(pose.bottomY>=0&&pose.bottomY<.5);
  assert.ok(pose.topY>pose.bottomY+5);
  assert.equal(slingPoint(0,pose).y,pose.topY);
  assert.equal(slingPoint(1,pose).y,pose.topY);
  assert.equal(slingPoint(.5,pose).y,pose.bottomY);
  assert.equal(slingPoint(0,pose).x,-SLING_HALF_SPAN);
  assert.equal(slingPoint(1,pose).x,SLING_HALF_SPAN);
});
test('loaded loop rises as visual lift rises and stays symmetric',()=>{
  for(const lift of [0,1,3.28,5.4,6.25]){
    const pose=rigPose(lift,true);
    const center=slingPoint(.5,pose);
    assert.ok(Math.abs(center.y-(lift-1.68))<1e-8);
    assert.ok(pose.topY>center.y);
    for(let i=0;i<=20;i++){
      const a=slingPoint(i/20,pose),b=slingPoint(1-i/20,pose);
      assert.ok(Math.abs(a.y-b.y)<1e-8);
      assert.ok(Math.abs(a.x+b.x)<1e-8);
      assert.ok(Number.isFinite(a.x)&&Number.isFinite(a.y));
    }
  }
});
test('rig pose clamps invalid height inputs',()=>{
  assert.deepEqual(rigPose(-7,false),rigPose(0,false));
  assert.deepEqual(rigPose(100,true),rigPose(6.25,true));
  assert.deepEqual(rigPose(NaN,false),rigPose(0,false));
});
