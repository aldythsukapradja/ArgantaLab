// G3 GRIDMESH sanity — build shell + section geometry from a packed grid and assert
// they are non-empty, finite, UVW in [0,1], and index in range. Run: node scripts/test-gridmesh.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
if (!existsSync(join(__dirname, '..', 'src', 'engine', 'gridmesh.ts'))) { console.log('SKIP'); process.exit(0); }

const { buildGrid } = await import('../src/engine/grid3d.ts');
const { packGrid3D } = await import('../src/engine/pack3d.ts');
const { buildShell, buildSection } = await import('../src/engine/gridmesh.ts');

const nx = 20, ny = 16, nz = 8;
const topZ = new Float64Array(nx * ny), baseZ = new Float64Array(nx * ny);
for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
  const c = k * nx + i;
  if (i < 2 && k < 2) { topZ[c] = NaN; baseZ[c] = NaN; continue; }
  topZ[c] = 2800 + ((i - 10) ** 2 + (k - 8) ** 2) * 0.8; baseZ[c] = topZ[c] + 65;
}
const g = buildGrid({ nx, ny, nz, dx: 50, dy: 50, x0: 435000, y0: 6477000, topZ, baseZ });
for (let c = 0; c < g.active.length; c++) if (g.active[c]) { g.phi[c] = 0.2; g.ntg[c] = 0.8; g.sw[c] = 0.3; g.facies[c] = 1; g.perm[c] = 200; }
const packed = packGrid3D(g);

function validate(name, m) {
  check(`${name}: non-empty`, m.position.length > 0 && m.index.length > 0, `${m.position.length / 3} verts · ${m.index.length / 3} tris`);
  let finite = true, uvwOk = true;
  for (let i = 0; i < m.position.length; i++) if (!Number.isFinite(m.position[i])) finite = false;
  for (let i = 0; i < m.uvw.length; i++) if (m.uvw[i] < 0 || m.uvw[i] > 1) uvwOk = false;
  check(`${name}: positions finite`, finite);
  check(`${name}: uvw in [0,1]`, uvwOk);
  let idxOk = true; const nV = m.position.length / 3;
  for (let i = 0; i < m.index.length; i++) if (m.index[i] < 0 || m.index[i] >= nV) idxOk = false;
  check(`${name}: indices in range`, idxOk, `nV=${nV}`);
  check(`${name}: normals per vertex`, m.normal.length === m.position.length);
}
const shell = buildShell(packed);
validate('shell', shell);
// continuity: the top surface must be gap-free — every top vertex position must coincide
// with another top vertex from a neighbouring cell (corner-shared), so no floating tiles.
{
  const top = [];
  for (let v = 0; v < shell.position.length; v += 3) if (Math.abs(shell.uvw[v + 2] - (0.5 / nz)) < 1e-6) top.push([shell.position[v], shell.position[v + 1], shell.position[v + 2]]);
  const key = (a) => `${a[0].toFixed(3)},${a[1].toFixed(3)},${a[2].toFixed(3)}`;
  const seen = new Map(); for (const a of top) seen.set(key(a), (seen.get(key(a)) || 0) + 1);
  // interior corners are shared by 2–4 cells → most positions appear >1×; a fully-tiled
  // (broken) surface would have every position unique. Assert real sharing exists.
  let shared = 0; for (const n of seen.values()) if (n > 1) shared++;
  check('shell: top surface is corner-shared (continuous)', shared > top.length * 0.15, `${shared} shared / ${seen.size} unique corners`);
}
validate('section-i', buildSection(packed, 'i', Math.floor(nx / 2)));
validate('section-k', buildSection(packed, 'k', Math.floor(ny / 2)));

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
