/* Лупа микроскопа: круг над окном сцены, в нём — увеличенный участок кадра и подписи деталей
   (зоны, ферменты, элементы портального тракта), которых нет на общем плане.
   Десктоп — наведение курсора; телефон — долгое касание (палец можно вести, отпустить — закрыть). */
import { Vector3 } from 'three';

export function createLoupe(host, o = {}) {
  const R = o.r || 78, ZOOM = o.zoom || 2.2;
  const el = document.createElement('div');
  el.className = 'gl-loupe';
  el.setAttribute('aria-hidden', 'true');
  const cv = document.createElement('canvas');
  const lay = document.createElement('div');
  lay.className = 'gl-loupe-labels';
  el.append(cv, lay);
  host.appendChild(el);
  const ctx = cv.getContext('2d');
  const st = { on: false, x: 0, y: 0, inst: null, spans: [] };
  const V = new Vector3();

  function place(cx, cy) {
    const r = host.getBoundingClientRect();
    st.x = Math.max(0, Math.min(r.width, cx - r.left)); st.y = Math.max(0, Math.min(r.height, cy - r.top));
    el.style.transform = `translate(${(st.x - R).toFixed(1)}px, ${(st.y - R).toFixed(1)}px)`;
  }
  function show(v) { st.on = v; el.classList.toggle('on', v); host.classList.toggle('loupe-on', v); }

  host.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { place(e.clientX, e.clientY); if (!st.on) show(true); }
    else if (st.on) { place(e.clientX, e.clientY); }
  });
  host.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') show(false); });
  let timer = 0, sx = 0, sy = 0;
  host.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    sx = e.clientX; sy = e.clientY;
    clearTimeout(timer);
    timer = setTimeout(() => { place(sx, sy); show(true); }, 420);
  });
  host.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' && !st.on && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clearTimeout(timer); });
  ['pointerup', 'pointercancel'].forEach((t) => host.addEventListener(t, (e) => { if (e.pointerType !== 'mouse') { clearTimeout(timer); show(false); } }));
  host.addEventListener('contextmenu', (e) => { if (st.on) e.preventDefault(); });

  function labels(inst) {
    if (st.inst === inst) return;
    st.inst = inst; lay.textContent = '';
    st.spans = (inst.detail || []).map((d) => { const s = document.createElement('span'); s.textContent = d.text; lay.appendChild(s); return s; });
  }

  return {
    get on() { return st.on; },
    /* вызывается сразу после renderer.render — буфер кадра ещё действителен */
    draw(glCanvas, inst, camera, dpr) {
      if (!st.on) return;
      const size = R * 2, px = Math.round(size * dpr);
      if (cv.width !== px) { cv.width = cv.height = px; }
      const s = size / ZOOM;
      ctx.drawImage(glCanvas, (st.x - s / 2) * dpr, (st.y - s / 2) * dpr, s * dpr, s * dpr, 0, 0, px, px);
      labels(inst);
      const w = host.clientWidth, h = host.clientHeight;
      (inst.detail || []).forEach((d, i) => {
        const sp = st.spans[i]; if (!sp) return;
        V.copy(d.at).project(camera);
        const dx = ((V.x + 1) / 2 * w - st.x) * ZOOM, dy = ((1 - V.y) / 2 * h - st.y) * ZOOM;
        const inside = V.z < 1 && Math.hypot(dx, dy) < R - 12;
        sp.classList.toggle('on', inside);
        if (inside) sp.style.transform = `translate(${(R + dx).toFixed(1)}px, ${(R + dy).toFixed(1)}px)`;
      });
    },
    hide() { show(false); },
    destroy() { el.remove(); }
  };
}
