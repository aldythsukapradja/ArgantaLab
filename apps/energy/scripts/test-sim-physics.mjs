// sim physics truth-lock — is the waterflood actually behaving like a waterflood?
//
// The plots and the 3D animation are only worth looking at if the underlying flood is
// physical. Every assertion here is a statement about the PHYSICS, not the plumbing:
//
//   1. water enters at the injector and leaves at the producer, not the reverse;
//   2. saturation stays inside the mobile range [Swc, 1-Sor] everywhere, always —
//      a cell outside it is a numerical failure wearing a plausible colour;
//   3. the front ADVANCES: the swept region grows monotonically and moves toward the
//      producer, so an animation of it shows movement rather than flicker;
//   4. material balance closes — for an incompressible flood, what goes in comes out;
//   5. breakthrough happens BEFORE water cut rises, and not at t=0.
// Run: node scripts/test-sim-physics.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
const near = (n, got, want, tol) => check(n, Math.abs(got - want) <= tol, `got ${got}, want ${want} ±${tol}`);

if (!existsSync(join(__dirname, '..', 'src', 'tabs', 'fielddev', 'sim-run.ts'))) { console.log('SKIP'); process.exit(0); }
const { columnAverages, runCase } = await import('../src/tabs/fielddev/sim-run.ts');
const { simulateFV } = await import('../src/engine/sim/fv.ts');
const { buildFrames, swFrame, sweepFrame, writeFrame } = await import('../src/tabs/fielddev/sim-frames.ts');

// A clean quarter-five-spot: injector at one corner, producer at the far one. This is
// the textbook case, and if the flood does not behave here it will not behave anywhere.
const nx = 24, ny = 24, nz = 4, nCol = nx * ny;
const activeCol = new Uint8Array(nCol).fill(1);
const topZ = new Float64Array(nCol).fill(2500);
const baseZ = new Float64Array(nCol).fill(2540);
const G = { nx, ny, nz, dx: 50, dy: 50, x0: 0, y0: 0, activeCol, topZ, baseZ };
const F = {
  swc: 0.20, sor: 0.25, krwMax: 0.35, kroMax: 0.9, nw: 3, no: 2,
  muw: 0.4, muo: 2.0, bo: 1.25, bw: 1.02, swInit: 0.20, pInit: 250,
};
// Sized to run PAST breakthrough. At 600 rm3/d for 4000 days this quarter five-spot
// only reaches 0.17 pore volumes injected — the front is still short of the producer,
// so there is no breakthrough to assert on. A waterflood test that stops before
// breakthrough checks the easy half of the physics.
const INJ_RATE = 3000;
const T_END = 7000;

const cols = columnAverages(G, () => ({ phi: 0.24, perm: 200, sw: F.swc }));
const out = runCase(G, cols, F, [
  { name: 'INJ', x: 25, y: 25, kind: 'injector', rate: INJ_RATE },
  { name: 'PROD', x: nx * 50 - 25, y: ny * 50 - 25, kind: 'producer', bhp: 180 },
], { tEnd: T_END, nReports: 40 }, simulateFV);

const snaps = out.result.snapshots;
const f = out.series.field;
const iInj = 0, iProd = nCol - 1;
console.log(`run: ${snaps.length} steps · PVI ${f[f.length - 1].pvi.toFixed(3)} · RF ${(f[f.length - 1].rf * 100).toFixed(1)}%`);

// ── 1 · saturation stays inside the mobile range ────────────────────────────
{
  let below = 0, above = 0, worstLo = 1, worstHi = 0;
  for (const s of snaps) for (let c = 0; c < nCol; c++) {
    const v = s.sw[c];
    if (!Number.isFinite(v)) continue;
    if (v < worstLo) worstLo = v;
    if (v > worstHi) worstHi = v;
    if (v < F.swc - 1e-6) below++;
    if (v > 1 - F.sor + 1e-6) above++;
  }
  check('no cell ever falls below connate water', below === 0, `${below} cells, min ${worstLo.toFixed(4)} vs Swc ${F.swc}`);
  check('no cell ever exceeds 1 − residual oil', above === 0, `${above} cells, max ${worstHi.toFixed(4)} vs ${1 - F.sor}`);
  check('some cell actually reached the flooded end', worstHi > 1 - F.sor - 0.02, `max ${worstHi.toFixed(4)}`);
}

