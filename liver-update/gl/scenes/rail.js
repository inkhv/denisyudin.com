/* Рельс глав — «линия пера» в пространстве. Семь узлов-глав соединены бордовой трубкой,
   камера летит по ней от узла к узлу. Путь построен как анаморфоза: каждая точка лежит на луче
   из одной фронтальной точки F в контур печени, но на своей глубине. Изнутри доклада это
   ломаная линия в глубине тёмного поля; в финале камера отъезжает в F — и путь глав
   складывается в силуэт печени («соединили числа — получилась печень»). */
import { CatmullRomCurve3, Group, LineBasicMaterial, Mesh, PerspectiveCamera, Scene, TubeGeometry, Vector3, AdditiveBlending } from 'three';
import {
  PAL, C, rng, clamp, lerp, smooth, easeInOut, damp, dampV3, makeFog, makePoints, flagPoints, makeRings,
  numberAtlas, penMaterial, fieldBackground, disposeTree, frameCamera
} from '../lib.js';

const D = 64;                                   // фронтальная точка F = (0, 0, D)
const F = new Vector3(0, 0, D);
/* контур печени, вид спереди (правая доля слева на экране), по часовой стрелке от главы 1 */
const OUT = [
  [-19.8, 1.5], [-17.6, 6.6], [-12.0, 9.9], [-4.0, 10.7], [4.0, 9.8], [11.0, 7.4], [17.0, 4.1], [21.6, 1.2],
  [17.6, 0.0], [10.5, -1.5], [4.2, -3.1], [1.7, -2.3], [-0.7, -4.7], [-6.0, -7.7], [-11.2, -9.5]
];
const ZK = [-6, 8, -12, 4, 10, -8, 2, -14, 6, -4, 9, -10, 3, -7, 7];
const CH_IDX = [0, 2, 4, 6, 9, 12, 14];        // контрольные точки глав 1…7
const CLOSE = [[-11.2, -9.5], [-15.8, -9.1], [-19.2, -4.6], [-19.8, 1.5]];
const CLOSE_Z = [7, -3, 5, -6];

function lift(x, y, z) { const s = 1 - z / D; return new Vector3(x * s, y * s, z); }
function sample(pts2, zs, n) {
  const c2 = new CatmullRomCurve3(pts2.map(([x, y]) => new Vector3(x, y, 0)), false, 'centripetal');
  const cz = new CatmullRomCurve3(zs.map((z, i) => new Vector3(i, z, 0)), false, 'catmullrom', 0.5);
  const out = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const p = c2.getPoint(t), z = cz.getPoint(t).y;
    out.push(lift(p.x, p.y, z));
  }
  return new CatmullRomCurve3(out, false, 'catmullrom', 0.5);
}

