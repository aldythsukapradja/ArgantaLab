// =========================================================
//  Padel fair-rotation engine (pure, storage-agnostic).
//  Ported from kinetik.ai/App_SportPadel.html v10.4 — Americano
//  (partner/opponent-balanced) + Mexicano (live-ranking ladder),
//  duration/pace planning, and leaderboard. No DOM, no Supabase.
// =========================================================
export interface EPlayer { id: string; name: string }
export interface EMatchSpec { matchNo: number; court: number; teamA: [string, string]; teamB: [string, string] }
export interface EMatch extends EMatchSpec { scoreA: number | null; scoreB: number | null }
export interface EBatch { matches: EMatch[] }
export interface EOptions {
  points: number
  pace: 'relaxed' | 'normal' | 'fast'
  duration: number              // minutes
  americanoMode: 'duration' | 'official'
  selectedCourts: number[]
}
export interface EStanding { id: string; name: string; points: number; diff: number; played: number; wins: number; draws: number; losses: number; avg: number }

const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
const pairKey = (a: string, b: string) => [a, b].sort().join('|')

/** Minimum match count for a balanced rotation of n players. */
export function fairBlock(n: number): number {
  if (n < 4) return 0
  if (n === 4) return 3
  return n / gcd(n, 4)
}

/** Full official Americano cycle (every pairing roughly once), divisible by n. */
export function officialAmericanoMatches(n: number): number {
  if (n < 4) return 0
  const pairs = (n * (n - 1)) / 2
  let m = Math.ceil(pairs / 2)
  while ((4 * m) % n !== 0) m++
  return m
}

const matchMinutes = (points: number, pace: EOptions['pace']): number =>
  points >= 30
    ? ({ fast: 14, normal: 18, relaxed: 22 } as const)[pace]
    : ({ fast: 10, normal: 12, relaxed: 15 } as const)[pace]

/** How many matches fit the booking window. */
export function durationMatches(n: number, o: EOptions): number {
  const block = fairBlock(n)
  if (!block) return 0
  const courts = Math.max(1, Math.min(o.selectedCourts.length || 1, Math.floor(n / 4)))
  const slots = Math.max(1, Math.floor(o.duration / matchMinutes(o.points, o.pace)))
  const capacity = slots * courts
  let m = Math.floor(capacity / block) * block
  if (m < block) m = block
  return m
}

export function recommendedInitialMatches(n: number, o: EOptions): number {
  return o.americanoMode === 'official' ? officialAmericanoMatches(n) : durationMatches(n, o)
}

const courtFor = (i: number, courts: number[]): number => {
  const sorted = [...new Set(courts)].sort((a, b) => a - b)
  return sorted[i % sorted.length] ?? 1
}

interface Hist { partner: Record<string, number>; opp: Record<string, number> }
function buildHistory(batches: EBatch[]): Hist {
  const partner: Record<string, number> = {}, opp: Record<string, number> = {}
  for (const b of batches) for (const m of b.matches) {
    partner[pairKey(m.teamA[0], m.teamA[1])] = (partner[pairKey(m.teamA[0], m.teamA[1])] || 0) + 1
    partner[pairKey(m.teamB[0], m.teamB[1])] = (partner[pairKey(m.teamB[0], m.teamB[1])] || 0) + 1
    for (const a of m.teamA) for (const bb of m.teamB) opp[pairKey(a, bb)] = (opp[pairKey(a, bb)] || 0) + 1
  }
  return { partner, opp }
}

/** Pick the fairest of a foursome's 3 pairings (min repeat-partner / repeat-opp). */
function choosePairing(ids: string[], h: Hist): [[string, string], [string, string]] {
  const patterns: [[string, string], [string, string]][] = [
    [[ids[0], ids[1]], [ids[2], ids[3]]],
    [[ids[0], ids[2]], [ids[1], ids[3]]],
    [[ids[0], ids[3]], [ids[1], ids[2]]],
  ]
  const pen = ([A, B]: [[string, string], [string, string]]): number => {
    let s = (h.partner[pairKey(A[0], A[1])] || 0) * 14 + (h.partner[pairKey(B[0], B[1])] || 0) * 14
    for (const a of A) for (const b of B) s += (h.opp[pairKey(a, b)] || 0) * 3
    return s
  }
  return patterns.sort((a, b) => pen(a) - pen(b))[0]
}

function combos4(arr: string[]): string[][] {
  const out: string[][] = []
  for (let a = 0; a < arr.length - 3; a++) for (let b = a + 1; b < arr.length - 2; b++)
    for (let c = b + 1; c < arr.length - 1; c++) for (let d = c + 1; d < arr.length; d++)
      out.push([arr[a], arr[b], arr[c], arr[d]])
  return out
}

/** Generate a balanced Americano batch. Returns match specs (no scores).
 *  `matchCount` must satisfy (4*matchCount) % n === 0 (caller uses the helpers). */
