// v0.3.2 arcade pivot/steering for the fictional travel-lift game.
// Not a representation of certified steering geometry or real equipment controls.
export const HOIST_TURN = Object.freeze({
  pivotRate: .42,      // radians/game-second while stationary
  driveTurnGain: .12,  // retains the v0.3.1 moving-steer response
  pivotMaxSpeed: .24,
  steerDeadzone: .12,
  throttleDeadzone: .15,
  wheelSteerLimit: .38
});
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));

// Proposes an (x,z,heading) transform only. Call sweepVehicle() before
// committing it; rotation must not bypass the hoist's collision constraints.
export function proposeHoistMotion(state,input,dt){
  const speed=Number.isFinite(state.speed)?state.speed:0;
  const steer=clamp(Number(input.steer)||0,-1,1);
  const throttle=clamp(Number(input.throttle)||0,-1,1);
  const seconds=Number.isFinite(dt)?clamp(dt,0,.05):0;
  const pivot=Math.abs(speed)<=HOIST_TURN.pivotMaxSpeed &&
    Math.abs(throttle)<HOIST_TURN.throttleDeadzone && !input.brake &&
    Math.abs(steer)>HOIST_TURN.steerDeadzone;
  const effectiveSpeed=pivot?0:speed;
  const deltaHeading=pivot?steer*HOIST_TURN.pivotRate*seconds:
    steer*effectiveSpeed*HOIST_TURN.driveTurnGain*seconds;
  const heading=state.heading+deltaHeading;
  return {
    x:state.x+Math.sin(heading)*effectiveSpeed*seconds,
    z:state.z+Math.cos(heading)*effectiveSpeed*seconds,
    heading,pivot,steer,deltaHeading
  };
}

// Make each tire station face the tangential path while pivoting.
// 180-degree symmetry keeps tyre direction within +/- 90 degrees.
export function wheelSteeringTarget(x,z,steer,pivot){
  if(!pivot)return clamp(steer,-1,1)*HOIST_TURN.wheelSteerLimit;
  const tangent=Math.atan2(z,-x);
  return Math.atan2(Math.sin(tangent*2),Math.cos(tangent*2))*.5;
}
