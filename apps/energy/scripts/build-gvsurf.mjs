// build-gvsurf.mjs (G0) — convert EarthVision grid ASCII exports into lightweight
// GVSURF JSON for the app. Mirrors the founder's GeaVision-Studio pipeline via the
// shared engine (src/engine/gvsurf.ts) so build == runtime == truth-lock.
//
// Source dir (gitignored, not committed — EarthVision exports are large & licensed):
//   apps/energy/data-source/earthvision/*.{grd,txt,dat,asc}
// Optional per-file config: data-source/earthvision/manifest.json
//   { "Top_Kharaib_B.grd": { "name":"Top Kharaib B", "kind":"depth", "quant":0.1, "down":2 }, ... }
// Output: apps/energy/public/wb/gvsurf/<slug>.gvsurf.json  + index.json  (both gitignored)
//
// Run: node scripts/build-gvsurf.mjs   (no-op with a friendly note if no source dir)
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const SRC = join(ROOT, 'data-source', 'earthvision');
const OUT = join(ROOT, 'public', 'wb', 'gvsurf');
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const { evToGVSURF } = await import('../src/engine/gvsurf.ts');

if (!existsSync(SRC)) {
  console.log(`[gvsurf] no source dir — skipping.\n         Put EarthVision grid ASCII in: ${SRC}\n         (lines "x y z col row", #Z_units comments). Re-run to build GVSURF.`);
  process.exit(0);
}

const manifest = existsSync(join(SRC, 'manifest.json')) ? JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8')) : {};
const files = readdirSync(SRC).filter((f) => ['.grd', '.txt', '.dat', '.asc'].includes(extname(f).toLowerCase()));
if (!files.length) { console.log(`[gvsurf] source dir empty (${SRC}).`); process.exit(0); }

mkdirSync(OUT, { recursive: true });
const index = [];
for (const f of files) {
  const cfg = manifest[f] || {};
  const name = cfg.name || basename(f, extname(f));
  const kind = cfg.kind || 'depth';
  const quant = cfg.quant ?? 0.1;
  const down = cfg.down ?? 1;
  const text = readFileSync(join(SRC, f), 'utf8');
  const t0 = Date.now();
  const gv = evToGVSURF(name, text, quant, down, kind);
  const outFile = join(OUT, `${slug(name)}.gvsurf.json`);
  writeFileSync(outFile, JSON.stringify(gv));
  const rawKB = statSync(join(SRC, f)).size / 1024, gvKB = statSync(outFile).size / 1024;
  index.push({ name, file: `gvsurf/${slug(name)}.gvsurf.json`, ncol: gv.ncol, nrow: gv.nrow, kind, down, z_units: gv.z_units, rawKB: +rawKB.toFixed(0), gvKB: +gvKB.toFixed(1), ratio: +(rawKB / gvKB).toFixed(1) });
  console.log(`[gvsurf] ${name}: ${gv.ncol}×${gv.nrow} · ${rawKB.toFixed(0)}KB → ${gvKB.toFixed(1)}KB (${(rawKB / gvKB).toFixed(1)}×) · ${Date.now() - t0}ms`);
}
writeFileSync(join(OUT, 'index.json'), JSON.stringify({ generated: files.length, surfaces: index }, null, 2));
console.log(`[gvsurf] wrote ${index.length} surface(s) + index.json → ${OUT}`);
