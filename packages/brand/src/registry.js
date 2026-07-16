// REGISTRY — resolve, score and audit brands.
//
// resolveBrand() is where the two-lane rule is executed: the git base (agent
// lane) is merged with the Supabase overlay (founder lane), with the overlay
// rejected if it tries to carry agent-lane fields. Two stores, one document.
//
// readiness() and matrix() are the Brand Forge deck's data. Both DERIVE their
// answers from the spec library rather than storing a checklist, which is what
// makes the surface a permanent battle test: you cannot forget to update it,
// because there is nothing to update — add a platform spec and every brand is
// re-audited on the next render.

import { deepMerge, validateBrand, blankBrand, LAYERS, LANGUAGES } from './schema.js'
import { illegalOverlayPaths } from './lanes.js'
import { PLATFORM_SPECS, MATRIX_COLUMNS, listPlatforms, validateField } from './specs.js'

/** Cell / check states. */
export const OK = 'ok'
export const DRAFT = 'draft'
export const WARN = 'warn'
export const MISSING = 'missing'
export const NA = 'na'

/**
 * Fold the founder-lane overlay onto the git base.
 * @param {object} base     brand.json from packages/brand/brands/<id>/
 * @param {object} overlay  brand_registry.overlay jsonb
 * @param {object} opts     { strict } — throw instead of dropping bad paths
 */
export function resolveBrand(base, overlay = {}, { strict = false } = {}) {
  const illegal = illegalOverlayPaths(overlay)
  if (illegal.length) {
    const msg = `overlay carries agent-lane fields (they live in git, not the DB): ${illegal.join(', ')}`
    if (strict) throw new Error(msg)
    // Non-strict: drop the offenders rather than let the DB shadow git.
    overlay = stripPaths(overlay, illegal)
  }
  // Floor on blankBrand so every layer exists even before the DB overlay does —
  // brand.json deliberately carries NO founder-lane fields (they live in the DB),
  // so without this floor a brand-new brand would look structurally broken.
  const floor = blankBrand(base?.id || 'untitled', base?.name || 'Untitled')
  const doc = deepMerge(deepMerge(floor, base), overlay)
  return { doc, errors: validateBrand(doc), dropped: illegal }
}

function stripPaths(obj, paths) {
  const clone = JSON.parse(JSON.stringify(obj))
  for (const p of paths) {
    const parts = p.split('.')
    let o = clone
    for (let i = 0; i < parts.length - 1 && o; i++) o = o[parts[i]]
    if (o) delete o[parts[parts.length - 1]]
  }
  return clone
}

/** A registry over many brands. bases = { id: brand.json }, overlays = { id: jsonb }. */
export function createRegistry(bases = {}, overlays = {}) {
  const resolved = {}
  for (const [id, base] of Object.entries(bases)) {
    resolved[id] = resolveBrand(base, overlays[id] || {})
  }
  return {
    ids: () => Object.keys(resolved),
    get: (id) => resolved[id]?.doc || null,
    errorsFor: (id) => resolved[id]?.errors || [],
    list: () => Object.values(resolved).map((r) => r.doc),
  }
}

// ── The matrix (L2 audit) ─────────────────────────────────────

const has = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && !v.length)

/** One platform row: every column's state + why. */
export function platformRow(doc, platformId) {
  const spec = PLATFORM_SPECS[platformId]
  const p = doc?.presence?.[platformId] || {}
  const cells = {}
  for (const col of MATRIX_COLUMNS) {
    cells[col.id] = cellState(doc, spec, p, col.id)
  }
  return { platformId, label: spec?.label || platformId, cells }
}

function cellState(doc, spec, p, colId) {
  const na = { state: NA, note: 'not applicable' }
  switch (colId) {
    case 'handle': {
      if (!has(p.handle)) return { state: MISSING, note: 'no handle claimed' }
      const v = validateField(spec.id, 'handle', p.handle)
      return v.ok ? { state: OK, note: p.handle } : { state: WARN, note: `${v.over} over the ${v.max} limit` }
    }
    case 'avatar':
      return has(p.avatar) ? { state: OK, note: p.avatar } : { state: MISSING, note: 'no avatar asset' }
    case 'banner':
      if (!spec?.assets?.banner) return na
      return has(p.banner) ? { state: OK, note: p.banner } : { state: MISSING, note: `needs ${spec.assets.banner.w}x${spec.assets.banner.h}` }
    case 'bio': {
      if (!has(p.bio)) return { state: MISSING, note: 'no bio' }
      const v = validateField(spec.id, 'bio', p.bio)
      if (!v.ok) return { state: WARN, note: `${v.over} chars over the ${v.max} limit` }
      // The boilerplate cascade: a bio derived from a source text that has since
      // changed is stale until re-approved. Silence here would be the bug.
      if (p.bioStale) return { state: DRAFT, note: 'source text changed — re-approve' }
      return { state: OK, note: `${v.len}/${v.max}` }
    }
    case 'link':
      if (!has(p.link)) return { state: MISSING, note: 'no link' }
      return p.linkVerified === true
        ? { state: OK, note: p.link }
        : { state: WARN, note: `${p.link} — unverified` }
    case 'pinned': {
      if (!spec?.supports?.pinned) return na
      return has(p.pinned) ? { state: OK, note: `${p.pinned.length} planned` } : { state: MISSING, note: 'no pinned plan' }
    }
    case 'templates': {
      const t = doc?.content?.templates || {}
      const forPlatform = Object.keys(t).filter((k) => k.startsWith(`${spec.id}.`))
      return forPlatform.length ? { state: OK, note: `${forPlatform.length} templates` } : { state: MISSING, note: 'no templates' }
    }
    default:
      return na
  }
}

