// C3 · Arganta Core — the public entry. Wires @arganta/agent's pure loop (C1)
// to the real model caller (runtime.ts) and tool executor (tools.ts), and
// persists the turn through the C2 thread/message substrate. This is the
// FIRST place all three land together — the "digital twin can actually do
// things in a conversation" milestone.
import { runAgentLoop, toOpenAITools, availableTools, makeBlock, AUTONOMY, TOOL_SPECS, registerToolSpecs } from '@arganta/agent'
import { makeCoreCallModel } from './runtime'
import { coreExecuteTool, WIRED_BUILDER_SPECS, type ToolResult } from './tools'

// Make the builder tools (create_website/create_application/revise_artifact/…)
// resolvable by the loop's autonomy gate — they're OFFERED to the model but live
// in @arganta/builder, so without this the loop refuses them as `unknown-tool`.
registerToolSpecs(WIRED_BUILDER_SPECS as any)
import { createThread, appendMessage, loadMessages, listRecentThreads, type CoreMessage } from './thread'
import { embedTextViaGateway } from '../mediaGateway'
import { supabase, cloudEnabled } from '../supabase'

export { createThread, loadMessages, listRecentThreads, type CoreMessage }

const SYSTEM_PROMPT = `You are Arganta Core, the founder's digital-twin assistant for ArgantaLab.
You can make real things: images, voice clips, websites, single-file applications, slide decks, brand
kits, and data charts — via tools, not by describing them. Use tools when the founder asks you to MAKE
or SHOW something. Prefer create_website/create_application over make_website when the founder wants a
real usable artifact (vs. a quick throwaway page) — they run real AI generation, not just a template.
Once a tool call succeeds, do NOT call it again for the same request — respond to the founder in text
instead. Every turn must end with a text reply to the founder, even a short one.
Be concise and direct. Never invent numbers or claim something was made when a tool failed — say so plainly.`

// Every stop reason must produce SOME reply — a silent empty message (e.g.
// the loop exhausting max-steps mid tool-call-spree) is a real UX dead end,
// not just a missing "nice to have". Honest, not a fabricated answer.
const FALLBACK_TEXT_FOR: Record<string, string> = {
  'no-model': '(No live model reachable right now — nothing was fabricated. Check your Cloudflare/Supabase connection.)',
  'max-steps': '(Ran out of turns before finishing — see the actions above. Try asking again, more specifically.)',
  budget: '(Stopped to stay within this session\'s cost budget — see the actions above.)',
  error: '(Something went wrong mid-turn — see the actions above.)',
}

// When a tool already produced a REAL, saved artifact but the FOLLOW-UP model
// call (the one that writes a caption after the tool ran) couldn't reach a live
// model, the plain "no live model — nothing was fabricated" reads as "nothing
// happened" even though the image/site/etc. is right there and saved. This
// acknowledges the real output truthfully instead. Only used when the loop
// stopped for a model-availability reason (no-model/max-steps) AND at least one
// tool produced an artifact block this turn.
const PARTIAL_SUCCESS_TEXT_FOR: Record<string, string> = {
  'no-model': "(Done — what you asked for is above and saved. I couldn't add a written note this turn: the follow-up model call didn't reach a live model (often a brief free-tier hiccup). Nothing was faked on top of the real result.)",
  'max-steps': "(Done — what you asked for is above and saved. I ran out of turns before writing a summary; the artifact itself is real. Ask again if you'd like me to describe or refine it.)",
}

// C5 · Auto-recall — runs every turn, BEFORE the loop, unconditionally
// (unlike search_vault, which the model must decide to call). Deliberately
// a TIGHTER dataClass ceiling than search_vault's manual 'confidential':
// this is background/automatic access, not an explicit human-in-the-loop
// tool call, so it earns less trust to see the founder's most sensitive
// notes (same ADR-0003 spirit — how deliberate an access is shapes how much
// it's allowed to see). Founder can still reach confidential notes by
// explicitly asking Core to search the Vault, which routes through
// search_vault's higher ceiling instead.
const AUTO_RECALL_MAX_DATA_CLASS = 'internal'
const AUTO_RECALL_K = 4
const AUTO_RECALL_MIN_SIMILARITY = 0.5

