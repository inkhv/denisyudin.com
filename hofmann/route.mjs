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

export function canContinueRoute(shape, index) {
  return !!shape.nodes[index] && (shape.closed || index === 0 || index === shape.nodes.length - 1);
}

export function continueRoute(shape, index, grid) {
  if (!canContinueRoute(shape, index)) return null;
  if (shape.closed) {
    const {turns} = shapeGeometry(shape, grid);
    const nodes = shape.nodes.map((node, i) => ({...node, turn:turns[i]}));
    // Cut the edge following the selected circle; keep every other edge in order.
    shape.nodes = [...nodes.slice(index + 1), ...nodes.slice(0, index + 1)];
  } else if (index === 0 && shape.nodes.length > 1) {
    reverseRoute(shape, grid);
  }
  shape.closed = false;
  return shape.nodes.length - 1;
}
