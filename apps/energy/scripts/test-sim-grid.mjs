// sim-grid.ts truth-lock — SIS/SGS over a 3D grid (S6 · S7).
//
// The assertions that matter here are about HONESTY at scale: the simulation runs on
// a coarse grid and is upsampled, so the result must carry the resolution it really
// had; porosity must be simulated per facies; and a seeded run must reproduce.
// Run: node scripts/test-sim-grid.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'sim-grid.ts');
if (!existsSync(mod)) { console.log('SKIP — sim-grid.ts absent'); process.exit(0); }
const {
  deriveSimGrid, simNodeXY, simNodeOf, simulateLayer, simulateGrid, permV, estimateSimOps,
} = await import('../src/tabs/fielddev/sim-grid.ts');

const MODEL = { nx: 40, ny: 30, nz: 4, dx: 50, dy: 50, x0: 1000, y0: 2000 };
const VARIO = { model: 'spherical', nugget: 0.05, sill: 1, range: 600 };
const SPEC = {
  vario: VARIO, seed: 1234, simNodes: 8,
  permA: 19, permB: -1.5, kvkh: 0.1,
};

// ── the simulation grid: coarse, same extent, never finer than the model ──────
{
  const s = deriveSimGrid(MODEL, 8);
  eq('the simulation grid is the requested size', [s.nx, s.ny], [8, 8]);
  eq('it starts at the model origin', [s.x0, s.y0], [1000, 2000]);
  check('it spans the SAME ground, so its cells are proportionally larger',
    Math.abs(s.nx * s.dx - MODEL.nx * MODEL.dx) < 1e-9 && Math.abs(s.ny * s.dy - MODEL.ny * MODEL.dy) < 1e-9,
    `${s.nx}×${s.dx} vs ${MODEL.nx}×${MODEL.dx}`);

  // asking for more nodes than the model has is work thrown away
  const capped = deriveSimGrid(MODEL, 500);
  eq('the simulation is never FINER than the model grid', [capped.nx, capped.ny], [40, 30]);
  const floored = deriveSimGrid(MODEL, 1);
  eq('and never degenerate', [floored.nx, floored.ny], [2, 2]);
}

// ── upsampling: every model column maps into a simulation node ────────────────
{
  const sim = deriveSimGrid(MODEL, 8);
  const n0 = simNodeOf(MODEL, sim, 0, 0);
  const nEnd = simNodeOf(MODEL, sim, MODEL.nx - 1, MODEL.ny - 1);
  eq('the first model column maps to the first simulation node', n0, 0);
  eq('the last maps to the last', nEnd, sim.nx * sim.ny - 1);

  let allInRange = true;
  for (let j = 0; j < MODEL.ny; j++) {
    for (let i = 0; i < MODEL.nx; i++) {
      const n = simNodeOf(MODEL, sim, i, j);
      if (!(n >= 0 && n < sim.nx * sim.ny)) allInRange = false;
    }
  }
  check('every model column maps inside the simulation grid', allInRange, '');

  const c = simNodeXY(sim, 0, 0);
  check('a simulation node sits at its own cell centre',
    Math.abs(c.x - (sim.x0 + sim.dx / 2)) < 1e-9, `x = ${c.x}`);
}

// ── one layer ────────────────────────────────────────────────────────────────
const cond = (i, j, k, facies, phie) => ({ i, j, k, facies, phie });
{
  const data = [
    cond(5, 5, 0, 1, 0.25), cond(10, 8, 0, 1, 0.23), cond(30, 20, 0, 0, 0.08),
    cond(20, 12, 0, 1, 0.27), cond(35, 25, 0, 0, 0.06),
  ];
  const sim = deriveSimGrid(MODEL, 8);
  const L = simulateLayer(data, MODEL, sim, SPEC, 0);

  eq('the layer covers every model column', L.facies.length, MODEL.nx * MODEL.ny);
  eq('…and so do the property arrays', [L.phie.length, L.perm.length],
    [MODEL.nx * MODEL.ny, MODEL.nx * MODEL.ny]);
  eq('the conditioning count is reported', L.conditioned, 5);
  check('facies are only ever 0 or 1', [...L.facies].every((f) => f === 0 || f === 1), '');
  check('porosity is inside a physical range',
    [...L.phie].every((p) => p >= 0 && p <= 0.6), `max = ${Math.max(...L.phie)}`);
  check('permeability is positive everywhere', [...L.perm].every((k) => k > 0), '');
  check('both facies actually appear — a single-facies field would mean SIS did nothing',
    new Set([...L.facies]).size === 2, `facies present: ${[...new Set([...L.facies])].join(',')}`);

  // porosity must track facies: sand data average 0.25, shale 0.07, so the sand
  // cells must read materially higher than the shale ones
  let sandSum = 0, sandN = 0, shaleSum = 0, shaleN = 0;
  for (let c = 0; c < L.facies.length; c++) {
    if (L.facies[c] === 1) { sandSum += L.phie[c]; sandN++; } else { shaleSum += L.phie[c]; shaleN++; }
  }
  const sandPhi = sandSum / sandN, shalePhi = shaleSum / shaleN;
  check('sand porosity is materially higher than shale porosity — SGS ran PER FACIES',
    sandPhi > shalePhi + 0.05, `sand ${sandPhi.toFixed(3)} vs shale ${shalePhi.toFixed(3)}`);
}

