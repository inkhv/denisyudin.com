import { clamp, fmt, gridGeometry, shapeGeometry, exampleNodes, EXAMPLES } from './geometry.mjs';
import {moveRouteNode, reverseRoute, canContinueRoute, continueRoute} from './route.mjs';

const $ = id => document.getElementById(id);
const STORAGE = 'denisyudin.hofmann.v1';
const PALETTE = ['#111111', '#e1495f', '#130a66', '#00bfd9'];
const newShape = (id = 1) => ({ id, nodes: [], closed: false, stroke: PALETTE[(id - 1) % PALETTE.length], fill: PALETTE[(id - 1) % PALETTE.length], width: 6 });
const initialState = () => ({ version: 1, width: 1080, height: 1080, cols: 4, rows: 4, diameter: 88, margin: 8, mode: 'outline', guides: 'circles', background: '#ffffff', exportGrid: false, transparent: false, active: 0, shapes: [{ ...newShape(), nodes: exampleNodes(0), closed: true }] });
let state = initialState();
let preview = false, selectedNode = -1, keyboardPin = { c: 0, r: 0 };
let past = [], future = [], inputGroup = null, saveTimer;
const clone = value => JSON.parse(JSON.stringify(value));
const activeShape = () => state.shapes[state.active];
const hex = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const numeric = (value, low, high, fallback, integer = false) => {
  const n = Number(value);
  return Number.isFinite(n) ? clamp(integer ? Math.round(n) : n, low, high) : fallback;
};

function restore(raw) {
  if (!raw || raw.version !== 1 || !Array.isArray(raw.shapes)) return null;
  const clean = initialState();
  for (const key of ['width', 'height']) clean[key] = numeric(raw[key], 200, 4096, 1080, true);
  for (const key of ['cols', 'rows']) clean[key] = numeric(raw[key], 1, 24, 4, true);
  clean.diameter = numeric(raw.diameter, 5, 99.5, 88);
  clean.margin = numeric(raw.margin, 2, 30, 8);
  clean.mode = ['outline', 'fill', 'both'].includes(raw.mode) ? raw.mode : 'outline';
  clean.guides = ['circles', 'dots', 'none'].includes(raw.guides) ? raw.guides : 'circles';
  clean.background = hex(raw.background) ? raw.background : '#ffffff';
  clean.exportGrid = raw.exportGrid === true;
  clean.transparent = raw.transparent === true;
  clean.shapes = raw.shapes.slice(0, 32).map((shape, i) => {
    const seen = new Set();
    const nodes = (Array.isArray(shape?.nodes) ? shape.nodes : []).slice(0, 576).filter(n => {
      if (!n || !Number.isInteger(n.c) || !Number.isInteger(n.r) || n.c < 0 || n.r < 0 || n.c >= clean.cols || n.r >= clean.rows) return false;
      const key = `${n.c},${n.r}`;
      if (seen.has(key)) return false;
      seen.add(key); return true;
    }).map(n => ({ c: n.c, r: n.r, turn: [-1, 1].includes(n.turn) ? n.turn : 0 }));
    return { ...newShape(i + 1), nodes, closed: shape.closed === true && nodes.length > 0, stroke: hex(shape.stroke) ? shape.stroke : '#111111', fill: hex(shape.fill) ? shape.fill : '#111111', width: numeric(shape.width, 1, 40, 6) };
  });
  if (!clean.shapes.length) clean.shapes.push(newShape());
  clean.active = numeric(raw.active, 0, clean.shapes.length - 1, 0, true);
  return clean;
}

function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify(state)); }
  catch { $('saveStatus').textContent = 'Автосохранение недоступно. Скачай SVG перед закрытием.'; }
}
try { const saved = JSON.parse(localStorage.getItem(STORAGE) || 'null'); state = restore(saved) || state; } catch { /* Start clean if the browser disables storage or a saved value is corrupt. */ }
window.addEventListener('pagehide', save);

