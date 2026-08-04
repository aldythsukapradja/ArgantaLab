// test-horizon-picks.mjs — pick↔surface correlation, well statistics and
// stratigraphic ordering, against the real Volve bundle where it is built.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { matchPicks, positionAtMd, buildImpacts, PICK_ALIASES } from '../src/tabs/fielddev/horizon-picks.ts';
import { summariseWell } from '../src/tabs/fielddev/well-stats.ts';
import { orderHorizons, orderNote } from '../src/tabs/fielddev/horizon-order.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; } else { fail++; console.error(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// ── surface ↔ pick name matching ──────────────────────────────────────────────
const PICKS = [
  { well: 'A', surface: 'Hugin Fm. VOLVE Top', md: 3000, tvdss: -2900 },
  { well: 'B', surface: 'Hugin Fm. VOLVE Base', md: 3100, tvdss: -2990 },
  { well: 'A', surface: 'SHETLAND GP. Top', md: 2600, tvdss: -2540 },
  { well: 'A', surface: 'Draupne Fm. Top', md: 2900, tvdss: -2800 },
  { well: 'A', surface: 'Heather Fm. Sand VOLVE Top', md: 2950, tvdss: -2850 },
];

ok('mapped name matches the qualified pick name',
  matchPicks('Hugin Fm Top', PICKS).picks.length === 1);
ok('Top does not collect Base picks',
  matchPicks('Hugin Fm Top', PICKS).picks[0].surface.endsWith('Top'));
ok('Base does not collect Top picks',
  matchPicks('Hugin Fm Base', PICKS).picks.length === 1
  && matchPicks('Hugin Fm Base', PICKS).picks[0].surface.endsWith('Base'));
ok('group abbreviation and casing folded', matchPicks('Shetland Gp Top', PICKS).picks.length === 1);
ok('a formation does NOT capture a different one',
  matchPicks('Heather Fm Top', PICKS).picks.every((p) => /Heather/.test(p.surface)));
ok('unmatched surface returns empty, not a guess', matchPicks('Zechstein Top', PICKS).picks.length === 0);

const bcu = matchPicks('BCU', PICKS);
ok('BCU resolves through the documented alias', bcu.picks.length === 1);
ok('and the alias is declared as interpreted, not passed off as a name match',
  bcu.interpreted != null && /Draupne/.test(bcu.interpreted.pickName));
ok('direct matches are never flagged interpreted', matchPicks('Hugin Fm Top', PICKS).interpreted === null);
ok('every alias carries a reason', PICK_ALIASES.every((a) => a.why && a.why.length > 10));

// ── position along a survey ───────────────────────────────────────────────────
const ST = [
  { md: 0, dispEw: 0, dispNs: 0 },
  { md: 1000, dispEw: 100, dispNs: 0 },
  { md: 2000, dispEw: 100, dispNs: 200 },
];
ok('exact station', (() => { const p = positionAtMd(ST, 1000); return p.ew === 100 && p.ns === 0; })());
ok('interpolates between stations',
  (() => { const p = positionAtMd(ST, 1500); return p.ew === 100 && p.ns === 100 && !p.extrapolated; })());
ok('above the first station clamps and flags',
  (() => { const p = positionAtMd(ST, -5); return p.ew === 0 && p.extrapolated; })());
ok('below TD clamps to the survey end and FLAGS it',
  (() => { const p = positionAtMd(ST, 9999); return p.ns === 200 && p.extrapolated === true; })());
ok('at TD exactly is not extrapolated', positionAtMd(ST, 2000).extrapolated === false);
ok('empty survey yields no position', positionAtMd([], 100) === null);

// ── the join ──────────────────────────────────────────────────────────────────
const heads = [
  { name: 'A', x: 1000, y: 2000, role: 'OIL_PRODUCER' },
  { name: 'B', x: 5000, y: 6000, role: 'WATER_INJECTOR' },
  { name: 'NoSlot', role: 'OIL_PRODUCER' },
];
const surveys = [{ well: 'A', stations: ST }, { well: 'B', stations: ST }, { well: 'NoSlot', stations: ST }];
const impacts = buildImpacts(
  [{ well: 'A', surface: 'Hugin Fm. VOLVE Top', md: 1500, tvdss: -1400 },
    { well: 'B', surface: 'Hugin Fm. VOLVE Top', md: 1000, tvdss: -950 },
    { well: 'NoSlot', surface: 'Hugin Fm. VOLVE Top', md: 1000, tvdss: null },
    { well: 'Ghost', surface: 'Hugin Fm. VOLVE Top', md: 1000, tvdss: null }],
  heads, surveys,
);
ok('slotless and survey-less wells are dropped, not placed at the origin',
  impacts.length === 2, `got ${impacts.length}`);
