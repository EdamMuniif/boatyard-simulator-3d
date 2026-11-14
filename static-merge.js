import * as THREE from 'three';

// Collapse every static Mesh under `group` into one Mesh per material (and
// shadow flag). Sprites, lights and anything with userData.dynamic stay as they
// are. The yard is built from ~1,500 small meshes; one draw call each is the
// main frame-rate cost on phones, so this runs once after the world is built.
export function mergeStaticMeshes(group){
  group.updateMatrixWorld(true);
  const toLocal=new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets=new Map();
  group.traverse(obj=>{
    if(!obj.isMesh||obj.isInstancedMesh||obj.isSkinnedMesh)return;
    for(let p=obj;p&&p!==group;p=p.parent)if(p.userData.dynamic)return;
    const material=obj.material;
    if(Array.isArray(material)||material.transparent||material.isShaderMaterial)return;
    const needsUv=!!material.map;
    const geo=obj.geometry;
    if(!geo.attributes.position||!geo.attributes.normal)return;
    if(needsUv&&!geo.attributes.uv)return;
    const key=`${material.uuid}|${obj.castShadow}|${obj.receiveShadow}`;
    if(!buckets.has(key))buckets.set(key,{material,castShadow:obj.castShadow,receiveShadow:obj.receiveShadow,needsUv,parts:[]});
    const matrix=new THREE.Matrix4().multiplyMatrices(toLocal,obj.matrixWorld);
    buckets.get(key).parts.push({obj,geo,matrix});
  });
  const normalMatrix=new THREE.Matrix3();
  const v=new THREE.Vector3();
  const out=[];
  for(const bucket of buckets.values()){
    if(bucket.parts.length<2)continue;
    let count=0;
    for(const {geo} of bucket.parts)count+=geo.index?geo.index.count:geo.attributes.position.count;
    const pos=new Float32Array(count*3),nor=new Float32Array(count*3),uv=bucket.needsUv?new Float32Array(count*2):null;
    let o=0;
    for(const {geo,matrix} of bucket.parts){
      normalMatrix.getNormalMatrix(matrix);
      const P=geo.attributes.position,N=geo.attributes.normal,U=geo.attributes.uv,idx=geo.index;
      const n=idx?idx.count:P.count;
      for(let i=0;i<n;i++){
        const k=idx?idx.getX(i):i;
        v.fromBufferAttribute(P,k).applyMatrix4(matrix);pos[o*3]=v.x;pos[o*3+1]=v.y;pos[o*3+2]=v.z;
        v.fromBufferAttribute(N,k).applyMatrix3(normalMatrix).normalize();nor[o*3]=v.x;nor[o*3+1]=v.y;nor[o*3+2]=v.z;
        if(uv){uv[o*2]=U.getX(k);uv[o*2+1]=U.getY(k);}
        o++;
      }
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.BufferAttribute(pos,3));
    g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
    if(uv)g.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    g.computeBoundingSphere();
    const mesh=new THREE.Mesh(g,bucket.material);
    mesh.castShadow=bucket.castShadow;mesh.receiveShadow=bucket.receiveShadow;
    mesh.name='Merged static scenery';
    out.push({mesh,parts:bucket.parts});
  }
  // Remove only the meshes that actually went into a merged bucket.
  // (Geometries are shared between meshes, so track the mesh objects.)
  let removed=0;
  for(const {parts} of out)for(const {obj} of parts){obj.parent.remove(obj);removed++;}
  for(const {mesh} of out)group.add(mesh);
  return {merged:removed,drawCalls:out.length};
}

// For animated models: merge the meshes that share a parent (one rigid part,
// e.g. a forearm or a wheel) into a single vertex-coloured mesh in that
// parent's space. Joints keep moving because only siblings are combined.
// Fine per-material differences collapse into four shared looks:
// matte/metal x satin/gloss, per face side and shadow flag.
const rigidMaterials=new Map();
function rigidMaterial(metal,gloss,side){
  const key=`${metal}|${gloss}|${side}`;
  if(!rigidMaterials.has(key)){
    rigidMaterials.set(key,new THREE.MeshStandardMaterial({
      vertexColors:true,side,
      roughness:gloss?.18:.8,metalness:metal?.45:.05
    }));
  }
  return rigidMaterials.get(key);
}
export function mergeRigidChildren(root){
  const parents=[];
  root.traverse(o=>{if(!o.isMesh)parents.push(o);});
  let before=0,after=0;
  const v=new THREE.Vector3(),normalMatrix=new THREE.Matrix3();
  for(const parent of parents){
    const buckets=new Map();
    for(const obj of parent.children){
      if(!obj.isMesh||obj.userData.dynamic||obj.children.length)continue;
      const m=obj.material;
      if(Array.isArray(m)||m.transparent||m.map||!m.isMeshStandardMaterial)continue;
      const g=obj.geometry;
      if(!g.attributes.position||!g.attributes.normal)continue;
      const metal=m.metalness>.3,gloss=m.roughness<.3;
      const key=`${metal}|${gloss}|${m.side}|${obj.castShadow}`;
      if(!buckets.has(key))buckets.set(key,{metal,gloss,side:m.side,castShadow:obj.castShadow,parts:[]});
      buckets.get(key).parts.push(obj);
    }
    for(const b of buckets.values()){
      if(b.parts.length<2)continue;
      let count=0;
      for(const o of b.parts)count+=o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count;
      const pos=new Float32Array(count*3),nor=new Float32Array(count*3),col=new Float32Array(count*3);
      let k=0;
      for(const o of b.parts){
        o.updateMatrix();
        normalMatrix.getNormalMatrix(o.matrix);
        const g=o.geometry,P=g.attributes.position,N=g.attributes.normal,idx=g.index,c=o.material.color;
        const n=idx?idx.count:P.count;
        for(let i=0;i<n;i++){
          const j=idx?idx.getX(i):i;
          v.fromBufferAttribute(P,j).applyMatrix4(o.matrix);pos[k*3]=v.x;pos[k*3+1]=v.y;pos[k*3+2]=v.z;
          v.fromBufferAttribute(N,j).applyMatrix3(normalMatrix).normalize();nor[k*3]=v.x;nor[k*3+1]=v.y;nor[k*3+2]=v.z;
          col[k*3]=c.r;col[k*3+1]=c.g;col[k*3+2]=c.b;k++;
        }
      }
      const g=new THREE.BufferGeometry();
      g.setAttribute('position',new THREE.BufferAttribute(pos,3));
      g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
      g.setAttribute('color',new THREE.BufferAttribute(col,3));
      g.computeBoundingSphere();
      const mesh=new THREE.Mesh(g,rigidMaterial(b.metal,b.gloss,b.side));
      mesh.castShadow=b.castShadow;mesh.receiveShadow=true;
      for(const o of b.parts)parent.remove(o);
      parent.add(mesh);
      before+=b.parts.length;after++;
    }
  }
  return {before,after};
}
