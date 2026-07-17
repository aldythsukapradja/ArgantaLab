// IG Simulator — the plan store.
//
// Holds every planned post/reel/story for every creator. localStorage today
// (one bucket, items keyed by creator); the API deliberately hides that so P5
// can swap in Supabase without touching a single caller.
import { create } from 'zustand'
import { CREATORS, type Creator } from '../influencerData'
import { cloudEnabled } from '../../../lib/supabase'
import { loadAllFromCloud, reconcilePosted, removeFromCloud, upsertManyToCloud, upsertToCloud } from './cloud'

export type IgKind = 'post' | 'reel' | 'story'
/** 'sent' = handed to Post Studio's drafts inbox; 'posted' = live on IG. */
export type IgStatus = 'idea' | 'ready' | 'sent' | 'posted'
export type IgSlot = 'morning' | 'afternoon' | 'night'

export interface IgPlanItem {
  id: string
  creatorId: string
  kind: IgKind
  day: string                 // ISO yyyy-mm-dd — the slot this belongs to
  slot?: IgSlot               // stories only
  media?: string              // /influencer/… path, data URL, or `pl:<id>` library ref
  look?: 'normal' | 'formal' | 'spicy'
  caption: string
  hashtags: string
  pillar?: string
  pinned?: boolean
  status: IgStatus
  sentDraftId?: string
  createdAt: string
  updatedAt: string
}

const KEY = 'hq_igsim_v1'
const now = () => new Date().toISOString()
export const uid = () => 'ig_' + Math.random().toString(36).slice(2, 10)

/** yyyy-mm-dd in LOCAL time. toISOString() would shift the founder's Doha
 * evening into the next UTC day and file posts under the wrong slot. */
export function isoDay(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

/** Monday-based week containing `d` — matches the Mon–Sun ritual ribbon. */
export function weekOf(d: Date): string[] {
  const base = new Date(d)
  const dow = (base.getDay() + 6) % 7       // 0 = Monday
  base.setDate(base.getDate() - dow)
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(base)
    x.setDate(base.getDate() + i)
    return isoDay(x)
  })
}

export const DOW = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
export const SLOTS: IgSlot[] = ['morning', 'afternoon', 'night']

function load(): IgPlanItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    const arr = raw ? JSON.parse(raw) : []
    return Array.isArray(arr) ? arr : []
  } catch { return [] }
}
function save(items: IgPlanItem[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)) } catch { /* quota */ }
}

// ── seeding ──────────────────────────────────────────────────────────────
/**
 * Seed a creator's current week straight from their blueprint: the cadence in
 * `posts.cadence` becomes real slots, `reels.hooks` become reel captions, and
 * every ritual daypart becomes a story slot. Everything lands as 'idea' — this
 * is a plan to react to, not content that pretends to exist.
 */
export function seedWeek(c: Creator, week: string[]): IgPlanItem[] {
  const out: IgPlanItem[] = []
  const t = now()
  const mk = (p: Partial<IgPlanItem>): IgPlanItem => ({
    id: uid(), creatorId: c.id, kind: 'post', day: week[0], caption: '', hashtags: '',
    status: 'idea', createdAt: t, updatedAt: t, ...p,
  })

  // Reels on the cadence days (Mon/Wed/Fri/Sun), captioned from the hook bank.
  const reelDays = [0, 2, 4, 6]
  reelDays.forEach((di, i) => {
    const hook = c.reels.hooks[i % c.reels.hooks.length]
    out.push(mk({
      kind: 'reel', day: week[di], caption: hook.replace(/^[“"]|[”"]$/g, ''),
      hashtags: '', pillar: c.posts.pillars[0]?.name, look: 'normal', media: c.looks?.normal,
    }))
  })
  // Tue carousel + Sat premium still — the authority and lifestyle beats.
  out.push(mk({
    kind: 'post', day: week[1], caption: c.posts.carousel, pillar: c.posts.pillars[1]?.name,
    look: 'formal', media: c.looks?.formal, pinned: true,
  }))
  out.push(mk({
    kind: 'post', day: week[5], caption: c.signatureLines[0]?.replace(/^[“"]|[”"]$/g, '') ?? '',
    pillar: c.posts.pillars[3]?.name, look: 'spicy', media: c.looks?.spicy,
  }))
  // Daily stories from the ritual dayparts.
  week.forEach(day => {
    c.rituals.forEach((r, ri) => {
      const frame = r.frames[0]
      out.push(mk({
        kind: 'story', day, slot: SLOTS[ri] ?? 'morning',
        caption: frame ? `${frame.t} — ${frame.note}` : r.theme,
        look: 'normal',
      }))
    })
  })
  return out
}

// ── store ────────────────────────────────────────────────────────────────
interface PlanState {
  items: IgPlanItem[]
  itemsFor: (creatorId: string) => IgPlanItem[]
  upsert: (item: IgPlanItem) => void
  remove: (id: string) => void
  moveDay: (id: string, day: string) => void
  markStatus: (id: string, status: IgStatus, sentDraftId?: string) => void
  importBatch: (creatorId: string, rows: Partial<IgPlanItem>[]) => number
  seedIfEmpty: (creatorId: string, week: string[]) => void
  clearCreator: (creatorId: string) => void
  /** P5 — pull ig_plan_item into local state on first mount when a real
   * Supabase project is connected. Last-write-wins by updatedAt; anything
   * that only exists locally (e.g. seeded before the project was connected)
   * gets pushed up so it isn't silently dropped by the merge. */
  cloudLoaded: boolean
  loadFromCloud: () => Promise<void>
  /** Posted-status readback (P3→P5 loop): items sitting in 'sent' get
   * checked against their content_draft's published_to; any with a result
   * flip to 'posted' locally and in the cloud. */
  reconcile: () => Promise<void>
}

