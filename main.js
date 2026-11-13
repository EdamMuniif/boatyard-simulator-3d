import * as THREE from 'three';
import {createWorld} from './world.js';
import {createHoist,createFerry,createPlayer,animatePlayer,createWaypoint,createLocationMarker} from './geometry.js';
import {createCharacterMotion,resetCharacterMotion,stepCharacterMotion} from './character-motion.js';
import {PHASES,WAYPOINTS,MISSION,ECONOMY,distance2D,canBerthFerry,canAttachSling,canDock,checkpointForPhase,settleContract,isImpact} from './rules.js';
import {canWalkAt,canFerryAt,canHoistAt,sweepVehicle,WORKSHOPS,HARDSTAND_VESSELS,MOORED_VESSELS,vesselFootprint} from './collision.js';
import {proposeHoistMotion,wheelSteeringTarget} from './hoist-steering.js';
import {bindTouchControls} from './touch-controls.js';
import {createNpcSystem} from './npc-system.js';

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
    this.renderer.domElement.tabIndex=0;
    this.renderer.domElement.setAttribute('aria-label','3D game view. Use WASD to move and E to interact.');
    this.renderer.domElement.addEventListener('webglcontextlost',e=>{
      e.preventDefault();this.paused=true;this.keys={};
      showFatal('3D graphics context lost. Reload the game to recover.');
    });
    this.camera=new THREE.PerspectiveCamera(60,window.innerWidth/window.innerHeight,.2,800);
    this.walkViewDirection=new THREE.Vector3(0,0,1);
    this.world=createWorld();
    this.scene=this.world.scene;
    this.avatar=createPlayer();this.avatar.position.set(-18,0,37);this.scene.add(this.avatar);
    this.character=createCharacterMotion(this.avatar.position);
    this.ferry=createFerry();this.ferry.root.position.set(0,0,-49);this.scene.add(this.ferry.root);
    this.hoist=createHoist();this.hoist.root.position.set(0,0,63);this.scene.add(this.hoist.root);
    this.npcWorkers=createNpcSystem(this.scene,{
      lowPower:window.matchMedia?.('(pointer: coarse)').matches??false
    });
    this.camera.position.set(-25,13,15);
    this.phase=0;this.mode='walk';this.started=false;this.paused=false;this.cameraMode=0;
    this.ferrySpeed=0;this.ferryHeading=0;this.hoistSpeed=0;this.hoistHeading=0;
    this.lastHoistSpeed=0;
    this.liftHeight=0;this.attached=false;
    this.funds=ECONOMY.startingFunds;this.contacts=0;this.inContact=false;
    // Location E rides on the travel lift above its top beam.
    this.hoistMarker=createLocationMarker('E','TRAVEL LIFT HOIST');
    this.hoistMarker.position.set(0,25,0);this.hoist.root.add(this.hoistMarker);
    this.locations=[...this.world.locations,{letter:'E',label:'TRAVEL LIFT HOIST',marker:this.hoistMarker,follow:this.hoist.root}];
    this.buildChecklist();
    this.keys={};this.touch={x:0,y:0,raise:false,lower:false,brake:false,turnLeft:false,turnRight:false};
    this.orbitYaw=.0;this.orbitPitch=0;this.frameTime=performance.now();this.uiTime=0;this.toastDeadline=0;
    this.prevTarget=new THREE.Vector3();
    this.createInput();this.bindButtons();this.initResponsiveUI();this.updateWaypoint();this.updateUI();
    window.addEventListener('resize',()=>this.onResize());
    this.animate=this.animate.bind(this);requestAnimationFrame(this.animate);
  }
  get phaseId(){return PHASES[this.phase].id;}
  buildChecklist(){
    const list=$('missionChecklist');list.textContent='';
    this.checklistItems=PHASES.filter(p=>p.id!=='COMPLETE').map(p=>{
      const li=document.createElement('li');li.textContent=p.name;list.appendChild(li);return li;
    });
  }
  // Count one contact per collision event, and only when it is a real impact.
  registerContact(speed,threshold,message){
    if(!this.inContact&&isImpact(speed,threshold)){
      this.contacts++;
      this.notify(`${message} // -$${ECONOMY.contactPenalty.toLocaleString('en-US')} DAMAGE`,1800);
    }else this.notifyLimited(message);
    this.inContact=true;
  }
  setPhase(id){
    const index=PHASES.findIndex(p=>p.id===id);
    if(index<0)throw new Error(`Unknown mission stage ${id}`);
    this.phase=index;
    // Do not carry a pressed throttle / stick / lift key into the next vehicle.
    if(this.touchBindings)this.clearTransientInput();
    this.updateWaypoint();this.updateUI();
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
  start(){
    this.started=true;this.paused=false;
    $('startScreen').classList.add('hidden');
    this.clearTransientInput();
    this.updateUI(); // Unlock touch buttons immediately, not after a delayed HUD tick.
    this.renderer.domElement.focus({preventScroll:true});
    this.notify('MISSION 01 // Ferry dry-docking contract started.',2700);
  }
  togglePause(){
    if(!this.started||this.phaseId==='COMPLETE')return;
    this.paused=!this.paused;
    if(this.paused)this.clearTransientInput();
    $('pauseScreen').classList.toggle('hidden',!this.paused);
    document.body.classList.toggle('paused',this.paused);
    this.updateUI();
    if(!this.paused)this.renderer.domElement.focus({preventScroll:true});
  }
  clearTransientInput(){
    this.keys={};
    if(this.touchBindings)this.touchBindings.releaseAll();
    else {
      Object.assign(this.touch,{x:0,y:0,raise:false,lower:false,brake:false,turnLeft:false,turnRight:false});
      $('joystickThumb').style.transform='translate(0,0)';
    }
  }
  initResponsiveUI(){
    this.helpOpen=false;
    this.wasPausedBeforeHelp=false;
    this.missionDetailsUserSet=false;
    this.mapUserSet=false;
    this.compactScreen=window.matchMedia('(max-width: 700px), (max-height: 510px)');
    const onLayoutChange=()=>{
      if(!this.missionDetailsUserSet)this.setMissionDetails(!this.compactScreen.matches);
      if(!this.mapUserSet)this.setMapExpanded(!this.compactScreen.matches);
    };
    onLayoutChange();
    if(this.compactScreen.addEventListener)this.compactScreen.addEventListener('change',onLayoutChange);
    else if(this.compactScreen.addListener)this.compactScreen.addListener(onLayoutChange);
  }
  setMissionDetails(open){
    $('missionPanel').classList.toggle('is-compact',!open);
    const b=$('missionDetailsToggle');
    b.textContent=open?'LESS':'MORE';
    b.setAttribute('aria-expanded',String(open));
    b.setAttribute('aria-label',open?'Hide mission instructions':'Show mission instructions');
  }
  setMapExpanded(open){
    $('minimap').closest('.map-wrap').classList.toggle('is-collapsed',!open);
    const b=$('mapToggle');
    b.textContent=open?'− MAP':'+ MAP';
    b.setAttribute('aria-expanded',String(open));
    b.setAttribute('aria-label',open?'Collapse minimap':'Expand minimap');
  }
  openHelp(trigger=$('hudHelp')){
    if(this.helpOpen)return;
    this.helpTrigger=trigger;
    this.helpOpen=true;
    this.wasPausedBeforeHelp=this.paused;
    this.paused=true;
    this.clearTransientInput();
    $('pauseScreen').classList.add('hidden');
    $('helpScreen').classList.remove('hidden');
    document.body.classList.add('paused');
    $('closeHelp').focus();
    this.updateUI();
  }
  closeHelp(){
    if(!this.helpOpen)return;
    this.helpOpen=false;
    this.paused=this.wasPausedBeforeHelp;
    $('helpScreen').classList.add('hidden');
    $('pauseScreen').classList.toggle('hidden',!this.paused);
    document.body.classList.toggle('paused',this.paused);
    if(this.started&&!this.paused)this.renderer.domElement.focus({preventScroll:true});
    else if(this.helpTrigger?.isConnected)this.helpTrigger.focus();
    this.updateUI();
  }
  createInput(){
    window.addEventListener('keydown',e=>{
      // Preserve keyboard activation of actual buttons, especially Space.
      const uiButton=e.target?.closest?.('button,input,textarea,select,[contenteditable="true"]');
      if(uiButton&&(e.code==='Space'||e.code==='Enter'))return;
      if(this.started&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code))e.preventDefault();
      if(this.helpOpen){
        if(e.code==='Escape'||e.code==='KeyH')this.closeHelp();
        return;
      }
      if(e.code==='KeyH'&&!e.repeat){this.openHelp();return;}
      this.keys[e.code]=true;
      if(e.repeat)return;
      if(e.code==='KeyP'||e.code==='Escape'){this.togglePause();return;}
      if(e.code==='KeyT'){this.recoverCheckpoint();return;}
      if(!this.started||this.paused)return;
      if(e.code==='KeyE')this.action();
      if(e.code==='KeyC')this.switchCamera();
    });
    window.addEventListener('keyup',e=>{this.keys[e.code]=false;});
    window.addEventListener('blur',()=>this.clearTransientInput());
    window.addEventListener('pagehide',()=>this.clearTransientInput());
    document.addEventListener('visibilitychange',()=>{if(document.hidden)this.clearTransientInput();});
    let dragging=false,lastX=0,lastY=0;
    this.renderer.domElement.addEventListener('pointerdown',e=>{
      if(this.paused||!this.started||e.pointerType==='mouse'&&e.button!==0)return;
      dragging=true;lastX=e.clientX;lastY=e.clientY;
      try{this.renderer.domElement.setPointerCapture?.(e.pointerId);}catch{ /* fallback release below */ }
    });
    this.renderer.domElement.addEventListener('pointermove',e=>{
      if(!dragging)return;
      this.orbitYaw-= (e.clientX-lastX)*.005;
      this.orbitPitch=clamp(this.orbitPitch+(e.clientY-lastY)*.004,-.55,.9);
      lastX=e.clientX;lastY=e.clientY;
    });
    this.renderer.domElement.addEventListener('pointerup',()=>dragging=false);
    this.renderer.domElement.addEventListener('pointercancel',()=>dragging=false);
    this.renderer.domElement.addEventListener('lostpointercapture',()=>dragging=false);
    window.addEventListener('pointerup',()=>dragging=false);
    window.addEventListener('pointercancel',()=>dragging=false);
    this.renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();this.cameraDistance=clamp((this.cameraDistance||1)+Math.sign(e.deltaY)*.08,.6,1.6);},{passive:false});
    this.touchBindings=bindTouchControls({
      joystick:$('joystick'),thumb:$('joystickThumb'),touch:this.touch,root:window,
      enabled:()=>this.started&&!this.paused&&this.phaseId!=='COMPLETE',
      buttons:[
        [$('touchRaise'),'raise'],[$('touchLower'),'lower'],[$('touchBrake'),'brake'],
        [$('touchTurnLeft'),'turnLeft'],[$('touchTurnRight'),'turnRight']
      ]
    });
  }
  bindButtons(){
    $('startButton').addEventListener('click',()=>this.start());
    $('resumeButton').addEventListener('click',()=>this.togglePause());
    $('restartButton').addEventListener('click',()=>window.location.reload());
    $('restartFromPause').addEventListener('click',()=>window.location.reload());
    $('touchAction').addEventListener('click',()=>this.action());
    $('touchCamera').addEventListener('click',()=>this.switchCamera());
    $('hudPause').addEventListener('click',()=>this.togglePause());
    for(const id of ['hudHelp','helpFromStart','helpFromPause']){
      $(id).addEventListener('click',event=>this.openHelp(event.currentTarget));
    }
    $('closeHelp').addEventListener('click',()=>this.closeHelp());
    $('missionDetailsToggle').addEventListener('click',()=>{
      this.missionDetailsUserSet=true;
      this.setMissionDetails($('missionPanel').classList.contains('is-compact'));
    });
    $('mapToggle').addEventListener('click',()=>{
      this.mapUserSet=true;
      this.setMapExpanded($('minimap').closest('.map-wrap').classList.contains('is-collapsed'));
    });
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
    this.clearTransientInput();
    this.cameraMode=0;this.orbitYaw=0;this.orbitPitch=0;
    this.paused=false;$('pauseScreen').classList.add('hidden');
    document.body.classList.remove('paused');
    this.renderer.domElement.focus({preventScroll:true});
    this.updateWaypoint();this.updateUI();
    this.notify('CHECKPOINT RESTORED // Current mission stage restarted.',2600);
  }
  switchCamera(){if(!this.started||this.paused)return;this.cameraMode=(this.cameraMode+1)%3;this.notify(['CHASE CAMERA','TACTICAL OVERHEAD CAMERA','SIDE INSPECTION CAMERA'][this.cameraMode],1200);}
  axes(){
    const hor=(this.keys.KeyD||this.keys.ArrowRight?1:0)-(this.keys.KeyA||this.keys.ArrowLeft?1:0)+this.touch.x;
    const ver=(this.keys.KeyW||this.keys.ArrowUp?1:0)-(this.keys.KeyS||this.keys.ArrowDown?1:0)-this.touch.y;
    return {hor:clamp(hor,-1,1),ver:clamp(ver,-1,1)};
  }
  advanceWalk(dt){
    const {hor,ver}=this.axes();
    const touchMagnitude=Math.hypot(this.touch.x,this.touch.y);
    const keyboardSprinting=!!(this.keys.ShiftLeft||this.keys.ShiftRight);
    // Read actual camera forward direction, including orbit and interpolation.
    this.camera.getWorldDirection(this.walkViewDirection);
    const cameraYaw=Math.atan2(this.walkViewDirection.x,this.walkViewDirection.z);
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
      this.inContact=false;
    }else{
      const impactSpeed=this.ferrySpeed;
      this.ferryHeading=oldHeading;this.ferrySpeed=0;
      this.registerContact(impactSpeed,ECONOMY.ferryImpactSpeed,'SHORE CONTACT');
    }
    // Gentle water motion, game stylization only.
    this.ferry.root.position.y=.07+Math.sin(performance.now()*.0013)*.045;
  }
  notifyLimited(message){if(performance.now()>this.toastDeadline)this.notify(message,1600);}
  advanceHoist(dt){
    const {hor,ver}=this.axes();const stage=this.phaseId;
    const drivingAllowed=stage==='POSITION'||stage==='HAUL';
    const throttle=drivingAllowed?ver:0;
    // Dedicated press-and-hold buttons offer precise turning on mobile.
    // A/D or joystick X also turn the hoist, even when stationary.
    const extraTurn=(this.touch.turnRight?1:0)-(this.touch.turnLeft?1:0);
    const steering=drivingAllowed?clamp(hor+extraTurn,-1,1):0;
    // When turning without throttle, settle residual momentum so pivot controls
    // become responsive rather than waiting several seconds for slow coasting.
    const turning=Math.abs(steering)>.12&&Math.abs(throttle)<.12;
    const drag=drivingAllowed?(turning?4.5:1.25):7.0;
    this.hoistSpeed=clamp(this.hoistSpeed+throttle*4.5*dt-this.hoistSpeed*drag*dt,-4.25,5.25);
    if(this.keys.Space||this.touch.brake)this.hoistSpeed=damp(this.hoistSpeed,0,8,dt);
    if(Math.abs(this.hoistSpeed)<.045&&Math.abs(throttle)<.12)this.hoistSpeed=0;
    const p=this.hoist.root.position;
    const oldHeading=this.hoistHeading;
    const proposed=proposeHoistMotion({
      x:p.x,z:p.z,heading:oldHeading,speed:this.hoistSpeed
    },{steer:steering,throttle,brake:!!(this.keys.Space||this.touch.brake)},dt);
    if(sweepVehicle(p,proposed,oldHeading,proposed.heading,canHoistAt)){
      p.x=proposed.x;p.z=proposed.z;this.hoistHeading=proposed.heading;
      if(proposed.pivot)this.hoistSpeed=0;
      this.inContact=false;
    }else{
      // Pivoting into a limit is a blocked turn, not a collision.
      const impactSpeed=proposed.pivot?0:this.hoistSpeed;
      this.hoistSpeed=0;
      this.registerContact(impactSpeed,ECONOMY.hoistImpactSpeed,'YARD LIMIT');
    }
    const appliedHeading=this.hoistHeading-oldHeading;
    this.hoist.root.rotation.y=this.hoistHeading;
    for(const wheel of this.hoist.wheels){
      const target=wheelSteeringTarget(wheel.position.x,wheel.position.z,steering,proposed.pivot);
      wheel.rotation.y=damp(wheel.rotation.y,target,6.0,dt);
      const pivotTravel=appliedHeading*Math.hypot(wheel.position.x,wheel.position.z);
      wheel.userData.roll.rotation.x+=(proposed.pivot?pivotTravel:this.hoistSpeed*dt)/2.08;
    }
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
      this.setPhase('COMPLETE');
      const result=settleContract(this.contacts);
      this.funds+=result.net;
      const money=n=>`$${Math.abs(n).toLocaleString('en-US')}`;
      $('payoutAmount').textContent=`+${money(result.payout)}`;
      $('contactCount').textContent=`x${result.contacts}`;
      $('penaltyAmount').textContent=`-${money(result.penalties)}`;
      $('balanceAmount').textContent=money(this.funds);
      $('completeScreen').classList.remove('hidden');
      this.updateUI();
    }
  }
  update(dt){
    this.world.water.material.uniforms.uTime.value+=dt;
    this.world.sky.material.uniforms.uTime.value+=dt;
    this.world.sky.position.copy(this.camera.position);
    // The ocean shader works in world space, so the plane can simply follow the camera.
    this.world.water.position.x=this.camera.position.x;this.world.water.position.z=this.camera.position.z;
    const t=performance.now()*.001;
    this.world.waypoint.pointer.rotation.y+=dt*.7;
    this.world.waypoint.pointer.position.y=4.6+Math.sin(t*2)*.3;
    this.world.waypoint.ring.scale.setScalar(1+Math.sin(t*2.5)*.06);
    if(this.started&&!this.paused&&this.phaseId!=='COMPLETE'){
      if(this.mode==='walk')this.advanceWalk(dt);
      else if(this.mode==='ferry')this.advanceFerry(dt);
      else if(this.mode==='hoist')this.advanceHoist(dt);
      this.npcWorkers.update(dt,{
        player:this.mode==='walk'?this.avatar.position:null,
        hoist:this.hoist.root
      });
    }
    this.updateCamera(dt);
    this.updateLocationMarkers();
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
      // Portrait phones see far less to the sides, so pull the chase camera back.
      const portrait=this.camera.aspect<.8?(this.mode==='walk'?1.2:1.55):1;
      base.multiplyScalar(dist*portrait);base.y+=this.orbitPitch*15;offset=base.applyAxisAngle(tmpY,heading+this.orbitYaw);
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
    $('instrumentFoot').textContent=this.mode==='walk'?'WASD WALK · SHIFT RUN · SPACE JUMP':this.mode==='ferry'?'WASD PILOT · SPACE BRAKE':'A/D TURN · W/S DRIVE';
    const brake=$('touchBrake');
    brake.firstChild.textContent=this.mode==='walk'?'↑':'■';
    brake.querySelector('span').textContent=this.mode==='walk'?'JUMP':'BRAKE';
    $('waypointName').textContent=phase.name;
    $('money').textContent=`$${this.funds.toLocaleString('en-US')}`;
    $('workers').textContent=String(this.npcWorkers.actors.length);
    $('materials').textContent=`${ECONOMY.materialsPercent}%`;
    this.checklistItems.forEach((li,i)=>{
      li.classList.toggle('done',i<this.phase);
      li.classList.toggle('current',i===this.phase);
    });
    $('mapZoom').textContent=`${this.radarRange()} m`;
    const action=$('touchAction');
    const touchLabels={DISPATCH:'BOARD',SAIL:'SECURE',BOARD_HOIST:'ENTER',POSITION:'ATTACH'};
    const canAct=Object.prototype.hasOwnProperty.call(touchLabels,this.phaseId);
    action.style.display=canAct?'block':'none';
    action.disabled=!this.started||this.paused;
    action.querySelector('span').textContent=touchLabels[this.phaseId]||'ACTION';
    action.setAttribute('aria-label',touchLabels[this.phaseId]||'Mission interaction');
    $('touchRaise').disabled=this.phaseId!=='LIFT'||this.paused||!this.started;
    $('touchLower').disabled=this.phaseId!=='LOWER'||this.paused||!this.started;
    $('touchCamera').disabled=!this.started||this.paused;
    const pause=$('hudPause');
    pause.disabled=!this.started||this.phaseId==='COMPLETE'||this.helpOpen;
    pause.textContent=this.paused?'▶ RESUME':'Ⅱ PAUSE';
    pause.setAttribute('aria-label',this.paused?'Resume game':'Pause game');
    $('recoverButton').disabled=!this.started||this.phaseId==='COMPLETE'||this.paused;
    $('hoistTurnControls').classList.toggle('is-visible',this.started&&this.mode==='hoist'&&!this.paused&&['POSITION','HAUL'].includes(this.phaseId));
  }
  updateLocationMarkers(){
    const cam=this.camera.position,overhead=this.cameraMode===1;
    this.tmpMarker??=new THREE.Vector3();
    for(const loc of this.locations){
      const w=loc.marker.getWorldPosition(this.tmpMarker);
      const d=Math.hypot(w.x-cam.x,w.z-cam.z);
      // Fade out when the camera is right on top of a marker so it never blocks the view.
      loc.marker.material.opacity=overhead?.9:clamp((d-14)/16,0,1);
      // Grow with distance so far-off markers stay readable without swamping close views.
      const size=clamp(d*.11,9,24);loc.marker.scale.set(size,size/2,1);
      loc.marker.visible=loc.marker.material.opacity>.02;
    }
  }
  radarRange(){return this.mode==='walk'?80:150;}
  drawMap(){
    // Circular radar, rotated so the camera's view direction points up.
    const cvs=$('minimap'),ctx=cvs.getContext('2d');const W=cvs.width,H=cvs.height,cx=W/2,cy=H/2,R=W/2-4;
    const pos=this.mode==='walk'?this.avatar.position:this.mode==='ferry'?this.ferry.root.position:this.hoist.root.position;
    this.camera.getWorldDirection(this.walkViewDirection);
    const yaw=Math.atan2(this.walkViewDirection.x,this.walkViewDirection.z),sy=Math.sin(yaw),cyw=Math.cos(yaw);
    const scale=R/this.radarRange();
    // Camera right is world (-cos yaw, sin yaw); forward is (sin yaw, cos yaw).
    const toRadar=(x,z)=>{const dx=x-pos.x,dz=z-pos.z;return [cx+(-dx*cyw+dz*sy)*scale,cy-(dx*sy+dz*cyw)*scale];};
    const rect=r=>{
      const pts=[[r.x-r.w/2,r.z-r.d/2],[r.x+r.w/2,r.z-r.d/2],[r.x+r.w/2,r.z+r.d/2],[r.x-r.w/2,r.z+r.d/2]].map(([x,z])=>toRadar(x,z));
      ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<4;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.closePath();
    };
    ctx.clearRect(0,0,W,H);ctx.save();
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.clip();
    const sea=ctx.createRadialGradient(cx,cy,10,cx,cy,R);sea.addColorStop(0,'#0f5d6b');sea.addColorStop(1,'#08313f');
    ctx.fillStyle=sea;ctx.fillRect(0,0,W,H);
    ctx.fillStyle='#8a8f86';
    for(const r of [{x:0,z:104.5,w:150,d:145},{x:-42.5,z:10.5,w:65,d:43},{x:42.5,z:10.5,w:65,d:43}]){rect(r);ctx.fill();}
    ctx.fillStyle='#4a5c62';for(const r of WORKSHOPS){rect(r);ctx.fill();}
    ctx.fillStyle='#c7c2b4';for(const v of [...HARDSTAND_VESSELS,...MOORED_VESSELS]){rect(vesselFootprint(v));ctx.fill();}
    ctx.strokeStyle='#e7c27d';ctx.lineWidth=2;rect({x:MISSION.dock.x,z:MISSION.dock.z,w:24,d:24});ctx.stroke();
    // Rotating sweep, as on a marine radar.
    if(ctx.createConicGradient){
      const g=ctx.createConicGradient((performance.now()*.0012)%(Math.PI*2),cx,cy);
      g.addColorStop(0,'rgba(120,255,170,.30)');g.addColorStop(.12,'rgba(120,255,170,0)');g.addColorStop(1,'rgba(120,255,170,0)');
      ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
    }
    ctx.strokeStyle='rgba(150,255,190,.18)';ctx.lineWidth=1;
    for(const f of [.33,.66]){ctx.beginPath();ctx.arc(cx,cy,R*f,0,Math.PI*2);ctx.stroke();}
    ctx.restore();
    // Clamp off-range blips to the rim so the player always knows the direction.
    const edge=(x,z,inset)=>{
      let [px,py]=toRadar(x,z);const dx=px-cx,dy=py-cy,d=Math.hypot(dx,dy),max=R-inset;
      if(d>max){px=cx+dx/d*max;py=cy+dy/d*max;}
      return [px,py,d>max];
    };
    for(const a of this.npcWorkers.actors){
      const [px,py,out]=edge(a.motion.x,a.motion.z,4);if(out)continue;
      ctx.beginPath();ctx.arc(px,py,2.4,0,Math.PI*2);ctx.fillStyle='#7fe3f0';ctx.fill();
    }
    const blip=(p,color,size)=>{
      const [px,py]=edge(p.x,p.z,size+2);
      ctx.fillStyle=color;ctx.strokeStyle='#061827';ctx.lineWidth=1.5;
      ctx.fillRect(px-size,py-size,size*2,size*2);ctx.strokeRect(px-size,py-size,size*2,size*2);
    };
    if(this.mode!=='ferry')blip(this.ferry.root.position,'#f5f1e4',4);
    if(this.mode!=='hoist')blip(this.hoist.root.position,'#2f9be0',4.5);
    ctx.font='bold 11px Arial';ctx.textAlign='center';ctx.textBaseline='middle';
    for(const loc of this.locations){
      if(loc.follow&&this.mode==='hoist')continue;
      const lp=loc.follow?loc.follow.position:loc;
      const [px,py]=edge(lp.x,lp.z,9);
      ctx.beginPath();ctx.arc(px,py,8,0,Math.PI*2);ctx.fillStyle='rgba(8,24,34,.92)';ctx.fill();
      ctx.strokeStyle='#5fe0ee';ctx.lineWidth=1.6;ctx.stroke();ctx.fillStyle='#fff';ctx.fillText(loc.letter,px,py+.5);
    }
    if(this.phaseId!=='COMPLETE'){
      const t=this.target();const [tx,ty,out]=edge(t.x,t.z,8);
      ctx.save();ctx.translate(tx,ty);ctx.rotate(out?Math.atan2(ty-cy,tx-cx)+Math.PI/2:Math.PI/4);
      ctx.fillStyle='#ffc861';ctx.strokeStyle='#061827';ctx.lineWidth=1.6;ctx.beginPath();
      if(out){ctx.moveTo(0,-8);ctx.lineTo(6,5);ctx.lineTo(-6,5);}else ctx.rect(-5,-5,10,10);
      ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
    }
    // Player arrow: heading relative to the camera direction.
    const heading=this.mode==='walk'?this.avatar.rotation.y:this.mode==='ferry'?this.ferryHeading:this.hoistHeading;
    ctx.save();ctx.translate(cx,cy);ctx.rotate(yaw-heading);
    ctx.beginPath();ctx.moveTo(0,-9);ctx.lineTo(6.5,7);ctx.lineTo(0,3.5);ctx.lineTo(-6.5,7);ctx.closePath();
    ctx.fillStyle='#ffffff';ctx.fill();ctx.strokeStyle='#061827';ctx.lineWidth=1.6;ctx.stroke();ctx.restore();
    // North marker on the rim (world +z is north).
    const nx=cx+sy*(R-9),ny=cy-cyw*(R-9);
    ctx.beginPath();ctx.arc(nx,ny,8,0,Math.PI*2);ctx.fillStyle='#061827';ctx.fill();
    ctx.fillStyle='#ffd27a';ctx.fillText('N',nx,ny+.5);
    ctx.beginPath();ctx.arc(cx,cy,R,0,Math.PI*2);ctx.strokeStyle='rgba(205,240,250,.55)';ctx.lineWidth=2;ctx.stroke();
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
