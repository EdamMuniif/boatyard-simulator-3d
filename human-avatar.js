import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {mergeRigidChildren} from './static-merge.js';

// Realistic rigged human for the hero and the yard workers (v0.5).
//
// The base body and its motion-captured animations come from the "X Bot"
// character of Adobe Mixamo (distributed with the three.js examples). It uses
// the standard Mixamo skeleton, so any Mixamo character exported to .glb can
// replace HUMAN_MODEL_URL and keep these animations.
//
// The base body is a plain mannequin. We dress it per role by colouring each
// vertex from its dominant bone and its rest-pose position (coveralls, skin,
// boots, reflective tape, belt) and attach props to bones (hardhat, beard,
// pockets). Colours follow the two character references.
export const HUMAN_MODEL_URL=new URL('./assets/characters/worker-base.glb',import.meta.url).href;
export const HUMAN_HEIGHT=1.8;

export const HUMAN_LOOKS=Object.freeze({
  hero:Object.freeze({suit:'#1c4ea6',suitShade:'#143b80',skin:'#bf8a62',boots:'#80522f',sole:'#25211e',hat:'#f1efe6',hair:'#231d1a',beard:'#2f2420',tape:null,belt:null,waist:'#122f69'}),
  npc:Object.freeze({suit:'#1d55b2',suitShade:'#163f86',skin:'#b07a52',boots:'#7a4c2c',sole:'#25211e',hat:'#1d70c4',hair:'#1f1a17',beard:'#2b211c',tape:'#d4dadb',belt:'#4a2f20',waist:null})
});

let basePromise=null;
let base=null;
export function loadHumanBase(url=HUMAN_MODEL_URL){
  basePromise??=new GLTFLoader().loadAsync(url).then(gltf=>{base=prepareBase(gltf);return base;});
  return basePromise;
}
export const humanBaseReady=()=>!!base;

// Stand the model on y=0 at HUMAN_HEIGHT, facing +z, with in-place clips.
function prepareBase(gltf){
  const scene=gltf.scene;
  scene.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(scene);
  const scale=HUMAN_HEIGHT/(box.max.y-box.min.y);
  const wrapper=new THREE.Group();wrapper.name='Human base';
  scene.scale.multiplyScalar(scale);
  scene.position.y-=box.min.y*scale;
  wrapper.add(scene);
  wrapper.updateMatrixWorld(true);
  const clips={};
  for(const clip of gltf.animations){
    // Keep the hips over the root: the game moves the character, not the clip.
    for(const track of clip.tracks){
      if(/Hips\.position$/.test(track.name)){
        const v=track.values,x0=v[0],z0=v[2];
        for(let i=0;i<v.length;i+=3){v[i]=x0;v[i+2]=z0;}
      }
    }
    clips[clip.name]=clip;
  }
  const looks={};
  for(const [role,look] of Object.entries(HUMAN_LOOKS))looks[role]=dressGeometry(wrapper,look);
  const stride=measureStrideSpeeds(wrapper,clips);
  return {wrapper,clips,looks,stride,anchors:measureAnchors(wrapper)};
}

const boneOf=name=>name.replace(/^mixamorig:?/,'');
function skinnedMeshes(root){const out=[];root.traverse(o=>{if(o.isSkinnedMesh)out.push(o);});return out;}
// World-space rest-pose position of vertex i (applies the skeleton, not just
// the mesh node transform, which glTF ignores for skinned meshes).
function restVertex(mesh,i,target){
  target.fromBufferAttribute(mesh.geometry.attributes.position,i);
  mesh.applyBoneTransform(i,target);
  return target.applyMatrix4(mesh.matrixWorld);
}
function prepareSkinning(root){
  root.updateMatrixWorld(true);
  for(const m of skinnedMeshes(root))m.skeleton.update();
}

