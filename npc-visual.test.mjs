import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8');

test('first reference defines white-helmet hero and second defines blue-helmet reflective workers',()=>{
  const avatar=read('./worker-avatar.js');
  assert.match(avatar,/const npc=role==='npc'/);
  assert.match(avatar,/const helmet=npc\?M\.blueHat:M\.white/);
  assert.match(avatar,/if\(npc\)\{/);
  assert.match(avatar,/Reflective bands used only on autonomous worker/);
  assert.match(avatar,/M\.boot/);
  assert.match(avatar,/M\.belt/);
  assert.match(avatar,/M\.hair/);
  assert.match(avatar,/rig\.arms\[i\]\.rotation\.z/);
  assert.doesNotMatch(avatar,/\bMTCC\b|EDENTECHNOLOGY/i);
});
test('ambient system replaces static worker figures and does not own mission controls',()=>{
  const game=read('./main.js'),world=read('./world.js');
  const npcs=read('./npc-system.js'),geometry=read('./geometry.js');
  assert.doesNotMatch(world,/worker\(scene,-30,60\)/);
  assert.match(game,/this\.npcWorkers=createNpcSystem\(this\.scene/);
  assert.match(game,/this\.npcWorkers\.update\(dt/);
  assert.match(npcs,/lowPower\?NPC_SPAWNS\.slice\(0,3\):NPC_SPAWNS/);
  assert.match(npcs,/nearMovingEquipment/);
  assert.match(npcs,/player&&Math\.hypot/);
  assert.match(geometry,/export function createYardWorker\(\)/);
  assert.match(game,/advanceHoist\(dt\)/);
  assert.match(game,/advanceFerry\(dt\)/);
});
