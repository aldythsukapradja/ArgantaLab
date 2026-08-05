// pools.ts truth-lock — separating the filled area into accumulations (S8).
//
// The assertions are about the physical claim a pool makes: two columns are in the
// same accumulation only if oil could travel between them without crossing below the
// contact. Everything else — area, crest, GRV, which wells drain it — follows.
// Run: node scripts/test-pools.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol = 1e-6) =>
  check(n, Number.isFinite(got) && Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'pools.ts');
if (!existsSync(mod)) { console.log('SKIP — pools.ts absent'); process.exit(0); }
const { findPools, poolColumnMask } = await import('../src/tabs/fielddev/pools.ts');

/** A grid whose top depth is given by a function of (i, j). */
const make = (nx, ny, topFn, baseOffset = 100) => {
  const topZ = new Float64Array(nx * ny);
  const baseZ = new Float64Array(nx * ny);
  const activeCol = new Uint8Array(nx * ny).fill(1);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const c = j * nx + i;
      topZ[c] = topFn(i, j);
      baseZ[c] = topZ[c] + baseOffset;
    }
  }
  return { nx, ny, dx: 100, dy: 100, x0: 0, y0: 0, topZ, baseZ, activeCol };
};

const OWC = 3000;

// ── TWO highs separated by a saddle BELOW the contact are TWO pools ────────────
//
// This is the whole point. A single "area above the contact" number would report
// one 12-column accumulation; physically they are two, because oil cannot cross
// the deep saddle between them.
{
  // columns 0–3 shallow, 4–5 deep (below contact), 6–9 shallow
  const g = make(10, 4, (i) => (i >= 4 && i <= 5 ? 3100 : 2900));
  const r = findPools(g, OWC);
  eq('a deep saddle splits the area into TWO accumulations', r.pools.length, 2);
  eq('every column above the contact is in one of them',
    r.pools.reduce((a, p) => a + p.columns.length, 0), 8 * 4);
  check('neither pool contains a column from the other side',
    r.pools.every((p) => {
      const is = p.columns.map((c) => c % 10);
      return Math.max(...is) < 4 || Math.min(...is) > 5;
    }), '');
}

// ── one continuous high is ONE pool ──────────────────────────────────────────
{
  const g = make(10, 4, () => 2900);
  const r = findPools(g, OWC);
  eq('a single continuous closure is one accumulation', r.pools.length, 1);
  near('its area is the whole grid', r.pools[0].areaM2, 10 * 4 * 100 * 100);
}

// ── 4-connectivity: a diagonal pinch is NOT a flow path ──────────────────────
{
  // two 2×2 blocks touching only at one corner
  const g = make(4, 4, (i, j) => {
    const inA = i < 2 && j < 2;
    const inB = i >= 2 && j >= 2;
    return inA || inB ? 2900 : 3100;
  });
  const r = findPools(g, OWC, [], 1);
  eq('corner-touching highs are TWO pools, not one', r.pools.length, 2);
}

// ── nothing above the contact is no pool, not an empty one ───────────────────
{
  const g = make(6, 6, () => 3500);
  const r = findPools(g, OWC);
  eq('a structure entirely below the contact holds nothing', r.pools.length, 0);
  eq('and no area', r.totalAreaM2, 0);
}

// ── crest, oil column and GRV ────────────────────────────────────────────────
{
  // a simple dome: crest at 2800, rim at 2950, all above the 3000 contact
  const g = make(5, 5, (i, j) => 2800 + 30 * (Math.abs(i - 2) + Math.abs(j - 2)), 500);
  const r = findPools(g, OWC, [], 1);
  eq('one dome, one pool', r.pools.length, 1);
  near('the crest is the shallowest top', r.pools[0].crestZ, 2800);
  near('the oil column at the crest is contact − crest', r.pools[0].columnM, 200);
  // GRV = Σ area × (min(base, owc) − top) over filled columns
  let want = 0;
  for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
    const t = 2800 + 30 * (Math.abs(i - 2) + Math.abs(j - 2));
    if (t >= OWC) continue;
    want += 100 * 100 * (Math.min(t + 500, OWC) - t);
  }
  near('GRV is rock between the top and the contact', r.pools[0].grvM3, want, 1e-3);
}

// ── the base can cut the fill before the contact does ────────────────────────
{
  // a thin reservoir: base only 20 m below top, so the contact is never reached
  const g = make(4, 4, () => 2900, 20);
  const r = findPools(g, OWC, [], 1);
  near('a reservoir thinner than the oil column fills to its BASE, not the contact',
    r.pools[0].grvM3, 4 * 4 * 100 * 100 * 20);
}