async function autoRecall(query: string): Promise<{ block: Record<string, unknown> | null; systemAddendum: string | null; costUsd: number }> {
  if (!cloudEnabled) return { block: null, systemAddendum: null, costUsd: 0 }
  const e = await embedTextViaGateway({ text: query })
  if (!e) return { block: makeBlock('tool-trail', { tool: 'auto_recall', provider: null, model: null, costUsd: 0, latencyMs: 0, ok: false }), systemAddendum: null, costUsd: 0 }

  const { data, error } = await supabase.rpc('memory_search', { p_embedding: e.embedding, p_k: AUTO_RECALL_K, p_max_data_class: AUTO_RECALL_MAX_DATA_CLASS })
  const block = makeBlock('tool-trail', { tool: 'auto_recall', provider: e.provider, model: e.model, costUsd: e.costUsd, latencyMs: e.latencyMs, ok: !error })
  if (error || !data) return { block, systemAddendum: null, costUsd: e.costUsd }

  const hits = (data as any[]).filter((r) => r.similarity >= AUTO_RECALL_MIN_SIMILARITY)
  if (!hits.length) return { block, systemAddendum: null, costUsd: e.costUsd }

  const addendum = "Relevant context recalled from the founder's Vault (may or may not apply to this specific message — use your judgment, don't force a connection):\n" +
    hits.map((h) => `- ${h.content}`).join('\n')
  return { block, systemAddendum: addendum, costUsd: e.costUsd }
}

export interface SendMessageResult {
  text: string
  blocks: Record<string, unknown>[]
  stopReason: string
  costUsd: number
  /** Provider/model of the LAST real model call this turn (null if every call
   * degraded to mock) — surfaces the loop's own trail so the UI can show
   * truthful provenance even on a plain text reply with no tool calls. C4a
   * requires this on every assistant message, not just artifact cards. */
  provider: string | null
  model: string | null
}

/**
 * One turn: persist the user message, run the loop, persist the assistant's
 * reply (with rich blocks from any tools it called), return both for the UI.
 * threadId is required — callers create one via createThread() first (kept
 * separate so a UI can show the thread in the rail before the first reply
 * lands).
 */
