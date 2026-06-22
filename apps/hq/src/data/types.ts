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
