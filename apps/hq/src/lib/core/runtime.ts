// C3 · Arganta Core runtime — wires @arganta/agent's PURE loop (C1) to the
// REAL model caller. `orchestrate` is the task policy that already requires
// `caps:['tools']` at a Sponsored floor (packages/ai/src/policy.js) — this
// reuses selectModel() directly (same registry, same governance, same
// data-class rules) rather than intelligence.ask(), which doesn't support
// tool-calling. Every call is logged to agent_runs (same lineage pattern as
// everywhere else this session).
import { selectModel, isRouteAllowed } from '@arganta/ai'
import { ai, intelligenceRegistry, logAgentRun } from '../ai'

export interface CoreCallModelResult {
  text?: string
  toolCalls?: { id: string; name: string; args: Record<string, unknown> }[]
  provider?: string
  model?: string
  costUsd?: number
}

/**
 * The loop's `callModel` contract (packages/agent/src/loop.js). Picks the
 * cheapest tools-capable model for `dataClass`, calls it, logs the run, and
 * returns the truthful shape the loop expects. Never throws — an unrouteable
 * request degrades to `{provider:'mock'}`, which the pure loop already
 * recognizes as "no live model" (honest degrade, never a fabricated answer).
 */
export function makeCoreCallModel(o: { dataClass?: string; runId: string } ) {
  // 'public' by default — general conversation is free to route through the
  // Sponsored tier (same precedent as content-intelligence.ts's Website/Deck
  // copy). 'internal' blocks costClass 1 by governance (ADR-0003), which would
  // silently force every ordinary chat message to a paid Economy model. Tools
  // that touch real sensitive data (analyze) declare their OWN stricter
  // dataClass at the tool-spec level regardless of this default.
  const dataClass = o.dataClass ?? 'public'
  return async function coreCallModel({ messages, tools }: { messages: unknown[]; tools: unknown[] }): Promise<CoreCallModelResult> {
    const { model: picked, reason } = selectModel(intelligenceRegistry, { task: 'orchestrate', dataClass })
    if (!picked || !isRouteAllowed(picked, dataClass)) {
      console.warn('[core runtime] no tools-capable model:', reason)
      return { provider: 'mock' }
    }
    const t0 = performance.now()
    const out = await ai.chatTools({ task: 'orchestrate', messages, tools, provider: picked.provider, model: picked.apiModel })
    const latencyMs = Math.round(performance.now() - t0)
    const silentlyMocked = out.provider === 'mock' && picked.provider !== 'mock'

    logAgentRun({
      runId: o.runId, domain: 'llm', task: 'orchestrate', dataClass,
      requestedCostClass: picked.costClass, actualCostClass: out.tier ?? picked.costClass,
      requestedProvider: picked.provider, requestedModel: picked.apiModel,
      actualProvider: silentlyMocked ? 'mock' : (out.provider ?? picked.provider), actualModel: silentlyMocked ? 'mock' : (out.model ?? picked.apiModel),
      costUsd: out.costUsd ?? 0, latencyMs, status: silentlyMocked ? 'failed' : 'succeeded',
      error: silentlyMocked ? `requested ${picked.provider} but adapter fell back to mock` : null,
    })

    if (silentlyMocked) return { provider: 'mock' } // truthfulness gate — never present mock as real
    return {
      text: out.text || '',
      toolCalls: (out.toolCalls || []).map((c: any) => ({ id: c.id, name: c.name, args: c.args || {} })),
      provider: out.provider, model: out.model, costUsd: out.costUsd ?? 0,
    }
  }
}