export const usePlan = create<PlanState>((set, get) => ({
  items: load(),
  cloudLoaded: false,

  itemsFor: creatorId => get().items.filter(i => i.creatorId === creatorId),

  upsert: item => set(s => {
    const next = s.items.some(i => i.id === item.id)
      ? s.items.map(i => i.id === item.id ? { ...item, updatedAt: now() } : i)
      : [...s.items, item]
    save(next); upsertToCloud(next.find(i => i.id === item.id)!); return { items: next }
  }),

  remove: id => set(s => {
    const next = s.items.filter(i => i.id !== id)
    save(next); removeFromCloud(id); return { items: next }
  }),

  moveDay: (id, day) => set(s => {
    const next = s.items.map(i => i.id === id ? { ...i, day, updatedAt: now() } : i)
    save(next); const moved = next.find(i => i.id === id); if (moved) upsertToCloud(moved); return { items: next }
  }),

  markStatus: (id, status, sentDraftId) => set(s => {
    const next = s.items.map(i => i.id === id
      ? { ...i, status, ...(sentDraftId ? { sentDraftId } : {}), updatedAt: now() }
      : i)
    save(next); const marked = next.find(i => i.id === id); if (marked) upsertToCloud(marked); return { items: next }
  }),

  /** The batch channel: a JSON array of partial items → real plan rows. This is
   * how a week gets planned in one paste, and how future Claude sessions inject
   * plans. Unknown fields are ignored; day/kind fall back to sane defaults. */
  importBatch: (creatorId, rows) => {
    const t = now()
    const made: IgPlanItem[] = rows.map(r => ({
      id: uid(),
      creatorId,
      kind: (r.kind === 'reel' || r.kind === 'story') ? r.kind : 'post',
      day: r.day || isoDay(new Date()),
      slot: r.slot,
      media: r.media,
      look: r.look,
      caption: r.caption ?? '',
      hashtags: r.hashtags ?? '',
      pillar: r.pillar,
      pinned: r.pinned,
      status: (['idea', 'ready', 'sent', 'posted'] as const).includes(r.status as IgStatus) ? r.status as IgStatus : 'idea',
      createdAt: t, updatedAt: t,
    }))
    set(s => { const next = [...s.items, ...made]; save(next); return { items: next } })
    upsertManyToCloud(made)
    return made.length
  },

  seedIfEmpty: (creatorId, week) => {
    if (get().items.some(i => i.creatorId === creatorId)) return
    const c = CREATORS.find(x => x.id === creatorId)
    if (!c) return
    const seeded = seedWeek(c, week)
    set(s => { const next = [...s.items, ...seeded]; save(next); return { items: next } })
    upsertManyToCloud(seeded)
  },

  clearCreator: creatorId => set(s => {
    const removed = s.items.filter(i => i.creatorId === creatorId)
    const next = s.items.filter(i => i.creatorId !== creatorId)
    save(next); removed.forEach(i => removeFromCloud(i.id)); return { items: next }
  }),

  loadFromCloud: async () => {
    if (!cloudEnabled || get().cloudLoaded) return
    const cloud = await loadAllFromCloud()
    if (!cloud.length) { set({ cloudLoaded: true }); return }
    set(s => {
      const byId = new Map(s.items.map(i => [i.id, i]))
      const toPushUp: IgPlanItem[] = []
      // Cloud wins per-id on last-write-wins; local-only items (seeded before
      // this browser ever connected) get merged in and pushed back up so the
      // merge never silently drops work the founder already did.
      for (const ci of cloud) {
        const local = byId.get(ci.id)
        if (!local || new Date(ci.updatedAt) >= new Date(local.updatedAt)) byId.set(ci.id, ci)
      }
      for (const li of s.items) if (!cloud.some(ci => ci.id === li.id)) toPushUp.push(li)
      const merged = Array.from(byId.values())
      save(merged)
      if (toPushUp.length) upsertManyToCloud(toPushUp)
      return { items: merged, cloudLoaded: true }
    })
  },

  reconcile: async () => {
    if (!cloudEnabled) return
    const sent = get().items.filter(i => i.status === 'sent' && i.sentDraftId)
    if (!sent.length) return
    const postedDraftIds = await reconcilePosted(sent.map(i => i.sentDraftId!))
    if (!postedDraftIds.length) return
    set(s => {
      const next = s.items.map(i =>
        i.sentDraftId && postedDraftIds.includes(i.sentDraftId) && i.status === 'sent'
          ? { ...i, status: 'posted' as IgStatus, updatedAt: now() }
          : i)
      save(next)
      next.filter((i, idx) => i !== s.items[idx]).forEach(upsertToCloud)
      return { items: next }
    })
  },
}))
