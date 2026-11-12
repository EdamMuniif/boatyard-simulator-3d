import * as THREE from 'three';
import {createWorkerAvatar,animateWorkerAvatar} from './worker-avatar.js';
import {SLING_STATIONS,SLING_SEGMENTS,SLING_HALF_SPAN,SLING_WEB_WIDTH,rigPose,slingPoint} from './rigging-profile.js';

const mat = (color, roughness = 0.78, metalness = 0.05) => new THREE.MeshStandardMaterial({color, roughness, metalness});
export const PALETTE = {
  hoist: mat('#2076ad', .63, .32), hoistDark: mat('#12496e', .65, .35),
  hoistBright: mat('#459ac4', .52, .34), steel: mat('#778c96', .65, .58),
  rubber: mat('#181f26', .95), hub: mat('#1175b4', .5, .5),
  ivory: mat('#f0f3ed'), glass: mat('#172a3a', .13, .24), red: mat('#9b3f3b'),
  stripe: mat('#10a5d5'), golden: mat('#b9986c'), rope: mat('#a38b6d'),
  dark: mat('#172a35'), safety: mat('#f0ae49'), foliage: mat('#4b7963')
};

export function box(parent, w, h, d, x, y, z, material, shadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), material);
  mesh.position.set(x,y,z);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function cylinder(parent, rTop, rBottom, height, x, y, z, material, segments=12) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop,rBottom,height,segments), material);
  mesh.position.set(x,y,z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function textTexture(text, width=1024, height=168, color='#f6faff', bg=null, fontSize=74) {
  const canvas=document.createElement('canvas'); canvas.width=width; canvas.height=height;
  const ctx=canvas.getContext('2d');
  if(bg){ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);}
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.font=`900 ${fontSize}px Arial, sans-serif`;
  ctx.fillStyle=color;ctx.fillText(text,width/2,height/2,width-24);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  return texture;
}

function panelLabel(parent, text, width, height, pos, direction=0, fontSize=60) {
  const plane=new THREE.Mesh(
    new THREE.PlaneGeometry(width,height),
    new THREE.MeshBasicMaterial({map:textTexture(text,1024,132,'#ecf6fd',null,fontSize),transparent:true,depthWrite:false,side:THREE.DoubleSide})
  );
  plane.position.set(...pos); plane.rotation.y=direction;parent.add(plane);
  return plane;
}