// Rest-pose landmarks used to size and place props.
function measureAnchors(root){
  const find=n=>{let b=null;root.traverse(o=>{if(o.isBone&&boneOf(o.name)===n)b=o;});return b;};
  const pos=n=>find(n).getWorldPosition(new THREE.Vector3());
  const a={hips:pos('Hips'),spine2:pos('Spine2'),neck:pos('Neck'),head:pos('Head'),headTop:pos('HeadTop_End'),
    leftArm:pos('LeftArm'),rightArm:pos('RightArm'),leftLeg:pos('LeftLeg'),leftUpLeg:pos('LeftUpLeg'),leftFoot:pos('LeftFoot')};
  // Surface extents measured from the body mesh itself.
  let chestFront=0,headFront=0,headBack=0,headSide=0,thighOuter=0,crown=0,chin=9;
  const v=new THREE.Vector3();
  prepareSkinning(root);
  for(const mesh of skinnedMeshes(root)){
    const P=mesh.geometry.attributes.position;
    for(let i=0;i<P.count;i++){
      restVertex(mesh,i,v);
      if(v.y>a.neck.y+.03){crown=Math.max(crown,v.y);if(v.z>.06)chin=Math.min(chin,v.y);}
      if(Math.abs(v.y-(a.spine2.y+.02))<.04&&Math.abs(v.x)<.12)chestFront=Math.max(chestFront,v.z);
      if(v.y>a.head.y-.02&&v.y<a.head.y+.15){headFront=Math.max(headFront,v.z);headBack=Math.min(headBack,v.z);headSide=Math.max(headSide,Math.abs(v.x));}
      if(Math.abs(v.y-(a.leftUpLeg.y-.2))<.05&&v.x>0)thighOuter=Math.max(thighOuter,v.x);
    }
  }
  return {...a,chestFront,headFront,headBack,headSide,thighOuter,crown,chin};
}

function dressGeometry(root,look){
  const meshes=skinnedMeshes(root);
  const a=measureAnchors(root);
  const C=k=>new THREE.Color(look[k]);
  const out=new Map();
  const v=new THREE.Vector3();
  prepareSkinning(root);
  for(const mesh of meshes){
    const g=mesh.geometry.clone();
    const P=g.attributes.position,SI=g.attributes.skinIndex,SW=g.attributes.skinWeight;
    const bones=mesh.skeleton.bones.map(b=>boneOf(b.name));
    const colors=new Float32Array(P.count*3);
    for(let i=0;i<P.count;i++){
      restVertex(mesh,i,v);
      let best=0,bw=-1;
      for(let k=0;k<4;k++){const w=SW.getComponent(i,k);if(w>bw){bw=w;best=SI.getComponent(i,k);}}
      const bone=bones[best]||'';
      let c=C('suit');
      const torso=/^(Hips|Spine|Spine1|Spine2)$/.test(bone);
      if(/Head|Eye|Neck/.test(bone)&&v.y>a.neck.y+.02)c=C('skin');
      else if(/Hand/.test(bone))c=C('skin');
      else if(/Foot|Toe/.test(bone)||(/Leg$/.test(bone)&&!/UpLeg/.test(bone)&&v.y<a.leftFoot.y+.07))c=v.y<.035?C('sole'):C('boots');
      else if(torso&&Math.abs(v.y-(a.hips.y+.07))<.028)c=look.belt?C('belt'):C('waist');
      if(look.tape){
        // Reflective tape from reference 2: chest band, shoulder straps,
        // upper-arm bands and shin bands.
        const chestY=a.spine2.y-.02;
        if(torso&&Math.abs(v.y-chestY)<.025)c=C('tape');
        if(torso&&v.y>chestY&&v.y<a.neck.y&&Math.abs(Math.abs(v.x)-.1)<.018)c=C('tape');
        if(/(Left|Right)Arm$/.test(bone)){
          const d=Math.abs(v.x)-Math.abs(a.leftArm.x);
          if(d>.13&&d<.17)c=C('tape');
        }
        if(/Leg$/.test(bone)&&!/UpLeg/.test(bone)&&Math.abs(v.y-(a.leftFoot.y+.14))<.022)c=C('tape');
      }
      colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
    }
    g.setAttribute('color',new THREE.BufferAttribute(colors,3));
    out.set(mesh.name,g);
  }
  return out;
}

