// struct-qc.ts truth-lock — does the QC actually catch broken geometry?
//
// The central assertion is negative: a check that cannot run must report 'n/a', never
// 'ok'. A grid whose pillars are vertical cannot have twisted cells, and reporting
// "0 twisted ✓" would claim a test was passed when no test was run — which is exactly
// how a bad grid reaches a simulator with a clean bill of health.
// Run: node scripts/test-struct-qc.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'struct-qc.ts');
if (!existsSync(mod)) { console.log('SKIP — struct-qc.ts absent'); process.exit(0); }
const { structuralQc } = await import('../src/tabs/fielddev/struct-qc.ts');

const NX = 4, NY = 3, NCOL = NX * NY;
const fill = (v) => Float32Array.from({ length: NCOL }, () => v);

/** Two stacked zones, 5 layers each, sharing their middle surface exactly. */
const clean = () => ({
  packed: { nx: NX, ny: NY, nz: 10, dx: 50, dy: 50, activeCol: new Uint8Array(NCOL).fill(1) },
  zoneLayers: [
    { name: 'upper', nz: 5, k0: 0, topZ: fill(2000), baseZ: fill(2100) },
    { name: 'lower', nz: 5, k0: 5, topZ: fill(2100), baseZ: fill(2150) },
  ],
});
const find = (r, id) => r.checks.find((c) => c.id === id);

// ── a sound grid ────────────────────────────────────────────────────────────
{
  const r = structuralQc(clean());
  eq('a sound grid passes everything that ran', r.worst, 'ok');
  eq('no negative cells', find(r, 'cell.negative').count, 0);
  eq('no zero-thickness cells', find(r, 'cell.zero').count, 0);
  eq('the zones stack exactly', find(r, 'zone.stacking').verdict, 'ok');
  eq('every cell is live', r.liveCells, NCOL * 10);
  eq('…and totalCells counts the whole grid', r.totalCells, NCOL * 10);

  eq('two zones are reported', r.zones.length, 2);
  eq('the upper zone is 100 m thick', r.zones[0].meanThickM, 100);
  eq('…so one of its 5 layers is 20 m', r.zones[0].meanLayerM, 20);
  eq('the lower zone is 50 m over 5 layers', r.zones[1].meanLayerM, 10);
}

// ── the two defects that stop a simulator dead ──────────────────────────────
{
  // base ABOVE top in one column: crossing horizons that survived the build
  const g = clean();
  g.zoneLayers[0].baseZ = Float32Array.from(g.zoneLayers[0].baseZ);
  g.zoneLayers[0].baseZ[3] = 1990;                 // 10 m above its own top
  const r = structuralQc(g);
  eq('a base above its top is a FAIL, not a warning', find(r, 'cell.negative').verdict, 'fail');
  eq('…counted per CELL, not per column', find(r, 'cell.negative').count, 5);
  check('…and it names the consequence', !!find(r, 'cell.negative').consequence, '');
  eq('the whole grid is failed by it', r.worst, 'fail');
  check('a negative-volume column contributes no live cells',
    r.liveCells === NCOL * 10 - 5, `${r.liveCells}`);
}
{
  const g = clean();
  g.zoneLayers[1].baseZ = Float32Array.from(g.zoneLayers[1].baseZ);
  g.zoneLayers[1].baseZ[0] = 2100;                 // identical to its top
  const r = structuralQc(g);
  eq('an exactly degenerate cell is a FAIL — transmissibility divides by thickness',
    find(r, 'cell.zero').verdict, 'fail');
  eq('…counted per cell', find(r, 'cell.zero').count, 5);
}

// ── zone stacking: overlap and void are different findings ──────────────────
{
  const overlap = clean();
  overlap.zoneLayers[1].topZ = fill(2080);         // starts 20 m INSIDE the upper zone
  const ro = structuralQc(overlap);
  eq('an overlap fails', find(ro, 'zone.stacking').verdict, 'fail');
  check('…and the finding says overlapping', /overlapping/.test(find(ro, 'zone.stacking').finding),
    find(ro, 'zone.stacking').finding);

  const gap = clean();
  gap.zoneLayers[1].topZ = fill(2130);             // 30 m of rock no cell holds
  const rg = structuralQc(gap);
  eq('a void between zones fails too', find(rg, 'zone.stacking').verdict, 'fail');
  check('…and is reported as a GAP, not an overlap',
    /gapped/.test(find(rg, 'zone.stacking').finding), find(rg, 'zone.stacking').finding);
  check('…quoting how bad it is', /30/.test(find(rg, 'zone.stacking').finding),
    find(rg, 'zone.stacking').finding);
}

