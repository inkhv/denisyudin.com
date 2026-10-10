/* Печёночная долька: шестиугольник, портальные тракты в углах, центральная вена в центре.
   Кровь (частицы NH₃) идёт по синусоидам от портальных трактов к центральной вене.
   Зона 1 (перипортальная, синий оттенок) — цикл мочевины, «турбина» вращается со скоростью,
   равной мощности цикла (FLOW[*].cap). Зона 3 (перивенозная, бирюзовый) — глутаминсинтетаза.
   Параметры состояния приходят из gl/bindings.js (вычисляются из data.js), здесь только визуализация. */
import {
  BufferAttribute, BufferGeometry, CatmullRomCurve3, CylinderGeometry, Group, IcosahedronGeometry,
  InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, PerspectiveCamera, Quaternion,
  QuadraticBezierCurve3, Scene, TorusGeometry, TubeGeometry, Vector3, AdditiveBlending, Color
} from 'three';
import {
  PAL, C, rng, clamp, lerp, smooth, damp, dampV3, makeFog, rimMaterial, makePoints, flagPoints,
  fieldBackground, disposeTree, frameCamera
} from '../lib.js';

const R = 6;                                  // радиус описанной окружности шестиугольника
const APO = R * Math.cos(Math.PI / 6);        // апофема
const CV_R = 0.62;                            // центральная вена
const PLATES = 30;                            // печёночные балки
const TAU = Math.PI * 2;

function rHex(a) {
  let t = ((a % (TAU / 6)) + TAU / 6) % (TAU / 6);
  return APO / Math.cos(t - Math.PI / 6);
}
const corner = (k) => new Vector3(R * Math.cos(k * TAU / 6), 0, R * Math.sin(k * TAU / 6));

