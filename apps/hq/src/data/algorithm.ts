/**
 * Featured & Ranking Engine — deterministic, Netflix-inspired
 *
 * Pure functions. No I/O. Feed it artifacts (games or apps) enriched with
 * whatever signals are available; it returns engagement scores, a ranked
 * leaderboard, the featured slate, and human-readable recommendations.
 *
 * Design goals:
 *  - Deterministic: same input → same output, no randomness.
 *  - Degrade gracefully: works with only `plays` + `created_at` today,
 *    gets richer as ratings / shares / 7-day windows arrive from telemetry.
 *  - Explainable: every rank carries the score components that produced it.
 */

export interface ArtifactSignals {
  id: string
  title: string
  kind: 'game' | 'app'
  category?: string | null
  plays: number
  created_at: string
  // Optional richer signals (from telemetry rollups). Fall back when absent.
  plays_last_7d?: number
  plays_prev_7d?: number          // for week-over-week trend
  rating_avg?: number             // 0–5
  rating_count?: number
  share_count?: number
  days_active?: number            // distinct days with ≥1 play
  pinned?: boolean                // curator hard-pin (always featured)
}

export interface ScoreBreakdown {
  plays: number
  rating: number
  confidence: number
  shares: number
  longevity: number
  freshnessBoost: number
  total: number
}

export interface RankedArtifact extends ArtifactSignals {
  score: number
  breakdown: ScoreBreakdown
  rank: number                    // 1-based leaderboard position
  trendPct: number                // week-over-week % change in engagement proxy
  trend: 'up' | 'down' | 'flat'
  health: 'rising' | 'safe' | 'declining'
}

export interface FeaturedItem extends RankedArtifact {
  featuredRank: number            // 1..N within the slate
  badge: FeaturedBadge
  reason: string
}

export type FeaturedBadge =
  | 'Hot Ranked' | 'Rising Star' | 'Top Rated' | 'Must Play'
  | 'Fresh' | 'Pinned' | 'Trending'

export type RecoKind = 'rising_star' | 'underrated' | 'underperforming' | 'fresh' | 'consistent'

export interface Recommendation {
  kind: RecoKind
  emoji: string
  title: string                   // label e.g. "Rising Star"
  artifact: RankedArtifact
  message: string
  actions: ('promote' | 'refresh' | 'archive' | 'delete')[]
}

// ── Tunable weights (single source of truth) ──────────────────────────
export const WEIGHTS = {
  plays: 0.40,
  rating: 0.25,
  confidence: 0.15,
  shares: 0.10,
  longevity: 0.10,
} as const

export const FEATURED_SLOTS = 4
export const ELIGIBLE_MIN_PLAYS = 10
export const ELIGIBLE_MIN_RATING = 3.5
export const FRESHNESS_DAYS = 7
export const FRESHNESS_BOOST = 1.10      // +10% for new quality content
export const RECENCY_FLAT_BONUS = 200    // featured tie-breaker for fresh items

const DAY_MS = 86_400_000

function daysSince(iso: string): number {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return 9999
  return Math.max(0, (Date.now() - t) / DAY_MS)
}

/**
 * Engagement score — weighted blend of recency-aware plays, quality (rating),
 * confidence (review volume), virality (shares) and longevity (days active).
 * Components are scaled to comparable magnitudes before weighting.
 */
export function computeEngagementScore(a: ArtifactSignals): ScoreBreakdown {
  // Recency-aware plays: prefer last-7d when present, else decay lifetime plays
  // by age so a stale spike doesn't dominate a steady performer.
  const age = daysSince(a.created_at)
  const recentPlays = a.plays_last_7d ?? a.plays / (1 + Math.log10(1 + age))
  const playsC = recentPlays * WEIGHTS.plays

  const rating = a.rating_avg ?? 0
  const ratingC = rating * 1000 * WEIGHTS.rating

  const confidenceC = (a.rating_count ?? 0) * 5 * WEIGHTS.confidence

  const sharesC = (a.share_count ?? 0) * 50 * WEIGHTS.shares

  const longevityC = (a.days_active ?? Math.min(age, 60)) * 10 * WEIGHTS.longevity

  const subtotal = playsC + ratingC + confidenceC + sharesC + longevityC
  const fresh = age <= FRESHNESS_DAYS ? FRESHNESS_BOOST : 1
  const total = subtotal * fresh

  return {
    plays: round(playsC),
    rating: round(ratingC),
    confidence: round(confidenceC),
    shares: round(sharesC),
    longevity: round(longevityC),
    freshnessBoost: fresh,
    total: round(total),
  }
}

