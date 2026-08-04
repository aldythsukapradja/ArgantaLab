// Well-activity truth-lock — the active producer/injector counts that replace the
// VRR line on the Field Development copy of the RM voidage chart.
//
// The contract: a well counts as active in a month only if it MOVED FLUID that
// month. Existing is not producing; having produced once is not producing now. A
// shut-in month inside a producing well's life must read as a real zero, because
// the whole point of the overlay is to separate reservoir decline from lost wells.
// Run: node scripts/test-well-activity.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WB = join(__dirname, '..', 'public', 'wb');

let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };

const { buildActivity } = await import('../src/tabs/fielddev/well-activity.ts');

console.log('\n=== Well activity (active producers / injectors) ===\n');

// ── 1 · the counting rule ────────────────────────────────────────────────────
console.log('-- 1 · counting rule --');
{
  const months = ['2020-01', '2020-02', '2020-03'];
  const a = buildActivity(months, [
    { well: 'P1', monthly: [{ ym: '2020-01', oil: 100, water: 0, wi: 0 }, { ym: '2020-02', oil: 0, water: 0, wi: 0 }, { ym: '2020-03', oil: 80, water: 0, wi: 0 }] },
    { well: 'P2', monthly: [{ ym: '2020-01', oil: 50, water: 0, wi: 0 }, { ym: '2020-02', oil: 40, water: 0, wi: 0 }, { ym: '2020-03', oil: 0, water: 0, wi: 0 }] },
    { well: 'I1', monthly: [{ ym: '2020-01', oil: 0, water: 0, wi: 900 }, { ym: '2020-02', oil: 0, water: 0, wi: 800 }, { ym: '2020-03', oil: 0, water: 0, wi: 0 }] },
  ]);
  check('counts producers that flowed that month', a.points.map((p) => p.producers).join(',') === '2,1,1',
    a.points.map((p) => p.producers).join(','));
  check('counts injectors separately', a.points.map((p) => p.injectors).join(',') === '1,1,0',
    a.points.map((p) => p.injectors).join(','));
  check('a shut-in month is a REAL zero, not carried forward', a.points[1].producers === 1);
  check('an injector is never counted as a producer', a.points[0].producers === 2);
  check('maxWells is the peak of either series', a.maxWells === 2, String(a.maxWells));
  check('peak producers reported with its month', a.peakProducers?.n === 2 && a.peakProducers.ym === '2020-01',
    JSON.stringify(a.peakProducers));
}

// ── 2 · the axis is fixed by the field series ────────────────────────────────
console.log('\n-- 2 · axis integrity --');
{
  const months = ['2020-01', '2020-02', '2020-03'];
  const a = buildActivity(months, [
    { well: 'P1', monthly: [{ ym: '2020-01', oil: 10, water: 0, wi: 0 }, { ym: '2020-03', oil: 10, water: 0, wi: 0 }] },
  ]);
  check('every field month appears, even with zero wells', a.points.length === 3);
  check('a total-shutdown month renders as 0, not a closed gap', a.points[1].producers === 0);

  const b = buildActivity(months, [
    { well: 'X', monthly: [{ ym: '2019-06', oil: 999, water: 0, wi: 0 }, { ym: '2020-02', oil: 5, water: 0, wi: 0 }] },
  ]);
  check('a month outside the field window is ignored, not appended',
    b.points.length === 3 && b.points[1].producers === 1);
}

// ── 3 · degenerate inputs ────────────────────────────────────────────────────
console.log('\n-- 3 · degenerate inputs --');
{
  const none = buildActivity([], []);
  check('no months ⇒ no points, no peak', none.points.length === 0 && none.peakProducers === null);
  const dead = buildActivity(['2020-01'], [{ well: 'A', monthly: [{ ym: '2020-01', oil: 0, water: 0, wi: 0 }] }]);
  check('a field that never flowed reports NO peak (not a peak of 0)',
    dead.peakProducers === null && dead.peakInjectors === null);
  check('…but still returns the month', dead.points.length === 1 && dead.points[0].producers === 0);
  const nulls = buildActivity(['2020-01'], [{ well: 'A', monthly: [{ ym: '2020-01', oil: null, water: null, wi: null }] }]);
  check('null volumes are not counted as flow', nulls.points[0].producers === 0);
}

// ── 4 · REAL Volve ───────────────────────────────────────────────────────────
console.log('\n-- 4 · real Volve series --');
const idxFile = join(WB, 'index.json'), fieldFile = join(WB, 'prod-field.json');
if (!existsSync(idxFile) || !existsSync(fieldFile)) {
  check('Volve fixtures present', false, 'run npm run data:wb');
} else {
  const index = JSON.parse(readFileSync(idxFile, 'utf8'));
  const field = JSON.parse(readFileSync(fieldFile, 'utf8'));
  const months = field.monthly.map((m) => m.ym);

  const wells = [];
  for (const f of readdirSync(WB)) {
    if (!/^prod-.+\.json$/.test(f) || f === 'prod-field.json') continue;
    const j = JSON.parse(readFileSync(join(WB, f), 'utf8'));
    wells.push({ well: j.well, monthly: j.monthly ?? [] });
  }
  const a = buildActivity(months, wells);

  check('per-well series found', wells.length > 0, `${wells.length} wells`);
  check('activity spans the whole field window', a.points.length === months.length,
    `${a.points.length} of ${months.length} months`);
  check('Volve had producers flowing', (a.peakProducers?.n ?? 0) > 0,
    a.peakProducers ? `peak ${a.peakProducers.n} in ${a.peakProducers.ym}` : 'none');
  check('Volve had injectors flowing', (a.peakInjectors?.n ?? 0) > 0,
    a.peakInjectors ? `peak ${a.peakInjectors.n} in ${a.peakInjectors.ym}` : 'none');

  // the count can never exceed the wellbores that exist
  const bores = index.wells.length;
  check('active count never exceeds the well stock', a.maxWells <= bores, `${a.maxWells} ≤ ${bores}`);

  // and it must fall to zero by the end — Volve ceased in 2016
  const last = a.points[a.points.length - 1];
  check('the final month reflects a ceased field', last.producers <= 1,
    `${last.ym}: ${last.producers} producing`);

  // the count should RISE then FALL — a development history, not a flat line
  const first = a.points[0];
  check('the field ramped up from its first month',
    (a.peakProducers?.n ?? 0) > first.producers,
    `${first.producers} → peak ${a.peakProducers?.n}`);
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
