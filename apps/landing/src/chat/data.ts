// Real family data, circle-scoped. Reads the same Kinetik tables the family app
// writes, filtered to the circle(s) the parent selected (ctx.scope). Everything
// here returns `null` when there's nothing wired or nothing found, so the brain
// can fall back to an honest empty/sample answer rather than inventing data.
import { supabase, cloudEnabled } from '../lib/supabase'
import type { WeekDay } from './brain'

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

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
    return { dow: DOW[d.getDay()], date: d.getDate(), today: d.getTime() === today.getTime(), events: [] as string[] }
  })
  const idxOf = (dateStr: string) => { const d = new Date(dateStr + 'T00:00:00'); return Math.round((d.getTime() - mon.getTime()) / 864e5) }

  for (const e of (evRes.data ?? []) as any[]) {
    const i = idxOf(e.event_date); if (i < 0 || i > 6) continue
    days[i].events.push(hhmm(e.start_time) ? `${e.title} · ${hhmm(e.start_time)}` : e.title)
  }
  // routines repeat weekly on a weekday (`day` may be a name or 0–6 index)
  for (const r of (roRes.data ?? []) as any[]) {
    const i = typeof r.day === 'number' ? r.day : DOW.findIndex(d => d.toLowerCase() === String(r.day).slice(0, 3).toLowerCase())
    const slot = i >= 0 && i <= 6 ? (i === 0 ? 6 : i - 1) : -1 // convert Sun=0 dow → Mon-first column
    if (slot < 0) continue
    days[slot].events.push(hhmm(r.start_time) ? `${r.title} · ${hhmm(r.start_time)}` : r.title)
  }

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

/** Kid ids that belong to the given circle(s) and have a learner profile. */
async function circleKidIds(scope: string[]): Promise<{ id: string; name: string }[]> {
  const { data: cm } = await supabase.from('circle_members').select('member_id').in('circle_id', scope)
  const ids = Array.from(new Set((cm ?? []).map((m: any) => m.member_id).filter(Boolean)))
  if (!ids.length) return []
  const { data: kids } = await supabase.from('child_profiles').select('id, display_name').in('id', ids)
  return (kids ?? []).map((k: any) => ({ id: k.id, name: k.display_name || 'Kid' }))
}

/** Real learning reports for every kid in the circle(s). null = nothing wired /
 * no kids found, so the brain falls back to an honest answer. */
export async function fetchKidReports(scope: string[]): Promise<KidReport[] | null> {
  if (!cloudEnabled || scope.length === 0) return null
  const kids = await circleKidIds(scope)
  if (!kids.length) return null

  const reports = await Promise.all(kids.map(async k => {
    const { data } = await supabase.rpc('kid_dashboard', { p_kid: k.id })
    const daily: DailyRow[] = (data as any)?.daily ?? []
    const diamonds: number = (data as any)?.kid?.diamonds ?? 0
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
