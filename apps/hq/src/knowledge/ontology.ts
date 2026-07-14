// WS3 — the 24-type knowledge ontology as a DISPLAY layer over real vault notes.
//
// NOTE: `apps/hq/src/data/ontology.ts` is the DB-schema ontology (table/column
// semantics) — NOT this. The 24 types below are the architecture-storytelling
// ontology from the WS3/WS4 spec. Vault notes are keyed by their own `NoteType`;
// we DERIVE an ontology type here for colour/shape, we never re-key the notes.

import type { VaultNote } from '../vault/types'

export type OntologyType =
  | 'Founder' | 'North Star' | 'Strategy' | 'Product' | 'Surface' | 'Document'
  | 'Decision' | 'Metric' | 'Signal' | 'Data Source' | 'Database' | 'Table'
  | 'API' | 'Repository' | 'Architecture' | 'Agent' | 'Office' | 'Skill'
  | 'Tool' | 'Workflow' | 'Task' | 'Artifact' | 'Approval' | 'Deployment'

// One colour per ontology type. Warm identity hues for the human/strategy layer,
// cool blues for data, greens for build, ambers/violets for the agentic layer —
// a spectrum the founder can read at a glance and that harmonises with the
// reactor + vault palettes.
export const ONTOLOGY_COLOR: Record<OntologyType, string> = {
  Founder: '#f5c451',       // gold — the human at the root
  'North Star': '#f0a24b',  // ember
  Strategy: '#f472b6',      // rose
  Product: '#8b7cf6',       // iris
  Surface: '#a78bfa',       // violet
  Document: '#94a3b8',      // slate
  Decision: '#fb7185',      // coral
  Metric: '#22d3ee',        // cyan
  Signal: '#38bdf8',        // sky
  'Data Source': '#0ea5e9', // blue
  Database: '#2563eb',      // deep blue
  Table: '#3b82f6',         // blue
  API: '#06b6d4',           // teal
  Repository: '#14b8a6',    // teal-green
  Architecture: '#4ade80',  // jade
  Agent: '#eab308',         // amber — agentic
  Office: '#facc15',        // yellow
  Skill: '#c084fc',         // purple
  Tool: '#a3e635',          // lime
  Workflow: '#34d399',      // emerald
  Task: '#84cc16',          // green
  Artifact: '#fbbf24',      // amber
  Approval: '#f97316',      // orange
  Deployment: '#ef4444',    // red — distribution edge
}

// Visual "family" → drives node geometry in the scene (spheres vs crystals vs
// rings) so the ontology reads spatially as well as by colour.
export type OntologyFamily = 'human' | 'strategy' | 'data' | 'build' | 'agentic'

export const ONTOLOGY_FAMILY: Record<OntologyType, OntologyFamily> = {
  Founder: 'human', 'North Star': 'human', Office: 'human',
  Strategy: 'strategy', Decision: 'strategy', Product: 'strategy', Surface: 'strategy', Document: 'strategy',
  Metric: 'data', Signal: 'data', 'Data Source': 'data', Database: 'data', Table: 'data', API: 'data',
  Repository: 'build', Architecture: 'build', Tool: 'build', Deployment: 'build', Artifact: 'build',
  Agent: 'agentic', Skill: 'agentic', Workflow: 'agentic', Task: 'agentic', Approval: 'agentic',
}

/** Derive an ontology type from a real vault note. Deterministic; keys off the
 *  note id conventions + frontmatter type/tags (the same signals the vault's own
 *  layer-attribution uses). Falls back to Document — never invents authority. */
export function deriveOntologyType(note: VaultNote): OntologyType {
  const id = String(note?.id || '').toLowerCase()
  const fm = note?.fm || ({} as VaultNote['fm'])
  const t = String(fm.type || '')
  const tags = (Array.isArray(fm.tags) ? fm.tags : []).map((s) => String(s).toLowerCase())
  const has = (...xs: string[]) => xs.some((x) => tags.includes(x))

  // id-convention families (the atomised graph nodes)
  if (id.startsWith('tbl-')) return 'Table'
  if (id.startsWith('dep-')) return 'Tool'
  if (id.startsWith('l1-') || id === 'database-is-the-only-source-of-truth') return 'Database'
  if (id.startsWith('l0-')) return 'Tool'
  if (id.startsWith('l2-') || id.startsWith('l3-')) return 'Architecture'
  if (id.startsWith('l4-')) return 'Artifact'
  if (id.startsWith('l5-') || id === 'p5-hq-command') return 'Agent'
  if (id.startsWith('l6-')) return 'Document'
  if (id.startsWith('l7-')) return 'Deployment'
  if (id.startsWith('northstar') || id.includes('north-star') || id.includes('northstar')) return 'North Star'

  // frontmatter type
  if (t === 'decision') return 'Decision'
  if (t === 'strategy') return 'Strategy'
  if (t === 'prompt') return 'Workflow'
  if (t === 'spec' || t === 'plan') return 'Architecture'
  if (t === 'research') return 'Signal'

  // governance / command → the Command Core region (via Founder/Office types)
  if (id.includes('founder') || has('founder')) return 'Founder'
  if (id === 'hq' || id === 'p5-hq-command' || id.includes('command') || has('ceo', 'bridge', 'governance', 'command', 'office')) return 'Office'
  // tag / keyword heuristics
  if (has('supabase', 'schema', 'rpc', 'data')) return 'Data Source'
  if (has('api')) return 'API'
  if (has('agent', 'agentic')) return 'Agent'
  if (has('metric', 'kpi', 'growth')) return 'Metric'
  if (has('deploy', 'distribution', 'vercel', 'launch')) return 'Deployment'
  if (has('product') || id.includes('product') || id.includes('roadmap')) return 'Product'
  if (has('surface', 'ui', 'app', 'ux')) return 'Surface'

  return 'Document'
}
