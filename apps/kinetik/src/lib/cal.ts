// =========================================================
//  Calendar engine: merges one-off EVENTS with weekly ROUTINES,
//  expands routines onto the right weekday, sorts a day, and
//  flags clashes (same person, overlapping time).
// =========================================================
import { isoOf, type KEvent, type Routine, type EnergyKey } from '@data/seed'

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0) }

export const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}${ap}`
}

/** A concrete thing happening on a given day (from an event or a routine). */
export interface Occ {
  id: string; title: string; start: string; end: string
  who: string[]; energy: EnergyKey; kind: 'event' | 'routine'
  responsible?: string; coach?: string; location?: string; prep?: string[]
  clash: boolean
}

const weekdayOf = (dateIso: string) => new Date(dateIso + 'T00:00').getDay()

/** Everything on `dateIso` for a circle: events on that date + routines on that weekday. */
export function occurrencesOn(events: KEvent[], routines: Routine[], dateIso: string, circleId: string): Occ[] {
  const dow = weekdayOf(dateIso)
  const fromEvents: Occ[] = events
    .filter(e => e.circleId === circleId && e.date === dateIso)
    .map(e => ({ id: e.id, title: e.title, start: e.start, end: e.end, who: e.who, energy: e.energy, kind: 'event', coach: e.coach, location: e.location, prep: e.prep, clash: false }))
  const fromRoutines: Occ[] = routines
    .filter(r => r.circleId === circleId && r.day === dow)
    .map(r => ({ id: r.id, title: r.title, start: r.start, end: r.end, who: r.who, energy: r.energy, kind: 'routine', responsible: r.responsible, clash: false }))

  const day = [...fromEvents, ...fromRoutines].sort((a, b) => toMin(a.start) - toMin(b.start))
  return day.map(e => ({
    ...e,
    clash: day.some(o => o.id !== e.id && o.who.some(w => e.who.includes(w)) && toMin(o.start) < toMin(e.end) && toMin(o.end) > toMin(e.start)),
  }))
}

/** Back-compat: just the one-off events on a date (kept for any old callers). */
export function eventsOn(all: KEvent[], dateIso: string, circleId: string): (KEvent & { clash: boolean })[] {
  const day = all.filter(e => e.circleId === circleId && e.date === dateIso).sort((a, b) => toMin(a.start) - toMin(b.start))
  return day.map(e => ({ ...e, clash: day.some(o => o.id !== e.id && o.who.some(w => e.who.includes(w)) && toMin(o.start) < toMin(e.end) && toMin(o.end) > toMin(e.start)) }))
}

export interface CalDay { date: Date; iso: string; dow: number; isToday: boolean; isWeekend: boolean }

/** Seven days for a week, offset in weeks from the current one (Mon-start). */
export function week(offset = 0): CalDay[] {
  const base = new Date(); base.setHours(0, 0, 0, 0)
  const day = (base.getDay() + 6) % 7 // Mon = 0
  base.setDate(base.getDate() - day + offset * 7)
  const todayIso = isoOf(new Date())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base); d.setDate(base.getDate() + i)
    return { date: d, iso: isoOf(d), dow: d.getDay(), isToday: isoOf(d) === todayIso, isWeekend: d.getDay() === 0 || d.getDay() === 6 }
  })
}

export function isoTomorrow(): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 1)
  return isoOf(d)
}

export const untilText = (nowMin: number, startMin: number) => {
  const d = startMin - nowMin
  if (d <= 0) return 'now'
  const h = Math.floor(d / 60), m = d % 60
  return 'in ' + (h ? `${h}h ` : '') + (m ? `${m}m` : '')
}
