// Pixel Vault tools for The Bridge — the deterministic agent surface over the
// catalogue. Reuses the HQ engine (apps/hq/src/data/pixel/*) with zero rebuild,
// same read-only/provenance discipline as the org tools. This is what lets an
// agent (e.g. Claude Code briefing PixelLab) query the vault before generating.
import {
  vaultQuery, vaultFacets, vaultGet, vaultSimilar, listPalettes, usageSummary, vocabulary,
} from '../../hq/src/data/pixel/engine'
import type { QueryFilter } from '../../hq/src/data/pixel/types'

export function pixelQuery(f: QueryFilter) {
  const r = vaultQuery(f)
  return {
    total: r.total, offset: r.offset, limit: r.limit,
    items: r.items.map(i => ({
      id: i.id, name: i.name, tier: i.source.tier, license: i.source.license, shippable: i.source.tier === 'T0',
      domain: i.curated.domain, kind: i.curated.kind, characterType: i.curated.characterType,
      theme: i.curated.theme, style: i.curated.style, group: i.curated.groupId,
      size: `${i.form.size.w}x${i.form.size.h}`, animations: i.animations.map(a => a.name),
      source: i.source.name, url: i.source.url, tags: i.curated.tags,
    })),
    honesty: 'tier T0 = ship as-is (CC0), T1 = reference-only (attribution), T2 = do-not-use (proprietary).',
  }
}

export const pixelFacets = (scope: QueryFilter) => vaultFacets(scope)
export const pixelGet = (id: string) => vaultGet(id)
export const pixelSimilar = (id: string) => vaultSimilar(id)
export const pixelVocab = () => vocabulary()
export function pixelPalettes() { return { palettes: listPalettes() } }
export function pixelUsage() {
  const s = usageSummary()
  return { pct: s.pct, wired: s.wired, placeholder: s.placeholder, missing: s.missing, total: s.total, sites: s.sites, orphans: s.orphans.map(o => o.id) }
}
