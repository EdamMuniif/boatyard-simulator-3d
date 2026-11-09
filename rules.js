// Pure gameplay rules, separate from Three.js rendering.
export const PHASES = Object.freeze([
  {id:'DISPATCH', name:'HARBOR DISPATCH', objective:'Walk to harbor dispatch and board the waiting ferry.', hint:'WASD move · E board at the gold marker'},
  {id:'SAIL', name:'FERRY ARRIVAL', objective:'Pilot the ferry into the lifting basin and stop at the marker.', hint:'W throttle · A/D steer · SPACE brake · E disembark when aligned'},
  {id:'BOARD_HOIST', name:'BOARD THE HOIST', objective:'Approach the blue 200T travel lift and enter its controls.', hint:'WASD walk · E enter travel lift'},
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
