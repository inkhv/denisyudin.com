// Exact circular arcs and common tangents. Coordinates use SVG's downward y axis.
export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const fmt = v => Number(v.toFixed(4));
const xy = p => `${fmt(p.x)} ${fmt(p.y)}`;

export function gridGeometry(state) {
  const margin = Math.min(state.width, state.height) * state.margin / 100;
  const step = Math.min((state.width - 2 * margin) / state.cols, (state.height - 2 * margin) / state.rows);
  const radius = step * state.diameter / 200;
  const ox = (state.width - (state.cols - 1) * step) / 2;
  const oy = (state.height - (state.rows - 1) * step) / 2;
  const point = (c, r) => ({ x: ox + c * step, y: oy + r * step });
  return { step, radius, ox, oy, point };
}

export function automaticTurns(points, closed) {
  const n = points.length;
  if (n < 3) return points.map(() => 1);
  const turns = points.map((b, i) => {
    if (!closed && (i === 0 || i === n - 1)) return 0;
    const a = points[(i + n - 1) % n], c = points[(i + 1) % n];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    return Math.abs(cross) < 1e-8 ? 0 : Math.sign(cross);
  });
  // At a straight run, carry the preceding wrap. Endpoints use the nearest turn.
  return turns.map((turn, i) => {
    if (turn) return turn;
    for (let d = 1; d < n; d++) {
      const before = closed ? (i - d + n) % n : i - d;
      if (before >= 0 && turns[before]) return turns[before];
      const after = closed ? (i + d) % n : i + d;
      if (after < n && turns[after]) return turns[after];
    }
    return 1;
  });
}

export function tangent(a, b, radius, turnA, turnB) {
  const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy);
  if (distance < 1e-8 || Math.abs(radius * (turnA - turnB)) >= distance) return null;
  const angle = Math.atan2(dy, dx) + Math.asin(radius * (turnA - turnB) / distance);
  const normal = { x: Math.sin(angle), y: -Math.cos(angle) };
  return {
    a: { x: a.x + radius * turnA * normal.x, y: a.y + radius * turnA * normal.y },
    b: { x: b.x + radius * turnB * normal.x, y: b.y + radius * turnB * normal.y },
  };
}

export function arc(center, start, end, radius, turn) {
  const a = Math.atan2(start.y - center.y, start.x - center.x);
  const b = Math.atan2(end.y - center.y, end.x - center.x);
  const span = ((turn * (b - a)) % TAU + TAU) % TAU;
  if (span < 1e-8 || TAU - span < 1e-8) return '';
  return ` A ${fmt(radius)} ${fmt(radius)} 0 ${span > Math.PI ? 1 : 0} ${turn > 0 ? 1 : 0} ${xy(end)}`;
}

export function shapeGeometry(shape, grid) {
  const points = shape.nodes.map(node => grid.point(node.c, node.r));
  const turns = automaticTurns(points, shape.closed).map((t, i) => shape.nodes[i].turn || t);
  const n = points.length, radius = grid.radius;
  if (!n) return { d: '', points, turns, edges: [] };
  if (n === 1) {
    const p = points[0];
    const d = `M ${fmt(p.x + radius)} ${fmt(p.y)} A ${fmt(radius)} ${fmt(radius)} 0 1 1 ${fmt(p.x - radius)} ${fmt(p.y)} A ${fmt(radius)} ${fmt(radius)} 0 1 1 ${fmt(p.x + radius)} ${fmt(p.y)} Z`;
    return { d: shape.closed ? d : '', points, turns, edges: [] };
  }
  const edges = [];
  for (let i = 0; i < (shape.closed ? n : n - 1); i++) {
    const j = (i + 1) % n;
    const edge = tangent(points[i], points[j], radius, turns[i], turns[j]);
    if (!edge) return { d: '', points, turns, edges: [], invalid: true };
    edges.push(edge);
  }
  let d = `M ${xy(edges[0].a)}`;
  edges.forEach((edge, i) => {
    d += ` L ${xy(edge.b)}`;
    const next = edges[(i + 1) % edges.length];
    if (shape.closed || i < edges.length - 1) {
      const j = (i + 1) % n;
      d += arc(points[j], edge.b, next.a, radius, turns[j]);
    }
  });
  if (shape.closed) d += ' Z';
  return { d, points, turns, edges };
}

// Routes follow the first reference's four 4×4 studies; all geometry is rebuilt
// from grid coordinates, never traced into raster assets.
export const EXAMPLES = [
  [[1,0],[2,1],[1,1],[3,2],[2,3],[0,3],[1,2],[0,1]],
  [[0,0],[1,0],[1,1],[1,2],[2,2],[3,0],[3,2],[2,3],[1,3],[0,1]],
  [[1,0],[2,0],[1,1],[3,1],[2,2],[3,2],[2,3],[0,2],[0,1]],
  [[0,0],[1,0],[2,1],[3,0],[3,3],[1,2],[0,3],[0,1]],
];

export function exampleNodes(index) {
  return EXAMPLES[index].map(([c, r]) => ({ c, r, turn: 0 }));
}
