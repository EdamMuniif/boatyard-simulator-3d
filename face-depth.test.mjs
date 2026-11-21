import test from 'node:test';
import assert from 'node:assert/strict';
import {FACE_LANDMARKS as L,faceDepth} from './face-depth.js';

test('face depth gives the painted landmarks a plausible 3D shape',()=>{
  const tip=faceDepth(L.noseX,L.noseTipY);
  assert.ok(tip>.008&&tip<.015,`nose tip ${tip} m`);
  assert.ok(faceDepth(L.noseX,L.bridgeY)<tip/2,'bridge lower than the tip');
  for(const [ex,ey] of [L.eyeL,L.eyeR])assert.ok(faceDepth(ex+9,ey-3)<0,'eye sockets recessed around the eye');
  assert.ok(faceDepth(L.eyeL[0],L.browY)>0&&faceDepth(L.eyeR[0],L.browY)>0,'brow ridge raised');
  assert.ok(faceDepth(...L.chin)>0,'chin raised');
  // Symmetric about the nose line (landmarks are within a few pixels).
  assert.ok(Math.abs(faceDepth(L.noseX-30,200)-faceDepth(L.noseX+30,200))<.002);
});
test('face depth is zero at and beyond the sculpted region edge (no cracks)',()=>{
  const [x0,y0,x1,y1]=L.box;
  for(let x=x0;x<=x1;x+=4){assert.ok(Math.abs(faceDepth(x,y0))<2e-4,`top edge ${x}`);assert.equal(faceDepth(x,y1),0,`bottom edge ${x}`);}
  for(let y=y0;y<=y1;y+=4){assert.equal(faceDepth(x0,y),0,`left edge ${y}`);assert.equal(faceDepth(x1,y),0,`right edge ${y}`);}
  assert.equal(faceDepth(50,50),0);assert.equal(faceDepth(700,700),0);
});