export async function sendMessage(threadId: string, userText: string, opts: { signal?: AbortSignal } = {}): Promise<SendMessageResult> {
  const [history, recall] = await Promise.all([loadMessages(threadId), autoRecall(userText)])
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...(recall.systemAddendum ? [{ role: 'system', content: recall.systemAddendum }] : []),
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: userText },
  ]

  await appendMessage({ id: crypto.randomUUID(), threadId, role: 'user', content: userText })

  const runId = crypto.randomUUID()
  const callModel = makeCoreCallModel({ dataClass: 'public', runId })

  // Adapter boundary (see tools.ts comment): coreExecuteTool returns a richer
  // {data, block, costUsd} shape than loop.js's frozen executeTool contract
  // wants (a flat object it shows the model AND reads .costUsd off of).
  // Flatten here for the loop; build the RICH tool-trail block here too
  // (provider/model included) rather than reconstructing from loop.js's trail
  // entries, which only carry {name,ok,costUsd,latencyMs} by design (C1-frozen
  // shape) — this is the only place that still has the full tool result.
  const collectedBlocks: Record<string, unknown>[] = []
  const trailBlocks: Record<string, unknown>[] = recall.block ? [recall.block] : []
  const executeTool = async (name: string, args: Record<string, unknown>) => {
    const t0 = performance.now()
    const result: ToolResult = await coreExecuteTool(name, args)
    const latencyMs = Math.round(performance.now() - t0)
    const flat = { ...(result.data as object), costUsd: result.costUsd ?? 0 }
    const ok = !('error' in flat)
    trailBlocks.push(makeBlock('tool-trail', { tool: name, provider: (flat as any).provider ?? null, model: (flat as any).model ?? null, costUsd: result.costUsd ?? 0, latencyMs, ok }))
    if (result.block) collectedBlocks.push(makeBlock(blockKindFor(name), result.block))
    return flat
  }

  const tools = toOpenAITools(availableTools([...TOOL_SPECS, ...WIRED_BUILDER_SPECS], { autonomous: false, maxCostClass: 1 }))

  // Genuine mid-call cancellation would mean threading an AbortSignal through
  // C1's frozen loop.js — out of scope for an additive UI change. This is an
  // honest client-side abort instead: we stop AWAITING the loop and persist
  // whatever real tool-trail blocks completed before the abort, plus a plain
  // note that the founder stopped it — never claiming the loop itself halted
  // mid-model-call, and never fabricating a "completed" reply it didn't reach.
  let aborted = false
  const loopPromise = runAgentLoop({
    messages, tools, callModel, executeTool, maxSteps: 4, autonomyLevel: AUTONOMY.ON_DEMAND,
  })
  const result = opts.signal
    ? await Promise.race([
        loopPromise,
        new Promise<{ text: string; trail: any[]; stopReason: string }>((resolve) => {
          opts.signal!.addEventListener('abort', () => {
            aborted = true
            resolve({ text: '', trail: [], stopReason: 'aborted' })
          }, { once: true })
        }),
      ])
    : await loopPromise

  const { text, stopReason } = result
  const trail = aborted ? [] : result.trail
  const costUsd = recall.costUsd + trail.reduce((s: number, t: any) => s + (t.costUsd || 0), 0)
  // A tool produced a real, saved artifact this turn (image/site/deck/etc.) —
  // so a "no live model" stop is a PARTIAL success (the artifact is real), not a
  // total failure. Pick the honest message accordingly.
  const producedRealArtifact = collectedBlocks.length > 0
  const finalText = aborted
    ? '(Stopped — you ended this turn. Actions completed above are real; nothing after that ran.)'
    : (text
        || (producedRealArtifact && PARTIAL_SUCCESS_TEXT_FOR[stopReason])
        || FALLBACK_TEXT_FOR[stopReason]
        || `(Stopped: ${stopReason}. Nothing was fabricated.)`)

  // The last 'model' trail entry is the call that produced finalText — its
  // provider/model is the turn's own provenance, truthful even when no tool
  // ran (loop.js already tracks this; sendMessage just wasn't surfacing it).
  const lastModelCall = [...trail].reverse().find((t: any) => t.type === 'model')
  const provider = lastModelCall?.provider ?? null
  const model = lastModelCall?.model ?? null

  // A blocked tool call (governance refused it, e.g. a non-autonomy-safe tool
  // requested on-demand) never reaches executeTool, so trailBlocks never sees
  // it — loop.js's own trail is the only place it's recorded. Surface it
  // honestly as an 'error' block (BLOCK_KINDS is frozen with no dedicated
  // 'blocked' kind) rather than silently dropping a refusal the founder should
  // see. The UI (ArtifactCard's blocked variant) renders this distinctly.
  const blockedBlocks = trail
    .filter((t: any) => t.type === 'tool' && t.blocked)
    .map((t: any) => makeBlock('error', { message: `needs approval to run ${t.name} (${t.blocked}) — not run automatically.` }))

  const blocks = [...trailBlocks, ...blockedBlocks, ...(finalText ? [makeBlock('text', { text: finalText })] : []), ...collectedBlocks]
  await appendMessage({ id: crypto.randomUUID(), threadId, role: 'assistant', content: finalText, blocks, runId })

  return { text: finalText, blocks, stopReason, costUsd, provider, model }
}

function blockKindFor(toolName: string): string {
  if (toolName === 'generate_image') return 'image'
  if (toolName === 'generate_speech') return 'audio'
  if (toolName === 'make_website') return 'website'
  if (toolName === 'create_website') return 'website'
  // no separate 'application' block kind (C1-frozen BLOCK_KINDS) — an app is
  // still a single-file HTML artifact, rendered the same as a website block.
  if (toolName === 'create_application') return 'website'
  if (toolName === 'revise_artifact') return 'website'
  if (toolName === 'restore_version') return 'website'
  if (toolName === 'make_deck') return 'deck'
  if (toolName === 'make_brand') return 'brand'
  if (toolName === 'analyze') return 'chart'
  if (toolName === 'consult_office') return 'delegation'
  return 'text'
}
