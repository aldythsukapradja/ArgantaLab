import { supabase, cloudEnabled } from './supabase'
import { listMyKids, type CloudProfile } from './cloudAuth'
import { WORLDS, STAGE_META, stageForDob, type World } from '@/data/learn'
// stageForDob returns a Stage object ({key,label,minAge,maxAge}); STAGE_META adds emoji+colour.
import { competencyFor, type Competency, type Bloom, BLOOM_ORDER } from './taxonomy'

// Reads the per-kid analytics bundle from the kid_dashboard RPC and derives the
// numbers the Grown-ups page renders (streak, gaps, grids). All gap *labelling*
// is deterministic rules over server-provided state — the heavy lifting (mastery,
// rollups) already happened in SQL.

export interface MasteryRow { world: string; skill: string; mastery: number; box: number; lastSeen: string | null }
export interface DailyRow { day: string; items: number; correct: number; minutes: number; xp: number }
export interface RewardLite { amount: number; reason: string | null; kind: string; at: string }
export interface KidDashboard {
  kid: { id: string; name: string; photo: string | null; dob: string | null; lastSeen: string | null; diamonds: number; xp: number; level: number }
  mastery: MasteryRow[]
  daily: DailyRow[]
  bloom: Record<string, number>
  competency: Record<string, { total: number; correct: number }>
  interest: Record<string, number>
  recentRewards: RewardLite[]
  generatedAt: string
}

export async function listKids(): Promise<CloudProfile[]> {
  if (!cloudEnabled) return []
  const kids = await listMyKids()
  return kids.filter(k => k.role === 'kid')
}

export async function loadKidDashboard(kidId: string): Promise<KidDashboard | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('kid_dashboard', { p_kid: kidId })
  if (error || !data) return null
  return data as KidDashboard
}

// ── Sample dashboard (display-only preview) ─────────────────────
// Lets a grown-up see the full analytics experience before any real
// telemetry exists — e.g. before the migration is applied, or before the
// first play. Deterministic (seeded) so it's stable across renders, and
// NEVER written anywhere: purely powers the "Preview sample" toggle.
export function sampleDashboard(name = 'Sample'): KidDashboard {
  let seed = 13_372
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff }
  const pick = (lo: number, hi: number) => lo + (hi - lo) * rnd()
  const now = Date.now()

  // mastery per world×skill — varied so gaps/decay surface naturally
  const mastery: MasteryRow[] = []
  for (const w of WORLDS) for (const s of w.skills) {
    const base = pick(0.18, 0.96)
    mastery.push({
      world: w.key, skill: s.key,
      mastery: Math.round(base * 100) / 100,
      box: 1 + Math.floor(base * 5),
      lastSeen: new Date(now - Math.floor(pick(0, 16)) * 864e5).toISOString(),
    })
  }

  // 120 days of daily activity — ~68% active, gently improving
  const daily: DailyRow[] = []
  for (let i = 119; i >= 0; i--) {
    const day = iso(new Date(now - i * 864e5))
    if (rnd() > 0.68) { daily.push({ day, items: 0, correct: 0, minutes: 0, xp: 0 }); continue }
    const items = Math.round(pick(6, 26) * (0.7 + (120 - i) / 200))
    daily.push({ day, items, correct: Math.round(items * pick(0.62, 0.92)), minutes: Math.round(pick(4, 16)), xp: items * 8 })
  }

  // depth-of-thinking — weighted to lower Bloom orders, with real higher-order share
  const bloom: Record<string, number> = { remember: 340, understand: 410, apply: 250, analyze: 130, create: 64 }

  // accuracy per Cambridge competency (aggregated from world×skill)
  const competency: Record<string, { total: number; correct: number }> = {}
  for (const w of WORLDS) for (const s of w.skills) {
    const c = competencyFor(w.key, s.key)
    const t = Math.round(pick(20, 80))
    const cur = competency[c] ?? { total: 0, correct: 0 }
    cur.total += t; cur.correct += Math.round(t * pick(0.55, 0.92))
    competency[c] = cur
  }

  // last-30-day interest split by world
  const interest: Record<string, number> = {}
  for (const w of WORLDS) interest[w.key] = Math.round(pick(12, 90))

  const totalXp = daily.reduce((a, d) => a + d.xp, 0)
  return {
    kid: {
      id: 'sample', name, photo: null,
      dob: iso(new Date(now - 9 * 365 * 864e5)),
      lastSeen: new Date().toISOString(),
      diamonds: 1240, xp: totalXp, level: 1 + Math.floor(totalXp / 500),
    },
    mastery, daily, bloom, competency, interest,
    recentRewards: [
      { amount: 100, reason: 'Tidied your room', kind: 'reward', at: new Date(now - 2 * 36e5).toISOString() },
      { amount: 50, reason: 'Helped with the dishes', kind: 'reward', at: new Date(now - 864e5).toISOString() },
      { amount: 50_000, reason: null, kind: 'starter', at: new Date(now - 9 * 864e5).toISOString() },
    ],
    generatedAt: new Date().toISOString(),
  }
}