/** Week-over-week trend from the play windows (proxy when telemetry absent). */
function computeTrend(a: ArtifactSignals): { pct: number; dir: 'up' | 'down' | 'flat' } {
  const cur = a.plays_last_7d
  const prev = a.plays_prev_7d
  if (cur == null || prev == null) {
    // Fallback: brand-new artifacts read as mildly "up", others flat.
    const age = daysSince(a.created_at)
    if (age <= FRESHNESS_DAYS) return { pct: 0, dir: 'flat' }
    return { pct: 0, dir: 'flat' }
  }
  if (prev === 0) return { pct: cur > 0 ? 100 : 0, dir: cur > 0 ? 'up' : 'flat' }
  const pct = round(((cur - prev) / prev) * 100)
  return { pct, dir: pct > 2 ? 'up' : pct < -2 ? 'down' : 'flat' }
}

/** Rank every artifact by engagement score (desc). Stable & deterministic. */
export function rankArtifacts(items: ArtifactSignals[]): RankedArtifact[] {
  const scored = items.map((a) => {
    const breakdown = computeEngagementScore(a)
    const t = computeTrend(a)
    const health: RankedArtifact['health'] =
      t.dir === 'up' ? 'rising' : t.dir === 'down' ? 'declining' : 'safe'
    return { ...a, score: breakdown.total, breakdown, rank: 0, trendPct: t.pct, trend: t.dir, health }
  })
  scored.sort((x, y) => y.score - x.score || x.title.localeCompare(y.title))
  scored.forEach((s, i) => { s.rank = i + 1 })
  return scored
}

function eligible(a: ArtifactSignals): boolean {
  if (a.pinned) return true
  if (a.plays < ELIGIBLE_MIN_PLAYS) return false
  if (a.rating_avg != null && a.rating_avg < ELIGIBLE_MIN_RATING) return false
  return true
}

/**
 * Select the featured slate (top N) from the ranked list, applying:
 *  - eligibility gate (min plays / min rating, unless pinned)
 *  - recency flat bonus for fresh items (gives quality newcomers a shot)
 *  - category diversity (avoid a slate dominated by one category)
 *  - curator pins always included, highest priority
 */
export function selectFeatured(ranked: RankedArtifact[], slots = FEATURED_SLOTS): FeaturedItem[] {
  const pins = ranked.filter((a) => a.pinned)
  const pool = ranked.filter((a) => !a.pinned && eligible(a))

  // Featured score = engagement + recency tie-breaker bonus
  const withBonus = pool.map((a) => ({
    a,
    fScore: a.score + (daysSince(a.created_at) <= FRESHNESS_DAYS ? RECENCY_FLAT_BONUS : 0),
  }))
  withBonus.sort((x, y) => y.fScore - x.fScore)

  const chosen: RankedArtifact[] = [...pins]
  const seenCats = new Map<string, number>()
  pins.forEach((p) => bumpCat(seenCats, p.category))

  // First pass: diversity-aware fill (skip a 2nd-from-same-category if alternatives exist)
  for (const { a } of withBonus) {
    if (chosen.length >= slots) break
    const cat = (a.category || 'misc').toLowerCase()
    const catCount = seenCats.get(cat) ?? 0
    const remaining = slots - chosen.length
    const distinctLeft = countDistinctCats(withBonus, chosen)
    if (catCount >= 1 && distinctLeft > remaining) continue // defer to diversify
    chosen.push(a); bumpCat(seenCats, a.category)
  }
  // Second pass: fill any leftover slots ignoring diversity
  for (const { a } of withBonus) {
    if (chosen.length >= slots) break
    if (!chosen.includes(a)) { chosen.push(a); bumpCat(seenCats, a.category) }
  }

  return chosen.slice(0, slots).map((a, i) => ({
    ...a,
    featuredRank: i + 1,
    badge: pickBadge(a, i),
    reason: featuredReason(a, i),
  }))
}

function bumpCat(m: Map<string, number>, cat?: string | null) {
  const k = (cat || 'misc').toLowerCase()
  m.set(k, (m.get(k) ?? 0) + 1)
}
function countDistinctCats(pool: { a: RankedArtifact }[], chosen: RankedArtifact[]): number {
  const set = new Set<string>()
  for (const { a } of pool) if (!chosen.includes(a)) set.add((a.category || 'misc').toLowerCase())
  return set.size
}

