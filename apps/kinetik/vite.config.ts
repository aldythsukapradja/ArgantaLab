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
      '@store': path.resolve(__dirname, './src/store'),
      '@data': path.resolve(__dirname, './src/data'),
      '@repo': path.resolve(__dirname, './src/repo'),
      '@pages': path.resolve(__dirname, './src/pages'),
      // Shared time-on-page tracker (HQ Portfolio reads the beats via hq_engagement)
      '@arganta/usage': path.resolve(__dirname, '../../packages/usage/src/index.js'),
    },
  },
  server: { port: 5180 },
  build: { outDir: 'dist', sourcemap: false },
})