function mutate(fn, group = null) {
  const before = clone(state);
  fn();
  if (JSON.stringify(before) !== JSON.stringify(state)) {
    if (!group || inputGroup !== group) { past.push(before); if (past.length > 100) past.shift(); }
    future = []; inputGroup = group;
  }
  render();
  clearTimeout(saveTimer); saveTimer = setTimeout(save, 180);
}
function undo() {
  if (!past.length) return;
  future.push(clone(state)); state = past.pop(); inputGroup = null; selectedNode = -1; render(); save();
}
function redo() {
  if (!future.length) return;
  past.push(clone(state)); state = future.pop(); inputGroup = null; selectedNode = -1; render(); save();
}
function toast(message) {
  $('toast').textContent = message; $('toast').classList.add('show');
  clearTimeout(toast.timer); toast.timer = setTimeout(() => $('toast').classList.remove('show'), 2800);
}

function pruneGrid() {
  let removed = 0;
  state.shapes.forEach(shape => {
    const count = shape.nodes.length;
    shape.nodes = shape.nodes.filter(n => n.c < state.cols && n.r < state.rows);
    if (shape.nodes.length !== count) { removed += count - shape.nodes.length; shape.closed = false; }
  });
  selectedNode = -1;
  keyboardPin.c = Math.min(keyboardPin.c, state.cols - 1);
  keyboardPin.r = Math.min(keyboardPin.r, state.rows - 1);
  if (removed) toast('Точки за пределами сетки убраны из маршрута. Можно отменить.');
}
function addShape() {
  if (state.shapes.length >= 32) { toast('На фрейме может быть до 32 форм.'); return; }
  mutate(() => {
    const id = Math.max(...state.shapes.map(s => s.id), 0) + 1;
    state.shapes.push(newShape(id)); state.active = state.shapes.length - 1; selectedNode = -1; preview = false;
  });
  $('artboard').focus({ preventScroll: true });
}
function toggleClosed() {
  if (!activeShape().nodes.length) return;
  mutate(() => { activeShape().closed = !activeShape().closed; });
}
function removeLast() {
  if (!activeShape().nodes.length) return;
  mutate(() => { activeShape().nodes.pop(); activeShape().closed = false; selectedNode = activeShape().nodes.length - 1; });
}
function flipNode(index = selectedNode) {
  const shape = activeShape();
  if (!shape.nodes[index]) return;
  const geometry = shapeGeometry(shape, gridGeometry(state));
  mutate(() => { shape.nodes[index].turn = -geometry.turns[index]; selectedNode = index; });
}
function deleteNode(index = selectedNode) {
  if (!activeShape().nodes[index]) return;
  mutate(() => {
    activeShape().nodes.splice(index, 1);
    if (activeShape().nodes.length < 2) activeShape().closed = false;
    selectedNode = Math.min(index, activeShape().nodes.length - 1);
  });
}

function usePin(c, r, { shift = false, alt = false, dragging = false } = {}) {
  if (preview) return;
  // Commit a pending number before selecting another circle on the canvas.
  if (document.activeElement === $('nodeOrder')) $('nodeOrder').blur();
  const shape = activeShape(), index = shape.nodes.findIndex(n => n.c === c && n.r === r);
  keyboardPin = { c, r };
  if (index >= 0) {
    if (dragging) return;
    selectedNode = index;
    if (alt) return deleteNode(index);
    if (shift) return flipNode(index);
    render(); return;
  }
  mutate(() => { shape.nodes.push({ c, r, turn: 0 }); selectedNode = shape.nodes.length - 1; }, dragging ? 'draw' : null);
}

