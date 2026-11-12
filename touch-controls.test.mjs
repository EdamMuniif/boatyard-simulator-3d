import test from 'node:test';
import assert from 'node:assert/strict';
import {joystickVector,bindTouchControls} from './touch-controls.js';

class FakeElement extends EventTarget{
  constructor(width=100,height=100){super();this.style={};this.disabled=false;this.rect={left:0,top:0,width,height};}
  getBoundingClientRect(){return this.rect;}
  querySelector(){return this.base;}
  setPointerCapture(){/* normal browser path */}
}
function pointer(type,id,x=50,y=50){
  const e=new Event(type,{cancelable:true});
  Object.assign(e,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',button:0});
  return e;
}
function build({captureFails=false}={}){
  const root=new EventTarget(),joystick=new FakeElement(),base=new FakeElement(),thumb=new FakeElement(40,40);
  joystick.base=base;
  if(captureFails)joystick.setPointerCapture=()=>{throw new Error('capture unavailable');};
  const buttons=new Map([['raise',new FakeElement()],['lower',new FakeElement()],['turnLeft',new FakeElement()]]);
  const touch={x:0,y:0,raise:false,lower:false,turnLeft:false};
  let enabled=true;
  const binding=bindTouchControls({joystick,thumb,buttons:[...buttons].map(([key,button])=>[button,key]),touch,root,enabled:()=>enabled});
  return {root,joystick,thumb,buttons,touch,binding,disable:()=>{enabled=false;}};
}
test('joystick deadzone and diagonal vectors preserve analog speed',()=>{
  assert.deepEqual(joystickVector(50,50,{left:0,top:0,width:100,height:100}),{x:0,y:0});
  const partial=joystickVector(65,50,{left:0,top:0,width:100,height:100});
  assert.ok(partial.x>0&&partial.x<1);
  assert.equal(partial.y,0);
  const diagonal=joystickVector(100,0,{left:0,top:0,width:100,height:100});
  assert.ok(Math.abs(Math.hypot(diagonal.x,diagonal.y)-1)<1e-9);
  assert.ok(diagonal.x>0&&diagonal.y<0);
});
test('touch stick movement and capture release clear axes',()=>{
  const b=build();
  b.joystick.dispatchEvent(pointer('pointerdown',4,50,12));
  assert.ok(b.touch.y<0);
  b.joystick.dispatchEvent(pointer('pointermove',4,90,50));
  assert.ok(b.touch.x>0);
  b.joystick.dispatchEvent(pointer('pointerup',4));
  assert.equal(b.touch.x,0);
  assert.equal(b.touch.y,0);
  assert.equal(b.thumb.style.transform,'translate(0,0)');
});
test('window-level events recover when pointer capture fails',()=>{
  const b=build({captureFails:true});
  b.joystick.dispatchEvent(pointer('pointerdown',4,50,12));
  b.root.dispatchEvent(pointer('pointermove',4,88,50));
  assert.ok(b.touch.x>0);
  b.root.dispatchEvent(pointer('pointerup',4));
  assert.equal(b.touch.x,0);
});
test('multiple independent hold buttons work simultaneously and release independently',()=>{
  const b=build();
  b.buttons.get('raise').dispatchEvent(pointer('pointerdown',9));
  b.buttons.get('turnLeft').dispatchEvent(pointer('pointerdown',10));
  assert.equal(b.touch.raise,true);
  assert.equal(b.touch.turnLeft,true);
  b.root.dispatchEvent(pointer('pointercancel',9));
  assert.equal(b.touch.raise,false);
  assert.equal(b.touch.turnLeft,true);
  b.root.dispatchEvent(pointer('pointerup',10));
  assert.equal(b.touch.turnLeft,false);
});
test('pause, blur, disabled states and pagehide never leave stuck controls',()=>{
  const b=build();
  b.joystick.dispatchEvent(pointer('pointerdown',1,85,50));
  b.buttons.get('raise').dispatchEvent(pointer('pointerdown',2));
  assert.ok(b.touch.x>0&&b.touch.raise);
  b.root.dispatchEvent(new Event('blur'));
  assert.equal(b.touch.x,0);
  assert.equal(b.touch.raise,false);
  b.disable();
  b.joystick.dispatchEvent(pointer('pointerdown',3,90,50));
  b.buttons.get('raise').dispatchEvent(pointer('pointerdown',4));
  assert.equal(b.touch.x,0);
  assert.equal(b.touch.raise,false);
  b.binding.releaseAll();
  b.root.dispatchEvent(new Event('pagehide'));
  assert.equal(b.touch.raise,false);
});
