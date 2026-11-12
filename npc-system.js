import {createYardWorker,animatePlayer} from './geometry.js';
import {createCharacterMotion} from './character-motion.js';
import {
  NPC_SPAWNS,NPC_GOALS,npcWalkable,createNpcGrid,planNpcRoute,advanceNpcMotion
} from './npc-navigation.js';

// Low-cost, local-only ambient workers. No server, AI API, or background jobs.
// They do not change mission state or steer player-controlled equipment.
export function createNpcSystem(scene,{lowPower=false}={}){
  const grid=createNpcGrid();
  // Keep similar activity on phones with fewer draw calls / route updates.
  const configs=lowPower?NPC_SPAWNS.slice(0,3):NPC_SPAWNS;
  const actors=configs.map((config,index)=>{
    const root=createYardWorker();root.position.set(config.x,0,config.z);
    scene.add(root);
    return {
      index,root,motion:createCharacterMotion({x:config.x,y:0,z:config.z}),
      config,waypoints:[],idle:1+index*.5,blockedFor:0,
      destinationIndex:(index+1)%NPC_GOALS[config.side].length
    };
  });
  function chooseDestination(worker){
    const goals=NPC_GOALS[worker.config.side];
    for(let attempts=0;attempts<goals.length;attempts++){
      worker.destinationIndex=(worker.destinationIndex+1)%goals.length;
      const candidate=goals[worker.destinationIndex];
      const path=planNpcRoute(grid,worker.motion,candidate);
      if(path.length&&Math.hypot(candidate.x-worker.motion.x,candidate.z-worker.motion.z)>2){
        worker.waypoints=path;
        return;
      }
    }
    worker.waypoints=[];
    worker.idle=3;
  }
  function nearMovingEquipment(pos,hoist){
    if(!hoist)return false;
    const dx=pos.x-hoist.position.x,dz=pos.z-hoist.position.z;
    const yaw=hoist.rotation.y,c=Math.cos(yaw),s=Math.sin(yaw);
    const localX=dx*c-dz*s,localZ=dx*s+dz*c;
    // Conservative approximate occupancy including wheel stations.
    return Math.abs(localX)<18.5&&Math.abs(localZ)<20.5;
  }
  function update(dt,{player=null,hoist=null,active=true}={}){
    if(!active)return;
    const tick=Math.min(Math.max(dt,0),.05);
    for(const actor of actors){
      if(actor.idle>0){
        actor.idle-=tick;
        actor.motion.speed=Math.max(0,actor.motion.speed-3*tick);
        animatePlayer(actor.root,actor.motion);
        if(actor.idle<=0&&!actor.waypoints.length)chooseDestination(actor);
        continue;
      }
      if(!actor.waypoints.length){chooseDestination(actor);continue;}
      const target=actor.waypoints[0];
      const allowed=pos=>{
        if(!npcWalkable(pos)||nearMovingEquipment(pos,hoist))return false;
        if(player&&Math.hypot(pos.x-player.x,pos.z-player.z)<1.65)return false;
        for(const other of actors){
          if(other===actor)continue;
          if(Math.hypot(pos.x-other.motion.x,pos.z-other.motion.z)<1.12)return false;
        }
        return true;
      };
      const state=advanceNpcMotion(actor.motion,target,tick,allowed,actor.config.speed);
      if(state.arrived){
        actor.waypoints.shift();
        actor.blockedFor=0;
        if(actor.waypoints.length===0)actor.idle=1.5+(actor.index%3)*.55;
      }else if(state.blocked){
        actor.blockedFor+=tick;
        if(actor.blockedFor>3){
          actor.waypoints=[];
          actor.idle=1+(actor.index%2);
          actor.blockedFor=0;
        }
      }else actor.blockedFor=0;
      actor.root.position.set(actor.motion.x,0,actor.motion.z);
      actor.root.rotation.y=actor.motion.heading;
      animatePlayer(actor.root,actor.motion);
    }
  }
  for(const actor of actors)animatePlayer(actor.root,actor.motion);
  return {actors,update};
}