// ── wells: drained vs undrained ──────────────────────────────────────────────
{
  const g = make(10, 4, (i) => (i >= 4 && i <= 5 ? 3100 : 2900));
  const wells = [
    { name: 'PROD-1', x: 150, y: 150, producer: true },    // column i=1 — west pool
    { name: 'OBS-1', x: 150, y: 250, producer: false },    // also west pool
    { name: 'DRY-1', x: 750, y: 150, producer: false },    // i=7 — east pool
    { name: 'OFFGRID', x: 99999, y: 99999, producer: true },
  ];
  const r = findPools(g, OWC, wells);

  const west = r.pools.find((p) => p.wells.includes('PROD-1'));
  const east = r.pools.find((p) => p.wells.includes('DRY-1'));
  check('a well is attributed to the pool its slot falls in', !!west && !!east, '');
  check('the two wells are in DIFFERENT pools', west.id !== east.id, '');
  eq('the pool with a producer is drained', west.drained, true);
  eq('…and names its producers', west.producers, ['PROD-1']);
  eq('an observation well does not make a pool drained', east.drained, false);
  eq('…and it has no producers', east.producers, []);
  eq('one drained pool of two', r.drainedCount, 1);
  check('a well outside the grid is attributed to nothing',
    r.pools.every((p) => !p.wells.includes('OFFGRID')), '');

  // the two halves of this fixture are symmetric, so their volumes are EQUAL — the
  // behaviour to assert is that they are reported as two numbers, not that they
  // happen to differ
  check('drained and undrained GRV are both reported',
    r.drainedGrvM3 > 0 && r.undrainedGrvM3 > 0,
    `drained ${(r.drainedGrvM3 / 1e6).toFixed(1)} Mm³ · undrained ${(r.undrainedGrvM3 / 1e6).toFixed(1)} Mm³`);
  near('…and together they account for every pool, with nothing lost or double-counted',
    r.drainedGrvM3 + r.undrainedGrvM3, r.pools.reduce((a, p) => a + p.grvM3, 0), 1e-6);
  check('the drained volume is only the pool the producer is in',
    Math.abs(r.drainedGrvM3 - west.grvM3) < 1e-6,
    `${(r.drainedGrvM3 / 1e6).toFixed(1)} Mm³ = the west pool alone`);
}

// ── the noise floor: a one-column high is not a field ────────────────────────
{
  // one isolated shallow column in an otherwise deep map
  const g = make(8, 8, (i, j) => (i === 3 && j === 3 ? 2900 : 3200));
  const big = findPools(g, OWC, [], 1);
  eq('with no floor it counts as a pool', big.pools.length, 1);
  const filtered = findPools(g, OWC, [], 4);
  eq('with a 4-column floor it does not', filtered.pools.length, 0);
  eq('but it is COUNTED, not silently dropped', filtered.tinyCount, 1);
}

// ── pools are ranked by volume — the field first, then what the map also closes ─
{
  const g = make(12, 4, (i) => {
    if (i <= 5) return 2800;          // big, deep column
    if (i === 6) return 3100;         // saddle
    return 2980;                      // small, shallow column
  });
  const r = findPools(g, OWC, [], 1);
  eq('two pools', r.pools.length, 2);
  check('the largest by GRV is first', r.pools[0].grvM3 >= r.pools[1].grvM3,
    `${(r.pools[0].grvM3 / 1e6).toFixed(1)} ≥ ${(r.pools[1].grvM3 / 1e6).toFixed(1)} Mm³`);
}

// ── the column mask, for volumes restricted to chosen pools ──────────────────
{
  const g = make(10, 4, (i) => (i >= 4 && i <= 5 ? 3100 : 2900));
  const r = findPools(g, OWC);
  const mask = poolColumnMask(r, [r.pools[0].id], 40);
  const onCount = [...mask].filter((v) => v === 1).length;
  eq('the mask covers exactly that pool’s columns', onCount, r.pools[0].columns.length);
  const both = poolColumnMask(r, r.pools.map((p) => p.id), 40);
  eq('and every pool together covers the whole filled area',
    [...both].filter((v) => v === 1).length, r.pools.reduce((a, p) => a + p.columns.length, 0));
  eq('an unknown id contributes nothing', [...poolColumnMask(r, [999], 40)].filter((v) => v).length, 0);
}

// ── inactive columns are not part of any accumulation ────────────────────────
{
  const g = make(6, 4, () => 2900);
  g.activeCol[0] = 0; g.activeCol[1] = 0;
  const r = findPools(g, OWC, [], 1);
  eq('a column outside the model holds no oil',
    r.pools.reduce((a, p) => a + p.columns.length, 0), 6 * 4 - 2);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
