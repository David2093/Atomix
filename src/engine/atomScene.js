import * as THREE from 'three';
import { createStage, addStarField } from './createStage.js';
import { elements } from '../data/elements.js';

const orbitVertex = `varying vec2 vUv; void main(){vUv=uv;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;}`;
const orbitFragment = `uniform float uTime; uniform vec3 uColor; uniform float uGlow; varying vec2 vUv; void main(){float edge=pow(max(0.0,1.0-abs(vUv.x*2.0-1.0)),2.0);float pulse=.62+.38*sin(uTime*1.7+vUv.y*28.0);float a=(.025+edge*.38)*pulse*uGlow;gl_FragColor=vec4(uColor*(.8+edge*2.2),a);}`;

function makeOrbit(radius, tilt, phase, color, width) {
  const points = [];
  for (let i = 0; i <= 180; i++) {
    const t = i / 180 * Math.PI * 2;
    const r = radius * (1 + 0.055 * Math.cos(2 * t + phase));
    points.push(new THREE.Vector3(Math.cos(t) * r, Math.sin(t) * r * 0.48, 0));
  }
  const curve = new THREE.CatmullRomCurve3(points, true, 'catmullrom', 0.08);
  const geometry = new THREE.TubeGeometry(curve, 240, width, 7, true);
  const material = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(color) }, uGlow: { value: 1 } }, vertexShader: orbitVertex, fragmentShader: orbitFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.rotation.set(tilt, phase * .25, phase);
  return mesh;
}

function scatterNucleons(group, data) {
  const mass = data.protons + data.neutrons;
  const shown = Math.min(mass, 48);
  const protonCount = Math.max(1, Math.round(shown * data.protons / mass));
  const neutronCount = shown - protonCount;
  const sphere = new THREE.SphereGeometry(0.29, 24, 20);
  const protonMat = new THREE.MeshPhysicalMaterial({ color: 0xc98470, roughness: 0.25, metalness: 0.2, clearcoat: 1, clearcoatRoughness: 0.16, emissive: 0x532a35, emissiveIntensity: 0.27 });
  const neutronMat = new THREE.MeshPhysicalMaterial({ color: 0x6c8e91, roughness: 0.28, metalness: 0.16, clearcoat: 1, clearcoatRoughness: 0.18, emissive: 0x173c48, emissiveIntensity: 0.35 });
  const protons = new THREE.InstancedMesh(sphere, protonMat, protonCount);
  const neutrons = new THREE.InstancedMesh(sphere, neutronMat, Math.max(1, neutronCount));
  protons.instanceMatrix.setUsage(THREE.StaticDrawUsage); neutrons.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  const dummy = new THREE.Object3D();
  let p = 0, n = 0;
  for (let i = 0; i < shown; i++) {
    const z = 1 - 2 * (i + 0.5) / shown, angle = i * Math.PI * (3 - Math.sqrt(5));
    const shell = Math.cbrt((i + 1) / shown) * 0.95;
    dummy.position.set(Math.cos(angle) * Math.sqrt(1 - z*z) * shell, Math.sin(angle) * Math.sqrt(1-z*z) * shell, z * shell);
    dummy.rotation.set(angle * .23, angle * .17, angle * .31);
    const scale = .78 + .22 * Math.sin(i * 21.4) ** 2;
    dummy.scale.setScalar(scale); dummy.updateMatrix();
    if (i < protonCount) protons.setMatrixAt(p++, dummy.matrix); else neutrons.setMatrixAt(n++, dummy.matrix);
  }
  group.add(protons); if (neutronCount) group.add(neutrons);
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.14, 36, 32), new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color(data.tint) } }, vertexShader: `varying vec3 vNormal;varying vec3 vView;void main(){vNormal=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.0);vView=-mv.xyz;gl_Position=projectionMatrix*mv;}`, fragmentShader: `uniform float uTime;uniform vec3 uColor;varying vec3 vNormal;varying vec3 vView;void main(){float f=pow(1.0-max(dot(normalize(vNormal),normalize(vView)),0.0),2.5);float w=.48+.12*sin(uTime*1.2);vec3 c=mix(uColor*0.22,uColor,f*1.6);gl_FragColor=vec4(c,w+f*.42);}`, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.BackSide }));
  core.scale.set(1.22, 1.03, 0.95); group.add(core);
  return { protons, neutrons, core };
}

