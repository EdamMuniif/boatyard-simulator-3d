import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read = filename => readFileSync(new URL(filename,import.meta.url),'utf8');
test('v0.3 model retains expected mission integration points',()=>{
  const geometry=read('./geometry.js');
  const game=read('./main.js');
  assert.match(geometry,/export function createHoist\(\)/);
  assert.match(geometry,/return \{root,wheels,setRigging\}/);
  assert.match(geometry,/export function createFerry\(\)/);
  assert.match(geometry,/return \{root,visual\}/);
  assert.match(game,/this\.hoist\.setRigging\(this\.liftHeight,true\)/);
  assert.match(game,/this\.ferry\.root\.position\.set\(p\.x,\.08\+this\.liftHeight,p\.z\)/);
});
test('v0.3 visual geometry uses animated U-slings and unbranded labels',()=>{
  const geometry=read('./geometry.js');
  assert.match(geometry,/SLING_STATIONS/);
  assert.match(geometry,/slingPoint\(/);
  assert.match(geometry,/computeVertexNormals\(\)/);
  assert.match(geometry,/BOATYARD SIMULATOR/);
  assert.match(geometry,/FERRY 01/);
  assert.doesNotMatch(geometry,/\bMTCC\b|EDENTECHNOLOGY/i);
});
test('existing collision and mission rules are not replaced',()=>{
  const game=read('./main.js');
  const world=read('./world.js');
  assert.match(game,/sweepVehicle\(/);
  assert.match(game,/recoverCheckpoint\(\)/);
  assert.match(game,/this\.ferry\.visual\.rotation\.z/);
  assert.match(world,/WORKSHOPS,CARGO_STACKS,FORKLIFTS/);
});
