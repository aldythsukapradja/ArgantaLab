// agentFabric — the ONE agent registry, shared by the Architecture "Agents" view
// (the read-only atlas) and the Agent Studio surface (the operating room). Both
// import from here, so a node added once appears in both and the two can never
// drift — the structural fix for the "two ceo_ask brains" disease.
//
// This file is data + probes only (no JSX). Brand marks and rendering live in
// the surfaces that consume it.

import { siClaude, siOpenai, siCloudflare } from 'simple-icons'
import { comfyHealth } from '../lib/comfyClient'
import { AGENTS } from './agents'

// ── shared primitive types ──
export type Brain = 'sovereign' | 'claude' | 'codex'
export type AgentProv = 'live' | 'partial' | 'placeholder'
export type FabricLogo = { path: string; hex: string; title: string }

const L = {
  claude: siClaude as FabricLogo,
  oai: siOpenai as FabricLogo,
  cf: siCloudflare as FabricLogo,
}

export interface AgentNode {
  id: string
  layer: string
  label: string
  sub: string
  prov: AgentProv
  next?: boolean
  logos?: FabricLogo[]
  tech?: string
  repo?: string
  swap?: string
  headroom?: string
  detail?: string
  /** brand logomark rendered on the card */
  mark?: 'arganta' | 'claude' | 'openai'
  /** which local endpoint this node's live status comes from */
  probe?: 'bridge' | 'comfy' | 'always'
  /** per-brain control map (who drives this tab, and to do what) */
  brains?: { brain: Brain; what: string }[]
}

export interface AgentEdge { s: string; t: string; flow?: boolean; next?: boolean }
export interface AgentLayer { id: string; label: string; micro: string; purpose: string }

// ── the six bands of the command hierarchy ──
export const AGENT_LAYERS: AgentLayer[] = [
  { id: 'ag-command', label: 'Command', micro: 'the founder', purpose: 'One human in the loop. Every gate, approval and budget resolves to the founder.' },
  { id: 'ag-brains', label: 'Tri-Brain', micro: 'who thinks', purpose: 'Three brains, one seam: Sovereign (hands), Claude (creative director), Codex (engineer).' },
  { id: 'ag-tiers', label: 'Economy Tiers', micro: 'who pays', purpose: 'The four-tier router: cheapest capable intelligence wins, Frontier is approval-gated.' },
  { id: 'ag-fabric', label: 'Execution Fabric', micro: 'who acts', purpose: 'The endpoints that actually run things — bridge, ComfyUI, gateway, edge AI, MCP tools.' },
  { id: 'ag-roster', label: 'Advisory Roster', micro: 'who advises', purpose: 'The C-Level offices and named agents — advisory today, write-capable in Agent OS v2.' },
  { id: 'ag-surfaces', label: 'Controlled Surfaces', micro: 'what is driven', purpose: 'Every studio tab, mapped to the brain that drives it. Click a card for its tri-brain row.' },
]
export const AGENT_COLORS: Record<string, string> = {
  'ag-command': '#6366f1', 'ag-brains': '#e11d67', 'ag-tiers': '#d97706',
  'ag-fabric': '#0891b2', 'ag-roster': '#8b5cf6', 'ag-surfaces': '#0d9488',
}

export const BRAIN_META: Record<Brain, { label: string; c: string; mark: NonNullable<AgentNode['mark']> }> = {
  sovereign: { label: 'Sovereign', c: '#6366f1', mark: 'arganta' },
  claude: { label: 'Claude', c: '#D97757', mark: 'claude' },
  codex: { label: 'Codex', c: '#10A37F', mark: 'openai' },
}

