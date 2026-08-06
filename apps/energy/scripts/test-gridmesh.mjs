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
const { buildShell, buildSection, cornerDepths, nodeDepthAt } = await import('../src/engine/gridmesh.ts');

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

// == THE UP-AXIS - the two mesh builders must share one frame ================
//
// `surface-mesh.ts` emits (east, north, UP). This module historically emitted
// (east, UP, north), so a viewer showing both put a flat horizon map beside a grid
// standing on its edge. It cannot be fixed with a rotation at the consumer:
// (east, up, north) is LEFT-handed - east x up = -north - so every candidate rotation
// either mirrors north or turns the model upside down.
{
  const eqA = (n, a, b) => check(n, JSON.stringify(Array.from(a)) === JSON.stringify(Array.from(b)), '');
  const Y = buildShell(packed, 'y');
  const Z = buildShell(packed, 'z');

  check('the same vertex count either way', Z.position.length === Y.position.length, '');
  check('and the same triangle count', Z.index.length === Y.index.length, '');

  let swapped = 0;
  for (let i = 0; i < Y.position.length; i += 3) {
    if (Z.position[i] === Y.position[i]
      && Z.position[i + 1] === Y.position[i + 2]
      && Z.position[i + 2] === Y.position[i + 1]) swapped++;
  }
  check('EVERY position is (east, north, up) - the y<->z swap of the Y-up mesh',
    swapped === Y.position.length / 3, `${swapped}/${Y.position.length / 3}`);

  let nswap = 0;
  for (let i = 0; i < Y.normal.length; i += 3) {
    if (Z.normal[i] === Y.normal[i]
      && Z.normal[i + 1] === Y.normal[i + 2]
      && Z.normal[i + 2] === Y.normal[i + 1]) nswap++;
  }
  check('the normals swap with them', nswap === Y.normal.length / 3, `${nswap}`);

  eqA('UVW is a property coordinate, not a position - it does NOT swap',
    Z.uvw.slice(0, 9), Y.uvw.slice(0, 9));

  // a y<->z swap is a REFLECTION, so the winding must reverse or every face is lit
  // from the inside
  let reversed = 0;
  for (let t = 0; t < Y.index.length; t += 3) {
    if (Z.index[t] === Y.index[t]
      && Z.index[t + 1] === Y.index[t + 2]
      && Z.index[t + 2] === Y.index[t + 1]) reversed++;
  }
  check('every triangle is rewound, because swapping two axes mirrors the mesh',
    reversed === Y.index.length / 3, `${reversed}/${Y.index.length / 3}`);

  const ext = (buf, off) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = off; i < buf.length; i += 3) { if (buf[i] < lo) lo = buf[i]; if (buf[i] > hi) hi = buf[i]; }
    return hi - lo;
  };
  check('the Y-up mesh puts DEPTH on y and the z-up mesh puts it on z',
    ext(Y.position, 1) === ext(Z.position, 2), '');
  check('NORTH moves the other way', ext(Y.position, 2) === ext(Z.position, 1), '');
  check('east is untouched either way', ext(Y.position, 0) === ext(Z.position, 0), '');

  eqA("'y' remains the default, so existing consumers are unaffected",
    buildShell(packed).position, Y.position);
}

// ── WINDING: the thing that actually decides what you SEE ───────────────────
//
// three.js culls by screen-space winding; the normal attribute only lights the face.
// When the two disagree the surface is lit as though it faces you and culled as though
// it faces away — on a FrontSide material the top and base vanish and you look straight
// through the model at its own perimeter wall bands from the inside. That reads as a
// terraced grid riddled with gaps, and NOTHING in a "positions are finite / indices in
// range / surface is watertight" check catches it: the mesh is perfect, it is just
// inside out. 68% of the Volve shell's triangles were wound backwards this way.
{
  const agreement = (m) => {
    let agree = 0, disagree = 0;
    for (let t = 0; t < m.index.length / 3; t++) {
      const a = m.index[t * 3], b = m.index[t * 3 + 1], c = m.index[t * 3 + 2];
      const ax = m.position[a * 3], ay = m.position[a * 3 + 1], az = m.position[a * 3 + 2];
      const e1 = [m.position[b * 3] - ax, m.position[b * 3 + 1] - ay, m.position[b * 3 + 2] - az];
      const e2 = [m.position[c * 3] - ax, m.position[c * 3 + 1] - ay, m.position[c * 3 + 2] - az];
      // right-handed cross product = the side three.js treats as FRONT
      const g = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const L = Math.hypot(g[0], g[1], g[2]);
      if (!(L > 1e-9)) continue;
      const dot = (g[0] * m.normal[a * 3] + g[1] * m.normal[a * 3 + 1] + g[2] * m.normal[a * 3 + 2]) / L;
      if (dot > 0.05) agree++; else if (dot < -0.05) disagree++;
    }
    return { agree, disagree };
  };

  for (const up of ['y', 'z']) {
    const m = buildShell(packed, up);
    const { agree, disagree } = agreement(m);
    check(`shell '${up}': triangle winding agrees with the vertex normal`,
      disagree === 0 && agree > 0, `${agree} agree · ${disagree} DISAGREE`);
  }

  // and the direction itself: the top of a reservoir must face UP, or a FrontSide
  // material shows you the inside of the model from a map view
  const zm = buildShell(packed, 'z');
  const up = [0, 0, 1];
  let topFacing = 0, topTris = 0;
  for (let t = 0; t < zm.index.length / 3; t++) {
    const a = zm.index[t * 3];
    const n = [zm.normal[a * 3], zm.normal[a * 3 + 1], zm.normal[a * 3 + 2]];
    const d = n[0] * up[0] + n[1] * up[1] + n[2] * up[2];
    if (d > 0.5) {
      topTris++;
      const b = zm.index[t * 3 + 1], c = zm.index[t * 3 + 2];
      const ax = zm.position[a * 3], ay = zm.position[a * 3 + 1], az = zm.position[a * 3 + 2];
      const e1 = [zm.position[b * 3] - ax, zm.position[b * 3 + 1] - ay, zm.position[b * 3 + 2] - az];
      const e2 = [zm.position[c * 3] - ax, zm.position[c * 3 + 1] - ay, zm.position[c * 3 + 2] - az];
      if (e1[0] * e2[1] - e1[1] * e2[0] > 0) topFacing++;
    }
  }
  check('every upward-facing triangle is also wound counter-clockwise from above',
    topTris > 0 && topFacing === topTris, `${topFacing}/${topTris}`);
}