/** The whole matrix — every platform we know about, so untapped ones stay visible. */
export function matrix(doc) {
  return listPlatforms().map((s) => platformRow(doc, s.id))
}

// ── Readiness (all 7 layers) ──────────────────────────────────

const check = (id, label, ok) => ({ id, label, ok: !!ok })

/** Per-layer checklists. Deliberately explicit — this list IS the definition of
 *  "complete" for a brand, and it's the thing the deck's next-actions queue reads. */
export function layerChecks(doc) {
  const d = doc || {}
  const langs = d.voice?.languages?.length ? d.voice.languages : ['en']
  const bl = (lang) => d.voice?.boilerplates?.[lang] || {}

  const identity = [
    check('mark', 'Mark geometry', d.identity?.mark?.variants),
    check('palette', 'Palette roles', has(d.identity?.palette?.accent) && has(d.identity?.palette?.ink)),
    check('plate', 'Text plate colors', has(d.identity?.palette?.plateBg)),
    check('fonts', 'Fonts declared', has(d.identity?.fonts?.display)),
    check('embedded', 'Fonts embedded in engine', d.identity?.fonts?.embedded?.length),
    check('icons', 'Icon set', Object.keys(d.identity?.icons?.set || {}).length),
    check('motion', 'Motion rules', has(d.identity?.motion?.intro)),
    check('audio', 'Audio mark', has(d.identity?.audio?.sting)),
  ]
  const kb = [
    check('brandMd', 'BRAND.md', has(d.kb?.brandMd)),
    check('refs', 'Style-anchor refs', (d.kb?.refs || []).length >= 4),
    check('prompts', 'Generation briefs', Object.keys(d.kb?.prompts || {}).length),
  ]
  const voice = [
    check('persona', 'Persona card', has(d.voice?.persona?.title) && (d.voice?.persona?.adjectives || []).length),
    check('pillars', 'Content pillars', (d.voice?.pillars || []).length),
    ...langs.map((l) => check(`boiler.${l}`, `Boilerplates (${l})`,
      ['w25', 'w50', 'w100', 'w200'].every((k) => has(bl(l)[k])))),
    ...langs.map((l) => check(`tagline.${l}`, `Tagline (${l})`, has(d.voice?.taglines?.[l]))),
    check('hashtags', 'Hashtag banks', ['branded', 'category', 'community'].every((t) => (d.voice?.hashtags?.[t] || []).length)),
    check('ctas', 'CTA library', Object.keys(d.voice?.ctas || {}).length),
    check('touchy', 'Touchy rules', (d.voice?.touchyRules || []).length),
  ]
  const presenceCells = matrix(d).flatMap((r) => Object.values(r.cells)).filter((c) => c.state !== NA)
  const presence = presenceCells.map((c, i) => check(`cell${i}`, 'presence cell', c.state === OK))

  const content = [
    check('templates', 'Post templates', Object.keys(d.content?.templates || {}).length),
    check('caption', 'Caption formula', has(d.content?.captionFormula)),
    check('meta', 'Meta ad kit', Object.keys(d.content?.adKit?.meta || {}).length),
    check('google', 'Google ad kit', Object.keys(d.content?.adKit?.google || {}).length),
    check('og', 'OG template', has(d.content?.ogTemplate)),
  ]
  const discovery = [
    ...langs.map((l) => check(`seo.${l}`, `SEO meta (${l})`, has(d.discovery?.seo?.[l]?.titleTemplate))),
    ...langs.map((l) => check(`fact.${l}`, `Fact sheet (${l})`, (d.discovery?.factSheet?.[l] || []).length)),
    check('schema', 'schema.org JSON-LD', has(d.discovery?.schemaOrg)),
    check('llms', 'llms.txt', has(d.discovery?.llmsTxt)),
    check('keywords', 'Keyword map', (d.discovery?.keywords || []).length),
  ]
  const spine = [
    check('rhythm', 'Weekly rhythm', (d.spine?.rhythm || []).length),
    check('playbooks', 'Playbooks', Object.keys(d.spine?.playbooks || {}).length),
    check('tone', 'Tone calendar', (d.spine?.toneCalendar || []).length),
  ]
  return { identity, kb, voice, presence, content, discovery, spine }
}

const pct = (list) => (list.length ? Math.round((list.filter((c) => c.ok).length / list.length) * 100) : 0)

/**
 * Readiness for the layer strip + the bottom bar.
 * `next` is the honest "what to polish now" queue — the first unmet checks,
 * founder-facing, in layer order.
 */
export function readiness(doc) {
  const checks = layerChecks(doc)
  const layers = {}
  for (const l of LAYERS) {
    const list = checks[l.id] || []
    layers[l.id] = { n: l.n, label: l.label, lane: l.lane, pct: pct(list), done: list.filter((c) => c.ok).length, total: list.length }
  }
  const all = Object.values(checks).flat()
  const next = []
  for (const l of LAYERS) {
    for (const c of checks[l.id] || []) {
      if (!c.ok && c.label !== 'presence cell' && next.length < 3) next.push(`${l.n} ${c.label}`)
    }
  }
  return { layers, overall: pct(all), done: all.filter((c) => c.ok).length, total: all.length, next }
}

export { LANGUAGES, LAYERS }
