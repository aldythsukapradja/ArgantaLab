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
      // Shared combat system (packages/combat) — single source of truth for
      // damage/skills/monster rules, imported by BOTH the farm and Kingdom.
      '@arganta/combat': path.resolve(__dirname, '../../../packages/combat/src'),
      // Shared character-appearance registry (packages/character) — Circle HQ is
      // the source of truth for the default/NPC looks; both games read it.
      '@arganta/character': path.resolve(__dirname, '../../../packages/character/src'),
      // Shared audio library (packages/audio) — HQ Music Builder publishes SFX
      // recipes; the game boots them via net/audioLibrary.js. Aliased like the
      // others so Vercel's subfolder `npm install` (which doesn't set up the
      // monorepo workspace symlinks) can still resolve it. Without this, the
      // build fails with "Rollup failed to resolve import @arganta/audio".
      '@arganta/audio': path.resolve(__dirname, '../../../packages/audio/src'),
    },
  },
  server: {
    port: 5185,
    strictPort: false,
    open: true,
    host: true,
    fs: { allow: [path.resolve(__dirname, '../../..')] },
  },
});