// ── 2 · water goes IN at the injector and OUT at the producer ───────────────
{
  const first = snaps[0], last = snaps[snaps.length - 1];
  check('the injector cell floods', last.sw[iInj] > first.sw[iInj] + 0.1,
    `${first.sw[iInj].toFixed(3)} → ${last.sw[iInj].toFixed(3)}`);
  check('the injector ends near residual oil — it is the most swept cell there is',
    last.sw[iInj] > 1 - F.sor - 0.05, `${last.sw[iInj].toFixed(4)}`);

  // the pressure has to fall from injector to producer, or nothing is being pushed
  const mid = snaps[Math.floor(snaps.length / 2)];
  check('pressure is higher at the injector than at the producer',
    mid.p[iInj] > mid.p[iProd], `${mid.p[iInj].toFixed(1)} vs ${mid.p[iProd].toFixed(1)} bar`);
}

// ── 3 · the front ADVANCES, monotonically ───────────────────────────────────
{
  // how far the flood has reached, as the largest distance from the injector at which
  // a cell has been measurably displaced
  const reach = (s) => {
    let r = 0;
    for (let c = 0; c < nCol; c++) {
      if (s.sw[c] <= F.swc + 0.02) continue;
      const i = c % nx, j = (c - (c % nx)) / nx;
      const d = Math.hypot(i, j);
      if (d > r) r = d;
    }
    return r;
  };
  const reaches = snaps.map(reach);
  let backwards = 0;
  for (let i = 1; i < reaches.length; i++) if (reaches[i] < reaches[i - 1] - 1e-9) backwards++;
  check('the flood front never retreats', backwards === 0, `${backwards} steps went backwards`);
  check('…and it does advance', reaches[reaches.length - 1] > reaches[1] + 2,
    `${reaches[1].toFixed(1)} → ${reaches[reaches.length - 1].toFixed(1)} cells`);

  // swept PORE VOLUME grows monotonically — an animation of a shrinking flood is a
  // solver that is losing water
  const swept = snaps.map((s) => {
    let v = 0;
    for (let c = 0; c < nCol; c++) if (s.sw[c] > F.swc + 0.02) v++;
    return v;
  });
  let shrank = 0;
  for (let i = 1; i < swept.length; i++) if (swept[i] < swept[i - 1]) shrank++;
  check('the swept region never shrinks', shrank === 0, `${shrank} steps shrank`);
  check('…and most of the field is eventually contacted',
    swept[swept.length - 1] > nCol * 0.4, `${swept[swept.length - 1]}/${nCol} cells`);
}

// ── 4 · material balance: what goes in comes out ────────────────────────────
{
  const last = f[f.length - 1];
  // reservoir volumes: injected = produced (oil + water), for an incompressible flood
  const injRes = last.cumInj * F.bw;
  const prodRes = last.cumOil * F.bo + last.cumWater * F.bw;
  near('injected reservoir volume equals produced reservoir volume',
    prodRes / injRes, 1, 0.02);

  // and the oil produced cannot exceed the movable oil in place
  const movableFrac = (1 - F.sor - F.swc) / (1 - F.swc);
  check('recovery never exceeds the movable fraction',
    last.rf <= movableFrac + 1e-6, `RF ${(last.rf * 100).toFixed(1)}% vs movable ${(movableFrac * 100).toFixed(1)}%`);
  check('…and it is a serious flood, not a trickle', last.rf > 0.15, `RF ${(last.rf * 100).toFixed(1)}%`);
}

// ── 5 · breakthrough behaves ────────────────────────────────────────────────
{
  check('water cut starts at zero — no water is produced before the front arrives',
    f[0].watercut < 1e-6 && f[1].watercut < 1e-6, `${f[0].watercut}, ${f[1].watercut}`);
  const btIx = f.findIndex((s) => s.watercut > 0.01);
  check('breakthrough happens, and not immediately', btIx > 1,
    `first watercut > 1% at step ${btIx} (final PVI ${f[f.length - 1].pvi.toFixed(3)})`);
  const bt = f[btIx] ?? f[f.length - 1];
  check('…after a physically sensible fraction of a pore volume',
    bt.pvi > 0.05 && bt.pvi < 0.9, `PVI at breakthrough ${bt.pvi.toFixed(3)}`);

  // once water breaks through, cut rises and oil rate falls
  const after = f.slice(btIx);
  const cutRose = after[after.length - 1].watercut > after[0].watercut;
  check('water cut rises after breakthrough', cutRose,
    `${after[0].watercut.toFixed(3)} → ${after[after.length - 1].watercut.toFixed(3)}`);
  check('oil rate at the end is below its peak — the flood declines',
    after[after.length - 1].oilRate < Math.max(...f.map((s) => s.oilRate)) * 0.95, '');
}

