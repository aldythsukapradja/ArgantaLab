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

export interface AppHealth {
  appId: string
  name: string
  product: string
  category: string
  wau: number
  trend: number[]
  verdict: 'hero' | 'core' | 'niche' | 'watch' | 'dead'
}

export interface Rollup {
  product: string
  northStar: TreeNode
  scorecard: ScorecardTile[]
}
