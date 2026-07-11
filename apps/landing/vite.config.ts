import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': resolve(__dirname, 'src') },
  },
  build: {
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          gsap: ['gsap'],
          react: ['react', 'react-dom'],
          supabase: ['@supabase/supabase-js'],
          d3: ['d3-scale', 'd3-shape', 'd3-array', 'd3-interpolate', 'd3-geo'],
        },
      },
    },
  },
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 5191,
    strictPort: true,
  },
})
