import test from 'node:test';
import assert from 'node:assert/strict';
import {CHARACTER_TUNING,createCharacterMotion,resetCharacterMotion,stepCharacterMotion,characterPose} from './character-motion.js';
import {canWalkAt} from './collision.js';
const near=(a,b,eps=.06)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const tick=(state,input,seconds,allowed=()=>true,step=1/60)=>{
  for(let t=0;t<seconds-1e-10;t+=step)stepCharacterMotion(state,input,Math.min(step,seconds-t),allowed);
  return state;
};
test('walking accelerates and gradually stops without sliding indefinitely',()=>{
  const m=createCharacterMotion();
  tick(m,{hor:0,ver:1,cameraYaw:0},.07);
  assert.ok(m.speed>0&&m.speed<CHARACTER_TUNING.walkSpeed);
  tick(m,{hor:0,ver:1,cameraYaw:0},.7);
  near(m.speed,CHARACTER_TUNING.walkSpeed,.02);
  const first=m.z;
  tick(m,{hor:0,ver:0,cameraYaw:0},.35);
  near(m.speed,0,.001);
  assert.ok(m.z>first);
});
test('sprint is faster and diagonal inputs are normalized',()=>{
  const walk=tick(createCharacterMotion(),{hor:0,ver:1,cameraYaw:0},1.2);
  const run=tick(createCharacterMotion(),{hor:0,ver:1,cameraYaw:0,sprint:true},1.2);
  assert.ok(run.z>walk.z*1.45);
  const diag=tick(createCharacterMotion(),{hor:1,ver:1,cameraYaw:0},1.2);
  near(diag.speed,CHARACTER_TUNING.walkSpeed,.02);
});
test('camera-relative rotation changes the world direction',()=>{
  const forward=tick(createCharacterMotion(),{hor:0,ver:1,cameraYaw:Math.PI/2},.6);
  assert.ok(forward.x>0.5&&Math.abs(forward.z)<.1);
  const side=tick(createCharacterMotion(),{hor:1,ver:0,cameraYaw:Math.PI/2},.6);
  assert.ok(side.z>.5);
  assert.ok(Number.isFinite(forward.heading));
});
test('yard obstacle sliding preserves existing quay and workshop collision',()=>{
  const s=createCharacterMotion({x:-19,y:0,z:100});
  tick(s,{hor:1,ver:1,cameraYaw:0},1.5,canWalkAt);
  assert.ok(canWalkAt(s));
  assert.ok(s.x>-33.9,'character should not cross workshop west wall');
  const water=createCharacterMotion({x:-14,y:0,z:16});
  tick(water,{hor:-1,ver:0,cameraYaw:0},2,canWalkAt);
  assert.ok(canWalkAt(water));
  assert.ok(water.x<-10.5,'must not walk into lifting basin');
});
test('space jump has gravity, lands, and does not repeat while held',()=>{
  const s=createCharacterMotion();
  tick(s,{hor:0,ver:0,jump:true},.2);
  assert.ok(s.y>0&&s.grounded===false);
  tick(s,{hor:0,ver:0,jump:true},1.2);
  near(s.y,0,1e-10);
  assert.equal(s.grounded,true);
  assert.equal(s.vy,0);
  tick(s,{hor:0,ver:0,jump:true},.15);
  assert.equal(s.y,0);
  tick(s,{hor:0,ver:0,jump:false},.05);
  tick(s,{hor:0,ver:0,jump:true},.10);
  assert.ok(s.y>0);
});
test('recovery resets velocities, heading, jump and animation',()=>{
  const s=tick(createCharacterMotion(),{hor:1,ver:1,jump:true},.14);
  resetCharacterMotion(s,{x:-16.5,y:0,z:52},0);
  assert.deepEqual(s,createCharacterMotion({x:-16.5,y:0,z:52},0));
});
test('no input yields neutral pose; walking drives opposing limbs',()=>{
  const s=createCharacterMotion();
  let pose=characterPose(s);
  near(pose.leftLeg,0);near(pose.rightArm,0);
  tick(s,{hor:0,ver:1,cameraYaw:0},.28);
  pose=characterPose(s);
  near(pose.leftLeg,-pose.rightLeg,1e-8);
  near(pose.leftArm,-pose.rightArm,1e-8);
  assert.ok(pose.bob>=0);
});
test('frame time substepping keeps trajectory approximately stable',()=>{
  const a=tick(createCharacterMotion(),{hor:0,ver:1,cameraYaw:0},.8,()=>true,1/60);
  const b=tick(createCharacterMotion(),{hor:0,ver:1,cameraYaw:0},.8,()=>true,1/30);
  near(a.z,b.z,.06);
});

test('idle hands-on-hips pose puts each hand on the hip at the waistline',async()=>{
  const {idleHandPosition}=await import('./character-motion.js');
  for(const side of [-1,1]){
    const {elbow,hand}=idleHandPosition(side);
    // Torso half-width is 0.39 and the outer hip edge 0.38; the 0.13 hand
    // sphere should rest against that side, not float beyond it.
    assert.ok(Math.abs(hand.x)>.36&&Math.abs(hand.x)<.48,`hand x ${hand.x}`);
    // Waist/belt band is centred at y=-0.12 in torso space.
    assert.ok(hand.y>-.2&&hand.y<.02,`hand y ${hand.y}`);
    // Elbows flare outward past the shoulders, as in both references.
    assert.ok(Math.abs(elbow.x)>.6,`elbow x ${elbow.x}`);
    assert.equal(Math.sign(hand.x),side);
  }
});