function pathMarkup(shape, grid, forceMode = null) {
  const { d } = shapeGeometry(shape, grid);
  if (!d) return '';
  const mode = forceMode || state.mode;
  const fill = shape.closed && mode !== 'outline' ? shape.fill : 'none';
  const stroke = !shape.closed || mode !== 'fill' ? shape.stroke : 'none';
  return `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${shape.width}" stroke-linejoin="round" stroke-linecap="round" fill-rule="evenodd"/>`;
}
function gridMarkup(grid, mode) {
  if (mode === 'none') return '';
  const color = contrastInk(state.background), parts = [];
  for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) {
    const p = grid.point(c, r);
    parts.push(mode === 'circles'
      ? `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt(grid.radius)}" fill="none" stroke="${color}" stroke-width="${fmt(Math.min(state.width, state.height) / 850)}"/>`
      : `<circle cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt(Math.min(grid.step * .025, 5))}" fill="${color}"/>`);
  }
  return parts.join('');
}
function contrastInk(color) {
  const rgb = color.slice(1).match(/../g).map(c => parseInt(c, 16) / 255);
  const luminance = rgb.map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4).reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0);
  return luminance > .179 ? '#161616' : '#eeeeee';
}

function renderCanvas() {
  const svg = $('artboard'), grid = gridGeometry(state), shape = activeShape();
  const focused = document.activeElement?.closest?.('[data-pin]')?.dataset.pin;
  svg.setAttribute('viewBox', `0 0 ${state.width} ${state.height}`);
  const fills = state.shapes.map(s => pathMarkup(s, grid)).join('');
  let markup = `<rect width="${state.width}" height="${state.height}" fill="${state.background}"/><g class="artwork">${fills}</g>`;
  if (!preview) {
    markup += `<g class="guides" pointer-events="none">${gridMarkup(grid, state.guides)}</g>`;
    // Redraw strokes over the guides, like the reference's bold path over thin circles.
    if (state.mode !== 'fill') markup += `<g pointer-events="none">${state.shapes.map(s => pathMarkup(s, grid, 'outline')).join('')}</g>`;
    const numbers = new Map(shape.nodes.map((n, i) => [`${n.c},${n.r}`, i]));
    const scale = state.width / Math.max(1, svg.getBoundingClientRect().width);
    const markerRadius = Math.min(grid.step * .115, 10 * scale);
    const textSize = Math.max(9 * scale, markerRadius * 1.1);
    for (let r = 0; r < state.rows; r++) for (let c = 0; c < state.cols; c++) {
      const p = grid.point(c, r), key = `${c},${r}`, index = numbers.get(key);
      const selected = index === selectedNode && index !== undefined;
      const tabbable = keyboardPin.c === c && keyboardPin.r === r ? 0 : -1;
      markup += `<g class="pin" role="button" tabindex="${tabbable}" data-pin="${key}" aria-label="Круг ${c + 1}, ${r + 1}${index !== undefined ? `, точка маршрута ${index + 1}` : ''}" aria-pressed="${index !== undefined}"><circle class="pin-hit" cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt(grid.step * .49)}"/>`;
      if (index !== undefined) {
        markup += `<circle pointer-events="none" cx="${fmt(p.x)}" cy="${fmt(p.y)}" r="${fmt(markerRadius)}" fill="${selected ? '#145b9b' : '#ffffff'}" stroke="${selected ? '#145b9b' : '#696969'}" stroke-width="${fmt(scale)}"/><text class="pin-number" x="${fmt(p.x)}" y="${fmt(p.y)}" font-size="${fmt(textSize)}" fill="${selected ? '#ffffff' : '#282828'}">${index + 1}</text>`;
      }
      markup += '</g>';
    }
  }
  svg.innerHTML = markup;
  if (focused && !preview) svg.querySelector(`[data-pin="${focused}"]`)?.focus({ preventScroll: true });
}

