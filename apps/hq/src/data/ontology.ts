import type { SchemaModel, Ontology, OntologyConcept } from './types'

// Deterministic ontology derived from the REAL schema (table + column names,
// FK shape). This is the v1 snapshot; the same `Ontology` shape is later filled
// by an LLM pass on demand — the dashboard just reads whatever snapshot exists.

const GLOSS: Record<string, string> = {
  id: 'Primary identifier',
  user_id: 'Owning learner',
  parent_id: 'Owning guardian',
  owner_id: 'Owning account',
  world_key: 'Subject world',
  skill_key: 'Skill within a world',
  created_at: 'When the row was created',
  correct: 'Whether the answer was right',
  time_ms: 'Response time — confidence proxy',
  diamonds: 'In-app currency held',
  xp: 'Experience points earned',
  visibility: 'Sharing scope (private / circle / public)',
  plays: 'Times played',
  streak: 'Consecutive-day streak',
  mastery: 'Skill mastery 0–1',
  ring_pct: 'World completion ring %',
}

function domainOf(table: string): string {
  if (/profile|child|circle|guardian|avatar/.test(table)) return 'Identity & family'
  if (/attempt|mastery|progress|skill|quest|learn/.test(table)) return 'Learning activity'
  if (/game/.test(table)) return 'Creation & play'
  if (/world|item|stage|topic|strand|journey|badge|interaction/.test(table)) return 'Curriculum content'
  if (/hq_/.test(table)) return 'Operator telemetry'
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

  const order = ['Identity & family', 'Learning activity', 'Creation & play', 'Curriculum content', 'Operator telemetry', 'Other']
  const domains = order
    .filter((d) => byDomain.has(d))
    .map((d) => ({ domain: d, concepts: byDomain.get(d)!.slice(0, 8) }))

  return { domains, generatedAt: new Date().toISOString(), generatedBy: 'deterministic' }
}
