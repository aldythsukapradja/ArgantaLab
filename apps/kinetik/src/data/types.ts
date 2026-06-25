// =========================================================
//  Domain types ONLY. No data lives in this file (that's the
//  whole point of the rebuild) — the real data lives in Supabase.
// =========================================================

export type EnergyKey = 'care' | 'mind' | 'growth' | 'memory' | 'play' | 'calm'

export type Role = 'owner' | 'coleader' | 'member' | 'viewer'

export interface Circle {
  id: string
  name: string
  kind: 'family' | 'friends' | 'class'
  /** two-stop gradient accent */
  accent: [string, string]
  memberIds: string[]
}

export interface Person {
  id: string
  circleId: string
  name: string
  color: string
  role: Role
  /** ArgantaLab account this member maps to (profiles.id or child_profiles.id),
   *  set by 03_member_progress.sql. null = not linked → no real progress yet. */
  linkId?: string | null
  linkKind?: 'profile' | 'child' | null
}

export interface Routine {
  id: string
  circleId: string
  title: string
  who: string[]
  responsible?: string
  day: number // 0=Sun .. 6=Sat
  start: string // 'HH:MM'
  end: string // 'HH:MM'
  energy: EnergyKey // derived from title at load time
  durationMin?: number
  /** ISO date the weekly repeat stops on (inclusive). undefined = repeats forever. */
  repeatUntil?: string
}

export interface KEvent {
  id: string
  circleId: string
  title: string
  date: string // ISO 'YYYY-MM-DD'
  start: string
  end: string
  who: string[]
  energy: EnergyKey // derived from title at load time
  prep?: string[]
  durationMin?: number
  endDate?: string
}

export interface Moment {
  id: string
  circleId: string
  authorId: string
  text: string
  createdAt: number // epoch ms
  hearts: number
  comments: number
  kind: 'photo' | 'kudos' | 'memory'
  tag?: string
  tone?: EnergyKey
  rewardEnergy?: EnergyKey
}

/** The full graph for one circle, as returned by the repo. */
export interface CircleData {
  circles: Circle[]
  people: Person[]
  routines: Routine[]
  events: KEvent[]
  moments: Moment[]
}
