import * as THREE from 'three';
import {createWorld} from './world.js';
import {createHoist,createFerry,createPlayer,animatePlayer,createWaypoint} from './geometry.js';
import {createCharacterMotion,resetCharacterMotion,stepCharacterMotion} from './character-motion.js';
import {PHASES,WAYPOINTS,MISSION,distance2D,canBerthFerry,canAttachSling,canDock,checkpointForPhase} from './rules.js';
import {canWalkAt,canFerryAt,canHoistAt,sweepVehicle} from './collision.js';

const $=id=>document.getElementById(id);
const clamp=THREE.MathUtils.clamp;
const damp=(v,target,speed,dt)=>THREE.MathUtils.damp(v,target,speed,dt);
const tmpY=new THREE.Vector3(0,1,0);
const gameEl=$('game');
let game;

class DockyardGame {
  constructor(){
    this.renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});
    this.maxPixelRatio=window.matchMedia?.('(pointer: coarse)').matches?1.3:1.65;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,this.maxPixelRatio));
    this.renderer.setSize(window.innerWidth,window.innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.38;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFShadowMap;
    gameEl.appendChild(this.renderer.domElement);
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{
      e.preventDefault();this.paused=true;this.keys={};
      showFatal('3D graphics context lost. Reload the game to recover.');
    });
    this.camera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,.2,800);
    this.world=createWorld();
    this.scene=this.world.scene;
    this.avatar=createPlayer();this.avatar.position.set(-18,0,37);this.scene.add(this.avatar);
    this.character=createCharacterMotion(this.avatar.position);
    this.ferry=createFerry();this.ferry.root.position.set(0,0,-49);this.scene.add(this.ferry.root);
    this.hoist=createHoist();this.hoist.root.position.set(0,0,63);this.scene.add(this.hoist.root);
    this.camera.position.set(-25,13,15);
    this.phase=0;this.mode='walk';this.started=false;this.paused=false;this.cameraMode=0;
    this.ferrySpeed=0;this.ferryHeading=0;this.hoistSpeed=0;this.hoistHeading=0;
    this.lastHoistSpeed=0;
    this.liftHeight=0;this.attached=false;
    this.keys={};this.touch={x:0,y:0,raise:false,lower:false,brake:false};
    this.orbitYaw=.0;this.orbitPitch=0;this.frameTime=performance.now();this.uiTime=0;this.toastDeadline=0;
    this.prevTarget=new THREE.Vector3();
    this.createInput();this.bindButtons();this.updateWaypoint();this.updateUI();
    window.addEventListener('resize',()=>this.onResize());
    this.animate=this.animate.bind(this);requestAnimationFrame(this.animate);
  }
  get phaseId(){return PHASES[this.phase].id;}
  setPhase(id){
    const index=PHASES.findIndex(p=>p.id===id);
    if(index<0)throw new Error(`Unknown mission stage ${id}`);
    this.phase=index;this.updateWaypoint();this.updateUI();
  }
  target(){
    if(this.phaseId==='BOARD_HOIST')return new THREE.Vector3(this.hoist.root.position.x-16,0,this.hoist.root.position.z);
    if(this.phaseId==='LIFT')return this.hoist.root.position.clone();
    const p=WAYPOINTS[this.phaseId];return new THREE.Vector3(p.x,0,p.z);
  }
  updateWaypoint(){
    if(this.world.waypoint){this.scene.remove(this.world.waypoint.group);}
    const name=PHASES[this.phase].name;
    const target=this.target();
    this.world.waypoint=createWaypoint(name);
    this.world.waypoint.group.position.copy(target);
    this.world.waypoint.group.visible=this.phaseId!=='COMPLETE';
    this.scene.add(this.world.waypoint.group);
  }
  notify(message,duration=2300){
    $('toast').textContent=message;$('toast').classList.add('active');
    this.toastDeadline=performance.now()+duration;
  }
  start(){this.started=true;this.paused=false;$('startScreen').classList.add('hidden');this.notify('MISSION 01 // Ferry dry-docking contract started.',2700);}
  togglePause(){
    if(!this.started||this.phaseId==='COMPLETE')return;
    this.paused=!this.paused;
    $('pauseScreen').classList.toggle('hidden',!this.paused);
    document.body.classList.toggle('paused',this.paused);
  }
  createInput(){
    window.addEventListener('keydown',e=>{
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
      this.keys[e.code]=true;
      if(e.repeat)return;
      if(e.code==='KeyP'||e.code==='Escape'){this.togglePause();return;}
      if(e.code==='KeyT'){this.recoverCheckpoint();return;}
      if(!this.started||this.paused)return;
      if(e.code==='KeyE')this.action();
      if(e.code==='KeyC')this.switchCamera();
    });
    window.addEventListener('keyup',e=>{this.keys[e.code]=false;});
    window.addEventListener('blur',()=>{this.keys={};this.touch.raise=false;this.touch.lower=false;this.touch.brake=false;});
    let dragging=false,lastX=0,lastY=0;
    this.renderer.domElement.addEventListener('pointerdown',e=>{dragging=true;lastX=e.clientX;lastY=e.clientY;this.renderer.domElement.setPointerCapture(e.pointerId);});
    this.renderer.domElement.addEventListener('pointermove',e=>{
      if(!dragging)return;
      this.orbitYaw-= (e.clientX-lastX)*.005;
      this.orbitPitch=clamp(this.orbitPitch+(e.clientY-lastY)*.004,-.55,.9);
      lastX=e.clientX;lastY=e.clientY;
    });
    this.renderer.domElement.addEventListener('pointerup',()=>dragging=false);
    this.renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
    this.renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();this.cameraDistance=clamp((this.cameraDistance||1)+Math.sign(e.deltaY)*.08,.6,1.6);},{passive:false});
    const joystick=$('joystick'),thumb=$('joystickThumb');let jid=null;
    const move=e=>{
      if(jid!==e.pointerId)return;
      const rect=joystick.querySelector('.joystick-base').getBoundingClientRect();
      const cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
      const nx=clamp((e.clientX-cx)/(rect.width*.35),-1,1);
      const ny=clamp((e.clientY-cy)/(rect.height*.35),-1,1);
      const mag=Math.max(1,Math.hypot(nx,ny));this.touch.x=nx/mag;this.touch.y=ny/mag;
      thumb.style.transform=`translate(${this.touch.x*30}px,${this.touch.y*30}px)`;
    };
    joystick.addEventListener('pointerdown',e=>{e.preventDefault();jid=e.pointerId;joystick.setPointerCapture(jid);move(e);});
    joystick.addEventListener('pointermove',move);
    const release=e=>{if(jid!==e.pointerId)return;jid=null;this.touch.x=0;this.touch.y=0;thumb.style.transform='translate(0,0)';};
    joystick.addEventListener('pointerup',release);joystick.addEventListener('pointercancel',release);
    const hold=(id,key)=>{const b=$(id);b.addEventListener('pointerdown',e=>{e.preventDefault();b.setPointerCapture(e.pointerId);this.touch[key]=true;});for(const name of ['pointerup','pointercancel','lostpointercapture'])b.addEventListener(name,()=>this.touch[key]=false);};
    hold('touchRaise','raise');hold('touchLower','lower');hold('touchBrake','brake');
  }
  bindButtons(){
    $('startButton').addEventListener('click',()=>this.start());
    $('resumeButton').addEventListener('click',()=>this.togglePause());
    $('restartButton').addEventListener('click',()=>window.location.reload());
    $('restartFromPause').addEventListener('click',()=>window.location.reload());
    $('touchAction').addEventListener('click',()=>this.action());
    $('touchCamera').addEventListener('click',()=>this.switchCamera());
    $('recoverButton').addEventListener('click',()=>this.recoverCheckpoint());
    $('recoverFromPause').addEventListener('click',()=>this.recoverCheckpoint());
  }
  action(){
    if(!this.started||this.paused)return;
    const stage=this.phaseId;
    if(stage==='DISPATCH'){
      if(distance2D(this.avatar.position,this.target())<4.5){
        this.mode='ferry';this.setPhase('SAIL');this.notify('VESSEL CONTROL ONLINE // Bring the ferry into the basin.');
      }else this.notify('Approach the glowing HARBOR DISPATCH marker.');
    }else if(stage==='SAIL'){
      if(canBerthFerry(this.ferry.root.position,this.ferrySpeed)){
        this.ferrySpeed=0;this.mode='walk';this.avatar.position.set(-16.5,0,52);
        resetCharacterMotion(this.character,this.avatar.position,this.avatar.rotation.y);
        animatePlayer(this.avatar,this.character);
        this.setPhase('BOARD_HOIST');this.notify('FERRY SECURED // Proceed to the travel lift.',2600);
      }else this.notify('Position the ferry inside the basin and bring it to a stop.');
    }else if(stage==='BOARD_HOIST'){
      if(distance2D(this.avatar.position,this.target())<5.5){
        this.mode='hoist';this.setPhase('POSITION');this.notify('TRAVEL LIFT ACTIVE // Reverse carefully toward the ferry.',2700);
      }else this.notify('Walk to the travel lift side control marker.');
    }else if(stage==='POSITION'){
      if(canAttachSling(this.hoist.root.position,this.hoistSpeed)){
        this.attached=true;this.hoistSpeed=0;this.ferry.root.position.x=this.hoist.root.position.x;
        this.ferry.root.position.z=this.hoist.root.position.z;
        this.ferry.root.rotation.y=0;
        this.hoist.setRigging(this.liftHeight,true);
        this.setPhase('LIFT');this.notify('SIMULATED SLINGS ATTACHED // Hold R to raise.',3200);
      }else this.notify('Align the hoist with the ferry, then stop before attaching.');
    }else if(stage==='HAUL'&&canDock(this.hoist.root.position,this.hoistSpeed,this.liftHeight)){
      this.hoistSpeed=0;this.setPhase('LOWER');this.notify('BAY 03 ALIGNED // Hold F to place the vessel.',2900);
    }else if(stage==='HAUL')this.notify('Drive to Bay 03 and stop inside the docking marker.');
    else if(stage==='COMPLETE')window.location.reload();
  }
  recoverCheckpoint(){
    if(!this.started||this.phaseId==='COMPLETE')return;
    const state=checkpointForPhase(this.phaseId);
    if(!state)return;
    this.mode=state.mode;
    this.avatar.position.set(state.avatar.x,state.avatar.y,state.avatar.z);
    resetCharacterMotion(this.character,this.avatar.position,0);
    this.avatar.rotation.y=this.character.heading;
    animatePlayer(this.avatar,this.character);
    this.ferry.root.position.set(state.ferry.x,state.ferry.y,state.ferry.z);
    this.hoist.root.position.set(state.hoist.x,state.hoist.y,state.hoist.z);
    this.ferryHeading=state.ferryHeading;this.hoistHeading=state.hoistHeading;
    this.ferry.root.rotation.y=state.ferryHeading;
    this.hoist.root.rotation.y=state.hoistHeading;
    this.ferrySpeed=0;this.hoistSpeed=0;this.lastHoistSpeed=0;
    if(this.ferry.visual)this.ferry.visual.rotation.set(0,0,0);
    this.liftHeight=state.liftHeight;this.attached=state.attached;
    this.hoist.setRigging(this.liftHeight,this.attached);
    this.keys={};this.touch={x:0,y:0,raise:false,lower:false,brake:false};
    $('joystickThumb').style.transform='translate(0,0)';
    this.cameraMode=0;this.orbitYaw=0;this.orbitPitch=0;
    this.paused=false;$('pauseScreen').classList.add('hidden');
    document.body.classList.remove('paused');
    this.updateWaypoint();this.updateUI();
    this.notify('CHECKPOINT RESTORED // Current mission stage restarted.',2600);
  }
  switchCamera(){if(!this.started)return;this.cameraMode=(this.cameraMode+1)%3;this.notify(['CHASE CAMERA','TACTICAL OVERHEAD CAMERA','SIDE INSPECTION CAMERA'][this.cameraMode],1200);}
  axes(){
    const hor=(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0)+this.touch.x;
    const ver=(this.keys.KeyW||this.keys.ArrowUp?1:0)-(this.keys.KeyS||this.keys.ArrowDown?1:0)-this.touch.y;
    return {hor:clamp(hor,-1,1),ver:clamp(ver,-1,1)};
  }
  advanceWalk(dt){
    const {hor,ver}=this.axes();
    const touchMagnitude=Math.hypot(this.touch.x,this.touch.y);
    const keyboardSprinting=!!(this.keys.ShiftLeft||this.keys.ShiftRight);
    const cameraYaw=this.cameraMode===1?Math.PI:
      this.cameraMode===2?Math.atan2(-21,-10)+this.orbitYaw:
      Math.atan2(7,11)+this.orbitYaw;
    stepCharacterMotion(this.character,{
      hor,ver,cameraYaw,
      sprint:keyboardSprinting||touchMagnitude>.92,
      jump:!!(this.keys.Space||this.touch.brake)
    },dt,canWalkAt);
    const p=this.character;
    this.avatar.position.set(p.x,p.y,p.z);
    this.avatar.rotation.y=p.heading;
    animatePlayer(this.avatar,p);
  }
  advanceFerry(dt){
    const {hor,ver}=this.axes();
    this.ferrySpeed=clamp(this.ferrySpeed+ver*3.7*dt-this.ferrySpeed*.66*dt,-2.75,6.25);
    if(this.keys.Space||this.touch.brake)this.ferrySpeed=damp(this.ferrySpeed,0,7.7,dt);
    this.ferryHeading+=hor*(.3+.12*Math.min(1,Math.abs(this.ferrySpeed)/3))*(this.ferrySpeed>=0?1:-1)*dt;
    this.ferryHeading=clamp(this.ferryHeading,-1.25,1.25);
    const p=this.ferry.root.position;const nx=p.x+Math.sin(this.ferryHeading)*this.ferrySpeed*dt;
    const nz=p.z+Math.cos(this.ferryHeading)*this.ferrySpeed*dt;
    const oldHeading=this.ferry.root.rotation.y;
    if(sweepVehicle(p,{x:nx,z:nz},oldHeading,this.ferryHeading,canFerryAt)){
      p.x=nx;p.z=nz;this.ferry.root.rotation.y=this.ferryHeading;
    }else{
      this.ferryHeading=oldHeading;this.ferrySpeed=0;
      this.notifyLimited('SHORE CONTACT // Reposition the ferry.');
    }
    // Gentle water motion, game stylization only.
    this.ferry.root.position.y=.07+Math.sin(performance.now()*.0013)*.045;
  }
  notifyLimited(message){if(performance.now()>this.toastDeadline)this.notify(message,1600);}
  advanceHoist(dt){
    const {hor,ver}=this.axes();const stage=this.phaseId;
    const drivingAllowed=stage==='POSITION'||stage==='HAUL';
    const throttle=drivingAllowed?ver:0;
    const drag=drivingAllowed?1.25:7.0;
    this.hoistSpeed=clamp(this.hoistSpeed+throttle*4.5*dt-this.hoistSpeed*drag*dt,-4.25,5.25);
    if(this.keys.Space||this.touch.brake)this.hoistSpeed=damp(this.hoistSpeed,0,8,dt);
    const p=this.hoist.root.position;
    const oldHeading=this.hoistHeading;
    const proposedHeading=oldHeading+(drivingAllowed?hor*this.hoistSpeed*.12*dt:0);
    const nx=p.x+Math.sin(proposedHeading)*this.hoistSpeed*dt;
    const nz=p.z+Math.cos(proposedHeading)*this.hoistSpeed*dt;
    if(sweepVehicle(p,{x:nx,z:nz},oldHeading,proposedHeading,canHoistAt)){
      p.x=nx;p.z=nz;this.hoistHeading=proposedHeading;
    }else{
      this.hoistSpeed=0;
      this.notifyLimited('YARD OBSTACLE // Reposition the travel lift.');
    }
    this.hoist.root.rotation.y=this.hoistHeading;
    this.hoist.wheels.forEach(w=>{w.rotation.x+=this.hoistSpeed*dt/2.08;});
    const raising=(this.keys.KeyR||this.touch.raise)&&stage==='LIFT';
    const lowering=(this.keys.KeyF||this.touch.lower)&&stage==='LOWER';
    if(raising) this.liftHeight=clamp(this.liftHeight+dt*1.2,0,MISSION.maxLift);
    if(lowering)this.liftHeight=clamp(this.liftHeight-dt*1.05,0,MISSION.maxLift);
    if(this.attached){
      this.ferry.root.position.set(p.x,.08+this.liftHeight,p.z);
      this.ferry.root.rotation.y=this.hoistHeading;
      this.hoist.setRigging(this.liftHeight,true);
    }
    // Child-only aesthetic sway: mission positions and collision remain exact.
    // The values are visual game effects, not a suspended-load dynamics model.
    if(this.ferry.visual){
      const acceleration=this.hoistSpeed-this.lastHoistSpeed;
      const roll=this.attached?clamp(-this.hoistSpeed*.004-hor*.015,-.035,.035):0;
      const pitch=this.attached?clamp(-acceleration*.045,-.035,.035):0;
      this.ferry.visual.rotation.z=damp(this.ferry.visual.rotation.z,roll,2.2,dt);
      this.ferry.visual.rotation.x=damp(this.ferry.visual.rotation.x,pitch,2.2,dt);
    }
    this.lastHoistSpeed=this.hoistSpeed;
    if(stage==='LIFT'&&this.liftHeight>=MISSION.liftRequired){
      this.setPhase('HAUL');this.notify('VESSEL CLEAR // Drive to Dry Dock Bay 03.',2900);
    }
    if(stage==='HAUL'&&canDock(p,this.hoistSpeed,this.liftHeight)){
      this.hoistSpeed=0;this.setPhase('LOWER');this.notify('DOCKING ZONE REACHED // Hold F to lower.',2900);
    }
    if(stage==='LOWER'&&this.liftHeight<=MISSION.dockPlacementHeight){
      this.liftHeight=MISSION.dockPlacementHeight;this.attached=false;
      this.ferry.root.position.set(MISSION.dock.x,MISSION.dockPlacementHeight,MISSION.dock.z);
      this.ferry.root.rotation.y=0;
      this.hoist.setRigging(0,false);
      this.setPhase('COMPLETE');$('score').textContent='01';
      $('completeScreen').classList.remove('hidden');
    }
  }
  update(dt){
    this.world.water.material.uniforms.uTime.value+=dt;
    const t=performance.now()*.001;
    this.world.waypoint.pointer.rotation.y+=dt*.7;
    this.world.waypoint.pointer.position.y=4.6+Math.sin(t*2)*.3;
    this.world.waypoint.ring.scale.setScalar(1+Math.sin(t*2.5)*.06);
    if(this.started&&!this.paused&&this.phaseId!=='COMPLETE'){
      if(this.mode==='walk')this.advanceWalk(dt);
      else if(this.mode==='ferry')this.advanceFerry(dt);
      else if(this.mode==='hoist')this.advanceHoist(dt);
    }
    this.updateCamera(dt);
    if(performance.now()>this.toastDeadline)$('toast').classList.remove('active');
    if(performance.now()-this.uiTime>90){this.updateUI();this.drawMap();this.uiTime=performance.now();}
  }
  updateCamera(dt){
    const focus=(this.mode==='walk'?this.avatar.position:this.mode==='ferry'?this.ferry.root.position:this.hoist.root.position).clone();
    // Pedestrian camera orientation is independent of body turning; this
    // prevents forward movement from feeding back into the camera heading.
    const heading=this.mode==='ferry'?this.ferryHeading:this.mode==='hoist'?this.hoistHeading:0;
    let look=focus.clone().add(new THREE.Vector3(0,this.mode==='hoist'?9:this.mode==='ferry'?2.2:1.4,0));
    let offset;
    if(this.cameraMode===1){
      offset=new THREE.Vector3(0,80,28);
      look=focus.clone();
    }
    else if(this.cameraMode===2){
      offset=new THREE.Vector3(this.mode==='hoist'?45:21,this.mode==='hoist'?22:9,10);
      offset.applyAxisAngle(tmpY,heading+this.orbitYaw);
    }
    else{
      const dist=this.cameraDistance||1;
      const base=this.mode==='hoist'?new THREE.Vector3(-17,25,-46):this.mode==='ferry'?new THREE.Vector3(-10,12.5,-23):new THREE.Vector3(-7,6.2,-11);
      base.multiplyScalar(dist);base.y+=this.orbitPitch*15;offset=base.applyAxisAngle(tmpY,heading+this.orbitYaw);
    }
    const desired=focus.add(offset);
    const alpha=1-Math.exp(-dt*3.9);
    this.camera.position.lerp(desired,alpha);
    this.prevTarget.lerp(look,alpha);
    this.camera.lookAt(this.prevTarget);
  }
  updateUI(){
    const phase=PHASES[this.phase];$('objective').textContent=phase.objective;
    $('hint').textContent=phase.hint;
    $('phaseCount').textContent=`${String(this.phase+1).padStart(2,'0')} / ${String(PHASES.length).padStart(2,'0')}`;
    $('missionMeter').style.width=`${this.phase/(PHASES.length-1)*100}%`;
    const pos=this.mode==='ferry'?this.ferry.root.position:this.mode==='hoist'?this.hoist.root.position:this.avatar.position;
    const d=distance2D(pos,this.target());
    $('distanceLabel').textContent=this.phaseId==='COMPLETE'?'SUCCESS':`${Math.round(d)} m TO TARGET`;
    $('modeLabel').textContent=this.mode==='walk'?'ON FOOT':this.mode==='ferry'?'FERRY':'TRAVEL LIFT';
    $('vehicleName').textContent=this.mode==='walk'?'PEDESTRIAN':this.mode==='ferry'?'FERRY RTL-STYLE':'200T TRAVEL LIFT';
    $('speed').textContent=(this.mode==='ferry'?Math.abs(this.ferrySpeed):this.mode==='hoist'?Math.abs(this.hoistSpeed):this.character.speed).toFixed(1);
    $('speedUnit').textContent='GAME m/s';
    $('liftReading').textContent=this.mode==='hoist'?`LIFT ${Math.round(this.liftHeight/MISSION.maxLift*100)}%`:'HOIST READY';
    $('instrumentFoot').textContent=this.mode==='walk'?'WASD WALK · SHIFT RUN · SPACE JUMP':this.mode==='ferry'?'WASD PILOT · SPACE BRAKE':'WASD DRIVE · R/F HOIST';
    const brake=$('touchBrake');
    brake.firstChild.textContent=this.mode==='walk'?'↑':'■';
    brake.querySelector('span').textContent=this.mode==='walk'?'JUMP':'BRAKE';
    $('waypointName').textContent=phase.name;
    const action=$('touchAction');
    action.style.display=['DISPATCH','SAIL','BOARD_HOIST','POSITION'].includes(this.phaseId)?'block':'none';
    $('touchRaise').style.opacity=this.phaseId==='LIFT'?'1':'.35';
    $('touchLower').style.opacity=this.phaseId==='LOWER'?'1':'.35';
    $('recoverButton').disabled=!this.started||this.phaseId==='COMPLETE';
  }
  drawMap(){
    const cvs=$('minimap'),ctx=cvs.getContext('2d');const W=cvs.width,H=cvs.height;
    const xm=x=>(x+77)/154*W,zm=z=>H-(z+68)/243*H;
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#0a4254';ctx.fillRect(0,0,W,H);
    ctx.strokeStyle='#285c6d';ctx.lineWidth=1;
    for(let i=0;i<10;i++){const x=i*25;ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke();ctx.beginPath();ctx.moveTo(0,x);ctx.lineTo(W,x);ctx.stroke();}
    ctx.fillStyle='#65716f';ctx.fillRect(xm(-75),zm(177),xm(75)-xm(-75),zm(32)-zm(177));
    ctx.fillRect(xm(-75),zm(32),xm(65)-xm(0),zm(-11)-zm(32));
    ctx.fillRect(xm(10),zm(32),xm(65)-xm(0),zm(-11)-zm(32));
    // Buildings and designated dry-dock bay.
    ctx.fillStyle='#344b54';
    for(const [x,z,w,d] of [[-49,101,29,39],[56,61,30,33],[-49,151,32,23],[54,151,33,27]]){
      ctx.fillRect(xm(x-w/2),zm(z+d/2),w/154*W,d/243*H);
    }
    ctx.strokeStyle='#d8bb7d';ctx.lineWidth=2;
    ctx.strokeRect(xm(20),zm(120),28/154*W,24/243*H);
    ctx.strokeStyle='#77b9cb';ctx.lineWidth=2;
    ctx.strokeRect(xm(-10),zm(32),20/154*W,43/243*H);
    function dot(p,color,r){ctx.beginPath();ctx.arc(clamp(xm(p.x),r,W-r),clamp(zm(p.z),r,H-r),r,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#061827';ctx.lineWidth=1.8;ctx.stroke();}
    dot(this.ferry.root.position,'#fff5dc',5);dot(this.hoist.root.position,'#288dc3',5);
    const pos=this.mode==='walk'?this.avatar.position:this.mode==='ferry'?this.ferry.root.position:this.hoist.root.position;
    const t=this.target();ctx.strokeStyle='#e3c380bd';ctx.lineWidth=1;ctx.setLineDash([4,3]);ctx.beginPath();ctx.moveTo(xm(pos.x),zm(pos.z));ctx.lineTo(xm(t.x),zm(t.z));ctx.stroke();ctx.setLineDash([]);
    dot(t,'#ffd084',5.3);dot(pos,'#ffffff',4.4);
    ctx.fillStyle='#ecfaff';ctx.font='bold 12px Arial';ctx.fillText('N',W-17,16);
  }
  onResize(){this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.maxPixelRatio));this.renderer.setSize(innerWidth,innerHeight);}
  animate(now){
    const dt=clamp((now-this.frameTime)/1000,0,.05);this.frameTime=now;
    try{this.update(dt);this.renderer.render(this.scene,this.camera);}
    catch(error){console.error(error);showFatal(`Game runtime error: ${error.message}`);return;}
    requestAnimationFrame(this.animate);
  }
}
function showFatal(message){
  const el=$('fatalError'),target=$('fatalMessage');
  if(el&&target){target.textContent=message;el.classList.remove('hidden');}
}
try{game=new DockyardGame();window.__boatyardGame=game;}
catch(error){console.error(error);showFatal(`3D rendering could not start: ${error.message}`);}
