import * as THREE from 'three';
import {characterPose,ARM_RIG,IDLE_ARM_POSE} from './character-motion.js';

// Stylized 3D interpretations of the two user-supplied character references.
// The illustrated portraits are not rigged 3D assets, so this is not an exact
// facial likeness. All outfits are fictional and have no company marks.
const M={
  suit:new THREE.MeshStandardMaterial({color:'#174f9a',roughness:.86}),
  suitLight:new THREE.MeshStandardMaterial({color:'#2370c3',roughness:.82}),
  suitShade:new THREE.MeshStandardMaterial({color:'#0e376e',roughness:.88}),
  seam:new THREE.MeshStandardMaterial({color:'#102d53',roughness:.9}),
  white:new THREE.MeshStandardMaterial({color:'#f3f1e6',roughness:.72}),
  silver:new THREE.MeshStandardMaterial({color:'#c9d1d3',roughness:.62}),
  blueHat:new THREE.MeshStandardMaterial({color:'#096cb8',roughness:.7}),
  skin:new THREE.MeshStandardMaterial({color:'#b7784d',roughness:.93}),
  skinLight:new THREE.MeshStandardMaterial({color:'#cf9764',roughness:.91}),
  hair:new THREE.MeshStandardMaterial({color:'#20232b',roughness:.96}),
  boot:new THREE.MeshStandardMaterial({color:'#8a5530',roughness:.78}),
  belt:new THREE.MeshStandardMaterial({color:'#4a2f20',roughness:.8}),
  shirt:new THREE.MeshStandardMaterial({color:'#1d2b45',roughness:.9}),
  sole:new THREE.MeshStandardMaterial({color:'#1b2227',roughness:.96})
};
const boxes=new Map(),cylinders=new Map(),spheres=new Map();
const cube=(w,h,d)=>{
  const key=[w,h,d].join('|');
  if(!boxes.has(key))boxes.set(key,new THREE.BoxGeometry(w,h,d));
  return boxes.get(key);
};
const rounded=(radius,detail=12)=>{
  const key=`${radius}:${detail}`;
  if(!spheres.has(key))spheres.set(key,new THREE.SphereGeometry(radius,detail,8));
  return spheres.get(key);
};
const cylinderShape=(r1,r2,h,seg=12)=>{
  const key=[r1,r2,h,seg].join('|');
  if(!cylinders.has(key))cylinders.set(key,new THREE.CylinderGeometry(r1,r2,h,seg));
  return cylinders.get(key);
};
const add=(parent,geometry,material,x,y,z)=>{
  const mesh=new THREE.Mesh(geometry,material);
  mesh.position.set(x,y,z);
  mesh.castShadow=true;
  parent.add(mesh);
  return mesh;
};
const rect=(p,w,h,d,x,y,z,m)=>add(p,cube(w,h,d),m,x,y,z);