// Body speed the walk/run clips were authored for, so playback can match the
// game's ground speed and the feet do not slide.
function measureStrideSpeeds(root,clips){
  const mixer=new THREE.AnimationMixer(root);
  let foot=null,hips=null;
  root.traverse(o=>{if(o.isBone&&boneOf(o.name)==='LeftFoot')foot=o;if(o.isBone&&boneOf(o.name)==='Hips')hips=o;});
  const speeds={};
  const f=new THREE.Vector3(),h=new THREE.Vector3();
  for(const name of ['walk','run']){
    const clip=clips[name];if(!clip)continue;
    const action=mixer.clipAction(clip);action.play();
    // While a foot is planted it slides backwards relative to the hips at the
    // body's ground speed; take the median of those backward samples.
    const n=80,step=clip.duration/n,back=[];
    let prev=null;
    for(let i=0;i<=n;i++){
      mixer.setTime(step*i);root.updateMatrixWorld(true);
      const dz=foot.getWorldPosition(f).z-hips.getWorldPosition(h).z;
      if(prev!==null&&dz<prev)back.push((prev-dz)/step);
      prev=dz;
    }
    back.sort((p,q)=>p-q);
    speeds[name]=Math.max(.3,back[Math.floor(back.length/2)]||1);
    action.stop();
  }
  mixer.stopAllAction();
  root.traverse(o=>{if(o.isBone)o.updateMatrixWorld(true);});
  return speeds;
}

const propMats=new Map();
function propMat(color,rough=.7,metal=0){
  const k=`${color}|${rough}|${metal}`;
  if(!propMats.has(k))propMats.set(k,new THREE.MeshStandardMaterial({color,roughness:rough,metalness:metal}));
  return propMats.get(k);
}
function prop(geo,color,pos,{scale=null,rot=null,rough=.7,metal=0}={}){
  const m=new THREE.Mesh(geo,propMat(color,rough,metal));
  m.position.copy(pos);if(scale)m.scale.set(...scale);if(rot)m.rotation.set(...rot);
  m.castShadow=true;return m;
}

