// Calendar data + date math — the real KinetikCircle calendar, circle-scoped.
// Ports apps/kinetik/src/lib/cal.ts (week/monthGrid/occurrencesOn) and reads the
// same tables. Members come from kinetik_people so the board shows real columns.
import { supabase, cloudEnabled } from '../lib/supabase'
import { energyOf, type EnergyKey } from './data'

export interface Member { id: string; name: string; color: string }
export interface Occ { id: string; title: string; start: string; end: string; who: string[]; energy: EnergyKey; routine: boolean; clash: boolean }
export interface CalDay { date: Date; iso: string; dow: number; isToday: boolean; isWeekend: boolean }
export interface MonthCell extends CalDay { inMonth: boolean }

interface EventRow { id: string; title: string; event_date: string; start_time: string | null; end_time: string | null; who: string[] | null; circle_id: string }
interface RoutineRow { id: string; title: string; day: number | string; start_time: string | null; end_time: string | null; who: string[] | null; circle_id: string }

export interface CalendarData {
  events: EventRow[]
  routines: RoutineRow[]
  members: Member[]
  accent: [string, string]
}

const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export const toMin = (t?: string | null) => { if (!t) return 0; const [h, m] = (t || '0:0').split(':').map(Number); return h * 60 + (m || 0) }
export const todayISO = () => isoOf(new Date())
export const isoTomorrow = () => { const d = new Date(); d.setDate(d.getDate() + 1); return isoOf(d) }
export function fmtTime(t: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h < 12 ? 'AM' : 'PM'; const h12 = h % 12 || 12
  return `${h12}:${String(m || 0).padStart(2, '0')} ${ap}`
}
/** "in 45m" / "in 2h 10m" — same phrasing as Kinetik's Today page. */
export function untilText(nowMin: number, targetMin: number): string {
  const d = targetMin - nowMin
  if (d <= 0) return 'now'
  const h = Math.floor(d / 60), m = d % 60
  return 'in ' + (h > 0 ? `${h}h${m ? ` ${m}m` : ''}` : `${m}m`)
}

export function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase() || (name[0] ?? '?').toUpperCase()
}

/** Mon-first week for an offset (0 = this week). */
export function week(offset = 0): CalDay[] {
  const base = new Date(); base.setHours(0, 0, 0, 0)
  base.setDate(base.getDate() - ((base.getDay() + 6) % 7) + offset * 7)
  const today = isoOf(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() + i)
    return { date: d, iso: isoOf(d), dow: d.getDay(), isToday: isoOf(d) === today, isWeekend: d.getDay() === 0 || d.getDay() === 6 }
  })
}

/** Full month grid (weeks × 7), Sunday-first to match Kinetik's month head. */
export function monthGrid(year: number, month: number): MonthCell[] {
  const today = isoOf(new Date())
  const startDow = new Date(year, month, 1).getDay()
  const daysIn = new Date(year, month + 1, 0).getDate()
  const rows = Math.ceil((startDow + daysIn) / 7)
  return Array.from({ length: rows * 7 }, (_, i) => {
    const d = new Date(year, month, 1 - startDow + i)
    return { date: d, iso: isoOf(d), dow: d.getDay(), inMonth: d.getMonth() === month, isToday: isoOf(d) === today, isWeekend: d.getDay() === 0 || d.getDay() === 6 }
  })
}

const weekdayOf = (iso: string) => new Date(iso + 'T00:00:00').getDay()

