// Generates the keynote's land layer: Indonesia and its neighbours, as
// GeoJSON, clipped to the archipelago's bounding box.
//
// Why a build step rather than a runtime fetch:
//   · Natural Earth 50m for the whole world is ~700 KB of TopoJSON. The deck
//     needs one region, so shipping the planet to draw Indonesia is waste on a
//     slide that has to start instantly in a meeting room.
//   · Doing the topojson→geojson conversion here keeps `topojson-client` and
//     `world-atlas` as DEV dependencies. Nothing new reaches the browser
//     bundle; the app just fetches a small static file.
//
// 50m, not 110m: Indonesia is an archipelago of thousands of islands and the
// 110m generalisation drops most of them, leaving Java and Sumatra floating in
// an empty sea. That would be a worse map than no map.
//
// Run: node scripts/build-indonesia-land.mjs
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';

const require = createRequire(import.meta.url);

// `world-atlas` and `topojson-client` are DEV dependencies, and the OUTPUT of
// this script is committed. So on any host that installs without devDeps, the
// right behaviour is to keep the file that is already there rather than fail
// the build — a missing generator must never cost a deploy.
let world;
try {
  world = require('world-atlas/countries-50m.json');
} catch {
  console.log('[land] world-atlas not installed — keeping the committed geojson');
  process.exit(0);
}

/** The archipelago, plus a margin so neighbouring coastlines run to the edge of
 *  the lens rather than stopping just outside the frame. Matches the bbox the
 *  13 USGS provinces span (95.1–146.5 E, −11.0–9.0 N). */
const BBOX = { minX: 88, maxX: 154, minY: -18, maxY: 16 };

const hit = (lon, lat) =>
  lon >= BBOX.minX && lon <= BBOX.maxX && lat >= BBOX.minY && lat <= BBOX.maxY;

/** Drop consecutive vertices closer together than this, in degrees.
 *
 *  Chosen by measurement, not taste: 0.02° removed almost nothing (the 50m
 *  data is already sparser than that), 0.15° cut a third but visibly coarsened
 *  the Kalimantan coast at the deepest camera stop, where the lens is showing
 *  about two degrees across. 0.05° keeps all 133 Indonesian islands and full
 *  fidelity at depth for ~15% fewer vertices.
 *
 *  Modest, and worth being honest about: the real reason this stays cheap is
 *  that the paths are static and live inside a paint-contained subtree,
 *  not that they were thinned. */
const MIN_STEP = 0.05;

function decimate(ring) {
  if (ring.length < 5) return ring;
  const out = [ring[0]];
  for (let i = 1; i < ring.length - 1; i += 1) {
    const [ax, ay] = out[out.length - 1];
    const [bx, by] = ring[i];
    if (Math.abs(bx - ax) > MIN_STEP || Math.abs(by - ay) > MIN_STEP) out.push(ring[i]);
  }
  out.push(ring[ring.length - 1]);          // keep the ring closed
  // A ring thinned below a triangle is not a shape any more — keep the
  // original rather than emit a degenerate sliver.
  return out.length >= 4 ? out : ring;
}

/** Keep a ring only if part of it is in view. Whole-country filtering would
 *  drag all of Australia and China in for the sake of one coast. */
function ringsInView(coords, depth) {
  if (depth === 0) {
    return coords.some(([lon, lat]) => hit(lon, lat)) ? decimate(coords) : null;
  }
  const kept = coords.map((c) => ringsInView(c, depth - 1)).filter(Boolean);
  return kept.length ? kept : null;
}

const fc = feature(world, world.objects.countries);
const out = [];
let dropped = 0;

for (const f of fc.features) {
  const g = f.geometry;
  if (!g) continue;
  const depth = g.type === 'Polygon' ? 1 : g.type === 'MultiPolygon' ? 2 : -1;
  if (depth < 0) continue;
  const kept = ringsInView(g.coordinates, depth);
  if (!kept) { dropped += 1; continue; }
  out.push({
    type: 'Feature',
    // Name only — nothing else on the record is used, and carrying the rest
    // would double the file for no reader.
    properties: { name: f.properties?.name ?? '' },
    geometry: { type: g.type, coordinates: kept },
  });
}

// Round to 3 decimals (~110 m at the equator). At the size this renders inside
// a 240 px circle it is indistinguishable, and it roughly halves the file.
const round = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v);
const json = JSON.stringify(
  { type: 'FeatureCollection', features: out },
  (_k, v) => (typeof v === 'number' ? round(v) : v),
);

const dest = path.join(import.meta.dirname, '..', 'public', 'world', 'indonesia-land.geojson');
fs.writeFileSync(dest, json);

console.log(`[land] ${out.length} countries in view, ${dropped} dropped`);
console.log(`[land] ${out.map((f) => f.properties.name).join(', ')}`);
console.log(`[land] wrote ${path.relative(process.cwd(), dest)} — ${(json.length / 1024).toFixed(0)} KB`);