function renderShapeList() {
  $('shapeList').innerHTML = state.shapes.map((s, i) => `<div class="shape-row${i === state.active ? ' active' : ''}"><button class="shape-choice" data-shape="${i}" aria-label="Выбрать форму ${s.id}" aria-current="${i === state.active}"><i style="background:${s.stroke}"></i><span>Форма ${s.id}</span><small>${s.nodes.length} точек</small></button><button class="delete-shape" data-delete="${i}" aria-label="Удалить форму ${s.id}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15"/></svg></button></div>`).join('');
}
function render() {
  const shape = activeShape(), grid = gridGeometry(state);
  for (const id of ['cols', 'rows', 'diameter', 'margin', 'width', 'height', 'guides', 'background']) {
    if (document.activeElement !== $(id) || $(id).type !== 'number') $(id).value = state[id];
  }
  $('strokeWidth').value = shape.width; $('strokeColor').value = shape.stroke; $('fillColor').value = shape.fill;
  $('strokeValue').value = `${shape.width} px`;
  $('diameterValue').value = `${state.diameter}%`;
  $('marginValue').value = `${state.margin}%`;
  $('gridInfo').textContent = `${state.cols * state.rows} кругов · диаметр ${(grid.radius * 2).toFixed(1)} px · зазор ${(grid.step - grid.radius * 2).toFixed(1)} px`;
  $('frameInfo').textContent = `${state.width} × ${state.height} px`;
  $('exportGrid').checked = state.exportGrid; $('transparent').checked = state.transparent;
  $('format').value = ['1080x1080', '1920x1080', '1080x1350', '1080x1920'].includes(`${state.width}x${state.height}`) ? `${state.width}x${state.height}` : 'custom';
  $('undo').disabled = !past.length; $('redo').disabled = !future.length;
  $('closeShape').disabled = !shape.nodes.length; $('closeShape').textContent = shape.closed ? 'Разомкнуть' : 'Замкнуть';
  $('removeLast').disabled = !shape.nodes.length;
  $('preview').setAttribute('aria-pressed', preview);
  $('preview').textContent = preview ? 'Редактировать' : 'Просмотр';
  $('viewModes').querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === state.mode));
  const node = shape.nodes[selectedNode];
  $('nodeTurn').disabled = !node; $('flipTurn').disabled = !node; $('deleteNode').disabled = !node;
  $('nodeOrder').disabled = !node;
  $('nodeOrder').max = Math.max(1, shape.nodes.length);
  if (document.activeElement !== $('nodeOrder')) $('nodeOrder').value = node ? selectedNode + 1 : '';
  $('nodeTotal').textContent = `из ${shape.nodes.length}`;
  $('reverseRoute').disabled = shape.nodes.length < 2;
  $('continueFrom').disabled = !canContinueRoute(shape, selectedNode);
  $('nodeLabel').textContent = node ? `${selectedNode + 1}` : '';
  $('nodeTurn').value = node ? node.turn : 0;
  $('nodeHint').textContent = !node ? 'Выбери точку маршрута на холсте. Номер задаёт её место в контуре.'
    : shape.closed ? '«Продолжить отсюда» разомкнёт контур после этой точки и сделает её последней.'
    : selectedNode === 0 && shape.nodes.length > 1 ? '«Продолжить отсюда» развернёт порядок: первая точка станет последней, без замыкания.'
    : selectedNode === shape.nodes.length - 1 ? 'Можно добавлять новые круги. Контур продолжится от этой точки.'
    : 'Продолжить можно от первой или последней точки. Номер меняет порядок обхода.';
  $('pathInfo').textContent = !shape.nodes.length ? 'Выбери первый круг на холсте.' : shape.closed ? 'Замкнутая форма. Выбери круг, чтобы изменить обход.' : `Открытый маршрут · ${shape.nodes.length} точек.${state.mode !== 'outline' ? ' Замкни для заливки.' : ''}`;
  $('stageHint').textContent = preview ? 'Просмотр без направляющих. Нажми «Редактировать», чтобы продолжить.' : shape.closed ? 'Выбери точку → «Продолжить отсюда», чтобы разомкнуть контур.' : 'Новые круги — в конец. От первой точки — «Продолжить отсюда».';
  renderShapeList(); fitFrame(); renderCanvas();
}
function fitFrame() {
  const stage = $('stage'), css = getComputedStyle(stage);
  const w = stage.clientWidth - parseFloat(css.paddingLeft) - parseFloat(css.paddingRight);
  const h = stage.clientHeight - parseFloat(css.paddingTop) - parseFloat(css.paddingBottom);
  const scale = Math.max(.01, Math.min(w / state.width, h / state.height));
  $('frameWrap').style.width = `${state.width * scale}px`;
  $('frameWrap').style.height = `${state.height * scale}px`;
}

