// =========================================================
//  KINETIK seed — now sourced from the BAKED SNAPSHOT of
//  Aldyth's circle (see snapshot.ts, generated from the
//  Kinetik Google Sheet). Types + helpers live here; the raw
//  rows live in snapshot.ts so they can be regenerated.
// =========================================================
import {
  RAW_PEOPLE, RAW_ROUTINES, RAW_EVENTS,
  CIRCLE_ID, CIRCLE_NAME, CIRCLE_ACCENT,
} from './snapshot'

// ---- energy taxonomy (matches the CSS --care/--mind/... vars) ----
export type EnergyKey = 'care' | 'mind' | 'growth' | 'memory' | 'play' | 'calm'

export const ENERGY: Record<EnergyKey, string> = {
  care: '#FB7185', mind: '#22D3EE', growth: '#34D399',
  memory: '#8B5CF6', play: '#FBBF24', calm: '#94A3B8',
}

export const ENERGY_LABEL: Record<EnergyKey, string> = {
  care: 'Care', mind: 'Focus', growth: 'Growth', memory: 'Memory', play: 'Play', calm: 'Calm',
}

/** Map an activity title to an energy (drives card colour + Today pills). */
export function energyOf(title: string): EnergyKey {
  const t = title.toLowerCase()
  if (/padel|tennis|basket|gym|pilates|gymnastic|swim|sport|football|run|ball/.test(t)) return 'play'
  if (/flight|depart|return|liburan|trip|holiday|jakarta|doha|travel|airport|summer|✈/.test(t)) return 'memory'
  if (/english|math|ngaji|guitar|read|study|ingatan|coding|code|class|school|homework|lesson|award/.test(t)) return 'growth'
  if (/anter|jemput|pickup|drop|lunch|dinner|bday|birthday|house|acara|wedding|marriot|marriage|visit|party/.test(t)) return 'care'
  if (/focus|work|meeting|call|deep/.test(t)) return 'mind'
  return 'calm'
}

// ---- roles ----
export type Role = 'owner' | 'coleader' | 'member' | 'viewer'
export const ROLE_LABEL: Record<Role, string> = { owner: 'Leader', coleader: 'Co-leader', member: 'Member', viewer: 'Viewer' }

export interface Person { id: string; name: string; color: string; role: Role }
export interface Circle { id: string; name: string; kind: 'family' | 'friends' | 'class'; accent: [string, string]; memberIds: string[] }

export interface Routine {
  id: string; circleId: string; title: string
  who: string[]; responsible: string; day: number   // 0=Sun .. 6=Sat
  start: string; end: string; energy: EnergyKey; durationMin?: number
}

export interface KEvent {
  id: string; circleId: string; title: string
  date: string; start: string; end: string
  who: string[]; energy: EnergyKey
  coach?: string; location?: string; prep?: string[]; durationMin?: number; endDate?: string
}

export interface Moment {
  id: string; circleId: string; authorId: string; text: string
  createdAt: number; hearts: number; comments: number
  tag?: string; kind: 'photo' | 'kudos' | 'memory'; tone?: EnergyKey; rewardEnergy?: EnergyKey
}

// ---- date helpers (relative to today) ----
const pad = (n: number) => String(n).padStart(2, '0')
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => isoOf(new Date())

const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0) }
/** Fix the handful of sheet rows where end <= start (data-entry slips). */
function safeEnd(start: string, end: string, durationMin?: number): string {
  if (toMin(end) > toMin(start)) return end
  const m = toMin(start) + (durationMin && durationMin > 0 ? durationMin : 60)
  return `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
}

// ---- build typed models from the snapshot ----
export const PEOPLE: Person[] = RAW_PEOPLE.map(p => ({
  id: p.id, name: p.name, color: p.color, role: (p.role as Role) || 'member',
}))

export const CIRCLES: Circle[] = [{
  id: CIRCLE_ID, name: CIRCLE_NAME, kind: 'family',
  accent: [CIRCLE_ACCENT, '#FB7185'], memberIds: PEOPLE.map(p => p.id),
}]

export const ROUTINES: Routine[] = RAW_ROUTINES.map(r => ({
  id: r.id, circleId: CIRCLE_ID, title: r.title,
  who: r.who, responsible: r.responsible, day: r.day,
  start: r.start, end: safeEnd(r.start, r.end, r.durationMin ?? undefined),
  energy: energyOf(r.title), durationMin: r.durationMin ?? undefined,
}))

export const SEED_EVENTS: KEvent[] = RAW_EVENTS.map(e => ({
  id: e.id, circleId: CIRCLE_ID, title: e.title,
  date: e.date, start: e.start, end: safeEnd(e.start, e.end, e.durationMin ?? undefined),
  who: e.who, energy: energyOf(e.title),
  prep: e.prep, durationMin: e.durationMin ?? undefined, endDate: e.endDate ?? undefined,
}))

// A few seed moments so the feed feels alive (real members).
export const SEED_MOMENTS: Moment[] = [
  { id: 'm1', circleId: CIRCLE_ID, authorId: 'person_7v6ze8s', text: 'Keyla nailed her gymnastics routine today. So proud!', createdAt: Date.now() - 2 * 3600e3, hearts: 6, comments: 2, tag: 'gymnastics', kind: 'photo', tone: 'play' },
  { id: 'm2', circleId: CIRCLE_ID, authorId: 'person_6v6ze8s', text: 'Baginda finished his guitar piece', createdAt: Date.now() - 5 * 3600e3, hearts: 4, comments: 1, kind: 'kudos', rewardEnergy: 'growth' },
  { id: 'm3', circleId: CIRCLE_ID, authorId: 'person_5v6ze8s', text: 'Counting down to our summer trip to Jakarta ✈️', createdAt: Date.now() - 26 * 3600e3, hearts: 9, comments: 4, tag: 'travel', kind: 'memory', tone: 'memory' },
]

export const personById = (id: string) => PEOPLE.find(p => p.id === id)
export const firstName = (id: string) => personById(id)?.name ?? '?'
export const initials = (name: string) => name.trim().slice(0, name.includes(' ') ? 1 : 2).toUpperCase()
