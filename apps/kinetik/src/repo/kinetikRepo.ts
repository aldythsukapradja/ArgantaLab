// =========================================================
//  THE single place that talks to the Supabase tables.
//  Nothing else in the app imports `supabase` for data. This is
//  the only writer of truth; the store mirrors what it returns.
//
//  Row shape (snake_case in DB) → domain type (camelCase) mapping
//  happens here, and `energy` is derived from the title so the
//  database never stores presentation state.
// =========================================================
import { supabase } from '@lib/supabase'
import { energyOf } from '@data/energy'
import type { Circle, Person, Routine, KEvent, Moment, CircleData } from '@data/types'

// ---- row types (as stored) ----
interface CircleRow { id: string; name: string; accent: string; kind: string }
interface PersonRow { id: string; circle_id: string; name: string; color: string; role: string }
interface RoutineRow {
  id: string; circle_id: string; title: string; who: string[] | null
  responsible: string | null; day: number; start_time: string; end_time: string; duration_min: number | null
}
interface EventRow {
  id: string; circle_id: string; title: string; event_date: string
  start_time: string; end_time: string; who: string[] | null; prep: string[] | null
  duration_min: number | null; end_date: string | null
}
interface MomentRow {
  id: string; circle_id: string; author_id: string | null; body: string
  kind: string; tag: string | null; tone: string | null; reward_energy: string | null
  hearts: number; comments: number; created_at: string
}

// ---- row → domain mappers ----
const mapCircle = (r: CircleRow, memberIds: string[]): Circle => ({
  id: r.id, name: r.name, kind: (r.kind as Circle['kind']) || 'family',
  accent: [r.accent, '#FB7185'], memberIds,
})
const mapPerson = (r: PersonRow): Person => ({
  id: r.id, circleId: r.circle_id, name: r.name, color: r.color, role: (r.role as Person['role']) || 'member',
})
const mapRoutine = (r: RoutineRow): Routine => ({
  id: r.id, circleId: r.circle_id, title: r.title, who: r.who ?? [],
  responsible: r.responsible ?? undefined, day: r.day, start: r.start_time, end: r.end_time,
  energy: energyOf(r.title), durationMin: r.duration_min ?? undefined,
})
const mapEvent = (r: EventRow): KEvent => ({
  id: r.id, circleId: r.circle_id, title: r.title, date: r.event_date,
  start: r.start_time, end: r.end_time, who: r.who ?? [], energy: energyOf(r.title),
  prep: r.prep ?? undefined, durationMin: r.duration_min ?? undefined, endDate: r.end_date ?? undefined,
})
const mapMoment = (r: MomentRow): Moment => ({
  id: r.id, circleId: r.circle_id, authorId: r.author_id ?? '', text: r.body,
  createdAt: new Date(r.created_at).getTime(), hearts: r.hearts, comments: r.comments,
  kind: (r.kind as Moment['kind']) || 'kudos', tag: r.tag ?? undefined,
  tone: (r.tone as Moment['tone']) ?? undefined, rewardEnergy: (r.reward_energy as Moment['rewardEnergy']) ?? undefined,
})

/** Pull the whole graph. Throws on error so the store can fall back to cache. */
export async function fetchAll(): Promise<CircleData> {
  const [circles, people, routines, events, moments] = await Promise.all([
    supabase.from('kinetik_circles').select('*'),
    supabase.from('kinetik_people').select('*'),
    supabase.from('kinetik_routines').select('*'),
    supabase.from('kinetik_events').select('*'),
    supabase.from('kinetik_moments').select('*'),
  ])
  for (const r of [circles, people, routines, events, moments]) {
    if (r.error) throw r.error
  }
  const peopleRows = (people.data ?? []) as PersonRow[]
  const byCircle = (cid: string) => peopleRows.filter(p => p.circle_id === cid).map(p => p.id)

  return {
    circles: ((circles.data ?? []) as CircleRow[]).map(c => mapCircle(c, byCircle(c.id))),
    people: peopleRows.map(mapPerson),
    routines: ((routines.data ?? []) as RoutineRow[]).map(mapRoutine),
    events: ((events.data ?? []) as EventRow[]).map(mapEvent),
    moments: ((moments.data ?? []) as MomentRow[]).map(mapMoment),
  }
}

/** Insert a new event. Returns the saved domain event. */
export async function insertEvent(e: Omit<KEvent, 'id' | 'energy'>): Promise<KEvent> {
  const id = 'ev_' + Math.random().toString(36).slice(2, 9)
  const row = {
    id, circle_id: e.circleId, title: e.title, event_date: e.date,
    start_time: e.start, end_time: e.end, who: e.who, prep: e.prep ?? [],
    duration_min: e.durationMin ?? null, end_date: e.endDate ?? null,
  }
  const { error } = await supabase.from('kinetik_events').insert(row)
  if (error) throw error
  return mapEvent(row as EventRow)
}

/** Set a moment's heart count (caller computes the new value optimistically). */
export async function setHearts(momentId: string, hearts: number): Promise<void> {
  const { error } = await supabase.from('kinetik_moments').update({ hearts }).eq('id', momentId)
  if (error) throw error
}
