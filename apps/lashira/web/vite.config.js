import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// LashiraBloom dev server. `open: true` pops the browser automatically so the
// launch .bat only needs to start this — no separate "open URL" step.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../../web/src'),
      '@components': path.resolve(__dirname, '../../web/src/components'),
    },
  },
  server: {
    port: 5185,
    strictPort: false,
    open: true,
    host: true,
    fs: { allow: [path.resolve(__dirname, '../..')] },
  },
});