export function create(ctx) {
  const K = ctx.tier === 'high' ? 1 : ctx.tier === 'medium' ? 0.7 : 0.45;
  const scene = new Scene();
  const fog = makeFog(30, 150);
  const camera = new PerspectiveCamera(36, 1, 0.1, 400);
  const bg = fieldBackground({ center: [0.5, 0.5], glow: 0.9 });
  scene.add(bg);
  const root = new Group();
  scene.add(root);

  const main = sample(OUT, ZK, 520);
  const close = sample(CLOSE, CLOSE_Z, 160);
  const tOf = (ch) => CH_IDX[ch - 1] / (OUT.length - 1);           // параметр узла главы на main
  const nodeP = (ch) => main.getPoint(tOf(ch));
  // «хвост» до главы 1 лежит на том же луче из F, поэтому в финале он не виден
  const n1 = nodeP(1);
  const startP = F.clone().lerp(n1, 0.55);
  const tail = new CatmullRomCurve3([startP, F.clone().lerp(n1, 0.8), n1]);

  /* ---------------- трубки: бледный «карандаш» всего пути + чернила пройденного */
  const guideMat = penMaterial(fog, { ink: '#1E2A3F', glow: '#33435E', nib: 0, opacity: 0.9 });
  root.add(new Mesh(new TubeGeometry(main, 900, 0.07, 6, false), guideMat));
  const inkMat = penMaterial(fog, { to: 0 });
  root.add(new Mesh(new TubeGeometry(main, 900, 0.16, 8, false), inkMat));
  const tailMat = penMaterial(fog, { to: 0, nib: 0 });
  root.add(new Mesh(new TubeGeometry(tail, 60, 0.16, 8, false), tailMat));
  const closeMat = penMaterial(fog, { to: 0 });
  root.add(new Mesh(new TubeGeometry(close, 260, 0.16, 8, false), closeMat));
  const closeGuide = penMaterial(fog, { ink: '#1E2A3F', glow: '#33435E', nib: 0, opacity: 0.0 });
  root.add(new Mesh(new TubeGeometry(close, 260, 0.07, 6, false), closeGuide));

  /* ---------------- узлы глав 1…7 */
  const atlas = numberAtlas(7, { cell: 128, fontK: 0.42 });
  const rings = makeRings(7, atlas, fog, { scale: 700, focus: 14, dof: 0.025 });
  root.add(rings);
  const ra = rings.geometry.attributes;
  const cInk = C(PAL.ink2), cDone = C(PAL.nh3Glow);
  for (let i = 0; i < 7; i++) {
    const p = nodeP(i + 1);
    ra.position.array.set([p.x, p.y, p.z], i * 3);
    ra.num.array[i] = i; ra.size.array[i] = 2.4; ra.alpha.array[i] = 1;
    ra.color.array.set([cInk.r, cInk.g, cInk.b], i * 3);
  }

  /* ---------------- частицы аммиака вдоль пройденного пути + пыль поля */
  const NP = Math.round(260 * K);
  const flow = makePoints(NP, fog, { scale: 520 });
  root.add(flow);
  const rr = rng(77);
  const P = []; for (let i = 0; i < NP; i++) P.push({ u: rr(), sp: 0.018 + rr() * 0.012, j: new Vector3(rr() - 0.5, rr() - 0.5, rr() - 0.5).multiplyScalar(0.45) });
  const ND = Math.round(500 * K);
  const dust = makePoints(ND, fog, { scale: 520, core: 0.7 });
  root.add(dust);
  const DS = []; for (let i = 0; i < ND; i++) DS.push({ p: new Vector3((rr() - 0.5) * 90, (rr() - 0.5) * 60, (rr() - 0.5) * 80), ph: rr() * 6.3, s: 0.12 + rr() * 0.25 });
  const cN = C(PAL.nh3Glow), cD = C(PAL.ink2);

  /* ---------------- состояние */
  let view = 'node', from = 0, to = 1, flightT = 0, flightDur = 1.8, finaleT = 0, ink = 0, inkClose = 0;
  let done = {}, finished = false, aspect = 1, first = true, progress = 0;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  const cam = new Vector3(), look = new Vector3(), gPos = new Vector3(), gLook = new Vector3();
  const tmp = new Vector3(), tmp2 = new Vector3();
  let fovGoal = 36, frame = [1, 1, 0, 0];
  /* в финале силуэт держим почти по центру: смещение только по вертикали */
  function applyFrame() {
    const [w, h, fx, fy] = frame;
    // финал: силуэт над текстом сцены — выше центра и почти без сдвига по горизонтали
    if (view === 'finale') frameCamera(camera, w, h, aspect < 0.95 ? 0 : 0.1, aspect < 0.95 ? -0.2 : -0.17);
    else frameCamera(camera, w, h, fx, fy);
  }

  function paramOf(ch) { return ch <= 0 ? -1 : tOf(ch); }
  /* точка пути по «расширенному» параметру: [-1, 0] — хвост, [0, 1] — основной путь */
  function pathPoint(u, out) {
    if (u < 0) return tail.getPoint(clamp(u + 1), out);
    return main.getPoint(clamp(u), out);
  }
  function nodePose(ch, out, outLook) {
    const p = nodeP(ch);
    // камера перед узлом, со стороны F, чуть сверху и сбоку
    const dir = F.clone().sub(p).normalize();
    out.copy(p).addScaledVector(dir, 17).add(tmp2.set(3.2, 2.0, 0));
    outLook.copy(p).add(tmp2.set(0.6, -0.3, 0));
    return out;
  }
  function frontFov() {
    // в F весь силуэт (≈ 44 × 22) должен поместиться в кадр при любой ориентации экрана
    const halfW = 25, halfH = aspect < 0.95 ? 22 : 22.5;
    const v = Math.max(2 * Math.atan(halfH / D), 2 * Math.atan(halfW / (D * aspect)));
    return v * 180 / Math.PI;
  }

  function update(dt, t) {
    ptr.x = damp(ptr.x, ptr.tx, 2.5, dt); ptr.y = damp(ptr.y, ptr.ty, 2.5, dt);
    const ua = paramOf(from), ub = paramOf(to);
    if (view === 'arrive') {
      flightT += dt;
      const k = clamp(flightT / flightDur);
      const e = easeInOut(k);
      const u = lerp(ua, ub, e);
      ink = Math.max(ink, Math.max(0, u));
      tailMat.uniforms.uTo.value = u < 0 ? u + 1 : 1;
      pathPoint(u, tmp);
      pathPoint(Math.min(ub + 0.02, u + 0.035 * Math.sign(ub - ua || 1)), tmp2);
      const ride = tmp.clone().add(new Vector3(0, 2.2, 0)).addScaledVector(F.clone().sub(tmp).normalize(), 6);
      nodePose(to, gPos, gLook);
      const blend = smooth(clamp((k - 0.6) / 0.4));
      gPos.copy(ride.lerp(gPos, blend));
      gLook.copy(tmp2.lerp(gLook, blend));
      fovGoal = 40;
      finished = k >= 1 && flightT > flightDur + 0.25;
    } else if (view === 'finale') {
      finaleT += dt;
      ink = 1;
      const k = smooth(clamp((finaleT - 0.6) / 4.2));
      nodePose(7, tmp, tmp2);
      gPos.copy(tmp).lerp(F, k);
      gLook.copy(tmp2).lerp(new Vector3(0, 0.6, 0), k);
      gPos.x += ptr.x * 0.6 * k; gPos.y += ptr.y * 0.4 * k;
      inkClose = smooth(clamp((finaleT - 2.2) / 2.4));
      fovGoal = lerp(40, frontFov(), k);
      finished = finaleT > 5;
    } else { // node
      ink = Math.max(ink, paramOf(to));
      nodePose(to, gPos, gLook);
      gPos.x += Math.sin(t * 0.21) * 0.5 + ptr.x * 0.9; gPos.y += Math.sin(t * 0.17) * 0.3 + ptr.y * 0.6;
      fovGoal = 40;
      finished = true;
    }
    inkMat.uniforms.uTo.value = ink;
    inkMat.uniforms.uNib.value = view === 'arrive' && !finished ? 1 : 0;
    closeMat.uniforms.uTo.value = inkClose;
    closeMat.uniforms.uNib.value = inkClose > 0 && inkClose < 1 ? 1 : 0;
    closeGuide.uniforms.uOpacity.value = view === 'finale' ? 0.9 : 0;
    if (view !== 'arrive') tailMat.uniforms.uTo.value = 1;

    // узлы: пройденные главы получают бордовую отметку, текущая — крупнее
    for (let i = 0; i < 7; i++) {
      const ch = i + 1;
      const isCur = view !== 'finale' && ch === to;
      ra.fill.array[i] = done[ch] ? 1 : 0;
      const c = done[ch] ? cDone : cInk;
      ra.color.array[i * 3] = c.r; ra.color.array[i * 3 + 1] = c.g; ra.color.array[i * 3 + 2] = c.b;
      ra.size.array[i] = damp(ra.size.array[i], isCur ? 3.2 : 2.4, 3, dt);
    }
    ra.fill.needsUpdate = true; ra.size.needsUpdate = true; ra.color.needsUpdate = true;

    // частицы бегут по пройденной части
    const fa = flow.geometry.attributes;
    for (let i = 0; i < NP; i++) {
      const p = P[i];
      p.u = (p.u + p.sp * dt) % 1;
      const u = p.u * Math.max(0.001, ink);
      main.getPoint(u, tmp).add(p.j);
      fa.position.array[i * 3] = tmp.x; fa.position.array[i * 3 + 1] = tmp.y; fa.position.array[i * 3 + 2] = tmp.z;
      fa.color.array[i * 3] = cN.r; fa.color.array[i * 3 + 1] = cN.g; fa.color.array[i * 3 + 2] = cN.b;
      fa.size.array[i] = 0.55; fa.alpha.array[i] = ink > 0.002 ? 0.75 : 0;
    }
    flagPoints(flow);
    const da = dust.geometry.attributes;
    for (let i = 0; i < ND; i++) {
      const q = DS[i];
      da.position.array[i * 3] = q.p.x + Math.sin(t * 0.1 + q.ph) * 0.8;
      da.position.array[i * 3 + 1] = q.p.y + Math.cos(t * 0.08 + q.ph) * 0.8;
      da.position.array[i * 3 + 2] = q.p.z;
      da.color.array[i * 3] = cD.r; da.color.array[i * 3 + 1] = cD.g; da.color.array[i * 3 + 2] = cD.b;
      da.size.array[i] = q.s; da.alpha.array[i] = 0.3;
    }
    flagPoints(dust);

    // фокус «микроскопа» — на текущем узле
    const focusD = camera.position.distanceTo(view === 'finale' ? new Vector3() : nodeP(to));
    rings.material.uniforms.uFocus.value = focusD;
    rings.material.uniforms.uDof.value = view === 'finale' ? 0.004 : 0.035;
    rings.material.uniforms.uScale.value = view === 'finale' ? lerp(700, 1500, smooth(clamp((finaleT - 0.6) / 4.2))) : 700;

    if (first) { cam.copy(gPos); look.copy(gLook); camera.fov = fovGoal; first = false; }
    const lam = view === 'arrive' ? 6 : 2.2;
    dampV3(cam, gPos, lam, dt); dampV3(look, gLook, lam, dt);
    camera.fov = damp(camera.fov, fovGoal, 3, dt);
    camera.updateProjectionMatrix();
    camera.position.copy(cam); camera.lookAt(look);
  }

  return {
    scene, camera, labels: [],
    get finished() { return finished; },
    setView(v, o = {}) {
      if (v === 'arrive') { flightT = 0; finished = false; const hops = Math.abs(to - from); flightDur = Math.min(3.2, 1.5 + 0.35 * Math.max(0, hops - 1)); }
      if (v === 'finale') { finaleT = 0; finished = false; }
      if (v !== view || o.cut) { view = v; if (o.cut && v !== 'arrive') first = true; if (v === 'arrive') first = true; applyFrame(); }
    },
    setProgress(p) { progress = p; },
    setState(st) {
      if (st.from != null) from = st.from;
      if (st.to != null) to = st.to;
      if (st.done) done = st.done;
      if (st.finaleT != null) finaleT = st.finaleT;
    },
    setPointer(x, y) { ptr.tx = x; ptr.ty = y; },
    resize(w, h, fx = 0, fy = 0) { aspect = w / h; frame = [w, h, fx, fy]; camera.aspect = aspect; applyFrame(); camera.updateProjectionMatrix(); bg.userData.setAspect(aspect); },
    update,
    dispose() { disposeTree(scene); }
  };
}