// -- A SLICE IS A SHEET, NOT A PILE OF TILES ---------------------------------
//
// The IJK player used to draw each cell as a flat quad at its OWN centre depth. Its
// down-dip neighbour is a flat quad at a different depth and nothing closed the
// vertical step, so on a dipping structure the slice was a venetian blind: at k=19 on
// Volve, 48.6% of the body's silhouette was see-through, and x3 exaggeration tripled
// every gap. It read as a sparse, broken model. The model was never sparse.
//
// The rule that fixes it, and the rule this locks: ANY two cells that share a grid
// NODE must place their corner at the SAME depth.
{
  const cd = cornerDepths(packed);

  // a node touched by no active cell has no depth at all -- returning 0 would plant a
  // corner at the datum, kilometres above the reservoir
  check('a node no active cell touches reports NaN, not zero',
    Number.isNaN(nodeDepthAt(cd, 0, 0, 0.5)), `got ${nodeDepthAt(cd, 0, 0, 0.5)}`);

  // Build the cell quads the way the slice renderer does, then check that every
  // shared EDGE is described by the same two corner depths from both sides. This is
  // the property that makes the sheet watertight; comparing a node against itself
  // would prove nothing.
  for (const f of [0, 0.5, 1]) {
    const quad = (i, k) => [
      [i, k], [i + 1, k], [i + 1, k + 1], [i, k + 1],
    ].map(([ci, ck]) => nodeDepthAt(cd, ci, ck, f));
    let edges = 0, cracks = 0, worst = 0;
    for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
      const c = k * nx + i;
      if (!packed.activeCol[c]) continue;
      const me = quad(i, k);
      if (!me.every(Number.isFinite)) continue;
      // east neighbour shares my corners 1 and 2 as its corners 0 and 3
      if (i + 1 < nx && packed.activeCol[c + 1]) {
        const nb = quad(i + 1, k);
        if (nb.every(Number.isFinite)) {
          edges++;
          const d = Math.max(Math.abs(me[1] - nb[0]), Math.abs(me[2] - nb[3]));
          if (d > 1e-9) { cracks++; worst = Math.max(worst, d); }
        }
      }
      // north neighbour shares my corners 3 and 2 as its corners 0 and 1
      if (k + 1 < ny && packed.activeCol[c + nx]) {
        const nb = quad(i, k + 1);
        if (nb.every(Number.isFinite)) {
          edges++;
          const d = Math.max(Math.abs(me[3] - nb[0]), Math.abs(me[2] - nb[1]));
          if (d > 1e-9) { cracks++; worst = Math.max(worst, d); }
        }
      }
    }
    check(`at f=${f}, adjacent slice cells meet with no crack`,
      edges > 0 && cracks === 0, `${edges} shared edges, ${cracks} cracked, worst ${worst.toFixed(4)} m`);
  }

  // and the thing the old code did: per-cell centre depths DISAGREE across a dip.
  // This asserts the fixture actually dips, so the test above is not vacuous.
  let disagree = 0, pairs = 0;
  for (let k = 0; k < ny; k++) for (let i = 0; i < nx - 1; i++) {
    const c0 = k * nx + i, c1 = k * nx + i + 1;
    if (!packed.activeCol[c0] || !packed.activeCol[c1]) continue;
    const z0 = packed.topZ[c0] + (packed.baseZ[c0] - packed.topZ[c0]) * 0.5;
    const z1 = packed.topZ[c1] + (packed.baseZ[c1] - packed.topZ[c1]) * 0.5;
    if (!Number.isFinite(z0) || !Number.isFinite(z1)) continue;
    pairs++;
    if (Math.abs(z0 - z1) > 0.01) disagree++;
  }
  check('the fixture dips, so per-cell flat tiles WOULD have left gaps',
    pairs > 0 && disagree > 0, `${disagree}/${pairs} neighbouring pairs differ in centre depth`);

  // the layer fraction has to be monotone in depth, or the player scrubs backwards
  const a0 = nodeDepthAt(cd, 10, 8, 0), a1 = nodeDepthAt(cd, 10, 8, 1);
  check('f=0 is the top of the zone and f=1 its base', a1 > a0, `${a0} -> ${a1}`);
}

console.log(`\n${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
