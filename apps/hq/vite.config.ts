import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  server: { port: 5273 },
  // Pre-bundle EVERY heavy front-end dep up front. Surfaces are lazy-loaded, so
  // Vite only discovers their deps on navigation and then RE-OPTIMIZES mid-session
  // — which regenerates the optimized-dep hash and loads a *second* copy of the
  // dep. PixiJS registers global extensions at module-init, so the second copy
  // throws "Extension type environment already has a handler" and blanks every
  // Pixi/Three surface (Vault graph, Knowledge cortex, Reactor). Listing all of
  // them here means the first optimize is complete and Vite never re-optimizes.
  optimizeDeps: {
    include: [
      'pixi.js', 'three', 'three.quarks', 'maath',
      '@react-three/fiber', '@react-three/drei', '@react-three/postprocessing',
      'gsap', '@xyflow/react', 'recharts',
      'd3-array', 'd3-color', 'd3-force', 'd3-geo', 'd3-scale', 'd3-shape',
      'topojson-client', 'lucide-react', 'zustand',
    ],
  },
  // The @arganta/* packages below are consumed as SOURCE via aliases, but their
  // own bare deps (gsap in video, react in combat/heroes-engine) live only in
  // THIS app's node_modules. On Vercel the build runs `cd apps/hq && npm install`
  // (apps/hq is not a workspace, root install is skipped), so no root/package-
  // level node_modules exists for those aliased sources to walk up into. `dedupe`
  // forces these shared deps to resolve from apps/hq/node_modules regardless of
  // which file imports them — otherwise `import 'gsap'` from packages/video fails.
  resolve: { dedupe: ['gsap', 'react', 'react-dom', 'pixi.js', 'three'], alias: {
    '@arganta/combat': path.resolve(__dirname, '../../packages/combat/src/index.js'),
    '@arganta/character': path.resolve(__dirname, '../../packages/character/src/index.js'),
    '@arganta/audio': path.resolve(__dirname, '../../packages/audio/src/index.js'),
    '@arganta/video': path.resolve(__dirname, '../../packages/video/src/index.js'),
    '@arganta/ai': path.resolve(__dirname, '../../packages/ai/src/index.js'),
    // Media Center's maturity-staged generation router (image/music/video/voice).
    '@arganta/media-core': path.resolve(__dirname, '../../packages/media-core/src/index.js'),
    // Character Forge renders the real animated character through Kingdom's engine.
    '@arganta/heroes-engine': path.resolve(__dirname, '../../packages/heroes-engine/src/index.js'),
    // Time-on-page tracker — the same beats every app sends; HQ tracks itself too.
    '@arganta/usage': path.resolve(__dirname, '../../packages/usage/src/index.js'),
  } },
})
