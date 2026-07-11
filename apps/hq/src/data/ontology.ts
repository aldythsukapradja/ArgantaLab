import type { SchemaModel, Ontology, OntologyConcept } from './types'

// Deterministic ontology derived from the REAL schema (table + column names,
// FK shape). This is the v1 snapshot; the same `Ontology` shape is later filled
// by an LLM pass on demand — the dashboard just reads whatever snapshot exists.

const GLOSS: Record<string, string> = {
  id: 'Primary identifier',
  user_id: 'Owning learner',
  parent_id: 'Owning guardian',
  owner_id: 'Owning account',
  circle_id: 'Owning circle (family/kids/class/friends)',
  world_key: 'Subject world',
  skill_key: 'Skill within a world',
  created_at: 'When the row was created',
  updated_at: 'When the row was last modified',
  correct: 'Whether the answer was right',
  time_ms: 'Response time — confidence proxy',
  diamonds: 'In-app currency held',
  xp: 'Experience points earned',
  visibility: 'Sharing scope (private / circle / public)',
  plays: 'Times played',
  streak: 'Consecutive-day streak',
  mastery: 'Skill mastery 0–1',
  ring_pct: 'World completion ring %',
  status: 'Lifecycle state',
  kind: 'Row subtype / category',
  category: 'Content category',
  tags: 'Free-form labels',
  config: 'Opaque JSON configuration',
  payload: 'Opaque JSON event data',
  metadata: 'Opaque JSON metadata',
  featured: 'Curator-boosted in discovery',
  pinned: 'Curator hard-pin (always featured)',
  rating_avg: 'Average user rating',
  rating_count: 'Number of ratings',
  share_count: 'Times shared',
  view_count: 'Times viewed',
  reaction_count: 'Reactions received',
  tier: 'Rarity / power tier',
  level: 'Progression level',
  gold: 'Soft currency held',
  energy: 'Stamina / action resource',
  rank: 'Competitive rank score',
  audio_url: 'Stored SFX/music asset URL',
  duration_ms: 'Clip length in milliseconds',
}

// Ordered most-specific-prefix-first — table name families from newer surfaces
// (Lashira, Kingdom, Music Forge, Nexus, Kinetik native apps, Studio) each get
// their own bucket instead of falling into "Other".
const DOMAIN_RULES: [RegExp, string][] = [
  [/^hq_|^artifact_(telemetry|analytics)$|^featured_curator_log$|^valuation_snapshot$|^content_meta$/, 'Operator telemetry'],
  [/^lashira_|^pvp_rank$/, 'LashiraBloom (farming RPG)'],
  [/^kingdom_/, 'Kingdom of Kin (MMORPG)'],
  [/^nexus_|person_creatures/, 'Nexus (creature collection)'],
  [/^audio_|^music_/, 'Music Forge (audio)'],
  [/^pixel_/, 'Pixel asset pipeline'],
  [/^competition/, 'ArgantaCup (competitions)'],
  [/^kinetik_/, 'Kinetik (family social app)'],
  [/character_registry|shop_cosmetic|cosmetic_items|combat_tuning|mount_catalog|person_mounts|coop_(session|member)|^game_(versions|scores|saves)$/, 'Arganta Studio (creation & play)'],
  [/^games$/, 'Arganta Studio (creation & play)'],
  [/diamond_ledger|rank_points/, 'Economy'],
  [/profile|child|circle|guardian|avatar|friendship/, 'Identity & family'],
  [/attempt|mastery|progress|skill|quest|learn/, 'Learning activity'],
  [/world|item|stage|topic|strand|journey|badge|interaction/, 'Curriculum content'],
]

function domainOf(table: string): string {
  for (const [re, domain] of DOMAIN_RULES) if (re.test(table)) return domain
  return 'Other'
}

export function buildOntology(model: SchemaModel): Ontology {
  const byDomain = new Map<string, OntologyConcept[]>()

  for (const t of model.tables) {
    const dom = domainOf(t.name)
    if (!byDomain.has(dom)) byDomain.set(dom, [])
    const list = byDomain.get(dom)!
    // surface the table itself + its most meaningful columns
    list.push({
      concept: t.name.replace(/_/g, ' '),
      source: t.name,
      description: `${t.rows.toLocaleString()} rows · ${t.columns.length} columns`,
    })
    for (const c of t.columns) {
      if (c.pk || c.name === 'updated_at') continue
      const g = GLOSS[c.name]
      if (g) list.push({ concept: c.name, source: `${t.name}.${c.name}`, description: g })
    }
  }

  const order = [
    'Identity & family', 'Learning activity', 'Curriculum content', 'Arganta Studio (creation & play)',
    'LashiraBloom (farming RPG)', 'Kingdom of Kin (MMORPG)', 'Nexus (creature collection)',
    'Music Forge (audio)', 'Kinetik (family social app)', 'ArgantaCup (competitions)',
    'Pixel asset pipeline', 'Economy', 'Operator telemetry', 'Other',
  ]
  // Anything not in the curated order (shouldn't happen, but a renamed/new
  // domain string would otherwise vanish silently) still gets shown, appended
  // before "Other".
  const known = new Set(order)
  const extra = [...byDomain.keys()].filter((d) => !known.has(d))
  const domains = [...order.slice(0, -1), ...extra, 'Other']
    .filter((d) => byDomain.has(d))
    .map((d) => ({ domain: d, concepts: byDomain.get(d)!.slice(0, 10) }))

  return { domains, generatedAt: new Date().toISOString(), generatedBy: 'deterministic' }
}
