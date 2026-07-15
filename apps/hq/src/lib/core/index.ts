// C3 · Arganta Core — the public entry. Wires @arganta/agent's pure loop (C1)
// to the real model caller (runtime.ts) and tool executor (tools.ts), and
// persists the turn through the C2 thread/message substrate. This is the
// FIRST place all three land together — the "digital twin can actually do
// things in a conversation" milestone.
import { runAgentLoop, toOpenAITools, availableTools, makeBlock, AUTONOMY, TOOL_SPECS } from '@arganta/agent'
import { makeCoreCallModel } from './runtime'
import { coreExecuteTool, WIRED_BUILDER_SPECS, type ToolResult } from './tools'
import { createThread, appendMessage, loadMessages, listRecentThreads, type CoreMessage } from './thread'

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
export async function sendMessage(threadId: string, userText: string): Promise<SendMessageResult> {
  const history = await loadMessages(threadId)
  const messages: any[] = [
    { role: 'system', content: SYSTEM_PROMPT },
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
  const trailBlocks: Record<string, unknown>[] = []
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
  const { text, trail, stopReason } = await runAgentLoop({
    messages, tools, callModel, executeTool, maxSteps: 4, autonomyLevel: AUTONOMY.ON_DEMAND,
  })

  const costUsd = trail.reduce((s: number, t: any) => s + (t.costUsd || 0), 0)
  const finalText = text || FALLBACK_TEXT_FOR[stopReason] || `(Stopped: ${stopReason}. Nothing was fabricated.)`

  // The last 'model' trail entry is the call that produced finalText — its
  // provider/model is the turn's own provenance, truthful even when no tool
  // ran (loop.js already tracks this; sendMessage just wasn't surfacing it).
  const lastModelCall = [...trail].reverse().find((t: any) => t.type === 'model')
  const provider = lastModelCall?.provider ?? null
  const model = lastModelCall?.model ?? null

  const blocks = [...trailBlocks, ...(finalText ? [makeBlock('text', { text: finalText })] : []), ...collectedBlocks]
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
