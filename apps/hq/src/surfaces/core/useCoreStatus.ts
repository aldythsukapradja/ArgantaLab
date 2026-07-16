// Live status for the Core composer: which LLM is the ready "brain" right now,
// plus the free-tier quota gauges (Cloudflare neurons + Gemini/Groq usage today).
// Honest by construction: the ready brain comes from the SAME selectModel() the
// turn loop uses; usage counts come from the truthful agent_runs ledger; caps
// that no provider exposes live are labelled estimates by the consumer.
import { useEffect, useState } from 'react'
import { selectModel } from '@arganta/ai'
import { intelligenceRegistry } from '../../lib/ai'
import { getNeuronQuota } from '../../lib/mediaGateway'
import { supabase, cloudEnabled } from '../../lib/supabase'

// Google's published free-tier requests/day for Flash (est.; Gemini exposes no
// live remaining-quota API). Groq's free tier is far larger and also not exposed
// live, so we show its usage count without a hard cap.
export const GEMINI_FREE_RPD_EST = 250

/** Friendly short label for a raw upstream model id (what the ledger records). */
export function friendlyModel(model: string | null | undefined): string {
  const m = (model || '').toLowerCase()
  if (!m || m === 'mock') return 'offline'
  if (m.includes('gemini')) return 'Gemini Flash'
  if (m === 'llama-3.3-70b-versatile') return 'Groq Llama 3.3'
  if (m.startsWith('@cf/')) return 'Cloudflare'
  if (m.includes('claude')) return 'Claude'
  if (m.includes('deepseek')) return 'DeepSeek'
  return model || 'model'
}

export interface CoreStatus {
  /** The model selectModel WOULD pick for a chat turn right now (the "ready brain"). */
  readyBrain: { label: string; apiModel: string } | null
  neurons: { used: number; cap: number; error?: string } | null
  geminiToday: number
  groqToday: number
}

export function useCoreStatus(refreshKey: number): CoreStatus {
  const [status, setStatus] = useState<CoreStatus>({ readyBrain: null, neurons: null, geminiToday: 0, groqToday: 0 })

  useEffect(() => {
    // Ready brain — pure, no network. Same routing the loop uses.
    const picked = selectModel(intelligenceRegistry, { task: 'orchestrate', dataClass: 'public' })?.model as any
    const readyBrain = picked ? { label: friendlyModel(picked.apiModel), apiModel: picked.apiModel } : null
    setStatus((s) => ({ ...s, readyBrain }))

    if (!cloudEnabled) return
    let cancelled = false
    ;(async () => {
      const [neuron, recent] = await Promise.all([
        getNeuronQuota().catch(() => null),
        supabase.rpc('agent_runs_recent', { p_limit: 100, p_domain: null }).then((r) => (r.data as any[]) || []).catch(() => [] as any[]),
      ])
      if (cancelled) return
      const today = new Date().toDateString()
      const isToday = (r: any) => { const at = r.createdAt || r.created_at; return at && new Date(at).toDateString() === today }
      const modelOf = (r: any) => (r.actualModel || r.actual_model || '').toLowerCase()
      const geminiToday = recent.filter((r) => isToday(r) && modelOf(r).includes('gemini')).length
      const groqToday = recent.filter((r) => isToday(r) && modelOf(r) === 'llama-3.3-70b-versatile').length
      setStatus((s) => ({
        ...s,
        neurons: neuron
          ? (neuron.error ? { used: 0, cap: 0, error: neuron.error } : { used: neuron.neuronsUsedToday ?? 0, cap: neuron.freePerDay })
          : null,
        geminiToday,
        groqToday,
      }))
    })()
    return () => { cancelled = true }
  }, [refreshKey])

  return status
}
