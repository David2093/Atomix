import * as THREE from 'three';
import { createStage } from './createStage.js';

const vertex = `
  attribute float aPhase; attribute float aSize; attribute vec3 aColor;
  uniform float uTime; uniform float uSpeed; uniform float uStrength; uniform float uAttraction; uniform float uRepulsion; uniform float uGlow; uniform float uMode; uniform float uBurst; uniform vec2 uPointer;
  varying vec3 vColor; varying float vAlpha;
  void main(){
    vec3 p=position; float t=uTime*uSpeed; float phase=aPhase;
    vec2 delta=p.xy-uPointer*vec2(4.5,2.8); float d=max(length(delta),.12);
    float touch=exp(-d*.72)*uStrength;
    vec2 direction=normalize(delta+vec2(.001));
    p.xy += direction*(uRepulsion*exp(-d*1.7)-uAttraction*exp(-d*.78))*uStrength;
    p.xy += direction*touch*(.18+sin(t*1.4+phase)*.08);
    float wave=sin(p.x*1.5+t*.82+phase)*cos(p.y*1.3-t*.55+phase*.7);
    p.z += wave*.18;
    if(uMode<.5){ p.xy += vec2(sin(t*.34+phase),cos(t*.26+phase*1.3))*.10; }
    else if(uMode<1.5){ float burst=exp(-mod(max(uTime-uBurst,0.0),5.0)*.72); p*=1.0+burst*(.38+.24*sin(t*2.0+phase)); }
    else if(uMode<2.5){ float a=t*.2+phase*.08; mat2 r=mat2(cos(a),-sin(a),sin(a),cos(a)); p.xy=r*p.xy; p.z+=sin(p.x*1.8+t+phase)*.22; }
    else if(uMode<3.5){ float hit=exp(-pow(length(p.xy)*1.2,2.0)); p.xy+=normalize(p.xy+vec2(.001))*hit*sin(t*2.8+phase)*.8; }
    else { float a=atan(p.y,p.x)+t*.12; float r=length(p.xy); p.xy=vec2(cos(a),sin(a))*r; p.z+=sin(a*3.0+t+phase)*.38; }
    vec4 mv=modelViewMatrix*vec4(p,1.0); gl_Position=projectionMatrix*mv;
    gl_PointSize=clamp(aSize*(270.0/-mv.z),1.0,8.0);
    vColor=aColor; vAlpha=.45+.55*(.5+.5*sin(t*1.2+phase));
  }
`;
const fragment = `
  uniform float uGlow; varying vec3 vColor; varying float vAlpha;
  void main(){ vec2 p=gl_PointCoord-.5; float d=length(p); if(d>.5)discard;
    float core=1.0-smoothstep(.0,.22,d); float halo=1.0-smoothstep(.08,.5,d);
    float a=(core*.82+halo*.24)*vAlpha*uGlow;
    gl_FragColor=vec4(vColor*(1.0+core*1.5),a);
  }
`;

