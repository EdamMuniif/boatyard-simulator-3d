import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');

test('hoist button controls are wired only to hoist driving',()=>{
  const html=read('./index.html');
  const game=read('./main.js');
  assert.match(html,/id="hoistTurnControls"/);
  assert.match(html,/id="touchTurnLeft"/);
  assert.match(html,/id="touchTurnRight"/);
  assert.match(game,/hold\('touchTurnLeft','turnLeft'\)/);
  assert.match(game,/hold\('touchTurnRight','turnRight'\)/);
  assert.match(game,/\['POSITION','HAUL'\]\.includes\(this\.phaseId\)/);
  assert.match(game,/proposeHoistMotion\(/);
  assert.match(game,/sweepVehicle\(p,proposed,oldHeading,proposed\.heading,canHoistAt\)/);
});
test('tyre roll and steer are separate, existing rigging API preserved',()=>{
  const geometry=read('./geometry.js');
  const game=read('./main.js');
  assert.match(geometry,/pivot\.userData\.roll=roll/);
  assert.match(game,/wheel\.rotation\.y=damp/);
  assert.match(game,/wheel\.userData\.roll\.rotation\.x/);
  assert.match(geometry,/return \{root,wheels,setRigging\}/);
  assert.match(game,/this\.hoist\.setRigging\(this\.liftHeight,true\)/);
});
test('mission recovery and ferry controls remain present',()=>{
  const game=read('./main.js');
  assert.match(game,/recoverCheckpoint\(\)/);
  assert.match(game,/advanceFerry\(dt\)/);
  assert.match(game,/advanceWalk\(dt\)/);
  assert.match(game,/touchTurnLeft/);
  assert.match(game,/touchTurnRight/);
  assert.match(game,/this\.mode==='walk'/);
});