// ── a facies with one datum is a constant, not a realisation ──────────────────
{
  const data = [cond(5, 5, 0, 1, 0.25), cond(10, 8, 0, 1, 0.23), cond(30, 20, 0, 0, 0.08)];
  const sim = deriveSimGrid(MODEL, 6);
  const L = simulateLayer(data, MODEL, sim, SPEC, 0);
  const shale = [];
  for (let c = 0; c < L.facies.length; c++) if (L.facies[c] === 0) shale.push(L.phie[c]);
  check('a single-datum facies is held constant rather than given invented noise',
    shale.length === 0 || new Set(shale.map((v) => v.toFixed(6))).size === 1,
    `${new Set(shale.map((v) => v.toFixed(6))).size} distinct shale porosities`);
}

// ── the whole grid ───────────────────────────────────────────────────────────
{
  const byLayer = new Map([
    [0, [cond(5, 5, 0, 1, 0.25), cond(30, 20, 0, 0, 0.08), cond(20, 12, 0, 1, 0.26)]],
    [2, [cond(5, 5, 2, 1, 0.20), cond(30, 20, 2, 0, 0.05)]],
  ]);
  const r = simulateGrid(byLayer, MODEL, SPEC);

  eq('one result per layer', r.layers.length, MODEL.nz);
  eq('THE SIMULATION RESOLUTION IS CARRIED ON THE RESULT', [r.simGrid.nx, r.simGrid.ny], [8, 8]);
  eq('…alongside the model resolution it was upsampled to', [r.modelNx, r.modelNy], [40, 30]);
  check('the two are genuinely different — the label is not decoration',
    r.simGrid.nx !== r.modelNx, `${r.simGrid.nx} simulated vs ${r.modelNx} model`);
  eq('layers with no conditioning datum of their own are counted', r.unconditionedLayers, 2);
  check('sand fraction is a real fraction', r.sandFraction > 0 && r.sandFraction < 1, `${r.sandFraction.toFixed(3)}`);
  eq('the seed is recorded, so the realisation can be named', r.seed, 1234);

  // reproducibility — the same seed must give the same model, or "realisation 3"
  // means nothing
  const again = simulateGrid(byLayer, MODEL, SPEC);
  eq('the same seed reproduces the field exactly',
    [...again.layers[0].facies].join(''), [...r.layers[0].facies].join(''));
  const other = simulateGrid(byLayer, MODEL, { ...SPEC, seed: 999 });
  check('a different seed gives a different realisation',
    [...other.layers[0].facies].join('') !== [...r.layers[0].facies].join(''), '');

  // and every layer must differ from its neighbour, or the model is one picture
  // stamped nz times
  check('layers are not identical copies of one another',
    [...r.layers[0].facies].join('') !== [...r.layers[1].facies].join(''), '');
}

// ── kv/kh and the cost estimate ──────────────────────────────────────────────
eq('vertical permeability is the ratio applied', permV(100, 0.1), 10);
{
  const small = estimateSimOps(16, 10), big = estimateSimOps(64, 10);
  check('the cost estimate grows faster than linearly in the node count — which is why the grid is coarse',
    big / small > 100, `16→${small.toExponential(1)}, 64→${big.toExponential(1)} (${(big / small).toFixed(0)}×)`);
}

// ── layer scoping — a φ–k transform only speaks for the formation it was fitted to ──
//
// Volve measured this: with every layer simulated, 78% of the Seabed→Ty overburden
// cells hit PERM_MAX_MD against 0.2% of the reservoir's. Those cells are not part of
// the flow model, so the answer is to leave them empty, not to cap an invented number.
{
  const byLayer = new Map([
    [0, [cond(5, 5, 0, 1, 0.25), cond(30, 20, 0, 0, 0.08), cond(20, 12, 0, 1, 0.26)]],
    [2, [cond(5, 5, 2, 1, 0.20), cond(30, 20, 2, 0, 0.05)]],
  ]);
  const all = simulateGrid(byLayer, MODEL, SPEC);
  const scoped = simulateGrid(byLayer, MODEL, { ...SPEC, layers: [2, 3] });

  eq('every layer is simulated when no scope is given', all.skippedLayers, 0);
  eq('…and simulatedLayers is then the whole grid', all.simulatedLayers, MODEL.nz);

  eq('a scoped run simulates only the named layers', scoped.simulatedLayers, 2);
  eq('…and counts the rest as skipped', scoped.skippedLayers, MODEL.nz - 2);
  eq('a Set is accepted as well as an array',
    simulateGrid(byLayer, MODEL, { ...SPEC, layers: new Set([2, 3]) }).simulatedLayers, 2);

  check('the layer array still spans the whole grid, so k indexes nothing new',
    scoped.layers.length === MODEL.nz, `${scoped.layers.length}`);
  check('a skipped layer is FLAGGED, not silently zero',
    scoped.layers[0].simulated === false && scoped.layers[2].simulated === true, '');
  check('a skipped layer carries no conditioning claim', scoped.layers[0].conditioned === 0, '');
  check('and its arrays are the right length so consumers do not crash',
    scoped.layers[0].phie.length === MODEL.nx * MODEL.ny, '');

  // the statistic denominator must shrink with the scope, or scoping just hides
  // capped cells inside a percentage that still counts them
  eq('simulatedCells counts only the simulated layers',
    scoped.simulatedCells, 2 * MODEL.nx * MODEL.ny);
  check('a scoped run cannot cap more cells than an unscoped one',
    scoped.permCapped <= all.permCapped, `${scoped.permCapped} vs ${all.permCapped}`);

  // scoping must not perturb the layers it does keep — otherwise the reservoir
  // realisation would change depending on what was excluded above it
  eq('a kept layer is bit-identical to its unscoped self',
    [...scoped.layers[2].facies].join(''), [...all.layers[2].facies].join(''));
  eq('…including its porosity',
    [...scoped.layers[2].phie].join(','), [...all.layers[2].phie].join(','));

  eq('an empty scope simulates nothing at all',
    simulateGrid(byLayer, MODEL, { ...SPEC, layers: [] }).simulatedLayers, 0);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
