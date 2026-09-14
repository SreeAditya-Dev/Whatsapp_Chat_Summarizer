import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export function useLandingMotion(rootRef: React.RefObject<HTMLElement>, enabled: boolean) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const root = rootRef.current;
    if (!root) return;

    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    root.classList.add('js-motion');

    // Buttery smooth scroll
    const lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
    lenisRef.current = lenis;
    lenis.on('scroll', ScrollTrigger.update);
    let raf = 0;
    const loop = (t: number) => {
      lenis.raf(t);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    const ctx = gsap.context(() => {
      // Page-load sequence: nav, headline lines, sub, ctas, phone
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.from('[data-hero="nav"]', { y: -18, opacity: 0, duration: 0.6 })
        .from('[data-hero="line"]', { y: 44, opacity: 0, duration: 0.85, stagger: 0.12 }, '-=0.3')
        .from('[data-hero="sub"]', { y: 20, opacity: 0, duration: 0.6 }, '-=0.45')
        .from('[data-hero="cta"]', { y: 16, opacity: 0, duration: 0.5, stagger: 0.1 }, '-=0.4')
        .from('[data-hero="proof"]', { opacity: 0, duration: 0.6 }, '-=0.3')
        .from('[data-hero="phone"]', { y: 60, opacity: 0, duration: 1 }, '-=0.9');
      // Bubbles mount progressively via CSS (.rl-pop), so no GSAP bubble tween here.

      // Scroll reveals: fade + rise, once each
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.fromTo(
          el,
          { y: 28, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 86%', once: true },
          },
        );
      });

      // Stagger groups
      gsap.utils.toArray<HTMLElement>('[data-reveal-group]').forEach((group) => {
        const kids = group.querySelectorAll('[data-reveal-item]');
        gsap.fromTo(
          kids,
          { y: 24, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.7,
            ease: 'power3.out',
            stagger: 0.1,
            scrollTrigger: { trigger: group, start: 'top 84%', once: true },
          },
        );
      });

      // Thin scroll progress in tick blue
      const bar = root.querySelector('.rl-progress');
      if (bar) {
        gsap.to(bar, {
          scaleX: 1,
          ease: 'none',
          scrollTrigger: { trigger: root, start: 'top top', end: 'bottom bottom', scrub: 0.4 },
        });
      }

      // Scrub: the "pile" section compresses as you scroll through it
      const pile = root.querySelector('[data-pile-track]');
      const pileFill = root.querySelector('[data-pile-fill]');
      if (pile && pileFill) {
        gsap.fromTo(
          pileFill,
          { clipPath: 'inset(0 0 88% 0)', opacity: 0.4 },
          {
            clipPath: 'inset(0 0 0% 0)',
            opacity: 1,
            ease: 'none',
            scrollTrigger: { trigger: pile, start: 'top 80%', end: 'top 30%', scrub: 0.5 },
          },
        );
      }
    }, root);

    const onAnchor = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest('a[href^="#"]') as HTMLAnchorElement | null;
      if (!a) return;
      const id = a.getAttribute('href');
      if (!id || id.length < 2) return;
      const target = root.querySelector(id);
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target as HTMLElement, { offset: -90, duration: 1.4 });
    };
    root.addEventListener('click', onAnchor);

    return () => {
      root.removeEventListener('click', onAnchor);
      ctx.revert();
      cancelAnimationFrame(raf);
      lenis.destroy();
      lenisRef.current = null;
      root.classList.remove('js-motion');
    };
  }, [enabled, rootRef]);

  return lenisRef;
}
