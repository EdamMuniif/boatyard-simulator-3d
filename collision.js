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
export const YARD_OBSTACLES = Object.freeze([...WORKSHOPS,...CARGO_STACKS,...FORKLIFTS,...BINS,...STEEL_STORAGE]);
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
  const blockers=[...PIERS,BASIN_WALLS[2]];
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
