// Stable touch input state for phone, tablet and pointer-enabled desktop browsers.
// Uses Pointer Events with a window-level fallback if pointer capture is unavailable.
export function joystickVector(clientX, clientY, rect, deadzone=.10) {
  const width=Math.max(1,rect.width||1);
  const height=Math.max(1,rect.height||1);
  const radius=Math.max(1,Math.min(width,height)*.40);
  const dx=(clientX-(rect.left+width/2))/radius;
  const dy=(clientY-(rect.top+height/2))/radius;
  const magnitude=Math.hypot(dx,dy);
  if(!Number.isFinite(magnitude)||magnitude<=deadzone)return {x:0,y:0};
  const strength=Math.min(1,(magnitude-deadzone)/(1-deadzone));
  return {x:dx/magnitude*strength,y:dy/magnitude*strength};
}

function tryCapture(element,pointerId){
  try{element.setPointerCapture?.(pointerId);}catch{
    // Safari embedded browsers and interrupted pointers may reject capture.
    // Global pointer listeners below provide a release/move fallback.
  }
}

export function bindTouchControls({
  joystick,thumb,buttons,touch,root,enabled=()=>true
}){
  const base=joystick.querySelector('.joystick-base');
  let activeStick=null;
  const held=new Map();

  const resetStick=()=>{
    activeStick=null;
    touch.x=0;touch.y=0;
    thumb.style.transform='translate(0,0)';
  };
  const releaseAll=()=>{
    resetStick();
    for(const [key,button] of held.values()){
      touch[key]=false;button.classList?.remove('is-held');button.setAttribute?.('aria-pressed','false');
    }
    held.clear();
    for(const [button,key] of buttons){
      touch[key]=false;button.classList?.remove('is-held');button.setAttribute?.('aria-pressed','false');
    }
  };
  const updateStick=e=>{
    if(activeStick!==e.pointerId)return;
    const value=joystickVector(e.clientX,e.clientY,base.getBoundingClientRect());
    touch.x=value.x;touch.y=value.y;
    const travel=Math.max(12,(base.getBoundingClientRect().width-thumb.getBoundingClientRect().width)/2);
    thumb.style.transform=`translate(${Math.round(value.x*travel)}px,${Math.round(value.y*travel)}px)`;
  };
  joystick.addEventListener('pointerdown',e=>{
    if(!enabled()||activeStick!==null)return;
    if(e.pointerType==='mouse'&&e.button!==0)return;
    e.preventDefault();
    activeStick=e.pointerId;
    tryCapture(joystick,activeStick);
    updateStick(e);
  });
  const endStick=e=>{if(e.pointerId===activeStick)resetStick();};
  joystick.addEventListener('pointermove',updateStick);
  for(const name of ['pointerup','pointercancel','lostpointercapture'])
    joystick.addEventListener(name,endStick);
  // A pointer can leave the joystick if capture failed or the page resized.
  root.addEventListener('pointermove',updateStick);
  for(const name of ['pointerup','pointercancel'])root.addEventListener(name,endStick);

  for(const [button,key] of buttons){
    button.addEventListener('pointerdown',e=>{
      if(!enabled()||button.disabled)return;
      if(e.pointerType==='mouse'&&e.button!==0)return;
      e.preventDefault();
      // One active pointer per control: reject duplicated/palm contacts.
      if([...held.values()].some(record=>record[0]===key))return;
      held.set(e.pointerId,[key,button]);
      touch[key]=true;
      button.classList?.add('is-held');
      button.setAttribute?.('aria-pressed','true');
      tryCapture(button,e.pointerId);
    });
    const stop=e=>{
      const record=held.get(e.pointerId);
      if(!record||record[1]!==button)return;
      held.delete(e.pointerId);
      touch[key]=false;
      button.classList?.remove('is-held');
      button.setAttribute?.('aria-pressed','false');
    };
    for(const name of ['pointerup','pointercancel','lostpointercapture'])
      button.addEventListener(name,stop);
    for(const name of ['pointerup','pointercancel'])
      root.addEventListener(name,stop);
    // Keyboard activation of a focused hold button is also press-and-hold.
    button.addEventListener('keydown',e=>{
      if(e.code!=='Space'&&e.code!=='Enter')return;
      e.preventDefault();e.stopPropagation();
      if(enabled()&&!button.disabled){
        touch[key]=true;button.classList?.add('is-held');button.setAttribute?.('aria-pressed','true');
      }
    });
    button.addEventListener('keyup',e=>{
      if(e.code!=='Space'&&e.code!=='Enter')return;
      e.preventDefault();e.stopPropagation();touch[key]=false;
      button.classList?.remove('is-held');button.setAttribute?.('aria-pressed','false');
    });
  }
  root.addEventListener('blur',releaseAll);
  root.addEventListener('pagehide',releaseAll);
  return {releaseAll};
}
