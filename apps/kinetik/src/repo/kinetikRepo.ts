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
// `circles` is the existing ArgantaLab table; accent was added by 01_schema.sql
interface CircleRow { id: string; name: string; accent: string | null; kind: string | null }
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

// Lighten a hex toward white — used to derive the 2nd gradient stop so every
// circle's accent reads as its OWN colour (not a fixed pink second stop).
function lighten(hex: string, amt = 0.26): string {
  const h = hex.replace('#', '')
  if (h.length !== 6) return hex
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16)
  const m = (c: number) => Math.round(c + (255 - c) * amt).toString(16).padStart(2, '0')
  return `#${m(r)}${m(g)}${m(b)}`
}

// ---- row → domain mappers ----
const mapCircle = (r: CircleRow, memberIds: string[]): Circle => {
  const a0 = r.accent ?? '#F43F5E'
  return {
    id: r.id, name: r.name ?? '', kind: (r.kind as Circle['kind']) || 'family',
    accent: [a0, lighten(a0)], memberIds,
  }
}
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
    supabase.from('circles').select('id, name, kind, accent'),
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

/** Insert a weekly recurring routine. Returns the saved domain routine. */
export async function insertRoutine(r: Omit<Routine, 'id' | 'energy'>): Promise<Routine> {
  const id = 'ro_' + Math.random().toString(36).slice(2, 9)
  const row = {
    id, circle_id: r.circleId, title: r.title, who: r.who,
    responsible: r.responsible ?? null, day: r.day,
    start_time: r.start, end_time: r.end, duration_min: r.durationMin ?? null,
  }
  const { error } = await supabase.from('kinetik_routines').insert(row)
  if (error) throw error
  return mapRoutine(row as RoutineRow)
}

/** Set a moment's heart count (caller computes the new value optimistically). */
export async function setHearts(momentId: string, hearts: number): Promise<void> {
  const { error } = await supabase.from('kinetik_moments').update({ hearts }).eq('id', momentId)
  if (error) throw error
}

// ── Apps (published by CircleHQ into the shared `hq_app` table) ──
export interface KApp {
  id: string
  name: string
  category: string | null
  description: string | null
  thumbnail: string | null
  html: string | null
  featured: boolean
}

/** Kinetik apps published from CircleHQ, scoped to this circle.
 *  An app shows when: product = kinetik · not planned/private · and either
 *  global (no circle_ids) or explicitly shared with this circle. */