export const AGENT_NODES: AgentNode[] = [
  // Command
  { id: 'founder', layer: 'ag-command', label: 'Founder', sub: 'command authority · approves every gate', prov: 'live', probe: 'always',
    detail: 'The single human in the loop. Side-effecting tools (deploy, push, migrations, spend, Frontier calls) pause here. Nothing publishes, spends or ships without this seat.' },
  { id: 'ag-core', layer: 'ag-command', label: 'Arganta Core', sub: 'chat cockpit · tri-brain capsules', prov: 'partial',
    repo: 'apps/hq/src/surfaces/core', tech: 'BrainToggle · BridgeConsole · Conversation',
    headroom: 'BrainSeam (T2) makes this seam reusable in every studio',
    detail: 'The cockpit where all three brains are addressed: Sovereign capsule (local chat + data), Claude capsule (bridge missions), Codex capsule (sandboxed code missions). Tri-Brain P1–P4 shipped 2026-07-18.' },

  // Tri-Brain
  { id: 'ag-sovereign', layer: 'ag-brains', label: 'Sovereign', sub: 'the HANDS · local · $0 always', prov: 'partial', mark: 'arganta', probe: 'always',
    tech: 'ComfyUI engines · deterministic browser engines · Supabase data', repo: 'apps/hq/src/lib/comfyClient.ts · packages/media-core',
    brains: [{ brain: 'sovereign', what: 'renders bytes: z-image slides, ACE-Step songs, Wan clips, synth audio, PNG/MP4 export, RPC charts' }],
    headroom: 'ARGANTA LoRA (O1) + pixel-LoRA land identity into the image engine',
    detail: 'Never talks — it produces. Local ComfyUI (image·music·video, live-verified), deterministic browser engines and the Supabase data plane. Zero marginal cost, works offline. If the output is bytes, it is Sovereign.' },
  { id: 'ag-claude', layer: 'ag-brains', label: 'Claude Code', sub: 'the CREATIVE DIRECTOR · plan-covered', prov: 'partial', mark: 'claude', probe: 'bridge',
    tech: 'Claude Agent SDK via the bridge · MCP tools', repo: 'tools/arganta-bridge · surfaces/core/BridgeConsole.tsx',
    brains: [{ brain: 'claude', what: 'makes content: drafts, captions, briefs, publishing runs through gates; full cross-studio missions' }],
    headroom: 'studio-context missions (T2) — inject the open doc/timeline into the mission',
    detail: 'Content, taste, orchestration. Runs on your machine via the Arganta Bridge (WS 7717) with approval gates from permissions.ts; drives MCP tools (content_draft, buffer, pixellab, media-gen). If the output is words, decisions or publishing, it is Claude.' },
  { id: 'ag-codex', layer: 'ag-brains', label: 'Codex', sub: 'the ENGINEER · sandboxed diffs', prov: 'partial', mark: 'openai', probe: 'bridge',
    tech: 'Codex CLI · workspace-write · network off', repo: 'tools/arganta-bridge/src/engines/codex.ts',
    brains: [{ brain: 'codex', what: 'changes the software itself: features, fixes, refactors — v1 sandbox-blocks instead of asking' }],
    headroom: 'v2 wires Codex approval callbacks for gated-action parity with Claude',
    detail: 'Terse; produces diffs. Same bridge, second engine — sandboxed at workspace-write with network off, so it cannot deploy or spend. Reports token usage, never a fabricated dollar figure. If the output is a diff, it is Codex.' },

  // Economy tiers
  { id: 'ag-router', layer: 'ag-tiers', label: 'Four-Tier Router', sub: '@arganta/ai · cheapest capable wins', prov: 'live',
    repo: 'packages/ai', tech: 'tiers · policy · governance · ledger (8/8 tests)',
    detail: 'Every Sovereign-brain LLM task routes here: benchmark floor, data-class guardrails, mission budgets, honest ledger. Confidential data is forced local; Frontier needs approval.' },
  { id: 'ag-t0', layer: 'ag-tiers', label: 'Tier 0 · Sovereign', sub: 'local WebLLM · deterministic · $0', prov: 'partial',
    detail: 'costClass 0 — in-browser WebGPU inference and deterministic engines. The default floor for every task; the Sovereign Completion Rate gauge measures how much stays here.' },
  { id: 'ag-t1', layer: 'ag-tiers', label: 'Tier 1 · Sponsored', sub: 'free API quotas · Gemini·Groq·CF', prov: 'partial',
    headroom: 'more Sponsored keys set = less Frontier spend', detail: 'costClass 1 — free-quota providers through the gateway. Keys partially set; every key added here directly cuts paid spend.' },
  { id: 'ag-t2', layer: 'ag-tiers', label: 'Tier 2 · Economy', sub: 'cheap paid · DeepSeek · fal.ai', prov: 'partial',
    detail: 'costClass 2 — cheap metered providers, blocked for confidential data. fal.ai is the planned Economy media step-up.' },
  { id: 'ag-t3', layer: 'ag-tiers', label: 'Tier 3 · Frontier', sub: 'Claude · GPT · approval-gated', prov: 'partial', logos: [L.claude, L.oai],
    detail: 'costClass 3 — frontier models. Always requires approval; maxFrontierCalls defaults to 0 in mission budgets. The Claude/Codex BRAINS bypass this ledger (plan-auth on your machine), which is a known metering gap.' },

  // Execution fabric
  { id: 'ag-bridge', layer: 'ag-fabric', label: 'Arganta Bridge', sub: 'WS 127.0.0.1:7717 · two engines', prov: 'partial', probe: 'bridge',
    repo: 'tools/arganta-bridge', tech: 'Agent SDK query() + Codex CLI · OutEvent feed · mission persistence',
    headroom: 'run migration_missions_engine.sql; add an HTTP /health route for cheap probing',
    detail: 'The local agent server: token-gated WebSocket that drives Claude Agent SDK and Codex CLI missions, streams tool/message/approval events, and persists missions. Both non-Sovereign brains flow through this one seam.' },
  { id: 'ag-comfy', layer: 'ag-fabric', label: 'ComfyUI', sub: '127.0.0.1:8188 · z-image · ACE-Step · Wan', prov: 'partial', probe: 'comfy',
    repo: 'apps/hq/src/lib/comfyClient.ts', tech: 'CORS-direct from the browser · no proxy, no billing',
    headroom: 'O-track: LoRA training + pixel fabric (loras folder currently empty)',
    detail: 'The Sovereign media engine room. Three byte-faithful graphs verified live 2026-07-18: image (z-image), music (ACE-Step 1.5), video (Wan 5B). Status dot and engine inventory here are a real /system_stats probe.' },
  { id: 'ag-gateway', layer: 'ag-fabric', label: 'llm-proxy Gateway', sub: 'Supabase Edge Fn · ⚠ flaky', prov: 'partial',
    repo: 'supabase/functions/llm-proxy',
    headroom: 'known-bad: returns non-2xx, aiLive is untrustworthy — route studio copilots through the bridge instead (T-track)',
    detail: 'The Tier 1–3 provider gateway. Deployed but unreliable: studio copilots that depend on it silently mock. The BrainSeam plan replaces this dependency with the bridge you actually run.' },
  { id: 'ag-cfai', layer: 'ag-fabric', label: 'Cloudflare Workers AI', sub: 'FLUX image · Aura TTS · bge embeddings', prov: 'partial', logos: [L.cf],
    repo: 'supabase/functions/media-proxy', detail: 'The free edge workhorse — image, TTS and 768-dim embeddings, live and verified. Sovereign-adjacent: sponsored, not local.' },
  { id: 'ag-mcp', layer: 'ag-fabric', label: 'MCP Tools', sub: 'content_draft · buffer · pixellab · media-gen', prov: 'partial',
    detail: 'The Claude brain\'s hands: drafting to the Content inbox, Buffer queueing (operator still approves), PixelLab generation, free-tier media. Real and connected when Claude runs.' },
  { id: 'ag-loop', layer: 'ag-fabric', label: '@arganta/agent Loop', sub: 'bounded · budgeted · autonomy-gated', prov: 'partial',
    repo: 'packages/agent', detail: 'The pure, node-testable agentic kernel behind the Sovereign chat: budget caps, step caps, honest degrade, tool translators for both OpenAI and Anthropic shapes.' },

  // Advisory roster
  { id: 'ag-clevel', layer: 'ag-roster', label: 'C-Level · 6 offices', sub: 'CEO·COO·CTO·CFO·GC·CAPO', prov: 'partial',
    detail: 'Advisory offices over the ecosystem graph — read-only consultation the Core chat can invoke. Write-capable versions are the Agent OS v2 roadmap.' },
  { id: 'ag-agents', layer: 'ag-roster', label: `${AGENTS.length} named agents`, sub: 'advisory roster · no hands yet', prov: 'partial',
    repo: 'apps/hq/src/data/agents.ts',
    headroom: 'Agent OS v2: act-tools → draft → review queue turns advisors into builders',
    detail: 'The named agent roster shown in the Agent orb. Today they advise; none can act. Agent OS v2 (specced, not built) gives them draft-only tools feeding a founder review queue.' },
  { id: 'ag-missions', layer: 'ag-roster', label: 'Mission Runner', sub: 'scheduled autonomy · pg_cron', prov: 'placeholder', next: true,
    detail: 'Planned: scheduled autonomous missions through the bridge under the same gates. pg_cron is installed and idle; nothing runs unattended today — by design, until the review queue exists.' },

  // Controlled surfaces — the tab × brain map
  { id: 'ag-spost', layer: 'ag-surfaces', label: 'Post Studio', sub: 'carousel design · publish', prov: 'partial',
    brains: [
      { brain: 'sovereign', what: 'z-image slide backgrounds, PNG compose/export, deterministic copy fallback' },
      { brain: 'claude', what: 'Copilot prompt→carousel, captions, /post-batch, Buffer/Moment publishing' },
      { brain: 'codex', what: 'new platform presets, sticker packs, template authoring' },
    ] },
  { id: 'ag-saudio', layer: 'ag-surfaces', label: 'Audio Studio', sub: 'songs · themes · SFX', prov: 'partial',
    brains: [
      { brain: 'sovereign', what: 'ACE-Step songs, synth themes/SFX, recording, voice audition' },
      { brain: 'claude', what: 'Composer chat (mood→theme, lyrics), audio briefs, naming/tagging' },
      { brain: 'codex', what: 'new instruments, SFX cues, scale/chord additions' },
    ] },
  { id: 'ag-svideo', layer: 'ag-surfaces', label: 'Video Studio', sub: 'clips · timeline · export', prov: 'partial',
    brains: [
      { brain: 'sovereign', what: 'Wan clips, timeline render/export, formant voice' },
      { brain: 'claude', what: 'Director chat (brief→storyboard→scenes), scripts, publish runs' },
      { brain: 'codex', what: 'transitions, text animations, export presets' },
    ] },
  { id: 'ag-spixel', layer: 'ag-surfaces', label: 'Pixel Forge', sub: 'sprites · vault · briefs', prov: 'partial',
    brains: [
      { brain: 'sovereign', what: 'ComfyUI pixel one-offs, palette ops, vault queries' },
      { brain: 'claude', what: 'fulfils Forge briefs via PixelLab MCP, tags ingest, gap triage' },
      { brain: 'codex', what: 'new facets, sprite-sheet slicer, vault tooling' },
    ] },
  { id: 'ag-sforge', layer: 'ag-surfaces', label: 'Builder Forge', sub: 'apps · games · artifacts', prov: 'partial',
    brains: [
      { brain: 'sovereign', what: 'deterministic app/game engines' },
      { brain: 'claude', what: 'brief→app chat' },
      { brain: 'codex', what: 'THE Codex home: real code missions on generated artifacts' },
    ] },
  { id: 'ag-smedia', layer: 'ag-surfaces', label: 'Media Center', sub: 'engines · queue · rack', prov: 'partial',
    brains: [
      { brain: 'sovereign', what: 'Sovereign Rack: engines, queue, test renders' },
      { brain: 'claude', what: '"generate this week\'s asset needs" batch missions' },
      { brain: 'codex', what: 'pipeline and tooling missions' },
    ] },
]

