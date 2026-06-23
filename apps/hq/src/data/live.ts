import { supabase, cloudEnabled } from '../lib/supabase'
import type { SchemaModel, SchemaInsights, Ontology } from './types'

export interface PublishedGame {
  id: string
  title: string
  source: string
  config: Record<string, unknown> | null
  html: string
  visibility: string
  plays: number
  created_at: string
  creator_name?: string
  category?: string | null
  description?: string | null
  tags?: string[] | null
  age_min?: number | null
  age_max?: number | null
  thumbnail?: string | null
  version?: number | null
}

export interface AppManifest {
  id: string
  name: string
  product: string                       // 'kinetik' | 'arganta' | future
  category?: string | null
  audience?: string[] | null
  circle_types?: string[] | null
  status?: string | null                // 'live' | 'beta' | 'planned'
  owner?: string | null
  metrics?: string[] | null
  economy_hooks?: Record<string, unknown> | null
  agent_surfaces?: string[] | null
  created_at?: string
}

export interface GamePublishInput {
  id: string
  title: string
  html: string
  userId: string
  creatorName?: string
  category?: string
  description?: string
  tags?: string[]
  ageMin?: number | null
  ageMax?: number | null
  thumbnail?: string
  visibility?: string
  circle_ids?: string[]
}

export interface CircleMember {
  id: string
  name: string
  avatar?: string
  kind: 'parent' | 'child'
  role: 'admin' | 'member'
  joined_at?: string
}

export interface Circle {
  id: string
  name: string
  kind: 'family' | 'kids' | 'class' | 'friends'
  emoji?: string
  owner_id: string
  members: CircleMember[]
  member_count?: number
  created_at?: string
}

// Thin typed wrappers over the operator RPCs. Every call returns null when the
// project isn't wired or the user isn't an operator — callers render an empty
// state rather than dummy data.
async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!cloudEnabled) return null
  const { data, error } = await supabase.rpc(fn, args)
  if (error) {
    console.warn(`[hq] ${fn} →`, error.message)
    return null
  }
  return (data ?? null) as T | null
}