export function createHoist() {
  const root=new THREE.Group(); root.name='Boat Hoist - Travel Lift';
  const W=12.4,L=14.3;
  // Welded portal frame, four columns, longitudinal beams, and cross beam signage.
  for(const x of [-W,W])for(const z of [-L,L]) {
    box(root,1.85,16.9,2.0,x,10,z,PALETTE.hoist);
    box(root,3.3,1.7,4.1,x,2.7,z,PALETTE.hoistDark);
    box(root,2.5,.7,3.3,x,17.7,z,PALETTE.hoistBright);
    for(const yy of [3.5,4.6,5.7])box(root,2.0,.10,2.15,x,yy,z,PALETTE.hoistDark,false);
    cylinder(root,1.2,1.2,.25,x,3.8,z,PALETTE.steel,20);
    // Four independent wheel stations, two tires per station.
  }
  for(const x of [-W,W]) {
    box(root,1.7,1.7,31.5,x,18.4,0,PALETTE.hoist);
    box(root,1.1,.52,29,x,19.7,0,PALETTE.steel);
    box(root,.095,.10,31.2,x,20.73,0,PALETTE.steel,false);
    for(const z of [-13,-7,0,7,13])box(root,.10,.85,.10,x,20.27,z,PALETTE.steel,false);
    for(const z of [-9.5,9.5]) {
      const drum=cylinder(root,1,1,3.0,x,5.5,z,PALETTE.steel,18);
      drum.rotation.x=Math.PI/2;
      const sleeve=cylinder(root,1.1,1.1,.22,x,5.5,z,PALETTE.hoistBright,16);
      sleeve.rotation.x=Math.PI/2;
      for(const dz of [-1.25,1.25]){
        const flange=cylinder(root,1.28,1.28,.14,x,5.5,z+dz,PALETTE.hoistBright,18);
        flange.rotation.x=Math.PI/2;
      }
    }
  }
  for(const z of [-L,L]) {
    box(root,26.3,2.2,2.1,0,19,z,PALETTE.hoist);
    box(root,26.0,.18,.14,0,20.2,z,PALETTE.steel);
    panelLabel(root,'BOATYARD SIMULATOR',22.7,1.25,[0,19.02,z + Math.sign(z)*1.08],z>0?0:Math.PI,43);
  }
  // Side-mounted industrial systems and machinery cabinets.
  for(const x of [-W,W]) {
    box(root,2.65,2.5,6,x,4.25,-3.5,PALETTE.hoistDark);
    box(root,2.7,1.65,6.05,x,4.3,-3.5,PALETTE.steel);
    box(root,2.25,1.3,3.6,x,3.7,7.5,PALETTE.hoistDark);
    for(const z of [-4.5,-2.5])box(root,2.75,.11,.12,x,4,z,PALETTE.hoistBright,false);
  }
  const wheels=[];
  for(const x of [-W,W])for(const z of [-L,L])for(const offset of [-1.45,1.45]) {
    // Independent yaw and rolling pivots: steering no longer tilts tyre mesh.
    const pivot=new THREE.Group();pivot.position.set(x+Math.sign(x)*.45,2.28,z+offset);
    const roll=new THREE.Group();pivot.add(roll);
    const tire=cylinder(roll,2.08,2.08,1.08,0,0,0,PALETTE.rubber,20);
    tire.rotation.z=Math.PI/2;
    const hub=cylinder(roll,.95,.95,1.12,0,0,0,PALETTE.hub,18); hub.rotation.z=Math.PI/2;
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5;
      const tread=box(roll,.95,.23,.46,0,Math.sin(a)*1.96,Math.cos(a)*1.96,PALETTE.dark,false);
      tread.rotation.x=-a;
    }
    pivot.userData.roll=roll;
    root.add(pivot); wheels.push(pivot);
  }
  // Four reference-inspired U-shaped webbing cradles with animated lifting
  // blocks and wire-falls. Purely visual: no certified sling physics.
  const webColors=['#8e7156','#54453b','#96795c','#625041'];
  const rigs=[];
  for(let station=0;station<SLING_STATIONS.length;station++){
    const z=SLING_STATIONS[station];
    const data=new Float32Array((SLING_SEGMENTS+1)*6);
    const indices=[];
    for(let j=0;j<SLING_SEGMENTS;j++){
      const k=j*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);
    }
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.BufferAttribute(data,3));
    geometry.setIndex(indices);
    const web=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
      color:webColors[station],roughness:.96,side:THREE.DoubleSide
    }));
    web.name='Suspended fabric sling '+(station+1);
    web.castShadow=false;web.receiveShadow=true;web.frustumCulled=false;
    root.add(web);
    const blocks=[],wires=[];
    for(const side of [-1,1]){
      const x=side*SLING_HALF_SPAN;
      const block=new THREE.Group();block.position.set(x,rigPose(0,false).blockY,z);
      box(block,1.75,.48,1.12,0,0,0,PALETTE.hoistBright);
      box(block,1.25,.60,1.05,0,.45,0,PALETTE.hoistDark);
      box(block,.44,.6,.42,0,-.47,0,PALETTE.steel);
      for(const dx of [-.48,.48]){
        const sheave=cylinder(block,.24,.24,.16,dx,.42,0,PALETTE.steel,12);
        sheave.rotation.x=Math.PI/2;
      }
      root.add(block);blocks.push(block);
      box(root,.85,.32,.9,side*11.8,18.7,z,PALETTE.hoistDark);
      for(const dz of [-.27,.27]){
        const points=new Float32Array([side*11.8,19.12,z+dz,x,13.1,z+dz]);
        const wireGeom=new THREE.BufferGeometry();
        wireGeom.setAttribute('position',new THREE.BufferAttribute(points,3));
        const wire=new THREE.Line(wireGeom,new THREE.LineBasicMaterial({color:'#455664'}));
        wire.frustumCulled=false;root.add(wire);
        wires.push({wire,points,x,dz});
      }
    }
    rigs.push({z,data,geometry,blocks,wires});
  }
  let lastLift=NaN,lastAttached=null;
  function setRigging(height,attached){
    if(height===lastLift&&attached===lastAttached)return;
    lastLift=height;lastAttached=attached;
    const pose=rigPose(height,attached);
    for(const rig of rigs){
      for(let j=0;j<=SLING_SEGMENTS;j++){
        const point=slingPoint(j/SLING_SEGMENTS,pose),i=j*6;
        rig.data[i]=point.x;rig.data[i+1]=point.y;rig.data[i+2]=rig.z-SLING_WEB_WIDTH/2;
        rig.data[i+3]=point.x;rig.data[i+4]=point.y;rig.data[i+5]=rig.z+SLING_WEB_WIDTH/2;
      }
      rig.geometry.attributes.position.needsUpdate=true;
      rig.geometry.computeVertexNormals();
      for(const block of rig.blocks)block.position.y=pose.blockY;
      for(const cable of rig.wires){
        cable.points[3]=cable.x;
        cable.points[4]=pose.blockY+.45;
        cable.points[5]=rig.z+cable.dz;
        cable.wire.geometry.attributes.position.needsUpdate=true;
      }
    }
  }
  setRigging(0,false);
  return {root,wheels,setRigging};
}

