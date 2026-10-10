/* Общий визуальный язык 3D-сцен: тёмное поле микроскопа.
   Структуры почти прозрачны и светятся краевым светом (fresnel rim), частицы — мягкие
   аддитивные точки. Цвет несёт смысл: бордо — аммиак, синий — обезвреживание (мочевина),
   бирюзовый — глутамин, жёлтый — жир. Цвета задаются hex без конвертации (ColorManagement off). */
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, ColorManagement,
  LinearFilter, Mesh, NormalBlending, Points, ShaderMaterial, Vector3
} from 'three';

ColorManagement.enabled = false;

export const PAL = {
  field: '#0B1220', haze: '#111B2E',
  nh3: '#8B1A1A', nh3Glow: '#C2413B',
  urea: '#1F3A5F', ureaGlow: '#5B8DC9',
  fat: '#E9D8A6', gln: '#3E8E8A', glnGlow: '#5FB3AD',
  ink: '#E8EEF5', ink2: '#9FB3CC', gold: '#E3C77A'
};
export const C = (h) => new Color(h);

/* ---------------------------------------------------------------- math */
export function rng(seed) {
  let a = seed | 0;
  return function () { a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (t) => t * t * (3 - 2 * t);
export const easeInOut = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeOut = (t) => 1 - Math.pow(1 - t, 3);
/* frame-rate independent exponential approach: «инерция и мягкое торможение» */
export const damp = (cur, target, lambda, dt) => lerp(cur, target, 1 - Math.exp(-lambda * dt));
export function dampV3(v, target, lambda, dt) { const k = 1 - Math.exp(-lambda * dt); v.x += (target.x - v.x) * k; v.y += (target.y - v.y) * k; v.z += (target.z - v.z) * k; return v; }

/* ---------------------------------------------------------------- fog shared by a scene */
export function makeFog(near, far, color = PAL.field) {
  return { uFogColor: { value: C(color) }, uFogNear: { value: near }, uFogFar: { value: far } };
}

const FOG_DECL = 'uniform vec3 uFogColor; uniform float uFogNear; uniform float uFogFar;';

/* ---------------------------------------------------------------- rim material
   instanceColor (если есть) задаёт цвет кромки конкретного экземпляра — так тонируются зоны дольки. */
const RIM_VS = /* glsl */`
varying vec3 vN; varying vec3 vV; varying float vDepth; varying vec3 vTint;
void main() {
  vec4 p = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    p = instanceMatrix * p;
    n = mat3(instanceMatrix) * n;
  #endif
  vTint = vec3(-1.0);
  #ifdef USE_INSTANCING_COLOR
    vTint = instanceColor;
  #endif
  vec4 mv = modelViewMatrix * p;
  vN = normalize(normalMatrix * n);
  vV = normalize(-mv.xyz);
  vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const RIM_FS = /* glsl */`
uniform vec3 uRim; uniform vec3 uBase; uniform float uPow; uniform float uGain; uniform float uBody; uniform float uOpacity;
${FOG_DECL}
varying vec3 vN; varying vec3 vV; varying float vDepth; varying vec3 vTint;
void main() {
  vec3 n = normalize(vN);
  float ndv = abs(dot(n, normalize(vV)));
  float f = pow(1.0 - ndv, uPow);
  vec3 rim = vTint.x < 0.0 ? uRim : vTint;
  float lam = 0.55 + 0.45 * max(dot(n, normalize(vec3(-0.3, 0.85, 0.4))), 0.0);
  vec3 c = uBase * lam + rim * (f * uGain + uBody);
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  c *= (1.0 - fog);
  gl_FragColor = vec4(c * uOpacity, 1.0);
}`;
export function rimMaterial(fog, o = {}) {
  return new ShaderMaterial({
    uniforms: {
      uRim: { value: C(o.rim || PAL.ink2) }, uBase: { value: C(o.base || '#000000') },
      uPow: { value: o.pow ?? 2.2 }, uGain: { value: o.gain ?? 1 }, uBody: { value: o.body ?? 0.06 },
      uOpacity: { value: o.opacity ?? 1 }, ...fog
    },
    vertexShader: RIM_VS, fragmentShader: RIM_FS,
    transparent: true, depthWrite: !!o.depthWrite, depthTest: o.depthTest ?? true,
    blending: AdditiveBlending
  });
}

/* ---------------------------------------------------------------- soft particles (Points)
   attributes: position, color (vec3), size (float), alpha (float) */
const PT_VS = /* glsl */`
attribute vec3 color; attribute float size; attribute float alpha;
uniform float uScale;
varying vec3 vC; varying float vA; varying float vDepth;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vC = color; vA = alpha * smoothstep(0.6, 2.2, -mv.z); vDepth = -mv.z;
  gl_PointSize = min(size * uScale / max(0.1, -mv.z), 48.0);
  gl_Position = projectionMatrix * mv;
}`;
const PT_FS = /* glsl */`
uniform float uCore;
${FOG_DECL}
varying vec3 vC; varying float vA; varying float vDepth;
void main() {
  vec2 d = gl_PointCoord - 0.5;
  float r = length(d) * 2.0;
  if (r > 1.0) discard;
  float halo = pow(1.0 - r, 2.2);
  float core = smoothstep(uCore, uCore * 0.4, r);
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  vec3 c = vC * (halo * 0.75 + core * 0.9) + vec3(core * 0.22);
  gl_FragColor = vec4(c * vA * (1.0 - fog), 1.0);
}`;
export function makePoints(count, fog, o = {}) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('size', new BufferAttribute(new Float32Array(count), 1));
  g.setAttribute('alpha', new BufferAttribute(new Float32Array(count), 1));
  const m = new ShaderMaterial({
    uniforms: { uScale: { value: o.scale ?? 300 }, uCore: { value: o.core ?? 0.42 }, ...fog },
    vertexShader: PT_VS, fragmentShader: PT_FS,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  });
  const p = new Points(g, m);
  p.frustumCulled = false;
  return p;
}
export function flagPoints(p) {
  const a = p.geometry.attributes;
  a.position.needsUpdate = true; a.color.needsUpdate = true; a.size.needsUpdate = true; a.alpha.needsUpdate = true;
}

/* ---------------------------------------------------------------- field background
   полноэкранный треугольник: дымка в центре поля зрения, затемнение к краям (окуляр) */
export function fieldBackground(o = {}) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const m = new ShaderMaterial({
    uniforms: {
      uField: { value: C(PAL.field) }, uHaze: { value: C(o.haze || PAL.haze) },
      uAspect: { value: 1 }, uCenter: { value: o.center || [0.5, 0.55] }, uGlow: { value: o.glow ?? 1 }
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * 0.5 + 0.5; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: /* glsl */`
      uniform vec3 uField; uniform vec3 uHaze; uniform float uAspect; uniform vec2 uCenter; uniform float uGlow;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      void main(){
        vec2 d = vUv - uCenter; d.x *= uAspect;
        float r = length(d) / max(1.0, uAspect * 0.62);
        float haze = exp(-r * r * 3.2) * uGlow;
        vec3 c = mix(uField, uHaze * 1.25, haze);
        c *= 1.0 - smoothstep(0.55, 1.25, r) * 0.45;
        c += (hash(gl_FragCoord.xy) - 0.5) / 255.0 * 2.0;  /* лёгкий дизеринг против полос */
        gl_FragColor = vec4(c, 1.0);
      }`,
    depthWrite: false, depthTest: false
  });
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = -100;
  mesh.userData.setAspect = (a) => { m.uniforms.uAspect.value = a; };
  return mesh;
}

/* ---------------------------------------------------------------- pen tube progress
   TubeGeometry: uv.x идёт вдоль пути 0..1 — по нему «дорисовываем» линию пера */
const PEN_VS = /* glsl */`
varying float vS; varying vec3 vN; varying vec3 vV; varying float vDepth;
void main(){
  vS = uv.x;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); vDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;
const PEN_FS = /* glsl */`
uniform float uFrom; uniform float uTo; uniform vec3 uInk; uniform vec3 uGlow; uniform float uOpacity; uniform float uNib;
${FOG_DECL}
varying float vS; varying vec3 vN; varying vec3 vV; varying float vDepth;
void main(){
  if (vS < uFrom || vS > uTo) discard;
  float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
  vec3 c = uInk * 0.95 + uGlow * f * 0.5;
  float nib = uNib * smoothstep(0.012, 0.0, abs(vS - uTo));
  c += uGlow * nib * 1.2;
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  gl_FragColor = vec4(c * uOpacity * (1.0 - fog), 1.0);
}`;
export function penMaterial(fog, o = {}) {
  return new ShaderMaterial({
    uniforms: {
      uFrom: { value: 0 }, uTo: { value: o.to ?? 1 }, uInk: { value: C(o.ink || PAL.nh3) }, uGlow: { value: C(o.glow || PAL.nh3Glow) },
      uOpacity: { value: o.opacity ?? 1 }, uNib: { value: o.nib ?? 1 }, ...fog
    },
    vertexShader: PEN_VS, fragmentShader: PEN_FS,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  });
}

/* ---------------------------------------------------------------- billboard rings (TSC circles)
   кружок с номером из атласа; размытие по глубине — «фокус микроскопа» без постобработки */
export function numberAtlas(count, o = {}) {
  const cols = Math.ceil(Math.sqrt(count)), cell = o.cell || 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = cols * cell;
  const g = cv.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, cv.width, cv.height);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `500 ${Math.round(cell * (o.fontK || 0.36))}px "IBM Plex Mono", ui-monospace, Menlo, monospace`;
  g.fillStyle = '#fff';
  for (let i = 0; i < count; i++) {
    const x = (i % cols) * cell + cell / 2, y = Math.floor(i / cols) * cell + cell / 2;
    g.fillText(String(o.labels ? o.labels[i] : i + 1), x, y + cell * 0.02);
  }
  const tex = new CanvasTexture(cv);
  tex.flipY = false; tex.minFilter = LinearFilter; tex.magFilter = LinearFilter; tex.generateMipmaps = false;
  return { tex, cols };
}

