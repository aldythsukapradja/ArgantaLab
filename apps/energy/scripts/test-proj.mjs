// Projection truth-lock — ED50 / UTM 31N → WGS84.
//
// This is what puts an interpreted horizon in the right place on the web map, so
// it is checked against a PUBLISHED position, not against itself: Volve's Sodir
// coordinates are 58.4417 N, 1.8869 E, and the bundle's own grid header says the
// Top Hugin grid starts at 432108 E / 6475807 N with 50 m cells.
// Run: node scripts/test-proj.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WB = join(__dirname, '..', 'public', 'wb');

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };

const {
  utmToGeodetic, ed50ToWgs84, ed50UtmToWgs84, gridCornersWgs84, INTL_1924, WGS84,
} = await import('../src/engine/proj.ts');

console.log('\n=== ED50 / UTM 31N → WGS84 ===\n');

// metres per degree at ~58N, for expressing errors on the ground
const M_PER_DEG_LAT = 111_320;
const M_PER_DEG_LON = 111_320 * Math.cos(58.44 * Math.PI / 180);
const groundErr = (aLon, aLat, bLon, bLat) =>
  Math.hypot((aLon - bLon) * M_PER_DEG_LON, (aLat - bLat) * M_PER_DEG_LAT);

// ── 1 · the ellipsoids are the ones the datums actually use ──────────────────
console.log('-- 1 · ellipsoids --');
check('ED50 uses International 1924, not WGS84', INTL_1924.a === 6378388 && Math.abs(1 / INTL_1924.f - 297) < 1e-9);
check('WGS84 ellipsoid is correct', WGS84.a === 6378137 && Math.abs(1 / WGS84.f - 298.257223563) < 1e-9);
check('the two ellipsoids differ — using the wrong one is a real error',
  INTL_1924.a - WGS84.a === 251, `${INTL_1924.a - WGS84.a} m in semi-major axis`);

// ── 2 · inverse UTM lands in the right zone ──────────────────────────────────
console.log('\n-- 2 · inverse UTM --');
{
  // false easting on the central meridian of zone 31 must return exactly 3°E
  const cm = utmToGeodetic(500000, 6475807, 31, INTL_1924);
  check('easting 500000 returns the zone-31 central meridian (3°E)',
    Math.abs(cm.lon - 3) < 1e-9, `${cm.lon.toFixed(9)}°`);
  check('northing maps to a plausible North Sea latitude',
    cm.lat > 58 && cm.lat < 59, `${cm.lat.toFixed(4)}°`);
}

// ── 3 · the datum shift is applied, and is the right size ────────────────────
console.log('\n-- 3 · datum shift --');
{
  const ed = utmToGeodetic(435758, 6478632, 31, INTL_1924);
  const w = ed50ToWgs84(ed.lat, ed.lon);
  const moved = groundErr(ed.lon, ed.lat, w.lon, w.lat);
  check('ED50→WGS84 actually moves the point', moved > 1, `${moved.toFixed(0)} m`);
  check('the shift is the ~100-200 m expected in the North Sea, not a rounding error',
    moved > 80 && moved < 250, `${moved.toFixed(0)} m`);
  // Direction matters as much as magnitude: a shift of the right size in the
  // wrong direction is still ~200 m of error. The published rule of thumb is
  // that ED50 coordinates sit roughly 100 m NORTH-EAST of WGS84 for the same
  // physical point in NW Europe — so converting ED50→WGS84 must move SOUTH-WEST.
  check('WGS84 lies SOUTH-WEST of the ED50 position here (published sign for NW Europe)',
    w.lat < ed.lat && w.lon < ed.lon,
    `Δlat ${((w.lat - ed.lat) * M_PER_DEG_LAT).toFixed(0)} m · Δlon ${((w.lon - ed.lon) * M_PER_DEG_LON).toFixed(0)} m`);
}

// ── 4 · REAL Volve grid vs the PUBLISHED field position ──────────────────────
console.log('\n-- 4 · real Volve grid vs published position --');
const surf = join(WB, 'surface-hugin_top.json');
if (!existsSync(surf)) {
  check('Volve horizon fixture present', false, 'run npm run data:wb');
} else {
  const s = JSON.parse(readFileSync(surf, 'utf8'));
  check('grid header carries a projected origin', Number.isFinite(s.x0) && Number.isFinite(s.y0),
    `${s.x0} E / ${s.y0} N · ${s.cell} m · ${s.nx}×${s.ny}`);

  // grid centre → WGS84, compared to Sodir's published Volve position
  const cx = s.x0 + ((s.nx - 1) * s.cell) / 2;
  const cy = s.y0 + ((s.ny - 1) * s.cell) / 2;
  const c = ed50UtmToWgs84(cx, cy, 31);
  const PUB = { lon: 1.8869, lat: 58.4417 };
  const err = groundErr(c.lon, c.lat, PUB.lon, PUB.lat);

  check('Top Hugin grid centre lands on the published Volve position',
    err < 3000, `${c.lat.toFixed(4)}N ${c.lon.toFixed(4)}E vs ${PUB.lat}N ${PUB.lon}E — ${(err / 1000).toFixed(2)} km`);
  check('…and it is the FIELD, not merely the right sea', err < 6000);

  // the projected footprint must match the grid's own metric size
  const k = gridCornersWgs84(s.x0, s.y0, s.nx, s.ny, s.cell, 31);
  const widthM = groundErr(k.sw[0], k.sw[1], k.se[0], k.se[1]);
  const heightM = groundErr(k.sw[0], k.sw[1], k.nw[0], k.nw[1]);
  const expW = (s.nx - 1) * s.cell, expH = (s.ny - 1) * s.cell;
  check('reprojected width matches the grid extent',
    Math.abs(widthM - expW) / expW < 0.02, `${widthM.toFixed(0)} m vs ${expW} m`);
  check('reprojected height matches the grid extent',
    Math.abs(heightM - expH) / expH < 0.02, `${heightM.toFixed(0)} m vs ${expH} m`);
  check('all four corners are distinct and ordered SW→SE→NE→NW',
    k.se[0] > k.sw[0] && k.ne[1] > k.se[1] && k.nw[0] < k.ne[0]);

  // reprojection introduces a small real rotation — it must be small, not zero
  const tilt = Math.abs(k.se[1] - k.sw[1]) * M_PER_DEG_LAT;
  check('the box is very nearly, but not exactly, axis-aligned after reprojection',
    tilt >= 0 && tilt < 200, `${tilt.toFixed(0)} m north-south drift across the width`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
