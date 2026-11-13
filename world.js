import * as THREE from 'three';
import {box,cylinder,textTexture,createWaypoint,PALETTE} from './geometry.js';
import {WORKSHOPS,CARGO_STACKS,FORKLIFTS,HARDSTAND_VESSELS,MOORED_VESSELS,ANCHORED_VESSELS,PALM_TREES} from './collision.js';
import {createVessel} from './vessels.js';
import {mergeStaticMeshes} from './static-merge.js';
import {createLocationMarker} from './geometry.js';

const wall = new THREE.MeshStandardMaterial({color:'#587383',roughness:.89});
const roofMat = new THREE.MeshStandardMaterial({color:'#3c667a',roughness:.7,metalness:.33});
const paint = new THREE.MeshStandardMaterial({color:'#dbd8c9',roughness:.98});
const rust = new THREE.MeshStandardMaterial({color:'#985941',roughness:.88});
const safety = new THREE.MeshStandardMaterial({color:'#e2ad54',roughness:.79});
const yellowLine = new THREE.MeshBasicMaterial({color:'#edd2a3'});
const palmTrunk = new THREE.MeshStandardMaterial({color:'#8a6d4c',roughness:.95});
const palmLeaf = new THREE.MeshStandardMaterial({color:'#3f8f45',roughness:.8,side:THREE.DoubleSide});

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
// Corrugated sheet texture shared by all roofs; colour comes from the material.
function makeCorrugated(){
  const c=document.createElement('canvas');c.width=64;c.height=8;
  const ctx=c.getContext('2d');
  for(let x=0;x<64;x++){const v=200+Math.round(55*Math.sin(x/64*Math.PI*8));ctx.fillStyle=`rgb(${v},${v},${v})`;ctx.fillRect(x,0,1,8);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(6,1);
  return t;
}
let corrugated=null;
// Roof colours taken from the reference drone photo: blue, grey and teal sheeting.
const ROOF_COLORS=['#3f7cc0','#a3abae','#4e9fa2','#5d8fc9'];
const roofMats=new Map();
function roofMaterial(color){
  corrugated??=makeCorrugated();
  if(!roofMats.has(color))roofMats.set(color,new THREE.MeshStandardMaterial({color,map:corrugated,roughness:.55,metalness:.35}));
  return roofMats.get(color);
}
function gableRoof(g,w,d,h,color){
  const rise=d*.16,overhang=.6;
  // Gable infill (triangular prism) closes the wall tops under the roof.
  const shape=new THREE.Shape();shape.moveTo(-d/2,0);shape.lineTo(d/2,0);shape.lineTo(0,rise);shape.closePath();
  const gable=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:w,bevelEnabled:false}),wall);
  gable.rotation.y=Math.PI/2;gable.position.set(-w/2,h,0);gable.castShadow=true;g.add(gable);
  const slope=Math.atan2(rise,d/2),len=Math.hypot(rise,d/2)+overhang;
  for(const side of [-1,1]){
    const sheet=box(g,w+overhang*2,.16,len,0,h+rise/2+.08,side*(d/4+overhang/4),roofMaterial(color));
    sheet.rotation.x=side*slope;
  }
  box(g,w+overhang*2,.22,.5,0,h+rise+.08,0,PALETTE.steel,false);
}
function workshop(scene,x,z,w,d,h,name,roofColor=ROOF_COLORS[0]){
  const g=new THREE.Group();g.position.set(x,0,z);scene.add(g);
  box(g,w,h,d,0,h/2,0,wall);
  gableRoof(g,w,d,h,roofColor);
  // Corrugated wall ribs and roof lights stay within workshop collider bounds.
  for(let x=-w/2+1;x<w/2;x+=2.1){
    box(g,.10,h*.72,.12,x,h*.51,d/2+.06,PALETTE.steel,false);
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
function palm(scene,x,z,seed){
  const g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=seed*2.4;scene.add(g);
  const h=7+(seed%3)*1.4,lean=.12+(seed%4)*.04;
  let px=0,py=0;
  for(let i=0;i<5;i++){
    const seg=h/5,r=.34-i*.04;
    const trunk=cylinder(g,r-.03,r,seg,px,py+seg/2,0,palmTrunk,7);
    trunk.rotation.z=-lean*(i/4);
    px+=Math.sin(lean*(i/4))*seg;py+=Math.cos(lean*(i/4))*seg;
  }
  for(let i=0;i<8;i++){
    const a=i/8*Math.PI*2;
    const frond=new THREE.Group();frond.position.set(px,py,0);frond.rotation.y=a;g.add(frond);
    const inner=box(frond,.55,.06,2.3,0,.25,1.05,palmLeaf);inner.rotation.x=-.32;
    const outer=box(frond,.45,.05,2.2,0,-.35,3.0,palmLeaf);outer.rotation.x=.42;
  }
  for(let i=0;i<3;i++)cylinder(g,.18,.18,.3,px+Math.cos(i*2.1)*.35,py-.25,Math.sin(i*2.1)*.35,palmTrunk,6);
}
function dirtTexture(){
  const c=document.createElement('canvas');c.width=c.height=256;const ctx=c.getContext('2d');
  const grad=ctx.createRadialGradient(128,128,20,128,128,128);
  grad.addColorStop(0,'rgba(178,150,112,.95)');grad.addColorStop(.7,'rgba(170,142,104,.7)');grad.addColorStop(1,'rgba(170,142,104,0)');
  ctx.fillStyle=grad;ctx.fillRect(0,0,256,256);
  let seed=91;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<2600;i++){const r=Math.hypot(rand()*256-128,0);ctx.fillStyle=`rgba(90,70,48,${rand()*.18})`;ctx.fillRect(rand()*256,rand()*256,rand()*3+1,rand()*3+1);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function dirtPatches(scene){
  const mat=new THREE.MeshStandardMaterial({map:dirtTexture(),transparent:true,depthWrite:false,roughness:1,polygonOffset:true,polygonOffsetFactor:-2});
  for(const [x,z,w,d,r] of [[-45,12,46,34,.2],[48,14,40,30,-.3],[60,168,36,22,.1],[-58,118,26,40,0],[24,150,24,20,.6],[-30,168,40,16,0]]){
    const m=new THREE.Mesh(new THREE.PlaneGeometry(w,d),mat);m.rotation.set(-Math.PI/2,0,r);m.position.set(x,.012,z);m.receiveShadow=true;scene.add(m);
  }
}
function scrapPile(scene,cx,cz){
  let seed=4242;const rand=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  const mats=[rust,PALETTE.steel,PALETTE.dark,safety,roofMat];
  for(let i=0;i<70;i++){
    const w=.6+rand()*2.6,h=.3+rand()*1.4,d=.6+rand()*2.2;
    const m=box(scene,w,h,d,cx+(rand()-.5)*20,h/2+rand()*.6,cz+(rand()-.5)*6.4,mats[Math.floor(rand()*mats.length)]);
    m.rotation.set((rand()-.5)*.5,rand()*Math.PI,(rand()-.5)*.5);
  }
  // Yellow excavator parked by the scrap line.
  const ex=new THREE.Group();ex.position.set(cx-13,0,cz-1);ex.rotation.y=.4;scene.add(ex);
  box(ex,2.6,.8,4.2,0,.6,0,PALETTE.dark);box(ex,2.4,1.4,2.6,0,1.7,-.3,safety);box(ex,1.1,1.2,1.1,-.5,2.9,.3,PALETTE.glass);
  const arm=box(ex,.45,.45,4.8,0,3.0,2.6,safety);arm.rotation.x=-.5;
  const stick=box(ex,.35,.35,3,0,2.4,5.2,safety);stick.rotation.x=.9;
}
function skyDome(sunDir){
  const mat=new THREE.ShaderMaterial({
    uniforms:{uSun:{value:sunDir.clone().normalize()},uTime:{value:0}},
    side:THREE.BackSide,depthWrite:false,fog:false,
    vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`
      uniform vec3 uSun;uniform float uTime;varying vec3 vDir;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
      float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*noise(p);p*=2.03;a*=.5;}return v;}
      void main(){
        vec3 d=normalize(vDir);float h=max(d.y,0.);
        vec3 zenith=vec3(.20,.50,.84),horizon=vec3(.82,.90,.95);
        vec3 c=mix(horizon,zenith,pow(h,.55));
        float sun=max(dot(d,uSun),0.);
        c+=vec3(1.,.86,.62)*pow(sun,12.)*.35+vec3(1.,.95,.85)*pow(sun,900.)*2.;
        if(d.y>0.){
          vec2 uv=d.xz/(d.y+.12)*1.6+vec2(uTime*.004,0.);
          float cl=smoothstep(.6,.86,fbm(uv*.8));
          c=mix(c,vec3(1.,.99,.97),cl*.8*smoothstep(.04,.3,d.y));
        }
        c=mix(c,vec3(.80,.88,.92),smoothstep(.06,-.02,d.y));
        gl_FragColor=vec4(c,1.);
      }`
  });
  const dome=new THREE.Mesh(new THREE.SphereGeometry(640,32,16),mat);dome.name='Sky dome';dome.renderOrder=-1;dome.frustumCulled=false;
  return dome;
}
function oceanMaterial(sunDir){
  return new THREE.ShaderMaterial({
    uniforms:THREE.UniformsUtils.merge([THREE.UniformsLib.fog,{uTime:{value:0},uSun:{value:sunDir.clone().normalize()}}]),
    fog:true,
    vertexShader:`
      varying vec3 vWorld;
      #include <fog_pars_vertex>
      void main(){
        vec4 world=modelMatrix*vec4(position,1.);vWorld=world.xyz;
        vec4 mvPosition=viewMatrix*world;gl_Position=projectionMatrix*mvPosition;
        #include <fog_vertex>
      }`,
    fragmentShader:`
      uniform float uTime;uniform vec3 uSun;varying vec3 vWorld;
      #include <fog_pars_fragment>
      float sdBox(vec2 p,vec2 c,vec2 h){vec2 d=abs(p-c)-h;return length(max(d,0.))+min(max(d.x,d.y),0.);}
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),u.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x),u.y);}
      void main(){
        vec2 p=vWorld.xz;
        // Distance to the yard landmass (quays + basin) drives shallow-to-deep colour.
        float land=sdBox(p,vec2(0.,83.),vec2(75.,94.));
        float n=noise(p*.03)*.6+noise(p*.11)*.4;
        float shallow=1.-smoothstep(0.,85.,land+n*26.-8.);
        vec3 deep=vec3(.03,.17,.36),mid=vec3(.04,.38,.53),reef=vec3(.16,.66,.66);
        vec3 c=mix(deep,mid,smoothstep(0.,.55,shallow));c=mix(c,reef,smoothstep(.55,1.,shallow));
        // Ripples: two travelling wave sets perturb a flat normal.
        float w1=sin(p.x*.35+p.y*.21+uTime*1.1),w2=sin(p.y*.42-p.x*.17-uTime*.85),w3=noise(p*.6+uTime*.25);
        vec3 nrm=normalize(vec3(w1*.08+(w3-.5)*.12,1.,w2*.08+(w3-.5)*.12));
        vec3 view=normalize(cameraPosition-vWorld);
        float fres=pow(1.-max(dot(view,nrm),0.),3.);
        c=mix(c,vec3(.62,.80,.90),fres*.45);
        vec3 r=reflect(-uSun,nrm);
        c+=vec3(1.,.93,.78)*pow(max(dot(r,view),0.),180.)*1.6;
        // White foam where the water meets the quay walls.
        float edge=1.-smoothstep(0.,3.2,abs(land));
        float foam=edge*smoothstep(.45,.8,noise(p*.5+vec2(uTime*.6,uTime*.3)));
        c=mix(c,vec3(.93,.97,.98),foam*.75);
        gl_FragColor=vec4(c,1.);
        #include <fog_fragment>
      }`
  });
}
export function createWorld(){
  const scene=new THREE.Scene();scene.background=new THREE.Color('#cfe2ec');scene.fog=new THREE.FogExp2('#cfe0ea',.0021);
  // Bright tropical noon: warm key light, sky-blue fill, sand-coloured bounce.
  const hemi=new THREE.HemisphereLight('#d7ecff','#a99c84',2.1);scene.add(hemi);
  const sun=new THREE.DirectionalLight('#fff1d6',3.3);sun.position.set(-65,105,-30);sun.castShadow=true;
  const isTouch=window.matchMedia?.('(pointer: coarse)').matches??false;
  sun.shadow.mapSize.set(isTouch?1024:2048,isTouch?1024:2048);sun.shadow.camera.left=-150;sun.shadow.camera.right=150;
  sun.shadow.camera.top=175;sun.shadow.camera.bottom=-175;sun.shadow.camera.near=1;sun.shadow.camera.far=300;sun.shadow.bias=-.0004;
  scene.add(sun);
  const sky=skyDome(sun.position);scene.add(sky);
  const water=new THREE.Mesh(new THREE.PlaneGeometry(1700,1700,1,1),oceanMaterial(sun.position));
  water.rotation.x=-Math.PI/2;water.position.set(0,-.38,-60);scene.add(water);
  // Every static prop below is built into this group and merged at the end.
  const yard=new THREE.Group();yard.name='Static yard scenery';scene.add(yard);
  const concrete=makeConcrete();
  ground(yard,concrete,150,145,0,104.5);  // Main yard starts at z=32.
  ground(yard,concrete,65,43,-42.5,10.5); // Left pier x:-75..-10.
  ground(yard,concrete,65,43,42.5,10.5);  // Right pier x:10..75.
  // Slip basin boundaries, visible retaining edges and guidance stripes.
  for(const x of [-10,10]){
    box(yard,.65,1.2,44,x,-.28,10.5,wall);
    box(yard,.25,.08,43,x,.1,10.5,PALETTE.golden,false);
  }
  box(yard,20,1.5,.7,0,-.5,32.6,wall);
  // Low-profile stains and inspection markings; non-collidable decoration.
  const stain=new THREE.MeshBasicMaterial({color:'#536871',transparent:true,opacity:.19,depthWrite:false});
  for(const [x,z,w,d] of [[-29,86,6,2],[31,70,4,2],[-19,135,8,2.4],[44,118,5,2]]){
    const mark=new THREE.Mesh(new THREE.PlaneGeometry(w,d),stain);
    mark.rotation.x=-Math.PI/2;mark.position.set(x,.045,z);yard.add(mark);
  }
  // Subtle painted traffic routes along the paved yard.
  for(let z=37;z<152;z+=9){
    box(yard,.15,.018,4,0,.027,z,yellowLine,false);
    box(yard,.1,.018,4,-16,.027,z,yellowLine,false);
  }
  for(let x=10;x<52;x+=8)box(yard,3,.018,.16,x,.028,70,yellowLine,false);
  const walkways=[[-18,42],[-18,47],[-18,52]];
  for(const [x,z] of walkways)box(yard,2,.02,.15,x,.04,z,yellowLine,false);
  // Workshops and warehouses flank the playable transport corridor.
  WORKSHOPS.forEach((o,i)=>workshop(yard,o.x,o.z,o.w,o.d,o.h,o.name,ROOF_COLORS[i%ROOF_COLORS.length]));
  for(const o of CARGO_STACKS)stackedCargo(yard,o.x,o.z);
  for(const o of FORKLIFTS)forklift(yard,o.x,o.z,o.heading);
  // Autonomous worker characters are created/updated by npc-system.js.
  pierBollards(yard);
  // Rubber fenders and guide stripes visually define the lifting basin.
  for(const z of [-5,4,13,22])for(const x of [-10.8,10.8]){
    const fender=cylinder(yard,.27,.27,1.65,x,.1,z,PALETTE.rubber,10);
    fender.rotation.x=Math.PI/2;
  }
  beacon(yard,-8,5);beacon(yard,8,5);
  // Yard prop piles, containers, barriers, and a crane silhouette.
  for(const x of [-63,-58,-53])for(const z of [23,29])box(yard,2.4,1.55,3.2,x,.8,z,rust);
  for(let i=0;i<7;i++)box(yard,1.8,.8,5,60+i*.7,.4,126+i*1.05,PALETTE.steel);
  box(yard,2,6,2,67,3,-.8,PALETTE.hoistDark);
  box(yard,20,.7,1,60,7,-1,PALETTE.hoistDark).rotation.z=.15;
  // Actual docking target has multiple steel support stands.
  support(yard,34,108);
  // v0.4 dressing from the reference drone photo and concept art.
  dirtPatches(yard);
  PALM_TREES.forEach((p,i)=>palm(yard,p.x,p.z,i));
  scrapPile(yard,58,171);
  for(const v of HARDSTAND_VESSELS)yard.add(createVessel(v,{onStands:true}));
  for(const v of [...MOORED_VESSELS,...ANCHORED_VESSELS])yard.add(createVessel(v,{onStands:false}));
  const mergeStats=mergeStaticMeshes(yard);
  // Lettered location markers (A-D here; E rides on the travel lift in main.js).
  const locations=[
    ['A','HARBOR ANCHORAGE',0,16,-78],['B','SLIPWAY',0,15,4],
    ['C','YACHT REFITTING',-34,15,7],['D','VESSEL REPAIRS',38,15,7]
  ].map(([letter,label,x,y,z])=>{
    const marker=createLocationMarker(letter,label);marker.position.set(x,y,z);scene.add(marker);
    return {letter,label,x,z,marker};
  });
  const obj={dispatch:new THREE.Vector3(-18.5,0,44),lift:new THREE.Vector3(0,0,16),dock:new THREE.Vector3(34,0,108)};
  const waypoint=createWaypoint('HARBOR DISPATCH');scene.add(waypoint.group);waypoint.group.position.copy(obj.dispatch);
  const compass=new THREE.Mesh(new THREE.RingGeometry(4,4.2,48),new THREE.MeshBasicMaterial({color:'#67c1da',side:THREE.DoubleSide,transparent:true,opacity:.35}));compass.rotation.x=-Math.PI/2;compass.position.set(0,.08,16);scene.add(compass);
  return {scene,water,sky,objectivePoints:obj,waypoint,compass,locations,mergeStats};
}
