// C3 · Arganta Core — the public entry. Wires @arganta/agent's pure loop (C1)
// to the real model caller (runtime.ts) and tool executor (tools.ts), and
// persists the turn through the C2 thread/message substrate. This is the
// FIRST place all three land together — the "digital twin can actually do
// things in a conversation" milestone.
import { runAgentLoop, toOpenAITools, availableTools, makeBlock, AUTONOMY } from '@arganta/agent'
import { makeCoreCallModel } from './runtime'
import { coreExecuteTool, type ToolResult } from './tools'
import { createThread, appendMessage, loadMessages, listRecentThreads, type CoreMessage } from './thread'

export { createThread, loadMessages, listRecentThreads, type CoreMessage }

const SYSTEM_PROMPT = `You are Arganta Core, the founder's digital-twin assistant for ArgantaLab.
You can make real things: images, voice clips, websites, slide decks, brand kits, and data charts —
via tools, not by describing them. Use tools when the founder asks you to MAKE or SHOW something.
Be concise and direct. Never invent numbers or claim something was made when a tool failed — say so plainly.`

export interface SendMessageResult {
  text: string
  blocks: Record<string, unknown>[]
  stopReason: string
  costUsd: number
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
  const callModel = makeCoreCallModel({ dataClass: 'internal', runId })

  // Adapter boundary (see tools.ts comment): coreExecuteTool returns a richer
  // {data, block, costUsd} shape than loop.js's frozen executeTool contract
  // wants (a flat object it shows the model AND reads .costUsd off of).
  // Flatten here; stash blocks in a side-channel keyed by tool name+order so
  // they can be attached to the final assistant message after the loop ends.
  const collectedBlocks: Record<string, unknown>[] = []
  const executeTool = async (name: string, args: Record<string, unknown>) => {
    const result: ToolResult = await coreExecuteTool(name, args)
    if (result.block) collectedBlocks.push(makeBlock(blockKindFor(name), result.block))
    return { ...(result.data as object), costUsd: result.costUsd ?? 0 }
  }

  const tools = toOpenAITools(availableTools(undefined, { autonomous: false, maxCostClass: 1 }))
  const { text, trail, stopReason } = await runAgentLoop({
    messages, tools, callModel, executeTool, maxSteps: 4, autonomyLevel: AUTONOMY.ON_DEMAND,
  })

  const trailBlocks = trail
    .filter((t: any) => t.type === 'tool')
    .map((t: any) => makeBlock('tool-trail', { tool: t.name, ok: t.ok, latencyMs: t.latencyMs, costUsd: t.costUsd }))

  const costUsd = trail.reduce((s: number, t: any) => s + (t.costUsd || 0), 0)
  const finalText = stopReason === 'no-model'
    ? '(No live model reachable right now — nothing was fabricated. Check your Cloudflare/Supabase connection.)'
    : text

  const blocks = [...trailBlocks, ...(finalText ? [makeBlock('text', { text: finalText })] : []), ...collectedBlocks]
  await appendMessage({ id: crypto.randomUUID(), threadId, role: 'assistant', content: finalText, blocks, runId })

  return { text: finalText, blocks, stopReason, costUsd }
}

function blockKindFor(toolName: string): string {
  if (toolName === 'generate_image') return 'image'
  if (toolName === 'generate_speech') return 'audio'
  if (toolName === 'make_website') return 'website'
  if (toolName === 'make_deck') return 'deck'
  if (toolName === 'make_brand') return 'brand'
  if (toolName === 'analyze') return 'chart'
  if (toolName === 'consult_office') return 'delegation'
  return 'text'
}