/** Events + weekly routines occurring on a date, energy-tagged, clash-flagged. */
export function occurrencesOn(data: CalendarData, iso: string): Occ[] {
  const dow = weekdayOf(iso)
  const dayIdx = (dow + 6) % 7 // Mon=0, to compare with routine.day when numeric
  const fromEvents: Occ[] = data.events.filter(e => e.event_date === iso).map(e => ({
    id: e.id, title: e.title, start: e.start_time || '', end: e.end_time || e.start_time || '', who: e.who ?? [], energy: energyOf(e.title || ''), routine: false, clash: false,
  }))
  const fromRoutines: Occ[] = data.routines.filter(r => {
    const rd = typeof r.day === 'number' ? r.day : ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'].indexOf(String(r.day).slice(0, 3).toLowerCase())
    // routines store either a Sun=0 dow OR a Mon=0 index depending on origin; accept both
    return rd === dow || rd === dayIdx
  }).map(r => ({
    id: r.id, title: r.title, start: r.start_time || '', end: r.end_time || r.start_time || '', who: r.who ?? [], energy: energyOf(r.title || ''), routine: true, clash: false,
  }))
  const day = [...fromEvents, ...fromRoutines].sort((a, b) => toMin(a.start) - toMin(b.start))
  return day.map(e => ({
    ...e,
    clash: day.some(o => o.id !== e.id && o.who.some(w => e.who.includes(w)) && toMin(o.start) < toMin(e.end) && toMin(o.end) > toMin(e.start)),
  }))
}

/** Add a real event to KinetikCircle. Writes the same row shape the Kinetik app
 * writes (kinetikRepo.insertEvent), so it shows up identically in both apps. */
export async function addEvent(input: { circleId: string; title: string; date: string; start?: string; end?: string; who: string[] }): Promise<void> {
  const row: Record<string, unknown> = {
    id: 'ev_' + Math.random().toString(36).slice(2, 9),
    circle_id: input.circleId,
    title: input.title,
    event_date: input.date,
    start_time: input.start || null,
    end_time: input.end || null,
    who: input.who,
    prep: [],
  }
  const { error } = await supabase.from('kinetik_events').insert(row)
  if (error) throw new Error(error.message)
}

/** Add a real weekly routine to KinetikCircle (writes kinetik_routines — the
 * same table Kinetik's own "Repeat weekly" toggle writes). `day` is Sun=0,
 * matching Date#getDay() and what occurrencesOn() reads. */
export async function addRoutine(input: { circleId: string; title: string; day: number; start?: string; end?: string; who: string[] }): Promise<void> {
  const row: Record<string, unknown> = {
    id: 'ro_' + Math.random().toString(36).slice(2, 9),
    circle_id: input.circleId,
    title: input.title,
    day: input.day,
    start_time: input.start || null,
    end_time: input.end || null,
    who: input.who,
  }
  const { error } = await supabase.from('kinetik_routines').insert(row)
  if (error) throw new Error(error.message)
}

/** One fetch for the whole calendar surface, circle-scoped. */
export async function fetchCalendar(scope: string[]): Promise<CalendarData | null> {
  if (!cloudEnabled || scope.length === 0) return null
  const [ev, ro, pe, ci] = await Promise.all([
    supabase.from('kinetik_events').select('id, title, event_date, start_time, end_time, who, circle_id, is_block').in('circle_id', scope),
    supabase.from('kinetik_routines').select('id, title, day, start_time, end_time, who, circle_id').in('circle_id', scope),
    supabase.from('kinetik_people').select('id, name, color, circle_id, active').in('circle_id', scope),
    supabase.from('circles').select('accent').in('id', scope).limit(1).maybeSingle(),
  ])
  if (ev.error && ro.error) return null
  const events = ((ev.data ?? []) as any[]).filter(e => !e.is_block) as EventRow[]
  const routines = (ro.data ?? []) as RoutineRow[]
  const members: Member[] = ((pe.data ?? []) as any[])
    .filter(p => p.active !== false)
    .map(p => ({ id: p.id, name: p.name || 'Member', color: p.color || '#DCA254' }))
  const accentRaw = (ci.data as any)?.accent
  const accent: [string, string] = Array.isArray(accentRaw) && accentRaw.length >= 2 ? [accentRaw[0], accentRaw[1]] : ['#DCA254', '#8F6B3C']
  return { events, routines, members, accent }
}
