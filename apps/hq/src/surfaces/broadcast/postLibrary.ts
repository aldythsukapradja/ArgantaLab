/**
 * POST LIBRARY (B4) — every finished post, kept and reusable.
 *
 * Two rules define this module:
 *
 * 1. PUBLISHED IS IMMUTABLE. A post that has gone out cannot be edited — saving
 *    over it INSERTS a new row instead (linked by derivedFrom). The database
 *    enforces it too (migration_post_library.sql has a trigger), because this is
 *    an archive: if an edit could rewrite a published row, the library would
 *    start lying about what was actually posted, precisely when it matters.
 *
 * 2. SAVING IS AUTOMATIC, not a discipline. Every publish path calls
 *    recordPublish() before it shows its success modal, so "everything I've
 *    published" is true by construction rather than by the founder remembering
 *    to press Save.
 *
 * Cloud when Supabase is up, localStorage when it isn't — same shape, same
 * immutability rule, so an offline session doesn't quietly get weaker guarantees.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { postFormat, type PostDoc, type PostSlide, type TextLayer } from './postEngine'
import { TITLE_NAMES, BODY_NAMES } from './compose'

const LOCAL_KEY = 'hq_post_library_v1'

export type PublishDest = 'moment' | 'buffer' | 'feed' | 'export'
export interface PublishMark {
  dest: PublishDest
  label: string        // human: "KinetikCircle" / "Instagram · queued" / "3 PNGs"
  postId?: string
  at: string           // ISO
}
export interface LibraryEntry {
  id: string
  title: string
  doc: PostDoc
  summary: string
  meta: { format: string; palette: string; brandId?: string; fontId?: string; slideCount: number; hashtags: string }
  published: PublishMark[]
  locked: boolean
  derivedFrom?: string | null
  createdAt: string
  updatedAt: string
}

const nowIso = () => new Date().toISOString()
const uid = () => 'pl_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7)

// ── deriving the readable parts ───────────────────────────────
const textOf = (s: PostSlide, names: string[]) =>
  (s.layers.find(l => l.type === 'text' && names.includes(l.name)) as TextLayer | undefined)?.text

export function titleFor(doc: PostDoc): string {
  const first = doc.slides[0] && textOf(doc.slides[0], TITLE_NAMES)
  const fromCaption = doc.caption.split('\n')[0]
  return (first || fromCaption || 'Untitled post').replace(/\s+/g, ' ').trim().slice(0, 90)
}

/** A human summary built locally — no model call. The founder is scanning a
 *  timeline for "which post was that", and slide headlines answer it. */
export function summarize(doc: PostDoc): string {
  const heads = doc.slides.map((s, i) => {
    const h = textOf(s, TITLE_NAMES) || textOf(s, BODY_NAMES) || `(slide ${i + 1})`
    return `${i + 1}. ${h.replace(/\s+/g, ' ').trim()}`
  })
  const hook = doc.caption.split('\n')[0].trim()
  return [hook && `Caption: ${hook}`, ...heads].filter(Boolean).join('\n').slice(0, 1200)
}

export const metaFor = (doc: PostDoc): LibraryEntry['meta'] => ({
  format: doc.format, palette: doc.palette, brandId: doc.brandId, fontId: doc.fontId,
  slideCount: doc.slides.length, hashtags: doc.hashtags,
})

/** Fresh ids everywhere, so opening a library entry can never write back into
 *  the stored one by sharing object identity. */
export function cloneDoc(doc: PostDoc): PostDoc {
  const d: PostDoc = JSON.parse(JSON.stringify(doc))
  d.slides = d.slides.map(s => ({
    ...s,
    id: 'sl_' + Math.random().toString(36).slice(2, 9),
    layers: s.layers.map(l => ({ ...l, id: 'l_' + Math.random().toString(36).slice(2, 9) })),
  }))
  return d
}

// ── local store ───────────────────────────────────────────────
function localAll(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    const a = raw ? JSON.parse(raw) : []
    return Array.isArray(a) ? a : []
  } catch { return [] }
}
function localWrite(rows: LibraryEntry[]) {
  // A PostDoc with several base64/object-URL images can be big; keep the tail
  // bounded so one runaway post can't blow the whole quota away.
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(rows.slice(0, 60))) } catch { /* quota */ }
}

function rowToEntry(r: any): LibraryEntry {
  return {
    id: r.id, title: r.title, doc: r.doc, summary: r.summary || '',
    meta: r.meta || { format: 'portrait', palette: 'kinetik', slideCount: 0, hashtags: '' },
    published: Array.isArray(r.published) ? r.published : [],
    locked: !!r.locked, derivedFrom: r.derived_from ?? null,
    createdAt: r.created_at, updatedAt: r.updated_at ?? r.created_at,
  }
}

