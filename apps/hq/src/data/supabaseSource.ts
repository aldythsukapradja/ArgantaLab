// Real Supabase adapter. Reads live ArgantaLab data via the operator-only
// SECURITY DEFINER RPCs (in the unified supabase/schema.sql, "CIRCLE HQ"
// section) and overlays it onto the seed tree.
// Anything not yet wired falls back to mock, so the UI is never empty.
// "Contract-real": real where data exists, mock where it doesn't.

import type { HQDataSource } from './HQDataSource'
import type { Rollup } from '../contract/metrics'
import { supabase } from '../lib/supabase'
import { MockDataSource } from './mock'
import { MANIFESTS } from './seed'
import type { AppManifest } from '../contract/manifest'

const mock = new MockDataSource()

export class SupabaseDataSource implements HQDataSource {
  async listManifests(): Promise<AppManifest[]> {
    try {
      const { data, error } = await supabase.from('hq_app').select('*')
      if (error || !data || data.length === 0) return mock.listManifests()
      return data.map((r): AppManifest => ({
        id: r.id, name: r.name, product: r.product, category: r.category,
        status: r.status, owner: r.owner, metrics: r.metrics ?? undefined,
        economyHooks: r.economy_hooks ?? undefined, agentSurfaces: r.agent_surfaces ?? undefined,
      }))
    } catch { return mock.listManifests() }
  }

  async productNorthStars() { return mock.productNorthStars() }

  async portfolioRollup(product: string, days = 7): Promise<Rollup> {
    const base = await mock.portfolioRollup(product)
    try {
      const { data, error } = await supabase.rpc('hq_portfolio_rollup', { p_days: days })
      if (error || !data) return base
      const a = (data as any).arganta
      if (!a) return base
      // Overlay REAL ArgantaLab numbers onto the relevant node.
      const rollup: Rollup = structuredClone(base)
      if (product === 'arganta') {
        rollup.northStar.value = a.weeklyActiveLearners ?? rollup.northStar.value
      } else if (product === 'portfolio') {
        const argNode = rollup.northStar.children?.find((c) => c.key === 'arganta')
        if (argNode) argNode.value = a.weeklyActiveLearners ?? argNode.value
      }
      return rollup
    } catch { return base }
  }

  async appHealth() { return mock.appHealth() }   // real per-app needs the event bridge (P2)
  async signals() { return mock.signals() }

  /** P0 convenience: push the seed manifests into hq_app (operator only). */
  async seedManifests() {
    const rows = MANIFESTS.map((m) => ({
      id: m.id, name: m.name, product: m.product, category: m.category,
      status: m.status, owner: m.owner ?? null, metrics: m.metrics ?? null,
      economy_hooks: m.economyHooks ?? {}, agent_surfaces: m.agentSurfaces ?? null,
    }))
    return supabase.from('hq_app').upsert(rows)
  }
}
