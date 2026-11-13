// 2D arcade collision system. Coordinates match world.js; Y is deliberately ignored.
// This is game collision geometry, not real equipment clearance or lift planning.
export const WORKSHOPS = Object.freeze([
  {id:'marine-engineering',x:-49,z:101,w:29,d:39,h:13,name:'MARINE ENGINEERING'},
  {id:'fabrication',x:56,z:61,w:30,d:33,h:11,name:'FABRICATION'},
  {id:'fibre-wood',x:-49,z:151,w:32,d:23,h:12,name:'FIBRE & WOOD WORKS'},
  {id:'vessel-services',x:54,z:151,w:33,d:27,h:12,name:'VESSEL SERVICES'}
]);
export const CARGO_STACKS = Object.freeze([
  {id:'cargo-west',x:-52,z:52,w:16.2,d:3.2},
  {id:'cargo-east',x:55,z:33,w:16.2,d:3.2}
]);
export const FORKLIFTS = Object.freeze([
  {id:'forklift-west',x:-26,z:78,w:4.6,d:4.6,heading:.7},
  {id:'forklift-east',x:52,z:94,w:4.4,d:4.4,heading:-.4}
]);
const BINS = Object.freeze([-63,-58,-53].flatMap(x=>[23,29].map(z=>({id:`bins-${x}-${z}`,x,z,w:2.4,d:3.2}))));
const STEEL_STORAGE = Object.freeze([{id:'steel-storage',x:62.1,z:129.15,w:9,d:14}]);
// Vessels laid up on stands (v0.4 yard dressing). heading 0/PI = bow along z,
// +-PI/2 = bow along x. Footprints include a 0.5 m margin for the stands.
// A: anchorage, B: slipway, C: yacht refitting (west quay), D: vessel repairs (east quay).
export const HARDSTAND_VESSELS = Object.freeze([
  {id:'yacht-c1',type:'yacht',x:-23,z:7,length:18,beam:5.2,heading:Math.PI},
  {id:'yacht-c2',type:'yacht',x:-32,z:9,length:14,beam:4.4,heading:Math.PI},
  {id:'yacht-c3',type:'yacht',x:-41,z:6,length:20,beam:5.6,heading:Math.PI},
  {id:'tarp-c4',type:'tarp',x:-51,z:8,length:12,beam:4.2,heading:Math.PI},
  {id:'dhow-c5',type:'dhow',x:-63,z:7,length:17,beam:5,heading:Math.PI},
  {id:'workboat-d1',type:'workboat',x:23,z:7,length:20,beam:6,heading:Math.PI,hull:'#3d8a4e',deck:'#c9d3c2',cabin:'#e9ecea'},
  {id:'ferry-d2',type:'ferry',x:33,z:6,length:22,beam:6.4,heading:Math.PI,hull:'#b33a3a',deck:'#dad8cf',cabin:'#f1f1ec'},
  {id:'lander-d3',type:'workboat',x:44,z:8,length:18,beam:5.6,heading:Math.PI,hull:'#4a6f95',deck:'#aeb8b8',cabin:'#d7e1e6'},
  {id:'barge-d4',type:'barge',x:59,z:7,length:22,beam:8,heading:Math.PI},
  {id:'ferry-yard-w',type:'ferry',x:-63,z:70,length:22,beam:6.2,heading:0,hull:'#2f6d9e',deck:'#d4d4cc',cabin:'#f2f2ee'},
  {id:'yacht-yard-w',type:'yacht',x:-50,z:130,length:16,beam:5,heading:Math.PI/2},
  {id:'lander-yard-e',type:'workboat',x:65,z:105,length:18,beam:6,heading:0,hull:'#8a4b2f',deck:'#9a9a90',cabin:'#d9d6cc'}
]);
export const vesselFootprint=v=>{
  const along=Math.abs(Math.sin(v.heading))>.5;
  const w=v.beam+1,d=v.length+1;
  return {id:v.id,x:v.x,z:v.z,w:along?d:w,d:along?w:d};
};
const SCRAP=Object.freeze([{id:'scrap-pile',x:58,z:171,w:22,d:8}]);
const PALMS=Object.freeze([
  ...[48,64,84,128,170].flatMap(z=>[{x:-72,z},{x:72,z}]),
  {x:-26,z:172},{x:-21,z:174},{x:22,z:173},{x:27,z:171}
].map((p,i)=>({id:`palm-${i}`,...p,w:1.1,d:1.1})));
export const PALM_TREES=PALMS;
export const YARD_OBSTACLES = Object.freeze([...WORKSHOPS,...CARGO_STACKS,...FORKLIFTS,...BINS,...STEEL_STORAGE,
  ...HARDSTAND_VESSELS.map(vesselFootprint),...SCRAP,...PALMS]);
