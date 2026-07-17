// KIT — the platform asset registry (L2+), as DATA.
//
// specs.js answers "what does a platform require of a *presence*" (bio limits,
// handle limits, the matrix). This answers the sibling question the Brand Kit
// surface (the "Fitting Room") needs: "what literal FILES does putting this
// brand on every platform require, at what pixel size, and are they ready?"
//
// Same rule as specs.js: add a platform here once, every brand re-audits on
// the next render (Method Law 08 — "the audit derives"). Never hand-maintain
// a per-brand asset checklist.
//
// Two asset kinds:
//   'mark'     — rendered directly from identity.mark (glyph/compact/core) —
//                ready the moment the brand has a mark, no upload required.
//   'composed' — rendered from mark + palette + presence text (a banner, a
//                splash sequence, an OG card) — ready once palette exists too.
//   'text'     — a founder-lane presence field (bio, handle, link) — ready
//                once the field is set, reports over-limit via the platform's
//                own spec.
//
// PROVENANCE: dimensions verified 2026-07 against Hootsuite/Sprout/Buffer size
// guides and Apple/Android developer docs — see knowledge-base/brand/
// brand-kit-handoff.md. Platforms move; treat these as founder-verifiable,
// not gospel, exactly like specs.js.

import { PLATFORM_SPECS, validateField } from './specs.js'
import { getPath } from './schema.js'

const asset = (o) => ({ constraint: null, ...o })

/** id, label, category (social | app | web), platformSpecId (null when it has
 *  no specs.js counterpart), assets: [{ id, label, w, h, shape, kind,
 *  sourcePath, constraint }]. */
