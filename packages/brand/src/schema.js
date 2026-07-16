// SCHEMA — the BrandDoc contract.
//
// One document describes a brand across all seven layers. Everything downstream
// (postEngine, Arganta Core, Buffer, Video Builder, Higgsfield briefs, the
// Landing site's meta) reads this instead of hard-coding brand facts, so adding
// a sixth brand is adding a sixth document — never a code change.
//
// Storage is split by lane (see lanes.js): the agent lane ships as brand.json in
// git, the founder lane as a jsonb overlay in Supabase. resolveBrand() in
// registry.js merges the two into the shape below.

import { LAYER_LANES } from './lanes.js'

/** Languages every text field may carry. Bilingual from day one. */
export const LANGUAGES = ['en', 'id']
export const DEFAULT_LANGUAGE = 'en'

/** Boilerplate lengths — written once, reused verbatim on every platform.
 *  Verbatim consistency is also the strongest AI-search (AEO) signal. */
export const BOILERPLATE_LENGTHS = ['w25', 'w50', 'w100', 'w200']

/** The four content pillars are per-brand, but every brand has some. */
export const HASHTAG_TIERS = ['branded', 'category', 'community']

/**
 * A blank BrandDoc. Every field the system knows about appears here, so the
 * shape is self-documenting and readiness scoring has something to measure
 * against. Real brands override in brand.json (agent lane) + overlay (founder).
 *
 * @typedef {ReturnType<typeof blankBrand>} BrandDoc
 */
export function blankBrand(id = 'untitled', name = 'Untitled') {
  return {
    id,
    name,
    status: 'draft', // draft | living | retired

    // ── L0 · Identity ─────────────────────────────── (agent lane)
    identity: {
      // Declarative mark geometry — ONE source that both the canvas renderer
      // (postEngine) and the SVG exporter draw from. See mark.js.
      mark: null,
      // Named colors. `accent` drives pagers/badges; `plate` is the solid text
      // backing that keeps copy legible over generated artwork.
      //
      // Every value starts NULL on purpose. A blank brand must score 0% — if the
      // shape shipped placeholder greys, readiness() would report progress for a
      // brand nobody has designed yet, and the whole point of this system is that
      // it never lies about how done something is. Renderers own their own
      // fallbacks (postEngine keeps the global yellow plate); a brand only ever
      // *overrides*.
      palette: {
        bg: null, bgAlt: null,
        ink: null, soft: null,
        accent: null,
        plateBg: null, plateInk: null,
      },
      // Extra brand hues beyond the core roles, keyed by name.
      accents: {},
      fonts: { display: null, body: null, mono: null, embedded: [] },
      icons: { style: null, set: {} },
      motion: { intro: null, outro: null, markAnimation: null },
      // Audio mark — real in v1: a ~2s sting authored through @arganta/audio.
      audio: { sting: null, durationMs: 2000 },
    },

    // ── L0.5 · Knowledge base ─────────────────────── (agent lane)
    // The pack any media AI reads to "get" the brand with zero explanation.
    kb: {
      brandMd: null,   // path to BRAND.md
      refs: [],        // canonical style-anchor images
      prompts: {},     // assetType → path of a ready generation brief
      // The one-paragraph machine-injectable distillation of BRAND.md's visual
      // world. BRAND.md is for a human or a long-context model to read; this
      // rides inside every image request, so it has to be short.
      artDirection: null,
    },

    // ── L1 · Voice & persona ──────────────────────── (founder lane)
    voice: {
      persona: { title: null, adjectives: [], speaksAs: null, forbidden: [] },
      // All copy is keyed by language: { en: {...}, id: {...} }
      taglines: {},
      boilerplates: {},  // lang → { w25, w50, w100, w200 }
      pitches: {},       // lang → { parent, kid, investor, press }
      pillars: [],       // [{ id, label, description, accent, icon }]
      hashtags: {},      // tier → [tags]
      ctas: {},          // lang → [strings]
      emojiPolicy: null,
      languages: [DEFAULT_LANGUAGE],
      // The humanity layer — what keeps automated posts personal.
      touchyRules: [],
    },

    // ── L2 · Platform presence ────────────────────── (mixed lane)
    // platformId → { handle, bio, link, category, pinned (founder)
    //                avatar, banner, highlights (agent) }
    presence: {},

    // ── L3 · Content & ad system ──────────────────── (agent lane)
    content: {
      templates: {},       // pillarId/kind → template id in postEngine
      captionFormula: null,
      adKit: { meta: {}, google: {}, display: {} },
      ogTemplate: null,
    },

    // ── L4 · Discovery ────────────────────────────── (mixed lane)
    discovery: {
      seo: {},             // lang → { titleTemplate, metaDescription }
      schemaOrg: null,     // agent: generated JSON-LD
      ogImage: null,       // agent: generated
      factSheet: {},       // lang → [{ q, a }] — the canonical AI-search answers
      llmsTxt: null,
      keywords: [],
    },

    // ── L5 · Campaign spine ───────────────────────── (founder lane)
    spine: {
      rhythm: [],          // [{ day, pillar, format, note }]
      playbooks: {},       // name → [{ step, brief }]
      toneCalendar: [],
    },

    // ── Routing ───────────────────────────────────── (agent lane)
    routing: { bufferChannelId: null, momentSenderProfileId: null, siteUrl: null },
  }
}