// ── stratigraphic order ─────────────────────────────────────────────────────
{
  const g = clean();
  g.zoneLayers[1].topZ = fill(1900);               // the LOWER zone starts above
  g.zoneLayers[1].baseZ = fill(1950);
  const r = structuralQc(g);
  eq('a lower zone starting above the upper one fails', find(r, 'zone.order').verdict, 'fail');
  eq('…in every column', find(r, 'zone.order').count, NCOL);
}

// ── pinch-outs and aspect ratio warn rather than fail ───────────────────────
{
  const g = clean();
  g.zoneLayers[1].baseZ = fill(2100.5);            // 0.5 m over 5 layers = 0.1 m each
  const r = structuralQc(g);
  eq('a 0.1 m layer is a pinch-out', find(r, 'cell.thin').count, NCOL * 5);
  eq('…which warns, because thin geology is real', find(r, 'cell.thin').verdict, 'warn');
  eq('50 m wide over 0.1 m thick trips the aspect check', find(r, 'cell.aspect').verdict, 'warn');
  check('a pinch-out never escalates to fail', r.worst === 'warn', r.worst);

  // the threshold is a parameter, not a constant baked into the verdict
  eq('a looser threshold accepts the same grid',
    structuralQc(g, { minThickM: 0.05, maxAspect: 1000 }).worst, 'ok');
}

// ── connectivity ────────────────────────────────────────────────────────────
{
  const g = clean();
  // two live blobs separated by a dead column stripe: columns 0-1 and 3 of each row
  const act = new Uint8Array(NCOL);
  for (let j = 0; j < NY; j++) { act[j * NX] = 1; act[j * NX + 1] = 1; act[j * NX + 3] = 1; }
  g.packed.activeCol = act;
  const r = structuralQc(g);
  eq('two separated bodies are detected', find(r, 'grid.connected').count, 2);
  eq('…and warn — an island no well can reach is volume that never produces',
    find(r, 'grid.connected').verdict, 'warn');

  eq('a single body is fine', find(structuralQc(clean()), 'grid.connected').verdict, 'ok');
}

// ── hollow columns ──────────────────────────────────────────────────────────
{
  const g = clean();
  g.zoneLayers[0].topZ = Float32Array.from(g.zoneLayers[0].topZ);
  g.zoneLayers[1].topZ = Float32Array.from(g.zoneLayers[1].topZ);
  g.zoneLayers[0].topZ[7] = NaN;                   // zone absent in this column
  g.zoneLayers[1].topZ[7] = NaN;
  g.zoneLayers[1].baseZ = Float32Array.from(g.zoneLayers[1].baseZ);
  g.zoneLayers[1].baseZ[7] = NaN;
  const r = structuralQc(g);
  eq('a column active in the mask but holding no rock is found', find(r, 'col.hollow').count, 1);
  eq('…and warns', find(r, 'col.hollow').verdict, 'warn');
  check('an absent zone is not counted as a defect — it was never examined',
    find(r, 'cell.negative').count === 0 && find(r, 'cell.zero').count === 0, '');
}

// ── THE CENTRAL ASSERTION: impossible ≠ passed ──────────────────────────────
{
  const r = structuralQc(clean());
  for (const id of ['cell.twisted', 'cell.nonplanar', 'pillar.crossing', 'fault.throw']) {
    const c = find(r, id);
    eq(`${c.label} reports n/a, NOT ok — a vertical-pillar grid cannot express it`, c.verdict, 'n/a');
    check(`…and says why rather than showing a green tick`, c.finding.length > 20, c.finding);
    eq(`…with nothing examined`, c.of, 0);
  }
  check('an inapplicable check cannot make the grid look worse either',
    r.worst === 'ok', r.worst);

  // and it must not be able to make it look BETTER: worst ignores n/a entirely
  const broken = clean();
  broken.zoneLayers[0].baseZ = fill(1990);
  eq('four n/a checks do not dilute a real failure', structuralQc(broken).worst, 'fail');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
