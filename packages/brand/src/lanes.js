// LANES — the governance seam of the Brand OS.
//
// The founder's rule: visuals and templates may ONLY be changed by coding
// agents (Claude Code / Codex / MCP); text may be edited by the founder in HQ
// and saved to the database.
//
// This file is where that rule becomes mechanical rather than honour-system:
//
//   agent lane   → lives in git (packages/brand/brands/<id>/brand.json + assets)
//                  HQ renders it READ-ONLY; there is no edit affordance at all.
//   founder lane → lives in Supabase (brand_registry.overlay jsonb)
//                  HQ edits it live; agents may also patch it via MCP.
//
// Because the two lanes live in two different STORES, the boundary can't be
// crossed by accident: HQ has no write path into git, and the DB overlay is
// validated against `canEdit(path, 'founder')` before it is accepted.
//
// Layer → lane map (see knowledge-base/brand/brand-os.md):
//   L0   identity   agent    marks, palette, plates, fonts, icons, motion, audio
//   L0.5 kb         agent    brand.md, refs, generation prompts
//   L1   voice      founder  persona, boilerplates, hashtags, CTAs, touchy rules
//   L2   presence   mixed    assets = agent · handle/bio/link/pinned = founder
//   L3   content    agent    post/story templates, caption formulas, ad kit
//   L4   discovery  mixed    og/schema assets = agent · fact sheet/keywords = founder
//   L5   spine      founder  rhythm, playbooks, tone calendar

export const AGENT = 'agent'
export const FOUNDER = 'founder'
export const MIXED = 'mixed'

/** Top-level layer → lane. `mixed` layers resolve per-field below. */
export const LAYER_LANES = Object.freeze({
  identity: AGENT,
  kb: AGENT,
  voice: FOUNDER,
  presence: MIXED,
  content: AGENT,
  discovery: MIXED,
  spine: FOUNDER,
  // Routing (buffer channel, moment sender) is infrastructure wiring, not text.
  routing: AGENT,
  // Identity facts about the doc itself.
  id: AGENT,
  name: AGENT,
  status: AGENT,
})

/** Within `presence.<platform>.<field>` these are rendered artwork → agent lane. */
const PRESENCE_AGENT_FIELDS = new Set(['avatar', 'banner', 'highlights', 'pinnedCovers'])

/** Within `discovery.<field>` these are generated artwork → agent lane. */
const DISCOVERY_AGENT_FIELDS = new Set(['ogImage', 'schemaOrg'])

/**
 * Which lane owns a dotted field path?
 *   laneFor('identity.palette.accent')        → 'agent'
 *   laneFor('voice.boilerplates.en.w50')      → 'founder'
 *   laneFor('presence.instagram.avatar')      → 'agent'
 *   laneFor('presence.instagram.bio')         → 'founder'
 *   laneFor('discovery.factSheet')            → 'founder'
 */
export function laneFor(path) {
  const parts = String(path || '').split('.').filter(Boolean)
  if (!parts.length) return AGENT
  const layer = parts[0]
  const lane = LAYER_LANES[layer]
  if (lane === undefined) return AGENT // unknown → safest lane (founder can't touch it)
  if (lane !== MIXED) return lane

  if (layer === 'presence') {
    // presence.<platform>.<field>
    const field = parts[2]
    if (!field) return MIXED
    return PRESENCE_AGENT_FIELDS.has(field) ? AGENT : FOUNDER
  }
  if (layer === 'discovery') {
    const field = parts[1]
    if (!field) return MIXED
    return DISCOVERY_AGENT_FIELDS.has(field) ? AGENT : FOUNDER
  }
  return MIXED
}

/**
 * Can `actor` edit this path?
 * Agents are the superuser — they own git and may also patch the founder lane
 * via MCP. The founder is barred from the agent lane; that's the whole rule.
 */
export function canEdit(path, actor) {
  if (actor === AGENT) return true
  return laneFor(path) === FOUNDER
}

/** Throw with a useful message when an edit crosses the line. Used by the
 *  MCP brand_update tool and by whatever writes the DB overlay. */
export function assertEditable(path, actor) {
  if (canEdit(path, actor)) return
  throw new Error(
    `"${path}" is agent-lane — it lives in git (packages/brand/) and can only be changed ` +
    `through Claude Code, Codex or MCP. The founder lane covers text: voice, spine, ` +
    `platform handles/bios/links and discovery copy.`,
  )
}

/** Every dotted leaf path in an object (arrays are treated as leaves). */
export function leafPaths(obj, prefix = '') {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) return prefix ? [prefix] : []
  const out = []
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(...leafPaths(v, p))
    else out.push(p)
  }
  return out
}

/**
 * Validate a founder-lane overlay before it reaches the database. Returns the
 * offending paths (empty array = clean). The DB should never hold agent-lane
 * fields — if it did, git and the overlay would fight over the same value and
 * the merge would silently pick a winner.
 */
export function illegalOverlayPaths(overlay) {
  return leafPaths(overlay).filter(p => !canEdit(p, FOUNDER))
}
