// Pixel Vault engine — pure, deterministic query/facet/similarity over the
// catalogue. The viewer renders from these; the MCP Bridge exposes the same
// functions as tools. One implementation, two consumers → an agent and the UI
// can never disagree. Facet counts trust `verified` items by default so an agent
// surveying the landscape isn't misled by adapter-guessed rows.
import { CATALOGUE, catalogueById } from './catalogue'
import { PALETTES, paletteById } from './palettes'
import { USAGE } from './usage'
import { INGEST } from './ingest'
import { VOCAB, TIERS, SOURCES, tierForLicense } from './vocab'
import type { VaultItem, QueryFilter, Facets, FacetCount, Palette, UsageSite } from './types'

const isAnimated = (i: VaultItem) => i.animations.length > 0

function matches(i: VaultItem, f: QueryFilter): boolean {
  const c = i.curated
  if (f.domain && !c.domain.includes(f.domain)) return false
  if (f.kind && c.kind !== f.kind) return false
  if (f.theme && !c.theme.includes(f.theme)) return false
  if (f.characterType && c.characterType !== f.characterType) return false
  if (f.style && c.style !== f.style) return false
  if (f.groupId && c.groupId !== f.groupId) return false
  if (f.tier && i.source.tier !== f.tier) return false
  if (f.source && i.source.name !== f.source) return false
  if (f.canonical === true && i.status == null) return false
  if (f.canonical === false && i.status != null) return false
  if (f.animated != null && isAnimated(i) !== f.animated) return false
  if (!f.includeUnverified && !c.verified) return false
  if (f.q) {
    const hay = (i.id + ' ' + i.name + ' ' + c.tags.join(' ') + ' ' + c.domain.join(' ') + ' ' + c.theme.join(' ') + ' ' + c.kind).toLowerCase()
    if (!hay.includes(f.q.toLowerCase())) return false
  }
  return true
}

export interface QueryResult { total: number; offset: number; limit: number; items: VaultItem[] }
export function vaultQuery(f: QueryFilter = {}, data: VaultItem[] = CATALOGUE): QueryResult {
  const all = data.filter(i => matches(i, f))
  const offset = f.offset ?? 0
  const limit = f.limit ?? 60
  return { total: all.length, offset, limit, items: all.slice(offset, offset + limit) }
}

// distinct-value counts per field over the filtered set — the benchmarking view
export function vaultFacets(scope: QueryFilter = {}, data: VaultItem[] = CATALOGUE): Facets {
  const set = data.filter(i => matches(i, scope))
  const tally = (get: (i: VaultItem) => string[]): FacetCount[] => {
    const m = new Map<string, number>()
    for (const i of set) for (const v of get(i)) if (v) m.set(v, (m.get(v) ?? 0) + 1)
    return [...m.entries()].map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count)
  }
  return {
    scope,
    total: set.length,
    facets: {
      domain: tally(i => i.curated.domain),
      kind: tally(i => [i.curated.kind]),
      theme: tally(i => i.curated.theme),
      characterType: tally(i => (i.curated.characterType ? [i.curated.characterType] : [])),
      style: tally(i => (i.curated.style ? [i.curated.style] : [])),
      tier: tally(i => [i.source.tier]),
      source: tally(i => [i.source.name]),
      animated: tally(i => [isAnimated(i) ? 'animated' : 'static']),
    },
    honesty: scope.includeUnverified
      ? 'counts include adapter-guessed (unverified) items'
      : 'counts reflect curated.verified items only — pass includeUnverified to widen',
  }
}

export function vaultGet(id: string, data: VaultItem[] = CATALOGUE) {
  const item = data.find(i => i.id === id) ?? catalogueById(id)
  if (!item) return { error: `no vault item '${id}'`, hint: 'use vaultQuery to list ids' }
  return {
    item,
    tierPolicy: TIERS[item.source.tier],
    palette: item.form.paletteId ? paletteById(item.form.paletteId) ?? null : null,
    honesty: TIERS[item.source.tier].rule,
  }
}

// items sharing a group, else overlapping theme/style — pull a whole cast at once
export function vaultSimilar(id: string, limit = 12, data: VaultItem[] = CATALOGUE) {
  const seed = data.find(i => i.id === id) ?? catalogueById(id)
  if (!seed) return { error: `no vault item '${id}'` }
  const grouped = seed.curated.groupId ? data.filter(i => i.id !== id && i.curated.groupId === seed.curated.groupId) : []
  const scored = data.filter(i => i.id !== id && !grouped.includes(i)).map(i => {
    const themeOverlap = i.curated.theme.filter(t => seed.curated.theme.includes(t)).length
    const styleMatch = i.curated.style && i.curated.style === seed.curated.style ? 1 : 0
    const kindMatch = i.curated.kind === seed.curated.kind ? 1 : 0
    return { i, score: themeOverlap * 2 + styleMatch + kindMatch }
  }).filter(s => s.score > 0).sort((a, b) => b.score - a.score).map(s => s.i)
  return { seed: seed.id, group: grouped, similar: [...grouped, ...scored].slice(0, limit) }
}

// palette usedBy ≈ catalogue items sharing ≥2 colors (derived, not fabricated)
export function listPalettes(palettes: Palette[] = PALETTES, data: VaultItem[] = CATALOGUE): Palette[] {
  return palettes.map(p => {
    const cols = new Set(p.colors.map(c => c.toLowerCase()))
    const usedBy = data.filter(i => (i.form.swatch ?? []).filter(s => cols.has(s.toLowerCase())).length >= 2).length
    return { ...p, usedBy }
  })
}

// ---- usage coverage (the render-key x-ray) ---------------------------------
export interface UsageSummary { total: number; wired: number; placeholder: number; missing: number; pct: number; sites: UsageSite[]; orphans: VaultItem[] }
export function usageSummary(app?: UsageSite['app']): UsageSummary {
  const sites = USAGE.filter(s => !app || s.app === app)
  const wired = sites.filter(s => s.state === 'wired').length
  const placeholder = sites.filter(s => s.state === 'placeholder').length
  const missing = sites.filter(s => s.state === 'missing').length
  const referenced = new Set(USAGE.map(s => s.resolvedAssetId).filter(Boolean))
  const orphans = CATALOGUE.filter(i => i.status === 'published' && !referenced.has(i.id))
  return { total: sites.length, wired, placeholder, missing, pct: sites.length ? Math.round((wired / sites.length) * 100) : 0, sites, orphans }
}

export const ingestQueue = () => INGEST.filter(i => i.status === 'pending')

// the vocabulary an agent reads before tagging — keeps classifications consistent
export function vocabulary() {
  return { vocab: VOCAB, tiers: TIERS, sources: SOURCES, tierForLicense: 'license → tier via LICENSE_TIER map' }
}

export { TIERS, VOCAB } from './vocab'
export { tierForLicense }
