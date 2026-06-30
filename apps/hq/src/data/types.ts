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
/** One activity type (journey, quest, drill, …) over the trailing 30 days. */
export interface ActivityKind { kind: string; events: number; actives: number }
export interface GrowthOverview {
  northStar: GrowthPoint[]
  dau: number
  wau: number
  mau: number
  stickiness: number | null   // DAU/MAU %
  wauPrev: number
  wowPct: number | null       // WAU week-over-week %
  depth: number               // activity events per active (7d)
  accuracyPct: number | null
  newLearners7d: number
  newWowPct: number | null
  learners: number
  attempts7d: number
  attemptsTotal: number
  activityMix?: ActivityKind[]  // earn-activity events by type, last 30d (v2 RPC)
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

// ── Portfolio · VC scorecard (cross-cutting AARRR + flywheel) ──
export interface PortfolioVc {
  activationRate: number | null      // % signups acting within 48h
  lessonsCompleted7d: number
  lessonsCompletedTotal: number
  lessonsPerKidDay: number | null    // lessons completed per active kid per day (7d avg)
  screenMinPerKidDay: number | null  // estimated screen-time minutes per active kid per day (7d)
  returnRate: number | null          // % of >30d-old accounts still active (retention proxy)
  d1Retention: number | null         // next-day comeback rate over last 14d (daily retention)
  d1Sample: number                   // active-day observations behind d1Retention
  spentPerActiveKid: number | null   // diamonds spent / active kid (30d) — pay-intent proxy
  familiesTotal: number
  flywheelCount: number              // circles containing an active learner
  invitesSent: number
  invitesAccepted: number
  kFactor: number | null             // accepted invites per inviter
  generatedAt: string
}

export interface FunnelStage { stage: string; count: number }
export interface AcquisitionData {
  funnel: FunnelStage[]
  newWeekly: GrowthPoint[]
  generatedAt: string
}

export interface EconomyLeg { kind: string; amount: number; flow?: 'mint' | 'sink' }
export interface MintBurnPoint { week: string; mint: number; burn: number }
export interface EconomyData {
  float: number
  minted: number
  spent: number
  starterGrant?: number      // one-time onboarding grants (v2 RPC)
  recurringMinted?: number   // minted minus the starter floor (v2 RPC)
  gifted: number
  coverage: number | null    // spent / recurring-mint % (v2) — meaningful sink coverage
  sources: EconomyLeg[]
  mintBurn?: MintBurnPoint[]  // weekly mint vs burn, starter excluded (v2 RPC)
  ledgerRows: number
  generatedAt: string
}
