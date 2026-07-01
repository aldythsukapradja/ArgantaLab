import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  base: process.env.VITE_BASE_PATH ?? '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@hooks': path.resolve(__dirname, './src/hooks'),
      '@store': path.resolve(__dirname, './src/store'),
      '@types': path.resolve(__dirname, './src/types'),
    },
  },
  server: {
    port: 5173,
  },
  // pixi.js is only ever loaded via a lazy dynamic import (the KinWorld map), so
  // Vite doesn't discover it on startup — pre-bundle it explicitly, otherwise the
  // lazy import 504s with "Outdated Optimize Dep".
  optimizeDeps: {
    include: ['pixi.js'],
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
