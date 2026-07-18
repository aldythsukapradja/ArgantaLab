// Real family data, circle-scoped. Reads the same Kinetik tables the family app
// writes, filtered to the circle(s) the parent selected (ctx.scope). Everything
// here returns `null` when there's nothing wired or nothing found, so the brain
// can fall back to an honest empty/sample answer rather than inventing data.
import { supabase, cloudEnabled } from '../lib/supabase'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ── Kinetik's energy system, verbatim (apps/kinetik/src/data/energy.ts) — the
// chat's calendar chips must be colored exactly as KinetikCircle colors them. ──
export type EnergyKey = 'care' | 'mind' | 'growth' | 'memory' | 'play' | 'calm'
export const ENERGY: Record<EnergyKey, string> = {
  care: '#F2738C', mind: '#48A7EA', growth: '#27B79A',
  memory: '#8E7BEA', play: '#ECA13A', calm: '#7C89C4',
}
export function energyOf(title: string): EnergyKey {
  const t = title.toLowerCase()
  if (/padel|tennis|tenis|basket|gym|pilates|gymnastic|swim|sport|football|run|ball/.test(t)) return 'play'
  if (/flight|depart|return|liburan|trip|holiday|jakarta|jkt|doha|travel|airport|summer|✈/.test(t)) return 'memory'
  if (/english|math|ngaji|guitar|read|study|ingatan|coding|code|class|school|sekolah|homework|lesson|award/.test(t)) return 'growth'
  if (/anter|jemput|pickup|drop|lunch|dinner|bday|birthday|house|acara|wedding|marriot|marriage|visit|party/.test(t)) return 'care'
  if (/focus|work|meeting|call|deep/.test(t)) return 'mind'
  return 'calm'
}

export interface WeekEvent { title: string; time: string; energy: EnergyKey; routine: boolean }
export interface WeekDay { dow: string; date: number; today?: boolean; weekend?: boolean; events: WeekEvent[] }

/** Monday 00:00 of the week containing `base` (local time). */
function weekStart(base = new Date()): Date {
  const d = new Date(base); d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d
}
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const hhmm = (t?: string | null) => {
  if (!t) return ''
  const [h, m] = t.split(':'); const hr = +h
  const ampm = hr >= 12 ? 'pm' : 'am'; const h12 = hr % 12 || 12
  return m && m !== '00' ? `${h12}:${m}${ampm}` : `${h12}${ampm}`
}

export interface WeekResult { days: WeekDay[]; count: number }

/** The current Mon–Sun for the given circles, events + weekly routines merged. */
export async function fetchWeek(scope: string[]): Promise<WeekResult | null> {
  if (!cloudEnabled || scope.length === 0) return null
  const mon = weekStart(); const sun = new Date(mon); sun.setDate(mon.getDate() + 6)
  const today = new Date(); today.setHours(0, 0, 0, 0)

  const [evRes, roRes] = await Promise.all([
    supabase.from('kinetik_events').select('title, event_date, start_time, circle_id').in('circle_id', scope).gte('event_date', iso(mon)).lte('event_date', iso(sun)),
    supabase.from('kinetik_routines').select('title, day, start_time, circle_id').in('circle_id', scope),
  ])
  if (evRes.error && roRes.error) return null

  const days: WeekDay[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i)
    const dow = d.getDay()
    return { dow: DOW[dow], date: d.getDate(), today: d.getTime() === today.getTime(), weekend: dow === 0 || dow === 6, events: [] as WeekEvent[] }
  })
  const idxOf = (dateStr: string) => { const d = new Date(dateStr + 'T00:00:00'); return Math.round((d.getTime() - mon.getTime()) / 864e5) }

  for (const e of (evRes.data ?? []) as any[]) {
    const i = idxOf(e.event_date); if (i < 0 || i > 6) continue
    days[i].events.push({ title: e.title, time: hhmm(e.start_time), energy: energyOf(e.title || ''), routine: false })
  }
  // routines repeat weekly on a weekday (`day` may be a name or 0–6 index)
  for (const r of (roRes.data ?? []) as any[]) {
    const i = typeof r.day === 'number' ? r.day : DOW.findIndex(d => d.toLowerCase() === String(r.day).slice(0, 3).toLowerCase())
    const slot = i >= 0 && i <= 6 ? (i === 0 ? 6 : i - 1) : -1 // convert Sun=0 dow → Mon-first column
    if (slot < 0) continue
    days[slot].events.push({ title: r.title, time: hhmm(r.start_time), energy: energyOf(r.title || ''), routine: true })
  }
  // events first, then routines, each by time — mirrors the board's reading order
  for (const d of days) d.events.sort((a, b) => Number(a.routine) - Number(b.routine) || a.time.localeCompare(b.time))

  const count = days.reduce((s, d) => s + d.events.length, 0)
  return { days, count }
}

