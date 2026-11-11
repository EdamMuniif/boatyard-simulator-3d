import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('new articulated player preserves root API and animates joints',()=>{
  const g=read('./geometry.js');
  assert.match(g,/export function createPlayer\(\)/);
  assert.match(g,/export function animatePlayer\(root,motion\)/);
  assert.match(g,/root\.userData\.characterRig=\{visual,torso,head,arms,legs,knees\}/);
  assert.match(g,/rig\.knees\[0\]\.rotation\.x/);
  assert.match(g,/return root;/);
});
test('walking has camera-relative motion and existing obstacle checks',()=>{
  const main=read('./main.js');
  assert.match(main,/stepCharacterMotion\(this\.character/);
  assert.match(main,/,dt,canWalkAt\)/);
  assert.match(main,/this\.avatar\.rotation\.y=p\.heading/);
  assert.match(main,/animatePlayer\(this\.avatar,p\)/);
  assert.match(main,/this\.mode==='hoist'\?this\.hoistHeading:0/);
  assert.match(main,/advanceFerry\(dt\)/);
  assert.match(main,/advanceHoist\(dt\)/);
});
test('ferry boarding, recovery and mobile input remain linked',()=>{
  const main=read('./main.js');
  const ui=read('./index.html');
  const rules=read('./rules.js');
  assert.match(main,/resetCharacterMotion\(this\.character,this\.avatar\.position/);
  assert.match(main,/touchMagnitude>\.92/);
  assert.match(main,/this\.touch\.brake/);
  assert.match(main,/brake\.querySelector\('span'\)\.textContent/);
  assert.match(ui,/id="touchBrake"/);
  assert.match(ui,/id="recoverButton"/);
  assert.match(rules,/DISPATCH/);
  assert.match(rules,/BOARD_HOIST/);
});