ok('impact is wellhead + survey offset at the pick MD',
  (() => { const a = impacts.find((i) => i.well === 'A'); return a.easting === 1100 && a.northing === 2100; })());
ok('role carried from the well master',
  impacts.find((i) => i.well === 'A').role === 'producer'
  && impacts.find((i) => i.well === 'B').role === 'injector');
ok('pick depths pass through unchanged',
  impacts.find((i) => i.well === 'A').tvdss === -1400);

const dupes = buildImpacts(
  [{ well: 'A', surface: 'X Top', md: 1800, tvdss: null }, { well: 'A', surface: 'X Top', md: 1200, tvdss: null }],
  heads, surveys,
);
ok('a repeated pick keeps the shallowest (the entry point)', dupes.length === 1 && dupes[0].md === 1200);

// ── well statistics ───────────────────────────────────────────────────────────
const s = summariseWell([
  { ym: '2010-01', oil: 100, gas: 10, water: 0, wi: 0 },
  { ym: '2010-02', oil: 100, gas: 10, water: 100, wi: 0 },
  { ym: '2010-03', oil: 0, gas: 0, water: 0, wi: 0 },
], '2010-03');
ok('cumulatives are plain sums', s.cumOil === 200 && s.cumGas === 20 && s.cumWater === 100);
ok('life water cut is water/(oil+water)', near(s.wct, 100 / 300, 1e-9));
ok('first and last FLOWING months, not first and last rows',
  s.firstFlow === '2010-01' && s.lastFlow === '2010-02');
ok('a well with no rate in the reference month is not active', s.active === false);
ok('observed nothing is reported as none', s.observed === 'none');

const inj = summariseWell([{ ym: '2010-01', wi: 500 }, { ym: '2010-02', wi: 400 }], '2010-02');
ok('injection accumulates and reads as injection', inj.cumWi === 900 && inj.observed === 'water-injection' && inj.active);

const dry = summariseWell([{ ym: '2010-01', oil: 0, water: 0 }], '2010-01');
ok('0/0 water cut is null, NOT zero percent', dry.wct === null && dry.wctRecent === null);

const shut = summariseWell([
  { ym: '2010-01', oil: 10, water: 90 }, { ym: '2020-01', oil: 0, water: 0 },
], '2020-01');
ok('recent water cut uses the last PRODUCING months, not the last calendar rows',
  near(shut.wctRecent, 0.9, 1e-9));
ok('a well flowing in its own last row but not the field reference month is inactive',
  summariseWell([{ ym: '2010-01', oil: 5 }], '2016-09').active === false);

// ── stratigraphic order ───────────────────────────────────────────────────────
const ord = orderHorizons([
  { id: 'ty', name: 'Ty Fm Top', ageMa: 60, meanDepth: 2455 },
  { id: 'hb', name: 'Hugin Fm Base', ageMa: 168, meanDepth: 3115 },
  { id: 'ht', name: 'Hugin Fm Top', ageMa: 163, meanDepth: 3059 },
]);
ok('dated surfaces run oldest first',
  ord.map((o) => o.item.id).join() === 'hb,ht,ty', ord.map((o) => o.item.id).join());
ok('and are reported as age-based', ord.every((o) => o.basis === 'age'));
ok('note names the basis', /published unit age/.test(orderNote(ord)));

const mixed = orderHorizons([
  { id: 'shallow', name: 'A', meanDepth: 2500 },
  { id: 'deep', name: 'B', meanDepth: 3400 },
  { id: 'lost', name: 'C' },
]);
ok('undated surfaces fall back to depth, deeper first',
  mixed.map((o) => o.item.id).join() === 'deep,shallow,lost', mixed.map((o) => o.item.id).join());
ok('an unplaceable surface is kept at the end, not dropped',
  mixed.length === 3 && mixed[2].basis === 'none');
ok('a depth-only order says so rather than claiming age', /grid depth/.test(orderNote(mixed)));
ok('a mixed order admits the mix', /by published age, the rest/.test(orderNote(orderHorizons([
  { id: 'a', name: 'A', ageMa: 100, meanDepth: 3000 }, { id: 'b', name: 'B', meanDepth: 2000 },
]))));

// ── against the shipped bundle ────────────────────────────────────────────────
let index = null, picks = null;
try {
  index = JSON.parse(readFileSync(join(root, 'public/wb/index.json'), 'utf8'));
  picks = JSON.parse(readFileSync(join(root, 'public/wb/picks.json'), 'utf8'));
} catch { /* public/wb is generated and gitignored */ }

