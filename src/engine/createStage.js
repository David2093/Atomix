import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

export function createStage(container, { fov = 36, cameraZ = 8, bloom = false, background = 0x000000 } = {}) {
  container.dataset.sceneStatus = 'waiting';
  const scene = new THREE.Scene();
  scene.background = null;
  scene.fog = new THREE.FogExp2(background, 0.024);
  const camera = new THREE.PerspectiveCamera(fov, 1, 0.1, 100);
  camera.position.set(0, 0, cameraZ);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  const pixelRatioCap = () => window.innerWidth < 700 ? 1.1 : window.innerWidth > 1900 ? 1.2 : 1.45;
  const getPixelRatio = () => Math.min(window.devicePixelRatio || 1, pixelRatioCap());
  renderer.setPixelRatio(getPixelRatio());
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);
  let composer = null;
  if (bloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.8, 0.55, 0.18));
  }
  const ambient = new THREE.HemisphereLight(0xc6e3ff, 0x12141a, 1.1);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xd5f2ff, 2.2); key.position.set(4, 5, 6); scene.add(key);
  const rim = new THREE.PointLight(0x42d9df, 18, 16, 2); rim.position.set(-4, 1, -2); scene.add(rim);
  const violet = new THREE.PointLight(0x836bff, 10, 16, 2); violet.position.set(4, -2, 1); scene.add(violet);
  let visible = false, disposed = false, renderFailed = false, raf = 0, quality = 'AUTO';
  let lastTime = 0, lowFrames = 0, highFrames = 0, adaptiveScale = 1;
  const clock = new THREE.Clock();
  const resize = () => {
    const width = Math.max(container.clientWidth, 1), height = Math.max(container.clientHeight, 1);
    camera.aspect = width / height; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (composer) composer.setSize(width, height);
  };
  const resizeObserver = new ResizeObserver(resize); resizeObserver.observe(container); resize();
  const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible && !raf && !renderFailed) loop(); });
  intersection.observe(container);
  let update = () => {};
  const loop = () => {
    if (disposed || !visible || renderFailed) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    const delta = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    if (quality === 'AUTO') {
      if (lastTime && delta > 0.028) { lowFrames++; highFrames = 0; } else { highFrames++; lowFrames = Math.max(0, lowFrames - 1); }
      if (lowFrames > 80 && adaptiveScale > 0.65) { adaptiveScale = Math.max(0.65, adaptiveScale - 0.15); renderer.setPixelRatio(getPixelRatio() * adaptiveScale); if (composer) composer.setPixelRatio(renderer.getPixelRatio()); lowFrames = 0; }
      if (highFrames > 500 && adaptiveScale < 1) { adaptiveScale = Math.min(1, adaptiveScale + 0.1); renderer.setPixelRatio(getPixelRatio() * adaptiveScale); if (composer) composer.setPixelRatio(renderer.getPixelRatio()); highFrames = 0; }
    }
    lastTime = delta;
    try {
      update(delta, time);
      if (composer) composer.render(); else renderer.render(scene, camera);
      container.dataset.sceneStatus = 'live';
    } catch (error) {
      renderFailed = true;
      container.dataset.sceneStatus = 'error';
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      console.error('ATOMIX 3D scene stopped rendering; showing its static fallback.', error);
    }
  };
  const handleContextLost = event => {
    event.preventDefault();
    renderFailed = true;
    container.dataset.sceneStatus = 'error';
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const handleContextRestored = () => {
    renderFailed = false;
    container.dataset.sceneStatus = 'waiting';
    resize();
    if (visible && !raf) loop();
  };
  renderer.domElement.addEventListener('webglcontextlost', handleContextLost, false);
  renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);
  return {
    scene, camera, renderer, get time() { return clock.elapsedTime; },
    setUpdater(fn) { update = fn; },
    setQuality(value) {
      quality = value;
      const factor = value === 'LOW' ? 0.7 : value === 'MEDIUM' ? 1 : value === 'HIGH' ? 1.2 : 1;
      renderer.setPixelRatio(getPixelRatio() * factor);
      if (composer) composer.setPixelRatio(renderer.getPixelRatio());
      adaptiveScale = 1;
    },
    dispose() { disposed = true; cancelAnimationFrame(raf); intersection.disconnect(); resizeObserver.disconnect(); renderer.domElement.removeEventListener('webglcontextlost', handleContextLost); renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored); renderer.dispose(); composer?.dispose(); },
  };
}

export function addStarField(scene, count = 620, radius = 20, color = '#8bb8ce') {
  const positions = new Float32Array(count * 3), sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const r = radius * (0.35 + Math.random() * 0.65), theta = Math.random() * Math.PI * 2, phi = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
    sizes[i] = Math.random() * 1.7 + 0.4;
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(positions, 3)); geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, uniforms: { uColor: { value: new THREE.Color(color) } }, vertexShader: `attribute float aSize; varying float vSize; void main(){vSize=aSize; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=aSize*(180.0/-mv.z);}`, fragmentShader: `uniform vec3 uColor; varying float vSize; void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;float a=smoothstep(.5,.02,d)*.55;gl_FragColor=vec4(uColor,a);}` });
  const stars = new THREE.Points(geo, mat); scene.add(stars); return stars;
}
