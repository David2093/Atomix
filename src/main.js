import './styles/main.css';
import { createAtomScene } from './engine/atomScene.js';
import { createMoleculeScene } from './engine/moleculeScene.js';
import { createQuantumScene } from './engine/quantumScene.js';
import { initScrollExperience } from './animation/scroll.js';
import { initInteractions } from './ui/interactions.js';
import { initPlatform } from './platform.js';

const homePage = document.querySelector('#home-page');
if (location.pathname === '/' || location.pathname === '/index.html') {
  const scrollExperience = initScrollExperience();
  const { lenis, gsap } = scrollExperience;
  window.gsap = gsap;
  const hero = createAtomScene(document.querySelector('#hero-scene'), { hero: true });
  const lab = createAtomScene(document.querySelector('#lab-scene'));
  const molecule = createMoleculeScene(document.querySelector('#molecule-scene'));
  const quantum = createQuantumScene(document.querySelector('#quantum-scene'));
  const homeStages = [hero, lab, molecule, quantum];
  initInteractions({ hero, lab, molecule, quantum, gsap, lenis });
  let homeDisposed = false;
  const disposeHome = () => {
    if (homeDisposed) return;
    homeDisposed = true;
    homeStages.forEach(stage => stage.dispose());
    scrollExperience.destroy();
  };
  window.addEventListener('atomix:subpage', disposeHome, { once: true });
  window.addEventListener('pagehide', disposeHome, { once: true });
} else if (homePage) {
  homePage.hidden = true;
}

initPlatform();
