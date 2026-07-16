// SPECS — the platform spec library (L2), as DATA.
//
// This is the future-proofing hinge. Every platform is one entry here; adding a
// new one (Threads, Bluesky, Pinterest, whatever launches next) means adding an
// entry, after which the Brand Forge matrix instantly shows every brand's gaps
// for it and the validators start enforcing its limits. No code change.
//
// PROVENANCE: these limits and dimensions are transcribed from platform docs as
// of 2026-07 and marked `verified: null` — they are FOUNDER-VERIFIABLE data, not
// gospel. Platforms move; when one is confirmed against the live product, stamp
// `verified` with the date. Never let a stale number here silently truncate a
// bio: validateField() reports, it does not mutate.

/** Columns the Brand Forge matrix renders. `asset: true` → agent lane. */
export const MATRIX_COLUMNS = Object.freeze([
  { id: 'handle',    label: 'Handle',    asset: false },
  { id: 'avatar',    label: 'Avatar',    asset: true },
  { id: 'banner',    label: 'Banner',    asset: true },
  { id: 'bio',       label: 'Bio',       asset: false },
  { id: 'link',      label: 'Link',      asset: false },
  { id: 'pinned',    label: 'Pinned',    asset: false },
  { id: 'templates', label: 'Templates', asset: true },
])

const spec = (o) => ({ verified: null, notes: [], ...o })

export const PLATFORM_SPECS = Object.freeze({
  instagram: spec({
    id: 'instagram', label: 'Instagram', icon: 'instagram',
    fields: { handle: { max: 30 }, name: { max: 30 }, bio: { max: 150 }, link: { count: 5 } },
    assets: {
      avatar: { w: 320, h: 320, shape: 'circle', upload: 1080 },
      banner: null,
      post: { w: 1080, h: 1350 },
      square: { w: 1080, h: 1080 },
      story: { w: 1080, h: 1920 },
      highlight: { w: 1080, h: 1080, shape: 'circle' },
    },
    supports: { carousel: 10, pinned: 3, highlights: true },
    notes: ['Carousel via API is images-only, max 10, all cropped to slide 1 aspect.'],
  }),
  tiktok: spec({
    id: 'tiktok', label: 'TikTok', icon: 'brand-tiktok',
    fields: { handle: { max: 24 }, name: { max: 30 }, bio: { max: 80 }, link: { count: 1 } },
    assets: {
      avatar: { w: 200, h: 200, shape: 'circle', upload: 1080 },
      banner: null,
      video: { w: 1080, h: 1920 },
      story: { w: 1080, h: 1920 },
    },
    supports: { carousel: 35, pinned: 3, highlights: false },
    notes: ['Bio is the tightest of any platform at 80 chars — write it first, not last.'],
  }),
  linkedin: spec({
    id: 'linkedin', label: 'LinkedIn', icon: 'brand-linkedin',
    fields: { handle: { max: 100 }, name: { max: 100 }, tagline: { max: 120 }, bio: { max: 2000 }, link: { count: 1 } },
    assets: {
      avatar: { w: 300, h: 300, shape: 'square', upload: 400 },
      banner: { w: 1128, h: 191 },
      post: { w: 1200, h: 1500 },
      square: { w: 1200, h: 1200 },
    },
    supports: { carousel: true, pinned: 1, highlights: false },
    notes: ['Page "tagline" (120) is distinct from "about" (2000) — the 200-word boilerplate lands in about.'],
  }),
  facebook: spec({
    id: 'facebook', label: 'Facebook', icon: 'brand-facebook',
    fields: { handle: { max: 50 }, name: { max: 75 }, bio: { max: 101 }, link: { count: 1 } },
    assets: {
      avatar: { w: 320, h: 320, shape: 'circle', upload: 1080 },
      banner: { w: 820, h: 312 },
      post: { w: 1080, h: 1350 },
    },
    supports: { carousel: 10, pinned: 1, highlights: false },
    notes: ['Cover crops differently on mobile vs desktop — keep the mark centred.'],
  }),
  x: spec({
    id: 'x', label: 'X', icon: 'brand-x',
    fields: { handle: { max: 15 }, name: { max: 50 }, bio: { max: 160 }, link: { count: 1 } },
    assets: {
      avatar: { w: 400, h: 400, shape: 'circle' },
      banner: { w: 1500, h: 500 },
      post: { w: 1600, h: 900 },
    },
    supports: { carousel: 4, pinned: 1, highlights: false },
    notes: ['Handle cap of 15 is the binding constraint across the whole portfolio.'],
  }),
  youtube: spec({
    id: 'youtube', label: 'YouTube', icon: 'brand-youtube',
    fields: { handle: { max: 30 }, name: { max: 100 }, bio: { max: 1000 }, link: { count: 14 } },
    assets: {
      avatar: { w: 800, h: 800, shape: 'circle' },
      banner: { w: 2048, h: 1152, safe: { w: 1235, h: 338 } },
      thumbnail: { w: 1280, h: 720 },
      short: { w: 1080, h: 1920 },
    },
    supports: { carousel: false, pinned: 1, highlights: false },
    notes: ['Banner is cropped hard per device — everything vital inside the 1235x338 safe box.'],
  }),
})

export const listPlatforms = () => Object.values(PLATFORM_SPECS)
export const platformSpec = (id) => PLATFORM_SPECS[id] || null

/**
 * Check one text field against its platform limit.
 * Returns { ok, over, max, len } — never mutates. Truncation is a human
 * decision; silently cutting a founder's bio would be the worst outcome here.
 */
export function validateField(platformId, field, value) {
  const s = platformSpec(platformId)
  const rule = s?.fields?.[field]
  const len = value == null ? 0 : String(value).length
  if (!rule || rule.max == null) return { ok: true, over: 0, max: null, len }
  const over = Math.max(0, len - rule.max)
  return { ok: over === 0, over, max: rule.max, len }
}

/** Every asset a platform needs, with dimensions — drives Higgsfield briefs and
 *  the matrix's "what's missing" answer. */
export function requiredAssets(platformId) {
  const s = platformSpec(platformId)
  if (!s) return []
  return Object.entries(s.assets)
    .filter(([, v]) => v)
    .map(([kind, dims]) => ({ kind, ...dims }))
}
