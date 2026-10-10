/* Обложка: бланк теста связи чисел, поднятый в глубину тёмного поля.
   Раскладка 25 кружков повторяет бланк из /liver/ (тот же генератор mulberry32(25)),
   каждому кружку добавлена глубина. Бордовая линия пера прорисовывается 1 → 25,
   фокус «микроскопа» медленно переводится с дальнего плана на ближний. */
import { CatmullRomCurve3, Group, Mesh, PerspectiveCamera, Scene, TubeGeometry, Vector3 } from 'three';
import {
  PAL, C, rng, clamp, damp, dampV3, easeInOut, makeFog, makePoints, flagPoints, makeRings,
  numberAtlas, penMaterial, fieldBackground, disposeTree
} from '../lib.js';

function shuffle(arr, rnd) { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }

export function create(ctx) {
  const K = ctx.tier === 'high' ? 1 : ctx.tier === 'medium' ? 0.7 : 0.45;
  const scene = new Scene();
  const fog = makeFog(30, 64);
  const camera = new PerspectiveCamera(32, 1, 0.1, 200);
  const bg = fieldBackground({ center: [0.62, 0.55], glow: 1.1 });
  scene.add(bg);
  const root = new Group();
  scene.add(root);

  /* ---------------- точки бланка — как в /liver/ (heroSheet) */
  const rnd = rng(25);
  const cells = shuffle(Array.from({ length: 25 }, (_, i) => i), rnd);
  const pad = 22, top = 44, size = 300, cw = (size - 2 * pad) / 5, ch = (size - top - 16) / 5;
  const pts = [];
  for (let n = 0; n < 25; n++) {
    const c = cells[n], r = Math.floor(c / 5), k = c % 5;
    const x = pad + k * cw + cw / 2 + (rnd() - 0.5) * cw * 0.42;
    const y = top + r * ch + ch / 2 + (rnd() - 0.5) * ch * 0.4;
    pts.push(new Vector3((x - 150) / 150 * 11, -(y - 165) / 125 * 8.6, 0));
  }
  const zr = rng(2510);
  pts.forEach((p) => { p.z = (zr() - 0.5) * 20; });

  /* ---------------- линия пера */
  const curve = new CatmullRomCurve3(pts, false, 'catmullrom', 0.08);
  const penMat = penMaterial(fog, { to: 0 });
  const pen = new Mesh(new TubeGeometry(curve, 25 * 28, 0.055, 8, false), penMat);
  root.add(pen);

  /* ---------------- кружки с номерами */
  const atlas = numberAtlas(25, { cell: 128, fontK: 0.38 });
  const rings = makeRings(25, atlas, fog, { scale: 520, focus: 26, dof: 0.11 });
  root.add(rings);
  const ra = rings.geometry.attributes;
  const cRing = C(PAL.ink2), cDone = C(PAL.nh3Glow);
  pts.forEach((p, i) => {
    ra.position.array.set([p.x, p.y, p.z], i * 3);
    ra.num.array[i] = i;
    ra.size.array[i] = 2.2;
    ra.alpha.array[i] = 1;
  });
  // доля пути (uv.x трубки) до каждого кружка — чтобы зажигать номер, когда перо до него дошло
  const reach = pts.map((_, i) => i / 24);

  /* ---------------- пылинки поля зрения */
  const ND = Math.round(380 * K);
  const dust = makePoints(ND, fog, { scale: 420, core: 0.7 });
  root.add(dust);
  const dr = rng(99);
  const D = [];
  for (let i = 0; i < ND; i++) D.push({ x: (dr() - 0.5) * 46, y: (dr() - 0.5) * 30, z: (dr() - 0.5) * 34 - 4, ph: dr() * 6.28, s: 0.12 + dr() * 0.22 });
  const dc = C(PAL.ink2);

  /* ---------------- камера и состояние */
  let aspect = 1, t0 = null, first = true, frameX = 0, frameY = 0, progressOverride = null;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const cam = new Vector3(), goal = new Vector3(), look = new Vector3(0, 0, 0);
  const DRAW = 7.5, DELAY = 0.6;
  let focus = 46;
  const out = { finished: false };

  function update(dt, t) {
    if (t0 == null) t0 = t;
    const el = t - t0;
    const draw = progressOverride != null ? progressOverride : clamp((el - DELAY) / DRAW);
    const d = easeInOut(draw);
    penMat.uniforms.uTo.value = d;
    penMat.uniforms.uNib.value = d > 0 && d < 1 ? 1 : 0;
    for (let i = 0; i < 25; i++) {
      const on = clamp((d - reach[i] + 0.004) / 0.02);
      // кружок остаётся «чернилами бланка», перо оставляет в нём бордовую отметку
      ra.color.array[i * 3] = cRing.r; ra.color.array[i * 3 + 1] = cRing.g; ra.color.array[i * 3 + 2] = cRing.b;
      ra.fill.array[i] = on;
    }
    ra.color.needsUpdate = true; ra.fill.needsUpdate = true;

    // перефокусировка: с дальнего плана на ближний, затем медленное «дыхание» фокуса
    const camD = camera.position.length();
    focus = damp(focus, camD - 3 + Math.sin(t * 0.13) * 3.5, 1.5, dt);
    rings.material.uniforms.uFocus.value = focus;
    rings.material.uniforms.uDof.value = 0.11 * 34 / camD;
    rings.material.uniforms.uScale.value = 520 * camD / 38;

    const da = dust.geometry.attributes;
    for (let i = 0; i < ND; i++) {
      const p = D[i];
      da.position.array[i * 3] = p.x + Math.sin(t * 0.11 + p.ph) * 0.6;
      da.position.array[i * 3 + 1] = p.y + ((t * 0.12 + p.ph) % 6) - 3;
      da.position.array[i * 3 + 2] = p.z;
      da.color.array[i * 3] = dc.r; da.color.array[i * 3 + 1] = dc.g; da.color.array[i * 3 + 2] = dc.b;
      da.size.array[i] = p.s;
      da.alpha.array[i] = 0.32;
    }
    flagPoints(dust);

    ptr.x = damp(ptr.x, ptr.tx, 2.5, dt); ptr.y = damp(ptr.y, ptr.ty, 2.5, dt);
    const portrait = aspect < 0.95;
    root.scale.set(portrait ? 0.6 : 1, portrait ? 0.64 : 1, portrait ? 0.8 : 1);
    const dist = portrait ? 44 : 34.5;
    const az = Math.sin(t * 0.07) * 0.1 + ptr.x * 0.05 - 0.32;
    const elv = Math.sin(t * 0.05) * 0.05 + ptr.y * 0.04 + 0.08;
    goal.set(Math.sin(az) * dist, Math.sin(elv) * dist, Math.cos(az) * dist);
    if (first) { cam.copy(goal); first = false; }
    dampV3(cam, goal, 1.6, dt);
    camera.position.copy(cam);
    camera.lookAt(look);
    out.finished = draw >= 1;
  }

  function applyFrame(w, h) {
    camera.clearViewOffset();
    if (frameX || frameY) camera.setViewOffset(w, h, -frameX * w, -frameY * h, w, h);
  }
  let W = 1, H = 1;

  return {
    scene, camera, labels: [],
    get finished() { return out.finished; },
    setView() {},
    setState(st) {
      if (st.frameX != null) frameX = st.frameX;
      if (st.frameY != null) frameY = st.frameY;
      if (st.draw != null) progressOverride = st.draw;
      applyFrame(W, H);
    },
    setPointer(x, y) { ptr.tx = x; ptr.ty = y; },
    resize(w, h, fx = 0, fy = 0) { W = w; H = h; frameX = fx; frameY = fy; aspect = w / h; camera.aspect = aspect; camera.fov = aspect < 0.8 ? 40 : 32; camera.updateProjectionMatrix(); applyFrame(w, h); bg.userData.setAspect(aspect); },
    update,
    dispose() { disposeTree(scene); }
  };
}
