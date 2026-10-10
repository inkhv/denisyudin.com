/* Порочный круг: шесть звеньев на кольце, по кольцу по часовой стрелке идут частицы аммиака.
   Выбранное звено выезжает к камере. «Где разорвать круг» — кольцо размыкается в звеньях-мишенях
   (те же звенья, что помечены в /liver/: 1, 2, 3, 5). Внутри звена «Активация звёздчатых клеток»
   в центре кольца появляется схема: звёздчатые клетки в пространстве Диссе выпускают отростки,
   появляются нити коллагена. Подписи-источники — из текстов CYCLE. */
import {
  CatmullRomCurve3, Curve, CylinderGeometry, Group, IcosahedronGeometry, Mesh, PerspectiveCamera,
  Scene, SphereGeometry, TorusGeometry, TubeGeometry, Vector3
} from 'three';
import {
  PAL, C, rng, clamp, lerp, smooth, damp, dampV3, makeFog, rimMaterial, makePoints, flagPoints,
  penMaterial, fieldBackground, disposeTree, frameCamera
} from '../lib.js';

const RR = 3.2;
const ANG = [-90, -30, 30, 90, 150, 210];           // как в /liver/: --a у .cycle-node
const BREAK = [0, 1, 2, 4];                           // звенья с классом has-break
const KEY = 2;                                        // is-key: «Гипераммониемия»
const rad = (d) => d * Math.PI / 180;
const nodePos = (i, r = RR) => new Vector3(Math.cos(rad(ANG[i])) * r, -Math.sin(rad(ANG[i])) * r, 0);

class Arc extends Curve {
  constructor(a0, a1, r) { super(); this.a0 = a0; this.a1 = a1; this.r = r; }
  getPoint(t, out = new Vector3()) { const a = rad(lerp(this.a0, this.a1, t)); return out.set(Math.cos(a) * this.r, -Math.sin(a) * this.r, 0); }
}

