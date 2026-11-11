// Kinematic arcade controller for a flat-yard character.
// Works in game-world units; existing canWalkAt() owns shoreline/obstacle bounds.
// No engine, third-party physics, or browser dependency: easy to unit-test.
export const CHARACTER_TUNING = Object.freeze({
  walkSpeed: 2.7,
  runSpeed: 5.2,
  acceleration: 11.0,
  braking: 15.0,
  airControl: 4.5,
  turnRate: 9.0,
  gravity: 19.0,
  jumpVelocity: 5.7,
  maxStep: 0.2
});

const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));

export function createCharacterMotion(position={x:0,y:0,z:0},heading=0){
  return {
    x:position.x||0,y:Math.max(0,position.y||0),z:position.z||0,
    vx:0,vy:0,vz:0,heading,
    grounded:!(position.y>0),jumpHeld:false,stridePhase:0,speed:0
  };
}

export function resetCharacterMotion(state,position,heading=0){
  Object.assign(state,createCharacterMotion(position,heading));
  return state;
}

// Camera heading is projected onto the X/Z plane: +Z is zero radians.
// hor and ver are normalized by the caller for analog+keyboard parity.
export function stepCharacterMotion(state,input,dt,canStand=()=>true){
  if(!Number.isFinite(dt)||dt<=0)return state;
  const h=clamp(Number(input.hor)||0,-1,1);
  const v=clamp(Number(input.ver)||0,-1,1);
  const rawLength=Math.hypot(h,v);
  const amount=Math.min(1,rawLength);
  const heading=Number.isFinite(input.cameraYaw)?input.cameraYaw:0;
  const moveX=rawLength>0?(h*Math.cos(heading)+v*Math.sin(heading))/rawLength:0;
  const moveZ=rawLength>0?(-h*Math.sin(heading)+v*Math.cos(heading))/rawLength:0;
  const maxSpeed=input.sprint?CHARACTER_TUNING.runSpeed:CHARACTER_TUNING.walkSpeed;
  const targetX=moveX*maxSpeed*amount;
  const targetZ=moveZ*maxSpeed*amount;
  const jump=!!input.jump;

  // Sub-stepping keeps turning and wall collision consistent across frame rates.
  const frame=Math.min(dt,.1);
  const steps=Math.max(1,Math.ceil(frame/.02));
  const tick=frame/steps;
  for(let i=0;i<steps;i++){
    const speedDelta=Math.hypot(targetX-state.vx,targetZ-state.vz);
    const rate=!state.grounded?CHARACTER_TUNING.airControl:
      amount>0.001?CHARACTER_TUNING.acceleration:CHARACTER_TUNING.braking;
    const maxDelta=rate*tick;
    if(speedDelta<=maxDelta){
      state.vx=targetX;state.vz=targetZ;
    }else if(speedDelta>0){
      state.vx+=(targetX-state.vx)*maxDelta/speedDelta;
      state.vz+=(targetZ-state.vz)*maxDelta/speedDelta;
    }

    if(rawLength>.01){
      const targetHeading=Math.atan2(moveX,moveZ);
      const turn=angleDelta(state.heading,targetHeading);
      state.heading+=clamp(turn,-CHARACTER_TUNING.turnRate*tick,CHARACTER_TUNING.turnRate*tick);
    }

    const dx=state.vx*tick,dz=state.vz*tick;
    const sweeps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/CHARACTER_TUNING.maxStep));
    const stepX=dx/sweeps,stepZ=dz/sweeps;
    let blockedX=false,blockedZ=false;
    for(let k=0;k<sweeps;k++){
      if(!blockedX&&canStand({x:state.x+stepX,z:state.z})){
        state.x+=stepX;
      }else blockedX=true;
      if(!blockedZ&&canStand({x:state.x,z:state.z+stepZ})){
        state.z+=stepZ;
      }else blockedZ=true;
    }
    if(blockedX)state.vx=0;
    if(blockedZ)state.vz=0;

    if(jump&&state.grounded&&!state.jumpHeld){
      state.vy=CHARACTER_TUNING.jumpVelocity;
      state.grounded=false;
    }
    if(!state.grounded){
      state.vy-=CHARACTER_TUNING.gravity*tick;
      state.y+=state.vy*tick;
      if(state.y<=0){state.y=0;state.vy=0;state.grounded=true;}
    }
    const speed=Math.hypot(state.vx,state.vz);
    state.speed=speed;
    if(state.grounded)state.stridePhase+=speed*tick*2.7;
  }
  state.jumpHeld=jump;
  return state;
}

export function characterPose(state){
  const amount=clamp(state.speed/CHARACTER_TUNING.runSpeed,0,1);
  const weight=clamp(state.speed/.65,0,1);
  const stride=Math.sin(state.stridePhase)*(.20+amount*.55)*weight;
  return {
    leftLeg:state.grounded?stride:-.32,
    rightLeg:state.grounded?-stride:.42,
    leftArm:state.grounded?-stride*.75:-.3,
    rightArm:state.grounded?stride*.75:-.3,
    bob:state.grounded?Math.abs(Math.sin(state.stridePhase*2))*.045*weight:0,
    lean:state.grounded?-.045*amount:-.08
  };
}
