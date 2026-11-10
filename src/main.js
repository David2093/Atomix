import './styles/main.css';
import { createAtomScene } from './engine/atomScene.js';
import { createMoleculeScene } from './engine/moleculeScene.js';
import { createQuantumScene } from './engine/quantumScene.js';
import { initScrollExperience } from './animation/scroll.js';
import { initInteractions } from './ui/interactions.js';

const { lenis, gsap } = initScrollExperience();
window.gsap = gsap;

const hero = createAtomScene(document.querySelector('#hero-scene'), { hero: true });
const lab = createAtomScene(document.querySelector('#lab-scene'));
const molecule = createMoleculeScene(document.querySelector('#molecule-scene'));
const quantum = createQuantumScene(document.querySelector('#quantum-scene'));
initInteractions({ hero, lab, molecule, quantum, gsap, lenis });

window.addEventListener('pagehide', () => [hero, lab, molecule, quantum].forEach(stage => stage.dispose()), { once: true });