export function createQuantumScene(container, { core = null } = {}) {
  const stage = createStage(container, { cameraZ: 8.5, fov: 42, bloom: true, background: 0x0a1114 });
  stage.scene.fog = new THREE.FogExp2(0x0a1114, .018);
  const countMax = 3200;
  const positions = new Float32Array(countMax * 3), phases = new Float32Array(countMax), sizes = new Float32Array(countMax), colors = new Float32Array(countMax * 3);
  const palette = [new THREE.Color('#9cded0'), new THREE.Color('#80bfc2'), new THREE.Color('#d0dc9e'), new THREE.Color('#b5a8e9')];
  for (let i = 0; i < countMax; i++) {
    const r = Math.pow(Math.random(), .55) * 4.2, angle = Math.random() * Math.PI * 2;
    positions[i * 3] = Math.cos(angle) * r;
    positions[i * 3 + 1] = Math.sin(angle) * r * .63;
    positions[i * 3 + 2] = (Math.random() - .5) * 3.2;
    phases[i] = Math.random() * Math.PI * 2;
    sizes[i] = Math.random() * 2.7 + .8;
    const color = palette[Math.floor(Math.random() * palette.length)];
    colors.set([color.r, color.g, color.b], i * 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
  let count = window.innerWidth < 700 ? 1000 : 1600;
  geometry.setDrawRange(0, count);
  const uniforms = { uTime:{value:0},uSpeed:{value:1},uStrength:{value:.58},uAttraction:{value:.42},uRepulsion:{value:.28},uGlow:{value:.68},uMode:{value:0},uBurst:{value:0},uPointer:{value:new THREE.Vector2(10,10)} };
  const material = new THREE.ShaderMaterial({ vertexShader: vertex, fragmentShader: fragment, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geometry, material); stage.scene.add(points);
  const aura = new THREE.Mesh(new THREE.SphereGeometry(2.8, 32, 28), new THREE.ShaderMaterial({ transparent:true, depthWrite:false, side:THREE.BackSide, uniforms:{uTime:{value:0}}, vertexShader:`varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vV=-mv.xyz;gl_Position=projectionMatrix*mv;}`,fragmentShader:`uniform float uTime;varying vec3 vN;varying vec3 vV;void main(){float rim=pow(1.0-max(dot(normalize(vN),normalize(vV)),0.0),3.0);float p=.6+.4*sin(uTime*.7);gl_FragColor=vec4(vec3(.28,.65,.58),rim*.12*p);}` }));
  aura.scale.set(1.38, .83, .55); stage.scene.add(aura);
  let speed = 1, strength = .58, currentMode = 'cloud';
  const simulatedCount = Math.min(320, countMax);
  const simulatedPositions = positions.subarray(0, simulatedCount * 3);
  const simulatedVelocities = new Float32Array(simulatedPositions.length);
  let physicsAccumulator = 0;
  const modes = { cloud: 0, burst: 1, magnetic: 2, collision: 3, galaxy: 4 };
  const canvas = stage.renderer.domElement;
  const onMove = event => {
    const rect = canvas.getBoundingClientRect();
    uniforms.uPointer.value.set(((event.clientX - rect.left) / rect.width - .5) * 2, -((event.clientY - rect.top) / rect.height - .5) * 2);
  };
  const onLeave = () => uniforms.uPointer.value.set(10, 10);
  canvas.addEventListener('pointermove', onMove); canvas.addEventListener('pointerleave', onLeave);
  stage.setUpdater((dt, time) => {
    uniforms.uTime.value = time; aura.material.uniforms.uTime.value = time;
    if (core) {
      physicsAccumulator += dt;
      if (physicsAccumulator >= 1 / 30) {
        core.updateParticles(simulatedPositions, simulatedVelocities, Math.min(physicsAccumulator, .04), uniforms.uAttraction.value, uniforms.uRepulsion.value, strength);
        geometry.attributes.position.needsUpdate = true;
        physicsAccumulator = 0;
      }
    }
    points.rotation.y += dt * .018; points.rotation.x = Math.sin(time * .11) * .035;
    aura.rotation.y = -time * .012;
  });
  return {
    ...stage,
    setCount(value) { count = Math.min(countMax, Math.max(200, Math.round(Number(value) / 200) * 200)); geometry.setDrawRange(0, count); return count; },
    setSpeed(value) { speed = Number(value); uniforms.uSpeed.value = speed; },
    setStrength(value) { strength = Number(value) / 100; uniforms.uStrength.value = strength; },
    setAttraction(value) { uniforms.uAttraction.value = Number(value) / 100; },
    setRepulsion(value) { uniforms.uRepulsion.value = Number(value) / 100; },
    setGlow(value) { uniforms.uGlow.value = Number(value) / 100; },
    setPreset(key) { if (!(key in modes)) return; currentMode = key; uniforms.uMode.value = modes[key]; uniforms.uBurst.value = stage.time; return currentMode; },
    getCount() { return count; },
    dispose() { canvas.removeEventListener('pointermove', onMove); canvas.removeEventListener('pointerleave', onLeave); stage.dispose(); },
  };
}
