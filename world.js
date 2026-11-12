import * as THREE from 'three';
import {box,cylinder,textTexture,createWaypoint,PALETTE} from './geometry.js';
import {WORKSHOPS,CARGO_STACKS,FORKLIFTS} from './collision.js';

const wall = new THREE.MeshStandardMaterial({color:'#587383',roughness:.89});
const roofMat = new THREE.MeshStandardMaterial({color:'#3c667a',roughness:.7,metalness:.33});
const paint = new THREE.MeshStandardMaterial({color:'#dbd8c9',roughness:.98});
const rust = new THREE.MeshStandardMaterial({color:'#985941',roughness:.88});
const safety = new THREE.MeshStandardMaterial({color:'#e2ad54',roughness:.79});
const yellowLine = new THREE.MeshBasicMaterial({color:'#edd2a3'});

function makeConcrete() {
  const canvas=document.createElement('canvas');canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#aaa99f';ctx.fillRect(0,0,512,512);
  let seed=8305;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<12500;i++){
    const value=Math.floor(125+rand()*110);
    ctx.fillStyle=`rgba(${value},${value},${value},${.025+rand()*.06})`;
    ctx.fillRect(rand()*512,rand()*512,rand()*4+1,rand()*4+1);
  }
  ctx.strokeStyle='#54554f4d';ctx.lineWidth=2;
  ctx.beginPath();ctx.moveTo(0,3);ctx.lineTo(512,3);ctx.moveTo(3,0);ctx.lineTo(3,512);ctx.stroke();
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(5,5);tex.anisotropy=4;
  return tex;
}
function ground(scene,tex,w,d,x,z){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,d),new THREE.MeshStandardMaterial({map:tex,color:'#d5d0c5',roughness:1}));
  mesh.rotation.x=-Math.PI/2;mesh.position.set(x,.0,z);mesh.receiveShadow=true;scene.add(mesh);
}
function labelSprite(text,w=8){
  const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:textTexture(text,640,96,'#f3f7fa','#18445c',47),depthTest:false}));sp.scale.set(w,1.28,1);return sp;
}
function workshop(scene,x,z,w,d,h,name){
  const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
  box(g,w,h,d,0,h/2,0,wall);
  box(g,w+1,.46,d+1,0,h+.1,0,roofMat);
  // Corrugated wall ribs and roof lights stay within workshop collider bounds.
  for(let x=-w/2+1;x<w/2;x+=2.1){
    box(g,.10,h*.72,.12,x,h*.51,d/2+.06,PALETTE.steel,false);
  }
  for(const x of [-w*.23,w*.23]){
    box(g,w*.18,.045,d*.11,x,h+.35,-d*.17,PALETTE.glass,false);
    box(g,w*.18,.045,d*.11,x,h+.35,d*.17,PALETTE.glass,false);
  }
  for(let j=-1;j<=1;j++){
    const garage=box(g,w/4.8,h*.6,.11,j*(w/3.3),h*.33,-d/2-.08,PALETTE.dark,false);
    for(let k=0;k<5;k++)box(g,w/5.1,.045,.13,garage.position.x,.9+k*.65,-d/2-.17,PALETTE.steel,false);
  }
  for(let i=-2;i<=2;i++)box(g,w*.1,.72,.18,i*w/6,h-.95,-d/2-.15,PALETTE.glass,false);
  const sign=labelSprite(name,Math.min(w*.65,15));sign.position.set(0,h-.6,-d/2-.3);g.add(sign);
  return g;
}
function support(scene,x,z){
  const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
  for(const az of [-7.0,-1.8,4.6,8.2]){
    for(const ax of [-2.25,2.25]){
      box(g,1.1,.13,1.7,ax,.13,az,PALETTE.dark);
      box(g,.58,1.25,.55,ax,.83,az,PALETTE.steel);
      box(g,1.4,.24,1.65,ax,1.55,az,PALETTE.rope);
      const brace=box(g,.1,1.4,.1,ax,1.0,az,PALETTE.steel);brace.rotation.z=ax>0?-.23:.23;
    }
  }
  const border=new THREE.Mesh(new THREE.RingGeometry(11.7,12.0,64),new THREE.MeshBasicMaterial({color:'#d4ba7f',transparent:true,opacity:.69,side:THREE.DoubleSide}));
  border.rotation.x=-Math.PI/2;border.position.y=.06;g.add(border);
  const sign=labelSprite('DRY DOCK BAY 03',14);sign.position.set(0,6,-13);g.add(sign);
}
function forklift(scene,x,z,heading=0){
  const g=new THREE.Group();g.position.set(x,.0,z);g.rotation.y=heading;scene.add(g);
  box(g,2.2,1.1,3.4,0,1.05,0,safety);
  box(g,2.0,.16,1.9,0,2.56,-.3,PALETTE.dark);
  for(const a of [-.8,.8])for(const b of [-1.2,.65])box(g,.1,1.8,.12,a,1.75,b,PALETTE.dark);
  for(const a of [-.88,.88])for(const b of [-1.18,1.18]){
    const wheel=cylinder(g,.49,.49,.35,a,.52,b,PALETTE.rubber,12);wheel.rotation.z=Math.PI/2;
  }
  for(const a of [-.65,.65])box(g,.15,.15,2.6,a,.35,2.05,PALETTE.steel);
  box(g,2.0,3.6,.25,0,1.8,1.73,PALETTE.dark);
}
function stackedCargo(scene,x,z){
  const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
  for(let j=0;j<2;j++)for(let i=0;i<3;i++){
    const m=[rust,roofMat,PALETTE.hoistDark,wall][(j*3+i)%4];
    box(g,5.2,2.55,2.8,(i-1)*5.35,1.27+j*2.57,0,m);
    for(let k=0;k<8;k++)box(g,.045,2.1,.1,(i-1)*5.35-2.3+k*.65,1.28+j*2.57,-1.43,PALETTE.dark,false);
  }
}
function pierBollards(scene){
  for(const x of [-65,-48,-30,-10,10,30,50,65]){
    const b=cylinder(scene,.48,.62,.6,x,.38,-.9,PALETTE.dark);
    cylinder(scene,.75,.75,.18,x,.73,-.9,PALETTE.steel);
  }
}
function beacon(scene,x,z){
  cylinder(scene,.20,.3,5.8,x,2.9,z,PALETTE.steel);
  const lamp=cylinder(scene,.8,.8,.5,x,5.95,z,PALETTE.golden);
  const light=new THREE.PointLight('#ffcc76',1.1,17);light.position.set(x,5.85,z);scene.add(light);
  lamp.castShadow=false;
}
export function createWorld(){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#b8cbd4');scene.fog=new THREE.FogExp2('#aabfc9',.0035);
  const hemi=new THREE.HemisphereLight('#cdeaff','#74818b',2.4);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff0db',2.85);sun.position.set(-65,105,-30);sun.castShadow=true;
  const isTouch=window.matchMedia?.('(pointer: coarse)').matches??false;
  sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);sun.shadow.camera.left=-150;sun.shadow.camera.right=150;
  sun.shadow.camera.top=175;sun.shadow.camera.bottom=-175;sun.shadow.camera.near=1;sun.shadow.camera.far=300;sun.shadow.bias=-.0004;
  scene.add(sun);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(630,600,1,1),new THREE.ShaderMaterial({uniforms:{uTime:{value:0}},vertexShader:`
    varying vec2 vUv;varying vec3 vPosition;
    void main(){vUv=uv;vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}
  `,fragmentShader:`
    uniform float uTime;varying vec2 vUv;varying vec3 vPosition;
    void main(){
      vec2 p=vUv*64.;
      float w=sin(p.x*1.3+p.y*.45+uTime*.9)*sin(p.y*1.5-p.x*.3-uTime*.65);
      float m=sin(p.x*.24+p.y*.19+uTime*.32);
      float glitter=pow(max(0.,sin(p.x*2.7+p.y*.98+uTime*1.2)*sin(p.y*2.6-uTime)),15.);
      float foam=max(0.,sin(p.x*.72+p.y*.31+uTime*.66))*.045;
      vec3 deep=vec3(.035,.23,.30);vec3 cyan=vec3(.085,.38,.43);
      vec3 c=mix(deep,cyan,.48+.20*w+.10*m);c+=vec3(.09,.15,.14)*glitter+vec3(.02,.06,.065)*foam;
      gl_FragColor=vec4(c,1.);
    }
  `,side:THREE.DoubleSide}));water.rotation.x=-Math.PI/2;water.position.set(0,-.38,-110);scene.add(water);
  const concrete=makeConcrete();
  ground(scene,concrete,150,145,0,104.5);  // Main yard starts at z=32.
  ground(scene,concrete,65,43,-42.5,10.5); // Left pier x:-75..-10.
  ground(scene,concrete,65,43,42.5,10.5);  // Right pier x:10..75.
  // Slip basin boundaries, visible retaining edges and guidance stripes.
  for(const x of [-10,10]){
    box(scene,.65,1.2,44,x,-.28,10.5,wall);
    box(scene,.25,.08,43,x,.1,10.5,PALETTE.golden,false);
  }
  box(scene,20,1.5,.7,0,-.5,32.6,wall);
  // Low-profile stains and inspection markings; non-collidable decoration.
  const stain=new THREE.MeshBasicMaterial({color:'#536871',transparent:true,opacity:.19,depthWrite:false});
  for(const [x,z,w,d] of [[-29,86,6,2],[31,70,4,2],[-19,135,8,2.4],[44,118,5,2]]){
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(w,d),stain);
    mark.rotation.x=-Math.PI/2;mark.position.set(x,.045,z);scene.add(mark);
  }
  // Subtle painted traffic routes along the paved yard.
  for(let z=37;z<152;z+=9){
    box(scene,.15,.018,4,0,.027,z,yellowLine,false);
    box(scene,.1,.018,4,-16,.027,z,yellowLine,false);
  }
  for(let x=10;x<52;x+=8)box(scene,3,.018,.16,x,.028,70,yellowLine,false);
  const walkways=[[-18,42],[-18,47],[-18,52]];
  for(const [x,z] of walkways)box(scene,2,.02,.15,x,.04,z,yellowLine,false);
  // Workshops and warehouses flank the playable transport corridor.
  for(const o of WORKSHOPS)workshop(scene,o.x,o.z,o.w,o.d,o.h,o.name);
  for(const o of CARGO_STACKS)stackedCargo(scene,o.x,o.z);
  for(const o of FORKLIFTS)forklift(scene,o.x,o.z,o.heading);
  // Autonomous worker characters are created/updated by npc-system.js.
  pierBollards(scene);
  // Rubber fenders and guide stripes visually define the lifting basin.
  for(const z of [-5,4,13,22])for(const x of [-10.8,10.8]){
    const fender=cylinder(scene,.27,.27,1.65,x,.1,z,PALETTE.rubber,10);
    fender.rotation.x=Math.PI/2;
  }
  beacon(scene,-8,5);beacon(scene,8,5);
  // Yard prop piles, containers, barriers, and a crane silhouette.
  for(const x of [-63,-58,-53])for(const z of [23,29])box(scene,2.4,1.55,3.2,x,.8,z,rust);
  for(let i=0;i<7;i++)box(scene,1.8,.8,5,60+i*.7,.4,126+i*1.05,PALETTE.steel);
  box(scene,2,6,2,67,3,-.8,PALETTE.hoistDark);
  box(scene,20,.7,1,60,7,-1,PALETTE.hoistDark).rotation.z=.15;
  // Actual docking target has multiple steel support stands.
  support(scene,34,108);
  // Harbor launch marker. The ferry begins in open water.
  const dockFloat=box(scene,13,.45,4,-19,-.05,34.2,PALETTE.dark);
  dockFloat.castShadow=false;
  const obj={dispatch:new THREE.Vector3(-18.5,0,44),lift:new THREE.Vector3(0,0,16),dock:new THREE.Vector3(34,0,108)};
  const waypoint=createWaypoint('HARBOR DISPATCH');scene.add(waypoint.group);waypoint.group.position.copy(obj.dispatch);
  const compass=new THREE.Mesh(new THREE.RingGeometry(4,4.2,48),new THREE.MeshBasicMaterial({color:'#67c1da',side:THREE.DoubleSide,transparent:true,opacity:.35}));compass.rotation.x=-Math.PI/2;compass.position.set(0,.08,16);scene.add(compass);
  return {scene,water,objectivePoints:obj,waypoint,compass};
}