function exportSVG() {
  const grid = gridGeometry(state);
  const bg = state.transparent ? '' : `<rect width="${state.width}" height="${state.height}" fill="${state.background}"/>`;
  const guides = state.exportGrid ? gridMarkup(grid, state.guides === 'none' ? 'circles' : state.guides) : '';
  const paths = state.shapes.map(s => pathMarkup(s, grid)).join('\n');
  const strokes = state.exportGrid && state.mode !== 'fill' ? state.shapes.map(s => pathMarkup(s, grid, 'outline')).join('\n') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${state.width}" height="${state.height}" viewBox="0 0 ${state.width} ${state.height}">\n${bg}\n${paths}\n${guides}\n${strokes}\n</svg>`;
}
function download(blob, filename) {
  const link = document.createElement('a'), url = URL.createObjectURL(blob);
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const filename = extension => `hofmann-${state.cols}x${state.rows}-${state.width}x${state.height}.${extension}`;
$('downloadSVG').addEventListener('click', () => download(new Blob([exportSVG()], { type: 'image/svg+xml' }), filename('svg')));
$('copySVG').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(exportSVG()); toast('SVG скопирован — можно вставить в Figma.'); }
  catch { download(new Blob([exportSVG()], { type: 'image/svg+xml' }), filename('svg')); toast('Буфер недоступен. SVG скачан файлом.'); }
});
$('downloadPNG').addEventListener('click', async () => {
  const button = $('downloadPNG'), svg = exportSVG();
  const w = state.width * 2, h = state.height * 2, name = filename('png');
  button.disabled = true; button.textContent = 'Сохраняю…';
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image(); image.src = url; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No canvas');
    context.drawImage(image, 0, 0, w, h);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('No blob');
    download(blob, name); toast(`PNG ${w} × ${h} сохранён.`);
  } catch { toast('Не удалось создать PNG. Попробуй уменьшить фрейм или скачать SVG.'); }
  finally { URL.revokeObjectURL(url); button.disabled = false; button.textContent = 'PNG 2×'; }
});