// Props are built in rest-pose world space, then re-parented to their bone.
function dressProps(model,role,look,a){
  const bone=n=>{let b=null;model.traverse(o=>{if(o.isBone&&boneOf(o.name)===n)b=o;});return b;};
  model.updateMatrixWorld(true);
  const head=bone('Head'),chest=bone('Spine2'),hips=bone('Hips');
  // Head ellipsoid measured from the mesh (chin to crown, side to side, back
  // to face). Facial features use adult proportions: eyes at half height.
  const cz=(a.headFront+a.headBack)/2,hd=(a.headFront-a.headBack)/2,hw=a.headSide;
  const H=a.crown-a.chin,cy=(a.crown+a.chin)/2,hh=H/2;
  const front=a.headFront;
  const surfaceZ=x=>cz+hd*Math.sqrt(Math.max(0,1-(x/hw)**2));
  const V=(x,y,z)=>new THREE.Vector3(x,y,z);
  const attach=(b,m)=>{model.add(m);m.updateMatrixWorld(true);b.attach(m);};
  const unit=new THREE.SphereGeometry(1,24,14);
  const arc=(t0,t1,gap=0)=>new THREE.SphereGeometry(1,28,14,Math.PI/2+gap/2,Math.PI*2-gap,t0,t1-t0);
  const frontArc=(t0,t1,width)=>new THREE.SphereGeometry(1,28,14,Math.PI/2-width/2,width,t0,t1-t0);
  const eyeY=a.chin+H*.5,browY=a.chin+H*.585,noseY=a.chin+H*.36,mouthY=a.chin+H*.22;
  // Hardhat: shell sits just above the brows, brim, short front peak, ridge.
  const hatY=browY+H*.06;
  const shellH=a.crown-hatY+.03;
  attach(head,prop(arc(0,Math.PI/2),look.hat,V(0,hatY,cz-.004),{scale:[hw+.03,shellH,hd+.03],rough:.42}));
  attach(head,prop(new THREE.CylinderGeometry(1,1,.01,32),look.hat,V(0,hatY+.004,cz),{scale:[hw+.042,1,hd+.04],rough:.42}));
  attach(head,prop(new THREE.BoxGeometry(hw*1.6,.01,.045),look.hat,V(0,hatY+.002,front+.05),{rot:[.12,0,0],rough:.42}));
  attach(head,prop(new THREE.BoxGeometry(.026,.018,(hd+.03)*1.85),look.hat,V(0,hatY+shellH-.002,cz),{rough:.42}));
  // Short hair at the back and sides, below the hat line.
  attach(head,prop(arc(Math.PI*.32,Math.PI*.62,Math.PI*.95),look.hair,V(0,cy,cz),{scale:[hw+.004,hh+.004,hd+.004],rough:.95}));
  // Full beard: covers jaw, chin and cheeks (front 230 degrees), with moustache.
  const beardTop=(noseY+mouthY)/2;
  attach(head,prop(frontArc(Math.PI*.5,Math.PI*.98,Math.PI*1.22),look.beard,V(0,beardTop,cz+.004),{scale:[hw+.006,beardTop-a.chin+.016,hd+.008],rough:.95}));
  attach(head,prop(new THREE.CapsuleGeometry(.0075,.04,4,8),look.beard,V(0,mouthY+.018,surfaceZ(0)+.008),{rot:[0,0,Math.PI/2],rough:.95}));
  // Eyes, brows and ears; a nose bridge to the tip.
  for(const s of [-1,1]){
    const ex=s*hw*.38;
    attach(head,prop(unit,'#ece6dc',V(ex,eyeY,surfaceZ(ex)-.003),{scale:[.0095,.0058,.006],rough:.3}));
    attach(head,prop(unit,'#2b2016',V(ex,eyeY,surfaceZ(ex)+.002),{scale:[.0045,.0045,.003],rough:.2}));
    attach(head,prop(new THREE.BoxGeometry(.03,.0075,.012),look.hair,V(s*hw*.4,browY,surfaceZ(hw*.4)+.002),{rot:[0,0,s*-.1],rough:.95}));
    attach(head,prop(unit,look.skin,V(s*(hw+.002),eyeY-.008,cz-.006),{scale:[.008,.028,.018],rough:.85}));
  }
  attach(head,prop(new THREE.BoxGeometry(.017,eyeY-noseY,.02),look.skin,V(0,(eyeY+noseY)/2,surfaceZ(0)+.004),{rot:[-.22,0,0],rough:.85}));
  attach(head,prop(unit,look.skin,V(0,noseY+.004,surfaceZ(0)+.012),{scale:[.014,.011,.011],rough:.85}));
  // Chest pockets with flaps and studs, plus the coverall zip.
  for(const s of [-1,1]){
    const x=s*(role==='npc'?.058:.07),y=a.spine2.y+.03,z=a.chestFront+.004;
    attach(chest,prop(new THREE.BoxGeometry(.075,.075,.008),look.suitShade,V(x,y,z),{rough:.9}));
    attach(chest,prop(new THREE.BoxGeometry(.082,.022,.012),look.suit,V(x,y+.042,z+.002),{rough:.9}));
    attach(chest,prop(new THREE.SphereGeometry(.006,6,6),'#cfd6d8',V(x,y+.042,z+.009),{metal:.6,rough:.3}));
  }
  attach(chest,prop(new THREE.BoxGeometry(.008,.22,.006),'#0d2346',V(0,a.spine2.y-.02,a.chestFront+.004),{rough:.6}));
  // Cargo pockets on the outer thighs.
  for(const s of [-1,1]){
    const leg=bone(s<0?'RightUpLeg':'LeftUpLeg');
    attach(leg,prop(new THREE.BoxGeometry(.012,.11,.1),look.suitShade,V((s>0?1:-1)*(a.thighOuter+.004),a.leftUpLeg.y-.2,.01),{rough:.9}));
  }
  if(look.belt)attach(hips,prop(new THREE.BoxGeometry(.05,.04,.012),'#c9d0d3',V(0,a.hips.y+.07,a.chestFront-.012),{metal:.7,rough:.3}));
}