export async function fetchApps(circleId: string): Promise<KApp[]> {
  const { data, error } = await supabase
    .from('hq_app')
    .select('id, name, category, description, thumbnail, html, featured, product, status, visibility, circle_ids, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, unknown>>)
    .filter(a => (a.product ?? 'kinetik') === 'kinetik')
    .filter(a => a.status !== 'planned' && a.visibility !== 'private')
    .filter(a => {
      const ids = a.circle_ids
      return !Array.isArray(ids) || ids.length === 0 || ids.includes(circleId)
    })
    .sort((a, b) => Number(!!b.featured) - Number(!!a.featured))
    .map(a => ({
      id: String(a.id), name: (a.name as string) || 'Untitled',
      category: (a.category as string) ?? null, description: (a.description as string) ?? null,
      thumbnail: (a.thumbnail as string) ?? null, html: (a.html as string) ?? null,
      featured: !!a.featured,
    }))
}

// ── Circle + member management (real writes) ──────────────────
// kinetik_people is open read+write (anon key OK). The `circles` table is
// owner-only, so create/delete go through the security-definer RPCs that
// the logged-in owner is granted.

/** Add a display member to a circle. Returns the saved domain Person. */
export async function insertPerson(circleId: string, name: string, role: Person['role'], color: string): Promise<Person> {
  const id = 'person_' + Math.random().toString(36).slice(2, 10)
  const { error } = await supabase.from('kinetik_people').insert({ id, circle_id: circleId, name, color, role })
  if (error) throw error
  return { id, circleId, name, color, role }
}

/** Remove a member from a circle. */
export async function deletePerson(personId: string): Promise<void> {
  const { error } = await supabase.from('kinetik_people').delete().eq('id', personId)
  if (error) throw error
}

/** Create a circle (the caller becomes its owner) and seed the creator as the
 *  first member. Returns the new circle id. */
export async function createCircle(name: string, accent: string, ownerName: string, ownerColor: string): Promise<string> {
  const { data: cid, error } = await supabase.rpc('create_circle', { p_name: name, p_kind: 'family' })
  if (error) throw error
  const circleId = cid as string
  // accent is a Kinetik-only column; owner can update their own circle row.
  const { error: aErr } = await supabase.from('circles').update({ accent }).eq('id', circleId)
  if (aErr) throw aErr
  // seed the creator as the first kinetik member (owner).
  const pid = 'person_' + Math.random().toString(36).slice(2, 10)
  const { error: pErr } = await supabase.from('kinetik_people')
    .insert({ id: pid, circle_id: circleId, name: ownerName, color: ownerColor, role: 'owner' })
  if (pErr) throw pErr
  return circleId
}

/** Delete a circle (owner only; cascades its people / routines / events / moments). */
export async function deleteCircle(circleId: string): Promise<void> {
  const { error } = await supabase.rpc('delete_circle', { p_circle: circleId })
  if (error) throw error
}

/** Rename and/or recolor a circle (owner-only; direct update, RLS-guarded). */
export async function updateCircle(circleId: string, patch: { name?: string; accent?: string }): Promise<void> {
  const { error } = await supabase.from('circles').update(patch).eq('id', circleId)
  if (error) throw error
}

/** The 2-stop gradient for a stored accent (so the store can rebuild it locally). */
export function accentStops(a0: string): [string, string] {
  return [a0, lighten(a0)]
}

/** A registered user from the directory (used by the "add member" picker).
 *  Backed by `search_users` — lists ALL registered profiles, name/code searchable.
 *  Requires an authenticated session (auth.uid()); empty otherwise. */
export interface DirUser { id: string; name: string; photoUrl: string | null; friendCode: string | null; role: string; rel: string }
export async function searchUsers(q = ''): Promise<DirUser[]> {
  const { data, error } = await supabase.rpc('search_users', { p_q: q, p_limit: 24, p_offset: 0 })
  if (error) throw error
  return ((data ?? []) as Array<Record<string, string | null>>).map(r => ({
    id: String(r.id), name: r.display_name || 'Unknown', photoUrl: r.photo_url ?? null,
    friendCode: r.friend_code ?? null, role: r.role || '', rel: r.rel || 'none',
  }))
}

/** The signed-in user (auth + their profile row). The one real "me". */
export interface Me { id: string; name: string; photoUrl: string | null; diamonds: number }
export async function fetchMe(): Promise<Me | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const meta = (user.user_metadata ?? {}) as Record<string, string>
  let name = meta.full_name || meta.name || user.email?.split('@')[0] || 'there'
  let photoUrl: string | null = meta.avatar_url || meta.picture || null
  let diamonds = 0
  try {
    const { data: prof } = await supabase
      .from('profiles').select('display_name, photo_url, diamonds').eq('id', user.id).single()
    if (prof) {
      name = prof.display_name || name
      photoUrl = prof.photo_url || photoUrl
      diamonds = prof.diamonds ?? 0
    }
  } catch { /* profile row may not exist yet — fall back to auth metadata */ }
  return { id: user.id, name, photoUrl, diamonds }
}

/** Live learning progress for every member of a circle.
 *  Backed by the `kinetik_member_progress` security-definer function so
 *  the owner can read kids' progress without weakening per-user RLS.
 *  Returns a map keyed by kinetik_people.id. Empty map if the function
 *  isn't installed yet or the caller doesn't own the circle. */
export interface MemberProgress {
  ringPct: number; xp: number; skills: number; streak: number; diamonds: number
}
export async function fetchMemberProgress(circleId: string): Promise<Record<string, MemberProgress>> {
  const { data, error } = await supabase.rpc('kinetik_member_progress', { p_circle: circleId })
  if (error || !data) return {}
  const out: Record<string, MemberProgress> = {}
  for (const r of data as Array<{ member_id: string; ring_pct: number; xp: number; skills: number; streak: number; diamonds: number }>) {
    out[r.member_id] = {
      ringPct: Number(r.ring_pct) || 0,
      xp: r.xp || 0,
      skills: r.skills || 0,
      streak: r.streak || 0,
      diamonds: r.diamonds || 0,
    }
  }
  return out
}
