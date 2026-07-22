// GVSURF pipeline truth-lock (Fable). Validates the EarthVision→light→decode
// round-trip: depth within z_scale, affine reconstructs world (x,y), null holes
// preserved, ingest downsample, and real compression. Run: node scripts/test-gvsurf.mjs
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
let pass = 0, fail = 0;
const approx = (a, b, tol) => Math.abs(a - b) <= tol;
function check(name, ok, detail = '') { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); ok ? pass++ : fail++; }

// synthetic EarthVision grid ASCII: axis-aligned world grid + analytic surface.
// `holeBlock` omits a rectangular region (no lines) → those nodes become no-data.
function synthEV(Nc, Nr, X0, Y0, DX, DY, holeBlock) {
  const lines = ['# EarthVision grid', '# Z_units: meters'];
  for (let r = 1; r <= Nr; r++) for (let c = 1; c <= Nc; c++) {
    if (holeBlock && c >= holeBlock.c0 && c <= holeBlock.c1 && r >= holeBlock.r0 && r <= holeBlock.r1) continue;
    const x = X0 + DX * (c - 1), y = Y0 + DY * (r - 1);
    const z = 2500 + 120 * Math.exp(-(((c - Nc / 2) ** 2 + (r - Nr / 2) ** 2) / (0.08 * Nc * Nr))) + 0.4 * c; // dome + tilt
    lines.push(`${x} ${y} ${z.toFixed(4)} ${c} ${r}`);
  }
  return lines.join('\n');
}

console.log('\n=== GVSURF pipeline truth-lock ===');

if (existsSync(join(__dirname, '..', 'src', 'engine', 'gvsurf.ts'))) {
  const G = await import('../src/engine/gvsurf.ts');
  const Nc = 80, Nr = 60, X0 = 431000, Y0 = 6470000, DX = 50, DY = 50;

  // 1 · property round-trip (Z preserved) within z_scale
  {
    const text = synthEV(Nc, Nr, X0, Y0, DX, DY);
    const gv = G.evToGVSURF('test', text, 0.1, 1, 'property');
    const d = G.decodeSurface(gv);
    check('decode dims match source', d.ncol === Nc && d.nrow === Nr, `${d.ncol}×${d.nrow}`);
    // rebuild original z for a few nodes and compare (depth ≈ original within scale)
    let maxErr = 0;
    for (let r = 1; r <= Nr; r += 7) for (let c = 1; c <= Nc; c += 7) {
      const zOrig = 2500 + 120 * Math.exp(-(((c - Nc / 2) ** 2 + (r - Nr / 2) ** 2) / (0.08 * Nc * Nr))) + 0.4 * c;
      const zDec = d.depth(c - 1, r - 1);
      maxErr = Math.max(maxErr, Math.abs(zDec - zOrig));
    }
    check('depth round-trips within z_scale', maxErr <= gv.z_scale + 1e-6, `maxErr=${maxErr.toExponential(2)} scale=${gv.z_scale}`);
    check('z_scale is tight (≈ range/60000, floored at quant)', gv.z_scale >= 0.1 && gv.z_scale < 1, `scale=${gv.z_scale}`);
  }

  // 2 · affine reconstructs world (x,y) from (col,row)
  {
    const text = synthEV(Nc, Nr, X0, Y0, DX, DY);
    const d = G.decodeSurface(G.evToGVSURF('t', text, 0.1, 1, 'property'));
    let maxXY = 0;
    for (let r = 1; r <= Nr; r += 11) for (let c = 1; c <= Nc; c += 11) {
      const w = d.worldXY(c - 1, r - 1);
      maxXY = Math.max(maxXY, Math.abs(w.x - (X0 + DX * (c - 1))), Math.abs(w.y - (Y0 + DY * (r - 1))));
    }
    check('affine reconstructs world XY (≤ 0.1 m)', maxXY <= 0.1, `maxXY=${maxXY.toExponential(2)} m`);
  }

  // 3 · depth surfaces negate Z (down is negative)
  {
    const d = G.decodeSurface(G.evToGVSURF('t', synthEV(20, 20, X0, Y0, DX, DY), 0.1, 1, 'depth'));
    check('depth kind → negated Z (subsurface below datum)', d.depth(10, 10) < 0 && d.kind === 'depth', `z=${d.depth(10, 10).toFixed(1)}`);
  }

  // 4 · null holes preserved (omitted region decodes to NaN)
  {
    const text = synthEV(Nc, Nr, X0, Y0, DX, DY, { c0: 30, c1: 40, r0: 25, r1: 35 });
    const d = G.decodeSurface(G.evToGVSURF('t', text, 0.1, 1, 'property'));
    check('no-data node inside the hole → NaN', isNaN(d.depth(34, 29)), `z=${d.depth(34, 29)}`);
    check('node outside the hole → finite', isFinite(d.depth(5, 5)));
  }

  // 5 · ingest downsample reduces the grid; affine still reconstructs kept nodes
  {
    const text = synthEV(Nc, Nr, X0, Y0, DX, DY);
    const d = G.decodeSurface(G.evToGVSURF('t', text, 0.1, 2, 'property'));
    check('downsample down=2 halves the grid', d.ncol === Math.ceil(Nc / 2) && d.nrow === Math.ceil(Nr / 2), `${d.ncol}×${d.nrow}`);
    const w = d.worldXY(0, 0); // downsampled node 0 = source col 1,row 1
    check('downsampled affine still hits source coords', approx(w.x, X0, 0.1) && approx(w.y, Y0, 0.1), `(${w.x.toFixed(0)},${w.y.toFixed(0)})`);
  }

  // 6 · real compression — GVSURF ≪ raw ASCII
  {
    const text = synthEV(Nc, Nr, X0, Y0, DX, DY);
    const gv = G.evToGVSURF('t', text, 0.1, 1, 'property');
    const rawBytes = Buffer.byteLength(text, 'utf8');
    const gvBytes = Buffer.byteLength(JSON.stringify(gv), 'utf8');
    const ratio = rawBytes / gvBytes;
    check('GVSURF is much smaller than raw ASCII (>4×)', ratio > 4, `${(rawBytes / 1024).toFixed(0)}KB → ${(gvBytes / 1024).toFixed(1)}KB = ${ratio.toFixed(1)}×`);
    check('encoding tag is int16-gzip-base64-rowmajor', gv.encoding === 'int16-gzip-base64-rowmajor' && gv.z_null === G.NULLV);
  }

  // 7 · determinism — same input → identical GVSURF (reproducible build)
  {
    const text = synthEV(40, 40, X0, Y0, DX, DY);
    const a = G.evToGVSURF('t', text, 0.1, 1, 'property'), b = G.evToGVSURF('t', text, 0.1, 1, 'property');
    check('GVSURF encode is deterministic', a.z === b.z && a.z_scale === b.z_scale);
  }
} else {
  console.log('SKIP  gvsurf engine not built');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
