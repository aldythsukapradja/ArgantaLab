import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../web/src'),
      '@components': path.resolve(__dirname, '../web/src/components'),
      '@lib': path.resolve(__dirname, '../web/src/lib'),
      '@hooks': path.resolve(__dirname, '../web/src/hooks'),
      '@store': path.resolve(__dirname, '../web/src/store'),
      '@types': path.resolve(__dirname, '../web/src/types'),
    },
  },
})
