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

// Production serves the same URLs from Vercel's static output. The data
// folder lives one level above the Vite app so it can also power Command/Game.
function copyKingdomData() {
  return {
    name: 'copy-kingdom-data',
    apply: 'build',
    closeBundle() {
      const src = path.join(KINGDOM, 'data');
      const dest = path.join(__dirname, 'dist', 'data');
      if (!fs.existsSync(src)) {
        throw new Error(`Missing Kingdom data folder: ${src}`);
      }
      fs.rmSync(dest, { recursive: true, force: true });
      fs.cpSync(src, dest, { recursive: true });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveKingdomData(), copyKingdomData()],
  server: { port: 8322 },
  base: './',
});
