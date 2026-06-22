// =========================================================
//  Calendar engine (simple port of the battle-tested logic):
//  events on a date, the current week, and clash detection.
// =========================================================
import { isoOf, type KEvent } from '@data/seed'

export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m }

export const fmtTime = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  const ap = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 || 12
  return m ? `${h12}:${String(m).padStart(2, '0')}${ap}` : `${h12}${ap}`
}

/** Events on a given ISO date, sorted by start, with a `clash` flag. */
export function eventsOn(all: KEvent[], dateIso: string, circleId: string): (KEvent & { clash: boolean })[] {
  const day = all
    .filter(e => e.circleId === circleId && e.date === dateIso)
    .sort((a, b) => toMin(a.start) - toMin(b.start))
  return day.map(e => {
    const clash = day.some(o =>
      o.id !== e.id &&
      o.who.some(w => e.who.includes(w)) &&
      toMin(o.start) < toMin(e.end) && toMin(o.end) > toMin(e.start))
    return { ...e, clash }
  })
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