export const live = {
  schemaModel: () => rpc<SchemaModel>('hq_schema_model'),
  schemaInsights: () => rpc<SchemaInsights>('hq_schema_insights'),
  tablePreview: (table: string, limit = 20) =>
    rpc<Record<string, unknown>[]>('hq_table_preview', { p_table: table, p_limit: limit }),
  latestOntology: () => rpc<Ontology>('hq_latest_ontology'),

  async listGames(): Promise<PublishedGame[]> {
    if (!cloudEnabled) return []
    // Try operator RPC first (sees all games across users); fall back to own+public via RLS
    const rpcResult = await rpc<PublishedGame[]>('hq_list_games')
    if (rpcResult) return rpcResult
    const { data, error } = await supabase
      .from('games')
      .select('id, title, source, config, html, visibility, plays, created_at, creator_name')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) { console.warn('[hq] listGames →', error.message); return [] }
    return (data || []) as PublishedGame[]
  },

  async publishGame(game: GamePublishInput): Promise<boolean> {
    if (!cloudEnabled) return false
    const visibility = game.visibility || 'public'
    const { error } = await supabase
      .from('games')
      .upsert({
        id: game.id,
        user_id: game.userId,
        title: game.title,
        source: 'procode',
        config: { category: game.category ?? null, source: 'code' },
        html: game.html,
        visibility,
        circle_ids: game.circle_ids || null,
        creator_name: game.creatorName || 'KinetikCircle',
        category: game.category ?? null,
        description: game.description ?? null,
        tags: game.tags ?? [],
        age_min: game.ageMin ?? null,
        age_max: game.ageMax ?? null,
        thumbnail: game.thumbnail ?? null,
      })
    if (error) { console.warn('[hq] publishGame →', error.message); return false }
    // Snapshot a version (best-effort; ignore failure so publish still succeeds)
    await supabase.rpc('snapshot_game_version', { p_game: game.id })
    return true
  },

  async unpublishGame(id: string): Promise<boolean> {
    if (!cloudEnabled) return false
    const { error } = await supabase
      .from('games')
      .update({ visibility: 'private' })
      .eq('id', id)
    if (error) console.warn('[hq] unpublishGame →', error.message)
    return !error
  },

  async listApps(): Promise<AppManifest[]> {
    if (!cloudEnabled) return []
    const { data, error } = await supabase
      .from('hq_app')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) { console.warn('[hq] listApps →', error.message); return [] }
    return (data || []) as AppManifest[]
  },

  async saveApp(app: AppManifest): Promise<boolean> {
    if (!cloudEnabled) return false
    const { error } = await supabase.from('hq_app').upsert({
      id: app.id,
      name: app.name,
      product: app.product,
      category: app.category ?? null,
      audience: app.audience ?? [],
      circle_types: app.circle_types ?? [],
      status: app.status ?? 'live',
      owner: app.owner ?? null,
      metrics: app.metrics ?? [],
      economy_hooks: app.economy_hooks ?? {},
      agent_surfaces: app.agent_surfaces ?? [],
    })
    if (error) console.warn('[hq] saveApp →', error.message)
    return !error
  },

  async saveOntology(o: Ontology): Promise<boolean> {
    if (!cloudEnabled) return false
    const { error } = await supabase
      .from('hq_ontology')
      .insert({ model: o, generated_by: o.generatedBy || 'deterministic' })
    if (error) console.warn('[hq] saveOntology →', error.message)
    return !error
  },

  // ── KinetikCircle Integration ──

  async listUserCircles(): Promise<Circle[]> {
    if (!cloudEnabled) return []
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from('circles')
      .select(`
        id, name, kind, emoji, owner_id, created_at,
        circle_members (
          id: member_id, member_kind, role, joined_at
        )
      `)
      .eq('owner_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('[hq] listUserCircles →', error.message)
      return []
    }

    // Enrich members with profile data
    const circles: Circle[] = []
    for (const circle of data || []) {
      const memberIds = (circle.circle_members || []).map((m: any) => m.id).filter(Boolean)
      if (memberIds.length === 0) continue

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, photo_url')
        .in('id', memberIds)

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

      const members: CircleMember[] = (circle.circle_members || []).map((m: any) => {
        const profile = profileMap.get(m.id)
        return {
          id: m.id,
          name: profile?.display_name || 'Unknown',
          avatar: profile?.photo_url,
          kind: m.member_kind,
          role: m.role,
          joined_at: m.joined_at,
        }
      })

      circles.push({
        id: circle.id,
        name: circle.name,
        kind: circle.kind,
        emoji: circle.emoji,
        owner_id: circle.owner_id,
        members,
        member_count: members.length,
        created_at: circle.created_at,
      })
    }

    return circles
  },

  async getCircle(circleId: string): Promise<Circle | null> {
    if (!cloudEnabled) return null

    const { data: circle, error: circleError } = await supabase
      .from('circles')
      .select(`
        id, name, kind, emoji, owner_id, created_at,
        circle_members (
          id: member_id, member_kind, role, joined_at
        )
      `)
      .eq('id', circleId)
      .single()

    if (circleError) {
      console.warn('[hq] getCircle →', circleError.message)
      return null
    }

    const memberIds = (circle.circle_members || []).map((m: any) => m.id).filter(Boolean)
    if (memberIds.length === 0) {
      return {
        id: circle.id,
        name: circle.name,
        kind: circle.kind,
        emoji: circle.emoji,
        owner_id: circle.owner_id,
        members: [],
        member_count: 0,
        created_at: circle.created_at,
      }
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, photo_url')
      .in('id', memberIds)

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || [])

    const members: CircleMember[] = (circle.circle_members || []).map((m: any) => {
      const profile = profileMap.get(m.id)
      return {
        id: m.id,
        name: profile?.display_name || 'Unknown',
        avatar: profile?.photo_url,
        kind: m.member_kind,
        role: m.role,
        joined_at: m.joined_at,
      }
    })

    return {
      id: circle.id,
      name: circle.name,
      kind: circle.kind,
      emoji: circle.emoji,
      owner_id: circle.owner_id,
      members,
      member_count: members.length,
      created_at: circle.created_at,
    }
  },
}

export { cloudEnabled }
