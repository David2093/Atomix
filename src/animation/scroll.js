import Lenis from '@studio-freight/lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function initScrollExperience() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lenis = reduced ? null : new Lenis({ duration: 1.15, smoothWheel: true, wheelMultiplier: .9, touchMultiplier: 1.2 });
  const updateScroll = () => ScrollTrigger.update();
  const raf = lenis ? time => lenis.raf(time * 1000) : null;

  if (lenis) {
    lenis.on('scroll', updateScroll);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);
  }

  const context = gsap.context(() => {
    document.querySelectorAll('.section:not(.hero) .eyebrow,.section:not(.hero) h2,.section:not(.hero) .section-top,.section:not(.hero) .intro-body,.lab-shell,.molecule-layout,.quantum-stage,.discovery-card').forEach((element, index) => {
      gsap.fromTo(element, { y: 24, opacity: 0 }, {
        y: 0,
        opacity: 1,
        duration: .85,
        ease: 'power3.out',
        delay: index % 4 * .035,
        scrollTrigger: { trigger: element, start: 'top 88%', once: true },
      });
    });

    const navLinks = [...document.querySelectorAll('.desktop-nav .nav-link')];
    const sections = ['home', 'lab', 'molecules', 'quantum', 'about'].map(id => document.getElementById(id)).filter(Boolean);
    sections.forEach(section => {
      ScrollTrigger.create({
        trigger: section,
        start: 'top 45%',
        end: 'bottom 45%',
        onToggle: self => {
          if (!self.isActive) return;
          const target = section.id === 'about' ? 'about' : section.id;
          navLinks.forEach(link => link.classList.toggle('is-active', link.getAttribute('href') === `#${target}`));
        },
      });
    });
  });

  return {
    lenis,
    gsap,
    ScrollTrigger,
    destroy() {
      context.revert();
      if (!lenis) return;
      lenis.off('scroll', updateScroll);
      lenis.destroy();
      gsap.ticker.remove(raf);
      gsap.ticker.lagSmoothing(500, 33);
    },
  };
}
