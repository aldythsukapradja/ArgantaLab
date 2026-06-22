// ── The seam ──────────────────────────────────────────────────────────────
// UI only ever talks to this interface. MockDataSource implements it with
// seed data; SupabaseDataSource implements it against the real project.
// Swapping mock -> live changes one line in index.ts, not the UI.

import type { AppManifest, ProductNorthStar } from '../contract/manifest'
import type { Rollup, AppHealth, FeatureAdoption, EconomyFlow, AudienceData } from '../contract/metrics'
import type { Signal } from '../contract/signals'

export interface HQDataSource {
  listManifests(): Promise<AppManifest[]>
  productNorthStars(): Promise<ProductNorthStar[]>
  portfolioRollup(product: string, days?: number): Promise<Rollup>
  appHealth(days?: number): Promise<AppHealth[]>
  signals(days?: number): Promise<Signal[]>
  featureAdoption(appId: string): Promise<FeatureAdoption[]>
  economyFlow(): Promise<EconomyFlow>
  audience(): Promise<AudienceData>
}