export const PLATFORM_KIT = Object.freeze([
  {
    id: 'instagram', label: 'Instagram', category: 'social', specId: 'instagram', icon: 'instagram',
    assets: [
      asset({ id: 'avatar', label: 'Avatar', w: 320, h: 320, shape: 'circle', kind: 'mark' }),
      // `name` is a real founder-lane field with a real limit, and registry.js's
      // matrix() never checked it — ArgantaLab shipped a 32-char display name
      // against Instagram's 30 for exactly as long as nobody was counting.
      asset({ id: 'name', label: 'Display name', kind: 'text', sourcePath: 'presence.instagram.name', constraint: { field: 'name' } }),
      asset({ id: 'bio', label: 'Bio', kind: 'text', sourcePath: 'presence.instagram.bio', constraint: { field: 'bio' } }),
      asset({ id: 'handle', label: 'Handle', kind: 'text', sourcePath: 'presence.instagram.handle', constraint: { field: 'handle' } }),
      asset({ id: 'link', label: 'Link', kind: 'text', sourcePath: 'presence.instagram.link' }),
      asset({ id: 'post', label: 'Post (4:5)', w: 1080, h: 1350, kind: 'composed' }),
      asset({ id: 'square', label: 'Square', w: 1080, h: 1080, kind: 'composed' }),
      asset({ id: 'story', label: 'Story / Reel', w: 1080, h: 1920, kind: 'composed' }),
      asset({ id: 'highlight', label: 'Highlight cover', w: 1080, h: 1080, shape: 'circle', kind: 'mark' }),
    ],
  },
  {
    id: 'linkedin', label: 'LinkedIn', category: 'social', specId: 'linkedin', icon: 'brand-linkedin',
    assets: [
      asset({ id: 'avatar', label: 'Logo', w: 300, h: 300, shape: 'square', kind: 'mark' }),
      asset({ id: 'name', label: 'Page name', kind: 'text', sourcePath: 'presence.linkedin.name', constraint: { field: 'name' } }),
      asset({ id: 'banner', label: 'Cover banner', w: 1128, h: 191, kind: 'composed' }),
      asset({ id: 'tagline', label: 'Tagline', kind: 'text', sourcePath: 'presence.linkedin.tagline', constraint: { field: 'tagline' } }),
      asset({ id: 'bio', label: 'About', kind: 'text', sourcePath: 'presence.linkedin.bio', constraint: { field: 'bio' } }),
      asset({ id: 'post', label: 'Post (4:5)', w: 1200, h: 1500, kind: 'composed' }),
    ],
  },
  {
    id: 'tiktok', label: 'TikTok', category: 'social', specId: 'tiktok', icon: 'brand-tiktok',
    assets: [
      asset({ id: 'avatar', label: 'Avatar', w: 200, h: 200, shape: 'circle', kind: 'mark' }),
      asset({ id: 'bio', label: 'Bio (80 max — tightest of any platform)', kind: 'text', sourcePath: 'presence.tiktok.bio', constraint: { field: 'bio' } }),
      asset({ id: 'handle', label: 'Handle', kind: 'text', sourcePath: 'presence.tiktok.handle', constraint: { field: 'handle' } }),
      asset({ id: 'video', label: 'Video / Story', w: 1080, h: 1920, kind: 'composed' }),
    ],
  },
  {
    id: 'youtube', label: 'YouTube', category: 'social', specId: 'youtube', icon: 'brand-youtube',
    assets: [
      asset({ id: 'avatar', label: 'Avatar', w: 800, h: 800, shape: 'circle', kind: 'mark' }),
      asset({ id: 'name', label: 'Channel name', kind: 'text', sourcePath: 'presence.youtube.name', constraint: { field: 'name' } }),
      asset({ id: 'banner', label: 'Channel art (1546×423 safe)', w: 2560, h: 1440, safe: { w: 1546, h: 423 }, kind: 'composed' }),
      asset({ id: 'thumbnail', label: 'Thumbnail', w: 1280, h: 720, kind: 'composed' }),
      asset({ id: 'bio', label: 'About', kind: 'text', sourcePath: 'presence.youtube.bio', constraint: { field: 'bio' } }),
    ],
  },
  {
    id: 'x', label: 'X', category: 'social', specId: 'x', icon: 'brand-x',
    assets: [
      asset({ id: 'avatar', label: 'Avatar', w: 400, h: 400, shape: 'circle', kind: 'mark' }),
      asset({ id: 'name', label: 'Name', kind: 'text', sourcePath: 'presence.x.name', constraint: { field: 'name' } }),
      asset({ id: 'banner', label: 'Header', w: 1500, h: 500, kind: 'composed' }),
      asset({ id: 'bio', label: 'Bio', kind: 'text', sourcePath: 'presence.x.bio', constraint: { field: 'bio' } }),
      asset({ id: 'handle', label: 'Handle (15 max — the portfolio\'s binding constraint)', kind: 'text', sourcePath: 'presence.x.handle', constraint: { field: 'handle' } }),
    ],
  },
  {
    id: 'ios', label: 'iOS', category: 'app', specId: null, icon: 'brand-apple',
    assets: [
      // Opaque, sRGB, no alpha — the App Store rejects an icon with an alpha
      // channel outright, so `transparent` stays off for every iOS icon.
      asset({ id: 'master', label: 'Master (App Store)', w: 1024, h: 1024, kind: 'mark' }),
      asset({ id: 'icon180', label: 'Home screen @3x', w: 180, h: 180, kind: 'mark' }),
      asset({ id: 'icon167', label: 'iPad Pro @2x', w: 167, h: 167, kind: 'mark' }),
      asset({ id: 'icon152', label: 'iPad @2x', w: 152, h: 152, kind: 'mark' }),
      asset({ id: 'icon120', label: 'Home screen @2x', w: 120, h: 120, kind: 'mark' }),
      asset({ id: 'screenshot', label: 'App Store screenshot (6.7")', w: 1290, h: 2796, kind: 'composed' }),
    ],
  },
  {
    id: 'android', label: 'Android', category: 'app', specId: null, icon: 'brand-android',
    assets: [
      // The foreground is a LAYER — it composites over adaptiveBg inside the
      // launcher's mask, so this one genuinely needs its alpha channel.
      asset({ id: 'adaptiveFg', label: 'Adaptive foreground (108dp layer)', w: 432, h: 432, kind: 'mark', transparent: true }),
      asset({ id: 'adaptiveBg', label: 'Adaptive background', w: 432, h: 432, kind: 'composed' }),
      asset({ id: 'play', label: 'Play Store listing', w: 512, h: 512, kind: 'mark' }),
      asset({ id: 'feature', label: 'Play feature graphic', w: 1024, h: 500, kind: 'composed' }),
      asset({ id: 'screenshot', label: 'Play phone screenshot', w: 1080, h: 1920, kind: 'composed' }),
    ],
  },
  {
    id: 'splash', label: 'Splash', category: 'app', specId: null, icon: 'bolt',
    assets: [
      asset({ id: 'sequence', label: 'Launch sequence (ground → mark)', w: 1170, h: 2532, kind: 'composed' }),
      asset({ id: 'icon288', label: 'Splash icon (288dp inner)', w: 288, h: 288, kind: 'mark' }),
    ],
  },
  {
    id: 'web', label: 'Web', category: 'web', specId: null, icon: 'world',
    assets: [
      asset({ id: 'favicon32', label: 'Favicon', w: 32, h: 32, kind: 'mark', transparent: true }),
      asset({ id: 'favicon16', label: 'Favicon (small)', w: 16, h: 16, kind: 'mark', transparent: true }),
      asset({ id: 'appleTouch', label: 'Apple touch icon', w: 180, h: 180, kind: 'mark' }),
      asset({ id: 'og', label: 'OG share card', w: 1200, h: 630, kind: 'composed' }),
    ],
  },
])

