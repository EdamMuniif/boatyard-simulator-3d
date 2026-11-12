import test from 'node:test';
import assert from 'node:assert/strict';
import {NPC_SPAWNS,NPC_GOALS,npcWalkable,segmentWalkable,createNpcGrid,planNpcRoute,advanceNpcMotion} from './npc-navigation.js';
import {createCharacterMotion} from './character-motion.js';

test('worker spawn points and all independently selected destinations are safe',()=>{
  for(const spawn of NPC_SPAWNS){
    assert.ok(npcWalkable(spawn),`unsafe spawn at ${spawn.x},${spawn.z}`);
    assert.ok(['west','east'].includes(spawn.side));
  }
  for(const [side,goals] of Object.entries(NPC_GOALS)){
    for(const goal of goals){
      assert.ok(npcWalkable(goal),`unsafe ${side} goal at ${goal.x},${goal.z}`);
      assert.ok(side==='west'?goal.x<0:goal.x>0);
    }
  }
});
test('pedestrian navigation stays clear of the central travel-lift lane and water',()=>{
  assert.equal(npcWalkable({x:0,z:90}),false);
  assert.equal(npcWalkable({x:0,z:16}),false);
  assert.equal(npcWalkable({x:-25,z:15}),false);
  assert.equal(segmentWalkable({x:-27,z:90},{x:29,z:90}),false);
  assert.equal(segmentWalkable({x:-27,z:60},{x:-27,z:65}),true);
});
test('workers can find nontrivial routes around buildings and parked forklifts',()=>{
  const grid=createNpcGrid();
  for(const spawn of NPC_SPAWNS){
    for(const destination of NPC_GOALS[spawn.side]){
      const route=planNpcRoute(grid,spawn,destination);
      assert.ok(route.length,`no route: ${spawn.side} ${spawn.x},${spawn.z} -> ${destination.x},${destination.z}`);
      let from=spawn;
      for(const next of route){
        assert.ok(segmentWalkable(from,next),`route crosses obstacle: ${JSON.stringify(from)} -> ${JSON.stringify(next)}`);
        from=next;
      }
    }
  }
});
test('NPC motion walks toward the target, turns and never crosses a blocked segment',()=>{
  const actor=createCharacterMotion({x:-28,y:0,z:58});
  const dest={x:-28,z:65};
  for(let i=0;i<240;i++)advanceNpcMotion(actor,dest,1/60);
  assert.ok(actor.z>61);
  assert.ok(npcWalkable(actor));
  assert.ok(actor.speed>0);
  const stuck=createCharacterMotion({x:-28,y:0,z:58});
  const before={x:stuck.x,z:stuck.z};
  const result=advanceNpcMotion(stuck,dest,.05,()=>false);
  assert.equal(result.blocked,true);
  assert.deepEqual({x:stuck.x,z:stuck.z},before);
  assert.equal(stuck.speed,0);
});
test('large or invalid frame durations cannot cause teleporting',()=>{
  const actor=createCharacterMotion({x:30,y:0,z:90});
  advanceNpcMotion(actor,{x:30,z:160},8);
  assert.ok(Math.hypot(actor.x-30,actor.z-90)<.1);
  const old={x:actor.x,z:actor.z};
  advanceNpcMotion(actor,{x:30,z:160},NaN);
  assert.deepEqual({x:actor.x,z:actor.z},old);
});
