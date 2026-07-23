// G2 PACK3D truth-lock. Builds a real GridModel (grid3d.buildGrid + filled props),
// packs it via engine/pack3d.ts, and asserts the round-trip: HCPV matches gridHcpv to
// Uint16 tolerance, reconstructed bulk matches cell bulk, and dequantised props match.
// Run: node scripts/test-pack3d.mjs   (exits nonzero on any failure)
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const rel = (a, b) => (b === 0 ? Math.abs(a) : Math.abs(a - b) / Math.abs(b));
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); ok ? pass++ : fail++; }

if (!existsSync(join(__dirname, '..', 'src', 'engine', 'pack3d.ts'))) {
  console.log('SKIP — src/engine/pack3d.ts not present'); process.exit(0);
}
const { buildGrid, gridHcpv } = await import('../src/engine/grid3d.ts');
const { packGrid3D, hcpvFromPacked, dequantProp, reconstructBulk } = await import('../src/engine/pack3d.ts');

// ── build a synthetic but realistic GridModel: a gentle dome, a few dead columns ──
const nx = 24, ny = 18, nz = 10, dx = 50, dy = 50, x0 = 435000, y0 = 6477000;
const topZ = new Float64Array(nx * ny), baseZ = new Float64Array(nx * ny);
for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
  const col = k * nx + i;
  const r2 = (i - nx / 2) ** 2 + (k - ny / 2) ** 2;
  const crest = 2700 + r2 * 0.9;             // dome: crest shallow, flanks deep
  // punch a few inactive columns (corner) to exercise the mask
  if (i < 2 && k < 2) { topZ[col] = NaN; baseZ[col] = NaN; continue; }
  topZ[col] = crest; baseZ[col] = crest + 60 + (i % 5) * 4;   // 60–76 m gross
}
const g = buildGrid({ nx, ny, nz, dx, dy, x0, y0, topZ, baseZ });
// fill properties with smooth, physical fields
for (let l = 0; l < nz; l++) for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
  const c = (l * ny + k) * nx + i;
  if (!g.active[c]) continue;
  const phi = 0.12 + 0.16 * Math.exp(-((i - nx / 2) ** 2 + (k - ny / 2) ** 2) / 60) - 0.004 * l; // 0.12–0.28
  g.phi[c] = Math.max(0.05, Math.min(0.32, phi));
  g.ntg[c] = 0.6 + 0.35 * ((i + k + l) % 7) / 7;   // 0.6–0.95
  g.sw[c] = 0.15 + 0.5 * (l / nz);                 // increases downward (toward OWC)
  g.facies[c] = g.ntg[c] > 0.8 ? 1 : 0;
  g.perm[c] = 10 + 900 * g.phi[c];
}

// ── pack + round-trip ──────────────────────────────────────────────────────────
const packed = packGrid3D(g);
const hRef = gridHcpv(g);
const hPack = hcpvFromPacked(packed);
check('HCPV round-trip within Uint16 tolerance (<0.1%)', rel(hPack, hRef) < 1e-3, `ref=${hRef.toFixed(1)} packed=${hPack.toFixed(1)} rel=${rel(hPack, hRef).toExponential(2)}`);
check('HCPV is non-zero', hRef > 0 && hPack > 0, `${hRef.toFixed(0)}`);

// bulk reconstruction vs model.cellBulk (active cells)
const bulk = reconstructBulk(packed);
let maxBulkErr = 0;
for (let c = 0; c < bulk.length; c++) if (g.active[c]) maxBulkErr = Math.max(maxBulkErr, rel(bulk[c], g.cellBulk[c]));
check('reconstructed bulk matches cellBulk (<1e-4)', maxBulkErr < 1e-4, `maxRel=${maxBulkErr.toExponential(2)}`);

// prop dequant vs source (active cells)
for (const name of ['phi', 'sw', 'ntg', 'perm']) {
  const dq = dequantProp(packed, name);
  let maxErr = 0;
  for (let c = 0; c < dq.length; c++) if (g.active[c] && Number.isFinite(dq[c])) maxErr = Math.max(maxErr, Math.abs(dq[c] - g[name][c]));
  const prop = packed.props.find((p) => p.name === name);
  const tol = ((prop.max - prop.min) / (prop.dtype === 'u8' ? 255 : 65535)) * 1.01;
  check(`dequant ${name} within quantum (${prop.dtype})`, maxErr <= tol, `maxErr=${maxErr.toExponential(2)} quantum=${tol.toExponential(2)}`);
}

// facies is categorical → exact 0/1
const fdq = dequantProp(packed, 'facies');
let faciesOk = true;
for (let c = 0; c < fdq.length; c++) if (g.active[c] && fdq[c] !== g.facies[c]) faciesOk = false;
check('facies categorical exact', faciesOk);

// mask: inactive columns → activeCol 0 + dequant NaN
const phiDq = dequantProp(packed, 'phi');
let maskOk = packed.activeCol[0] === 0 && Number.isNaN(phiDq[0]);
check('inactive column masked (activeCol=0, prop=NaN)', maskOk);

// geometry-only payload is small: props dominate, surfaces are O(ncol)
check('payload bytes reported', packed.bytes > 0, `${(packed.bytes / 1024).toFixed(1)} KB for ${nx}·${ny}·${nz}=${nx * ny * nz} cells`);

// LOD stride packs without error and coarsens the grid
const lod = packGrid3D(g, { stride: 2 });
check('stride=2 LOD coarsens areal grid', lod.nx === Math.ceil(nx / 2) && lod.ny === Math.ceil(ny / 2) && lod.nz === nz, `${lod.nx}·${lod.ny}·${lod.nz}`);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