for (const key of ['cols', 'rows', 'width', 'height']) {
  const isGrid = key === 'cols' || key === 'rows';
  const low = isGrid ? 1 : 200, high = isGrid ? 24 : 4096;
  const applyValue = (value, group) => mutate(() => {
    if (state[key] === value) return;
    state[key] = value; if (isGrid) pruneGrid();
  }, group);
  $(key).addEventListener('input', event => {
    const value = +event.target.value;
    // Allow a partially typed dimension ("1", "19", …) without rewriting it.
    if (event.target.value !== '' && Number.isInteger(value) && value >= low && value <= high) applyValue(value, key);
  });
  const commitNumber = () => {
    const value = numeric($(key).value, low, high, state[key], true);
    $(key).value = value; applyValue(value, key); inputGroup = null;
  };
  $(key).addEventListener('change', commitNumber);
  $(key).addEventListener('blur', commitNumber);
  $(key).addEventListener('keydown', event => {
    if (event.key === 'Enter') { event.preventDefault(); commitNumber(); }
  });
}
for (const key of ['diameter', 'margin', 'strokeWidth', 'strokeColor', 'fillColor', 'background']) {
  $(key).addEventListener('input', event => {
    mutate(() => {
      if (key === 'strokeWidth') activeShape().width = +event.target.value;
      else if (key === 'strokeColor') activeShape().stroke = event.target.value;
      else if (key === 'fillColor') activeShape().fill = event.target.value;
      else state[key] = key === 'background' ? event.target.value : +event.target.value;
    }, key);
  });
  $(key).addEventListener('change', () => { inputGroup = null; });
}
$('guides').addEventListener('change', e => mutate(() => { state.guides = e.target.value; }));
for (const key of ['exportGrid', 'transparent']) $(key).addEventListener('change', e => mutate(() => { state[key] = e.target.checked; }));
$('format').addEventListener('change', e => {
  if (e.target.value === 'custom') { $('width').focus(); return; }
  const [width, height] = e.target.value.split('x').map(Number);
  mutate(() => { state.width = width; state.height = height; });
});
$('viewModes').addEventListener('click', e => { const mode = e.target.closest('[data-mode]')?.dataset.mode; if (mode) mutate(() => { state.mode = mode; }); });
$('nodeTurn').addEventListener('change', e => { if (activeShape().nodes[selectedNode]) mutate(() => { activeShape().nodes[selectedNode].turn = +e.target.value; }); });
function applyNodeOrder(value) {
  if (!activeShape().nodes[selectedNode]) return;
  mutate(() => { selectedNode = moveRouteNode(activeShape(), selectedNode, value - 1); }, 'node-order');
}
$('nodeOrder').addEventListener('input', e => {
  const value = Number(e.target.value);
  if (e.target.value !== '' && Number.isInteger(value) && value >= 1 && value <= activeShape().nodes.length) applyNodeOrder(value);
});
function commitNodeOrder() {
  if (!activeShape().nodes[selectedNode]) return;
  const value = $('nodeOrder').value === '' ? selectedNode + 1 : numeric($('nodeOrder').value, 1, activeShape().nodes.length, selectedNode + 1, true);
  $('nodeOrder').value = value; applyNodeOrder(value); inputGroup = null;
}
$('nodeOrder').addEventListener('change', commitNodeOrder);
$('nodeOrder').addEventListener('blur', commitNodeOrder);
$('nodeOrder').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commitNodeOrder(); } });
$('reverseRoute').addEventListener('click', () => {
  mutate(() => {
    reverseRoute(activeShape(), gridGeometry(state));
    if (selectedNode >= 0) selectedNode = activeShape().nodes.length - 1 - selectedNode;
  });
});
$('continueFrom').addEventListener('click', () => {
  if (!canContinueRoute(activeShape(), selectedNode)) return;
  mutate(() => { selectedNode = continueRoute(activeShape(), selectedNode, gridGeometry(state)); preview = false; });
  const node = activeShape().nodes[selectedNode];
  keyboardPin = {c:node.c, r:node.r};
  $('artboard').focus({preventScroll:true});
  toast('Выбирай новые круги — контур продолжится от выбранной точки.');
});
$('flipTurn').addEventListener('click', () => flipNode());
$('deleteNode').addEventListener('click', () => deleteNode());
$('addShape').addEventListener('click', addShape);
$('closeShape').addEventListener('click', toggleClosed);
$('removeLast').addEventListener('click', removeLast);
$('undo').addEventListener('click', undo); $('redo').addEventListener('click', redo);
$('preview').addEventListener('click', () => { preview = !preview; render(); });
$('shapeList').addEventListener('click', e => {
  const remove = e.target.closest('[data-delete]'), select = e.target.closest('[data-shape]');
  if (remove) mutate(() => {
    const index = +remove.dataset.delete;
    state.shapes.splice(index, 1);
    if (!state.shapes.length) state.shapes.push(newShape());
    if (state.active > index) state.active--;
    state.active = Math.min(state.active, state.shapes.length - 1); selectedNode = -1;
  });
  else if (select) { state.active = +select.dataset.shape; selectedNode = -1; inputGroup = null; render(); save(); }
});