function buildAtom(symbol, scale = 1) {
  const data = elements[symbol], root = new THREE.Group(); root.scale.setScalar(scale);
  const nuclear = new THREE.Group(); root.add(nuclear);
  const nucleons = scatterNucleons(nuclear, data);
  const orbits = [], electrons = [];
  const shellRadii = [1.85, 2.55, 3.18, 3.72, 4.15, 4.48];
  const colors = [data.tint, '#77d4db', '#b5a0ff', '#e0d1a0', '#a5c3d8', '#c7a8e9'];
  data.shells.forEach((population, shellIndex) => {
    const orbitCount = shellIndex === 0 ? 2 : shellIndex < 3 ? 2 : 3;
    for (let j = 0; j < orbitCount; j++) {
      const phase = shellIndex * 0.63 + j * Math.PI / orbitCount;
      const orbit = makeOrbit(shellRadii[shellIndex], .5 + j * .88 + shellIndex * .21, phase, colors[(shellIndex + j) % colors.length], .035 + .009 * (j % 2));
      root.add(orbit); orbits.push(orbit);
    }
    const electronNumber = Math.min(population, shellIndex === 0 ? 2 : 4);
    for (let i = 0; i < electronNumber; i++) {
      const geo = new THREE.SphereGeometry(.085, 20, 18);
      const mat = new THREE.MeshPhysicalMaterial({ color: 0xd5fdff, roughness: .12, metalness: .12, emissive: data.tint, emissiveIntensity: 1.75, clearcoat: 1 });
      const electron = new THREE.Mesh(geo, mat);
      const halo = new THREE.Mesh(new THREE.SphereGeometry(.15, 16, 12), new THREE.MeshBasicMaterial({ color: data.tint, transparent: true, opacity: .11, blending: THREE.AdditiveBlending, depthWrite: false }));
      electron.add(halo); root.add(electron);
      electrons.push({ mesh: electron, radius: shellRadii[shellIndex], phase: i / electronNumber * Math.PI * 2 + shellIndex * 1.6, speed: (0.72 + shellIndex * .13 + i * .08) * (i % 2 ? -1 : 1), tilt: .5 + (i % orbitCount) * .88 + shellIndex * .21, shellIndex });
    }
  });
  const haloGeo = new THREE.BufferGeometry(); const count = 620, pos = new Float32Array(count * 3), size = new Float32Array(count);
  for (let i=0;i<count;i++) { const r=1.35+Math.random()*3.6, a=Math.random()*Math.PI*2, y=(Math.random()-.5)*2.8; pos[i*3]=Math.cos(a)*r;pos[i*3+1]=y;pos[i*3+2]=Math.sin(a)*r;size[i]=Math.random()*1.5+.3; }
  haloGeo.setAttribute('position',new THREE.BufferAttribute(pos,3));haloGeo.setAttribute('aSize',new THREE.BufferAttribute(size,1));
  const haloMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{uTime:{value:0},uColor:{value:new THREE.Color(data.tint)},uIntensity:{value:.55}},vertexShader:`attribute float aSize;uniform float uTime;varying float vAlpha;void main(){vec3 p=position;p.x+=sin(uTime*.25+position.y*2.0)*.06;vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=aSize*(130.0/-mv.z);vAlpha=.4+.6*sin(uTime*1.5+position.x*8.0)*sin(uTime+position.y*7.0);}`,fragmentShader:`uniform vec3 uColor;uniform float uIntensity;varying float vAlpha;void main(){float d=length(gl_PointCoord-.5);if(d>.5)discard;float a=(1.0-smoothstep(.05,.5,d))*vAlpha*uIntensity;gl_FragColor=vec4(uColor,a);}`,blending:THREE.AdditiveBlending});
  const dust=new THREE.Points(haloGeo,haloMat);root.add(dust);
  return { root, nuclear, nucleons, electrons, orbits, dust, data };
}

