import {clamp, shapeGeometry} from './geometry.mjs';

// Move an existing node, rather than copying coordinates or creating duplicates.
export function moveRouteNode(shape, from, to) {
  if (!shape.nodes[from] || !Number.isFinite(to)) return from;
  const target = clamp(Math.round(to), 0, shape.nodes.length - 1);
  const [node] = shape.nodes.splice(from, 1);
  shape.nodes.splice(target, 0, node);
  return target;
}

export function reverseRoute(shape, grid) {
  // Resolve automatic wraps before reversing, including ambiguous straight runs.
  // The same physical arcs must stay on the same side of their circles.
  const {turns} = shapeGeometry(shape, grid);
  shape.nodes = shape.nodes.map((node, i) => ({...node, turn:-turns[i]})).reverse();
}
