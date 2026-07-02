import { supabase, cloudEnabled } from './supabase'

// ============================================================
//  ARGANTACUP (client) — custom circle competitions.
//  Thin wrappers over the security-definer RPCs in
//  supabase/migration_competitions.sql. Standings + payouts are
//  SERVER truth; the client only reads and asks. Degrades to empty/no-op
//  when cloud isn't configured (or the migration hasn't been run yet).
// ============================================================

export type CupMetric = 'xp' | 'items'
export type CupPrizeKind = 'diamonds' | 'mount' | 'item'
export type CupStatus = 'live' | 'paid' | 'cancelled'

export interface CupStanding { kid_id: string; name: string; score: number; is_kid: boolean }
export interface Cup {
  id: string
  circle_id: string
  title: string
  metric: CupMetric
  target: number | null
  starts_at: string
  ends_at: string
  prize_kind: CupPrizeKind
  prize_diamonds: number
  prize_item: string | null
  status: CupStatus
  winner_id: string | null
  creator_id: string
  standings: CupStanding[]
}

export interface CreateCupInput {
  circleId: string
  title: string
  metric: CupMetric
  target?: number | null
  days: number
  prizeKind: CupPrizeKind
  prizeDiamonds?: number
  prizeItem?: string | null
  handicap?: boolean
  kids?: string[] | null   // null/empty → every kid in the circle (server default)
}

/** Every LIVE cup across the circles the signed-in player belongs to. */
export async function myCups(): Promise<Cup[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.rpc('my_cups')
  if (error) { console.warn('[cup] my_cups →', error.message); return [] }
  return (data as Cup[]) ?? []
}

/** Live standings for one cup (settles automatically once it's past its end). */
export async function cupStandings(id: string): Promise<Cup | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('competition_standings', { p_cup: id })
  if (error) { console.warn('[cup] standings →', error.message); return null }
  return (data as Cup) ?? null
}

const friendly = (msg: string): string => {
  const m = msg || ''
  if (m.includes('insufficient')) return "You don't have enough diamonds for that prize."
  if (m.includes('only a circle owner')) return 'Only the circle owner can start a cup.'
  if (m.includes('name required')) return 'Give the cup a name.'
  if (m.includes('prize must be positive')) return 'Pick a prize amount above zero.'
  if (m.includes('pick a prize item')) return 'Choose a mount or item to award.'
  if (m.includes('at least a day')) return 'A cup runs for at least one day.'
  return 'Could not start the cup. Try again.'
}

/** Guardian starts a cup. Diamond prizes are escrowed from their budget. */
export async function createCup(i: CreateCupInput): Promise<{ ok: boolean; id?: string; balance?: number; error?: string }> {
  if (!cloudEnabled) return { ok: false, error: 'Cloud isn\'t set up yet.' }
  const { data, error } = await supabase.rpc('create_competition', {
    p_circle: i.circleId,
    p_title: i.title,
    p_metric: i.metric,
    p_target: i.target ?? null,
    p_days: i.days,
    p_prize_kind: i.prizeKind,
    p_prize_diamonds: i.prizeDiamonds ?? 0,
    p_prize_item: i.prizeItem ?? null,
    p_handicap: i.handicap ?? false,
    p_kids: i.kids && i.kids.length ? i.kids : null,
  })
  if (error) return { ok: false, error: friendly(error.message) }
  const r = data as { ok: boolean; id: string; balance: number }
  return { ok: !!r?.ok, id: r?.id, balance: r?.balance }
}

/** Circle owner ends a cup early and pays out now. */
export async function settleCup(id: string): Promise<boolean> {
  if (!cloudEnabled) return false
  const { error } = await supabase.rpc('settle_competition', { p_cup: id })
  if (error) { console.warn('[cup] settle →', error.message); return false }
  return true
}

/** Circle owner scraps a live cup; the escrow refunds to their budget. */
export async function cancelCup(id: string): Promise<boolean> {
  if (!cloudEnabled) return false
  const { error } = await supabase.rpc('cancel_competition', { p_cup: id })
  if (error) { console.warn('[cup] cancel →', error.message); return false }
  return true
}

// ── display helpers (pure) ──────────────────────────────────
export const CUP_METRICS: { key: CupMetric; label: string; unit: string }[] = [
  { key: 'xp', label: 'Most XP earned', unit: 'XP' },
  { key: 'items', label: 'Most questions answered', unit: 'answered' },
]
export const CUP_DURATIONS = [1, 3, 7, 14, 30]

export function cupTimeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now()
  if (ms <= 0) return 'ended'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  if (d >= 1) return `${d}d ${h}h left`
  const m = Math.floor((ms % 3600000) / 60000)
  return h >= 1 ? `${h}h ${m}m left` : `${m}m left`
}
