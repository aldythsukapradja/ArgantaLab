// streamlines + run-store truth-lock.
//
// The assertions that matter:
//   1. a saved run is only valid against the realisation it was SOLVED on. Loading one
//      against a different grid is a silent failure: the charts render, the animation
//      plays, and the flood is on rock it never flowed through;
//   2. streamlines are traced from the SAVED flux field, so the drainage picture and
//      the saturation animation are the same run, not two runs of the same recipe;
//   3. the LOST fraction — injection that reaches no producer — is reported, never
//      normalised away. It is the most useful number on the page;
//   4. time-of-flight is reported as a MEDIAN, because the distribution is strongly
//      right-skewed and a mean reports a sweep slower than the one doing the work.
// Run: node scripts/test-streamlines.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

if (!existsSync(join(__dirname, '..', 'src', 'tabs', 'fielddev', 'streamlines.ts'))) { console.log('SKIP'); process.exit(0); }
const { runId, runMatches, mismatchReason } = await import('../src/tabs/fielddev/run-store.ts');
const { geomOf, wellCellsOf, drainage, tofStats, thin } = await import('../src/tabs/fielddev/streamlines.ts');
const { traceStreamlines } = await import('../src/engine/sim/streamline.ts');
const { columnAverages, buildFvCfg } = await import('../src/tabs/fielddev/sim-run.ts');
const { simulateFV } = await import('../src/engine/sim/fv.ts');

// ── a run identity is (field, realisation, period) ──────────────────────────
{
  eq('the id names all three', runId('volve', 'v0', 3650), 'volve::v0::3650d');

  const base = {
    fieldId: 'volve', gridVersionId: 'v0', tEnd: 3650,
    sw: [new Float64Array(4)], fluxX: [new Float64Array(2)], fluxY: [new Float64Array(2)],
  };
  check('a run matches its own basis', runMatches(base, 'volve', 'v0', 3650), '');
  check('…and not a different realisation', !runMatches(base, 'volve', 'R2', 3650), '');
  check('…nor a different field', !runMatches(base, 'sleipner', 'v0', 3650), '');
  check('…nor a different simulated period', !runMatches(base, 'volve', 'v0', 7300), '');
  check('a missing run never matches', !runMatches(null, 'volve', 'v0', 3650), '');

  // a run stored before flux was captured cannot seed streamlines, and must say so
  const noFlux = { ...base, fluxX: [] };
  check('a run with no flux field is refused', !runMatches(noFlux, 'volve', 'v0', 3650), '');
  check('…and the reason names streamlines',
    /streamlines/.test(mismatchReason(noFlux, 'volve', 'v0', 3650) ?? ''),
    mismatchReason(noFlux, 'volve', 'v0', 3650) ?? 'null');

  eq('a matching run has no reason to reject it', mismatchReason(base, 'volve', 'v0', 3650), null);
  check('a wrong realisation says WHICH one it was solved on',
    /v0/.test(mismatchReason(base, 'volve', 'R2', 3650) ?? ''),
    mismatchReason(base, 'volve', 'R2', 3650) ?? 'null');
}

// ── trace a real five-spot and read it as drainage ──────────────────────────
const nx = 21, ny = 21, nCol = nx * ny;
const G = {
  nx, ny, nz: 1, dx: 50, dy: 50, x0: 0, y0: 0,
  activeCol: new Uint8Array(nCol).fill(1),
  topZ: new Float64Array(nCol).fill(2500), baseZ: new Float64Array(nCol).fill(2540),
};
const F = {
  swc: 0.2, sor: 0.25, krwMax: 0.35, kroMax: 0.9, nw: 3, no: 2,
  muw: 0.4, muo: 2.0, bo: 1.25, bw: 1.02, swInit: 0.2, pInit: 250,
};
const cols = columnAverages(G, () => ({ phi: 0.25, perm: 200, sw: F.swc }));
// one injector at the centre, four producers at the corners — the classic five-spot,
// where the right answer is known: each producer takes a quarter
const mid = 10;
const wells = [
  { name: 'INJ', x: mid * 50 + 25, y: mid * 50 + 25, kind: 'injector', rate: 800 },
  { name: 'P-SW', x: 25, y: 25, kind: 'producer', bhp: 200 },
  { name: 'P-SE', x: (nx - 1) * 50 + 25, y: 25, kind: 'producer', bhp: 200 },
  { name: 'P-NW', x: 25, y: (ny - 1) * 50 + 25, kind: 'producer', bhp: 200 },
  { name: 'P-NE', x: (nx - 1) * 50 + 25, y: (ny - 1) * 50 + 25, kind: 'producer', bhp: 200 },
];
const b = buildFvCfg(G, cols, F, wells);
const res = simulateFV(b.cfg, { tEnd: 1200, nReports: 6, timestepping: 'implicit' });
const snap = res.snapshots[Math.floor(res.snapshots.length / 2)];

