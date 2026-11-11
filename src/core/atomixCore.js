const API_BASE = import.meta.env.BASE_URL || '/';

function jsUpdateParticles(positions, velocities, dt, attraction, repulsion, strength) {
  const count=Math.floor(positions.length/3), center=[0,0,0];
  for(let i=0;i<count;i++){center[0]+=positions[i*3];center[1]+=positions[i*3+1];center[2]+=positions[i*3+2];}
  if(count){center[0]/=count;center[1]/=count;center[2]/=count;}
  const step=Math.min(Math.max(Number(dt)||0,0),.04);
  for(let i=0;i<count;i++){
    const p=i*3, dx=center[0]-positions[p],dy=center[1]-positions[p+1],dz=center[2]-positions[p+2],distance=Math.max(Math.hypot(dx,dy,dz),.12);
    const radial=(attraction/distance-repulsion/(distance*distance))*strength;
    for(let axis=0;axis<3;axis++){
      const delta=axis===0?dx:axis===1?dy:dz;
      velocities[p+axis]=(velocities[p+axis]+delta/distance*radial*step)*.985;
      positions[p+axis]+=velocities[p+axis]*step;
    }
  }
  return positions;
}

function jsForces(positions,strength=1) {
  const count=Math.floor(positions.length/3),forces=new Float32Array(positions.length);
  for(let i=0;i<count;i++)for(let j=i+1;j<count;j++){
    const a=i*3,b=j*3,dx=positions[b]-positions[a],dy=positions[b+1]-positions[a+1],dz=positions[b+2]-positions[a+2],r2=Math.max(dx*dx+dy*dy+dz*dz,.04),factor=strength/(r2*Math.sqrt(r2));
    forces[a]-=dx*factor;forces[a+1]-=dy*factor;forces[a+2]-=dz*factor;forces[b]+=dx*factor;forces[b+1]+=dy*factor;forces[b+2]+=dz*factor;
  }
  return forces;
}

function jsBondLengths(coordinates,bonds) {
  return bonds.map(([a,b])=>{const i=a*3,j=b*3;return Math.hypot(coordinates[i]-coordinates[j],coordinates[i+1]-coordinates[j+1],coordinates[i+2]-coordinates[j+2]);});
}

class AtomixCoreEngine {
  constructor() { this.backend='javascript'; this.module=null; this.ready=false; this.loading=null; }
  async initialize() {
    if(this.loading)return this.loading;
    this.loading=(async()=>{
      try{
        const source=new URL(`${API_BASE.replace(/\/$/,'')}/wasm/atomix-core.js`,location.origin);
        const response=await fetch(source,{cache:'no-cache'});
        if(!response.ok||!response.headers.get('content-type')?.includes('javascript'))throw new Error('Compiled WebAssembly module is not present.');
        const wasmUrl=new URL(`${API_BASE.replace(/\/$/,'')}/wasm/atomix-core.wasm`,location.origin);
        const moduleUrl=URL.createObjectURL(new Blob([await response.text()],{type:'text/javascript'}));
        try{
          const imported=await import(/* @vite-ignore */ moduleUrl);
          const factory=imported.default||imported;
          this.module=await factory({locateFile:(file)=>file.endsWith('.wasm')?wasmUrl.href:file});
          if(!this.module._atomix_update_particles||!this.module._atomix_calculate_forces||!this.module._atomix_update_molecule)throw new Error('The compiled module is missing required exports.');
          this.backend='wasm'; this.ready=true;
        }finally{URL.revokeObjectURL(moduleUrl);}
      }catch(error){this.module=null;this.backend='javascript';this.ready=true;console.info(`[ATOMIX CORE] JavaScript engine active: ${error.message}`);}
      return {backend:this.backend,wasmAvailable:this.backend==='wasm'};
    })();
    return this.loading;
  }
  withFloatArrays(arrays, callback) {
    const module=this.module, allocated=[];
    try{
      const pointers=arrays.map(array=>{const pointer=module._malloc(Math.max(4,array.byteLength));allocated.push(pointer);module.HEAPF32.set(array,pointer/4);return pointer;});
      const result=callback(pointers);
      return arrays.map((array,index)=>{array.set(module.HEAPF32.subarray(pointers[index]/4,pointers[index]/4+array.length));return result;});
    }finally{for(const pointer of allocated)module._free(pointer);}
  }
  updateParticles(positions,velocities,dt,attraction=.4,repulsion=.25,strength=.6) {
    if(!this.module)return jsUpdateParticles(positions,velocities,dt,attraction,repulsion,strength);
    const module=this.module,count=Math.floor(positions.length/3),p=module._malloc(positions.byteLength),v=module._malloc(velocities.byteLength);
    try{module.HEAPF32.set(positions,p/4);module.HEAPF32.set(velocities,v/4);module._atomix_update_particles(p,v,count,dt,attraction,repulsion,strength);positions.set(module.HEAPF32.subarray(p/4,p/4+positions.length));velocities.set(module.HEAPF32.subarray(v/4,v/4+velocities.length));return positions;}
    finally{module._free(p);module._free(v);}
  }
  calculateForces(positions,strength=1) {
    if(!this.module)return jsForces(positions,strength);
    const module=this.module,count=Math.floor(positions.length/3),p=module._malloc(positions.byteLength),f=module._malloc(positions.byteLength);
    try{module.HEAPF32.set(positions,p/4);module._atomix_calculate_forces(p,f,count,strength);return new Float32Array(module.HEAPF32.subarray(f/4,f/4+positions.length));}
    finally{module._free(p);module._free(f);}
  }
  updateMolecule(atoms,bonds) {
    const coordinates=Float32Array.from(atoms.flatMap(atom=>atom.position)),pairs=Int32Array.from(bonds.flat()),count=bonds.length;
    if(!this.module)return {bondLengths:jsBondLengths(coordinates,bonds),centerOfMass:this.centerOfMass(atoms),backend:this.backend};
    const module=this.module,cp=module._malloc(coordinates.byteLength),bp=module._malloc(pairs.byteLength),out=module._malloc(Math.max(4,count*4));
    try{module.HEAPF32.set(coordinates,cp/4);module.HEAP32.set(pairs,bp/4);module._atomix_update_molecule(cp,atoms.length,bp,count,out);return {bondLengths:Array.from(module.HEAPF32.subarray(out/4,out/4+count)),centerOfMass:this.centerOfMass(atoms),backend:this.backend};}
    finally{module._free(cp);module._free(bp);module._free(out);}
  }
  centerOfMass(atoms) {
    const weight={H:1.008,C:12.011,N:14.007,O:15.999,F:18.998,P:30.974,S:32.06,Cl:35.45},sum=[0,0,0];let total=0;
    for(const atom of atoms){const mass=weight[atom.element]||12;total+=mass;for(let i=0;i<3;i++)sum[i]+=atom.position[i]*mass;}
    return sum.map(value=>total?value/total:0);
  }
}

export const AtomixCore=new AtomixCoreEngine();