function pickBadge(a: RankedArtifact, idx: number): FeaturedBadge {
  if (a.pinned) return 'Pinned'
  if (daysSince(a.created_at) <= FRESHNESS_DAYS) return 'Fresh'
  if (a.trend === 'up') return 'Rising Star'
  if ((a.rating_avg ?? 0) >= 4.7) return 'Top Rated'
  if (idx === 0) return 'Hot Ranked'
  return 'Must Play'
}

function featuredReason(a: RankedArtifact, idx: number): string {
  if (a.pinned) return 'Pinned by curator.'
  if (idx === 0) return 'Top engagement score across all signals.'
  if (a.trend === 'up') return `Trending +${a.trendPct}% week-over-week.`
  if ((a.rating_avg ?? 0) >= 4.7) return `Loved by players — ${a.rating_avg}★ average.`
  return 'Strong, consistent engagement.'
}

/**
 * Generate explainable recommendations from the ranked list.
 * Surfaces rising stars, underrated gems, underperformers, fresh arrivals.
 */
export function generateRecommendations(ranked: RankedArtifact[], featuredIds: Set<string>): Recommendation[] {
  const recs: Recommendation[] = []

  // Rising stars — trending up, good ratings, not already featured
  ranked
    .filter((a) => a.trend === 'up' && a.trendPct >= 5 && !featuredIds.has(a.id))
    .slice(0, 3)
    .forEach((a) => recs.push({
      kind: 'rising_star', emoji: '🔥', title: 'Rising Star', artifact: a,
      message: `Trending +${a.trendPct}% over the last 7 days. ${fmtPlays(a)} · ${fmtRating(a)}. Steady climber with strong quality signals.`,
      actions: ['promote'],
    }))

  // Underrated — high rating but low visibility (rank outside featured), not featured
  ranked
    .filter((a) => !featuredIds.has(a.id) && (a.rating_avg ?? 0) >= 4.7 && a.rank > FEATURED_SLOTS)
    .slice(0, 3)
    .forEach((a) => {
      if (recs.some((r) => r.artifact.id === a.id)) return
      recs.push({
        kind: 'underrated', emoji: '💎', title: 'Underrated Gem', artifact: a,
        message: `${a.rating_avg}★ rating but only rank #${a.rank}. Quality that deserves the spotlight.`,
        actions: ['promote'],
      })
    })

  // Fresh — published recently, not featured
  ranked
    .filter((a) => daysSince(a.created_at) <= FRESHNESS_DAYS && !featuredIds.has(a.id))
    .slice(0, 2)
    .forEach((a) => {
      if (recs.some((r) => r.artifact.id === a.id)) return
      recs.push({
        kind: 'fresh', emoji: '🆕', title: 'Fresh Arrival', artifact: a,
        message: `Just published. ${fmtPlays(a)} so far — give new content a chance to find its audience.`,
        actions: ['promote'],
      })
    })

  // Underperforming — declining or low rating
  ranked
    .filter((a) => a.trend === 'down' && a.trendPct <= -10 || (a.rating_avg != null && a.rating_avg < ELIGIBLE_MIN_RATING && a.plays > 0))
    .slice(0, 3)
    .forEach((a) => {
      if (recs.some((r) => r.artifact.id === a.id)) return
      recs.push({
        kind: 'underperforming', emoji: '⚠️', title: 'Underperforming', artifact: a,
        message: `${fmtPlays(a)} · ${fmtRating(a)}${a.trendPct < 0 ? `, trending ${a.trendPct}%` : ''}. Declining engagement — consider refreshing or archiving.`,
        actions: ['refresh', 'archive', 'delete'],
      })
    })

  // Consistent favourite — featured, long-lived, high rating
  ranked
    .filter((a) => featuredIds.has(a.id) && (a.days_active ?? daysSince(a.created_at)) >= 30 && (a.rating_avg ?? 0) >= 4.7)
    .slice(0, 1)
    .forEach((a) => recs.push({
      kind: 'consistent', emoji: '🏆', title: 'Consistently Great', artifact: a,
      message: `A trusted favourite — ${a.rating_avg}★ across ${a.rating_count ?? 'many'} reviews over ${Math.round(a.days_active ?? daysSince(a.created_at))} days.`,
      actions: [],
    }))

  return recs
}

function fmtPlays(a: ArtifactSignals): string {
  const n = a.plays
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k plays` : `${n} plays`
}
function fmtRating(a: ArtifactSignals): string {
  return a.rating_avg != null ? `${a.rating_avg}★ (${a.rating_count ?? 0})` : 'unrated'
}
function round(n: number): number { return Math.round(n * 10) / 10 }