export const listKitPlatforms = () => PLATFORM_KIT
export const kitPlatform = (id) => PLATFORM_KIT.find((p) => p.id === id) || null

const has = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)

/** One asset's readiness: 'ok' | 'draft' | 'warn' | 'missing'. Never stored —
 *  always computed from the live doc, per Law 08. */
function assetState(doc, platform, a) {
  const mark = doc?.identity?.mark
  const pal = doc?.identity?.palette || {}
  if (a.kind === 'mark') {
    return has(mark?.variants) ? { state: 'ok', note: `${a.w}×${a.h}` } : { state: 'missing', note: 'no mark geometry' }
  }
  if (a.kind === 'composed') {
    if (!has(mark?.variants)) return { state: 'missing', note: 'no mark geometry' }
    if (!has(pal.bg) || !has(pal.accent)) return { state: 'missing', note: 'palette incomplete' }
    return { state: 'ok', note: `${a.w}×${a.h}` }
  }
  // 'text'
  const v = getPath(doc, a.sourcePath)
  if (!has(v)) return { state: 'missing', note: `no ${a.label.toLowerCase()}` }
  if (a.constraint?.field && platform.specId) {
    const check = validateField(platform.specId, a.constraint.field, v)
    if (!check.ok) return { state: 'warn', note: `${check.over} over the ${check.max} limit` }
    return { state: 'ok', note: `${check.len}/${check.max ?? '—'}` }
  }
  return { state: 'ok', note: String(v) }
}

/** Every platform's asset checklist for one brand doc, each cell state-scored
 *  the same way registry.js scores the L2 presence matrix. This is the Brand
 *  Kit "rack" — derived, never a hand-maintained list. */
export function kitStatus(doc) {
  return PLATFORM_KIT.map((platform) => {
    const assets = platform.assets.map((a) => ({ ...a, ...assetState(doc, platform, a) }))
    const ready = assets.filter((a) => a.state === 'ok').length
    return { id: platform.id, label: platform.label, category: platform.category, icon: platform.icon, assets, ready, total: assets.length, pct: assets.length ? Math.round((ready / assets.length) * 100) : 0 }
  })
}
