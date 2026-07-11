// P4 — the agentic layer. Tools are thin wrappers over the SAME live RPCs +
// scenarios + models the dashboards already use, exposed as OpenAI function-calls
// so a capable model can PLAN: pick tools, read the real results, iterate, then
// synthesise one recommendation. Grounded end-to-end (every number is live SQL),
// so it reasons agentically without fabricating.
import { live } from './live'
import { scenarioById, SCENARIOS } from './scenarios'
import { PRESETS, DEFAULT_GLOBALS, computeScenario } from './monetization'

type Tool = { name: string; description: string; parameters: unknown; run: (args: any) => Promise<unknown> }

const trim = (o: unknown) => JSON.stringify(o ?? null)

export const AGENT_TOOLS: Tool[] = [
  { name: 'sense_growth', description: 'Live growth overview: weekly active, WoW, stickiness, wow%, accuracy, learners.', parameters: { type: 'object', properties: {} }, run: async () => live.growthOverview() },
  { name: 'sense_economy', description: 'Live diamond economy: minted, spent, float, sink coverage, starter grant.', parameters: { type: 'object', properties: {} }, run: async () => live.economy() },
  { name: 'content_matrix', description: 'Content coverage: authored vs live items across worlds/skills.', parameters: { type: 'object', properties: {} }, run: async () => live.contentMatrix() },
  { name: 'schema_insights', description: 'Schema/telemetry insights: learners, public games, data health.', parameters: { type: 'object', properties: {} }, run: async () => live.schemaInsights() },
  { name: 'portfolio_vc', description: 'Investor metrics: activation, D1 retention, flywheel, spend/kid, lessons 7d.', parameters: { type: 'object', properties: {} }, run: async () => live.portfolioVc() },
  {
    name: 'run_scenario', description: `Run a named analysis scenario. Valid ids: ${SCENARIOS.map((s) => s.id).join(', ')}.`,
    parameters: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
    run: async (a) => { const s = scenarioById(a?.id); return s ? await s.run() : { error: 'unknown scenario' } },
  },
  {
    name: 'model_monetization', description: 'Revenue model at N active families for a pricing preset (low|mid|high).',
    parameters: { type: 'object', properties: { preset: { type: 'string' }, families: { type: 'number' } }, required: ['preset'] },
    run: async (a) => { const p = (PRESETS as any)[a?.preset] || PRESETS.mid; return computeScenario(p, a?.families || 10000, DEFAULT_GLOBALS) },
  },
]

const ORCH_SYSTEM = `You are the CEO Agent of a small edtech company (ArgantaLab + KinetikCircle).
You have tools that return LIVE data. Plan: call the tools you need, read the real results,
then give ONE decisive recommendation to the human founder. Never invent numbers — if a tool
returns null/offline, say the data isn't wired yet. Be concise and specific. Markdown-lite ok.`

// The agentic loop. Returns the final text + the tools it actually called.
// Degrades safely: with the mock provider (no live model) it returns immediately
// so the caller can fall back to the deterministic path.
export async function orchestrate(
  prompt: string,
  ai: { chatTools: (o: any) => Promise<any>; chat: (o: any) => Promise<any> },
  onTool?: (name: string) => void,
): Promise<{ text: string; calls: string[] }> {
  const tools = AGENT_TOOLS.map((t) => ({ name: t.name, description: t.description, parameters: t.parameters }))
  const messages: any[] = [{ role: 'system', content: ORCH_SYSTEM }, { role: 'user', content: prompt }]
  const calls: string[] = []
  for (let step = 0; step < 4; step++) {
    const res = await ai.chatTools({ task: 'orchestrate', messages, tools })
    if (res.provider === 'mock') return { text: '', calls } // signal caller to use the deterministic path
    if (Array.isArray(res.toolCalls) && res.toolCalls.length) {
      messages.push({ role: 'assistant', content: res.text || '', tool_calls: res.toolCalls.map((c: any) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args || {}) } })) })
      for (const c of res.toolCalls) {
        const tool = AGENT_TOOLS.find((t) => t.name === c.name)
        let data: unknown
        try { data = tool ? await tool.run(c.args || {}) : { error: 'unknown tool' } } catch (e) { data = { error: String((e as Error)?.message || e) } }
        calls.push(c.name); onTool?.(c.name)
        messages.push({ role: 'tool', tool_call_id: c.id, name: c.name, content: trim(data).slice(0, 2000) })
      }
      continue
    }
    return { text: res.text || '', calls } // model answered without (more) tools
  }
  const fin = await ai.chat({ task: 'brief', messages: [...messages, { role: 'user', content: 'Now give the final recommendation.' }] })
  return { text: fin.text || '', calls }
}
