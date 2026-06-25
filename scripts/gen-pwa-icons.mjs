// =============================================================
//  Optional: render the premium SVG app icons to PNG.
//
//  The PWAs already install & show crisp icons from the SVGs alone
//  (Chrome / Edge / Android / desktop). PNGs are only needed if you
//  want a pixel-perfect HOME-SCREEN icon on iOS Safari, which ignores
//  SVG apple-touch-icons.
//
//  Usage (from the repo root):
//    npm i -D sharp
//    node scripts/gen-pwa-icons.mjs
//
//  For each app it writes into apps/<app>/public:
//    icon-192.png, icon-512.png, icon-maskable-512.png, apple-touch-icon.png
//  Then add the PNG entries it prints to that app's manifest, and an
//  <link rel="apple-touch-icon" href="/apple-touch-icon.png"> in index.html.
// =============================================================
import { readFile, writeFile, access } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const APPS = ['web', 'kinetik', 'hq']

let sharp
try {
  sharp = (await import('sharp')).default
} catch {
  console.error('\n  This script needs "sharp". Install it first:\n    npm i -D sharp\n')
  process.exit(1)
}

const exists = async (p) => { try { await access(p); return true } catch { return false } }

for (const app of APPS) {
  const pub = join(root, 'apps', app, 'public')
  const iconSvg = join(pub, 'icon.svg')
  const maskSvg = join(pub, 'icon-maskable.svg')
  if (!(await exists(iconSvg))) { console.warn(`skip ${app}: no icon.svg`); continue }

  const icon = await readFile(iconSvg)
  const mask = (await exists(maskSvg)) ? await readFile(maskSvg) : icon

  const jobs = [
    [icon, 192, 'icon-192.png'],
    [icon, 512, 'icon-512.png'],
    [icon, 180, 'apple-touch-icon.png'],
    [mask, 512, 'icon-maskable-512.png'],
  ]
  for (const [buf, size, name] of jobs) {
    await sharp(buf, { density: 384 }).resize(size, size).png().toFile(join(pub, name))
  }
  console.log(`✓ ${app}: wrote ${jobs.map((j) => j[2]).join(', ')}`)
}

console.log(`
Add these to each app's manifest "icons" array (before the SVG entries):
  { "src": "/icon-192.png", "type": "image/png", "sizes": "192x192", "purpose": "any" },
  { "src": "/icon-512.png", "type": "image/png", "sizes": "512x512", "purpose": "any" },
  { "src": "/icon-maskable-512.png", "type": "image/png", "sizes": "512x512", "purpose": "maskable" }
And in each index.html:  <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
`)
