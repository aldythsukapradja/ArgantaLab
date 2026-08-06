// sim-run truth-lock — the static model and the fluid case, turned into a run.
//
// The assertions that matter:
//   1. an inactive column contributes NOTHING to a column average — not a zero. Zero
//      porosity is a legitimate value and would enter the mean as one;
//   2. an unplaceable well is REJECTED WITH A REASON, never nudged to the nearest live
//      cell. Nudging is how a producer ends up in an aquifer in the model and nowhere
//      near it in the field, with the plot still looking reasonable;
//   3. reported volumes are SURFACE volumes. The solver works in reservoir volumes and
//      forgetting the Bo divide overstates a field by ~40% — it has happened here;
//   4. rates INTEGRATE BACK to the cumulative drawn beside them. Two curves on one
//      chart that disagree with each other is the fastest way to lose a reader.
// Run: node scripts/test-sim-run.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

if (!existsSync(join(__dirname, '..', 'src', 'tabs', 'fielddev', 'sim-run.ts'))) { console.log('SKIP'); process.exit(0); }
const {
  columnAverages, colAt, buildFvCfg, toSeries, runCase, assumptionsOf, splitAtHistory,
} = await import('../src/tabs/fielddev/sim-run.ts');
const { simulateFV } = await import('../src/engine/sim/fv.ts');

// a 12 x 10 grid, 60 m thick, with one dead patch
const nx = 12, ny = 10, nz = 5, nCol = nx * ny;
const activeCol = new Uint8Array(nCol).fill(1);
for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) activeCol[j * nx + i] = 0;
const topZ = new Float64Array(nCol).fill(2800);
const baseZ = new Float64Array(nCol).fill(2860);
const G = { nx, ny, nz, dx: 100, dy: 100, x0: 1000, y0: 2000, activeCol, topZ, baseZ };

const FLUIDS = {
  swc: 0.15, sor: 0.25, krwMax: 0.4, kroMax: 0.9, nw: 3, no: 2,
  muw: 0.4, muo: 1.6, bo: 1.25, bw: 1.02, swInit: 0.2, pInit: 240,
};

// ── column averages ─────────────────────────────────────────────────────────
{
  const cols = columnAverages(G, () => ({ phi: 0.22, perm: 150, sw: 0.2 }));
  near('an active column carries the property average', cols.phi[nx * 5 + 5], 0.22, 1e-9);
  near('…and the gross thickness it was averaged over', cols.h[nx * 5 + 5], 60, 1e-6);
  check('an INACTIVE column is NaN, not zero', Number.isNaN(cols.phi[0]), `got ${cols.phi[0]}`);
  check('…and contributes no thickness', cols.h[0] === 0, `got ${cols.h[0]}`);

  // a property that varies with depth must come out thickness-weighted, not counted
  const varying = columnAverages(G, (_c, l) => ({ phi: l === 0 ? 0.30 : 0.20, perm: 100, sw: 0.2 }));
  near('the average is thickness-weighted over the layers',
    varying.phi[nx * 5 + 5], (0.30 + 0.20 * 4) / 5, 1e-9);

  // NaN cells must be SKIPPED, not read as zero
  const holed = columnAverages(G, (_c, l) => (l === 0 ? null : { phi: 0.20, perm: 100, sw: 0.2 }));
  near('a layer with no property is skipped, not averaged in as zero',
    holed.phi[nx * 5 + 5], 0.20, 1e-9);
  near('…and the weight drops with it', holed.h[nx * 5 + 5], 48, 1e-6);
}

// ── well placement ──────────────────────────────────────────────────────────
{
  const cols = columnAverages(G, () => ({ phi: 0.22, perm: 150, sw: 0.2 }));
  eq('a position inside the grid resolves to its column', colAt(G, 1050, 2050), 0);
  eq('a position west of the grid is refused', colAt(G, 0, 2050), -1);
  eq('a position north of the grid is refused', colAt(G, 1050, 99999), -1);

  const b = buildFvCfg(G, cols, FLUIDS, [
    { name: 'PROD-1', x: 1550, y: 2550, kind: 'producer' },
    { name: 'INJ-1', x: 1250, y: 2750, kind: 'injector', rate: 500 },
    { name: 'OFFGRID', x: 99999, y: 2550, kind: 'producer' },
    { name: 'DEADZONE', x: 1050, y: 2050, kind: 'producer' },
  ]);
  eq('placeable wells are placed', b.placed.map((p) => p.name), ['PROD-1', 'INJ-1']);
  // NEVER nudged to the nearest live cell — refused, with the reason
  eq('an off-grid well is rejected by name', b.rejected.map((r) => r.name), ['OFFGRID', 'DEADZONE']);
  check('…and each rejection states why',
    b.rejected.every((r) => r.reason.length > 5), JSON.stringify(b.rejected));

  check('a producer runs on bottom-hole pressure', b.cfg.wells[0].mode === 'bhp', b.cfg.wells[0].mode);
  check('an injector runs on rate', b.cfg.wells[1].mode === 'rate', b.cfg.wells[1].mode);
  // POSITIVE. The solver adds `rate` to the cell's right-hand side, so a positive rate
  // is a SOURCE. This assertion used to demand a negative one, which is exactly how the
  // sign error survived: every injector was a second producer, the incompressible
  // system had no source at all, and pressure ran to 1e15.
  check('…and injects, so its rate is POSITIVE to the solver', b.cfg.wells[1].rate > 0, `${b.cfg.wells[1].rate}`);
  // A bhp well with no well index is 2*pi*k*h/ln(r0/rw) = 0: it contributes nothing to
  // the matrix and produces nothing, and with the only sink gone the solve is singular.
  check('a producer carries a Peaceman well index', (b.cfg.wells[0].WI ?? 0) > 0, `${b.cfg.wells[0].WI}`);

  // ── AN INACTIVE COLUMN MUST NOT BREAK THE PRESSURE SOLVE ────────────────
  // Zero permeability gives its row a zero diagonal, the preconditioner divides by it,
  // and NaN spreads through the whole solution. On the real Volve grid — 47% inactive —
  // that meant every pressure was NaN and nothing was ever produced, while the
  // saturation front still advanced, which is what made it look like it worked.
  check('a dead column keeps a tiny but NON-ZERO permeability', b.cfg.k[0] > 0 && b.cfg.k[0] < 1e-3,
    `${b.cfg.k[0]}`);
  check('…and a tiny but non-zero porosity', b.cfg.phi[0] > 0 && b.cfg.phi[0] < 1e-6, `${b.cfg.phi[0]}`);
  check('a dead column is initialised to water, not to connate', b.cfg.swInit[0] === 1, `${b.cfg.swInit[0]}`);

  near('the layer thickness is the mean gross of the ACTIVE area', b.meanH, 60, 1e-6);

  // the assumptions are never omitted, and a rejected well surfaces in them
  const a = assumptionsOf(b.meanH, b.rejected);
  check('the run states that it is two-phase', /two-phase/.test(a.phases), a.phases);
  check('…that it is areal, not 3D', /areal|2D/.test(a.dimensionality), a.dimensionality);
  check('…that it is incompressible', /incompressible/.test(a.compressibility), a.compressibility);
  check('…and it names the wells it could not place',
    a.caveats.some((c) => c.includes('OFFGRID')), a.caveats.join(' | '));
}