export const AGENT_EDGES: AgentEdge[] = [
  { s: 'founder', t: 'ag-core', flow: true },
  { s: 'ag-core', t: 'ag-sovereign', flow: true }, { s: 'ag-core', t: 'ag-claude', flow: true }, { s: 'ag-core', t: 'ag-codex' },
  { s: 'ag-sovereign', t: 'ag-router', flow: true },
  { s: 'ag-router', t: 'ag-t0' }, { s: 'ag-router', t: 'ag-t1' }, { s: 'ag-router', t: 'ag-t2' }, { s: 'ag-router', t: 'ag-t3' },
  { s: 'ag-sovereign', t: 'ag-comfy', flow: true }, { s: 'ag-t1', t: 'ag-cfai' }, { s: 'ag-t1', t: 'ag-gateway' }, { s: 'ag-t2', t: 'ag-gateway' }, { s: 'ag-t3', t: 'ag-gateway' },
  { s: 'ag-claude', t: 'ag-bridge', flow: true }, { s: 'ag-codex', t: 'ag-bridge', flow: true },
  { s: 'ag-bridge', t: 'ag-mcp' }, { s: 'ag-router', t: 'ag-loop' },
  { s: 'ag-loop', t: 'ag-clevel' }, { s: 'ag-loop', t: 'ag-agents' },
  { s: 'ag-agents', t: 'ag-missions', next: true }, { s: 'ag-bridge', t: 'ag-missions', next: true },
  { s: 'ag-comfy', t: 'ag-spost' }, { s: 'ag-comfy', t: 'ag-saudio' }, { s: 'ag-comfy', t: 'ag-svideo' }, { s: 'ag-comfy', t: 'ag-spixel' },
  { s: 'ag-mcp', t: 'ag-spost' }, { s: 'ag-mcp', t: 'ag-spixel' },
  { s: 'ag-bridge', t: 'ag-sforge' }, { s: 'ag-cfai', t: 'ag-smedia' },
]