if (index && picks) {
  const wells = (index.wells ?? []).map((w) => ({ name: w.name, x: w.x, y: w.y, role: w.role }));
  const surveys = [];
  for (const w of (index.wells ?? []).filter((w) => w.has?.traj)) {
    const slug = String(w.name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    try {
      const t = JSON.parse(readFileSync(join(root, `public/wb/traj-${slug}.json`), 'utf8'));
      if (t.stations?.length) surveys.push({ well: t.well ?? w.name, stations: t.stations });
    } catch { /* not every bore ships a survey file under this slug */ }
  }

  const huginTop = matchPicks('Hugin Fm Top', picks.picks);
  ok('real Hugin Top picks are found', huginTop.picks.length > 0, `${huginTop.picks.length}`);
  ok('and none of them are the Base',
    huginTop.picks.every((p) => !/base$/i.test(p.surface.trim())));

  const realBcu = matchPicks('BCU', picks.picks);
  ok('real BCU resolves through the alias and is flagged',
    realBcu.picks.length > 0 && realBcu.interpreted != null, `${realBcu.picks.length}`);

  const pts = buildImpacts(huginTop.picks, wells, surveys);
  ok('Hugin Top impacts land for real wells', pts.length > 0, `${pts.length}`);
  ok('every impact sits in the Volve footprint',
    pts.every((p) => p.easting > 425_000 && p.easting < 445_000
      && p.northing > 6_470_000 && p.northing < 6_485_000));
  // the Hugin Top grid covers 432108–439358 E, 6475807–6481407 N (index.surfaces)
  const grid = (index.surfaces ?? []).find((s) => s.id === 'hugin_top');
  if (grid) {
    const inGrid = pts.filter((p) => p.easting >= grid.x0 && p.easting <= grid.x0 + grid.cell * (grid.nx - 1)
      && p.northing >= grid.y0 && p.northing <= grid.y0 + grid.cell * (grid.ny - 1));
    ok('impacts fall INSIDE the mapped grid they correlate to',
      inGrid.length === pts.length, `${inGrid.length}/${pts.length}`);
  }
  ok('one point per well, no duplicates',
    new Set(pts.map((p) => p.well)).size === pts.length);

  // REGISTRATION. The markers and the draped raster are placed by two different
  // code paths — per-point ed50UtmToWgs84 for the wells, four reprojected corners
  // for the image. They agree only if both are right, so assert it in the frame
  // the map actually draws in (WGS84), not just in projected metres.
  if (grid) {
    const { ed50UtmToWgs84, gridCornersWgs84 } = await import('../src/engine/proj.ts');
    const c = gridCornersWgs84(grid.x0, grid.y0, grid.nx, grid.ny, grid.cell, 31);
    const lons = [c.sw[0], c.se[0], c.ne[0], c.nw[0]];
    const lats = [c.sw[1], c.se[1], c.ne[1], c.nw[1]];
    const box = {
      w: Math.min(...lons), e: Math.max(...lons), s: Math.min(...lats), n: Math.max(...lats),
    };
    const geo = pts.map((p) => ed50UtmToWgs84(p.easting, p.northing, 31));
    ok('every impact falls inside the draped grid in LON',
      geo.every((g) => g.lon >= box.w && g.lon <= box.e),
      `${box.w.toFixed(4)}–${box.e.toFixed(4)}`);
    ok('every impact falls inside the draped grid in LAT',
      geo.every((g) => g.lat >= box.s && g.lat <= box.n),
      `${box.s.toFixed(4)}–${box.n.toFixed(4)}`);
    // Shape, not just containment: a bug that scaled or transposed one axis would
    // still land inside the box. Volve's Hugin penetrations span ~2.0 x 1.85 km,
    // so on a local Mercator the cluster must come out slightly WIDER than tall.
    const merc = (lat) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    const dx = Math.max(...geo.map((g) => g.lon)) - Math.min(...geo.map((g) => g.lon));
    const dy = (Math.max(...geo.map((g) => merc(g.lat))) - Math.min(...geo.map((g) => merc(g.lat)))) * (180 / Math.PI);
    ok('the cluster keeps its true aspect once projected',
      dx / dy > 1.0 && dx / dy < 1.25, `W:H = ${(dx / dy).toFixed(3)}`);
  }

  // ordering over the real surfaces, on the depth basis the grids alone provide
  const surfs = (index.surfaces ?? []).filter((s) => s.id !== 'seabed')
    .map((s) => ({ id: s.id, name: s.name, meanDepth: (s.zmin + s.zmax) / 2 }));
  const realOrder = orderHorizons(surfs).map((o) => o.item.id);
  ok('Hugin Base sits below Hugin Top in the real ordering',
    realOrder.indexOf('hugin_base') < realOrder.indexOf('hugin_top'), realOrder.join(','));
  ok('the Jurassic reservoir sits below the Paleocene Ty',
    realOrder.indexOf('hugin_top') < realOrder.indexOf('ty_top'), realOrder.join(','));
}

console.log(`horizon-picks: ${pass}/${pass + fail}`);
if (fail) process.exit(1);
