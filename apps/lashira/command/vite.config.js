import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Bloom Command — the LashiraBloom admin / RPG-maker dashboard.
export default defineConfig({
  plugins: [react()],
  server: { port: 5186, strictPort: false, open: true, host: true },
});
