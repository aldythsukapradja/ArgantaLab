// view.ts — the shared fit-to-bounds affine for every workbench canvas.
// Pure TS, no DOM. Y is flipped so north is up (world +y → screen −y).
// Powers pan/zoom, hit-testing (screen→world via inv), and all drawing.
// Ported per V1-SPEC §3 and WORKBENCH-ARCHITECTURE.md.

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export interface View {
  toX: (wx: number) => number;   // world x → screen px
  toY: (wy: number) => number;   // world y → screen px (north-up)
  inv: (sx: number, sy: number) => { x: number; y: number }; // screen px → world
  s: number;                      // px per world-unit (after zoom)
  w: number;
  h: number;
}

/**
 * makeView — fit `bounds` into a w×h canvas with `pad` px margin, then apply
 * `zoom` about a world-space center (cx,cy). If cx/cy omitted, centers on bounds.
 */
export function makeView(
  bounds: Bounds,
  w: number,
  h: number,
  pad = 24,
  zoom = 1,
  cx?: number,
  cy?: number,
): View {
  const bw = Math.max(1e-6, bounds.maxX - bounds.minX);
  const bh = Math.max(1e-6, bounds.maxY - bounds.minY);
  const availW = Math.max(1, w - pad * 2);
  const availH = Math.max(1, h - pad * 2);
  // Base fit scale (isotropic — squares stay square), then zoom.
  const base = Math.min(availW / bw, availH / bh);
  const s = base * zoom;

  const centerX = cx ?? (bounds.minX + bounds.maxX) / 2;
  const centerY = cy ?? (bounds.minY + bounds.maxY) / 2;
  const screenCX = w / 2;
  const screenCY = h / 2;

  const toX = (wx: number) => screenCX + (wx - centerX) * s;
  const toY = (wy: number) => screenCY - (wy - centerY) * s; // flip
  const inv = (sx: number, sy: number) => ({
    x: centerX + (sx - screenCX) / s,
    y: centerY - (sy - screenCY) / s,
  });

  return { toX, toY, inv, s, w, h };
}

/** Union of point/grid bounds — small helper for the map fit. */
export function boundsOf(points: Array<{ x: number; y: number }>): Bounds {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  return { minX, minY, maxX, maxY };
}

/** Expand bounds by a fraction on every side (breathing room around the field). */
export function padBounds(b: Bounds, frac = 0.05): Bounds {
  const dx = (b.maxX - b.minX) * frac;
  const dy = (b.maxY - b.minY) * frac;
  return { minX: b.minX - dx, minY: b.minY - dy, maxX: b.maxX + dx, maxY: b.maxY + dy };
}
