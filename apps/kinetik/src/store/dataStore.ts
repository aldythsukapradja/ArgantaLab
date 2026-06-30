// =========================================================
//  DOMAIN DATA store. Single source of truth = Supabase.
//
//  Authority is strictly one-way:
//     Supabase  ──load──►  this store  ──mirror──►  localStorage cache
//  The cache is ONLY ever read when the cloud is unreachable, and it
//  is NEVER seeded with fake/sample data. So there is exactly one
//  real source, and `source` always tells you which you're seeing.
// =========================================================
import { create } from 'zustand'
import { cloudReady } from '@lib/supabase'
import * as repo from '@repo/kinetikRepo'
import { useUiStore } from '@store/uiStore'
import { energyOf } from '@data/energy'
import type { Circle, Person, Routine, KEvent, CircleData } from '@data/types'
import type { Me } from '@repo/kinetikRepo'

const CACHE_KEY = 'kinetik_cache_v1'

type Status = 'loading' | 'ready' | 'error'
/** cloud = live from Supabase · cache = offline copy · empty = no data yet */
type Source = 'cloud' | 'cache' | 'empty'

interface DataStore extends CircleData {
  status: Status
  source: Source
  error: string | null
  /** The signed-in user (real auth + profile). null until loaded / signed out. */
  me: Me | null

  load: () => Promise<void>
  addEvent: (e: Omit<KEvent, 'id' | 'energy'>) => Promise<void>
  /** Block out a multi-day span (vacation etc.) — start → end inclusive. */
  addBlock: (b: { circleId: string; title: string; date: string; endDate: string; who: string[] }) => Promise<void>
  addRoutine: (r: Omit<Routine, 'id' | 'energy'>) => Promise<void>
  removeEvent: (id: string) => Promise<void>
  removeRoutine: (id: string) => Promise<void>
  editEvent: (id: string, patch: repo.PlanPatch) => Promise<void>
  editRoutine: (id: string, patch: repo.PlanPatch) => Promise<void>
  heart: (momentId: string) => Promise<void>
  /** Circle + member management (real DB writes; throw on failure). */
  addPerson: (circleId: string, name: string, role: Person['role'], color: string) => Promise<void>
  removePerson: (personId: string) => Promise<void>
  addCircle: (name: string, accent: string) => Promise<string>
  updateCircle: (circleId: string, patch: { name?: string; accent?: string }) => Promise<void>
  removeCircle: (circleId: string) => Promise<void>
}

const EMPTY: CircleData = { circles: [], people: [], routines: [], events: [], moments: [] }

function readCache(): CircleData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as CircleData) : null
  } catch { return null }
}
function writeCache(d: CircleData) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(d)) } catch { /* quota — ignore */ }
}

/** Pick a sensible active circle once data exists. */
function ensureActiveCircle(circles: Circle[]) {
  const ui = useUiStore.getState()
  if (!circles.length) return
  if (!circles.some(c => c.id === ui.activeCircleId)) ui.setCircle(circles[0].id)
}