export function generateAmericano(players: EPlayer[], matchCount: number, courts: number[], existing: EBatch[]): EMatchSpec[] {
  const n = players.length
  if (n < 4 || matchCount <= 0 || (4 * matchCount) % n !== 0) return []
  const h = buildHistory(existing)
  const remaining: Record<string, number> = {}
  players.forEach(p => { remaining[p.id] = (4 * matchCount) / n })
  const startNo = existing.reduce((s, b) => s + b.matches.length, 0)
  const out: EMatchSpec[] = []
  for (let mm = 0; mm < matchCount; mm++) {
    const eligible = players.filter(p => remaining[p.id] > 0).map(p => p.id)
    const scoreGroup = (ids: string[]): number => {
      let s = -ids.reduce((sum, id) => sum + remaining[id], 0) * 80
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) s += (h.opp[pairKey(ids[i], ids[j])] || 0) * 2
      return s
    }
    let group: string[]
    if (eligible.length === 4) group = eligible
    else { const cand = combos4(eligible); cand.sort((a, b) => scoreGroup(a) - scoreGroup(b)); group = cand[0] || eligible.slice(0, 4) }
    const [teamA, teamB] = choosePairing(group, h)
    teamA.concat(teamB).forEach(id => remaining[id]--)
    h.partner[pairKey(teamA[0], teamA[1])] = (h.partner[pairKey(teamA[0], teamA[1])] || 0) + 1
    h.partner[pairKey(teamB[0], teamB[1])] = (h.partner[pairKey(teamB[0], teamB[1])] || 0) + 1
    for (const a of teamA) for (const b of teamB) h.opp[pairKey(a, b)] = (h.opp[pairKey(a, b)] || 0) + 1
    out.push({ matchNo: startNo + out.length + 1, court: courtFor(startNo + out.length, courts), teamA, teamB })
  }
  return out
}

/** Generate the next Mexicano ranking round: 1&4 vs 2&3 per court, overflow sits out. */
export function generateMexicano(ranked: EPlayer[], courts: number[], existing: EBatch[]): { matches: EMatchSpec[]; sitouts: string[] } {
  const courtCount = [...new Set(courts)].length || 1
  const cap = Math.min(Math.floor(ranked.length / 4) * 4, courtCount * 4)
  const active = ranked.slice(0, cap)
  const startNo = existing.reduce((s, b) => s + b.matches.length, 0)
  const matches: EMatchSpec[] = []
  for (let i = 0; i < active.length; i += 4) {
    const g = active.slice(i, i + 4)
    matches.push({ matchNo: startNo + matches.length + 1, court: courtFor(startNo + matches.length, courts), teamA: [g[0].id, g[3].id], teamB: [g[1].id, g[2].id] })
  }
  return { matches, sitouts: ranked.slice(cap).map(p => p.id) }
}

export function shuffle<T>(arr: T[]): T[] {
  const out = [...arr]
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[out[i], out[j]] = [out[j], out[i]] }
  return out
}

/** Standings across every scored match. Sort: points → diff → wins → name. */
export function leaderboard(players: EPlayer[], batches: EBatch[]): EStanding[] {
  const stats: Record<string, EStanding> = {}
  players.forEach(p => { stats[p.id] = { id: p.id, name: p.name, points: 0, diff: 0, played: 0, wins: 0, draws: 0, losses: 0, avg: 0 } })
  for (const b of batches) for (const m of b.matches) {
    if (!Number.isFinite(m.scoreA) || !Number.isFinite(m.scoreB)) continue
    const a = m.scoreA as number, bb = m.scoreB as number
    const aw = a > bb, bw = bb > a, dr = a === bb
    for (const id of m.teamA) { const s = stats[id]; if (!s) continue; s.points += a; s.diff += a - bb; s.played++; s.wins += aw ? 1 : 0; s.draws += dr ? 1 : 0; s.losses += bw ? 1 : 0 }
    for (const id of m.teamB) { const s = stats[id]; if (!s) continue; s.points += bb; s.diff += bb - a; s.played++; s.wins += bw ? 1 : 0; s.draws += dr ? 1 : 0; s.losses += aw ? 1 : 0 }
  }
  Object.values(stats).forEach(s => { s.avg = s.played ? +(s.points / s.played).toFixed(1) : 0 })
  return Object.values(stats).sort((a, b) => b.points - a.points || b.diff - a.diff || b.wins - a.wins || a.name.localeCompare(b.name))
}

export const matchScored = (m: { scoreA: number | null; scoreB: number | null }): boolean =>
  Number.isFinite(m.scoreA) && Number.isFinite(m.scoreB)

/** Human summary of what an initial generate will produce. */
export function forecast(n: number, o: EOptions, americano: boolean): string {
  if (!americano) return 'Mexicano builds one ranking round at a time from the live leaderboard.'
  if (n < 4) return 'Add at least 4 players.'
  const m = recommendedInitialMatches(n, o)
  const plays = (4 * m) / n
  return `${o.americanoMode === 'official' ? 'Official cycle' : `${o.duration} min · ${o.pace}`}: ${m} matches · each plays ${plays}.`
}