// ── 6 · the frames the 3D view draws are the frames the solver produced ─────
{
  const frames = buildFrames(G, out.result, F.sor);
  check('one frame per report step', frames.sw.length === snaps.length, `${frames.sw.length} vs ${snaps.length}`);
  check('a frame covers the whole layered grid', frames.sw[0].length === nCol * nz, `${frames.sw[0].length}`);

  // the broadcast must be exactly that — every layer identical, no invented profile
  const mid = frames.sw[Math.floor(frames.sw.length / 2)];
  let differs = 0;
  for (let c = 0; c < nCol; c++) for (let l = 1; l < nz; l++) {
    if (Math.abs(mid[l * nCol + c] - mid[c]) > 1e-12) differs++;
  }
  check('every layer of a column carries the SAME saturation — no vertical profile is invented',
    differs === 0, `${differs} cells differ between layers`);

  // and it is the solver's own field, unaltered
  const src = snaps[Math.floor(snaps.length / 2)].sw;
  let mismatched = 0;
  for (let c = 0; c < nCol; c++) if (Math.abs(mid[c] - src[c]) > 1e-12) mismatched++;
  check('the frame is the solver\'s field, not a smoothed copy of it', mismatched === 0, `${mismatched}`);

  // the colour range is SHARED across the run, or the animation churns instead of moving
  check('one colour range spans every frame',
    frames.swRange.hi > frames.swRange.lo, JSON.stringify(frames.swRange));

  // sweep: untouched at t=0, growing after
  const sweep0 = frames.sweep[0], sweepN = frames.sweep[frames.sweep.length - 1];
  let s0 = 0, sN = 0;
  for (let c = 0; c < nCol; c++) {
    if (Number.isFinite(sweep0[c]) && sweep0[c] > 0.01) s0++;
    if (Number.isFinite(sweepN[c]) && sweepN[c] > 0.01) sN++;
  }
  check('nothing is swept at time zero', s0 === 0, `${s0} cells`);
  check('…and a lot is by the end', sN > nCol * 0.4, `${sN}/${nCol}`);
  let outOfRange = 0;
  for (const fr of frames.sweep) for (let i = 0; i < fr.length; i++) {
    const v = fr[i];
    if (Number.isFinite(v) && (v < -1e-9 || v > 1 + 1e-9)) outOfRange++;
  }
  check('sweep efficiency stays a fraction', outOfRange === 0, `${outOfRange} cells out of [0,1]`);
}

// ── 7 · an inactive column is not painted as flooded ────────────────────────
{
  const holed = { ...G, activeCol: new Uint8Array(nCol).fill(1) };
  holed.activeCol[5 * nx + 5] = 0;
  const fr = swFrame(holed, snaps[snaps.length - 1].sw);
  check('an inactive column reads NaN in the frame', Number.isNaN(fr[5 * nx + 5]), `${fr[5 * nx + 5]}`);

  // and when quantised, it must pin to WATER, not to the most oil-bearing colour
  const prop = { data: new Uint16Array(nCol * nz), dtype: 'u16', min: F.swc, max: 1 - F.sor };
  const rep = writeFrame(prop, fr);
  check('the missing cells are counted', rep.missing === nz, `${rep.missing}`);
  check('…and pinned to the WATER end, never to the oil end',
    prop.data[5 * nx + 5] === 65535, `${prop.data[5 * nx + 5]}`);

  // a column with no movable oil cannot be "fully swept"
  const noOil = new Float64Array(nCol).fill(1 - F.sor);
  const sw2 = sweepFrame(G, snaps[snaps.length - 1].sw, noOil, F.sor);
  check('a column that started at residual oil reports NO sweep, not perfect sweep',
    Number.isNaN(sw2[0]), `${sw2[0]}`);
}

// -- 8 . the inlined Peaceman formulas must match the engine's own ----------
//
// sim-run inlines peacemanR0 and wellIndex because a value import from
// engine/sim/pressure will not resolve in plain node. Two copies of a formula drift;
// this is what stops them.
{
  const eng = await import('../src/engine/sim/pressure.ts');
  const mine = await import('../src/tabs/fielddev/sim-run.ts');
  let r0Bad = 0, wiBad = 0;
  for (const [dx, dy] of [[50, 50], [100, 75], [12.5, 200]]) {
    if (Math.abs(eng.peacemanR0(dx, dy) - mine.peacemanR0(dx, dy)) > 1e-12) r0Bad++;
    for (const [k, h, rw, skin] of [[200, 40, 0.1, 0], [15, 8, 0.15, 2], [1e-6, 1, 0.1, -1]]) {
      const r0 = eng.peacemanR0(dx, dy);
      if (Math.abs(eng.wellIndex(k, h, r0, rw, skin) - mine.wellIndex(k, h, r0, rw, skin)) > 1e-9) wiBad++;
    }
  }
  check('the inlined Peaceman radius matches the engine exactly', r0Bad === 0, r0Bad + ' mismatches');
  check('the inlined well index matches the engine exactly', wiBad === 0, wiBad + ' mismatches');
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