export function createWorkerAvatar(role='hero'){
  const npc=role==='npc';
  const root=new THREE.Group();root.name=npc?'Autonomous yard worker':'Player';
  const visual=new THREE.Group();visual.name='Animated character';
  root.add(visual);
  const torso=new THREE.Group();torso.position.set(0,1.1,0);visual.add(torso);
  rect(torso,.78,.82,.48,0,.33,0,M.suit);
  // Zipper, dark undershirt at the open collar, breast pockets and flaps.
  rect(torso,.035,.60,.012,0,.33,.252,M.seam);
  rect(torso,.16,.13,.02,0,.69,.243,M.shirt);
  // Hero pockets are wide (reference 1); worker pockets sit inside the
  // reflective shoulder straps (reference 2) so the two never overlap.
  const pocketX=npc?.165:.21,pocketW=npc?.2:.25;
  for(const x of [-pocketX,pocketX]){
    rect(torso,pocketW,.22,.035,x,.48,.264,M.suitLight);
    rect(torso,pocketW+.02,.07,.046,x,.585,.27,M.suitShade);
    add(torso,rounded(.03,8),M.silver,x,.585,.302);
    const lapel=rect(torso,.22,.10,.06,(x>0?1:-1)*.125,.755,.15,M.suitShade);
    lapel.rotation.z=x>0?-.28:.28;
  }
  if(npc){
    // Reflective bands used only on autonomous worker's coverall:
    // shoulder straps running down to a horizontal chest band, then a
    // brown leather belt with a silver buckle at the waist.
    rect(torso,.82,.14,.52,0,.14,0,M.silver);
    for(const x of [-.315,.315]){
      rect(torso,.09,.56,.525,x,.48,0,M.silver);
      rect(torso,.09,.02,.5,x,.75,0,M.silver);
    }
    rect(torso,.815,.11,.505,0,-.12,0,M.belt);
    rect(torso,.14,.11,.03,0,-.12,.262,M.silver);
    rect(torso,.08,.05,.034,0,-.12,.264,M.belt);
  }else{
    // Elastic gathered waistband from reference 1.
    rect(torso,.81,.15,.5,0,-.12,0,M.suitShade);
    for(let i=-3;i<=3;i++)rect(torso,.012,.12,.012,i*.105,-.12,.256,M.seam);
  }
  // Neck, ears, hair and simplified beard details.
  add(torso,cylinderShape(.145,.155,.19),M.skin,0,.83,0);
  const head=new THREE.Group();head.position.set(0,1.02,0);torso.add(head);
  const face=add(head,rounded(.31,16),M.skinLight,0,.06,0);
  face.scale.set(.85,1.10,.84);
  for(const side of [-1,1]){
    const ear=add(head,rounded(.075,9),M.skin,side*.265,.045,0);
    ear.scale.set(.8,1.2,.85);
    rect(head,.07,.038,.015,side*.108,.105,.264,M.hair);
    rect(head,.12,.04,.025,side*.09,-.10,.246,M.hair);
  }
  // Jaw-line beard: kept forward so it never shows through the back of the head.
  const beard=add(head,rounded(.29,14),M.hair,0,-.1,.05);
  beard.scale.set(.92,.62,.78);
  // Face/front of beard is visible beneath the nose and under the chin.
  rect(head,.11,.055,.04,0,-.095,.266,M.hair);
  add(head,rounded(.055,8),M.skin,0,-.006,.259);
  // Hardhat shell, brim, raised central rib and front patch.
  const helmet=npc?M.blueHat:M.white;
  const shell=add(head,rounded(.38,16),helmet,0,.36,0);
  shell.scale.set(1,.68,1.04);
  add(head,cylinderShape(.40,.40,.05,18),helmet,0,.29,0);
  const peak=rect(head,.44,.04,.16,0,.285,.36,helmet);
  peak.rotation.x=.18;
  rect(head,.12,.05,.52,0,.525,0,npc?M.suitLight:M.silver);
  // Jointed legs with utility pockets and brown work boots.
  const legs=[],knees=[];
  for(const side of [-1,1]){
    const hip=new THREE.Group();hip.position.set(side*.22,.99,0);visual.add(hip);
    rect(hip,.32,.48,.36,0,-.22,0,M.suit);
    // Cargo pocket on the outer side of each thigh, slightly forward.
    rect(hip,.04,.22,.24,side*.175,-.27,.03,M.suitShade);
    rect(hip,.05,.06,.26,side*.18,-.15,.03,M.suitLight);
    add(hip,rounded(.022,6),M.silver,side*.205,-.15,.03);
    const knee=new THREE.Group();knee.position.set(0,-.45,0);hip.add(knee);
    rect(knee,.30,.39,.35,0,-.18,0,M.suit);
    if(npc)rect(knee,.315,.10,.38,0,-.31,0,M.silver);
    rect(knee,.34,.08,.38,0,-.39,0,M.suitShade);
    // Chunky lace-up work boots with a raised toe cap and lugged sole.
    rect(knee,.36,.2,.42,0,-.47,.04,M.boot);
    rect(knee,.35,.13,.17,0,-.515,.31,M.boot);
    rect(knee,.39,.075,.6,0,-.565,.12,M.sole);
    for(let i=0;i<3;i++)rect(knee,.2,.018,.014,0,-.41-i*.045,.255,M.belt);
    legs.push(hip);knees.push(knee);
  }
  const arms=[],elbows=[];
  for(const side of [-1,1]){
    const shoulder=new THREE.Group();shoulder.position.set(side*ARM_RIG.shoulderX,ARM_RIG.shoulderY,0);torso.add(shoulder);
    rect(shoulder,.30,.45,.36,0,-.20,0,M.suit);
    if(npc)rect(shoulder,.315,.12,.38,0,-.23,0,M.silver);
    const elbow=new THREE.Group();elbow.position.set(0,-ARM_RIG.upperArm,0);shoulder.add(elbow);
    rect(elbow,.265,.36,.30,0,-.16,0,M.suitLight);
    rect(elbow,.29,.085,.33,0,-.33,0,M.suitShade);
    const glove=add(elbow,rounded(.13,10),M.skinLight,0,-ARM_RIG.forearm,0);
    glove.scale.set(.92,.8,.86);
    arms.push(shoulder);elbows.push(elbow);
  }
  root.userData.characterRig={visual,torso,head,arms,legs,knees,elbows,role};
  root.userData.kind=role;
  return root;
}

export function animateWorkerAvatar(root,motion){
  const rig=root.userData.characterRig;
  if(!rig)return;
  const pose=characterPose(motion);
  const travel=THREE.MathUtils.clamp(motion.speed/.65,0,1);
  rig.visual.position.y=pose.bob;
  rig.torso.rotation.x=pose.lean;
  rig.legs[0].rotation.x=pose.leftLeg;
  rig.legs[1].rotation.x=pose.rightLeg;
  rig.knees[0].rotation.x=Math.max(0,-pose.leftLeg)*.5;
  rig.knees[1].rotation.x=Math.max(0,-pose.rightLeg)*.5;
  for(let i=0;i<2;i++){
    const side=i===0?-1:1;
    rig.arms[i].rotation.x=i===0?pose.leftArm:pose.rightArm;
    // Hands on hips while stationary, normal opposed arm swing in motion.
    // Idle pose puts each hand on the hip at the waistline; see idleHandPosition().
    rig.arms[i].rotation.z=side*IDLE_ARM_POSE.shoulderOut*(1-travel);
    rig.elbows[i].rotation.z=-side*IDLE_ARM_POSE.elbowBend*(1-travel);
  }
  rig.head.rotation.y=Math.sin(motion.stridePhase)*Math.min(motion.speed/5.2,.02);
}
