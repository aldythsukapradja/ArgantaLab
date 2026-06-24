import { supabase, cloudEnabled } from './supabase'
import { GAMES } from '@/data'

// Circle-HQ-curated featured games. hq_featured is operator-managed and
// world-readable; game_ref is either 'builtin:<id>' (a flagship ArgantaLab game)
// or a games.id (a cloud / kid-made game). The Ship "picks" rail is driven
// entirely by this — no static placeholders.
export interface FeaturedGame {
  id: string; name: string; hue: number; builtin: boolean
  html?: string; desc?: string; tags?: string[]
}

export async function loadFeatured(): Promise<FeaturedGame[]> {
  if (!cloudEnabled) return []
  const { data, error } = await supabase.from('hq_featured').select('game_ref, rank').order('rank')
  if (error || !data || data.length === 0) return []

  const out: FeaturedGame[] = []
  const cloudIds: string[] = []
  for (const row of data) {
    const ref = row.game_ref as string
    if (ref.startsWith('builtin:')) {
      const g = GAMES.find(x => x.id === ref.slice('builtin:'.length))
      if (g) out.push({ id: g.id, name: g.name, hue: g.hue, builtin: true, desc: g.desc, tags: g.tags })
    } else {
      cloudIds.push(ref)
      out.push({ id: ref, name: '…', hue: 250, builtin: false })
    }
  }

  if (cloudIds.length) {
    const { data: games } = await supabase.from('games').select('id,title,html,category').in('id', cloudIds)
    for (const g of (games ?? [])) {
      const f = out.find(o => o.id === g.id && !o.builtin)
      if (f) { f.name = g.title as string; f.html = g.html as string; f.tags = g.category ? [g.category as string] : [] }
    }
  }
  // drop any cloud refs that couldn't be resolved (deleted/private)
  return out.filter(f => f.builtin || !!f.html)
}