const previewGrid = gridGeometry({ width: 100, height: 100, cols: 4, rows: 4, diameter: 88, margin: 6 });
$('examples').innerHTML = EXAMPLES.map((_, i) => `<button data-example="${i}" aria-label="Пример ${i + 1}" title="Пример ${i + 1}"><svg viewBox="0 0 100 100" aria-hidden="true"><path d="${shapeGeometry({ nodes: exampleNodes(i), closed: true }, previewGrid).d}" fill="none" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg></button>`).join('');
$('examples').addEventListener('click', e => {
  const index = e.target.closest('[data-example]')?.dataset.example;
  if (index === undefined) return;
  mutate(() => { state.cols = 4; state.rows = 4; state.diameter = 88; pruneGrid(); activeShape().nodes = exampleNodes(+index); activeShape().closed = true; preview = false; });
});

let drawing = false, lastPin = null;
function pointerPin(event) {
  const rect = $('artboard').getBoundingClientRect(), g = gridGeometry(state);
  const x = (event.clientX - rect.left) / rect.width * state.width;
  const y = (event.clientY - rect.top) / rect.height * state.height;
  const c = Math.round((x - g.ox) / g.step), r = Math.round((y - g.oy) / g.step);
  if (c < 0 || r < 0 || c >= state.cols || r >= state.rows) return null;
  const p = g.point(c, r);
  return Math.hypot(x - p.x, y - p.y) <= g.step * .49 ? { c, r } : null;
}
$('artboard').addEventListener('pointerdown', e => {
  if (e.button !== 0 || preview) return;
  const pin = pointerPin(e); if (!pin) return;
  e.preventDefault(); drawing = true; lastPin = `${pin.c},${pin.r}`; inputGroup = null;
  $('artboard').setPointerCapture(e.pointerId);
  usePin(pin.c, pin.r, { shift: e.shiftKey, alt: e.altKey });
  $('artboard').focus({ preventScroll: true });
});
$('artboard').addEventListener('pointermove', e => {
  if (!drawing || e.shiftKey || e.altKey) return;
  const pin = pointerPin(e); if (!pin) return;
  const key = `${pin.c},${pin.r}`; if (key === lastPin) return;
  lastPin = key; usePin(pin.c, pin.r, { dragging: true });
});
for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) $('artboard').addEventListener(event, () => { drawing = false; inputGroup = null; lastPin = null; });
// Native keyboard activation and SVG button activation share the same route action.
$('artboard').addEventListener('keydown', e => {
  if (preview) return;
  const pin = e.target.closest('[data-pin]')?.dataset.pin;
  if (pin) { const [c, r] = pin.split(',').map(Number); keyboardPin = { c, r }; }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    keyboardPin.c = clamp(keyboardPin.c + (e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0), 0, state.cols - 1);
    keyboardPin.r = clamp(keyboardPin.r + (e.key === 'ArrowDown' ? 1 : e.key === 'ArrowUp' ? -1 : 0), 0, state.rows - 1);
    renderCanvas(); $('artboard').querySelector(`[data-pin="${keyboardPin.c},${keyboardPin.r}"]`)?.focus();
  } else if (e.key === ' ') {
    e.preventDefault(); usePin(keyboardPin.c, keyboardPin.r, { shift: e.shiftKey, alt: e.altKey });
  }
});
window.addEventListener('keydown', e => {
  if (e.target.closest('input,select,textarea,[contenteditable=true]')) return;
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
  else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
  else if (e.key === 'Backspace' || e.key === 'Delete') { e.preventDefault(); removeLast(); }
  else if (e.key === 'Enter' && (e.target === $('artboard') || e.target.closest('[data-pin]'))) { e.preventDefault(); toggleClosed(); }
  else if (e.key === 'Escape' && preview) { preview = false; render(); }
});

new ResizeObserver(() => { fitFrame(); renderCanvas(); }).observe($('stage'));
render();
