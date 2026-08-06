// zone-repair.ts truth-lock.
//
// Two assertions carry the module: the repair must NEVER move the top (the top is the
// constrained surface and it defines the trap), and it must never touch a column that
// was already sound. Everything else is bookkeeping about volume that was invented,
// which has to be reported or the STOIIP quietly inherits it.
// Run: node scripts/test-zone-repair.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const eq = (n, got, want) => check(n, Object.is(got, want) || JSON.stringify(got) === JSON.stringify(want), `got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`);
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

const mod = join(__dirname, '..', 'src', 'tabs', 'fielddev', 'zone-repair.ts');
if (!existsSync(mod)) { console.log('SKIP — zone-repair.ts absent'); process.exit(0); }
const { repairZones, reweldStack } = await import('../src/tabs/fielddev/zone-repair.ts');

const NX = 6, NY = 6, NCOL = NX * NY, AREA = 2500;
const active = new Uint8Array(NCOL).fill(1);
const F = (v) => Float32Array.from({ length: NCOL }, () => v);

/** A 20 m-thick zone with one inverted column at index 14 (i=2, j=2). */
const zone = (bad = [14], badBase = 1995) => ({
  name: 'hugin', nz: 10, k0: 0,
  topZ: F(2000),
  baseZ: (() => { const b = F(2020); for (const c of bad) b[c] = badBase; return b; })(),
});

// ── the top never moves ─────────────────────────────────────────────────────
{
  const z = zone();
  const topBefore = Array.from(z.topZ);
  repairZones([z], NX, NY, active, { zones: ['hugin'], cellAreaM2: AREA });
  eq('THE TOP IS NEVER MOVED — it is the constrained surface and it defines the trap',
    Array.from(z.topZ), topBefore);
}

// ── sound columns are untouched, bad ones are rebuilt ───────────────────────
{
  const z = zone();
  const baseBefore = Array.from(z.baseZ);
  const r = repairZones([z], NX, NY, active, { zones: ['hugin'], cellAreaM2: AREA });
  const rep = r.zones[0];

  eq('one column was repaired', rep.repaired, 1);
  eq('the other 35 were already sound', rep.sound, NCOL - 1);
  eq('nothing was absent', rep.absent, 0);
  near('the worst inversion is reported as it was FOUND, not after the fix', rep.worstInversionM, -5, 1e-6);

  let changed = 0;
  for (let c = 0; c < NCOL; c++) if (z.baseZ[c] !== baseBefore[c]) changed++;
  eq('exactly one base value changed — a sound column is never rewritten', changed, 1);

  check('the repaired base now lies BELOW its top', z.baseZ[14] > z.topZ[14], `${z.baseZ[14]}`);
  near('and it inherits the surrounding 20 m isochore, not a minimum-thickness floor',
    z.baseZ[14] - z.topZ[14], 20, 0.001);
  eq('so it did not have to fall back to the floor', rep.flooredToMin, 0);
}

// ── the volume invented is reported ─────────────────────────────────────────
{
  const z = zone();
  const r = repairZones([z], NX, NY, active, { zones: ['hugin'], cellAreaM2: AREA });
  const rep = r.zones[0];
  // the column was 5 m INVERTED, so it held zero rock; it now holds 20 m
  near('the added bulk volume is the full inserted thickness', rep.addedBulkM3, 20 * AREA, 1);
  near('mean inserted thickness', rep.meanInsertedM, 20, 0.001);
  check('the report states the repair as a FRACTION of the zone — the number that belongs beside any STOIIP',
    r.addedFraction > 0 && r.addedFraction < 0.05, `${r.addedFraction}`);
  eq('and the total is the sum over zones', r.totalRepaired, 1);
}

// ── the isochore trend is followed, not flattened ───────────────────────────
//
// A zone that thickens west to east must have its repaired column inherit the LOCAL
// thickness. Clamping to one minimum would stamp a flat plateau across the defect.
{
  const z = { name: 'hugin', nz: 10, k0: 0, topZ: F(2000), baseZ: F(2020) };
  for (let c = 0; c < NCOL; c++) { const i = c % NX; z.baseZ[c] = 2000 + 10 + i * 10; }
  const wantThk = z.baseZ[14] - z.topZ[14];      // i=2 → 30 m
  z.baseZ[14] = 1990;                            // break it
  repairZones([z], NX, NY, active, { zones: ['hugin'], cellAreaM2: AREA });
  const got = z.baseZ[14] - z.topZ[14];
  near('a repaired column inherits its NEIGHBOURS’ thickness, not a global constant', got, wantThk, 3);
  check('…which is materially thicker than a minimum-thickness clamp would give', got > 20, `${got}`);
}

// ── a defect with no sound neighbour anywhere falls back, and says so ───────
{
  const all = [...Array(NCOL).keys()];
  const z = zone(all, 1990);                     // every column inverted
  const r = repairZones([z], NX, NY, active, { zones: ['hugin'], cellAreaM2: AREA, minThickM: 0.5 });
  eq('every column is repaired', r.zones[0].repaired, NCOL);
  check('and each is COUNTED as having fallen back rather than silently floored',
    r.zones[0].flooredToMin === NCOL, `${r.zones[0].flooredToMin}`);
  check('the result still has positive thickness everywhere',
    [...Array(NCOL).keys()].every((c) => z.baseZ[c] - z.topZ[c] >= 0.5), '');
}