export function createAtomScene(container, { hero = false } = {}) {
  const stage = createStage(container, { cameraZ: hero ? 9.6 : 8.5, fov: 36, bloom: hero, background: 0x070b12 });
  stage.scene.fog = new THREE.FogExp2(0x070b12, .012);
  const stars = addStarField(stage.scene, hero ? 850 : 440, 22, '#89aebf');
  const atomGroup = new THREE.Group(); stage.scene.add(atomGroup);
  let currentSymbol = hero ? 'He' : 'He';
  let atom = buildAtom(currentSymbol, hero ? 1.35 : 1.1); atomGroup.add(atom.root);
  const mouse = new THREE.Vector2(), target = new THREE.Vector2();
  let drag = false, last = { x: 0, y: 0 }, rotationSpeed = .6, glow = .72, orbitVisible = true, mode = 0, zoom = 0;
  let savedZ = stage.camera.position.z;
  const canvas = stage.renderer.domElement;
  canvas.addEventListener('pointerdown', e => { drag = true; last = {x:e.clientX,y:e.clientY}; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointerup', () => { drag = false; });
  canvas.addEventListener('pointercancel', () => { drag = false; });
  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    target.set(((e.clientX - rect.left) / rect.width - .5) * 2, -((e.clientY - rect.top) / rect.height - .5) * 2);
    if (drag) { atomGroup.rotation.y += (e.clientX-last.x)*.006; atomGroup.rotation.x += (e.clientY-last.y)*.004; last={x:e.clientX,y:e.clientY}; }
  });
  canvas.addEventListener('pointerleave', () => { if (!drag) target.set(0,0); });
  stage.setUpdater((dt, time) => {
    stars.rotation.y = time * .006;
    atom.root.rotation.y += dt * rotationSpeed * .14;
    atom.nuclear.rotation.y = Math.sin(time * .23) * .12;
    atom.nuclear.rotation.x = Math.cos(time * .19) * .08;
    atom.nucleons.core.material.uniforms.uTime.value = time;
    atom.dust.material.uniforms.uTime.value = time;
    atom.orbits.forEach((orbit, i) => { orbit.material.uniforms.uTime.value = time; orbit.material.uniforms.uGlow.value = glow * (mode ? .4 : 1); orbit.visible = orbitVisible; orbit.rotation.y += dt * (.025 + i * .0007) * rotationSpeed; });
    const q = new THREE.Quaternion();
    atom.electrons.forEach(({mesh,radius,phase,speed,tilt,shellIndex}) => {
      const angle = time * speed * rotationSpeed + phase;
      const pos = new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * .48, Math.sin(angle * .5 + shellIndex) * radius * .12);
      q.setFromEuler(new THREE.Euler(tilt, tilt * .32, tilt * .65)); pos.applyQuaternion(q);
      if (mode) pos.multiplyScalar(1.1 + .04 * Math.sin(time * 2 + phase));
      mesh.position.copy(pos); mesh.material.emissiveIntensity = .8 + glow * 1.5;
      mesh.visible = !mode || Math.sin(time * .65 + phase) > -.72;
    });
    atomGroup.rotation.y += (target.x * .09 - atomGroup.rotation.y) * (drag ? 0 : .018);
    atomGroup.rotation.x += (-target.y * .06 - atomGroup.rotation.x) * (drag ? 0 : .018);
    stage.camera.position.x += (target.x * .18 - stage.camera.position.x) * .012;
    stage.camera.position.y += (target.y * .13 - stage.camera.position.y) * .012;
  });
  function setElement(symbol) {
    if (!elements[symbol] || symbol === currentSymbol) return;
    currentSymbol = symbol;
    atomGroup.remove(atom.root);
    atom.root.traverse(obj => { obj.geometry?.dispose(); if (obj.material) { Array.isArray(obj.material) ? obj.material.forEach(m => m.dispose()) : obj.material.dispose(); } });
    atom = buildAtom(symbol, hero ? 1.35 : 1.1); atom.root.scale.setScalar(0.65); atomGroup.add(atom.root);
    if (window.gsap) window.gsap.to(atom.root.scale, { x: hero ? 1.35 : 1.1, y: hero ? 1.35 : 1.1, z: hero ? 1.35 : 1.1, duration: 1, ease: 'power3.out' });
    else atom.root.scale.setScalar(hero ? 1.35 : 1.1);
    return elements[symbol];
  }
  return {
    ...stage,
    setElement,
    setRotationSpeed(value) { rotationSpeed = Number(value); },
    setGlow(value) { glow = Number(value) / 100; },
    setParticleIntensity(value) { atom.dust.material.uniforms.uIntensity.value = Number(value) / 100; },
    setCameraDistance(value) { savedZ = Number(value); stage.camera.position.z = savedZ - zoom * 3.4; },
    setOrbits(value) { orbitVisible = Boolean(value); },
    toggleMode() { mode = mode ? 0 : 1; return mode; },
    setZoom(value) { zoom = value; stage.camera.position.z = THREE.MathUtils.lerp(savedZ, savedZ - 3.4, zoom); },
    getMode() { return mode; },
  };
}
