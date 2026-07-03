// Bundles the Arganta game engine (src/engine) into a single minified
// IIFE (global ARGANTA) that gameGen embeds into every generated game.
// Runs automatically before `dev` and `build` (see package.json).
import { build } from 'esbuild'
import { mkdirSync } from 'node:fs'

mkdirSync('src/generated', { recursive: true })

await build({
  entryPoints: ['src/engine/index.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'ARGANTA',
  target: 'es2020',
  outfile: 'src/generated/engine.js',
  logLevel: 'info',
})
