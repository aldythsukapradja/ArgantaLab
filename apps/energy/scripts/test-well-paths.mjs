// test-well-paths.mjs — the wellbore-path join, against the real Volve bundle.
// Node runs .ts natively here; relative imports need the explicit extension.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { buildWellPaths, pathRole, wellKey } from '../src/tabs/fielddev/well-paths.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; } else { fail++; console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};

// ── role vocabulary ───────────────────────────────────────────────────────────
ok('oil producer → producer', pathRole('OIL_PRODUCER') === 'producer');
ok('oil-producer separator tolerated', pathRole('oil-producer') === 'producer');
ok('water producer is NOT a producer', pathRole('WATER_PRODUCER') === 'other');
ok('injector', pathRole('WATER_INJECTOR') === 'injector');
ok('appraisal → other', pathRole('appraisal') === 'other');
ok('blank role → other', pathRole(undefined) === 'other');

// ── name normalisation ────────────────────────────────────────────────────────
ok('punctuation stripped', wellKey('15/9-F-11 A') === wellKey('1 5 9 f 11 a'));
ok('case folded', wellKey('F-11') === wellKey('f11'));
ok('distinct wells stay distinct', wellKey('F-11') !== wellKey('F-12'));

// ── the join ──────────────────────────────────────────────────────────────────
const heads = [
  { name: 'F-11', x: 1000, y: 2000, role: 'OIL_PRODUCER' },
  { name: 'F-4', x: 5000, y: 6000, role: 'WATER_INJECTOR' },
  { name: 'NoSlot', role: 'OIL_PRODUCER' },              // no x/y at all
];
const surveys = [
  { well: 'F-11', stations: [{ dispEw: 0, dispNs: 0 }, { dispEw: 100, dispNs: -50 }] },
  { well: 'F-4', stations: [{ dispEw: 0, dispNs: 0 }, { dispEw: 10, dispNs: 10 }] },
  { well: 'NoSlot', stations: [{ dispEw: 0, dispNs: 0 }, { dispEw: 1, dispNs: 1 }] },
  { well: 'Unknown', stations: [{ dispEw: 0, dispNs: 0 }, { dispEw: 1, dispNs: 1 }] },
  { well: 'F-11', stations: [{ dispEw: 0, dispNs: 0 }] }, // single station is not a path
];
const built = buildWellPaths(heads, surveys);
ok('only joinable, multi-station surveys survive', built.length === 2, `got ${built.length}`);
ok('offsets are added to the wellhead',
  built[0].points[1][0] === 1100 && built[0].points[1][1] === 1950,
  JSON.stringify(built[0].points[1]));
ok('first point is the slot itself',
  built[0].points[0][0] === 1000 && built[0].points[0][1] === 2000);
ok('role carried from the well master', built[0].role === 'producer' && built[1].role === 'injector');

const nonFinite = buildWellPaths(
  [{ name: 'A', x: 0, y: 0 }],
  [{ well: 'A', stations: [{ dispEw: 0, dispNs: 0 }, { dispEw: NaN, dispNs: 5 }, { dispEw: 3, dispNs: 4 }] }],
);
ok('non-finite stations dropped, not zeroed', nonFinite[0].points.length === 2);

ok('empty input is empty output, not a throw', buildWellPaths([], []).length === 0);

