import * as THREE from 'three';

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
    // Four independent wheel stations, two tires per station.
  }
  for(const x of [-W,W]) {
    box(root,1.7,1.7,31.5,x,18.4,0,PALETTE.hoist);
    box(root,1.1,.52,29,x,19.7,0,PALETTE.steel);
    for(const z of [-9.5,9.5]) {
      const drum=cylinder(root,1,1,3.0,x,5.5,z,PALETTE.steel,18);
      drum.rotation.x=Math.PI/2;
      const sleeve=cylinder(root,1.1,1.1,.22,x,5.5,z,PALETTE.hoistBright,16);
      sleeve.rotation.x=Math.PI/2;
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
    const pivot=new THREE.Group();pivot.position.set(x+Math.sign(x)*.45,2.28,z+offset);
    const tire=cylinder(pivot,2.08,2.08,1.08,0,0,0,PALETTE.rubber,20);
    tire.rotation.z=Math.PI/2;
    const hub=cylinder(pivot,.95,.95,1.12,0,0,0,PALETTE.hub,18); hub.rotation.z=Math.PI/2;
    for(let i=0;i<10;i++) {
      const a=i*Math.PI/5;
      const tread=box(pivot,.95,.23,.46,0,Math.sin(a)*1.96,Math.cos(a)*1.96,PALETTE.dark,false);
      tread.rotation.x=-a;
    }
    root.add(pivot); wheels.push(pivot);
  }
  // Block clusters, vertical wire ropes and adjustable textile lifting slings.
  const rigs=[];
  for(const z of [-8.2,8.2]) {
    for(const x of [-6,6]) {
      box(root,.9,.65,1.4,x,15.8,z,PALETTE.hoistBright);
      box(root,.5,.95,.75,x,14.8,z,PALETTE.steel);
    }
    const slingBottom=box(root,10,.16,.56,0,.4,z,PALETTE.rope,false);
    const legs=[];
    for(const x of [-5.05,5.05])legs.push(box(root,.2,8.0,.5,x,7.4,z,PALETTE.rope,false));
    const ropes=[];
    for(const x of [-6.0,6.0]) {
      const wirePath=new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(x,17.9,z),new THREE.Vector3(x,14.7,z),new THREE.Vector3(x*.84,13.9,z)
      ]);
      const line=new THREE.Line(wirePath,new THREE.LineBasicMaterial({color:'#526470'}));
      root.add(line);ropes.push({line,x});
    }
    rigs.push({slingBottom,legs,ropes,z});
  }
  function setRigging(height,visible) {
    for(const rig of rigs) {
      const bottomY=height-1.0;
      rig.slingBottom.position.y=bottomY;
      rig.slingBottom.visible=visible;
      rig.legs.forEach(leg=>{const top=14.35; const length=Math.max(.3,top-bottomY);leg.scale.y=length/8;leg.position.y=(top+bottomY)/2;leg.visible=visible;});
      rig.ropes.forEach(({line})=>{line.visible=true;});
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
  const root=new THREE.Group();root.name='Ferry RTL-style vessel';
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
  panelLabel(root,'RTL 121',3.6,.85,[0,2.7,-8.03],Math.PI,76);
  for(const x of [-3.25,3.25])for(const z of [-5.2,5.8]){
    const fender=cylinder(root,.27,.27,1.8,x,1.48,z,PALETTE.dark,10);fender.rotation.x=Math.PI/2;
  }
  return {root};
}

export function createPlayer(){
  const root=new THREE.Group();root.name='Player';
  const boots=mat('#1c2732'),navy=mat('#153f66'),skin=mat('#b98763'),hat=mat('#267fb0');
  box(root,.76,1.0,.42,0,1.18,0,navy);
  cylinder(root,.27,.26,.36,0,1.88,0,skin,11);
  cylinder(root,.39,.39,.22,0,2.12,0,hat,14);
  box(root,.81,.12,.57,0,2.12,.13,hat,false);
  for(const x of [-.51,.51]){
    box(root,.22,.83,.25,x,1.24,0,navy);
    box(root,.2,.14,.21,x,.81,0,skin);
  }
  for(const x of [-.22,.22]){
    box(root,.29,.72,.32,x,.39,0,boots);
    box(root,.32,.17,.47,x,.10,.08,boots);
  }
  root.traverse(obj=>{if(obj.isMesh)obj.castShadow=true;});
  return root;
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