// ── a real run ──────────────────────────────────────────────────────────────
{
  const cols = columnAverages(G, () => ({ phi: 0.22, perm: 150, sw: FLUIDS.swc }));
  const out = runCase(G, cols, FLUIDS, [
    { name: 'INJ-1', x: 1450, y: 2450, kind: 'injector', rate: 400 },
    { name: 'PROD-1', x: 2050, y: 2850, kind: 'producer', bhp: 150 },
  ], { tEnd: 900, nReports: 30 }, simulateFV);

  const f = out.series.field;
  check('the run produced report steps', f.length > 5, `${f.length}`);
  check('time increases monotonically',
    f.every((s, i) => i === 0 || s.t > f[i - 1].t), '');
  check('cumulative oil never decreases',
    f.every((s, i) => i === 0 || s.cumOil >= f[i - 1].cumOil - 1e-9), '');
  check('the field produced something', f[f.length - 1].cumOil > 0, `${f[f.length - 1].cumOil}`);
  // the fixture HAS inactive columns, so this also proves the solve stayed non-singular
  check('every reported pressure is finite, on a grid with dead columns',
    f.every((s2) => Number.isFinite(s2.pAvg)), '');

  // SURFACE volumes, not reservoir. Bo = 1.25, so surface OOIP is 20% BELOW reservoir.
  near('OOIP is reported at SURFACE conditions (reservoir ÷ Bo)',
    out.series.ooipSm3, out.result.ooip / FLUIDS.bo, Math.abs(out.result.ooip) * 1e-9);
  check('…which is smaller than the reservoir volume, because Bo > 1',
    out.series.ooipSm3 < out.result.ooip, `${out.series.ooipSm3} vs ${out.result.ooip}`);

  // RATES MUST INTEGRATE BACK TO THE CUMULATIVE DRAWN BESIDE THEM
  let integ = 0;
  for (let i = 1; i < f.length; i++) integ += f[i].oilRate * (f[i].t - f[i - 1].t);
  near('the oil rate integrates to the cumulative on the same chart',
    integ, f[f.length - 1].cumOil, Math.max(1e-6, f[f.length - 1].cumOil * 1e-6));

  // recovery factor is against the run's OWN oil in place, and is a fraction
  const last = f[f.length - 1];
  near('recovery factor is cumulative over OOIP', last.rf, last.cumOil / out.series.ooipSm3, 1e-9);
  check('…and stays a fraction', last.rf >= 0 && last.rf <= 1, `${last.rf}`);

  check('water cut is a fraction throughout',
    f.every((s) => s.watercut >= -1e-9 && s.watercut <= 1 + 1e-9), '');

  // per-well series line up with the field series
  eq('there is one series per placed well', out.series.wells.length, out.build.placed.length);
  check('every well series has a point per report step',
    out.series.wells.every((w) => w.steps.length === f.length), '');
  check('well rates are reported as magnitudes, so a chart needs no sign convention',
    out.series.wells.every((w) => w.steps.every((s) => s.rate >= 0)), '');
}

// ── history and forecast are DISTINCT ───────────────────────────────────────
{
  const field = Array.from({ length: 11 }, (_, i) => ({ t: i * 100 }));
  const { history, forecast } = splitAtHistory({ field }, 500);
  check('history stops at the history end', history.every((s) => s.t <= 500), JSON.stringify(history.map((s) => s.t)));
  check('forecast starts after it', forecast.every((s) => s.t >= 500), JSON.stringify(forecast.map((s) => s.t)));
  // they OVERLAP by one point so the curves join; a gap reads as a discontinuity in
  // the physics rather than a change in what the curve is claiming
  check('the two share a point, so the curves join rather than jumping',
    history[history.length - 1].t === forecast[0].t,
    `${history[history.length - 1].t} vs ${forecast[0].t}`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
