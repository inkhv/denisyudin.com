/* Один общий WebGLRenderer на страницу.
   Сцены живут в «окнах» — элементах .gl-host с data-gl="<сцена>" и data-view="<ракурс>".
   Canvas переносится в то окно, которое сейчас больше всего видно на экране; остальные окна
   показывают свои постеры. Вне экрана и во скрытой вкладке рендер стоит на паузе.
   Окно с data-arrive="N" сначала проигрывает пролёт камеры по «линии пера» к узлу главы N. */
import { LinearSRGBColorSpace, Vector3, WebGLRenderer } from 'three';
import { DPR_CAP, detectTier, fpsProbe } from './quality.js';
import { createLoupe } from './loupe.js';

const LOADERS = {
  hero: () => import('./scenes/hero.js'),
  lobule: () => import('./scenes/lobule.js'),
  cycle: () => import('./scenes/cycle.js'),
  rail: () => import('./scenes/rail.js'),
  targets: () => import('./scenes/targets.js')
};

export function createEngine(opts = {}) {
  const tier = opts.tier || detectTier();
  const onFail = opts.onFail || (() => {});
  const canvas = document.createElement('canvas');
  canvas.className = 'gl-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: tier === 'high', alpha: false, stencil: false, powerPreference: 'default', preserveDrawingBuffer: !!opts.preserve });
  } catch (e) { onFail('nogl', e); return null; }
  renderer.outputColorSpace = LinearSRGBColorSpace;
  renderer.setClearColor(0x0B1220, 1);

  let dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP[tier]);
  let failed = false, raf = 0, last = 0, clock = 0;
  const ctx = { tier, speed: 1, renderer };
  const instances = new Map();
  const pending = new Map();
  const vis = new Map();
  let host = null, inst = null, instName = '', seq = null;
  let lastNode = null, routeToken = 0;
  const stats = { tier, dpr, fps: [], frames: 0, downgrades: 0 };

  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); fail('lost'); });
  function fail(why) {
    if (failed) return;
    failed = true; stop();
    document.querySelectorAll('.gl-host').forEach((h) => h.classList.remove('gl-on'));
    canvas.remove();
    onFail(why);
  }

  /* ---------------------------------------------------------- instances */
  function getInstance(name) {
    let rec = instances.get(name);
    if (!rec) {
      rec = { inst: null, promise: null };
      rec.promise = LOADERS[name]().then((mod) => {
        rec.inst = mod.create(ctx);
        const st = pending.get(name);
        if (st) rec.inst.setState({ ...st, instant: true });
        return rec.inst;
      });
      instances.set(name, rec);
    }
    return rec.promise;
  }
  function setState(name, patch) {
    pending.set(name, { ...(pending.get(name) || {}), ...patch });
    const rec = instances.get(name);
    if (rec && rec.inst) rec.inst.setState(patch);
  }
  /* освободить сцены, которые не нужны текущей главе */
  let wanted = null;
  function retain(names) { wanted = names; sweep(); }
  function sweep() {
    if (!wanted) return;
    instances.forEach((rec, name) => {
      if (wanted.includes(name) || name === instName || !rec.inst) return;
      rec.inst.dispose();
      instances.delete(name);
    });
  }

  /* ---------------------------------------------------------- host selection */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => vis.set(en.target, en.isIntersecting ? en.intersectionRect.height * en.intersectionRect.width : 0));
    pick();
  }, { threshold: [0, 0.05, 0.2, 0.4, 0.6, 0.8, 1] });
  function register(el) { if (!vis.has(el)) { vis.set(el, 0); io.observe(el); } }
  let forced = null;
  function pick() {
    if (failed || forced) return;
    let best = null, bestA = 0;
    vis.forEach((a, el) => {
      if (a > bestA && el.getClientRects().length && getComputedStyle(el).getPropertyValue('--gl-skip').trim() !== '1') { best = el; bestA = a; }
    });
    if (bestA < 3000) best = null;
    if (best !== host) attach(best);
  }

  async function attach(el) {
    if (host) host.classList.remove('gl-on', 'gl-active');
    host = el; inst = null; instName = '';
    if (!el) { stop(); return; }
    el.classList.add('gl-active');
    let name = el.dataset.gl, view = el.dataset.view || 'window';
    seq = null;
    const arrive = el.dataset.arrive;
    if (arrive != null && el._arrived !== routeToken && !opts.noArrive) {
      // пролёт по рельсу к узлу главы, затем — сцена главы
      seq = { then: name === 'rail' && view === 'node' ? null : { name, view }, node: +arrive };
      name = 'rail'; view = 'arrive';
      setState('rail', { from: lastNode == null ? Math.max(0, +arrive - 1) : lastNode, to: +arrive });
    }
    const i = await getInstance(name);
    if (host !== el || failed) return;
    use(el, name, i, view);
  }
  function use(el, name, i, view) {
    inst = i; instName = name;
    sweep();
    const lay = el.querySelector('.gl-labels');
    if (lay) el.insertBefore(canvas, lay); else el.appendChild(canvas);
    let st = null;
    try { st = el.dataset.state ? JSON.parse(el.dataset.state) : null; } catch (e) { st = null; }
    if (st) i.setState(st);
    i.setView(view, { cut: true });
    resize();
    buildLabels(el, i, name);
    if (el.hasAttribute('data-loupe') && tier !== 'low' && !el._loupe) el._loupe = createLoupe(el);
    refocus();
    start();
  }
  function finishArrival() {
    const el = host, s = seq;
    seq = null;
    if (!el) return;
    el._arrived = routeToken;
    lastNode = s.node;
    if (!s.then) { inst.setView('node'); return; }
    if (s.then.name === instName) { inst.setView(s.then.view); return; }
    getInstance(s.then.name).then((i) => { if (host === el && !failed) use(el, s.then.name, i, s.then.view); });
  }

  /* ---------------------------------------------------------- labels (HTML поверх canvas) */
  const V = new Vector3();
  function buildLabels(el, i, name) {
    const lay = el.querySelector('.gl-labels');
    if (!lay) return;
    if (lay.dataset.scene === name) return;
    lay.dataset.scene = name;
    lay.textContent = '';
    (i.labels || []).forEach((l) => {
      const s = document.createElement('span');
      s.className = 'gl-label' + (l.tone ? ' t-' + l.tone : '') + (l.align ? ' a-' + l.align : '');
      s.textContent = l.text;
      l._el = l._el || new WeakMap();
      l._el.set(lay, s);
      lay.appendChild(s);
    });
  }
  function updateLabels() {
    const lay = host && host.querySelector('.gl-labels');
    if (!lay || lay.dataset.scene !== instName || !inst.labels) return;
    const w = host.clientWidth, h = host.clientHeight;
    const boxes = [];
    inst.labels.forEach((l) => {
      const s = l._el && l._el.get(lay);
      if (!s) return;
      const on = inst.labelVisible ? inst.labelVisible(l) : true;
      V.copy(l.at).project(inst.camera);
      const x = (V.x + 1) / 2 * w, y = (1 - V.y) / 2 * h;
      if (!s._w) s._w = s.offsetWidth || l.text.length * 7.4 + 12;
      const x0 = l.align === 'end' ? x - s._w : x, x1 = x0 + s._w;
      let inside = on && V.z < 1 && x0 > 4 && x1 < w - 4 && y > 10 && y < h - 8;
      // подписи не наезжают друг на друга: при пересечении остаётся первая по списку
      if (inside && boxes.some((b) => x0 < b[2] && x1 > b[0] && Math.abs(y - b[1]) < 17)) inside = false;
      if (inside) boxes.push([x0, y, x1]);
      s.classList.toggle('on', inside);
      if (inside) s.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)` + (l.align === 'end' ? ' translateX(-100%)' : '');
    });
  }

  /* ---------------------------------------------------------- size, focus, pointer */
  function resize() {
    if (!host || !inst) return;
    const w = Math.max(1, host.clientWidth), h = Math.max(1, host.clientHeight);
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    const fr = opts.frameFor ? opts.frameFor(host, w / h) : [0, 0];
    inst.resize(w, h, fr[0], fr[1]);
  }
  const ro = new ResizeObserver(() => resize());
  let roHost = null;
  function watchSize() { if (roHost !== host) { if (roHost) ro.unobserve(roHost); roHost = host; if (host) ro.observe(host); } }

  function refocus() {
    canvas.classList.remove('refocus'); void canvas.offsetWidth; canvas.classList.add('refocus');
  }

  let pointer = { x: 0, y: 0, src: 'none' };
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !host) return;
    const r = host.getBoundingClientRect();
    pointer = { x: ((e.clientX - r.left) / r.width) * 2 - 1, y: -(((e.clientY - r.top) / r.height) * 2 - 1), src: 'mouse' };
  }, { passive: true });
  let tiltBase = null;
  function onTilt(e) {
    if (e.beta == null) return;
    if (!tiltBase) tiltBase = { b: e.beta, g: e.gamma };
    pointer = { x: Math.max(-1, Math.min(1, (e.gamma - tiltBase.g) / 20)), y: Math.max(-1, Math.min(1, (e.beta - tiltBase.b) / 20)), src: 'tilt' };
  }
  async function enableTilt(on) {
    if (!on) { window.removeEventListener('deviceorientation', onTilt); tiltBase = null; pointer = { x: 0, y: 0, src: 'none' }; return true; }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const res = await DeviceOrientationEvent.requestPermission();
        if (res !== 'granted') return false;
      }
      window.addEventListener('deviceorientation', onTilt, { passive: true });
      return true;
    } catch (e) { return false; }
  }

  /* ---------------------------------------------------------- loop */
  const probe = fpsProbe((verdict, fps) => {
    stats.fps.push(Math.round(fps));
    if (verdict === 'ok') return;
    if (verdict === 'fail' && dpr <= 0.76) { fail('slow'); return; }
    if (dpr > 0.76) { dpr = Math.max(0.75, dpr * 0.75); stats.dpr = dpr; stats.downgrades++; resize(); probe.reset(); }
  });
  /* прогресс прокрутки сцены: у длинной сцены (закреплённый кадр) — от начала до конца закрепления */
  function stageProgress() {
    const track = host.closest('.is-long');
    if (track) {
      const r = track.getBoundingClientRect(), pinTop = parseFloat(getComputedStyle(host).top) || 0;
      return Math.max(0, Math.min(1, (pinTop - r.top) / Math.max(1, r.height - host.offsetHeight)));
    }
    const r = host.getBoundingClientRect();
    return Math.max(0, Math.min(1, -r.top / Math.max(1, r.height * 0.8)));
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (!inst || !host) return;
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0.016;
    last = now; clock += dt;
    if (inst.setProgress && host.dataset.progress !== 'off') inst.setProgress(stageProgress());
    if (inst.setPointer) inst.setPointer(pointer.x, pointer.y);
    inst.update(dt, clock);
    renderer.render(inst.scene, inst.camera);
    if (host._loupe) host._loupe.draw(canvas, inst, inst.camera, renderer.getPixelRatio());
    updateLabels();
    stats.frames++;
    if (!host.classList.contains('gl-on')) host.classList.add('gl-on');
    if (seq && inst.finished) finishArrival();
    if (!opts.noProbe) probe.step(now);
  }
  function start() { watchSize(); if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else if (host) start(); });

  return {
    tier, canvas, renderer, stats, ctx,
    register, setState, retain, enableTilt, pick,
    /* принудительно показать окно (постеры, стенд), минуя IntersectionObserver */
    force(el) { forced = el; return attach(el); },
    /* детерминированный кадр для постеров и стенда: N шагов симуляции, затем один рендер */
    renderSteps(steps = 1, dt = 1 / 60, progress) {
      if (!inst || !host) return false;
      stop();
      for (let k = 0; k < steps; k++) {
        clock += dt;
        if (progress != null && inst.setProgress) inst.setProgress(progress);
        inst.update(dt, clock);
        if (seq && inst.finished) { finishArrival(); return false; }
      }
      renderer.render(inst.scene, inst.camera);
      updateLabels();
      host.classList.add('gl-on');
      return true;
    },
    /* новая навигация: окна с data-arrive снова проигрывают пролёт */
    route() { routeToken++; requestAnimationFrame(pick); },
    get active() { return host; },
    get instance() { return inst; },
    get failed() { return failed; },
    destroy() { stop(); io.disconnect(); ro.disconnect(); vis.forEach((_, el) => { if (el._loupe) { el._loupe.destroy(); el._loupe = null; } }); instances.forEach((r) => r.inst && r.inst.dispose()); renderer.dispose(); canvas.remove(); }
  };
}