export function create(ctx) {
  const K = ctx.tier === 'high' ? 1 : ctx.tier === 'medium' ? 0.7 : 0.45;
  const scene = new Scene();
  const fog = makeFog(24, 48);
  const camera = new PerspectiveCamera(30, 1, 0.1, 100);
  const bg = fieldBackground({ center: [0.5, 0.5], glow: 0.9 });
  scene.add(bg);
  const root = new Group();
  scene.add(root);
  const rand = rng(31);

  /* ---------------- дуги кольца: дуга i — от звена i к звену i+1 */
  const arcs = [];
  for (let i = 0; i < 6; i++) {
    const a0 = ANG[i], a1 = ANG[i] + 60;
    const mat = penMaterial(fog, { ink: '#3A4A63', glow: PAL.ink2, nib: 0 });
    const m = new Mesh(new TubeGeometry(new Arc(a0, a1, RR), 64, 0.045, 8, false), mat);
    root.add(m);
    arcs.push({ m, mat, a0, a1 });
  }

  /* ---------------- звенья */
  const beadGeo = new IcosahedronGeometry(0.34, 3);
  const nodes = [];
  for (let i = 0; i < 6; i++) {
    const isKey = i === KEY;
    const mat = rimMaterial(fog, { rim: isKey ? PAL.nh3Glow : PAL.ink2, pow: 1.6, gain: 1.15, body: isKey ? 0.22 : 0.12 });
    const m = new Mesh(beadGeo, mat);
    const halo = new Mesh(new TorusGeometry(0.62, 0.018, 6, 64), rimMaterial(fog, { rim: isKey ? PAL.nh3Glow : PAL.ink2, pow: 1, gain: 0.5, body: 0.5 }));
    const brk = new Mesh(new TorusGeometry(0.82, 0.03, 6, 64), rimMaterial(fog, { rim: PAL.gold, pow: 1, gain: 0.6, body: 0.6, opacity: 0 }));
    const g = new Group(); g.add(m, halo, brk); g.position.copy(nodePos(i));
    root.add(g);
    nodes.push({ g, m, mat, halo, brk, sel: 0, base: nodePos(i) });
  }

  /* ---------------- частицы аммиака по кольцу */
  const NP = Math.round(150 * K);
  const pts = makePoints(NP, fog, { scale: 320 });
  root.add(pts);
  const P = [];
  for (let i = 0; i < NP; i++) P.push({ a: rand() * 360, sp: 16 + rand() * 10, j: (rand() - 0.5) * 0.18, z: (rand() - 0.5) * 0.18 });
  const cN = C(PAL.nh3Glow);

  /* ---------------- задержка аммиака в ткани у звена «Гипераммониемия»: ×1 → ×5 → ×10 */
  const NT = Math.round(120 * K);
  const tis = makePoints(NT, fog, { scale: 320 });
  root.add(tis);
  const TP = [];
  for (let i = 0; i < NT; i++) { const u = rand() * Math.PI * 2, v = Math.acos(2 * rand() - 1), r = 0.5 + rand() * 0.55; TP.push({ o: new Vector3(Math.sin(v) * Math.cos(u) * r, Math.sin(v) * Math.sin(u) * r, Math.cos(v) * r), rank: i / NT, ph: rand() * 6.28 }); }

  /* ---------------- схема в центре: звёздчатые клетки в пространстве Диссе */
  const disse = new Group(); disse.scale.setScalar(0.001); root.add(disse);
  const sinusoid = new Mesh(new CylinderGeometry(0.42, 0.42, 4.2, 28, 1, true), rimMaterial(fog, { rim: PAL.ureaGlow, pow: 2.2, gain: 0.8, body: 0.03 }));
  sinusoid.rotation.z = Math.PI / 2; sinusoid.position.y = 0.95; disse.add(sinusoid);
  const hepGeo = new SphereGeometry(0.42, 20, 14);
  const hepMat = rimMaterial(fog, { rim: '#6F7C8E', pow: 2.6, gain: 0.7, body: 0.04 });
  for (let k = 0; k < 5; k++) { const h = new Mesh(hepGeo, hepMat); h.position.set(-1.7 + k * 0.85, -0.55, 0); h.scale.set(1, 0.9, 0.9); disse.add(h); }
  const stell = [];
  const procMat = rimMaterial(fog, { rim: PAL.gold, pow: 1.2, gain: 0.9, body: 0.35 });
  for (let k = 0; k < 3; k++) {
    const sc = new Group(); sc.position.set(-1.3 + k * 1.3, 0.22, 0.05);
    sc.add(new Mesh(new SphereGeometry(0.13, 14, 10), procMat));
    const procs = [];
    for (let j = 0; j < 6; j++) {
      const a = j / 6 * Math.PI * 2 + k;
      const len = 0.45 + rand() * 0.35;
      const curve = new CatmullRomCurve3([new Vector3(0, 0, 0), new Vector3(Math.cos(a) * len * 0.5, Math.sin(a) * len * 0.25, (rand() - 0.5) * 0.2), new Vector3(Math.cos(a) * len, Math.sin(a) * len * 0.42, (rand() - 0.5) * 0.3)]);
      const mat = penMaterial(fog, { ink: '#6b5a22', glow: PAL.gold, to: 0, nib: 0 });
      const pm = new Mesh(new TubeGeometry(curve, 16, 0.022, 5, false), mat);
      sc.add(pm); procs.push(mat);
    }
    disse.add(sc); stell.push({ sc, procs });
  }
  const fibers = [];
  for (let k = 0; k < 7; k++) {
    const y = 0.32 + (k % 3) * 0.08, ph = rand() * 6;
    const ps = []; for (let j = 0; j <= 10; j++) ps.push(new Vector3(-2 + j * 0.4, y + Math.sin(j * 1.3 + ph) * 0.06, (rand() - 0.5) * 0.3));
    const mat = penMaterial(fog, { ink: '#4b5568', glow: PAL.ink, to: 0, nib: 0 });
    disse.add(new Mesh(new TubeGeometry(new CatmullRomCurve3(ps), 60, 0.012, 4, false), mat));
    fibers.push(mat);
  }

  /* ---------------- состояние */
  let sel = -1, broken = 0, brkT = 0, view = 'ring', aspect = 1, first = true;
  let disseT = 0, tisT = 0;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const cam = new Vector3(), goal = new Vector3(), look = new Vector3();
  const labels = [
    { id: 'disse', text: 'звёздчатые клетки, in vitro', tone: 'gold', at: new Vector3(-1.75, -1.15, 0), views: ['list', 'stage'], when: () => sel === 3 },
    { id: 'tis', text: 'ткань: ×5 стеатоз, ×10 НАСГ', tone: 'nh3', align: 'end', at: nodePos(2).add(new Vector3(-1.0, -0.2, 0)), when: () => sel === 2 },
    { id: 'pp', text: 'у крыс: 14 → 11 мм рт. ст.', at: nodePos(4).add(new Vector3(1.0, -0.2, 0)), when: () => sel === 4 },
    ...[0, 1, 2, 3, 4, 5].map((i) => ({ id: 'n' + i, text: String(i + 1), tone: i === KEY ? 'nh3' : 'num', at: nodePos(i, RR + 0.95), views: ['list'] }))
  ];

  function update(dt, t) {
    brkT = damp(brkT, broken, 2.4, dt);
    // размыкание: у звеньев-мишеней дуги отступают от узла
    const gap = brkT * 0.3;
    arcs.forEach((a, i) => {
      const fromBreak = BREAK.includes(i), toBreak = BREAK.includes((i + 1) % 6);
      a.mat.uniforms.uFrom.value = fromBreak ? gap : 0.07;
      a.mat.uniforms.uTo.value = toBreak ? 1 - gap : 0.93;
      a.mat.uniforms.uOpacity.value = 1;
    });
    nodes.forEach((n, i) => {
      n.sel = damp(n.sel, i === sel ? 1 : 0, 4, dt);
      n.g.position.copy(n.base).multiplyScalar(1 + n.sel * 0.04);
      n.g.position.z = n.sel * 1.6;
      const s = 1 + n.sel * 0.45 + Math.sin(t * 2 + i) * 0.02;
      n.m.scale.setScalar(s);
      n.halo.scale.setScalar(1 + n.sel * 0.35 + Math.sin(t * 1.6 + i) * 0.03);
      n.mat.uniforms.uGain.value = 1 + n.sel * 0.8;
      n.brk.material.uniforms.uOpacity.value = BREAK.includes(i) ? brkT : 0;
      n.brk.rotation.z = t * 0.4;
      n.halo.lookAt(camera.position); n.brk.lookAt(camera.position);
    });

    const pa = pts.geometry.attributes;
    for (let i = 0; i < NP; i++) {
      const p = P[i];
      p.a = (p.a + p.sp * dt * (1 - brkT * 0.6)) % 360;
      const ar = rad(p.a - 90);
      const r = RR + p.j;
      pa.position.array[i * 3] = Math.cos(ar) * r; pa.position.array[i * 3 + 1] = -Math.sin(ar) * r; pa.position.array[i * 3 + 2] = p.z;
      // у разорванных звеньев частицы гаснут: путь прерван
      let al = 0.9;
      if (brkT > 0.01) {
        BREAK.forEach((b) => { let d = Math.abs(((p.a - 90 - ANG[b]) % 360 + 540) % 360 - 180); al *= lerp(1, smooth(clamp((d - 4) / 12)), brkT); });
      }
      pa.color.array[i * 3] = cN.r; pa.color.array[i * 3 + 1] = cN.g; pa.color.array[i * 3 + 2] = cN.b;
      pa.size.array[i] = 0.42; pa.alpha.array[i] = al;
    }
    flagPoints(pts);

    tisT = damp(tisT, sel === 2 ? 1 : 0, 3, dt);
    const factor = sel === 2 ? [1, 5, 10][Math.floor(t / 1.8) % 3] : 0;
    const ta = tis.geometry.attributes, np = nodes[2].g.position;
    for (let i = 0; i < NT; i++) {
      const q = TP[i];
      ta.position.array[i * 3] = np.x + q.o.x * (1 + Math.sin(t + q.ph) * 0.05);
      ta.position.array[i * 3 + 1] = np.y + q.o.y; ta.position.array[i * 3 + 2] = np.z + q.o.z;
      ta.color.array[i * 3] = cN.r; ta.color.array[i * 3 + 1] = cN.g; ta.color.array[i * 3 + 2] = cN.b;
      ta.size.array[i] = 0.3; ta.alpha.array[i] = tisT * clamp((factor / 10 - q.rank) * 10) * 0.8;
    }
    flagPoints(tis);

    disseT = damp(disseT, sel === 3 ? 1 : 0, 2.6, dt);
    disse.scale.setScalar(Math.max(0.001, disseT * (view === 'list' ? 0.66 : 0.92)));
    disse.position.z = disseT * 0.6;
    const grow = sel === 3 ? clamp((disseT - 0.4) / 0.6) : disseT;
    stell.forEach((s, k) => s.procs.forEach((m, j) => { m.uniforms.uTo.value = smooth(clamp(grow * 1.4 - (j % 3) * 0.12 - k * 0.05)); }));
    fibers.forEach((m, k) => { m.uniforms.uTo.value = smooth(clamp(grow * 1.6 - 0.5 - k * 0.06)); });

    ptr.x = damp(ptr.x, ptr.tx, 2.5, dt); ptr.y = damp(ptr.y, ptr.ty, 2.5, dt);
    root.rotation.z = view === 'stage' ? -t * 0.06 : damp(root.rotation.z, 0, 3, dt);
    if (view === 'list' || view === 'stage') {
      const fit = aspect < 1 ? 1 / Math.max(0.6, aspect) : 1;
      const d = (view === 'stage' ? 19 : 15) * fit;
      goal.set(Math.sin(ptr.x * 0.06 + Math.sin(t * 0.1) * 0.08) * d, -d * 0.42 + ptr.y * 0.4, d * 0.9);
      look.set(0, -0.2, 0);
    } else {
      // десктоп: кольцо совпадает с HTML-кнопками, допускается лишь лёгкое покачивание
      const d = RR / (0.749 * Math.tan(rad(15)));
      goal.set(Math.sin(ptr.x * 0.04 + Math.sin(t * 0.12) * 0.03) * d, Math.sin(ptr.y * 0.04 + Math.cos(t * 0.1) * 0.025) * d, d);
      look.set(0, 0, 0);
    }
    if (first) { cam.copy(goal); first = false; }
    dampV3(cam, goal, 2.4, dt);
    camera.position.copy(cam);
    camera.lookAt(look);
  }

  return {
    scene, camera, labels,
    setView(v, o = {}) { if (v !== view) { view = v; if (o.cut) first = true; } },
    setState(st) {
      if (st.sel != null) sel = st.sel;
      if (st.broken != null) broken = st.broken ? 1 : 0;
      if (st.instant) { brkT = broken; }
    },
    labelVisible(l) { return (!l.views || l.views.includes(view)) && (!l.when || l.when()); },
    setPointer(x, y) { ptr.tx = x; ptr.ty = y; },
    resize(w, h, fx = 0, fy = 0) { aspect = w / h; camera.aspect = aspect; camera.fov = view === 'ring' ? 30 : (aspect < 1 ? 40 : 32); frameCamera(camera, w, h, fx, fy); camera.updateProjectionMatrix(); bg.userData.setAspect(aspect); },
    update,
    dispose() { disposeTree(scene); }
  };
}