export function create(ctx) {
  const tier = ctx.tier;
  const K = tier === 'high' ? 1 : tier === 'medium' ? 0.7 : 0.45;
  const scene = new Scene();
  const fog = makeFog(14, 46);
  const camera = new PerspectiveCamera(34, 1, 0.1, 200);
  const bg = fieldBackground({ center: [0.5, 0.52] });
  scene.add(bg);
  const root = new Group();
  scene.add(root);
  const rand = rng(7);

  /* ------------------------------------------------ state (animated toward targets) */
  const S = { cap: 1, fat: 0, tissue: 1, shunt: 0, therapy: 0, mode: 'norm' };
  const T = { ...S };

  /* ------------------------------------------------ hexagon outline + zone guides */
  const lineMat = (hex, op) => new LineBasicMaterial({ color: C(hex).multiplyScalar(op), transparent: true, blending: AdditiveBlending, depthWrite: false });
  {
    const pts = [];
    for (let k = 0; k < 6; k++) { pts.push(corner(k).setY(-0.55), corner(k + 1).setY(-0.55)); }
    const g = new BufferGeometry().setFromPoints(pts);
    root.add(new LineSegments(g, lineMat(PAL.ink2, 0.35)));
  }

  /* ------------------------------------------------ sinusoids: bezier from portal corner to central vein */
  const SIN = [];
  for (let i = 0; i < PLATES; i++) {
    const a = (i + 0.5) / PLATES * TAU;            // синусоид между балками
    const k = Math.round(a / (TAU / 6)) % 6;
    const c = corner(k);
    const rr = rHex(a);
    const start = new Vector3(lerp(c.x, rr * Math.cos(a), 0.55), 0, lerp(c.z, rr * Math.sin(a), 0.55));
    const mid = new Vector3(Math.cos(a) * rr * 0.55, 0, Math.sin(a) * rr * 0.55);
    const end = new Vector3(Math.cos(a) * (CV_R + 0.12), 0, Math.sin(a) * (CV_R + 0.12));
    SIN.push({ a, k, curve: new QuadraticBezierCurve3(start, mid, end) });
  }
  {
    const pts = [];
    SIN.forEach((s) => { const sp = s.curve.getPoints(14); for (let j = 0; j < sp.length - 1; j++) pts.push(sp[j], sp[j + 1]); });
    root.add(new LineSegments(new BufferGeometry().setFromPoints(pts), lineMat(PAL.ureaGlow, 0.16)));
  }

  /* ------------------------------------------------ hepatocytes: instanced, tinted by zone */
  const cellGeo = new IcosahedronGeometry(1, tier === 'high' ? 2 : 1);
  const smallGeo = new IcosahedronGeometry(1, 1);
  const cells = [];
  for (let i = 0; i < PLATES; i++) {
    const a = i / PLATES * TAU;
    const rmax = rHex(a) - 0.35;
    for (let layer = 0; layer < 2; layer++) {
      const off = layer ? 0.26 : 0;
      for (let r = CV_R + 0.62 + off; r < rmax; r += 0.54) {
        const rho = clamp((r - CV_R) / (rmax - CV_R));
        const jitter = () => (rand() - 0.5) * 0.09;
        cells.push({
          p: new Vector3(Math.cos(a) * r + jitter(), (layer ? 0.27 : -0.27) + jitter(), Math.sin(a) * r + jitter()),
          s: 0.215 + rand() * 0.03, rho,
          fatOn: rand() < 0.78, fatK: 0.55 + rand() * 0.38, fatDir: new Vector3(rand() - 0.5, (rand() - 0.5) * 0.6, rand() - 0.5).normalize()
        });
      }
    }
  }
  const zoneColor = (rho) => {
    const z1 = C(PAL.ureaGlow).multiplyScalar(1.05), z2 = C('#6F7C8E').multiplyScalar(0.8), z3 = C(PAL.glnGlow);
    if (rho > 0.62) return z2.clone().lerp(z1, smooth(clamp((rho - 0.62) / 0.2)));
    if (rho < 0.36) return z2.clone().lerp(z3, smooth(clamp((0.36 - rho) / 0.2)));
    return z2;
  };
  const cellMesh = new InstancedMesh(cellGeo, rimMaterial(fog, { rim: PAL.ink2, pow: 3.0, gain: 0.62, body: 0.035 }), cells.length);
  const nucMesh = new InstancedMesh(smallGeo, rimMaterial(fog, { rim: PAL.ink2, pow: 1.5, gain: 0.22, body: 0.07 }), cells.length);
  const fatMesh = new InstancedMesh(smallGeo, rimMaterial(fog, { rim: PAL.fat, base: '#221d10', pow: 1.6, gain: 0.95, body: 0.14 }), cells.length);
  cells.forEach((c, i) => {
    const zc = zoneColor(c.rho);
    cellMesh.setColorAt(i, zc);
    nucMesh.setColorAt(i, zc.clone().multiplyScalar(0.7));
  });
  [cellMesh, nucMesh, fatMesh].forEach((m) => { m.frustumCulled = false; root.add(m); });
  const M = new Matrix4(), Q = new Quaternion(), V = new Vector3(), SC = new Vector3();
  function layoutCells() {
    const fat = S.fat;
    cells.forEach((c, i) => {
      const swell = 1 + 0.14 * fat * (c.fatOn ? 1 : 0.3);
      SC.setScalar(c.s * swell); M.compose(c.p, Q, SC); cellMesh.setMatrixAt(i, M);
      const fk = c.fatOn ? fat : 0;
      // макровезикулярный стеатоз: капля занимает клетку, ядро смещается к краю
      V.copy(c.fatDir).multiplyScalar(-c.s * 0.5 * fk).add(c.p);
      SC.setScalar(c.s * (0.36 - 0.08 * fk)); M.compose(V, Q, SC); nucMesh.setMatrixAt(i, M);
      V.copy(c.fatDir).multiplyScalar(c.s * 0.18 * fk).add(c.p);
      SC.setScalar(Math.max(0.0001, c.s * swell * c.fatK * fk * 0.92)); M.compose(V, Q, SC); fatMesh.setMatrixAt(i, M);
    });
    cellMesh.instanceMatrix.needsUpdate = true; nucMesh.instanceMatrix.needsUpdate = true; fatMesh.instanceMatrix.needsUpdate = true;
  }
  layoutCells();

  /* ------------------------------------------------ vessels: central vein + 6 portal triads */
  const vesselMat = rimMaterial(fog, { rim: PAL.ink2, pow: 2.4, gain: 1.05, body: 0.04 });
  const cv = new Mesh(new CylinderGeometry(CV_R, CV_R, 3.6, 40, 1, true), vesselMat);
  cv.position.y = 1.0; root.add(cv);
  const triadParts = [];
  for (let k = 0; k < 6; k++) {
    const c = corner(k), out = c.clone().normalize();
    const side = new Vector3(-out.z, 0, out.x);
    const g = new Group(); g.position.copy(c);
    const pv = new Mesh(new CylinderGeometry(0.36, 0.36, 1.7, 28, 1, true), vesselMat); pv.position.copy(out.clone().multiplyScalar(0.05));
    const ha = new Mesh(new CylinderGeometry(0.14, 0.14, 1.7, 18, 1, true), rimMaterial(fog, { rim: PAL.ink, pow: 2, gain: 0.7, body: 0.04 }));
    ha.position.copy(side.clone().multiplyScalar(0.52).add(out.clone().multiplyScalar(0.18)));
    const bd = new Mesh(new CylinderGeometry(0.12, 0.12, 1.7, 18, 1, true), rimMaterial(fog, { rim: PAL.ink2, pow: 2, gain: 0.5, body: 0.03 }));
    bd.position.copy(side.clone().multiplyScalar(-0.5).add(out.clone().multiplyScalar(0.22)));
    g.add(pv, ha, bd); root.add(g);
    triadParts.push({ pv, ha, bd, g });
  }

  /* ------------------------------------------------ urea-cycle «турбина» (zone 1) and GS ring (zone 3) */
  const TURB_R = APO * 0.8;
  const turbine = new Group(); turbine.position.y = 0.95; root.add(turbine);
  const turbMat = rimMaterial(fog, { rim: PAL.ureaGlow, pow: 1.4, gain: 1.2, body: 0.25 });
  turbine.add(new Mesh(new TorusGeometry(TURB_R, 0.05, 8, 160), turbMat));
  const beadGeo = new IcosahedronGeometry(1, 1);
  const BEADS = 18;
  const beads = new InstancedMesh(beadGeo, rimMaterial(fog, { rim: PAL.ureaGlow, pow: 1.2, gain: 1.4, body: 0.5 }), BEADS);
  for (let i = 0; i < BEADS; i++) {
    const a = i / BEADS * TAU;
    M.compose(new Vector3(Math.cos(a) * TURB_R, 0, Math.sin(a) * TURB_R), Q, SC.setScalar(i % 3 === 0 ? 0.16 : 0.1));
    beads.setMatrixAt(i, M);
  }
  turbine.add(beads);
  const GS_R = CV_R + 1.25;
  const gs = new Group(); gs.position.y = 0.95; root.add(gs);
  const gsMat = rimMaterial(fog, { rim: PAL.glnGlow, pow: 1.4, gain: 1.0, body: 0.2 });
  gs.add(new Mesh(new TorusGeometry(GS_R, 0.04, 8, 90), gsMat));
  const gsBeads = new InstancedMesh(beadGeo, rimMaterial(fog, { rim: PAL.glnGlow, pow: 1.2, gain: 1.2, body: 0.45 }), 8);
  for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; M.compose(new Vector3(Math.cos(a) * GS_R, 0, Math.sin(a) * GS_R), Q, SC.setScalar(0.09)); gsBeads.setMatrixAt(i, M); }
  gs.add(gsBeads);

  /* ------------------------------------------------ inflow (portal vein), outflow (to systemic blood), shunt */
  const inflow = new CatmullRomCurve3([
    new Vector3(-30, -4.5, -15), new Vector3(-21, -3.2, -9), new Vector3(-13.5, -1.4, -3.2), new Vector3(-8.6, -0.3, -0.5), corner(3).clone().add(new Vector3(-0.2, 0, 0))
  ]);
  const tubeMat = rimMaterial(fog, { rim: PAL.ink2, pow: 2.6, gain: 0.42, body: 0.008 });
  tubeMat.side = 2; // DoubleSide: видна и изнутри при пролёте по вене
  const inflowMesh = new Mesh(new TubeGeometry(inflow, 120, 0.72, 24, false), tubeMat);
  root.add(inflowMesh);
  const outflow = new CatmullRomCurve3([
    new Vector3(0, 2.4, 0), new Vector3(0, 4.0, 0), new Vector3(0.7, 5.3, -1.0), new Vector3(3.6, 6.4, -4.6), new Vector3(9, 7.2, -12)
  ]);
  const outflowMesh = new Mesh(new TubeGeometry(outflow, 80, CV_R * 0.9, 24, false), rimMaterial(fog, { rim: PAL.ink2, pow: 2.6, gain: 0.45, body: 0.012 }));
  root.add(outflowMesh);
  const shuntCurve = new CatmullRomCurve3([
    inflow.getPointAt(0.62), new Vector3(-11, 2.8, -4.8), new Vector3(-6.5, 5.8, -5.2), new Vector3(-1.8, 6.6, -3), outflow.getPointAt(0.45)
  ]);
  const shuntMat = rimMaterial(fog, { rim: PAL.nh3Glow, pow: 1.8, gain: 1.0, body: 0.05, opacity: 0 });
  shuntMat.side = 2;
  const shuntMesh = new Mesh(new TubeGeometry(shuntCurve, 100, 0.5, 18, false), shuntMat);
  root.add(shuntMesh);

  /* ------------------------------------------------ particles: NH₃ → мочевина / глутамин / системный кровоток */
  const N = Math.round(560 * K);
  const flow = makePoints(N, fog, { scale: 380 });
  root.add(flow);
  const cNH3 = C(PAL.nh3Glow), cUrea = C(PAL.ureaGlow), cGln = C(PAL.glnGlow), cOrn = C('#BFD4F0'), cAsp = C('#8FD0C8');
  const P = [];
  // фазы: 0 — воротная вена, 1 — синусоид, 2 — центральная вена и выход, 3 — шунт
  function spawn(p, init) {
    const shunted = rand() < S.shunt;
    const pU = 0.365 * S.cap;                 // ≈ половина из 73 % — в мочевину, пропорционально мощности цикла
    const pG = (1 - pU) * 0.575;              // ≈ половина из 73 % — в глутамин (доля от оставшегося)
    const r = rand();
    p.fate = shunted ? 3 : (r < pU ? 0 : r < pU + pG ? 1 : 2);
    p.sin = SIN[Math.floor(rand() * SIN.length)];
    p.via = !shunted && p.sin.k !== 3 ? 1 : 0;     // в угол 3 частицы приходят по воротной вене, в остальные — из ветвей
    p.phase = shunted || p.sin.k === 3 ? 0 : 1;
    p.s = init ? rand() : 0;
    p.sp = 0.16 + rand() * 0.08;
    p.conv = p.fate === 0 ? 0.12 + rand() * 0.26 : 0.62 + rand() * 0.22;
    p.jx = (rand() - 0.5) * 0.5; p.jy = (rand() - 0.5) * 0.5; p.jz = (rand() - 0.5) * 0.5;
    p.ph = rand() * TAU; p.kind = 0;
    if (init) { p.phase = Math.floor(rand() * 3); if (p.fate === 3) p.phase = rand() < 0.5 ? 0 : 3; }
  }
  for (let i = 0; i < N; i++) { const p = {}; spawn(p, true); P.push(p); }

  // молекулы препарата (глава 5): орнитин → «турбина», аспартат → зона 3
  const ND = Math.round(150 * K);
  const drug = makePoints(ND, fog, { scale: 380, core: 0.5 });
  root.add(drug);
  const D = [];
  for (let i = 0; i < ND; i++) D.push({ s: rand(), orn: i % 3 !== 0, sin: SIN[Math.floor(rand() * SIN.length)], sp: 0.1 + rand() * 0.06, ph: rand() * TAU });

  // аммиак, задержанный в ткани (стеатоз ×5, НАСГ ×10)
  const NT = Math.round(300 * K);
  const tissue = makePoints(NT, fog, { scale: 380 });
  root.add(tissue);
  const TP = [];
  for (let i = 0; i < NT; i++) {
    const a = rand() * TAU, rr = CV_R + 0.5 + rand() * (rHex(a) - CV_R - 0.9);
    TP.push({ p: new Vector3(Math.cos(a) * rr, (rand() - 0.5) * 0.9, Math.sin(a) * rr), ph: rand() * TAU, rank: i / NT });
  }

  const tmp = new Vector3();
  function pos(p, out) {
    if (p.phase === 0) {
      const curve = p.fate === 3 ? inflow : inflow;
      const s = p.fate === 3 ? p.s * 0.62 : p.s;
      curve.getPointAt(Math.min(1, s), out);
      out.x += p.jx * 1.1; out.y += p.jy * 1.1; out.z += p.jz * 1.1;
    } else if (p.phase === 1) {
      p.sin.curve.getPoint(p.s, out);
      out.y += p.jy * 0.55 + Math.sin(p.s * 9 + p.ph) * 0.06;
      out.x += p.jx * 0.12; out.z += p.jz * 0.12;
    } else if (p.phase === 2) {
      if (p.s < 0.18) { // вход в центральную вену
        const a = p.sin.a, rr = lerp(CV_R + 0.1, CV_R * 0.4, p.s / 0.18);
        out.set(Math.cos(a) * rr, lerp(0, 0.6, p.s / 0.18) + p.jy * 0.3, Math.sin(a) * rr);
      } else {
        outflow.getPointAt(clamp((p.s - 0.18) / 0.82), out);
        out.x += p.jx * 0.55; out.y += p.jy * 0.3; out.z += p.jz * 0.55;
      }
    } else {
      shuntCurve.getPointAt(Math.min(1, p.s), out);
      out.x += p.jx * 0.5; out.y += p.jy * 0.5; out.z += p.jz * 0.5;
    }
    return out;
  }

  function updateParticles(dt, t) {
    const a = flow.geometry.attributes;
    const speedK = ctx.speed || 1;
    for (let i = 0; i < N; i++) {
      const p = P[i];
      const sp = p.sp * dt * speedK;
      if (p.phase === 0) {
        p.s += sp * (p.fate === 3 ? 0.62 : 0.55);
        if (p.fate === 3 && p.s >= 1) { p.phase = 3; p.s = 0; }
        else if (p.s >= 1) { p.phase = 1; p.s = 0; }
      } else if (p.phase === 1) {
        p.s += sp * 1.15;
        if (p.s >= 1) { p.phase = 2; p.s = 0; }
      } else if (p.phase === 2) {
        p.s += sp * 0.75;
        if (p.s >= 1) spawn(p, false);
      } else {
        p.s += sp * 0.5;
        if (p.s >= 1) spawn(p, false);
      }
      pos(p, tmp);
      a.position.array[i * 3] = tmp.x; a.position.array[i * 3 + 1] = tmp.y; a.position.array[i * 3 + 2] = tmp.z;
      // цвет: бордо, после превращения — синий (мочевина) или бирюзовый (глутамин)
      let col = cNH3, k = 0, flash = 0;
      if (p.fate === 0 || p.fate === 1) {
        const target = p.fate === 0 ? cUrea : cGln;
        if (p.phase === 1) { k = smooth(clamp((p.s - p.conv) / 0.08)); flash = Math.max(0, 1 - Math.abs(p.s - p.conv - 0.03) / 0.05); }
        else if (p.phase === 2) k = 1;
        a.color.array[i * 3] = lerp(col.r, target.r, k); a.color.array[i * 3 + 1] = lerp(col.g, target.g, k); a.color.array[i * 3 + 2] = lerp(col.b, target.b, k);
      } else {
        a.color.array[i * 3] = col.r; a.color.array[i * 3 + 1] = col.g; a.color.array[i * 3 + 2] = col.b;
      }
      a.size.array[i] = (p.phase === 0 || p.phase === 3 ? 0.8 : (p.fate >= 2 || k < 0.5 ? 0.66 : 0.5)) * (1 + flash * 1.2);
      let al = 0.95;
      if (p.phase === 0) al *= smooth(clamp(p.s / 0.08));
      if (p.phase === 1 && p.via) al *= smooth(clamp(p.s / 0.06));
      if (p.phase === 2) al *= 1 - smooth(clamp((p.s - 0.82) / 0.18));
      if (p.phase === 3) al *= (1 - smooth(clamp((p.s - 0.9) / 0.1))) * Math.max(0.25, S.shunt / 0.65);
      a.alpha.array[i] = al;
    }
    flagPoints(flow);

    // препарат
    const da = drug.geometry.attributes;
    for (let i = 0; i < ND; i++) {
      const d = D[i];
      d.s += d.sp * dt * speedK;
      if (d.s > 1) { d.s -= 1; d.sin = SIN[Math.floor(rand() * SIN.length)]; }
      if (d.orn) { // орнитин: из портальных трактов к «турбине» и по ней
        const q = d.s;
        if (q < 0.45) { d.sin.curve.getPoint(q * 0.55, tmp); tmp.y += q / 0.45 * 0.95; }
        else { const ang = d.sin.a + (q - 0.45) * 2.4 * (0.4 + S.cap); tmp.set(Math.cos(ang) * TURB_R, 0.95, Math.sin(ang) * TURB_R); }
      } else {     // аспартат: к перивенозной зоне, к кольцу глутаминсинтетазы
        const q = d.s;
        if (q < 0.7) { d.sin.curve.getPoint(q * 1.05, tmp); tmp.y += Math.max(0, (q - 0.4)) / 0.3 * 0.95; }
        else { const ang = d.sin.a + (q - 0.7) * 3; tmp.set(Math.cos(ang) * GS_R, 0.95, Math.sin(ang) * GS_R); }
      }
      tmp.y += Math.sin(t * 2 + d.ph) * 0.05;
      da.position.array[i * 3] = tmp.x; da.position.array[i * 3 + 1] = tmp.y; da.position.array[i * 3 + 2] = tmp.z;
      const c = d.orn ? cOrn : cAsp;
      da.color.array[i * 3] = c.r; da.color.array[i * 3 + 1] = c.g; da.color.array[i * 3 + 2] = c.b;
      da.size.array[i] = 0.42;
      da.alpha.array[i] = S.therapy * (0.85 - 0.6 * Math.max(0, Math.abs(d.s - 0.5) * 2 - 0.8) / 0.2);
    }
    flagPoints(drug);

    // ткань
    const ta = tissue.geometry.attributes;
    const visible = S.tissue / 10;           // доля видимых точек: 1 → 10 %, 5 → 50 %, 10 → 100 %
    for (let i = 0; i < NT; i++) {
      const q = TP[i];
      ta.position.array[i * 3] = q.p.x + Math.sin(t * 0.7 + q.ph) * 0.05;
      ta.position.array[i * 3 + 1] = q.p.y + Math.cos(t * 0.6 + q.ph) * 0.05;
      ta.position.array[i * 3 + 2] = q.p.z + Math.sin(t * 0.5 + q.ph * 1.3) * 0.05;
      ta.color.array[i * 3] = cNH3.r; ta.color.array[i * 3 + 1] = cNH3.g; ta.color.array[i * 3 + 2] = cNH3.b;
      ta.size.array[i] = 0.34;
      ta.alpha.array[i] = clamp((visible - q.rank) * 12) * (0.5 + 0.25 * Math.sin(t * 1.3 + q.ph));
    }
    flagPoints(tissue);
  }

  /* ------------------------------------------------ labels (HTML overlay anchors) */
  const labels = [
    { id: 'portal', text: 'Портальный тракт', at: corner(2).clone().add(new Vector3(-0.3, 0.95, 0.4)), views: ['window', 'stage'] },
    { id: 'cv', text: 'Центральная вена', at: new Vector3(0.35, 2.75, 0.35), views: ['window', 'stage', 'treatment'] },
    { id: 'z1', text: 'Зона 1 · цикл мочевины', tone: 'urea', at: new Vector3(Math.cos(0.35) * TURB_R, 1.0, Math.sin(0.35) * TURB_R), views: ['window', 'stage', 'treatment'] },
    { id: 'z3', text: 'Зона 3 · глутаминсинтетаза', tone: 'gln', at: new Vector3(Math.cos(3.7) * GS_R, 1.0, Math.sin(3.7) * GS_R), views: ['window', 'treatment'] },
    { id: 'shunt', text: 'Шунт: в обход дольки', tone: 'nh3', at: shuntCurve.getPointAt(0.5).add(new Vector3(0, 0.7, 0)), views: ['window'], when: () => S.shunt > 0.1 },
    { id: 'out', text: '→ системный кровоток', at: outflow.getPointAt(0.75).add(new Vector3(0, 0.8, 0)), views: ['window'] },
    { id: 'orn', text: 'орнитин → цикл мочевины', tone: 'orn', at: new Vector3(Math.cos(2.2) * TURB_R, 1.5, Math.sin(2.2) * TURB_R), views: ['treatment'], when: () => S.therapy > 0.15 },
    { id: 'asp', text: 'аспартат → глутамин', tone: 'gln', at: new Vector3(Math.cos(3.4) * GS_R, 1.4, Math.sin(3.4) * GS_R), views: ['treatment'], when: () => S.therapy > 0.15 }
  ];
  const detail = [ // лупа: подробные подписи
    { text: 'КФС-1, ОТК — ферменты цикла мочевины', at: new Vector3(Math.cos(-0.5) * TURB_R, 0.95, Math.sin(-0.5) * TURB_R) },
    { text: 'ветвь воротной вены', at: corner(0).clone().add(new Vector3(0, 0.6, 0)) },
    { text: 'печёночная артерия', at: triadParts[1].g.position.clone().add(triadParts[1].ha.position).add(new Vector3(0, 0.6, 0)) },
    { text: 'желчный проток', at: triadParts[2].g.position.clone().add(triadParts[2].bd.position).add(new Vector3(0, 0.6, 0)) },
    { text: 'синусоид: кровь течёт к центральной вене', at: SIN[4].curve.getPoint(0.5).setY(0.1) },
    { text: 'гепатоциты зоны 1', at: new Vector3(Math.cos(2.4) * 4.6, 0.3, Math.sin(2.4) * 4.6) },
    { text: 'гепатоциты зоны 3', at: new Vector3(Math.cos(0.9) * 1.8, 0.3, Math.sin(0.9) * 1.8) },
    { text: 'глутаминсинтетаза', at: new Vector3(Math.cos(1.6) * GS_R, 0.95, Math.sin(1.6) * GS_R) }
  ];

  /* ------------------------------------------------ camera views */
  let view = 'window', progress = 0;
  const cam = { pos: new Vector3(0, 12, 12), look: new Vector3(), fov: 34 };
  const goal = { pos: new Vector3(), look: new Vector3() };
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  let aspect = 1, first = true;

  const stageCam = new CatmullRomCurve3([
    inflow.getPointAt(0.05).add(new Vector3(0, 0.15, 0)),
    inflow.getPointAt(0.35).add(new Vector3(0, 0.2, 0)),
    inflow.getPointAt(0.74).add(new Vector3(0, 0.6, 0)),
    new Vector3(-7.8, 2.6, 4.6),
    new Vector3(-6.5, 10.5, 12.5)
  ]);
  const stageLook = new CatmullRomCurve3([
    inflow.getPointAt(0.25), inflow.getPointAt(0.6), corner(3).clone(), new Vector3(-1.5, 0, 0), new Vector3(0, 0.4, 0)
  ]);

  function computeGoal(t) {
    const fit = aspect < 1 ? 1 / Math.max(0.5, aspect) : 1;
    const drift = Math.sin(t * 0.11) * 0.09;
    if (view === 'stage') {
      const p = clamp(progress);
      stageCam.getPointAt(smooth(p) * 0.999, goal.pos);
      stageLook.getPointAt(smooth(p) * 0.999, goal.look);
      if (p > 0.75) { const k = (p - 0.75) / 0.25; goal.pos.multiplyScalar(lerp(1, fit * 0.92, k)); }
    } else {
      const az = Math.PI * 0.42 + drift + ptr.x * 0.045;
      const el = 0.98 + ptr.y * 0.04;
      const dist = 21.5 * Math.min(1.75, fit * (view === 'treatment' ? 0.92 : 1));
      goal.pos.set(Math.cos(az) * Math.cos(el) * dist, Math.sin(el) * dist, Math.sin(az) * Math.cos(el) * dist);
      goal.look.set(-0.4, view === 'treatment' ? 0.4 : 0.9, 0.3);
    }
  }

  function update(dt, t) {
    // состояние: пружинное приближение к целевым значениям
    const before = S.fat;
    S.cap = damp(S.cap, T.cap, 2.2, dt);
    S.fat = damp(S.fat, T.fat, 1.8, dt);
    S.tissue = damp(S.tissue, T.tissue, 1.6, dt);
    S.shunt = damp(S.shunt, T.shunt, 2.4, dt);
    if (view === 'treatment') T.therapy = clamp(progress * 1.7 - 0.12);
    S.therapy = damp(S.therapy, T.therapy, 1.4, dt);
    if (Math.abs(S.fat - before) > 1e-4 || first) layoutCells();
    fatMesh.visible = S.fat > 0.005;

    // турбина: скорость = мощность цикла мочевины; в главе 5 ускоряется под действием орнитина
    const capEff = S.cap + S.therapy * 0.45;
    turbine.rotation.y += dt * 0.95 * capEff;
    turbMat.uniforms.uGain.value = 0.45 + 0.9 * clamp(capEff);
    turbMat.uniforms.uBody.value = 0.06 + 0.22 * clamp(capEff);
    beads.material.uniforms.uGain.value = 0.5 + 1.0 * clamp(capEff);
    gs.rotation.y -= dt * (0.5 + S.therapy * 0.25);
    shuntMat.uniforms.uOpacity.value = clamp(S.shunt / 0.65);
    shuntMesh.visible = S.shunt > 0.005;
    drug.visible = S.therapy > 0.005;
    tissue.visible = view !== 'stage' || S.tissue > 1.05;

    updateParticles(dt, t);

    ptr.x = damp(ptr.x, ptr.tx, 3, dt); ptr.y = damp(ptr.y, ptr.ty, 3, dt);
    computeGoal(t);
    if (first) { cam.pos.copy(goal.pos); cam.look.copy(goal.look); first = false; }
    dampV3(cam.pos, goal.pos, view === 'stage' ? 3.2 : 2.2, dt);
    dampV3(cam.look, goal.look, view === 'stage' ? 3.6 : 2.6, dt);
    camera.position.copy(cam.pos);
    camera.lookAt(cam.look);
  }

  return {
    scene, camera, labels, detail,
    setView(v, opts = {}) { if (v !== view) { view = v; if (opts.cut) first = true; } },
    setProgress(p) { progress = p; },
    setState(st) {
      if (st.cap != null) T.cap = st.cap;
      if (st.fat != null) T.fat = st.fat;
      if (st.tissue != null) T.tissue = st.tissue;
      if (st.shunt != null) T.shunt = st.shunt;
      if (st.therapy != null) T.therapy = st.therapy;
      if (st.instant) { Object.assign(S, T); layoutCells(); }
    },
    labelVisible(l) { return (!l.views || l.views.includes(view)) && (!l.when || l.when()); },
    setPointer(x, y) { ptr.tx = x; ptr.ty = y; },
    resize(w, h, fx = 0, fy = 0) { aspect = w / h; camera.aspect = aspect; camera.fov = aspect < 0.8 ? 44 : 34; frameCamera(camera, w, h, fx, fy); camera.updateProjectionMatrix(); bg.userData.setAspect(aspect); },
    update,
    dispose() { disposeTree(scene); }
  };
}
