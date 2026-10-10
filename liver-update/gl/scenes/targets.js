/* Органы-мишени: три препарата под одним объективом, камера переезжает между ними.
   Мозг — аммиак из капилляра проходит в астроциты и превращается в глутамин, астроциты набухают.
   Мышца — волокна истончаются (подпись про миостатин — из текста карточки).
   Печень — звёздчатые клетки в пространстве Диссе выпускают отростки, появляются нити коллагена.
   Тексты и источники — в карточках «Три органа-мишени» под окном. */
import {
  CatmullRomCurve3, CylinderGeometry, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh,
  PerspectiveCamera, Quaternion, Scene, SphereGeometry, TubeGeometry, Vector3
} from 'three';
import {
  PAL, C, rng, clamp, lerp, smooth, damp, dampV3, makeFog, rimMaterial, makePoints, flagPoints,
  penMaterial, fieldBackground, disposeTree, frameCamera
} from '../lib.js';

const MODES = ['brain', 'muscle', 'liver'];
const X = { brain: -22, muscle: 0, liver: 22 };

export function create(ctx) {
  const K = ctx.tier === 'high' ? 1 : ctx.tier === 'medium' ? 0.7 : 0.45;
  const scene = new Scene();
  const fog = makeFog(16, 40);
  const camera = new PerspectiveCamera(36, 1, 0.1, 200);
  const bg = fieldBackground({ glow: 0.9 });
  scene.add(bg);
  const rand = rng(53);
  const M = new Matrix4(), Q = new Quaternion(), SC = new Vector3(), V = new Vector3();
  const cN = C(PAL.nh3Glow), cG = C(PAL.glnGlow);

  /* ================= мозг: капилляр и астроциты */
  const brain = new Group(); brain.position.x = X.brain; scene.add(brain);
  const cap = new CatmullRomCurve3([new Vector3(-9, -1.6, -2), new Vector3(-3, -0.6, 0.5), new Vector3(3, -1.2, 0.2), new Vector3(9, -0.2, -2.5)]);
  brain.add(new Mesh(new TubeGeometry(cap, 80, 0.7, 20, false), Object.assign(rimMaterial(fog, { rim: PAL.ink2, pow: 2.4, gain: 0.7, body: 0.02 }), { side: 2 })));
  const astro = [];
  const bodyMat = rimMaterial(fog, { rim: PAL.glnGlow, pow: 1.8, gain: 0.85, body: 0.1 });
  const procMat = penMaterial(fog, { ink: '#24504d', glow: PAL.glnGlow, nib: 0 });
  for (let i = 0; i < 9; i++) {
    const g = new Group();
    g.position.set(-7 + (i % 5) * 3.5 + (rand() - 0.5), 1.6 + Math.floor(i / 5) * 2.4 + (rand() - 0.5) * 0.8, (rand() - 0.5) * 3);
    const body = new Mesh(new IcosahedronGeometry(0.42, 2), bodyMat);
    g.add(body);
    for (let j = 0; j < 7; j++) {
      const a = j / 7 * Math.PI * 2 + rand();
      const end = j === 0 ? cap.getPoint(clamp((g.position.x + 9) / 18)).sub(g.position) : new Vector3(Math.cos(a) * 1.5, Math.sin(a) * 1.2, (rand() - 0.5) * 1.2);
      const mid = end.clone().multiplyScalar(0.5).add(new Vector3((rand() - 0.5) * 0.4, (rand() - 0.5) * 0.4, 0));
      g.add(new Mesh(new TubeGeometry(new CatmullRomCurve3([new Vector3(), mid, end]), 12, 0.04, 5, false), procMat));
    }
    brain.add(g);
    astro.push({ g, body, fill: 0, ph: rand() * 6 });
  }

  /* ================= мышца: пучок волокон */
  const muscle = new Group(); muscle.position.x = X.muscle; scene.add(muscle);
  const fibers = [];
  const fGeo = new CylinderGeometry(0.62, 0.62, 16, 28, 1, true);
  const fMat = rimMaterial(fog, { rim: '#C9A9A6', pow: 2.2, gain: 0.75, body: 0.04 });
  for (let i = 0; i < 19; i++) {
    const ring = i === 0 ? 0 : i < 7 ? 1 : 2, k = i === 0 ? 0 : i < 7 ? i - 1 : i - 7;
    const a = ring === 1 ? k / 6 * Math.PI * 2 : k / 12 * Math.PI * 2 + 0.2;
    const r = ring * 1.42;
    const m = new Mesh(fGeo, fMat);
    m.rotation.z = Math.PI / 2;
    m.position.set((rand() - 0.5) * 0.6, Math.sin(a) * r, Math.cos(a) * r);
    muscle.add(m);
    fibers.push(m);
  }
  // поперечная исчерченность: тонкие кольца вдоль волокна
  const stri = new InstancedMesh(new CylinderGeometry(0.64, 0.64, 0.05, 24, 1, true), rimMaterial(fog, { rim: '#C9A9A6', pow: 1.4, gain: 0.25, body: 0.05 }), 19 * 12);
  muscle.add(stri);

  /* ================= печень: звёздчатые клетки в пространстве Диссе */
  const liver = new Group(); liver.position.x = X.liver; scene.add(liver);
  const sin = new Mesh(new CylinderGeometry(0.9, 0.9, 12, 32, 1, true), rimMaterial(fog, { rim: PAL.ureaGlow, pow: 2.2, gain: 0.8, body: 0.03 }));
  sin.rotation.z = Math.PI / 2; sin.position.y = 1.9; liver.add(sin);
  const hepMat = rimMaterial(fog, { rim: '#6F7C8E', pow: 2.6, gain: 0.7, body: 0.04 });
  for (let k = 0; k < 6; k++) { const h = new Mesh(new SphereGeometry(0.95, 24, 16), hepMat); h.position.set(-5 + k * 2, -1.2, 0); h.scale.set(1, 0.85, 0.9); liver.add(h); }
  const stell = [];
  const stMat = rimMaterial(fog, { rim: PAL.gold, pow: 1.2, gain: 0.95, body: 0.35 });
  for (let k = 0; k < 4; k++) {
    const g = new Group(); g.position.set(-4.2 + k * 2.8, 0.45, 0.2);
    g.add(new Mesh(new SphereGeometry(0.24, 14, 10), stMat));
    const procs = [];
    for (let j = 0; j < 6; j++) {
      const a = j / 6 * Math.PI * 2 + k;
      const len = 1 + rand() * 0.7;
      const c = new CatmullRomCurve3([new Vector3(), new Vector3(Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.22, (rand() - 0.5) * 0.4), new Vector3(Math.cos(a) * len, Math.sin(a) * len * 0.4, (rand() - 0.5) * 0.6)]);
      const mat = penMaterial(fog, { ink: '#6b5a22', glow: PAL.gold, to: 0, nib: 0 });
      g.add(new Mesh(new TubeGeometry(c, 16, 0.05, 5, false), mat));
      procs.push(mat);
    }
    liver.add(g); stell.push(procs);
  }
  const coll = [];
  for (let k = 0; k < 8; k++) {
    const y = 0.25 + (k % 4) * 0.16, ph = rand() * 6, ps = [];
    for (let j = 0; j <= 12; j++) ps.push(new Vector3(-6 + j, y + Math.sin(j * 1.2 + ph) * 0.12, (rand() - 0.5) * 0.8));
    const mat = penMaterial(fog, { ink: '#4b5568', glow: PAL.ink, to: 0, nib: 0 });
    liver.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(ps), 80, 0.025, 4, false), mat));
    coll.push(mat);
  }

  /* ================= частицы аммиака (во всех трёх препаратах) */
  const NP = Math.round(220 * K);
  const pts = makePoints(NP, fog, { scale: 340 });
  scene.add(pts);
  const P = [];
  for (let i = 0; i < NP; i++) P.push({ u: rand(), sp: 0.05 + rand() * 0.05, a: Math.floor(rand() * 9), j: new Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5), ph: rand() * 6 });

  /* ================= состояние */
  let mode = 'brain', modeT = { brain: 0, muscle: 0, liver: 0 }, aspect = 1, first = true;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const cam = new Vector3(), look = new Vector3(), gPos = new Vector3(), gLook = new Vector3();
  const labels = [
    { text: 'капилляр', at: new Vector3(X.brain + 6, -0.1, 0.8), when: () => mode === 'brain' },
    { text: 'астроциты: аммиак → глутамин', tone: 'gln', at: new Vector3(X.brain - 6.5, 4.6, 0), when: () => mode === 'brain' },
    { text: 'мышечные волокна', at: new Vector3(X.muscle - 6.5, 3.4, 0), when: () => mode === 'muscle' },
    { text: 'миостатин ↑ (через NF-κB)', tone: 'nh3', at: new Vector3(X.muscle + 2.2, -3.6, 0), when: () => mode === 'muscle' },
    { text: 'синусоид', tone: 'urea', at: new Vector3(X.liver + 3.4, 3.2, 0), when: () => mode === 'liver' },
    { text: 'звёздчатые клетки · пространство Диссе', tone: 'gold', at: new Vector3(X.liver - 5.6, -0.2, 1.2), when: () => mode === 'liver' }
  ];

  function update(dt, t) {
    MODES.forEach((m) => { modeT[m] = m === mode ? Math.min(1, modeT[m] + dt / 7) : damp(modeT[m], 0, 1.5, dt); });
    // мозг: набухание растёт с накоплением глутамина
    const sw = smooth(modeT.brain);
    astro.forEach((a, i) => { a.body.scale.setScalar(1 + sw * (0.55 + 0.1 * Math.sin(t * 1.5 + a.ph))); });
    // мышца: волокна истончаются
    const th = 1 - 0.3 * smooth(modeT.muscle);
    let si = 0;
    fibers.forEach((f, i) => {
      f.scale.set(th, 1, th);
      for (let k = 0; k < 12; k++) {
        V.set(-7.2 + k * 1.3 + f.position.x, f.position.y, f.position.z);
        Q.setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 2);
        M.compose(V, Q, SC.set(th, 1, th)); stri.setMatrixAt(si++, M);
      }
    });
    stri.instanceMatrix.needsUpdate = true;
    // печень: отростки и коллаген
    const gl = modeT.liver;
    stell.forEach((procs, k) => procs.forEach((m, j) => { m.uniforms.uTo.value = smooth(clamp(gl * 2 - (j % 3) * 0.15 - k * 0.06)); }));
    coll.forEach((m, k) => { m.uniforms.uTo.value = smooth(clamp(gl * 2.2 - 0.8 - k * 0.07)); });

    const pa = pts.geometry.attributes;
    for (let i = 0; i < NP; i++) {
      const p = P[i];
      p.u = (p.u + p.sp * dt) % 1;
      let col = cN;
      if (mode === 'brain') {
        // из капилляра к астроциту; на подходе — глутамин
        const a = astro[p.a];
        const from = cap.getPoint(clamp((a.g.position.x + 9) / 18), V);
        const q = smooth(p.u);
        const x = lerp(from.x, a.g.position.x, q) + p.j.x * 0.3, y = lerp(from.y, a.g.position.y, q) + p.j.y * 0.3, z = lerp(from.z, a.g.position.z, q) + p.j.z * 0.3;
        pa.position.array.set([x + X.brain, y, z], i * 3);
        if (p.u > 0.7) col = cG;
      } else if (mode === 'muscle') {
        pa.position.array.set([X.muscle - 8 + p.u * 16, Math.sin(p.ph) * 3.4 + p.j.y, Math.cos(p.ph) * 3.4 + p.j.z], i * 3);
      } else {
        pa.position.array.set([X.liver - 6 + p.u * 12, 1.9 + p.j.y * 1.2, p.j.z * 1.2], i * 3);
      }
      pa.color.array.set([col.r, col.g, col.b], i * 3);
      pa.size.array[i] = 0.42;
      pa.alpha.array[i] = 0.85 * Math.min(1, p.u * 8, (1 - p.u) * 8);
    }
    flagPoints(pts);

    ptr.x = damp(ptr.x, ptr.tx, 2.5, dt); ptr.y = damp(ptr.y, ptr.ty, 2.5, dt);
    const fit = aspect < 1 ? 1 / Math.max(0.6, aspect) : 1;
    const x = X[mode];
    gPos.set(x + Math.sin(t * 0.1) * 0.8 + ptr.x * 0.8, 2.2 + ptr.y * 0.6, (mode === 'liver' ? 12.5 : 17) * fit);
    gLook.set(x, mode === 'liver' ? 0.4 : 1, 0);
    if (first) { cam.copy(gPos); look.copy(gLook); first = false; }
    dampV3(cam, gPos, 2.4, dt); dampV3(look, gLook, 2.6, dt);
    camera.position.copy(cam); camera.lookAt(look);
  }

  return {
    scene, camera, labels,
    setView() {},
    setState(st) { if (st.mode && MODES.includes(st.mode)) mode = st.mode; },
    labelVisible(l) { return !l.when || l.when(); },
    setPointer(x, y) { ptr.tx = x; ptr.ty = y; },
    resize(w, h, fx = 0, fy = 0) { aspect = w / h; camera.aspect = aspect; frameCamera(camera, w, h, fx, fy); camera.updateProjectionMatrix(); bg.userData.setAspect(aspect); },
    update,
    dispose() { disposeTree(scene); }
  };
}