// ── against the shipped bundle ────────────────────────────────────────────────
// public/wb is generated and gitignored; skip rather than fail a clean checkout.
let index = null;
try { index = JSON.parse(readFileSync(join(root, 'public/wb/index.json'), 'utf8')); } catch { /* not built */ }
if (index) {
  const wells = (index.wells ?? []).map((w) => ({ name: w.name, x: w.x, y: w.y, role: w.role }));
  const withXy = wells.filter((w) => Number.isFinite(w.x) && Number.isFinite(w.y));
  ok('bundle wells carry projected slots', withXy.length > 0, `${withXy.length}/${wells.length}`);

  const real = [];
  for (const w of (index.wells ?? []).filter((w) => w.has?.traj)) {
    const slug = String(w.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      const t = JSON.parse(readFileSync(join(root, `public/wb/traj-${slug}.json`), 'utf8'));
      if (t.stations?.length) real.push({ well: t.well ?? w.name, stations: t.stations });
    } catch { /* slug variant; the join test below is on what did load */ }
  }
  if (real.length) {
    const paths = buildWellPaths(wells, real);
    // Not every surveyed bore joins: the Volve master carries F-15 S with a null
    // easting/northing, so its survey has no slot to hang off and is dropped
    // rather than drawn at the origin. Assert against the JOINABLE count, and
    // assert the shortfall is exactly the slotless bores — a silent `<=` here
    // would hide a real regression in the name matching.
    const joinable = real.filter((s) => withXy.some((w) => wellKey(w.name) === wellKey(s.well)));
    ok('every joinable survey joins', paths.length === joinable.length, `${paths.length}/${joinable.length}`);
    ok('the shortfall is slotless bores, not lost matches',
      real.length - joinable.length === real.filter((s) =>
        wells.some((w) => wellKey(w.name) === wellKey(s.well) && !Number.isFinite(w.x))).length);
    const flat = paths.flatMap((p) => p.points);
    // Volve sits in UTM 31N: eastings ~430–440 km, northings ~6.47–6.48 Mm.
    ok('joined coordinates stay in the field footprint',
      flat.every(([x, y]) => x > 400_000 && x < 500_000 && y > 6_400_000 && y < 6_600_000));
    ok('every path has at least two stations', paths.every((p) => p.points.length >= 2));
  }
}

// -- WHERE A WELL MEETS THE RESERVOIR ---------------------------------------
//
// Volve is one platform: every bore's surface slot is within metres of the others, so
// placing wells by wellhead put all 24 in the SAME grid cell even at 50 m resolution.
// A nine-well waterflood then animates as one well, because it is one well. Located at
// reservoir depth the same bores occupy 16 distinct cells.
{
  const { reservoirEntry } = await import('../src/tabs/fielddev/well-paths.ts');
  const head = { x: 1000, y: 2000 };
  const st = [
    { tvd: 0, dispEw: 0, dispNs: 0 },
    { tvd: 1000, dispEw: 100, dispNs: 0 },
    { tvd: 2000, dispEw: 400, dispNs: 200 },
    { tvd: 3000, dispEw: 900, dispNs: 600 },
  ];

  const mid = reservoirEntry(head, st, 1500);
  ok('the entry point is INTERPOLATED between the straddling stations',
    mid && Math.abs(mid.x - (1000 + 250)) < 1e-9 && Math.abs(mid.y - (2000 + 100)) < 1e-9,
    JSON.stringify(mid));
  ok('...and reports the depth it was asked for', mid && mid.tvdss === 1500, JSON.stringify(mid));
  ok('...and is not flagged shallow', mid && mid.shallow === false, '');

  // the whole point: it is NOT the wellhead
  ok('the entry point is far from the surface slot',
    mid && Math.hypot(mid.x - head.x, mid.y - head.y) > 100, '');

  const deep = reservoirEntry(head, st, 5000);
  ok('a survey that never reaches the target falls back to its deepest station',
    deep && deep.x === 1900 && deep.y === 2600, JSON.stringify(deep));
  ok('...and SAYS it is shallow, so a caller can exclude it', deep && deep.shallow === true, '');

  ok('a bore with no usable stations returns null, not the wellhead',
    reservoirEntry(head, [], 1500) === null, '');
  ok('a bore with no surface slot returns null',
    reservoirEntry({ x: NaN, y: 2000 }, st, 1500) === null, '');

  // unsorted surveys are common; the walk must not depend on file order
  const shuffled = [st[3], st[0], st[2], st[1]];
  const same = reservoirEntry(head, shuffled, 1500);
  ok('station order in the file does not change the answer',
    same && Math.abs(same.x - mid.x) < 1e-9 && Math.abs(same.y - mid.y) < 1e-9, JSON.stringify(same));
}

console.log(`well-paths: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
