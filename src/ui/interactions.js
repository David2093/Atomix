import { elements } from '../data/elements.js';
import { molecules } from '../data/molecules.js';
import { moleculeFallback } from './moleculeFallback.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const number = value => String(value).padStart(2, '0');

function updateRange(input) {
  if (!input) return;
  const min = Number(input.min) || 0, max = Number(input.max) || 100, value = Number(input.value);
  const percentage = ((value - min) / (max - min)) * 100;
  input.style.background = `linear-gradient(90deg,var(--cyan) 0 ${percentage}%,#323944 ${percentage}% 100%)`;
}

export function initInteractions({ hero, lab, molecule, quantum, gsap, lenis }) {
  const allStages = [hero, lab, molecule, quantum];
  $('#quality-select')?.addEventListener('change', event => allStages.forEach(stage => stage.setQuality(event.target.value)));

  const menuButton = $('.menu-toggle'), mobileNav = $('.mobile-nav');
  menuButton?.addEventListener('click', () => {
    const open = menuButton.getAttribute('aria-expanded') !== 'true';
    menuButton.setAttribute('aria-expanded', String(open)); mobileNav?.classList.toggle('is-open', open);
    mobileNav?.setAttribute('aria-hidden', String(!open)); document.body.classList.toggle('menu-open', open);
  });
  $$('.mobile-nav a').forEach(link => link.addEventListener('click', () => {
    menuButton?.setAttribute('aria-expanded', 'false'); mobileNav?.classList.remove('is-open'); mobileNav?.setAttribute('aria-hidden', 'true'); document.body.classList.remove('menu-open');
  }));

  const setElement = symbol => {
    const data = lab.setElement(symbol); if (!data) return;
    $$('.element-option').forEach(button => { const selected = button.dataset.element === symbol; button.classList.toggle('is-selected', selected); button.setAttribute('aria-selected', String(selected)); });
    $('#element-name').textContent = data.name.toUpperCase(); $('#element-description').textContent = data.note;
    $('#atomic-number').textContent = number(data.number); $('#atomic-mass').innerHTML = `${data.mass} <small>u</small>`;
    $('#protons').textContent = number(data.protons); $('#neutrons').textContent = number(data.neutrons); $('#electrons').textContent = number(data.number);
    $('#configuration').textContent = data.config; $('.element-charge').textContent = `+${data.number}`;
  };
  $$('.element-option').forEach(button => button.addEventListener('click', () => setElement(button.dataset.element)));

  const bindRange = (id, output, formatter, callback) => {
    const input = $(`#${id}`); if (!input) return;
    const update = () => { updateRange(input); if (output) $(`#${output}`).textContent = formatter(Number(input.value)); callback(Number(input.value)); };
    input.addEventListener('input', update); update();
  };
  bindRange('rotation-speed','rotation-output',value=>`${value.toFixed(1)}×`,value=>lab.setRotationSpeed(value));
  bindRange('glow-intensity','glow-output',value=>`${value}%`,value=>lab.setGlow(value));
  bindRange('particle-intensity','particle-output',value=>`${value}%`,value=>lab.setParticleIntensity(value));
  bindRange('camera-distance','distance-output',value=>value.toFixed(1),value=>lab.setCameraDistance(value));
  const orbitToggle = $('#orbital-toggle');
  orbitToggle?.addEventListener('click', () => { const enabled = orbitToggle.getAttribute('aria-checked') !== 'true'; orbitToggle.setAttribute('aria-checked', String(enabled)); orbitToggle.classList.toggle('is-on', enabled); lab.setOrbits(enabled); });
  $('#visualization-mode')?.addEventListener('click', event => {
    const mode = lab.toggleMode(); const button = event.currentTarget;
    button.innerHTML = mode ? 'PARTICLE VIEW <span>↗</span>' : 'FIELD VIEW <span>↔</span>';
    button.classList.toggle('is-current', Boolean(mode));
  });

  let activeMolecule = 'water';
  const updateMolecule = key => {
    const data = molecule.setMolecule(key); if (!data) return;
    const fallback = $('.molecule-fallback'); if (fallback) fallback.outerHTML = moleculeFallback(data);
    activeMolecule = key;
    $$('.molecule-picker button').forEach(button => button.classList.toggle('is-active', button.dataset.molecule === key));
    const index = Object.keys(molecules).indexOf(key) + 1;
    $('#molecule-number').textContent = `${number(index)} / 06`; $('#molecule-name').textContent = data.name;
    $('#molecule-formula').innerHTML = data.formula; $('#molecule-short-name').textContent = data.name.toUpperCase();
    $('#molecule-angle').textContent = data.geometry; $('#molecule-description').textContent = data.description;
    $('#molecule-composition').textContent = data.composition; $('#molecule-mass').innerHTML = `${data.mass} <small>g/mol</small>`;
  };
  $$('.molecule-picker button').forEach(button => button.addEventListener('click', () => updateMolecule(button.dataset.molecule)));
  $$('.view-modes button').forEach(button => button.addEventListener('click', () => {
    molecule.setMode(button.dataset.mode); $$('.view-modes button').forEach(item => item.classList.toggle('is-active', item === button));
  }));

  const setPreset = key => {
    quantum.setPreset(key);
    $$('[data-preset]').forEach(button => button.classList.toggle('is-active', button.dataset.preset === key));
  };
  $$('[data-preset]').forEach(button => button.addEventListener('click', () => setPreset(button.dataset.preset)));
  bindRange('particle-count','count-output',value=>Math.round(value).toLocaleString('en-US'),value=>{
    const count = quantum.setCount(value); $('#particle-readout').textContent = `${count.toLocaleString('en-US')} PARTICLES`;
  });
  bindRange('field-strength','strength-output',value=>`${value}%`,value=>quantum.setStrength(value));
  bindRange('movement-speed','speed-output',value=>`${(value/10).toFixed(1)}×`,value=>quantum.setSpeed(value/10));
  bindRange('attraction-force','attraction-output',value=>`${value}%`,value=>quantum.setAttraction(value));
  bindRange('repulsion-force','repulsion-output',value=>`${value}%`,value=>quantum.setRepulsion(value));
  bindRange('particle-glow','particle-glow-output',value=>`${value}%`,value=>quantum.setGlow(value));

  const explore = $('#explore-atom');
  explore?.addEventListener('click', () => {
    gsap.to(hero.camera.position, { z: 5.3, duration: 1.45, ease: 'power3.inOut', onComplete: () => {
      window.setTimeout(() => { if (lenis) lenis.scrollTo('#lab', { duration: 1.2 }); else document.querySelector('#lab').scrollIntoView({ behavior: 'smooth' }); }, 350);
    } });
  });

  $('.card-quantum')?.addEventListener('click',()=>setPreset('cloud'));
  $('.card-energy')?.addEventListener('click',()=>setPreset('magnetic'));
  $('.card-particle')?.addEventListener('click',()=>setPreset('collision'));
  $('.card-cosmos')?.addEventListener('click',()=>setPreset('galaxy'));
  $('.card-molecule')?.addEventListener('click',()=>updateMolecule('glucose'));

  const cursor = $('.custom-cursor');
  if (cursor && matchMedia('(pointer:fine)').matches) {
    window.addEventListener('pointermove', event => { cursor.style.left = `${event.clientX}px`; cursor.style.top = `${event.clientY}px`; cursor.classList.add('is-visible'); document.documentElement.classList.add('custom-cursor-active'); }, { passive: true });
    window.addEventListener('pointerout', event => { if (!event.relatedTarget) { cursor.classList.remove('is-visible'); document.documentElement.classList.remove('custom-cursor-active'); } });
    $$('a,button,input,select').forEach(el => { el.addEventListener('pointerenter',()=>cursor.classList.add('is-hover')); el.addEventListener('pointerleave',()=>cursor.classList.remove('is-hover')); });
  }
  return { setElement, updateMolecule, setPreset };
}
