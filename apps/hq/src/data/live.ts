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

  async publishGame(game: {
    id: string; title: string; config: Record<string, unknown>; html: string
    userId: string; creatorName?: string
  }): Promise<boolean> {
    if (!cloudEnabled) return false
    const { error } = await supabase
      .from('games')
      .upsert({
        id: game.id,
        user_id: game.userId,
        title: game.title,
        source: 'wizard',
        config: game.config,
        html: game.html,
        visibility: 'public',
        creator_name: game.creatorName || 'Circle HQ',
      })
    if (error) console.warn('[hq] publishGame →', error.message)
    return !error
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

  async saveOntology(o: Ontology): Promise<boolean> {
    if (!cloudEnabled) return false
    const { error } = await supabase
      .from('hq_ontology')
      .insert({ model: o, generated_by: o.generatedBy || 'deterministic' })
    if (error) console.warn('[hq] saveOntology →', error.message)
    return !error
  },
}

export { cloudEnabled }