// ── live status probes — real handshakes, never painted ──
export type AgentStatus = 'connected' | 'offline' | 'checking'

/** WebSocket handshake against the local bridge (uses the saved url + token). */
export function probeBridge(): Promise<AgentStatus> {
  return new Promise((res) => {
    try {
      const url = (localStorage.getItem('hq_bridge_url') || 'ws://127.0.0.1:7717').replace(/\/+$/, '')
      const token = localStorage.getItem('hq_bridge_token') || ''
      const ws = new WebSocket(`${url}/?token=${encodeURIComponent(token)}`)
      const t = setTimeout(() => { try { ws.close() } catch { /* ignore */ } res('offline') }, 3500)
      ws.onopen = () => { clearTimeout(t); try { ws.close() } catch { /* ignore */ } res('connected') }
      ws.onerror = () => { clearTimeout(t); res('offline') }
    } catch { res('offline') }
  })
}

/** ComfyUI /system_stats probe → status + a one-line engine inventory. */
export async function probeComfy(): Promise<{ status: AgentStatus; info: string | null }> {
  try {
    const h = await comfyHealth()
    if (!h.up) return { status: 'offline', info: null }
    const info =
      `image ${h.image.present ? '✓' : '—'} · music ${h.music.present ? '✓' : '—'} · video ${h.video.present ? '✓' : '—'}`
      + (h.vramFreeGB != null ? ` · ${h.vramFreeGB.toFixed(1)} GB VRAM free` : '')
      + (h.queueDepth != null ? ` · queue ${h.queueDepth}` : '')
    return { status: 'connected', info }
  } catch { return { status: 'offline', info: null } }
}

/** Resolve a node's live status from its probe kind + the current probe results. */
export function statusForNode(n: AgentNode, bridge: AgentStatus, comfy: AgentStatus): AgentStatus | undefined {
  return n.probe === 'always' ? 'connected' : n.probe === 'bridge' ? bridge : n.probe === 'comfy' ? comfy : undefined
}