/** Layers in display order, with the metadata the Brand Forge layer strip needs. */
export const LAYERS = Object.freeze([
  { id: 'identity',  n: 'L0',   label: 'Identity',      lane: LAYER_LANES.identity },
  { id: 'kb',        n: 'L0.5', label: 'Knowledge base', lane: LAYER_LANES.kb },
  { id: 'voice',     n: 'L1',   label: 'Voice',         lane: LAYER_LANES.voice },
  { id: 'presence',  n: 'L2',   label: 'Presence',      lane: LAYER_LANES.presence },
  { id: 'content',   n: 'L3',   label: 'Content & ads', lane: LAYER_LANES.content },
  { id: 'discovery', n: 'L4',   label: 'Discovery',     lane: LAYER_LANES.discovery },
  { id: 'spine',     n: 'L5',   label: 'Campaign spine', lane: LAYER_LANES.spine },
])

/** Deep merge where `overlay` wins on leaves. Arrays replace wholesale (a
 *  half-merged hashtag list would be nonsense). Used to fold the founder-lane
 *  DB overlay onto the git base. */
export function deepMerge(base, overlay) {
  if (overlay === undefined || overlay === null) return base
  if (Array.isArray(overlay) || typeof overlay !== 'object') return overlay
  if (base === null || typeof base !== 'object' || Array.isArray(base)) return overlay
  const out = { ...base }
  for (const [k, v] of Object.entries(overlay)) out[k] = deepMerge(base[k], v)
  return out
}

/** Read a dotted path. */
export const getPath = (obj, path) =>
  String(path).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj)

/** Structural validation. Returns [] when the doc is usable. This is a contract
 *  check, not a completeness check — readiness() measures completeness. */
export function validateBrand(doc) {
  const errs = []
  if (!doc || typeof doc !== 'object') return ['brand doc must be an object']
  if (!doc.id || !/^[a-z][a-z0-9-]*$/.test(doc.id)) errs.push('id must be a lowercase slug')
  if (!doc.name) errs.push('name is required')
  for (const layer of LAYERS) {
    if (doc[layer.id] === undefined) errs.push(`missing layer "${layer.id}" (${layer.n})`)
  }
  const langs = doc.voice?.languages || []
  for (const l of langs) if (!LANGUAGES.includes(l)) errs.push(`unknown language "${l}"`)
  const pal = doc.identity?.palette || {}
  for (const [k, v] of Object.entries(pal)) {
    if (typeof v === 'string' && !/^#[0-9a-fA-F]{3,8}$/.test(v)) errs.push(`palette.${k} is not a hex color`)
  }
  return errs
}
