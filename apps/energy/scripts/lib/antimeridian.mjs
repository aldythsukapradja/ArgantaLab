// antimeridian.mjs — dateline-safe geometry normalization (handoff §4).
// Splits Polygon/MultiPolygon rings that cross ±180° into a MultiPolygon whose rings
// never jump >180° in longitude, so planar/globe renderers stop drawing the Russia→US
// smear. Dependency-free; WGS84 lon/lat. Method: unwrap each ring to a continuous
// longitude space, split by 360°-wide bands with Sutherland–Hodgman strip-clipping
// (correct for concave simple rings), then wrap each band back into [-180, 180].
const TAU = 360;
const round = (v) => Math.round(v * 1e5) / 1e5;

/** Max |Δlon| between consecutive vertices — the dateline-defect detector. */
export function maxLonJump(ring) {
  let m = 0;
  for (let i = 1; i < ring.length; i++) {
    const d = Math.abs(ring[i][0] - ring[i - 1][0]);
    if (d > m) m = d;
  }
  return m;
}

/** Does any ring in the geometry still jump more than `tol`° in longitude? */
export function hasDatelineDefect(geom, tol = 180) {
  const rings = geom?.type === 'Polygon' ? geom.coordinates
    : geom?.type === 'MultiPolygon' ? geom.coordinates.flat() : [];
  return rings.some((r) => maxLonJump(r) > tol);
}

// unwrap a ring so consecutive lon deltas never exceed 180° (continuous space)
function unwrap(ring) {
  const out = [[ring[0][0], ring[0][1]]];
  for (let i = 1; i < ring.length; i++) {
    let x = ring[i][0];
    const d = x - out[i - 1][0];
    if (d > 180) x -= TAU * Math.round(d / TAU);
    else if (d < -180) x += TAU * Math.round(-d / TAU);
    out.push([x, ring[i][1]]);
  }
  return out;
}

// Sutherland–Hodgman clip of a ring to a half-plane; interpolate crossings at x=bound.
function clipHalf(ring, keepLeft, bound) {
  const out = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    const ka = keepLeft ? a[0] >= bound : a[0] <= bound;
    const kb = keepLeft ? b[0] >= bound : b[0] <= bound;
    if (ka) out.push(a);
    if (ka !== kb && b[0] !== a[0]) {
      const t = (bound - a[0]) / (b[0] - a[0]);
      out.push([bound, a[1] + t * (b[1] - a[1])]);
    }
  }
  return out;
}

function clipStrip(ring, left, right) {
  let r = clipHalf(ring, true, left);
  if (r.length < 3) return [];
  r = clipHalf(r, false, right);
  return r.length >= 3 ? r : [];
}

// split one polygon (outer + holes) into ≥1 dateline-safe polygons
function splitPolygon(rings) {
  const open = rings.map((r) => {
    const s = r.map((p) => [p[0], p[1]]);
    if (s.length > 1) { const a = s[0], b = s[s.length - 1]; if (a[0] === b[0] && a[1] === b[1]) s.pop(); }
    return s;
  }).filter((r) => r.length >= 3);
  if (!open.length) return [rings];
  const uw = open.map(unwrap);
  let minX = Infinity, maxX = -Infinity;
  for (const r of uw) for (const p of r) { if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0]; }
  const kmin = Math.floor((minX + 180) / TAU);
  const kmax = Math.floor((maxX + 180) / TAU);
  const close = (r) => { const w = r.map(([x, y]) => [round(x), round(y)]); const a = w[0], b = w[w.length - 1]; if (a[0] !== b[0] || a[1] !== b[1]) w.push([a[0], a[1]]); return w; };
  if (kmin === kmax) {
    const c = kmin * TAU;
    return [uw.map((r) => close(r.map(([x, y]) => [x - c, y])))];
  }
  const polys = [];
  for (let k = kmin; k <= kmax; k++) {
    const c = k * TAU, left = c - 180, right = c + 180;
    const clipped = uw.map((r) => clipStrip(r, left, right)).filter((r) => r.length >= 3);
    if (!clipped.length) continue;
    polys.push(clipped.map((r) => close(r.map(([x, y]) => [x - c, y]))));
  }
  return polys.length ? polys : [rings];
}

// safety net: after normalization, drop any polygon whose OUTER ring still jumps >180°
// (polar-cap encirclement — the one case band-clipping can't resolve). Keeps valid
// pieces + valid holes; returns null only if nothing safe remains.
function safePolygon(poly) {
  if (!poly.length || maxLonJump(poly[0]) > 180) return null;
  return [poly[0], ...poly.slice(1).filter((h) => maxLonJump(h) <= 180)];
}

/** normalizeGeometry + guarantee: the result never contains a >180° longitude jump. */
export function datelineSafe(geom) {
  const g = normalizeGeometry(geom);
  if (!g) return g;
  if (g.type === 'Polygon') { const p = safePolygon(g.coordinates); return p ? { type: 'Polygon', coordinates: p } : null; }
  if (g.type === 'MultiPolygon') { const ps = g.coordinates.map(safePolygon).filter(Boolean); return ps.length ? { type: 'MultiPolygon', coordinates: ps } : null; }
  return g;
}

/** Normalize a GeoJSON geometry: dateline-crossing polygons → dateline-safe MultiPolygon. */
export function normalizeGeometry(geom) {
  if (!geom) return geom;
  if (geom.type === 'Polygon') {
    if (!hasDatelineDefect(geom)) return geom;
    const polys = splitPolygon(geom.coordinates);
    return polys.length === 1 ? { type: 'Polygon', coordinates: polys[0] } : { type: 'MultiPolygon', coordinates: polys };
  }
  if (geom.type === 'MultiPolygon') {
    if (!hasDatelineDefect(geom)) return geom;
    const out = [];
    for (const poly of geom.coordinates) out.push(...splitPolygon(poly));
    return { type: 'MultiPolygon', coordinates: out };
  }
  return geom;
}
