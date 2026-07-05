import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// LashiraBloom dev server. `open: true` pops the browser automatically so the
// launch .bat only needs to start this — no separate "open URL" step.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5185,
    strictPort: false,
    open: true,
    host: true,
  },
});