// ── Header stats ────────────────────────────────────────────────
export function currentStreak(daily: DailyRow[]): number {
  const active = new Set(daily.filter(d => d.items > 0).map(d => d.day))
  let streak = 0
  const d = new Date()
  // allow today to be missing without breaking yesterday's streak
  if (!active.has(iso(d))) d.setDate(d.getDate() - 1)
  while (active.has(iso(d))) { streak++; d.setDate(d.getDate() - 1) }
  return streak
}
export function weekActiveDays(daily: DailyRow[]): number {
  const cutoff = Date.now() - 7 * 864e5
  return daily.filter(d => d.items > 0 && new Date(d.day).getTime() >= cutoff).length
}
export function avgMinutesPerDay(daily: DailyRow[]): number {
  const cutoff = Date.now() - 30 * 864e5
  const recent = daily.filter(d => d.items > 0 && new Date(d.day).getTime() >= cutoff)
  if (!recent.length) return 0
  return Math.round(recent.reduce((a, d) => a + d.minutes, 0) / recent.length)
}
export function stageOf(dob: string | null) {
  const stage = stageForDob(dob ?? undefined)
  const meta = STAGE_META[stage.key] ?? { emoji: '', color: '#888' }
  return { key: stage.key, label: stage.label, minAge: stage.minAge, maxAge: stage.maxAge, ...meta }
}
function iso(d: Date) { return d.toISOString().slice(0, 10) }

// ── Mastery grid (worlds × skills, null = never attempted) ──────
export interface GridCell { world: World; skill: { key: string; label: string }; pct: number | null }
export function masteryGrid(dash: KidDashboard): { world: World; cells: GridCell[] }[] {
  const map = new Map(dash.mastery.map(m => [`${m.world}/${m.skill}`, m]))
  return WORLDS.map(w => ({
    world: w,
    cells: w.skills.map(s => {
      const m = map.get(`${w.key}/${s.key}`)
      return { world: w, skill: { key: s.key, label: s.label }, pct: m ? Math.round(m.mastery * 100) : null }
    }),
  }))
}

// ── Gap detector (deterministic rules over server state) ────────
export type GapReason = 'frustrated' | 'weak' | 'decaying' | 'untouched' | 'depth'
export interface Gap { world?: World; skill?: { key: string; label: string }; reason: GapReason; why: string }
const RANK: Record<GapReason, number> = { frustrated: 0, weak: 1, decaying: 2, depth: 3, untouched: 4 }

export function computeGaps(dash: KidDashboard, max = 5): Gap[] {
  const map = new Map(dash.mastery.map(m => [`${m.world}/${m.skill}`, m]))
  const gaps: Gap[] = []
  for (const w of WORLDS) {
    for (const s of w.skills) {
      const skill = { key: s.key, label: s.label }
      const m = map.get(`${w.key}/${s.key}`)
      if (!m) { gaps.push({ world: w, skill, reason: 'untouched', why: `${s.label} — not started yet.` }); continue }
      const pct = Math.round(m.mastery * 100)
      if (m.mastery < 0.3 && m.box <= 1) {
        gaps.push({ world: w, skill, reason: 'frustrated', why: `${s.label} keeps resetting — try easier items.` })
      } else if (m.mastery < 0.6) {
        gaps.push({ world: w, skill, reason: 'weak', why: `${s.label} — ${pct}% mastered, needs practice.` })
      } else if (isDue(m)) {
        gaps.push({ world: w, skill, reason: 'decaying', why: `${s.label} is fading — not practised in ${daysSince(m.lastSeen)} days.` })
      }
    }
  }
  // one global depth gap when higher-order thinking is rare
  const total = Object.values(dash.bloom).reduce((a, n) => a + n, 0)
  const higher = (dash.bloom['analyze'] ?? 0) + (dash.bloom['create'] ?? 0)
  if (total > 20 && higher / total < 0.1) {
    gaps.push({ reason: 'depth', why: 'Lots of recall, little reasoning — time for analyse/create challenges.' })
  }
  gaps.sort((a, b) => RANK[a.reason] - RANK[b.reason])
  // keep untouched out of the top unless nothing else is wrong
  const flagged = gaps.filter(g => g.reason !== 'untouched')
  return (flagged.length ? flagged : gaps).slice(0, max)
}

function isDue(m: MasteryRow): boolean {
  if (!m.lastSeen) return false
  const dueDays = Math.pow(2, Math.max(0, m.box - 1)) // box1→1d, box4→8d, box6→32d
  return Date.now() - new Date(m.lastSeen).getTime() > dueDays * 864e5
}
function daysSince(s: string | null): number {
  if (!s) return 0
  return Math.max(0, Math.round((Date.now() - new Date(s).getTime()) / 864e5))
}

// ── Bloom distribution (ordered, for the depth bar) ─────────────
export function bloomDistribution(dash: KidDashboard): { bloom: Bloom; n: number; pct: number }[] {
  const total = Object.values(dash.bloom).reduce((a, n) => a + n, 0) || 1
  return BLOOM_ORDER.map(b => {
    const n = dash.bloom[b] ?? 0
    return { bloom: b, n, pct: Math.round((n / total) * 100) }
  })
}

// ── Competency radar data (Cambridge Life Competencies) ─────────
export function competencyScores(dash: KidDashboard): { competency: Competency; pct: number }[] {
  // accuracy per competency, only those actually attempted
  const out: { competency: Competency; pct: number }[] = []
  for (const [k, v] of Object.entries(dash.competency)) {
    if (!v.total) continue
    out.push({ competency: k as Competency, pct: Math.round((v.correct / v.total) * 100) })
  }
  return out
}

export { competencyFor }
