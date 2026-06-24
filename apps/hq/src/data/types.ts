// Shapes returned by the live RPCs. Nothing here is seeded — every value
// originates from the real Supabase catalog or real aggregates.

export interface ColumnDef {
  name: string
  type: string
  pk: boolean
  /** referenced table name when this column is a foreign key, else null */
  fk: string | null
}

export interface TableNode {
  name: string
  rows: number
  columns: ColumnDef[]
}

export interface Relationship {
  from: string
  fromCol: string
  to: string
  toCol: string
}

export interface SchemaModel {
  tables: TableNode[]
  relationships: Relationship[]
  generatedAt: string
}

export interface SchemaInsights {
  learners: number
  kids: number
  attemptsTotal: number
  attempts7d: number
  activeLearners7d: number
  accuracyPct: number | null
  gamesTotal: number
  gamesPublic: number
  diamondsFloat: number
  worldsLive: number
  itemsLive: number
  circles: number
  generatedAt: string
}

export interface OntologyConcept {
  concept: string
  source: string
  description: string
}

export interface OntologyDomain {
  domain: string
  concepts: OntologyConcept[]
}

export interface Ontology {
  domains: OntologyDomain[]
  generatedAt?: string
  generatedBy?: string
}

// ── Content richness (world × stage coverage matrix) ──
export interface ContentStage {
  key: string
  label: string
  minAge: number
  maxAge: number
  order: number
}

export interface ContentWorld {
  key: string
  name: string
  order: number
}

export interface ContentCell {
  world: string
  stage: string
  authored: number
  live: number
  interactions: number      // distinct interaction types present
  rungs: number             // distinct difficulty rungs present
  skills: number            // distinct skills present
  lastUpdated: string | null
}

export interface ContentMatrix {
  stages: ContentStage[]
  worlds: ContentWorld[]
  cells: ContentCell[]
  totals: { authored: number; live: number }
  generatedAt: string
}

// ── Growth analytics (Pulse + Audience merged) ──
export interface GrowthPoint { week: string; value: number }
export interface GrowthOverview {
  northStar: GrowthPoint[]
  dau: number
  wau: number
  mau: number
  stickiness: number | null   // DAU/MAU %
  wauPrev: number
  wowPct: number | null       // WAU week-over-week %
  depth: number               // attempts per active (7d)
  accuracyPct: number | null
  newLearners7d: number
  newWowPct: number | null
  learners: number
  attempts7d: number
  attemptsTotal: number
  generatedAt: string
}

export interface RetentionCohort {
  label: string
  size: number
  ret: (number | null)[]   // % active per week-since-signup, null = not elapsed
}
export interface RetentionData {
  horizons: string[]       // ['W0','W1','W2','W3','W4']
  cohorts: RetentionCohort[]
  generatedAt: string
}