// ── zones not named are left completely alone ──────────────────────────────
{
  const hugin = zone();
  const heather = zone();
  heather.name = 'heather';
  const before = Array.from(heather.baseZ);
  repairZones([hugin, heather], NX, NY, active, { zones: ['hugin'], cellAreaM2: AREA });
  eq('an unnamed zone is not repaired — the overburden is left as surveyed',
    Array.from(heather.baseZ), before);
  check('and the repaired one WAS changed', hugin.baseZ[14] > hugin.topZ[14], '');
}

// ── inactive columns are skipped ───────────────────────────────────────────
{
  const z = zone();
  const act = new Uint8Array(NCOL).fill(1); act[14] = 0;
  const r = repairZones([z], NX, NY, act, { zones: ['hugin'], cellAreaM2: AREA });
  eq('a defect in an INACTIVE column is not a defect', r.zones[0].repaired, 0);
  eq('…it is counted as absent', r.zones[0].absent, 1);
  eq('and its base is untouched', z.baseZ[14], 1995);
}

// ── a NaN column is absent, not broken ─────────────────────────────────────
{
  const z = zone();
  z.topZ = Float32Array.from(z.topZ); z.topZ[7] = NaN;
  const r = repairZones([z], NX, NY, active, { zones: ['hugin'], cellAreaM2: AREA });
  eq('a column where the zone does not exist is absent, not repaired', r.zones[0].absent, 1);
  eq('…and the real defect is still fixed', r.zones[0].repaired, 1);
}

// ── reweldStack: a deepened base drags the zone beneath it down ─────────────
{
  const upper = { name: 'u', nz: 5, k0: 0, topZ: F(2000), baseZ: F(2100) };
  const lower = { name: 'l', nz: 5, k0: 5, topZ: F(2100), baseZ: F(2150) };
  upper.baseZ[3] = 2130;                          // repaired 30 m deeper

  const moved = reweldStack([upper, lower], NCOL, active);
  eq('one column had to be rewelded', moved, 1);
  eq('the lower zone now starts where the upper one ends', lower.topZ[3], 2130);
  eq('…and keeps its own thickness — it is carried down, not squashed', lower.baseZ[3], 2180);
  eq('every other column is untouched', lower.topZ[0], 2100);

  eq('a welded stack needs no work', reweldStack([
    { name: 'u', nz: 5, k0: 0, topZ: F(2000), baseZ: F(2100) },
    { name: 'l', nz: 5, k0: 5, topZ: F(2100), baseZ: F(2150) },
  ], NCOL, active), 0);
}
{
  // the reverse case must NOT move anything: a base ABOVE the lower top is a gap, and
  // closing it by raising the lower zone would delete rock rather than weld it
  const upper = { name: 'u', nz: 5, k0: 0, topZ: F(2000), baseZ: F(2080) };
  const lower = { name: 'l', nz: 5, k0: 5, topZ: F(2100), baseZ: F(2150) };
  eq('a gap is left for the QC to report, not silently closed',
    reweldStack([upper, lower], NCOL, active), 0);
}

// == cleanSurface - one horizon, or two sharing a file? =====================
{
  const { cleanSurface } = await import('../src/tabs/fielddev/zone-repair.ts');

  // a real surface with a few wild nodes: the outliers go, the surface stays
  const good = [];
  for (let n = 0; n < 400; n++) good.push(2800 + Math.sin(n / 9) * 30);
  good[7] = 9999; good[100] = -500; good[321] = 12000;
  const r = cleanSurface(good);
  eq('three wild nodes are rejected', r.rejected, 3);
  eq('everything else is kept', r.kept, good.length - 3);
  check('the surface is usable', !r.unusable, '');
  check('and it is NOT called bimodal - three points are not a population', !r.bimodal, '');
  check('the input is never mutated', good[7] === 9999, '');
  check('rejected nodes become NaN, not an invented depth', Number.isNaN(r.values[7]), '');

  // THE VOLVE SEABED: two coherent populations, and the CONTAMINANT is the majority
  const two = [];
  for (let n = 0; n < 1400; n++) two.push(1295 + Math.sin(n / 11) * 40);   // the impostor
  for (let n = 0; n < 350; n++) two.push(94 + Math.sin(n / 5) * 6);        // the real seabed
  const b = cleanSurface(two);
  check('two populations are detected as BIMODAL', b.bimodal, '');
  check('and the other mode is reported so it can be identified',
    Math.abs(b.otherModeM - 94) < 12, `${b.otherModeM}`);
  check('a bimodal grid is UNUSABLE even though the clean "succeeded"', b.unusable, '');
  check('...which is the point: the clean kept the MAJORITY, and here that is the impostor',
    b.loM > 1000, `kept window ${b.loM.toFixed(0)}..${b.hiM.toFixed(0)}`);

  // nulls are not values
  const withNulls = [null, undefined, NaN, ...good];
  const n2 = cleanSurface(withNulls);
  eq('nulls are counted separately, not rejected', n2.nullBefore, 3);
  eq('and do not change what is kept', n2.kept, r.kept);

  // too little data to characterise anything
  const tiny = cleanSurface([2800, 2810, 2805]);
  check('a handful of nodes cannot be cleaned and says so', tiny.unusable, '');

  // a spike of identical values would give MAD = 0; the IQR fallback must save it
  const flat = new Array(500).fill(2800);
  flat[3] = 4000;
  const f2 = cleanSurface(flat);
  check('a zero-MAD surface does not reject everything that is not the median',
    f2.kept >= 499, `kept ${f2.kept}`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
