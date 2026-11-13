import * as THREE from 'three';

// Procedural yard vessels for set dressing (v0.4). Visual only: collision
// footprints live in collision.js (HARDSTAND_VESSELS / MOORED_VESSELS).
// Bow points toward local +z, matching the player ferry.
const materials=new Map();
export function vesselMaterial(color,{roughness=.72,metalness=.06,doubleSide=false}={}){
  const key=`${color}|${roughness}|${metalness}|${doubleSide}`;
  if(!materials.has(key)){
    materials.set(key,new THREE.MeshStandardMaterial({
      color,roughness,metalness,side:doubleSide?THREE.DoubleSide:THREE.FrontSide
    }));
  }
  return materials.get(key);
}
const GLASS='#1b2c3c',STEEL='#7d8d95',WOOD='#7a5232',BLOCK='#6b4a30',RUST='#8b4a2c',TARP='#2f6fc4';
const boxGeo=new Map();
function cube(w,h,d){
  const key=`${w.toFixed(3)}|${h.toFixed(3)}|${d.toFixed(3)}`;
  if(!boxGeo.has(key))boxGeo.set(key,new THREE.BoxGeometry(w,h,d));
  return boxGeo.get(key);
}
function block(parent,w,h,d,x,y,z,color,opts){
  const m=new THREE.Mesh(cube(w,h,d),vesselMaterial(color,opts));
  m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
function rod(parent,r,h,x,y,z,color){
  const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,6),vesselMaterial(color,{metalness:.4}));
  m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;
}

// Normalised plan-view sections (z fraction of half-length, half-beam fraction),
// taken from the player ferry hull so every vessel shares one visual language.
const SECTIONS=[[-.98,.67],[-.82,.94],[-.22,1],[.35,1],[.72,.79],[1,.03]];
export function hullGeometry(length,beam,{depth=1}={}){
  const hl=length/2,hb=beam/2,s=beam/7.2*depth;
  const top=.7*s,chine=-.55*s,keel=-1.65*s;
  const sides=[],bottom=[],deck=[];
  const quad=(a,b,c,d,out)=>out.push(...a,...b,...c,...a,...c,...d);
  for(let i=0;i<SECTIONS.length-1;i++){
    const z=SECTIONS[i][0]*hl,w=SECTIONS[i][1]*hb,z2=SECTIONS[i+1][0]*hl,w2=SECTIONS[i+1][1]*hb;
    for(const side of [-1,1]){
      quad([side*w,top,z],[side*w2,top,z2],[side*w2*.94,chine,z2],[side*w*.94,chine,z],sides);
      bottom.push(side*w*.94,chine,z, side*w2*.94,chine,z2, 0,keel,z2);
      bottom.push(side*w*.94,chine,z, 0,keel,z2, 0,keel,z);
    }
    quad([-w,top+.02,z],[-w2,top+.02,z2],[w2,top+.02,z2],[w,top+.02,z],deck);
  }
  // Transom.
  const [tz,tw]=SECTIONS[0];
  quad([-tw*hb,top,tz*hl],[tw*hb,top,tz*hl],[tw*hb*.94,chine,tz*hl],[-tw*hb*.94,chine,tz*hl],sides);
  bottom.push(-tw*hb*.94,chine,tz*hl, tw*hb*.94,chine,tz*hl, 0,keel,tz*hl);
  const make=v=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();return g;};
  return {sides:make(sides),bottom:make(bottom),deck:make(deck),top,chine,keel,s};
}
function shapedHull(parent,length,beam,{hull='#f2f3ef',bottom='#1f3b5c',deck='#e3e1d8',stripe=null,depth=1}={}){
  const h=hullGeometry(length,beam,{depth});
  for(const [geo,color] of [[h.sides,hull],[h.bottom,bottom],[h.deck,deck]]){
    const m=new THREE.Mesh(geo,vesselMaterial(color,{doubleSide:true}));
    m.castShadow=true;m.receiveShadow=true;parent.add(m);
  }
  if(stripe){
    // Boot stripe just above the chine on both sides.
    for(const side of [-1,1])block(parent,.05,.16*h.s,length*.78,side*beam*.47,h.chine+.25*h.s,-length*.04,stripe);
  }
  return h;
}

