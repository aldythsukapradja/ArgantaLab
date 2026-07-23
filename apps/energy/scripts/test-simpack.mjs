// G4 SIMPACK truth-lock. Runs a real FV waterflood (engine/sim/fv.ts), packs the
// saturation frame sequence via engine/pack-sim.ts, and asserts the delta round-trip:
// every frame dequantises back to Sw within Uint8 tolerance; delta-encoding shrinks the
// payload; mass (mean Sw) is preserved. Run: node scripts/test-simpack.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
if (!existsSync(join(__dirname, '..', 'src', 'engine', 'pack-sim.ts'))) { console.log('SKIP'); process.exit(0); }

const { simulateFV } = await import('../src/engine/sim/fv.ts');
const { packSimFrames, dequantFrame, quantFrame } = await import('../src/engine/pack-sim.ts');

// ── a small five-spot-ish waterflood: injector left, producer right ──
const nx = 40, ny = 30, ncell = nx * ny;
const dx = 25, dy = 25, dz = 20, phiVal = 0.22;
const phi = new Float64Array(ncell).fill(phiVal), k = new Float64Array(ncell).fill(200);
const corey = { swc: 0.15, sor: 0.2, krwMax: 0.4, kroMax: 0.9, nw: 2, no: 2 };
const poreVol = ncell * phiVal * dx * dy * dz;   // total PV; inject ~1 PVI / time unit
const res = simulateFV(
  { nx, ny, dx, dy, dz, phi, k, corey, muw: 0.5, muo: 3,
    wells: [{ i: 1, j: 15, mode: 'rate', rate: poreVol }, { i: nx - 2, j: 15, mode: 'bhp', bhp: 0 }] },
  { tEnd: 1.5, nReports: 40, timestepping: 'implicit' },
);
const frames = res.snapshots.map((s) => s.sw);
check('sim produced frames', frames.length > 5, `${frames.length} frames · ${ncell} cells`);

const packed = packSimFrames(frames, { nx, ny, dt: 3 / frames.length });
const tol = ((packed.max - packed.min) / 255) * 1.01;

// every frame round-trips within one quantum
let maxErr = 0, worstT = 0;
for (let t = 0; t < packed.nt; t++) {
  const dq = dequantFrame(packed, t);
  for (let c = 0; c < ncell; c++) { const e = Math.abs(dq[c] - frames[t][c]); if (e > maxErr) { maxErr = e; worstT = t; } }
}
check('every frame dequantises within Uint8 quantum', maxErr <= tol, `maxErr=${maxErr.toExponential(2)} @f${worstT} quantum=${tol.toExponential(2)}`);

// mean Sw (mass proxy) preserved per frame
let meanErr = 0;
for (let t = 0; t < packed.nt; t++) {
  const dq = dequantFrame(packed, t); let a = 0, b = 0;
  for (let c = 0; c < ncell; c++) { a += dq[c]; b += frames[t][c]; }
  meanErr = Math.max(meanErr, Math.abs(a - b) / ncell);
}
check('mean-Sw preserved (<quantum)', meanErr <= tol, `maxMeanErr=${meanErr.toExponential(2)}`);

// ── synthetic moving front — directly exercise the delta encode/decode machinery ──
const NT = 30, mn = 0.15, mx = 0.85;
const synth = [];
for (let t = 0; t < NT; t++) {
  const f = new Float64Array(ncell); const frontX = (t / (NT - 1)) * nx; // sweep left→right
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) f[j * nx + i] = i < frontX ? mx : mn;
  synth.push(f);
}
const sp = packSimFrames(synth, { nx, ny, dt: 1, min: mn, max: mx });
// O(1) frame access + exact reconstruction of every synthetic frame
let synMax = 0; for (let t = 0; t < NT; t++) { const dq = dequantFrame(sp, t); for (let c = 0; c < ncell; c++) synMax = Math.max(synMax, Math.abs(dq[c] - synth[t][c])); }
check('synthetic front: every frame reconstructs exactly', synMax < 1e-6, `maxErr=${synMax.toExponential(2)}`);
let m0 = 0, m1 = 0; { const a = dequantFrame(sp, 0), b = dequantFrame(sp, NT - 1); for (let c = 0; c < ncell; c++) { m0 += a[c]; m1 += b[c]; } }
check('synthetic front advanced (front sweeps the field)', m1 > m0 + ncell * 0.3, `ΣSw ${(m0 / ncell).toFixed(3)}→${(m1 / ncell).toFixed(3)}`);
// lightweight on the wire: Float64 frames → gzipped Uint8 payload
const { gzipSync } = await import('fflate');
const rawFloat = packed.nt * ncell * 8;                         // Float64 per cell per frame
const gz = gzipSync(new Uint8Array(packed.data.buffer, packed.data.byteOffset, packed.data.byteLength)).length;
check('gzipped Uint8 payload « raw Float64 frames', gz < rawFloat * 0.2, `gz=${(gz / 1024).toFixed(1)} KB vs float=${(rawFloat / 1024).toFixed(0)} KB (${(rawFloat / gz).toFixed(0)}×) · ${frames.length}f`);
check('O(1) frame view (no copy)', quantFrame(sp, 1).buffer === sp.data.buffer, 'quantFrame returns a subarray view');

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
