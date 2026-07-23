// G5 SIMMESH sanity — drape a sim grid as a surface (flat + structure-sampled) and assert
// non-empty, finite, UV in [0,1], indices in range, and that zAt shapes the sheet.
// Run: node scripts/test-simmesh.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const check = (n, ok, d = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${d ? ` — ${d}` : ''}`); ok ? pass++ : fail++; };
if (!existsSync(join(__dirname, '..', 'src', 'engine', 'simmesh.ts'))) { console.log('SKIP'); process.exit(0); }
const { buildSimSurface } = await import('../src/engine/simmesh.ts');

const nx = 30, ny = 24, dx = 40, dy = 40, x0 = 435000, y0 = 6477000;
// a couple of dead cells to exercise the mask
const active = new Uint8Array(nx * ny).fill(1); active[0] = 0; active[1] = 0;

function validate(name, m, expectDomed) {
  check(`${name}: non-empty`, m.position.length > 0 && m.index.length > 0, `${m.position.length / 3} verts · ${m.index.length / 3} tris`);
  let finite = true, uvOk = true;
  for (let i = 0; i < m.position.length; i++) if (!Number.isFinite(m.position[i])) finite = false;
  for (let i = 0; i < m.uvw.length; i++) if (m.uvw[i] < 0 || m.uvw[i] > 1) uvOk = false;
  check(`${name}: positions finite`, finite);
  check(`${name}: uv in [0,1]`, uvOk);
  const nV = m.position.length / 3; let idxOk = true;
  for (let i = 0; i < m.index.length; i++) if (m.index[i] < 0 || m.index[i] >= nV) idxOk = false;
  check(`${name}: indices in range`, idxOk, `nV=${nV}`);
  // vertical spread (py = depth-up): flat ≈ 0, domed > 0
  let ymin = Infinity, ymax = -Infinity; for (let v = 1; v < m.position.length; v += 3) { ymin = Math.min(ymin, m.position[v]); ymax = Math.max(ymax, m.position[v]); }
  const spread = ymax - ymin;
  check(`${name}: vertical spread ${expectDomed ? '> 0 (follows structure)' : '≈ 0 (flat)'}`, expectDomed ? spread > 20 : spread < 1e-3, `spread=${spread.toFixed(2)} m`);
}

validate('flat', buildSimSurface({ nx, ny, dx, dy, x0, y0, active }), false);
// structure sampler: a dome (crest shallow, flanks deep)
const zAt = (x, y) => 2800 + (((x - (x0 + nx * dx / 2)) ** 2 + (y - (y0 + ny * dy / 2)) ** 2) / 4000);
validate('domed', buildSimSurface({ nx, ny, dx, dy, x0, y0, active }, { zAt }), true);
// two dead cells → fewer verts than nx·ny
const m = buildSimSurface({ nx, ny, dx, dy, x0, y0, active });
check('dead cells excluded', m.position.length / 3 === nx * ny - 2, `${m.position.length / 3} = ${nx * ny}-2`);

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