// the StoredRun shape the Streamline surface actually receives
const stored = {
  id: runId('t', 'v0', 1200), fieldId: 't', gridVersionId: 'v0', savedAt: 0,
  tEnd: 1200, historyEnd: null,
  grid: {
    nx, ny, nz: 1, dx: 50, dy: 50, x0: 0, y0: 0,
    activeCol: G.activeCol, phi: b.cfg.phi, dz: b.meanH,
  },
  coarseFactor: 1,
  times: res.snapshots.map((s) => s.t),
  sw: res.snapshots.map((s) => s.sw),
  fluxX: res.snapshots.map((s) => s.fluxX),
  fluxY: res.snapshots.map((s) => s.fluxY),
  placed: b.placed, collisions: b.collisions,
  series: { field: [], wells: [], ooipSm3: 0, poreVolume: res.poreVol },
  assumptions: { phases: '', dimensionality: '', compressibility: '', caveats: [] },
};

{
  const g = geomOf(stored);
  eq('the geometry is the run\'s own flow grid', [g.nx, g.ny, g.dx], [nx, ny, 50]);
  near('…including the layer thickness the areal collapse produced', g.dz, b.meanH, 1e-9);
  check('…and its porosity field, which time-of-flight depends on', g.phi === stored.grid.phi, '');

  const wc = wellCellsOf(stored);
  eq('every placed well becomes a tracer cell', wc.length, b.placed.length);
  // only injectors seed lines, so a misclassification produces lines from the wrong
  // place and looks like a result rather than a mapping error
  eq('injectors are tagged inj', wc.filter((w) => w.kind === 'inj').map((w) => w.name), ['INJ']);
  eq('producers are tagged prod', wc.filter((w) => w.kind === 'prod').length, 4);
}

{
  const wc = wellCellsOf(stored);
  const tr = traceStreamlines(geomOf(stored), snap.fluxX, snap.fluxY, wc, { perInjector: 32 });
  check('streamlines were traced', tr.lines.length > 0, `${tr.lines.length}`);

  const d = drainage(tr, wc);
  check('the drainage table is not empty', d.rows.length > 0, `${d.rows.length} rows`);
  check('every row names an injector and a producer',
    d.rows.every((r) => r.injector && r.producer), '');
  check('every allocation is a fraction',
    d.rows.every((r) => r.fraction >= 0 && r.fraction <= 1), '');

  // A SYMMETRIC FIVE-SPOT SPLITS FOUR WAYS. This is the check that says the tracing
  // is physical and not merely non-empty.
  const four = d.rows.filter((r) => r.injector === 'INJ');
  check('all four producers are supported by the central injector', four.length === 4,
    four.map((r) => `${r.producer} ${(r.fraction * 100).toFixed(0)}%`).join(' '));
  for (const r of four) {
    near(`  ${r.producer} takes about a quarter`, r.fraction, 0.25, 0.12);
  }

  const cap = d.captured.find((c) => c.injector === 'INJ');
  near('captured plus lost is exactly one', cap.captured + cap.lost, 1, 1e-9);
  check('most of a centred injector\'s water is captured', cap.captured > 0.8, `${cap.captured.toFixed(3)}`);
  eq('no producer is unsupported in a symmetric pattern', d.unsupported, []);
  eq('…and no injector is orphaned', d.orphaned, []);

  const t = tofStats(tr);
  check('time-of-flight is reported for the lines that ARRIVE', t.n > 0, `${t.n} of ${tr.lines.length}`);
  check('the percentiles are ordered', t.p10 <= t.p50 && t.p50 <= t.p90 && t.p90 <= t.max,
    `${t.p10.toFixed(0)} / ${t.p50.toFixed(0)} / ${t.p90.toFixed(0)} / ${t.max.toFixed(0)}`);
  check('…and are positive travel times', t.p10 > 0, `${t.p10}`);
  eq('lines that arrive plus lines that do not equals every line', t.n + t.unswept, tr.lines.length);

  // thinning is a DISPLAY decision and must report what it dropped
  const th = thin(tr, 10);
  eq('thinning returns the cap', th.lines.length, 10);
  eq('…and says how many it dropped', th.dropped, tr.lines.length - 10);
  const none = thin(tr, tr.lines.length + 5);
  eq('nothing is dropped when it fits', none.dropped, 0);
}

// ── an injector whose water reaches nobody is REPORTED, not hidden ──────────
{
  const wc = [
    { i: 1, j: 1, name: 'LONELY', kind: 'inj' },
    { i: 19, j: 19, name: 'P-FAR', kind: 'prod' },
  ];
  const empty = { lines: [{ pts: [], totalTof: 0, fromWell: 'LONELY', toWell: null }], allocation: {}, maxTof: 0 };
  const d = drainage(empty, wc);
  eq('an injector reaching nobody is orphaned', d.orphaned, ['LONELY']);
  eq('…its whole injection is reported as lost', d.captured[0].lost, 1);
  eq('a producer nothing reaches is unsupported', d.unsupported, ['P-FAR']);
}

// ── allocations are NOT renormalised to hide the loss ───────────────────────
{
  const wc = [
    { i: 0, j: 0, name: 'I', kind: 'inj' },
    { i: 5, j: 5, name: 'P', kind: 'prod' },
  ];
  // only 40% of this injector's lines arrive anywhere
  const partial = { lines: [], allocation: { 'I→P': 0.4 }, maxTof: 0 };
  const d = drainage(partial, wc);
  near('the reported allocation is left as traced', d.rows[0].fraction, 0.4, 1e-9);
  near('…and the other 60% is stated as LOST, not normalised away',
    d.captured[0].lost, 0.6, 1e-9);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
