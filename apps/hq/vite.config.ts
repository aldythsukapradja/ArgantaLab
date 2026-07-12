import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  server: { port: 5273 },
  // The @arganta/* packages below are consumed as SOURCE via aliases, but their
  // own bare deps (gsap in video, react in combat/heroes-engine) live only in
  // THIS app's node_modules. On Vercel the build runs `cd apps/hq && npm install`
  // (apps/hq is not a workspace, root install is skipped), so no root/package-
  // level node_modules exists for those aliased sources to walk up into. `dedupe`
  // forces these shared deps to resolve from apps/hq/node_modules regardless of
  // which file imports them — otherwise `import 'gsap'` from packages/video fails.
  resolve: { dedupe: ['gsap', 'react', 'react-dom'], alias: {
    '@arganta/combat': path.resolve(__dirname, '../../packages/combat/src/index.js'),
    '@arganta/character': path.resolve(__dirname, '../../packages/character/src/index.js'),
    '@arganta/audio': path.resolve(__dirname, '../../packages/audio/src/index.js'),
    '@arganta/video': path.resolve(__dirname, '../../packages/video/src/index.js'),
    '@arganta/ai': path.resolve(__dirname, '../../packages/ai/src/index.js'),
    // Character Forge renders the real animated character through Kingdom's engine.
    '@arganta/heroes-engine': path.resolve(__dirname, '../../packages/heroes-engine/src/index.js'),
    // Time-on-page tracker — the same beats every app sends; HQ tracks itself too.
    '@arganta/usage': path.resolve(__dirname, '../../packages/usage/src/index.js'),
  } },
})
