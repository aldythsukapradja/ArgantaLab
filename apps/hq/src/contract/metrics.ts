// Metric primitives shared by every surface.

export interface MetricPoint { t: string; v: number }

export interface MetricSeries {
  key: string
  label: string
  unit?: string
  points: MetricPoint[]
}

/** A node in the nested North-Star tree (portfolio -> product -> mini-app). */
export interface TreeNode {
  key: string
  label: string
  sub?: string
  value: number
  unit?: string
  deltaPct?: number
  adoptionPct?: number   // for mini-app loop contribution bars
  children?: TreeNode[]
}

/** A benchmarked tile in the Unicorn Scorecard. */
export interface ScorecardTile {
  key: string
  label: string
  value: number
  unit?: string
  benchmarkGreen: number
  benchmarkAmber: number
  higherBetter?: boolean
}

export type Verdict = 'hero' | 'core' | 'niche' | 'watch' | 'dead'

export interface AppHealth {
  appId: string
  name: string
  product: string
  category: string
  wau: number
  trend: number[]
  verdict: Verdict
}

export interface Rollup {
  product: string
  northStar: TreeNode
  scorecard: ScorecardTile[]
}

// ── Feature adoption (the keep/kill/propagate surface) ──
export interface FeatureAdoption {
  appId: string
  featureId: string
  label: string
  adoptionPct: number
  trend: 'up' | 'down' | 'flat'
  verdict: Verdict
}

// ── Economy (diamond source -> sink flow) ──
export interface EconomyLeg { label: string; amount: number }
export interface EconomyFlow {
  sources: EconomyLeg[]
  sinks: EconomyLeg[]
  float: number
  sinkCoverage: number   // spend / earn
}

// ── Audience (retention cohorts + stickiness) ──
export interface CohortRow {
  label: string
  d1: number
  d7: number
  d14: number | null
  d30: number | null
}
export interface AudienceData {
  cohorts: CohortRow[]
  dauMau: number
}