// ── API ───────────────────────────────────────────────────────
export async function listLibrary(limit = 60): Promise<LibraryEntry[]> {
  if (!cloudEnabled) return localAll().slice(0, limit)
  const { data, error } = await (supabase as SupabaseClient)
    .from('post_library')
    .select('id, title, doc, summary, meta, published, locked, derived_from, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) {
    // Before the migration is run this table doesn't exist. Fall back to local
    // rather than showing an empty library that looks like lost work.
    console.warn('[postLibrary]', error.message)
    return localAll().slice(0, limit)
  }
  return (data || []).map(rowToEntry)
}

/**
 * Save a post. If `id` names a LOCKED entry, this deliberately inserts a NEW
 * row rather than updating — that is the immutability rule, not a failure, so
 * it returns the new entry and the caller reports the version bump.
 */
export async function savePost(doc: PostDoc, opts: { id?: string | null } = {}): Promise<{ entry: LibraryEntry; forked: boolean }> {
  const existing = opts.id ? (await listLibrary(60)).find(e => e.id === opts.id) : undefined
  const forked = !!existing?.locked
  const base = {
    title: titleFor(doc),
    doc,
    summary: summarize(doc),
    meta: metaFor(doc),
  }

  if (!cloudEnabled) {
    const rows = localAll()
    if (existing && !forked) {
      const next = rows.map(e => e.id === existing.id ? { ...e, ...base, updatedAt: nowIso() } : e)
      localWrite(next)
      return { entry: next.find(e => e.id === existing.id)!, forked: false }
    }
    const entry: LibraryEntry = {
      id: uid(), ...base, published: [], locked: false,
      derivedFrom: forked ? existing!.id : null,
      createdAt: nowIso(), updatedAt: nowIso(),
    }
    localWrite([entry, ...rows])
    return { entry, forked }
  }

  if (existing && !forked) {
    const { data, error } = await (supabase as SupabaseClient)
      .from('post_library').update(base).eq('id', existing.id).select().single()
    if (error) throw new Error(error.message)
    return { entry: rowToEntry(data), forked: false }
  }
  const { data, error } = await (supabase as SupabaseClient)
    .from('post_library')
    .insert({ ...base, derived_from: forked ? existing!.id : null })
    .select().single()
  if (error) throw new Error(error.message)
  return { entry: rowToEntry(data), forked }
}

/**
 * Append a publish mark — and make sure the post is in the library first.
 *
 * Called by every publish path BEFORE its success modal, which is what makes
 * "everything published is in the library" structurally true. `entryId` is the
 * currently-open entry if there is one; otherwise the doc is saved fresh.
 */
export async function recordPublish(doc: PostDoc, mark: PublishMark, entryId?: string | null): Promise<LibraryEntry | null> {
  try {
    let target: LibraryEntry | undefined
    const all = await listLibrary(60)
    if (entryId) target = all.find(e => e.id === entryId)
    if (!target) {
      // A locked entry can't take new CONTENT, but it can take a new publish
      // mark — so only fork when the doc actually differs from what's stored.
      const same = entryId ? undefined : all.find(e => JSON.stringify(e.doc) === JSON.stringify(doc))
      target = same ?? (await savePost(doc, {})).entry
    }
    const published = [...target.published, mark]
    if (!cloudEnabled) {
      const rows = localAll().map(e => e.id === target!.id ? { ...e, published, locked: true, updatedAt: nowIso() } : e)
      localWrite(rows)
      return rows.find(e => e.id === target!.id) || null
    }
    // `locked` is derived by the DB trigger; sending it would be a lie the
    // trigger overwrites anyway.
    const { data, error } = await (supabase as SupabaseClient)
      .from('post_library').update({ published }).eq('id', target.id).select().single()
    if (error) throw new Error(error.message)
    return rowToEntry(data)
  } catch (e) {
    // A library write must NEVER cost the founder a publish that already
    // succeeded — the post is out; this is bookkeeping.
    console.warn('[postLibrary] recordPublish', e)
    return null
  }
}

export async function deleteEntry(id: string): Promise<{ ok: boolean; reason?: string }> {
  const all = await listLibrary(60)
  const e = all.find(x => x.id === id)
  if (!e) return { ok: false, reason: 'Not found.' }
  if (e.locked) return { ok: false, reason: 'Published posts are kept on purpose — this one is part of the record.' }
  if (!cloudEnabled) { localWrite(localAll().filter(x => x.id !== id)); return { ok: true } }
  const { error } = await (supabase as SupabaseClient).from('post_library').delete().eq('id', id)
  return error ? { ok: false, reason: error.message } : { ok: true }
}

/** Where a mark came from, in words the timeline can show. */
export const DEST_LABEL: Record<PublishDest, string> = {
  moment: 'Moment', buffer: 'Buffer', feed: 'Discover', export: 'Exported',
}

export const formatLabel = (id: string) => postFormat(id).aspect