function yacht(root,v){
  const L=v.length,B=v.beam;
  const h=shapedHull(root,L,B,{hull:v.hullColor||'#f4f5f2',bottom:'#1e3756',deck:'#d8cfbd',stripe:'#1e3756'});
  const s=h.s,y0=h.top;
  // Tiered superstructure with dark window bands and a raked windscreen.
  block(root,B*.78,1.25*s,L*.48,0,y0+.62*s,-L*.06,'#f7f7f4');
  block(root,B*.8,.32*s,L*.47,0,y0+.82*s,-L*.06,GLASS,{roughness:.15,metalness:.3});
  const screen=block(root,B*.72,.95*s,.18,0,y0+.85*s,L*.19,GLASS,{roughness:.15,metalness:.3});
  screen.rotation.x=-.6;
  block(root,B*.66,.95*s,L*.3,0,y0+1.7*s,-L*.12,'#f7f7f4');
  block(root,B*.68,.26*s,L*.29,0,y0+1.8*s,-L*.12,GLASS,{roughness:.15,metalness:.3});
  block(root,B*.7,.1*s,L*.36,0,y0+2.22*s,-L*.14,'#f7f7f4');
  rod(root,.06*s,1.4*s,0,y0+2.9*s,-L*.1,'#dfe3e4');
}
function workboat(root,v){
  const L=v.length,B=v.beam;
  const h=shapedHull(root,L,B,{hull:v.hull||'#3d8a4e',bottom:'#8f2f2c',deck:v.deck||'#c9d3c2',stripe:'#f2f2ee',depth:1.08});
  const s=h.s,y0=h.top;
  // Bulwarks, aft wheelhouse with window band, mast and deck gear.
  for(const side of [-1,1])block(root,.12,.55*s,L*.7,side*B*.46,y0+.27*s,-L*.06,v.hull||'#3d8a4e');
  block(root,B*.62,1.9*s,L*.22,0,y0+.95*s,-L*.22,v.cabin||'#e9ecea');
  block(root,B*.64,.42*s,L*.215,0,y0+1.45*s,-L*.22,GLASS,{roughness:.15,metalness:.3});
  block(root,B*.68,.12*s,L*.25,0,y0+1.96*s,-L*.22,'#29404e');
  rod(root,.08*s,2.6*s,0,y0+3.2*s,-L*.18,'#d9dcd8');
  block(root,B*.3,.08*s,.08,0,y0+3.9*s,-L*.18,'#d9dcd8');
  for(const [x,z] of [[-.2,.12],[.18,.2],[0,.32]])block(root,B*.22,.6*s,B*.22,B*x,y0+.3*s,L*z,'#b88a3e');
  block(root,B*.5,.45*s,L*.08,0,y0+.22*s,-L*.43,STEEL,{metalness:.5});
}
function ferry(root,v){
  const L=v.length,B=v.beam;
  const h=shapedHull(root,L,B,{hull:v.hull||'#b33a3a',bottom:'#5a2524',deck:v.deck||'#dad8cf',stripe:'#f2f1ea'});
  const s=h.s,y0=h.top;
  block(root,B*.88,2.5*s,L*.64,0,y0+1.25*s,-L*.06,v.cabin||'#f1f1ec');
  block(root,B*.9,.55*s,L*.6,0,y0+1.55*s,-L*.06,GLASS,{roughness:.15,metalness:.3});
  block(root,B*.92,.16*s,L*.66,0,y0+2.58*s,-L*.06,v.hull||'#b33a3a');
  block(root,B*.6,1.1*s,L*.15,0,y0+3.2*s,L*.17,v.cabin||'#f1f1ec');
  block(root,B*.62,.38*s,L*.14,0,y0+3.3*s,L*.17,GLASS,{roughness:.15,metalness:.3});
  for(const x of [-.28,.28])block(root,B*.12,.4*s,B*.12,B*x,y0+2.85*s,-L*.25,'#e5e3dd');
}
function barge(root,v,wet){
  const L=v.length,B=v.beam,s=B/8;
  // Box hull with raked ends, rust deck plating and a low coaming.
  block(root,B,2*s,L*.86,0,-.2*s,0,RUST,{roughness:.92});
  for(const dir of [-1,1]){
    const rake=block(root,B,1.4*s,L*.1,0,.1*s,dir*L*.46,RUST,{roughness:.92});
    rake.rotation.x=dir*.45;
  }
  block(root,B*.98,.06,L*.84,0,.82*s,0,'#6f3d27',{roughness:.95});
  for(let i=-3;i<=3;i++)block(root,B*.96,.07,.12,0,.86*s,i*L*.11,'#4e2c1d',{roughness:.95});
  for(const side of [-1,1])block(root,.2,.5*s,L*.86,side*B*.49,1.05*s,0,'#5b3424',{roughness:.9});
  if(wet)for(const side of [-1,1])for(const z of [-.3,0,.3]){
    const tyre=new THREE.Mesh(new THREE.TorusGeometry(.42,.16,6,10),vesselMaterial('#141a1f',{roughness:.95}));
    tyre.position.set(side*(B*.5+.12),.25*s,z*L);tyre.rotation.y=Math.PI/2;root.add(tyre);
  }
  return {keel:-1.2*s,s};
}
function tarp(root,v){
  const L=v.length,B=v.beam;
  const h=shapedHull(root,L,B,{hull:'#eef0ec',bottom:'#7a2b2a',deck:'#d4cfc4'});
  const s=h.s,y0=h.top;
  const cover=new THREE.Mesh(new THREE.SphereGeometry(1,14,8,0,Math.PI*2,0,Math.PI/2),vesselMaterial(TARP,{roughness:.6}));
  cover.scale.set(B*.5,1.7*s,L*.47);cover.position.set(0,y0,-L*.02);cover.castShadow=true;root.add(cover);
  for(const z of [-.3,0,.3])block(root,B*1.02,.05,.06,0,y0+.2*s,L*z,'#e7e2d5');
}
function dhow(root,v){
  const L=v.length,B=v.beam;
  const h=shapedHull(root,L,B,{hull:WOOD,bottom:'#5f3f26',deck:'#8d6a46',depth:1.15});
  const s=h.s,y0=h.top;
  // Unfinished planking: exposed frames rising above the sheer line.
  for(let i=-5;i<=5;i++){
    const z=i*L*.075,w=B*(1-Math.abs(i)/7)*.48;
    for(const side of [-1,1])block(root,.14,1.3*s,.16,side*w,y0+.6*s,z,'#6b4529');
  }
  block(root,.22,.22,L*.95,0,y0+1.25*s,0,'#6b4529');
  const stem=block(root,.25,2.6*s,.25,0,y0+.8*s,L*.5,'#6b4529');stem.rotation.x=.45;
}
function sail(root,v){
  const L=v.length,B=v.beam;
  const h=shapedHull(root,L,B,{hull:'#f4f5f2',bottom:'#2a3b4f',deck:'#d7cfbf',stripe:'#2b6aa6'});
  const s=h.s,y0=h.top;
  block(root,B*.55,.6*s,L*.3,0,y0+.3*s,-L*.05,'#f4f5f2');
  block(root,B*.56,.2*s,L*.29,0,y0+.42*s,-L*.05,GLASS,{roughness:.15,metalness:.3});
  rod(root,.07,L*.95,0,y0+L*.48,L*.08,'#dfe3e4');
  const boom=rod(root,.05,L*.4,0,y0+1.1*s,-L*.1,'#dfe3e4');boom.rotation.x=Math.PI/2;
}
const BUILDERS={yacht,workboat,ferry,barge,tarp,dhow,sail};

