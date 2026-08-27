(() => {
  'use strict';

  const svg = document.getElementById('artboard');
  const sizeInput = document.getElementById('cellSize');
  const gapInput = document.getElementById('gapSize');
  const smoothInput = document.getElementById('smoothness');
  const cellColorInput = document.getElementById('cellColor');
  const veinColorInput = document.getElementById('veinColor');
  const formatInput = document.getElementById('format');
  const editButton = document.getElementById('toggleEdit');
  const hint = document.getElementById('stageHint');
  const countLabel = document.getElementById('cellCount');
  const toast = document.getElementById('toast');

  const state = {
    width: 1080,
    height: 1080,
    points: [],
    seed: Math.floor(Math.random() * 0xffffffff),
    editing: true,
    dragIndex: -1
  };

  const ns = 'http://www.w3.org/2000/svg';
  let toastTimer;

  function mulberry32(seed) {
    return function random() {
      let value = seed += 0x6D2B79F5;
      value = Math.imul(value ^ value >>> 15, value | 1);
      value ^= value + Math.imul(value ^ value >>> 7, value | 61);
      return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
  }

  function desiredCount() {
    const size = Number(sizeInput.value);
    return Math.max(4, Math.min(90, Math.round((state.width * state.height) / (size * size * .92))));
  }

  function generatePoints() {
    const random = mulberry32(state.seed);
    const count = desiredCount();
    const margin = Math.min(state.width, state.height) * .015;
    const points = [];

    for (let index = 0; index < count; index += 1) {
      let best = null;
      let bestDistance = -1;
      const candidates = index < 2 ? 1 : 24;
      for (let candidate = 0; candidate < candidates; candidate += 1) {
        const point = {
          x: margin + random() * (state.width - margin * 2),
          y: margin + random() * (state.height - margin * 2)
        };
        const nearest = points.reduce((distance, other) => Math.min(distance, (point.x - other.x) ** 2 + (point.y - other.y) ** 2), Infinity);
        if (nearest > bestDistance) {
          best = point;
          bestDistance = nearest;
        }
      }
      points.push(best);
    }
    state.points = points;
    render();
  }

  function clipPolygon(polygon, a, b, c) {
    if (!polygon.length) return polygon;
    const result = [];
    const inside = point => a * point.x + b * point.y <= c + .0001;
    const intersection = (start, end) => {
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const denominator = a * dx + b * dy;
      if (Math.abs(denominator) < 1e-9) return start;
      const t = (c - a * start.x - b * start.y) / denominator;
      return { x: start.x + dx * t, y: start.y + dy * t };
    };

    for (let index = 0; index < polygon.length; index += 1) {
      const current = polygon[index];
      const previous = polygon[(index + polygon.length - 1) % polygon.length];
      const currentInside = inside(current);
      const previousInside = inside(previous);
      if (currentInside) {
        if (!previousInside) result.push(intersection(previous, current));
        result.push(current);
      } else if (previousInside) {
        result.push(intersection(previous, current));
      }
    }
    return result;
  }

  function voronoiCell(site, siteIndex) {
    let polygon = [
      { x: 0, y: 0 },
      { x: state.width, y: 0 },
      { x: state.width, y: state.height },
      { x: 0, y: state.height }
    ];
    for (let index = 0; index < state.points.length && polygon.length; index += 1) {
      if (index === siteIndex) continue;
      const other = state.points[index];
      const a = 2 * (other.x - site.x);
      const b = 2 * (other.y - site.y);
      const c = other.x ** 2 + other.y ** 2 - site.x ** 2 - site.y ** 2;
      polygon = clipPolygon(polygon, a, b, c);
    }
    return polygon;
  }

  function roundedPath(points) {
    if (points.length < 3) return '';
    const amount = Number(smoothInput.value) / 100;
    const corners = points.map((point, index) => {
      const previous = points[(index + points.length - 1) % points.length];
      const next = points[(index + 1) % points.length];
      const before = Math.max(.0001, Math.hypot(previous.x - point.x, previous.y - point.y));
      const after = Math.max(.0001, Math.hypot(next.x - point.x, next.y - point.y));
      const distance = Math.min(before, after) * .44 * amount;
      return {
        point,
        in: { x: point.x + (previous.x - point.x) / before * distance, y: point.y + (previous.y - point.y) / before * distance },
        out: { x: point.x + (next.x - point.x) / after * distance, y: point.y + (next.y - point.y) / after * distance }
      };
    });
    const format = value => Number(value.toFixed(2));
    let path = `M ${format(corners[0].out.x)} ${format(corners[0].out.y)}`;
    for (let offset = 1; offset <= corners.length; offset += 1) {
      const corner = corners[offset % corners.length];
      path += ` L ${format(corner.in.x)} ${format(corner.in.y)} Q ${format(corner.point.x)} ${format(corner.point.y)} ${format(corner.out.x)} ${format(corner.out.y)}`;
    }
    return `${path} Z`;
  }

  function createSvgElement(tag, attributes = {}) {
    const element = document.createElementNS(ns, tag);
    Object.entries(attributes).forEach(([name, value]) => element.setAttribute(name, value));
    return element;
  }

  function render() {
    svg.replaceChildren();
    svg.setAttribute('viewBox', `0 0 ${state.width} ${state.height}`);
    svg.style.aspectRatio = `${state.width} / ${state.height}`;
    svg.classList.toggle('is-editing', state.editing);

    const veinColor = veinColorInput.value;
    const cellColor = cellColorInput.value;
    const gap = Number(gapInput.value);
    svg.style.background = veinColor;

    svg.append(createSvgElement('rect', { width: state.width, height: state.height, fill: veinColor }));
    const cells = createSvgElement('g', { 'aria-label': 'Ячейки' });
    state.points.forEach((point, index) => {
      const path = createSvgElement('path', {
        class: 'cell-path',
        d: roundedPath(voronoiCell(point, index)),
        fill: cellColor,
        stroke: veinColor,
        'stroke-width': gap,
        'stroke-linejoin': 'round'
      });
      cells.append(path);
    });
    svg.append(cells);

    if (state.editing) {
      const editor = createSvgElement('g', { class: 'editor-layer', 'aria-label': 'Точки редактирования' });
      const handleRadius = Math.max(8, Math.min(state.width, state.height) * .009);
      state.points.forEach((point, index) => {
        const handle = createSvgElement('g', { class: 'editor-handle', 'data-index': index, transform: `translate(${point.x} ${point.y})` });
        handle.append(createSvgElement('circle', { class: 'handle-ring', r: handleRadius }));
        handle.append(createSvgElement('circle', { class: 'handle-dot', r: handleRadius * .24 }));
        editor.append(handle);
      });
      svg.append(editor);
    }
    countLabel.textContent = `${state.points.length} ячеек · ${state.width} × ${state.height}`;
  }

  function svgPoint(event) {
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    return point.matrixTransform(svg.getScreenCTM().inverse());
  }

  function pointerDown(event) {
    if (!state.editing) return;
    const handle = event.target.closest('.editor-handle');
    if (!handle) return;
    const index = Number(handle.dataset.index);
    if (event.altKey && state.points.length > 4) {
      state.points.splice(index, 1);
      render();
      notify('Ячейка удалена');
      return;
    }
    state.dragIndex = index;
    svg.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  function pointerMove(event) {
    if (state.dragIndex < 0) return;
    const point = svgPoint(event);
    state.points[state.dragIndex] = {
      x: Math.max(0, Math.min(state.width, point.x)),
      y: Math.max(0, Math.min(state.height, point.y))
    };
    render();
  }

  function pointerUp(event) {
    if (state.dragIndex >= 0 && svg.hasPointerCapture(event.pointerId)) svg.releasePointerCapture(event.pointerId);
    state.dragIndex = -1;
  }

  function addPoint(event) {
    if (!state.editing || event.target.closest('.editor-handle')) return;
    const point = svgPoint(event);
    state.points.push({ x: point.x, y: point.y });
    render();
    notify('Ячейка добавлена');
  }

  function cleanSvgString() {
    const clone = svg.cloneNode(true);
    clone.querySelector('.editor-layer')?.remove();
    clone.removeAttribute('id');
    clone.removeAttribute('class');
    clone.removeAttribute('style');
    clone.setAttribute('xmlns', ns);
    clone.setAttribute('width', state.width);
    clone.setAttribute('height', state.height);
    clone.querySelectorAll('.cell-path').forEach(path => path.removeAttribute('class'));
    return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadSvg() {
    downloadBlob(new Blob([cleanSvgString()], { type: 'image/svg+xml;charset=utf-8' }), `organic-cells-${state.width}x${state.height}.svg`);
    notify('SVG скачан');
  }

  function downloadPng() {
    const blob = new Blob([cleanSvgString()], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = state.width;
      canvas.height = state.height;
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0);
      canvas.toBlob(png => {
        if (png) downloadBlob(png, `organic-cells-${state.width}x${state.height}.png`);
        URL.revokeObjectURL(url);
        notify('PNG скачан');
      }, 'image/png');
    };
    image.src = url;
  }

  async function copySvg() {
    try {
      await navigator.clipboard.writeText(cleanSvgString());
      notify('SVG скопирован — вставьте в Figma');
    } catch (error) {
      notify('Не удалось скопировать — скачайте SVG');
    }
  }

  function notify(message) {
    toast.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { toast.textContent = ''; }, 2600);
  }

  function updateColors() {
    document.getElementById('cellSwatch').style.setProperty('--swatch', cellColorInput.value);
    document.getElementById('veinSwatch').style.setProperty('--swatch', veinColorInput.value);
    document.getElementById('cellColorValue').textContent = cellColorInput.value.toUpperCase();
    document.getElementById('veinColorValue').textContent = veinColorInput.value.toUpperCase();
    render();
  }

  function bindRange(input, output, handler) {
    input.addEventListener('input', () => {
      output.textContent = input.value;
      handler();
    });
  }

  bindRange(sizeInput, document.getElementById('cellSizeValue'), generatePoints);
  bindRange(gapInput, document.getElementById('gapSizeValue'), render);
  bindRange(smoothInput, document.getElementById('smoothnessValue'), render);
  cellColorInput.addEventListener('input', updateColors);
  veinColorInput.addEventListener('input', updateColors);
  formatInput.addEventListener('change', () => {
    [state.width, state.height] = formatInput.value.split('x').map(Number);
    state.seed = Math.floor(Math.random() * 0xffffffff);
    generatePoints();
  });
  editButton.addEventListener('click', () => {
    state.editing = !state.editing;
    editButton.classList.toggle('is-active', state.editing);
    editButton.setAttribute('aria-pressed', String(state.editing));
    hint.hidden = !state.editing;
    render();
  });
  document.getElementById('randomize').addEventListener('click', () => {
    state.seed = Math.floor(Math.random() * 0xffffffff);
    generatePoints();
  });
  document.getElementById('downloadSvg').addEventListener('click', downloadSvg);
  document.getElementById('downloadPng').addEventListener('click', downloadPng);
  document.getElementById('copySvg').addEventListener('click', copySvg);
  svg.addEventListener('pointerdown', pointerDown);
  svg.addEventListener('pointermove', pointerMove);
  svg.addEventListener('pointerup', pointerUp);
  svg.addEventListener('pointercancel', pointerUp);
  svg.addEventListener('dblclick', addPoint);

  updateColors();
  generatePoints();
})();
