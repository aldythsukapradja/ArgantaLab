// Founder's chosen default LLM ("brain"), shared across the app. Null = Auto
// (the router picks the cheapest capable model, current behaviour). When set to
// a model id, the chat AND any client-side ai.* call that doesn't pass an
// explicit model will prefer it. Pure localStorage store — no registry import
// (keeps it free of the ai.ts import cycle); callers resolve the id → ModelSpec
// against the registry themselves.
const KEY = 'hq_llm_preference_v1'

type Listener = (id: string | null) => void
const listeners = new Set<Listener>()

export function getPreferredModelId(): string | null {
  try { return localStorage.getItem(KEY) || null } catch { return null }
}

export function setPreferredModelId(id: string | null): void {
  try {
    if (id) localStorage.setItem(KEY, id)
    else localStorage.removeItem(KEY)
  } catch { /* private mode / SSR */ }
  listeners.forEach((l) => l(id))
}

/** Subscribe to preference changes (returns an unsubscribe fn). */
export function subscribePreferredModel(l: Listener): () => void {
  listeners.add(l)
  return () => { listeners.delete(l) }
}