function quad(vertices, a,b,c,d){vertices.push(...a,...b,...c,...a,...c,...d);}
function tri(vertices,a,b,c){vertices.push(...a,...b,...c);}
function shapeHull(parent){
  const sections=[[-11.3,2.4],[-9.4,3.4],[-2.5,3.6],[4.0,3.6],[8.3,2.85],[11.7,.12]];
  const shell=[],bottom=[],deck=[];
  for(let i=0;i<sections.length-1;i++){
    const [z,w]=sections[i],[z2,w2]=sections[i+1];
    for(const side of [-1,1]) {
      quad(shell,[side*w,.70,z],[side*w2,.70,z2],[side*w2*.94,-.55,z2],[side*w*.94,-.55,z]);
      tri(bottom,[side*w*.94,-.55,z],[side*w2*.94,-.55,z2],[0,-1.65,z2]);
      tri(bottom,[side*w*.94,-.55,z],[0,-1.65,z2],[0,-1.65,z]);
    }
    quad(deck,[-w,.72,z],[-w2,.72,z2],[w2,.72,z2],[w,.72,z]);
  }
  const add=(v,m)=>{const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,m);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);};
  add(shell,new THREE.MeshStandardMaterial({color:'#edf0ed',roughness:.71,side:THREE.DoubleSide}));
  add(bottom,new THREE.MeshStandardMaterial({color:'#9b3e3d',roughness:.8,side:THREE.DoubleSide}));
  add(deck,new THREE.MeshStandardMaterial({color:'#e7e8e3',roughness:.82,side:THREE.DoubleSide}));
}
export function createFerry(){
  const root=new THREE.Group();root.name='Passenger ferry';
  shapeHull(root);
  // Passenger saloon, bridge, side windows, roof and ferry livery.
  box(root,6.45,2.9,14.2,0,2.23,-.9,PALETTE.ivory);
  box(root,6.7,.28,14.6,0,3.78,-.9,PALETTE.ivory);
  box(root,6.85,.13,14.5,0,3.98,-.9,PALETTE.stripe,false);
  box(root,5.6,1.45,3.3,0,3.28,6.1,PALETTE.ivory);
  box(root,5.65,.18,3.4,0,4.1,6.1,PALETTE.ivory);
  box(root,5.6,1.08,.12,0,3.25,7.8,PALETTE.glass,false);
  for(const x of [-3.25,3.25]) {
    for(let z=-6.6;z<=4.2;z+=2.5)box(root,.08,1.15,1.65,x,2.65,z,PALETTE.glass,false);
    box(root,.13,.19,13.6,x,1.5,-.9,PALETTE.dark,false);
    box(root,.12,.53,4.8,x,1.3,-1.0,PALETTE.stripe,false);
    box(root,.12,.20,13.3,x,3.15,-.9,PALETTE.steel,false);
  }
  for(const x of [-2.6,2.6])for(const z of [8.7,10.6])cylinder(root,.052,.052,1.1,x,1.34,z,PALETTE.steel,6);
  for(const x of [-2.6,2.6]){
    const railing=box(root,.07,.06,3.3,x,1.9,9.4,PALETTE.steel,false);
    railing.rotation.y=0;
  }
  cylinder(root,.12,.15,1.0,0,4.4,3,PALETTE.steel,10);
  panelLabel(root,'FERRY 01',3.6,.85,[0,2.7,-8.03],Math.PI,66);
  for(const x of [-3.25,3.25])for(const z of [-5.2,5.8]){
    const fender=cylinder(root,.27,.27,1.8,x,1.48,z,PALETTE.dark,10);fender.rotation.x=Math.PI/2;
  }
  for(const x of [-3.32,3.32]){
    for(let z=-6.6;z<=4.2;z+=2.5)box(root,.1,1.18,.065,x,2.65,z+.85,PALETTE.steel,false);
    for(const z of [-8.1,7.6])box(root,.28,.19,.62,x*.85,1.08,z,PALETTE.steel,false);
  }
  for(const z of [-5,-1,3]){
    box(root,1.1,.19,.9,0,4.09,z,PALETTE.steel,false);
    box(root,.85,.13,.65,0,4.26,z,PALETTE.dark,false);
  }
  // Visual sway is a child-only effect; navigation and collider coordinates
  // continue to live on the unmodified root group.
  const visual=new THREE.Group();visual.name='Ferry visual shell';
  while(root.children.length)visual.add(root.children[0]);
  root.add(visual);
  return {root,visual};
}

// Keep the existing gameplay API stable, replacing only the visual rig.
export function createPlayer(){
  const root=createWorkerAvatar('hero');
  return root;
}

export function createYardWorker(){
  const root=createWorkerAvatar('npc');
  return root;
}

export function animatePlayer(root,motion){
  animateWorkerAvatar(root,motion);
}

export function createWaypoint(label, color='#f3c278'){
  const group=new THREE.Group();group.name=`Waypoint ${label}`;
  const ring=new THREE.Mesh(new THREE.TorusGeometry(2.8,.12,9,48),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.92}));
  ring.rotation.x=Math.PI/2;ring.position.y=.17;group.add(ring);
  const beam=new THREE.Mesh(new THREE.CylinderGeometry(.13,.35,10,12,1,true),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide}));
  beam.position.y=5.15;group.add(beam);
  const pointer=new THREE.Mesh(new THREE.OctahedronGeometry(.9),new THREE.MeshBasicMaterial({color}));
  pointer.position.y=4.5;group.add(pointer);
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:textTexture(label,640,90,'#fff3d6','#092438',38),depthTest:false}));
  sprite.position.y=6.8;sprite.scale.set(8.3,1.24,1);group.add(sprite);
  return {group,ring,pointer};
}
