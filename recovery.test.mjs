import test from 'node:test';
import assert from 'node:assert/strict';
import {PHASES,MISSION,checkpointForPhase,canAttachSling,canDock,canBerthFerry} from './rules.js';
import {canWalkAt,canFerryAt,canHoistAt} from './collision.js';

test('every active phase has a safe, deterministic reset',()=>{
  for(const phase of PHASES.filter(p=>p.id!=='COMPLETE')){
    const a=checkpointForPhase(phase.id),b=checkpointForPhase(phase.id);
    assert.deepEqual(a,b);
    assert.ok(a,phase.id);
    assert.equal(canWalkAt(a.avatar),true,`${phase.id}: player spawn obstructed`);
    assert.equal(canHoistAt(a.hoist,a.hoistHeading),true,`${phase.id}: hoist obstructed`);
    if(!a.attached)assert.equal(canFerryAt(a.ferry,a.ferryHeading),true,`${phase.id}: ferry obstructed`);
    if(a.attached){assert.equal(a.mode,'hoist');assert.equal(a.hoist.x,a.ferry.x);assert.equal(a.hoist.z,a.ferry.z);}
  }
});
test('recovered mission can continue from aligned stages',()=>{
  const ferry=checkpointForPhase('BOARD_HOIST');
  assert.equal(canBerthFerry(ferry.ferry,0),true);
  const aligned=checkpointForPhase('LIFT');
  assert.equal(canAttachSling(aligned.hoist,0),true);
  const haul=checkpointForPhase('HAUL');
  assert.ok(haul.liftHeight>=MISSION.liftRequired);
  const lower=checkpointForPhase('LOWER');
  assert.equal(canDock(lower.hoist,0,lower.liftHeight),true);
  assert.equal(lower.attached,true);
});
test('completed/unknown stages have no recovery checkpoint',()=>{
  assert.equal(checkpointForPhase('COMPLETE'),null);
  assert.equal(checkpointForPhase('GHOST'),null);
});