// One animated human. update(motion) is called every frame with the same
// motion state that drives the character controller.
export function createHuman(role='hero'){
  if(!base)throw new Error('Human base model not loaded');
  const look=HUMAN_LOOKS[role]||HUMAN_LOOKS.hero;
  const model=SkeletonUtils.clone(base.wrapper);
  const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.82,metalness:.02});
  const geos=base.looks[role]||base.looks.hero;
  model.traverse(o=>{
    if(o.isSkinnedMesh){o.geometry=geos.get(o.name)||o.geometry;o.material=material;o.castShadow=true;o.receiveShadow=true;o.frustumCulled=false;}
  });
  dressProps(model,role,look,base.anchors);
  // Props ride on bones; merge each bone's props into one draw call.
  mergeRigidChildren(model);
  const mixer=new THREE.AnimationMixer(model);
  const actions={};
  for(const [name,clip] of Object.entries(base.clips)){
    const act=mixer.clipAction(clip);
    if(name==='agree'||name==='headShake'){act.setLoop(THREE.LoopOnce,1);act.clampWhenFinished=false;}
    else{act.play();act.setEffectiveWeight(name==='idle'?1:0);}
    actions[name]=act;
  }
  const state={last:performance.now(),idleFor:0,gesture:null,seed:Math.random()*6};
  function update(motion){
    const now=performance.now();
    const dt=Math.min(.1,Math.max(0,(now-state.last)/1000));state.last=now;
    const speed=Math.max(0,motion.speed||0);
    const walkRef=base.stride.walk||1.4,runRef=base.stride.run||3.6;
    // Idle -> walk -> run blend by ground speed.
    const toWalk=THREE.MathUtils.smoothstep(speed,.05,.9);
    const toRun=THREE.MathUtils.smoothstep(speed,walkRef*1.1,runRef*.85);
    let wIdle=1-toWalk,wWalk=toWalk*(1-toRun),wRun=toWalk*toRun;
    const walk=actions.walk,run=actions.run;
    // Playback rate follows real ground speed; phases stay locked together.
    walk.timeScale=THREE.MathUtils.clamp(speed/walkRef,.45,1.8);
    run.timeScale=THREE.MathUtils.clamp(speed/runRef,.6,1.6);
    if(wRun>.02&&wWalk>.02)run.time=(walk.time/walk.getClip().duration)*run.getClip().duration;
    if(motion.grounded===false){walk.timeScale=0;run.timeScale=0;wIdle=0;wRun=Math.max(wRun,.6);wWalk=1-wRun;}
    // Workers occasionally nod or shake their head while standing around.
    if(role==='npc'&&speed<.05){
      state.idleFor+=dt;
      if(!state.gesture&&state.idleFor>3+state.seed){
        state.gesture=Math.random()<.5?actions.agree:actions.headShake;
        state.gesture.reset().setEffectiveWeight(1).fadeIn(.35).play();
        state.idleFor=0;state.seed=2+Math.random()*6;
      }
    }else state.idleFor=0;
    let gestureWeight=0;
    if(state.gesture){
      const g=state.gesture,left=g.getClip().duration-g.time;
      if(!g.isRunning()||speed>.05){g.fadeOut(.25);state.gesture=null;}
      else gestureWeight=THREE.MathUtils.clamp(left/.35,0,1);
    }
    const rest=1-gestureWeight;
    actions.idle.setEffectiveWeight(wIdle*rest);
    walk.setEffectiveWeight(wWalk*rest);
    run.setEffectiveWeight(wRun*rest);
    mixer.update(dt);
  }
  model.userData.human={update,mixer,role};
  return model;
}
