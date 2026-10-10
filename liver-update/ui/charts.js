/* Графики без библиотек: SVG рисуется в реальную ширину контейнера, чтобы подписи оставались
   читаемыми на телефоне. Реестр графиков перерисовывает их при смене главы и при resize. */
import { COLORS, fmt, esc } from './core.js';

/* ------------------------------------------------------------ registry */
let charts = [];
export function registerChart(el, draw) { charts.push({ el: el, draw: draw }); draw(); }
export function redrawCharts(scope) { charts.forEach((c) => { if (!scope || scope.contains(c.el)) c.draw(); }); }
// drop charts whose element was replaced (evidence explorer re-renders its detail pane)
export function pruneCharts() { charts = charts.filter((c) => document.body.contains(c.el)); }

let inited = false;
export function initCharts() {
  if (inited) return;
  inited = true;
  let rT = 0;
  window.addEventListener('resize', () => { clearTimeout(rT); rT = setTimeout(() => { redrawCharts(document.querySelector('.chapter.is-active')); }, 150); });
  // keyframes for horizontal growth (kept here to stay next to its only user, hbar)
  const st = document.createElement('style'); st.textContent = '@keyframes growX{from{transform:scaleX(0)}}'; document.head.appendChild(st);
}

/* ------------------------------------------------------------ helpers */
export function niceMax(v) {
  if (v <= 0) return 1;
  const raw = v * 1.15, p = Math.pow(10, Math.floor(Math.log10(raw)));
  const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];
  for (let i = 0; i < steps.length; i++) if (steps[i] * p >= raw) return steps[i] * p;
  return 10 * p;
}
/* split a category label into lines that fit maxW px (approximate glyph width for Plex Sans) */
export function wrapLabel(text, maxW, size) {
  const cw = size * 0.56, out = [];
  String(text).split('\n').forEach((part) => {
    if (part.length * cw <= maxW) { out.push(part); return; }
    const words = part.replace(/, /g, ',\u0001').split(/[ \u0001]/);
    let line = '';
    words.forEach((w) => {
      const t = line ? line + ' ' + w : w;
      if (t.length * cw > maxW && line) { out.push(line); line = w; } else line = t;
    });
    if (line) out.push(line);
  });
  return out;
}
export function legend(series) {
  return '<ul class="legend">' + series.map((s) => '<li><i style="background:' + COLORS[s.c] + '"></i>' + esc(s.name) + '</li>').join('') + '</ul>';
}

/* ------------------------------------------------------------ grouped vertical bars, drawn at real pixel width so text stays readable on phones */
export function vbar(el, cfg) {
  registerChart(el, () => {
    if (!el.offsetParent && el.clientWidth === 0) return;
    const W = Math.max(260, Math.round(el.clientWidth || 560));
    const narrow = W < 460;
    const H = cfg.height || (narrow ? 230 : 268);
    const cats = cfg.cats, series = cfg.series;
    const gw0 = (W - 44) / cats.length;
    const wrapped = cats.map((c) => wrapLabel(c, gw0 - 6, 12));
    const lines = Math.max.apply(null, wrapped.map((w) => w.length));
    const padL = 38, padR = 6, padT = 22, padB = 18 + lines * 14;
    const iw = W - padL - padR, ih = H - padT - padB;
    const all = []; series.forEach((s) => { s.v.forEach((v) => { if (v != null) all.push(v); }); });
    const max = cfg.max || niceMax(Math.max.apply(null, all));
    const d = cfg.decimals;
    const aria = cats.map((c, ci) => c.replace('\n', ' ') + ': ' + series.map((s) => s.name + ' ' + fmt(s.v[ci], d)).join(', ')).join('; ');
    let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc((cfg.title ? cfg.title + '. ' : '') + aria) + '">';
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const y = padT + ih - ih * i / ticks, tv = max * i / ticks;
      s += '<line class="c-grid" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '"/>';
      s += '<text class="c-tick" x="' + (padL - 6) + '" y="' + (y + 4) + '" text-anchor="end">' + fmt(tv, max < 1 ? 2 : (max < 10 && tv % 1 ? 1 : 0)) + '</text>';
    }
    const gw = iw / cats.length, n = series.length;
    const bw = Math.min(narrow ? 30 : 46, gw * 0.8 / n), gap = Math.min(5, bw * 0.15);
    const groupW = n * bw + (n - 1) * gap;
    const vFont = (narrow && n >= 3) || bw < 24 ? 10 : 12;
    cats.forEach((c, ci) => {
      const gx = padL + gw * ci + (gw - groupW) / 2;
      series.forEach((sr, si) => {
        const v = sr.v[ci]; if (v == null) return;
        const h = Math.max(1, ih * v / max), x = gx + si * (bw + gap), y = padT + ih - h;
        s += '<rect class="c-bar" x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="2" fill="' + COLORS[sr.c] + '" style="animation-delay:' + (si * 90 + ci * 40) + 'ms"/>';
        s += '<text class="c-val" style="font-size:' + vFont + 'px" x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '">' + fmt(v, d) + '</text>';
      });
      wrapped[ci].forEach((ln, li) => {
        s += '<text class="c-cat" x="' + (padL + gw * ci + gw / 2).toFixed(1) + '" y="' + (padT + ih + 17 + li * 14) + '">' + esc(ln) + '</text>';
      });
    });
    s += '<line class="c-axis" x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + ih) + '" y2="' + (padT + ih) + '"/>';
    s += '</svg>';
    el.innerHTML = (cfg.title ? '<p class="chart-title">' + esc(cfg.title) + '</p>' : '') + s + (series.length > 1 || cfg.legend ? legend(series) : '');
  });
}

