// Circle context — what grounds an answer. A parent usually lives in one family
// circle, but may belong to several (the padel crew, grandparents' circle…). The
// selector lets them ground Arganta in one circle OR open it across all of them.
//
// Circles come from the same `circles` table Kinetik reads; RLS already scopes
// the rows to circles this user belongs to, so a plain select is safe. Every
// family data query downstream filters by the chosen circle_id — except the
// "All circles" option, which fans the query across every id (audit-safe: still
// only this user's circles, never the whole table).
import { useEffect, useState } from 'react'
import { supabase, cloudEnabled } from '../lib/supabase'

export const ALL_CIRCLES = '__all__'

export interface Circle { id: string; name: string; accent: string }
export interface CircleCtx {
  /** selected circle id, or ALL_CIRCLES */
  id: string
  /** the resolved list of circle ids an answer should read (one, or all) */
  scope: string[]
  /** friendly label for the current selection */
  label: string
}

const STORE_KEY = 'arganta_chat_circle'

// DEV / offline: a couple of believable circles so the selector is explorable.
const SAMPLE: Circle[] = [
  { id: 'fam', name: 'The Sukapradja family', accent: '#DCA254' },
  { id: 'padel', name: 'Sunday padel crew', accent: '#6E8FB8' },
]

export function useCircles() {
  const [circles, setCircles] = useState<Circle[]>(cloudEnabled ? [] : SAMPLE)
  const [selectedId, setSelectedId] = useState<string>(() => localStorage.getItem(STORE_KEY) || (cloudEnabled ? ALL_CIRCLES : 'fam'))
  const [loading, setLoading] = useState(cloudEnabled)

  useEffect(() => {
    if (!cloudEnabled) return
    let active = true
    supabase.from('circles').select('id, name, accent').then(({ data }) => {
      if (!active) return
      const rows: Circle[] = (data ?? []).map((c: any) => ({ id: c.id, name: c.name || 'My circle', accent: c.accent || '#DCA254' }))
      setCircles(rows)
      // keep a valid selection: fall back to All if the stored id vanished
      setSelectedId(prev => (prev === ALL_CIRCLES || rows.some(r => r.id === prev)) ? prev : (rows.length === 1 ? rows[0].id : ALL_CIRCLES))
      setLoading(false)
    })
    return () => { active = false }
  }, [])

  const select = (id: string) => { setSelectedId(id); try { localStorage.setItem(STORE_KEY, id) } catch { /* private mode */ } }

  const ctx: CircleCtx = selectedId === ALL_CIRCLES
    ? { id: ALL_CIRCLES, scope: circles.map(c => c.id), label: circles.length > 1 ? 'All circles' : (circles[0]?.name ?? 'All circles') }
    : { id: selectedId, scope: [selectedId], label: circles.find(c => c.id === selectedId)?.name ?? 'My circle' }

  // Only offer the "All circles" affordance when there's more than one to span.
  const showAll = circles.length > 1

  return { circles, ctx, select, loading, showAll }
}
