import * as THREE from 'three';
import { createStage, addStarField } from './createStage.js';
import { molecules } from '../data/molecules.js';

const palette = {
  H: { color: 0xcfd8dd, emissive: 0x24343a }, C: { color: 0x75898c, emissive: 0x17292e },
  O: { color: 0xe48372, emissive: 0x421e27 }, N: { color: 0x718ae9, emissive: 0x1d2855 },
};

function buildMolecule(key, mode) {
  const data = molecules[key], group = new THREE.Group();
  const spread = Math.max(...data.atoms.map(atom => new THREE.Vector3(...atom.position).length()));
  const fit = spread > 2.8 ? 2.8 / spread : 1;
  const atomGeometry = new THREE.SphereGeometry(1, 28, 24);
  const bondGeometry = new THREE.CylinderGeometry(1, 1, 1, 12, 1, true);
  const atomMeshes = data.atoms.map(atom => {
    const materialData = palette[atom.element] || palette.C;
    const mesh = new THREE.Mesh(atomGeometry, new THREE.MeshPhysicalMaterial({ color: materialData.color, roughness: .2, metalness: .13, clearcoat: 1, clearcoatRoughness: .13, emissive: materialData.emissive, emissiveIntensity: .42 }));
    mesh.position.fromArray(atom.position).multiplyScalar(fit);
    mesh.userData.element = atom.element;
    group.add(mesh);
    const halo = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: materialData.color, transparent: true, opacity: .08, blending: THREE.AdditiveBlending, depthWrite: false }));
    mesh.add(halo);
    return mesh;
  });
  const bonds = data.bonds.map(([from, to], index) => {
    const start = atomMeshes[from].position, end = atomMeshes[to].position;
    const delta = new THREE.Vector3().subVectors(end, start), length = delta.length();
    const bond = new THREE.Mesh(bondGeometry, new THREE.MeshPhysicalMaterial({ color: 0xa9c2c1, metalness: .6, roughness: .24, transparent: true, opacity: .82, emissive: 0x2a6569, emissiveIntensity: .48 }));
    bond.position.copy(start).add(end).multiplyScalar(.5);
    bond.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize());
    bond.scale.set(.055, length * .83, .055);
    bond.userData.pairIndex = index;
    group.add(bond);
    return bond;
  });
  const applyMode = nextMode => {
    const factor = nextMode === 'space' ? .66 : nextMode === 'bond' ? .23 : nextMode === 'minimal' ? .15 : .36;
    atomMeshes.forEach(mesh => {
      const e = mesh.userData.element;
      mesh.scale.setScalar(factor * (e === 'H' ? .75 : e === 'O' ? 1.06 : 1));
      mesh.visible = nextMode !== 'minimal' || e !== 'H';
      mesh.material.emissiveIntensity = nextMode === 'minimal' ? .12 : .42;
    });
    bonds.forEach((bond, i) => {
      bond.visible = nextMode !== 'space';
      bond.scale.x = bond.scale.z = nextMode === 'minimal' ? .032 : nextMode === 'bond' ? .1 : .055;
      bond.material.opacity = nextMode === 'bond' ? 1 : nextMode === 'minimal' ? .36 : .82;
      if (data.formula.startsWith('O<sub>2')) bond.scale.x = bond.scale.z = nextMode === 'bond' ? .12 : .055;
    });
  };
  applyMode(mode);
  const groupShell = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 28), new THREE.MeshBasicMaterial({ color: 0x8fd9d2, wireframe: true, transparent: true, opacity: .035, depthWrite: false }));
  groupShell.scale.setScalar(Math.max(1.45, spread * fit + .55)); group.add(groupShell);
  return { group, data, atomMeshes, applyMode, shell: groupShell };
}

export function createMoleculeScene(container) {
  const stage = createStage(container, { cameraZ: 7.7, fov: 38, bloom: true, background: 0x0b0e17 });
  stage.scene.fog = new THREE.FogExp2(0x0b0e17, .018);
  const stars = addStarField(stage.scene, 420, 17, '#a5a5d3');
  const group = new THREE.Group(); stage.scene.add(group);
  let currentKey = 'water', mode = 'ball', molecule = buildMolecule(currentKey, mode);
  group.add(molecule.group);
  let targetX = 0, targetY = 0, dragging = false, previous = { x: 0, y: 0 };
  const canvas = stage.renderer.domElement;
  canvas.addEventListener('pointerdown', e => { dragging = true; previous = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointerup', () => dragging = false);
  canvas.addEventListener('pointercancel', () => dragging = false);
  canvas.addEventListener('pointermove', e => {
    if (dragging) { group.rotation.y += (e.clientX - previous.x) * .008; group.rotation.x += (e.clientY - previous.y) * .006; previous = { x: e.clientX, y: e.clientY }; }
  });
  stage.setUpdater((dt, time) => {
    stars.rotation.y = time * .004;
    if (!dragging) group.rotation.y += dt * .065;
    molecule.group.position.y = Math.sin(time * .45) * .08;
    molecule.shell.rotation.set(time * .035, time * .055, time * -.025);
  });
  function setMolecule(key) {
    if (!molecules[key] || key === currentKey) return molecules[key];
    currentKey = key;
    group.remove(molecule.group);
    molecule.group.traverse(obj => { if (obj !== molecule.group) { obj.geometry?.dispose(); if (obj.material) Array.isArray(obj.material) ? obj.material.forEach(m=>m.dispose()) : obj.material.dispose(); } });
    molecule = buildMolecule(key, mode);
    molecule.group.scale.setScalar(.3); group.add(molecule.group);
    const maxSpread = Math.max(...molecule.data.atoms.map(atom => new THREE.Vector3(...atom.position).length()));
    const nextZ = maxSpread > 2.2 ? 9.2 : 7.7;
    if (window.gsap) {
      window.gsap.to(molecule.group.scale, { x: 1, y: 1, z: 1, duration: .95, ease: 'power3.out' });
      window.gsap.to(stage.camera.position, { z: nextZ, duration: 1.15, ease: 'power2.inOut' });
    } else { molecule.group.scale.setScalar(1); stage.camera.position.z = nextZ; }
    return molecule.data;
  }
  function setMode(nextMode) { mode = nextMode; molecule.applyMode(mode); }
  return { ...stage, setMolecule, setMode, getMode: () => mode };
}
