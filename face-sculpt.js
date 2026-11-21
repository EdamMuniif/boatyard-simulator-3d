import * as THREE from 'three';

// Face sculpt and skin relief for the textured hero/worker model.
//
// The model's head is a smooth egg with the face painted on, so it reads flat
// and the painted shadows look harsh. This module:
//  1. subdivides the face triangles only (2 levels, 16x) so there is enough
//     geometry for facial features, and
//  2. pushes those vertices along their normals with a depth field laid out
//     on the painted landmarks of the texture atlas (nose, brows, sockets,
//     cheekbones, lips, chin), so the painting gains a matching 3D shape;
// The fine skin/fabric relief normal map is built offline by
// tools/build-relief-map.py (assets/characters/boatyard-worker-relief.jpg).
//
// Landmark coordinates are atlas pixels of the 1024 x 1024 texture in
// assets/characters/boatyard-worker.glb (v down). Replacing that model means
// re-measuring FACE_LANDMARKS.
import {ATLAS_SIZE,FACE_LANDMARKS,faceDepth} from './face-depth.js';
export {ATLAS_SIZE,FACE_LANDMARKS,faceDepth};

const inBox=(px,py,b)=>px>=b[0]&&px<=b[2]&&py>=b[1]&&py<=b[3];

// Midpoint subdivision of the triangles selected by `pick`, sharing edge
// midpoints so the refined area stays watertight. Skin weights are merged and
// renormalised (top four influences).
function subdivide(geometry,pick){
  const attrs=Object.entries(geometry.attributes);
  const data=Object.fromEntries(attrs.map(([n,a])=>[n,[]]));
  const count=geometry.attributes.position.count;
  for(const [n,a] of attrs)for(let i=0;i<count;i++)for(let c=0;c<a.itemSize;c++)data[n].push(a.getComponent(i,c));
  const idx=Array.from(geometry.index.array);
  let vcount=count;
  const mid=new Map();
  const midpoint=(i,j)=>{
    const key=i<j?`${i}_${j}`:`${j}_${i}`;
    if(mid.has(key))return mid.get(key);
    for(const [n,a] of attrs){
      const s=a.itemSize,A=data[n];
      if(n==='skinIndex'||n==='skinWeight')continue;
      for(let c=0;c<s;c++)A.push((A[i*s+c]+A[j*s+c])/2);
    }
    if(data.skinIndex&&data.skinWeight){
      const w=new Map();
      for(const v of [i,j])for(let c=0;c<4;c++){
        const b=data.skinIndex[v*4+c],x=data.skinWeight[v*4+c]/2;
        if(x>0)w.set(b,(w.get(b)||0)+x);
      }
      const top=[...w.entries()].sort((p,q)=>q[1]-p[1]).slice(0,4);
      const sum=top.reduce((s,[,x])=>s+x,0)||1;
      for(let c=0;c<4;c++){data.skinIndex.push(top[c]?top[c][0]:0);data.skinWeight.push(top[c]?top[c][1]/sum:0);}
    }
    mid.set(key,vcount);return vcount++;
  };
  const out=[];
  for(let t=0;t<idx.length;t+=3){
    const a=idx[t],b=idx[t+1],c=idx[t+2];
    if(!pick(a,b,c,data)){out.push(a,b,c);continue;}
    const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);
    out.push(a,ab,ca, ab,b,bc, ca,bc,c, ab,bc,ca);
  }
  const g=new THREE.BufferGeometry();
  for(const [n,a] of attrs){
    const Arr=a.array.constructor;
    const attr=new THREE.BufferAttribute(new Arr(data[n].length),a.itemSize,a.normalized);
    for(let i=0;i<data[n].length/a.itemSize;i++)for(let c=0;c<a.itemSize;c++)attr.setComponent(i,c,data[n][i*a.itemSize+c]);
    g.setAttribute(n,attr);
  }
  g.setIndex(vcount>65535?new THREE.Uint32BufferAttribute(out,1):new THREE.Uint16BufferAttribute(out,1));
  g.groups=geometry.groups.slice();
  return g;
}

// Sculpt the face of every skinned mesh under `root` in place.
// `restVertex(mesh,i,target)` returns a vertex's world rest position and is
// used to convert metres into the geometry's own units.
export function sculptFace(root,restVertex,L=FACE_LANDMARKS){
  const stats={before:0,after:0,displaced:0,maxDepth:0};
  root.traverse(mesh=>{
    if(!mesh.isSkinnedMesh||!mesh.geometry.index||!mesh.geometry.attributes.uv)return;
    let g=mesh.geometry;
    const pxOf=(uv,i)=>[uv[i*2]*ATLAS_SIZE,uv[i*2+1]*ATLAS_SIZE];
    const pick=(a,b,c,data)=>[a,b,c].every(v=>inBox(...pxOf(data.uv,v),L.box));
    stats.before+=g.attributes.position.count;
    g=subdivide(g,pick);
    g=subdivide(g,pick);
    // Metres per geometry unit, from two far-apart vertices of the face box.
    const P=g.attributes.position,UV=g.attributes.uv,N=g.attributes.normal;
    mesh.geometry=g;
    const face=[];
    for(let i=0;i<P.count;i++)if(inBox(UV.getX(i)*ATLAS_SIZE,UV.getY(i)*ATLAS_SIZE,L.box))face.push(i);
    if(face.length<2)return;
    const a=face[0];let b=a,best=0;const pa=new THREE.Vector3().fromBufferAttribute(P,a);
    for(const i of face){const d=pa.distanceTo(new THREE.Vector3().fromBufferAttribute(P,i));if(d>best){best=d;b=i;}}
    const wa=restVertex(mesh,a,new THREE.Vector3()),wb=restVertex(mesh,b,new THREE.Vector3());
    const metresPerUnit=wa.distanceTo(wb)/Math.max(best,1e-9);
    const n=new THREE.Vector3();
    const moved=new Set();
    for(const i of face){
      const d=faceDepth(UV.getX(i)*ATLAS_SIZE,UV.getY(i)*ATLAS_SIZE,L);
      if(Math.abs(d)<1e-6)continue;
      n.fromBufferAttribute(N,i).normalize();
      P.setXYZ(i,P.getX(i)+n.x*d/metresPerUnit,P.getY(i)+n.y*d/metresPerUnit,P.getZ(i)+n.z*d/metresPerUnit);
      moved.add(i);stats.maxDepth=Math.max(stats.maxDepth,Math.abs(d));
    }
    // Recompute normals for the sculpted area only, so seams elsewhere keep
    // the model's authored normals.
    const tmp=g.clone();tmp.computeVertexNormals();
    for(const i of face)if(faceDepth(UV.getX(i)*ATLAS_SIZE,UV.getY(i)*ATLAS_SIZE,L)!==0||moved.has(i))N.setXYZ(i,tmp.attributes.normal.getX(i),tmp.attributes.normal.getY(i),tmp.attributes.normal.getZ(i));
    P.needsUpdate=true;N.needsUpdate=true;g.computeBoundingSphere();
    stats.after+=P.count;stats.displaced+=moved.size;
  });
  return stats;
}
