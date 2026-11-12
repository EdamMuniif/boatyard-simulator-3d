import test from 'node:test';
import assert from 'node:assert/strict';
import {joystickVector} from './touch-controls.js';
import {createCharacterMotion,stepCharacterMotion} from './character-motion.js';

const rect={left:0,top:0,width:100,height:100};
const advance=(input,cameraYaw)=>{
  const state=createCharacterMotion();
  for(let i=0;i<48;i++)stepCharacterMotion(state,{...input,cameraYaw},1/60);
  return state;
};
const projection=(s,yaw)=>({
  screenRight:s.x*(-Math.cos(yaw))+s.z*Math.sin(yaw),
  screenForward:s.x*Math.sin(yaw)+s.z*Math.cos(yaw)
});

test('joystick left/right report the correct signed input',()=>{
  assert.ok(joystickVector(10,50,rect).x<0);
  assert.ok(joystickVector(90,50,rect).x>0);
  assert.equal(joystickVector(50,50,rect).x,0);
});

test('walking left/right agrees with the screen direction in all camera quadrants',()=>{
  for(const yaw of [0,Math.PI/4,Math.PI/2,Math.PI,Math.PI*1.5,-Math.PI/3]){
    const left=advance(joystickVector(10,50,rect),yaw);
    const right=advance(joystickVector(90,50,rect),yaw);
    const L=projection(left,yaw),R=projection(right,yaw);
    assert.ok(L.screenRight<-.2,`left stick moved screen-right at camera yaw ${yaw}`);
    assert.ok(R.screenRight>.2,`right stick moved screen-left at camera yaw ${yaw}`);
    assert.ok(Math.abs(L.screenForward)<.08,`left stick drifts forward at yaw ${yaw}`);
    assert.ok(Math.abs(R.screenForward)<.08,`right stick drifts forward at yaw ${yaw}`);
  }
});

test('keyboard A/D uses same left/right movement basis as the joystick',()=>{
  for(const yaw of [0,Math.PI/2,Math.PI]){
    const a=projection(advance({hor:-1,ver:0},yaw),yaw);
    const d=projection(advance({hor:1,ver:0},yaw),yaw);
    assert.ok(a.screenRight<-.2);
    assert.ok(d.screenRight>.2);
  }
});

test('up/down remain camera-forward and camera-backward after horizontal fix',()=>{
  for(const yaw of [0,Math.PI/3,Math.PI,Math.PI*1.5]){
    const forward=projection(advance({hor:0,ver:1},yaw),yaw);
    const back=projection(advance({hor:0,ver:-1},yaw),yaw);
    assert.ok(forward.screenForward>.2);
    assert.ok(back.screenForward<-.2);
    assert.ok(Math.abs(forward.screenRight)<.08);
    assert.ok(Math.abs(back.screenRight)<.08);
  }
});
