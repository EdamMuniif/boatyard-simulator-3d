// Facial depth field for the textured model's painted face (no Three.js, so
// it can be unit-tested). Coordinates are atlas pixels of the 1024 x 1024
// texture in assets/characters/boatyard-worker.glb (v down); replacing that
// model means re-measuring FACE_LANDMARKS. Depths are metres along the normal.
export const ATLAS_SIZE=1024;
export const FACE_LANDMARKS=Object.freeze({
  eyeL:[237,151],eyeR:[302,148],browY:132,
  noseX:271,bridgeY:150,noseTipY:187,nostrilY:191,
  mouth:[273,215],chin:[272,248],
  // Region that gets subdivided and sculpted; the depth field is zero at its edge.
  box:[190,100,352,282],center:[272,190],radii:[74,92]
});

const g2=(x,y,cx,cy,sx,sy)=>Math.exp(-((x-cx)**2/(2*sx*sx)+(y-cy)**2/(2*sy*sy)));
const smooth=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t);};

// Depth in metres to add along the surface normal at atlas pixel (x,y).
export function faceDepth(x,y,L=FACE_LANDMARKS){
  const [cx,cy]=L.center,[rx,ry]=L.radii;
  const r=Math.hypot((x-cx)/rx,(y-cy)/ry);
  const window=1-smooth(.72,1,r);
  if(window<=0)return 0;
  let d=0;
  // Nose: a ridge from the bridge growing to the tip, then the nostril wings.
  // Low, narrow bridge between the eyes rising to a modest tip.
  const t=smooth(L.bridgeY,L.noseTipY,y)**1.4;
  const ridgeH=(.0025+.008*t)*(y<=L.noseTipY?smooth(L.bridgeY-6,L.bridgeY+6,y):Math.exp(-((y-L.noseTipY)**2)/(2*3.5*3.5)));
  const ridgeW=4.2+3.6*t;
  d+=ridgeH*Math.exp(-((x-L.noseX)**2)/(2*ridgeW*ridgeW));
  for(const s of [-1,1])d+=.0028*g2(x,y,L.noseX+s*12,L.nostrilY-1,5,4);
  // Brow ridge and glabella.
  d+=.0055*g2(x,y,L.eyeL[0]-2,L.browY+2,17,6)+.0055*g2(x,y,L.eyeR[0]+2,L.browY,17,6);
  d+=.0035*g2(x,y,L.noseX,L.browY+5,8,6);
  // Eye sockets with a slight eyeball/eyelid bulge in the middle.
  for(const [ex,ey] of [L.eyeL,L.eyeR]){
    d-=.0075*g2(x,y,ex,ey,13,9);
    d+=.0035*g2(x,y,ex,ey+1,7,4.5);
  }
  // Cheekbones.
  d+=.004*g2(x,y,L.eyeL[0]-8,L.eyeL[1]+25,14,11)+.004*g2(x,y,L.eyeR[0]+8,L.eyeR[1]+25,14,11);
  // Lips, philtrum and chin.
  const [mx,my]=L.mouth;
  d+=.0045*g2(x,y,mx,my+1,17,6)+.0025*g2(x,y,mx,my-9,6,5);
  d-=.0015*g2(x,y,mx,my+11,15,3);
  d+=.006*g2(x,y,L.chin[0],L.chin[1],16,11);
  return d*window;
}

