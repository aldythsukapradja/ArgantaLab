// ── Contract 1: AppManifest ──────────────────────────────────────────────
// Every app (KinetikCircle micro-app or ArgantaLab) self-describes here.
// Drop a manifest → the app appears in the portfolio with a generic health
// card automatically. This is the scalability spine.

export type Product = 'kinetik' | 'arganta' | (string & {})
export type AppStatus = 'live' | 'beta' | 'concept'
export type AppCategory =
  | 'games' | 'productivity' | 'social' | 'sports'
  | 'entertainment' | 'learning' | 'platform'

export interface FeatureNode { id: string; label: string }
export interface FeatureTab { id: string; label: string; features: FeatureNode[] }

export interface EconomyHooks { earn?: string[]; sink?: string[] }

export interface AppManifest {
  id: string
  name: string
  product: Product
  category: AppCategory
  status: AppStatus
  audience?: string[]
  circleTypes?: string[]
  owner?: string
  metrics?: string[]
  economyHooks?: EconomyHooks
  agentSurfaces?: string[]
  featureMap?: FeatureTab[]
}

// ProductNorthStar is recursive: a mini-app rolls into a product, a product
// rolls into the portfolio meta (parent === undefined at the root).
export interface ProductNorthStar {
  product: string
  label: string
  formula: string
  inputMetricKeys: string[]
  parent?: string
}
