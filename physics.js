// Real-time dynamics for the ferry, the travel lift and its suspended load
// (v0.5). Pure functions with no Three.js dependency so they can be tested.
//
// These are simplified rigid-body and pendulum models tuned for play, not
// engineering models of a real travel lift or vessel. Units are game metres,
// seconds and radians.
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export const G=9.81;

// --- Suspended load: damped 2-axis pendulum ---------------------------------
// lon: swing along the lift's travel direction (+ = forward).
// lat: swing sideways (+ = toward the lift's local +x).
export const SWING=Object.freeze({
  damping:.32,          // 1/s, sling friction and air drag
  maxInputAccel:3,      // m/s^2; clamps instant game stops (snaps, impacts)
  settled:.03,          // rad; load is steady enough to set down
  minLength:2.5,maxLength:18
});
export const createSwing=()=>({lon:0,lonVel:0,lat:0,latVel:0});
export const resetSwing=s=>Object.assign(s,createSwing());

// The suspension point accelerates with the lift. In the lift's frame the load
// feels the opposite (inertial) acceleration:
//   theta'' = -(g/L) sin(theta) - (a/L) cos(theta) - c theta'
export function stepSwing(s,{accel=0,lateral=0,length=8},dt){
  const L=clamp(Number(length)||8,SWING.minLength,SWING.maxLength);
  const aLon=clamp(Number(accel)||0,-SWING.maxInputAccel,SWING.maxInputAccel);
  const aLat=clamp(Number(lateral)||0,-SWING.maxInputAccel,SWING.maxInputAccel);
  const total=clamp(Number(dt)||0,0,.1);
  const steps=Math.max(1,Math.ceil(total/.005));
  const h=total/steps;
  for(let i=0;i<steps;i++){
    // Semi-implicit Euler: stable for a lightly damped pendulum.
    s.lonVel+=(-(G/L)*Math.sin(s.lon)-(aLon/L)*Math.cos(s.lon)-SWING.damping*s.lonVel)*h;
    s.latVel+=(-(G/L)*Math.sin(s.lat)-(aLat/L)*Math.cos(s.lat)-SWING.damping*s.latVel)*h;
    s.lon+=s.lonVel*h;s.lat+=s.latVel*h;
  }
  return s;
}
// Peak angle the load will reach from its current angle and angular speed
// (energy method), so "settled" means settled, not just passing through zero.
export function swingAmplitude(s,length=8){
  const L=clamp(length,SWING.minLength,SWING.maxLength),w2=L/G;
  return Math.sqrt(s.lon*s.lon+s.lat*s.lat+(s.lonVel*s.lonVel+s.latVel*s.latVel)*w2);
}
// Visual offset of the hanging load from its rest position (lift-local frame).
export function swingOffset(s,length=8){
  const L=clamp(length,SWING.minLength,SWING.maxLength);
  return {
    x:L*Math.sin(s.lat),z:L*Math.sin(s.lon),
    y:L*(2-Math.cos(s.lon)-Math.cos(s.lat)),
    pitch:-s.lon*.3,roll:s.lat*.3
  };
}

// --- Travel lift drive: mass-dependent traction and braking ------------------
export const HOIST_DYNAMICS=Object.freeze({
  massEmpty:85,massLoad:60,   // tonnes (fictional)
  traction:4.5,               // m/s^2 for the empty lift at full throttle
  rolling:1.25,turningDrag:4.5,idleDrag:7,
  brake:8,                    // 1/s braking rate for the empty lift
  maxForward:5.25,maxReverse:4.25,stopBelow:.045
});
export const hoistMassFactor=loaded=>HOIST_DYNAMICS.massEmpty/(HOIST_DYNAMICS.massEmpty+(loaded?HOIST_DYNAMICS.massLoad:0));
// Same force on more mass: a loaded lift accelerates and brakes more slowly.
export function stepHoistSpeed(speed,{throttle=0,brake=false,driving=true,turningInPlace=false,loaded=false},dt){
  const D=HOIST_DYNAMICS,k=hoistMassFactor(loaded);
  const drag=driving?(turningInPlace?D.turningDrag:D.rolling):D.idleDrag;
  let v=speed+throttle*D.traction*k*dt-speed*drag*dt;
  if(brake)v*=Math.exp(-D.brake*k*dt);
  v=clamp(v,-D.maxReverse,D.maxForward);
  if(Math.abs(v)<D.stopBelow&&Math.abs(throttle)<.12)v=0;
  return v;
}

// --- Ferry: thrust, hydrodynamic drag, rudder authority, heel and trim -------
export const FERRY_DYNAMICS=Object.freeze({
  thrust:3.7,reverseEfficiency:.6,
  linearDrag:.18,quadraticDrag:.055,   // drag grows with speed squared
  crashStop:1.0,                       // m/s^2 with engines astern (plus drag)
  bowThruster:.06,rudderGain:.07,      // rad/s at zero speed; per m/s of speed
  yawResponse:1.6,                     // 1/s, yaw inertia
  maxForward:6.25,maxReverse:2.75,
  heelGain:.06,maxHeel:.08,trimGain:.004,squatGain:.015
});
export const createFerryState=()=>({speed:0,yawRate:0,heel:0,trim:0});
export function stepFerry(st,{throttle=0,steer=0,brake=false},dt){
  const F=FERRY_DYNAMICS;
  const before=st.speed;
  const thrust=throttle*F.thrust*(throttle<0?F.reverseEfficiency:1);
  const drag=F.linearDrag*st.speed+F.quadraticDrag*st.speed*Math.abs(st.speed);
  let v=st.speed+(thrust-drag)*dt;
  if(brake){const d=F.crashStop*dt;v=Math.abs(v)<=d?0:v-Math.sign(v)*d;}
  st.speed=clamp(v,-F.maxReverse,F.maxForward);
  // Rudder needs water flowing past it; a small bow thruster helps at rest.
  const flow=Math.min(Math.abs(st.speed),4);
  const target=steer*(F.bowThruster+F.rudderGain*flow)*(st.speed<-.05?-1:1);
  st.yawRate+=(target-st.yawRate)*Math.min(1,dt*F.yawResponse);
  // Heel outward in a turn; bow lifts at speed and squats under acceleration.
  const accel=(st.speed-before)/Math.max(dt,1e-4);
  st.heel+=(clamp(-st.yawRate*st.speed*F.heelGain,-F.maxHeel,F.maxHeel)-st.heel)*Math.min(1,dt*2);
  st.trim+=(clamp(-st.speed*F.trimGain+accel*F.squatGain,-.06,.06)-st.trim)*Math.min(1,dt*2);
  return st;
}
