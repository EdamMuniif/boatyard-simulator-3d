// Pure gameplay rules, separate from Three.js rendering.
export const PHASES = Object.freeze([
  {id:'DISPATCH', name:'HARBOR DISPATCH', objective:'Walk to harbor dispatch and board the waiting ferry.', hint:'WASD camera-relative walk · SHIFT sprint · SPACE jump · E board'},
  {id:'SAIL', name:'FERRY ARRIVAL', objective:'Pilot the ferry into the lifting basin and stop at the marker.', hint:'W throttle · A/D steer · SPACE brake · E disembark when aligned'},
  {id:'BOARD_HOIST', name:'BOARD THE HOIST', objective:'Approach the blue 200T travel lift and enter its controls.', hint:'WASD walk · SHIFT sprint · E enter travel lift'},
  {id:'POSITION', name:'HOIST ALIGNMENT', objective:'Reverse the hoist over the vessel in the lifting basin.', hint:'S reverse · A/D steer · SPACE brake · E attach when aligned'},
  {id:'LIFT', name:'LIFT THE FERRY', objective:'Raise the simulated slings until the hull clears the ground.', hint:'Hold R or ▲ RAISE until the lifting indicator reaches the target'},
  {id:'HAUL', name:'TRANSFER TO BAY 03', objective:'Drive the loaded travel lift to the designated dry-docking bay.', hint:'W/S drive · A/D steer · C camera · SPACE brake'},
  {id:'LOWER', name:'DRY-DOCK PLACEMENT', objective:'Stop over Bay 03 and lower the ferry onto the dock supports.', hint:'Hold F or ▼ LOWER to place the vessel'},
  {id:'COMPLETE', name:'CONTRACT COMPLETE', objective:'Ferry successfully delivered to Dry Dock Bay 03.', hint:'Mission complete · Play again to restart'}
]);

export const WAYPOINTS = Object.freeze({
  DISPATCH:{x:-18.5,z:44},SAIL:{x:0,z:16},BOARD_HOIST:{x:-16,z:63},POSITION:{x:0,z:16},
  LIFT:{x:0,z:16},HAUL:{x:34,z:108},LOWER:{x:34,z:108},COMPLETE:{x:34,z:108}
});
export const MISSION = Object.freeze({
  ferryDock:{x:0,z:16},dock:{x:34,z:108},
  ferryTolerance:4.4,hoistTolerance:3.4,dockTolerance:6.0,
  maxFerryBerthSpeed:1.5,maxPositionSpeed:1.0,maxDockSpeed:.95,
  liftRequired:5.4,maxLift:6.25,dockPlacementHeight:3.28
});
export const distance2D=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export const atTarget=(a,b,tolerance)=>distance2D(a,b)<=tolerance;
export const canBerthFerry=(pos,speed)=>atTarget(pos,MISSION.ferryDock,MISSION.ferryTolerance)&&Math.abs(speed)<MISSION.maxFerryBerthSpeed;
export const canAttachSling=(pos,speed)=>atTarget(pos,MISSION.ferryDock,MISSION.hoistTolerance)&&Math.abs(speed)<MISSION.maxPositionSpeed;
export const canDock=(pos,speed,lift)=>atTarget(pos,MISSION.dock,MISSION.dockTolerance)&&Math.abs(speed)<MISSION.maxDockSpeed&&lift>=MISSION.liftRequired;


// Reproducible stage-entry checkpoints. Recovery never advances the mission.
// Stage positions are fictional game coordinates and are deliberately independent
// of the vehicle's potentially stuck/invalid live transforms.
export function checkpointForPhase(phaseId){
  if(!PHASES.some(p=>p.id===phaseId)||phaseId==='COMPLETE')return null;
  const state={
    mode:'walk',avatar:{x:-18,y:0,z:37},
    ferry:{x:0,y:0,z:-49},hoist:{x:0,y:0,z:63},
    ferryHeading:0,hoistHeading:0,liftHeight:0,attached:false
  };
  if(phaseId==='DISPATCH')return state;
  if(phaseId==='SAIL'){state.mode='ferry';return state;}
  state.ferry={x:0,y:.07,z:16};
  state.avatar={x:-16.5,y:0,z:52};
  if(phaseId==='BOARD_HOIST')return state;
  state.mode='hoist';
  if(phaseId==='POSITION')return state;
  state.hoist={x:0,y:0,z:16};state.attached=true;
  if(phaseId==='HAUL'||phaseId==='LOWER')state.liftHeight=MISSION.liftRequired;
  if(phaseId==='LOWER'){
    state.hoist={x:MISSION.dock.x,y:0,z:MISSION.dock.z};
  }
  state.ferry={x:state.hoist.x,y:.08+state.liftHeight,z:state.hoist.z};
  return state;
}