// ── ArgantaLab reports: real per-kid learning pulse ──
// Kids in a circle = circle_members whose id has a child_profiles row. Each kid's
// analytics come from the kid_dashboard RPC (guardian-only, security definer) —
// the same server truth the ArgantaLab "Grown-ups" page reads. We derive the
// three numbers the chat shows (streak / recent accuracy / a plain trend) from
// the daily activity log; the heavy mastery rollups already happened in SQL.
export interface KidReport { name: string; pct: number; streak: number; trend: string; diamonds: number; hasData: boolean }

interface DailyRow { day: string; items: number; correct: number; minutes: number; xp: number }
const isoDay = (d: Date) => d.toISOString().slice(0, 10)

function streakOf(daily: DailyRow[]): number {
  const active = new Set(daily.filter(d => d.items > 0).map(d => d.day))
  let n = 0; const d = new Date()
  if (!active.has(isoDay(d))) d.setDate(d.getDate() - 1) // today may be blank without breaking the streak
  while (active.has(isoDay(d))) { n++; d.setDate(d.getDate() - 1) }
  return n
}
function recentAccuracy(daily: DailyRow[], days = 7): { pct: number; items: number } {
  const cutoff = Date.now() - days * 864e5
  const rows = daily.filter(d => d.items > 0 && new Date(d.day).getTime() >= cutoff)
  const items = rows.reduce((a, d) => a + d.items, 0)
  const correct = rows.reduce((a, d) => a + d.correct, 0)
  return { pct: items ? Math.round((correct / items) * 100) : 0, items }
}
function weekActiveDays(daily: DailyRow[]): number {
  const cutoff = Date.now() - 7 * 864e5
  return daily.filter(d => d.items > 0 && new Date(d.day).getTime() >= cutoff).length
}

// A distinct empty sentinel so the brain can tell "no kids linked" (calm, normal)
// apart from "couldn't reach the data" (transient error). Returning null == error.
export const NO_KIDS: KidReport[] = []

/** The guardian's kids — via the `my_children` RPC (the same reliable path
 * ArgantaLab's own parent dashboard uses; independent of circle_members RLS,
 * which was the fragile bit). Returns null only on an actual RPC error. */
export async function myKids(): Promise<{ id: string; name: string; photo: string | null }[] | null> {
  const { data, error } = await supabase.rpc('my_children')
  if (error) return null
  return (data as any[] ?? []).map(k => ({ id: k.id, name: k.display_name || k.name || 'Kid', photo: k.photo_url ?? null }))
}

export interface KidDashboard {
  kid: { id: string; name: string; photo: string | null; diamonds: number; xp: number; level: number }
  mastery: { world: string; skill: string; mastery: number; box: number; lastSeen: string | null }[]
  daily: DailyRow[]
  bloom: Record<string, number>
  recentRewards: { amount: number; reason: string | null; kind: string; at: string }[]
}

/** The raw per-kid dashboard bundle for the Pulse deep-dive — same RPC/shape as
 * apps/web's parentDash.ts kid_dashboard consumer. null = fetch error. */
export async function fetchKidDashboard(kidId: string): Promise<KidDashboard | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc('kid_dashboard', { p_kid: kidId })
  if (error || !data) return null
  return data as KidDashboard
}

/** Real learning reports for the guardian's kids. null = fetch error (brain says
 * "couldn't reach"); [] = no kids linked yet (brain says so calmly). Each kid's
 * dashboard is fetched independently so one failing RPC can't sink the rest. */
export async function fetchKidReports(_scope: string[]): Promise<KidReport[] | null> {
  if (!cloudEnabled) return null
  const kids = await myKids()
  if (kids === null) return null
  if (!kids.length) return NO_KIDS

  const reports = await Promise.all(kids.map(async k => {
    let data: any = null
    try { const r = await supabase.rpc('kid_dashboard', { p_kid: k.id }); data = r.data } catch { /* keep name, no progress */ }
    const daily: DailyRow[] = data?.daily ?? []
    const diamonds: number = data?.kid?.diamonds ?? 0
    const streak = streakOf(daily)
    const { pct, items } = recentAccuracy(daily)
    const active = weekActiveDays(daily)
    const hasData = items > 0 || streak > 0
    const trend = !hasData ? 'just getting started'
      : active >= 5 ? `practising most days · ${diamonds.toLocaleString()}💎`
      : `${active} day${active === 1 ? '' : 's'} active this week · ${diamonds.toLocaleString()}💎`
    return { name: k.name, pct, streak, trend, diamonds, hasData } as KidReport
  }))
  return reports
}