export const useDataStore = create<DataStore>()((set, get) => ({
  ...EMPTY,
  status: 'loading',
  source: 'empty',
  error: null,
  me: null,

  load: async () => {
    set({ status: 'loading', error: null })

    // The signed-in user is real auth state — fetch it regardless of
    // whether the circle data round-trips (best-effort, never throws).
    repo.fetchMe().then(me => set({ me })).catch(() => {})

    // No keys → offline-only. Show cache if we have one, else empty.
    if (!cloudReady) {
      const cached = readCache()
      set(cached
        ? { ...cached, status: 'ready', source: 'cache' }
        : { ...EMPTY, status: 'ready', source: 'empty' })
      if (cached) ensureActiveCircle(cached.circles)
      return
    }

    // Cloud-first.
    try {
      // Keep the roster mirroring the real circle membership before we read it.
      await repo.syncPeopleAll().catch(() => {})
      const data = await repo.fetchAll()
      writeCache(data)
      set({ ...data, status: 'ready', source: 'cloud', error: null })
      ensureActiveCircle(data.circles)
    } catch (err) {
      // Cloud unreachable → fall back to the read-only cache.
      const cached = readCache()
      if (cached) {
        set({ ...cached, status: 'ready', source: 'cache', error: String(err) })
        ensureActiveCircle(cached.circles)
      } else {
        set({ status: 'error', source: 'empty', error: String(err) })
      }
    }
  },

  addEvent: async (e) => {
    if (cloudReady) {
      const saved = await repo.insertEvent(e) // throws on failure → surfaced to caller
      const events = [...get().events, saved]
      set({ events })
      writeCache({ ...pick(get()), events })
      return
    }
    // Offline: write to the cache only, so nothing is silently lost.
    const local: KEvent = { ...e, id: 'ev_' + Math.random().toString(36).slice(2, 9), energy: deriveEnergy(e.title) }
    const events = [...get().events, local]
    set({ events })
    writeCache({ ...pick(get()), events })
  },

  addBlock: async (b) => {
    // A block is an all-day, multi-day ambient event (is_block = true).
    await get().addEvent({
      circleId: b.circleId, title: b.title, date: b.date, endDate: b.endDate,
      start: '00:00', end: '23:59', who: b.who, isBlock: true,
    })
  },

  addRoutine: async (r) => {
    if (cloudReady) {
      const saved = await repo.insertRoutine(r) // throws on failure → surfaced to caller
      const routines = [...get().routines, saved]
      set({ routines })
      writeCache({ ...pick(get()), routines })
      return
    }
    const local: Routine = { ...r, id: 'ro_' + Math.random().toString(36).slice(2, 9), energy: deriveEnergy(r.title) }
    const routines = [...get().routines, local]
    set({ routines })
    writeCache({ ...pick(get()), routines })
  },

  removeEvent: async (id) => {
    if (cloudReady) await repo.deleteEvent(id) // throws on failure → surfaced to caller
    const events = get().events.filter(e => e.id !== id)
    set({ events })
    writeCache({ ...pick(get()), events })
  },

  removeRoutine: async (id) => {
    if (cloudReady) await repo.deleteRoutine(id)
    const routines = get().routines.filter(r => r.id !== id)
    set({ routines })
    writeCache({ ...pick(get()), routines })
  },

  editEvent: async (id, patch) => {
    if (cloudReady) await repo.updateEvent(id, patch) // throws → surfaced to caller
    const events = get().events.map(e => e.id === id ? applyPlanPatch(e, patch) : e)
    set({ events })
    writeCache({ ...pick(get()), events })
  },

  editRoutine: async (id, patch) => {
    if (cloudReady) await repo.updateRoutine(id, patch)
    const routines = get().routines.map(r => r.id === id ? applyPlanPatch(r, patch) : r)
    set({ routines })
    writeCache({ ...pick(get()), routines })
  },

  heart: async (momentId) => {
    const moments = get().moments.map(m => m.id === momentId ? { ...m, hearts: m.hearts + 1 } : m)
    set({ moments }) // optimistic
    writeCache({ ...pick(get()), moments })
    const next = moments.find(m => m.id === momentId)
    if (cloudReady && next) {
      try { await repo.setHearts(momentId, next.hearts) } catch { /* best-effort */ }
    }
  },

  // ── Circle + member management ──────────────────────────────
  // Writes hit the DB first (throw on failure so the UI can surface the real
  // error), then we update local state + cache. No optimistic faking.
  addPerson: async (circleId, name, role, color) => {
    const saved = await repo.insertPerson(circleId, name, role, color)
    const people = [...get().people, saved]
    const circles = get().circles.map(c =>
      c.id === circleId ? { ...c, memberIds: [...c.memberIds, saved.id] } : c)
    set({ people, circles })
    writeCache(pick({ ...get(), people, circles }))
  },

  removePerson: async (personId) => {
    await repo.deletePerson(personId)
    const people = get().people.filter(p => p.id !== personId)
    const circles = get().circles.map(c => ({ ...c, memberIds: c.memberIds.filter(id => id !== personId) }))
    set({ people, circles })
    writeCache(pick({ ...get(), people, circles }))
  },

  addCircle: async (name, accent) => {
    const me = get().me
    const cid = await repo.createCircle(name, accent, me?.name ?? 'Me', '#8B5CF6')
    await get().load()          // refetch the graph so the new circle + owner member appear
    useUiStore.getState().setCircle(cid)
    return cid
  },

  updateCircle: async (circleId, patch) => {
    await repo.updateCircle(circleId, patch)
    const circles = get().circles.map(c => c.id === circleId
      ? {
          ...c,
          ...(patch.name !== undefined ? { name: patch.name } : {}),
          ...(patch.accent !== undefined ? { accent: repo.accentStops(patch.accent) } : {}),
        }
      : c)
    set({ circles })
    writeCache(pick({ ...get(), circles }))
  },

  removeCircle: async (circleId) => {
    await repo.deleteCircle(circleId)
    const remaining = get().circles.filter(c => c.id !== circleId)
    // if we just deleted the active circle, move to another one
    const ui = useUiStore.getState()
    if (ui.activeCircleId === circleId && remaining[0]) ui.setCircle(remaining[0].id)
    await get().load()
  },
}))

const deriveEnergy = (t: string) => energyOf(t)

/** Apply a title/who/time patch to an event or routine, re-deriving energy. */
function applyPlanPatch<T extends KEvent | Routine>(item: T, patch: repo.PlanPatch): T {
  const next = { ...item }
  if (patch.title !== undefined) { next.title = patch.title; next.energy = deriveEnergy(patch.title) }
  if (patch.who !== undefined) next.who = patch.who
  if (patch.start !== undefined) next.start = patch.start
  if (patch.end !== undefined) next.end = patch.end
  return next
}

const pick = (s: DataStore): CircleData => ({
  circles: s.circles, people: s.people, routines: s.routines, events: s.events, moments: s.moments,
})

// ---- non-reactive lookups (people change rarely; fine to read at render) ----
export const personById = (id: string): Person | undefined =>
  useDataStore.getState().people.find(p => p.id === id)
export const firstName = (id: string): string => personById(id)?.name ?? '?'
