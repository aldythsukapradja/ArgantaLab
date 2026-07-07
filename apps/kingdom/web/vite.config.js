import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KINGDOM = path.resolve(__dirname, '..');

const MIME = {
  '.json': 'application/json',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

// Serves apps/kingdom/data/** at /data/** during dev, so the web app reads
// the same tracked data layers as production.
function serveKingdomData() {
  return {
    name: 'serve-kingdom-data',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url.startsWith('/data/')) return next();
        const rel = decodeURIComponent(req.url.split('?')[0]);
        const file = path.join(KINGDOM, rel);
        if (!file.startsWith(KINGDOM) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
          res.statusCode = 404;
          return res.end('not found');
        }
        res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
      });
    },
  };
}

// Production deploy: scripts/build-deploy.mjs (run after this build, from
// the apps/kingdom root) assembles command/ + data/ + this dist/ into one
// output tree, with data/ as a SIBLING of the deployed app (not nested
// inside it) — see that script for why. No copy-into-dist step needed here.

const REPO_ROOT = path.resolve(__dirname, '../../..');

export default defineConfig({
  plugins: [react(), serveKingdomData()],
  resolve: {
    alias: {
      // Shared combat system (packages/combat) — single source of truth for
      // damage/skills/monster rules, imported by BOTH Kingdom and the farm.
      '@arganta/combat': path.resolve(REPO_ROOT, 'packages/combat/src'),
    },
  },
  server: { port: 8322, fs: { allow: [REPO_ROOT] } },
  base: './',
});
