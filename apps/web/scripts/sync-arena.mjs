// Pull the Character Lab / Buya Arena from the SINGLE source of truth
// (apps/kingdom/web/src) into ArgantaLab's Arena page. Edit the Lab in
// Kingdom; run `node scripts/sync-arena.mjs` to update the embed here.
//
// Only mechanical work: copy the game code verbatim and scope the Lab's
// global CSS (:root / body) to `.arena-app` so it can't touch ArgantaLab's
// theme. Auth/data differences are handled at runtime (injected host client +
// VITE_KINGDOM_DATA_BASE), NOT by editing the copied files — so nothing here
// diverges from Kingdom.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(__dirname, '..');
const KING = path.resolve(WEB, '../kingdom/web/src');
const DEST = path.join(WEB, 'src', 'pages', 'arena');

const DIRS = ['engine', 'components', 'lab', 'room', 'net'];
const FILES = ['App.jsx'];

if (!fs.existsSync(KING)) throw new Error(`Kingdom source not found: ${KING}`);
fs.mkdirSync(DEST, { recursive: true });

for (const d of DIRS) {
  const src = path.join(KING, d);
  const dst = path.join(DEST, d);
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
  console.log(`  + ${d}/`);
}
for (const f of FILES) {
  fs.copyFileSync(path.join(KING, f), path.join(DEST, f));
  console.log(`  + ${f}`);
}

// styles.css -> arena.css, with the global theme blocks scoped to .arena-app.
let css = fs.readFileSync(path.join(KING, 'styles.css'), 'utf8');
css = css.replace(/:root\s*\{/, '.arena-app {');
css = css.replace(/body\.dark\s*\{/, '[data-theme="dark"] .arena-app {');
// the global reset `* { box-sizing } \n body { margin:0; ... }` -> scoped
css = css.replace(
  /\*\s*\{\s*box-sizing:\s*border-box;\s*\}\s*body\s*\{/,
  '.arena-app * { box-sizing: border-box; }\n.arena-app {'
);
css += `

/* ---------- Arena embed layout (added by sync-arena.mjs) ---------- */
.arena-app { width: 100%; min-height: 100%; }
.arena-app > header { padding: 0 0 12px; border: none; background: transparent; }
.arena-app > header .tabs button {
  background: var(--panel); color: var(--text);
  border: 1px solid var(--line); border-radius: 9px;
  padding: 7px 18px; cursor: pointer; font-weight: 600;
}
.arena-app > header .tabs button.on { background: var(--accent); border-color: var(--accent); color: #fff; }
`;
fs.writeFileSync(path.join(DEST, 'arena.css'), css);
console.log('  + arena.css (scoped)');

console.log('done. Arena synced from Kingdom source.');
