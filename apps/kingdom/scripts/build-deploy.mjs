// Assembles the ONE static output directory Vercel deploys, combining the
// three things apps/kingdom ships as siblings on disk (command/, data/,
// web/) into one servable tree:
//
//   dist_site/
//     command/   <- Kingdom Command (vanilla JS dashboard) — unmodified,
//                   so its own relative paths (./styles.css, ../data/...)
//                   keep working exactly as they do in local dev.
//     data/      <- shared static game data, sibling of both apps below.
//     lab/       <- built Character Lab React app (web/dist), which reads
//                   its own data via ABSOLUTE "/data/..." paths, so it
//                   works from this subpath as long as /data/ sits at the
//                   deployment root (it does, right above).
//
// vercel.json redirects "/" -> "/command/" so the dashboard is what people
// land on (matching local dev, where Kingdom Command is the entry point
// and the Character Lab is reached through its own nav tab / iframe).
//
// Run via: cd web && npm run build && cd .. && node scripts/build-deploy.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KINGDOM = path.resolve(__dirname, '..');
const OUT = path.join(KINGDOM, 'dist_site');

function copy(rel, label) {
  const src = path.join(KINGDOM, rel);
  if (!fs.existsSync(src)) {
    throw new Error(`build-deploy: missing ${label} at ${src}`);
  }
  const dest = path.join(OUT, rel === 'web/dist' ? 'lab' : rel);
  fs.cpSync(src, dest, { recursive: true });
  console.log(`  + ${label} -> ${path.relative(KINGDOM, dest)}`);
}

console.log('Assembling dist_site...');
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

copy('command', 'command/ (Kingdom Command)');
copy('data', 'data/ (shared game data)');
copy('web/dist', 'web/dist (built Character Lab)');

console.log(`done -> ${path.relative(KINGDOM, OUT)}`);
