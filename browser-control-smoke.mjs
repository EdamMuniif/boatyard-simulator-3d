// Chrome/Chromium browser smoke test for real DOM Pointer Events.
// No extra npm dependencies; GitHub Actions ubuntu-latest includes Google Chrome.
// This validates browser input behavior, not a complete WebGL gameplay run.
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createServer} from 'node:http';
import {readFileSync,mkdtempSync,rmSync,existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

const browser=['google-chrome','google-chrome-stable','chromium','chromium-browser']
  .find(name=>spawnSync('which',[name],{encoding:'utf8'}).status===0);
if(!browser)throw new Error('Chrome/Chromium browser not found; smoke test cannot be marked passed.');

const html=`<!doctype html>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>
  #joystick{width:140px;height:140px;touch-action:none}
  .joystick-base{height:100px;width:100px;position:absolute;top:20px;left:20px}
  #joystickThumb{width:40px;height:40px}
</style>
<div id="joystick"><div class="joystick-base"></div><div id="joystickThumb"></div></div>
<button id="raise">RAISE</button><button id="turnLeft">LEFT</button>
<output id="status">running</output>
<script type="module">
  import {bindTouchControls} from './touch-controls.js';
  const q=id=>document.getElementById(id);
  const touch={x:0,y:0,raise:false,turnLeft:false};
  const binding=bindTouchControls({
    joystick:q('joystick'),thumb:q('joystickThumb'),root:window,touch,
    buttons:[[q('raise'),'raise'],[q('turnLeft'),'turnLeft']]
  });
  const send=(target,type,id,x=70,y=70)=>{
    const e=new PointerEvent(type,{pointerId:id,clientX:x,clientY:y,
      pointerType:'touch',isPrimary:true,bubbles:true,cancelable:true});
    target.dispatchEvent(e);
  };
  const check=(condition,message)=>{if(!condition)throw new Error(message)};
  try{
    send(q('joystick'),'pointerdown',1,70,30);
    check(touch.y<0,'joystick up not registered');
    send(window,'pointermove',1,110,70);
    check(touch.x>0,'joystick fallback move not registered');
    send(q('raise'),'pointerdown',2);
    send(q('turnLeft'),'pointerdown',3);
    check(touch.raise&&touch.turnLeft,'simultaneous controls not held');
    send(window,'pointerup',2);
    check(!touch.raise&&touch.turnLeft,'release affected unrelated control');
    send(window,'pointercancel',1);
    check(touch.x===0&&touch.y===0,'stick failed to reset after cancel');
    window.dispatchEvent(new Event('blur'));
    check(!touch.turnLeft,'blur failed to release held key');
    binding.releaseAll();
    document.body.dataset.smoke='passed';
    q('status').textContent='BROWSER CONTROL SMOKE PASSED';
  }catch(error){
    document.body.dataset.smoke='failed';
    q('status').textContent='BROWSER CONTROL SMOKE FAILED: '+error.message;
  }
</script>`;
const server=createServer((req,res)=>{
  const url=(req.url||'/').split('?')[0];
  if(url==='/touch-controls.js'){
    res.writeHead(200,{'content-type':'application/javascript'});
    res.end(readFileSync(new URL('./touch-controls.js',import.meta.url)));
  }else if(url==='/'){
    res.writeHead(200,{'content-type':'text/html'});
    res.end(html);
  }else{res.writeHead(404);res.end('Not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port;
const profile=mkdtempSync(join(tmpdir(),'boatyard-chrome-'));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const proc=spawn(browser,[
  '--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-gpu',
  '--disable-background-networking','--no-first-run','--no-default-browser-check',
  '--remote-allow-origins=*','--remote-debugging-port=0',
  `--user-data-dir=${profile}`, 'about:blank'
],{stdio:['ignore','pipe','pipe']});
let diagnostics='';
proc.stderr.on('data',d=>diagnostics+=d.toString().slice(0,2500));
let socket=null;
try{
  const activePortFile=join(profile,'DevToolsActivePort');
  for(let i=0;i<140&&!existsSync(activePortFile);i++){
    if(proc.exitCode!==null)throw new Error('Chrome quit before opening DevTools. '+diagnostics.slice(-700));
    await sleep(100);
  }
  if(!existsSync(activePortFile))
    throw new Error('Chrome DevTools did not start. '+diagnostics.slice(-1200));
  const debugPort=Number(readFileSync(activePortFile,'utf8').split('\n')[0]);
  const pages=await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
  const page=pages.find(item=>item.type==='page'&&item.webSocketDebuggerUrl);
  if(!page)throw new Error('Chrome started but no debuggable page was found.');
  socket=new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{
    const timeout=setTimeout(()=>reject(new Error('Cannot attach to Chrome DevTools')),7000);
    socket.addEventListener('open',()=>{clearTimeout(timeout);resolve();},{once:true});
    socket.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('Chrome DevTools socket error'));},{once:true});
  });
  let callId=0;
  const pending=new Map();
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(!message.id||!pending.has(message.id))return;
    const {resolve,reject}=pending.get(message.id);pending.delete(message.id);
    if(message.error)reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const call=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++callId;
    pending.set(id,{resolve,reject});
    socket.send(JSON.stringify({id,method,params}));
  });
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  let status='';
  for(let i=0;i<80;i++){
    await sleep(150);
    const response=await call('Runtime.evaluate',{
      expression:'({status:document.body?.dataset.smoke||"",message:document.querySelector("#status")?.textContent||""})',
      returnByValue:true
    });
    const value=response.result?.value;
    if(value?.status==='passed'){status='passed';break;}
    if(value?.status==='failed')throw new Error(value.message);
  }
  assert.equal(status,'passed','Browser never reported a completed input test; '+diagnostics.slice(-900));
  console.log('Browser touch-control smoke: PASS (real DOM Pointer Events)');
}finally{
  try{socket?.close();}catch{}
  proc.kill('SIGKILL');
  server.close();
  try{rmSync(profile,{recursive:true,force:true});}catch{}
}
