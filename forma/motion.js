/* FORMA motion layer: GSAP (ScrollTrigger, SplitText, Flip) + Lenis.
   Purely presentational. app.js works without this file; every state it hides is restored if a library is missing. */
(() => {
  'use strict';
  const root = document.documentElement;
  const header = document.querySelector('.header');
  const menu = document.querySelector('.menu-toggle');
  const $$ = (q, scope = document) => Array.from(scope.querySelectorAll(q));
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menuOpen = () => menu && menu.getAttribute('aria-expanded') === 'true';

  function plainHeader() {
    const update = () => header.classList.toggle('is-scrolled', window.scrollY > 24);
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  if (reduced || !window.gsap || !window.ScrollTrigger) {
    root.classList.remove('motion');
    window.__formaMotion = true;
    if (header) plainHeader();
    return;
  }

  const { gsap, ScrollTrigger, SplitText, Flip, Lenis } = window;
  gsap.registerPlugin(...[ScrollTrigger, SplitText, Flip].filter(Boolean));
  gsap.defaults({ ease: 'power3.out', duration: 0.9 });

  /* Smooth scroll */
  let lenis = null;
  if (Lenis) {
    lenis = new Lenis({ lerp: 0.11, wheelMultiplier: 1, anchors: { offset: -12 } });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    if (menu) new MutationObserver(() => (menuOpen() ? lenis.stop() : lenis.start())).observe(menu, { attributes: true, attributeFilter: ['aria-expanded'] });
  }

  /* Hand the initial hidden states from CSS over to GSAP in one frame */
  const reveals = $$('[data-reveal]');
  const heroFades = $$('[data-hero-fade]');
  const heroFrames = $$('[data-hero-frame]');
  const covers = $$('[data-img-reveal]');
  const splits = $$('[data-split]');
  const hidden = 'inset(0% 0% 100% 0%)';
  const shown = 'inset(0% 0% 0% 0%)';
  gsap.set(reveals, { opacity: 0, y: 30 });
  gsap.set(heroFades, { opacity: 0, y: 22 });
  gsap.set([...heroFrames, ...covers], { clipPath: hidden });
  gsap.set(splits, { visibility: 'hidden' });
  root.classList.remove('motion');
  window.__formaMotion = true;

  /* Header: tint after the first screen edge, slide away on the way down */
  ScrollTrigger.create({
    start: 0,
    end: 'max',
    onUpdate(self) {
      const y = self.scroll();
      header.classList.toggle('is-scrolled', y > 24);
      header.classList.toggle('is-hidden', !menuOpen() && self.direction === 1 && y > 500);
    }
  });

  /* Headlines: line-by-line mask reveal */
  function splitHeading(el, onReady) {
    if (!SplitText) { gsap.set(el, { visibility: 'visible' }); return; }
    SplitText.create(el, {
      type: 'lines',
      mask: 'lines',
      linesClass: 'split-line',
      autoSplit: true,
      onSplit(self) {
        gsap.set(el, { visibility: 'visible' });
        return onReady(self.lines);
      }
    });
  }

  const fontsReady = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  fontsReady.then(() => {
    splits.forEach((el) => {
      if (el.dataset.split === 'hero') return;
      splitHeading(el, (lines) => gsap.from(lines, {
        yPercent: 108,
        duration: 1.15,
        ease: 'expo.out',
        stagger: 0.09,
        scrollTrigger: { trigger: el, start: 'top 88%', once: true }
      }));
    });

    /* Hero intro */
    const heroTitle = document.querySelector('[data-split="hero"]');
    const intro = gsap.timeline({ delay: 0.1 });
    let played = false;
    if (heroTitle) {
      splitHeading(heroTitle, (lines) => {
        if (played) return gsap.set(lines, { yPercent: 0 });
        played = true;
        return intro.from(lines, { yPercent: 108, duration: 1.25, ease: 'expo.out', stagger: 0.11 }, 0);
      });
    }
    intro
      .to(heroFades, { opacity: 1, y: 0, duration: 0.9, stagger: 0.07 }, 0.35)
      .to(heroFrames, { clipPath: shown, duration: 1.35, ease: 'expo.out', stagger: 0.12, clearProps: 'clipPath' }, 0.3)
      .from(heroFrames.map((f) => f.querySelector('.frame-media')), { scale: 1.24, duration: 1.9, ease: 'expo.out', stagger: 0.12 }, 0.3)
      .from('.header-inner > *', { y: -16, opacity: 0, duration: 0.8, stagger: 0.06, clearProps: 'all' }, 0.2);
    ScrollTrigger.refresh();
  });

  /* Generic fade-up, batched so neighbours stagger */
  ScrollTrigger.batch(reveals, {
    start: 'top 90%',
    once: true,
    onEnter: (els) => {
      /* After a jump (anchor, restored scroll) skip what is already above the viewport so visible blocks do not queue behind it */
      const passed = els.filter((el) => el.getBoundingClientRect().bottom < 0);
      const entering = els.filter((el) => !passed.includes(el));
      if (passed.length) gsap.set(passed, { opacity: 1, y: 0, clearProps: 'transform' });
      if (entering.length) gsap.to(entering, { opacity: 1, y: 0, duration: 1, stagger: 0.09, overwrite: true, clearProps: 'transform' });
    }
  });

  /* Agent covers: curtain reveal with a settling image */
  covers.forEach((cover) => {
    const img = cover.querySelector('img');
    gsap.timeline({ scrollTrigger: { trigger: cover, start: 'top 92%', once: true } })
      .to(cover, { clipPath: shown, duration: 1.3, ease: 'expo.out', clearProps: 'clipPath' })
      .from(img, { scale: 1.22, duration: 1.8, ease: 'expo.out', clearProps: 'all' }, 0);
  });

  /* Parallax inside frames */
  $$('[data-parallax]').forEach((frame) => {
    const media = frame.querySelector('.frame-media');
    if (!media) return;
    gsap.fromTo(media, { yPercent: -4.5 }, {
      yPercent: 4.5,
      ease: 'none',
      scrollTrigger: { trigger: frame, start: 'top bottom', end: 'bottom top', scrub: true }
    });
  });

  /* Workflow: rules draw in, rows follow */
  $$('.steps li').forEach((row) => {
    gsap.timeline({ scrollTrigger: { trigger: row, start: 'top 90%', once: true } })
      .fromTo(row, { '--p': 0 }, { '--p': 1, duration: 1.3, ease: 'expo.out' })
      .from(row.children, { opacity: 0, y: 24, duration: 0.9, stagger: 0.07, clearProps: 'all' }, 0.1);
  });

  /* Footer wordmark rises from below */
  const word = document.querySelector('.footer-word span');
  if (word) gsap.from(word, { yPercent: 38, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });

  /* Catalogue filter: animate the regrouping with Flip */
  const filters = document.querySelector('.filters');
  const cards = $$('.agent-card');
  if (filters && Flip) {
    let state = null;
    filters.addEventListener('click', (event) => {
      if (!event.target.closest('.filter')) return;
      gsap.killTweensOf(cards);
      gsap.set(cards, { clearProps: 'opacity,transform' });
      covers.forEach((c) => { gsap.killTweensOf(c); gsap.set(c, { clearProps: 'clipPath' }); });
      state = Flip.getState(cards);
    }, true);
    filters.addEventListener('click', () => {
      if (!state) return;
      Flip.from(state, {
        duration: 0.75,
        ease: 'power3.inOut',
        nested: true,
        onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.6, delay: 0.2, stagger: 0.06, clearProps: 'transform' }),
        onComplete: () => { gsap.set(cards, { clearProps: 'width,height,transform' }); ScrollTrigger.refresh(); }
      });
      state = null;
    });
  }

  /* Pricing: count between monthly and yearly numbers */
  const format = new Intl.NumberFormat('ru-RU');
  $$('.billing-toggle button').forEach((button) => button.addEventListener('click', () => {
    $$('.price > span:first-child').forEach((el) => {
      const to = Number(el.dataset[button.dataset.billing]);
      const from = Number(el.dataset.shown || el.dataset.month);
      el.dataset.shown = String(to);
      if (from === to) return;
      const counter = { value: from };
      gsap.to(counter, { value: to, duration: 0.7, ease: 'power2.out', overwrite: true, onUpdate() { el.textContent = format.format(Math.round(counter.value)); } });
    });
  }));

  /* Configurator preview: soften the cover swap */
  const previewArt = document.querySelector('#preview-art img');
  if (previewArt) new MutationObserver(() => gsap.fromTo(previewArt, { opacity: 0, scale: 1.06 }, { opacity: 1, scale: 1, duration: 0.7, clearProps: 'transform' })).observe(previewArt, { attributes: true, attributeFilter: ['src'] });

  window.addEventListener('load', () => ScrollTrigger.refresh());
})();