// Vessels moored in the water; the player ferry must steer around them.
export const MOORED_VESSELS = Object.freeze([
  {id:'barge-moored',type:'barge',x:46,z:-18,length:28,beam:9,heading:Math.PI/2},
  {id:'tug-moored',type:'workboat',x:-40,z:-15.5,length:12,beam:4.6,heading:-Math.PI/2,hull:'#2a6f8f',deck:'#c8c8c0',cabin:'#eef1ef'}
]);
// Anchorage (A): decorative only, outside the ferry's navigable bounds.
export const ANCHORED_VESSELS = Object.freeze([
  {type:'yacht',x:-95,z:-60,length:16,beam:4.6,heading:.6},
  {type:'sail',x:-120,z:-95,length:12,beam:3.6,heading:1.2},
  {type:'workboat',x:-85,z:-140,length:16,beam:5,heading:-.4,hull:'#9e3b37',deck:'#ccc',cabin:'#eee'},
  {type:'yacht',x:95,z:-75,length:18,beam:5,heading:-.8},
  {type:'sail',x:125,z:-120,length:11,beam:3.4,heading:2.1},
  {type:'sail',x:80,z:-165,length:10,beam:3.2,heading:.3},
  {type:'ferry',x:-40,z:-200,length:24,beam:6.5,heading:1.5,hull:'#2f6d9e',deck:'#ddd',cabin:'#f4f4f0'}
]);
export const PIERS = Object.freeze([
  {id:'west-quay',x:-42.5,z:10.5,w:65,d:43},
  {id:'east-quay',x:42.5,z:10.5,w:65,d:43}
]);
export const BASIN_WALLS = Object.freeze([
  {id:'basin-west',x:-10,z:10.5,w:.65,d:44},
  {id:'basin-east',x:10,z:10.5,w:.65,d:44},
  {id:'basin-end',x:0,z:32.6,w:20,d:.7}
]);
export const WALKABLE_GROUND = Object.freeze([
  {x:0,z:104.5,w:150,d:145},...PIERS
]);
const EPS=1e-7;
const insideRect=(x,z,r)=>Math.abs(x-r.x)<=r.w/2+EPS&&Math.abs(z-r.z)<=r.d/2+EPS;

export function circleOverlapsRect(pos,radius,rect){
  const dx=Math.max(Math.abs(pos.x-rect.x)-rect.w/2,0);
  const dz=Math.max(Math.abs(pos.z-rect.z)-rect.d/2,0);
  return dx*dx+dz*dz<(radius*radius-EPS);
}

// Separating-axis theorem for a yawed vehicle rectangle against a world-aligned obstacle.
export function rectangleOverlapsRect(pos,heading,halfWidth,halfLength,rect){
  const dx=pos.x-rect.x,dz=pos.z-rect.z;
  const c=Math.cos(heading),s=Math.sin(heading),ac=Math.abs(c),as=Math.abs(s);
  const rx=rect.w/2,rz=rect.d/2;
  if(Math.abs(dx)>=rx+halfWidth*ac+halfLength*as-EPS)return false;
  if(Math.abs(dz)>=rz+halfWidth*as+halfLength*ac-EPS)return false;
  if(Math.abs(dx*c-dz*s)>=halfWidth+rx*ac+rz*as-EPS)return false;
  if(Math.abs(dx*s+dz*c)>=halfLength+rx*as+rz*ac-EPS)return false;
  return true;
}

function isOnLand(x,z){return WALKABLE_GROUND.some(r=>insideRect(x,z,r));}
export function canWalkAt(pos,radius=.52){
  // Boundary samples ensure the player does not step into the open-water basin.
  for(let i=0;i<8;i++){
    const a=i*Math.PI/4;
    if(!isOnLand(pos.x+radius*Math.cos(a),pos.z+radius*Math.sin(a)))return false;
  }
  if(!isOnLand(pos.x,pos.z))return false;
  return ![...YARD_OBSTACLES,...BASIN_WALLS].some(rect=>circleOverlapsRect(pos,radius,rect));
}

export function canFerryAt(pos,heading){
  if(Math.abs(pos.x)>68||pos.z< -130||pos.z>24)return false;
  const blockers=[...PIERS,BASIN_WALLS[2],...MOORED_VESSELS.map(vesselFootprint)];
  return !blockers.some(rect=>rectangleOverlapsRect(pos,heading,3.8,11.8,rect));
}

export function canHoistAt(pos,heading){
  // The hoist straddles the basin but its four wheel stations must remain on land.
  // These are approximate arcade footprints, not certified machinery geometry.
  if(Math.abs(pos.x)>55||pos.z<16||pos.z>156)return false;
  if(YARD_OBSTACLES.some(rect=>rectangleOverlapsRect(pos,heading,15.1,17.7,rect)))return false;
  const c=Math.cos(heading),s=Math.sin(heading);
  for(const x of [-12.4,12.4])for(const z of [-14.3,14.3]){
    const wx=pos.x+x*c+z*s,wz=pos.z-x*s+z*c;
    if(!isOnLand(wx,wz))return false;
  }
  return true;
}

// Sweep both translation and steering to prevent moving through a collider at high speed.
export function sweepVehicle(start,end,startHeading,endHeading,isAllowed,step=.4){
  const travel=Math.hypot(end.x-start.x,end.z-start.z);
  const turn=Math.abs(endHeading-startHeading)*18;
  const segments=Math.max(1,Math.ceil((travel+turn)/step));
  for(let i=1;i<=segments;i++){
    const t=i/segments;
    if(!isAllowed({x:start.x+(end.x-start.x)*t,z:start.z+(end.z-start.z)*t},startHeading+(endHeading-startHeading)*t))return false;
  }
  return true;
}
