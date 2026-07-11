import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  server: { port: 5273 },
  // Battle Builder + Character Builder share the ONE source of truth with the games.
  resolve: { alias: {
    '@arganta/combat': path.resolve(__dirname, '../../packages/combat/src/index.js'),
    '@arganta/character': path.resolve(__dirname, '../../packages/character/src/index.js'),
    '@arganta/audio': path.resolve(__dirname, '../../packages/audio/src/index.js'),
    '@arganta/video': path.resolve(__dirname, '../../packages/video/src/index.js'),
    // Character Forge renders the real animated character through Kingdom's engine.
    '@arganta/heroes-engine': path.resolve(__dirname, '../../packages/heroes-engine/src/index.js'),
  } },
})
