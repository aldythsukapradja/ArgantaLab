// =========================================================
//  Energy taxonomy + small pure helpers. Presentation only —
//  energy is DERIVED from an activity title, never stored in
//  the database, so the DB stays clean and the colour rules
//  live in one place.
// =========================================================
import type { EnergyKey, Role } from './types'

export const ENERGY: Record<EnergyKey, string> = {
  care: '#FB7185', mind: '#22D3EE', growth: '#34D399',
  memory: '#8B5CF6', play: '#FBBF24', calm: '#94A3B8',
}

export const ENERGY_LABEL: Record<EnergyKey, string> = {
  care: 'Care', mind: 'Focus', growth: 'Growth', memory: 'Memory', play: 'Play', calm: 'Calm',
}

export const ENERGY_ORDER: EnergyKey[] = ['care', 'growth', 'play', 'mind', 'memory', 'calm']

export const ROLE_LABEL: Record<Role, string> = {
  owner: 'Leader', coleader: 'Co-leader', member: 'Member', viewer: 'Viewer',
}

/** Map an activity title to an energy (drives card colour + Today pills). */
export function energyOf(title: string): EnergyKey {
  const t = title.toLowerCase()
  if (/padel|tennis|tenis|basket|gym|pilates|gymnastic|swim|sport|football|run|ball/.test(t)) return 'play'
  if (/flight|depart|return|liburan|trip|holiday|jakarta|jkt|doha|travel|airport|summer|✈/.test(t)) return 'memory'
  if (/english|math|ngaji|guitar|read|study|ingatan|coding|code|class|school|sekolah|homework|lesson|award/.test(t)) return 'growth'
  if (/anter|jemput|pickup|drop|lunch|dinner|bday|birthday|house|acara|wedding|marriot|marriage|visit|party/.test(t)) return 'care'
  if (/focus|work|meeting|call|deep/.test(t)) return 'mind'
  return 'calm'
}

// ---- pure date helpers ----
const pad = (n: number) => String(n).padStart(2, '0')
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
export const todayISO = () => isoOf(new Date())

// ---- pure name helpers ----
export const initials = (name: string) =>
  name.trim().slice(0, name.includes(' ') ? 1 : 2).toUpperCase()

// Stable, distinct colour per member — derived from the id so the same person
// is always the same colour across Calendar / Today / day sheets, regardless of
// whether their account stores a colour.
const MEMBER_COLORS = ['#6366F1', '#0EA5E9', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E']
export function colorFor(id: string): string {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return MEMBER_COLORS[h % MEMBER_COLORS.length]
}