// Keel blocks and side poppets (jack stands) for a hull on hardstand.
function stands(root,v,keelY){
  const L=v.length,B=v.beam;
  const n=Math.max(3,Math.round(L/5));
  for(let i=0;i<n;i++){
    const z=(i/(n-1)-.5)*L*.7;
    block(root,1.1,.22,1.0,0,keelY-.11,z,BLOCK);
    block(root,.9,.5,.8,0,keelY-.47,z,BLOCK);
    block(root,1.1,.28,1.0,0,keelY-.86,z,BLOCK);
  }
  for(const side of [-1,1])for(const f of [-.28,.12,.38]){
    const z=f*L,x=side*B*.36;
    const top=keelY*.3,bottom=keelY-1.0;
    const pole=rod(root,.07,top-bottom,x,(top+bottom)/2,z,'#d9a83a');
    pole.rotation.z=side*.18;
    block(root,.5,.06,.5,x+side*.12,keelY-.97,z,STEEL);
  }
}

export function createVessel(v,{onStands=true}={}){
  const root=new THREE.Group();root.name=`Yard vessel ${v.id||v.type}`;
  const hull=new THREE.Group();root.add(hull);
  const built=(BUILDERS[v.type]||yacht)(hull,v,!onStands);
  const keel=built?.keel??-1.65*v.beam/7.2*(v.type==='workboat'?1.08:v.type==='dhow'?1.15:1);
  if(onStands){
    const blockHeight=1.0;
    hull.position.y=blockHeight-keel;
    stands(hull,v,keel);
  }else{
    hull.position.y=v.type==='barge'?.2:.07;
  }
  root.position.set(v.x,0,v.z);root.rotation.y=v.heading||0;
  return root;
}
