import { supabase, cloudEnabled } from '../lib/supabase'
import type { SchemaModel, SchemaInsights, Ontology } from './types'

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
