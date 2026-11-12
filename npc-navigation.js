import {canWalkAt} from './collision.js';

// The moving workers occupy pedestrian routes around the active equipment
// corridor. Mission-critical hoist and ferry footprints are never changed.
export const NPC_SPAWNS=Object.freeze([
  {x:-28,z:58,side:'west',speed:1.35},
  {x:31,z:92,side:'east',speed:1.2},
  {x:-22,z:127,side:'west',speed:1.5},
  {x:29,z:140,side:'east',speed:1.35},
  {x:-26,z:155,side:'west',speed:1.25}
]);
export const NPC_GOALS=Object.freeze({
  west:Object.freeze([
    {x:-28,z:49},{x:-25,z:65},{x:-23,z:93},
    {x:-22,z:114},{x:-27,z:141},{x:-26,z:160}
  ]),
  east:Object.freeze([
    {x:30,z:47},{x:27,z:82},{x:32,z:99},
    {x:29,z:116},{x:29,z:143},{x:36,z:159}
  ])
});
export function npcWalkable(pos){
  // Reserve the centre corridor for the 200T fictional travel lift.
  return Number.isFinite(pos.x)&&Number.isFinite(pos.z)
    &&pos.z>=36&&pos.z<=167&&Math.abs(pos.x)>=19
    &&canWalkAt(pos,.64);
}
export function segmentWalkable(from,to,allowed=npcWalkable){
  const d=Math.hypot(to.x-from.x,to.z-from.z);
  const n=Math.max(1,Math.ceil(d/.8));
  for(let i=0;i<=n;i++){
    const t=i/n;
    if(!allowed({x:from.x+(to.x-from.x)*t,z:from.z+(to.z-from.z)*t}))return false;
  }
  return true;
}
export function createNpcGrid(step=4){
  const x0=-68,z0=36,nx=Math.round(136/step)+1,nz=Math.round(128/step)+1;
  const nodes=Array.from({length:nx*nz},(_,id)=>{
    const ix=Math.floor(id/nz),iz=id%nz;
    const pos={x:x0+ix*step,z:z0+iz*step};
    return {...pos,id,ix,iz,valid:npcWalkable(pos)};
  });
  const neighbors=nodes.map(node=>{
    if(!node.valid)return [];
    const result=[];
    for(const ix of [-1,0,1])for(const iz of [-1,0,1]){
      if(ix===0&&iz===0)continue;
      const x=node.ix+ix,z=node.iz+iz;
      if(x<0||z<0||x>=nx||z>=nz)continue;
      const next=nodes[x*nz+z];
      if(next.valid&&segmentWalkable(node,next))result.push(next.id);
    }
    return result;
  });
  return {nodes,neighbors,step};
}
function nearestValid(grid,point){
  let best=-1,bestDistance=Infinity;
  for(const node of grid.nodes){
    if(!node.valid)continue;
    const d=Math.hypot(node.x-point.x,node.z-point.z);
    if(d<bestDistance&&d<=grid.step*2&&segmentWalkable(point,node)){
      best=node.id;bestDistance=d;
    }
  }
  return best;
}
export function planNpcRoute(grid,start,destination){
  if(!npcWalkable(start)||!npcWalkable(destination))return [];
  if(segmentWalkable(start,destination))return [{...destination}];
  const begin=nearestValid(grid,start),end=nearestValid(grid,destination);
  if(begin<0||end<0)return [];
  const count=grid.nodes.length;
  const score=new Float64Array(count).fill(Infinity);
  const came=new Int32Array(count).fill(-1);
  const closed=new Uint8Array(count);
  const open=[begin];score[begin]=0;
  const heuristic=id=>Math.hypot(grid.nodes[id].x-grid.nodes[end].x,grid.nodes[id].z-grid.nodes[end].z);
  while(open.length){
    let bestIndex=0,best=Infinity;
    for(let i=0;i<open.length;i++){
      const n=open[i],f=score[n]+heuristic(n);
      if(f<best){best=f;bestIndex=i;}
    }
    const current=open.splice(bestIndex,1)[0];
    if(current===end){
      const chain=[];
      for(let at=end;at!==-1;at=came[at])chain.push(at);
      chain.reverse();
      const route=chain.map(id=>({x:grid.nodes[id].x,z:grid.nodes[id].z}));
      if(segmentWalkable(route[route.length-1],destination))route.push({...destination});
      return route;
    }
    if(closed[current])continue;
    closed[current]=1;
    for(const next of grid.neighbors[current]){
      if(closed[next])continue;
      const a=grid.nodes[current],b=grid.nodes[next];
      const trial=score[current]+Math.hypot(b.x-a.x,b.z-a.z);
      if(trial>=score[next])continue;
      score[next]=trial;came[next]=current;
      if(!open.includes(next))open.push(next);
    }
  }
  return [];
}
export function advanceNpcMotion(state,destination,dt,allowed=npcWalkable,maxSpeed=1.35){
  const tick=Math.max(0,Math.min(.05,Number.isFinite(dt)?dt:0));
  const dx=destination.x-state.x,dz=destination.z-state.z;
  const distance=Math.hypot(dx,dz);
  if(tick<=0)return {arrived:distance<.3,blocked:false};
  if(distance<.25){
    state.speed=Math.max(0,state.speed-4*tick);
    return {arrived:true,blocked:false};
  }
  state.speed=Math.min(maxSpeed,state.speed+3.2*tick);
  const targetHeading=Math.atan2(dx,dz);
  const delta=Math.atan2(Math.sin(targetHeading-state.heading),Math.cos(targetHeading-state.heading));
  state.heading+=Math.max(-5*tick,Math.min(5*tick,delta));
  const advance=Math.min(distance,state.speed*tick);
  const next={x:state.x+dx/distance*advance,z:state.z+dz/distance*advance};
  if(!segmentWalkable(state,next,allowed)){
    state.speed=0;
    return {arrived:false,blocked:true};
  }
  state.x=next.x;state.z=next.z;state.y=0;
  state.stridePhase+=advance*2.7;
  return {arrived:Math.hypot(destination.x-state.x,destination.z-state.z)<.25,blocked:false};
}