const RING_VS = /* glsl */`
attribute float num; attribute float size; attribute vec3 color; attribute float fill; attribute float alpha;
uniform float uScale; uniform float uFocus; uniform float uDof;
varying float vNum; varying vec3 vC; varying float vFill; varying float vA; varying float vBlur; varying float vDepth;
void main(){
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vDepth = -mv.z; vNum = num; vC = color; vFill = fill; vA = alpha;
  vBlur = clamp(abs(vDepth - uFocus) * uDof, 0.0, 1.0);
  gl_PointSize = size * uScale / max(0.1, vDepth) * (1.0 + vBlur * 0.35);
  gl_Position = projectionMatrix * mv;
}`;
const RING_FS = /* glsl */`
uniform sampler2D uAtlas; uniform float uCols; uniform vec3 uInkNum; uniform float uShowNum; uniform vec3 uMark;
${FOG_DECL}
varying float vNum; varying vec3 vC; varying float vFill; varying float vA; varying float vBlur; varying float vDepth;
void main(){
  vec2 p = gl_PointCoord - 0.5;
  float r = length(p) * 2.0;
  float w = 0.06 + vBlur * 0.22;
  float ring = smoothstep(0.80 + w, 0.80, r) * smoothstep(0.66 - w, 0.66, r);
  if (r > 1.0) discard;
  float halo = exp(-pow((r - 0.73) / (0.14 + vBlur * 0.22), 2.0)) * 0.5 * smoothstep(1.0, 0.86, r);
  float disc = smoothstep(0.70, 0.62 - w, r);
  float cell = floor(vNum + 0.5);
  vec2 uv = (vec2(mod(cell, uCols), floor(cell / uCols)) + vec2(gl_PointCoord.x, gl_PointCoord.y) * 0.84 + 0.08) / uCols;
  float glyph = texture2D(uAtlas, uv).r * smoothstep(0.62, 0.5, r) * (1.0 - vBlur * 0.85) * uShowNum;
  vec3 c = vC * (ring * (1.0 - vBlur * 0.55) + halo) + uMark * disc * vFill * 1.1;
  c += mix(uInkNum, vec3(1.0), vFill) * glyph * (1.0 - vFill * 0.15);
  float fog = smoothstep(uFogNear, uFogFar, vDepth);
  gl_FragColor = vec4(c * vA * (1.0 - fog * 0.85), 1.0);
}`;
export function makeRings(count, atlas, fog, o = {}) {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('num', new BufferAttribute(new Float32Array(count), 1));
  g.setAttribute('size', new BufferAttribute(new Float32Array(count), 1));
  g.setAttribute('color', new BufferAttribute(new Float32Array(count * 3), 3));
  g.setAttribute('fill', new BufferAttribute(new Float32Array(count), 1));
  g.setAttribute('alpha', new BufferAttribute(new Float32Array(count), 1));
  const m = new ShaderMaterial({
    uniforms: {
      uAtlas: { value: atlas.tex }, uCols: { value: atlas.cols }, uScale: { value: o.scale ?? 300 },
      uFocus: { value: o.focus ?? 20 }, uDof: { value: o.dof ?? 0.06 }, uInkNum: { value: C(o.inkNum || PAL.ink) },
      uShowNum: { value: 1 }, uMark: { value: C(o.mark || PAL.nh3) }, ...fog
    },
    vertexShader: RING_VS, fragmentShader: RING_FS,
    transparent: true, depthWrite: false, blending: AdditiveBlending
  });
  const pts = new Points(g, m);
  pts.frustumCulled = false;
  return pts;
}

/* ---------------------------------------------------------------- composition offset
   сдвиг центра кадра (доли ширины/высоты), чтобы сцена не пряталась под текстом */
export function frameCamera(camera, w, h, fx = 0, fy = 0) {
  if (fx || fy) camera.setViewOffset(w, h, -fx * w, -fy * h, w, h);
  else camera.clearViewOffset();
}

/* ---------------------------------------------------------------- disposal */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.isInstancedMesh) o.dispose();   // освобождает буферы instanceMatrix / instanceColor
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const ms = Array.isArray(o.material) ? o.material : [o.material];
      ms.forEach((m) => {
        Object.values(m.uniforms || {}).forEach((u) => { if (u && u.value && u.value.isTexture) u.value.dispose(); });
        m.dispose();
      });
    }
  });
}

export { AdditiveBlending, NormalBlending, Vector3 };