/* ------------------------------------------------------------ horizontal bars with an optional dashed guide (the reader's guess) */
export function hbar(el, cfg) {
  registerChart(el, () => {
    if (!el.offsetParent && el.clientWidth === 0) return;
    const W = Math.max(260, Math.round(el.clientWidth || 560));
    const narrow = W < 520;
    const labelW = narrow ? Math.min(140, Math.round(W * 0.42)) : 220;
    const rowH = 46, padT = cfg.guide != null ? 30 : 8, padB = 26;
    const x0 = labelW + 10, x1 = W - 52;
    const H = padT + cfg.rows.length * rowH + padB;
    const max = cfg.max || 100;
    const X = (v) => x0 + (x1 - x0) * v / max;
    const aria = cfg.rows.map((r) => r.label + ' (' + r.sub + '): ' + fmt(r.v) + (cfg.unit || '')).join('; ');
    let s = '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc((cfg.title ? cfg.title + '. ' : '') + aria) + '">';
    [0, 25, 50, 75, 100].forEach((t) => {
      s += '<line class="c-grid" x1="' + X(t) + '" x2="' + X(t) + '" y1="' + padT + '" y2="' + (H - padB) + '"/>';
      s += '<text class="c-tick" x="' + X(t) + '" y="' + (H - 8) + '" text-anchor="middle">' + t + (cfg.unit || '') + '</text>';
    });
    cfg.rows.forEach((r, i) => {
      const cy = padT + i * rowH + rowH / 2;
      s += '<text class="fl-t" x="0" y="' + (cy - 3) + '" style="font-size:' + (narrow ? 12 : 13) + 'px">' + esc(r.label) + '</text>';
      s += '<text class="fl-s" x="0" y="' + (cy + 13) + '" style="font-size:' + (narrow ? 10 : 11) + 'px">' + esc(r.sub) + '</text>';
      s += '<rect x="' + x0 + '" y="' + (cy - 9) + '" width="' + (x1 - x0) + '" height="18" rx="3" fill="#F4F6F9"/>';
      s += '<rect class="c-bar" style="transform-origin:left;animation-name:growX;animation-delay:' + (i * 80) + 'ms" x="' + x0 + '" y="' + (cy - 9) + '" width="' + Math.max(1, X(r.v) - x0).toFixed(1) + '" height="18" rx="3" fill="' + COLORS[r.c || 'bordo'] + '"/>';
      s += '<text class="c-val" style="text-anchor:start" x="' + (X(r.v) + 6).toFixed(1) + '" y="' + (cy + 4) + '">' + fmt(r.v) + (cfg.unit || '') + '</text>';
    });
    if (cfg.guide != null) {
      const gx = X(cfg.guide);
      s += '<line class="c-guide" x1="' + gx + '" x2="' + gx + '" y1="' + (padT - 6) + '" y2="' + (H - padB) + '"/>';
      const anchor = gx > W - 90 ? 'end' : (gx < x0 + 60 ? 'start' : 'middle');
      s += '<text class="c-guide-t" x="' + gx + '" y="' + (padT - 12) + '" text-anchor="' + anchor + '">ваша оценка: ' + cfg.guide + (cfg.unit || '') + '</text>';
    }
    s += '</svg>';
    el.innerHTML = (cfg.title ? '<p class="chart-title">' + esc(cfg.title) + '</p>' : '') + s;
  });
}
