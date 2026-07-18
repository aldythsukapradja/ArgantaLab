import { useEffect, useMemo, useState } from 'react'
import {
  ReactFlow, Background, Controls, MiniMap, Handle, Position, BackgroundVariant,
  BaseEdge, getSmoothStepPath,
  type Node, type Edge, type NodeProps, type EdgeProps, type MiniMapNodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import './architecture.css'
import {
  siPostgresql, siSupabase, siVercel, siReact, siTypescript, siOpenai, siClaude, siCloudflare,
} from 'simple-icons'
import { X } from 'lucide-react'
import { useHQ } from '../shell/store'
import { live } from '../data/live'
import type { SchemaInsights, SchemaModel, GrowthOverview, EngagementData } from '../data/types'
import type { KinetikStats } from '../data/live'
import { fmtDur } from '../components/d3/chartkit'
import { compact } from '../lib/format'
import { ArgantaMark } from './core/ArgantaMark'
import { ClaudeMark } from './core/ClaudeMark'
import { OpenAIMark } from './core/OpenAIMark'
import {
  AGENT_LAYERS, AGENT_COLORS, AGENT_NODES, AGENT_EDGES, BRAIN_META,
  probeBridge, probeComfy, type Brain, type AgentStatus,
} from '../data/agentFabric'

// Architecture — the Arganta OS backbone as one React Flow graph, reconciled to
// the reactor's seven-layer model (Command Core → Think → Know → Orchestrate →
// Act → Experience → Sense) plus a Shared Spine. Three views do three jobs:
//   Core   — the mental model (the seven layers, one glance)
//   System — the real shipped backbone, live metrics + honest provenance badges
//   Scale  — NOW → NEXT, what each layer needs to survive 10×
// Every node carries truthful provenance (live / partial / story / planned) —
// never a placeholder painted as measured.

type View = 'core' | 'system' | 'scale' | 'agents'
type Prov = 'live' | 'partial' | 'simulated' | 'placeholder'
type Logo = { path: string; hex: string; title: string }

const REDUCED = typeof window !== 'undefined'
  && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Layer accent colours — legible on both themes.
const LC: Record<LayerId, string> = {
  command: '#6366f1', think: '#0891b2', know: '#8b5cf6', orchestrate: '#e11d67',
  act: '#d97706', experience: '#0d9488', sense: '#10b981', spine: '#64748b',
}
const SC: Record<StackId, string> = {
  client: '#6366f1', app: '#0d9488', agentic: '#e11d67', ai: '#d97706',
  ml: '#8b5cf6', data: '#0891b2', platform: '#64748b', observ: '#10b981',
}
// Resolve a layer id (either lens) to its accent.
const colorOf = (id: string): string => (LC as Record<string, string>)[id] ?? (SC as Record<string, string>)[id] ?? AGENT_COLORS[id] ?? '#6366f1'
const L = { pg: siPostgresql, sb: siSupabase, vc: siVercel, react: siReact, ts: siTypescript, oai: siOpenai, claude: siClaude, cf: siCloudflare } as Record<string, Logo>

// dark marks (e.g. Cloudflare/Vercel) get the theme text colour so they read on dark.
function fill(hex: string): string {
  const n = parseInt(hex, 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255
  return (0.299 * r + 0.587 * g + 0.114 * b) < 60 ? 'var(--tx)' : `#${hex}`
}

const PROV: Record<Prov, { label: string; cls: string }> = {
  live: { label: 'live', cls: 'p-live' },
  partial: { label: 'partial', cls: 'p-partial' },
  simulated: { label: 'story', cls: 'p-sim' },
  placeholder: { label: 'planned', cls: 'p-plan' },
}

// Two lenses over the SAME nodes:
//   organs — Arganta's own reactor taxonomy (how we think about it)
//   stack  — the classical layered reference architecture (how a partner would
//            replicate it on any tech stack). This is the agnostic story made
//            legible to a technical audience: every layer is vendor-swappable.
type Lens = 'organs' | 'stack'
interface LayerDef { id: string; label: string; micro: string; purpose: string }

// ── Organs lens — reactor taxonomy, verbatim verbs ──
type LayerId = 'command' | 'think' | 'know' | 'orchestrate' | 'act' | 'experience' | 'sense' | 'spine'
const LAYERS: LayerDef[] = [
  { id: 'command', label: 'Command Core', micro: 'govern', purpose: 'Founder intent, North Star, governance and approval rights — the seat of authority.' },
  { id: 'think', label: 'Think', micro: 'decide', purpose: 'Reasoning and model selection — the four-tier router picks the cheapest capable intelligence.' },
  { id: 'know', label: 'Know', micro: 'remember', purpose: 'The living operational memory — Vault, vectors, the one Postgres schema, provenance.' },
  { id: 'orchestrate', label: 'Orchestrate', micro: 'coordinate', purpose: 'The agent loop routes, assembles context, delegates and escalates under autonomy gates.' },
  { id: 'act', label: 'Act', micro: 'execute', purpose: 'The hands — builders, media engines, Cloudflare Workers AI, skills and MCP tools.' },
  { id: 'experience', label: 'Experience', micro: 'serve', purpose: 'Where capability becomes value — the five products, Circle HQ and the living page.' },
  { id: 'sense', label: 'Sense', micro: 'learn', purpose: 'The nerves — every run, beat and event, metered honestly and fed back.' },
  { id: 'spine', label: 'Shared Spine', micro: 'carry', purpose: 'The platform everything rests on — auth, storage, realtime, edge, delivery.' },
]

// ── Stack lens — classical N-tier reference architecture (presentation → infra) ──
type StackId = 'client' | 'app' | 'agentic' | 'ai' | 'ml' | 'data' | 'platform' | 'observ'
const STACK_LAYERS: LayerDef[] = [
  { id: 'client', label: 'UI / UX · Client', micro: 'present', purpose: 'Presentation tier — every app, the HQ cockpit, the living page. Any web frontend.' },
  { id: 'app', label: 'Application', micro: 'build', purpose: 'Business logic and capability — builders, media engines, the tool surface. Portable services.' },
  { id: 'agentic', label: 'Agentic Orchestration', micro: 'coordinate', purpose: 'The autonomous layer — chat kernel, agent loop, delegation, governance. Model-agnostic.' },
  { id: 'ai', label: 'AI · Inference', micro: 'infer', purpose: 'LLM + generative inference — the four-tier router routes to the cheapest capable provider.' },
  { id: 'ml', label: 'ML · Vectors', micro: 'embed', purpose: 'Embeddings, vector memory and retrieval — pgvector today, any vector store.' },
  { id: 'data', label: 'Data · Persistence', micro: 'store', purpose: 'System of record — one relational schema and the knowledge base. Any managed Postgres.' },
  { id: 'platform', label: 'Platform · Infrastructure', micro: 'run', purpose: 'Auth, storage, realtime, edge compute and delivery. Vendor-swappable at every seam.' },
  { id: 'observ', label: 'Observability · Telemetry', micro: 'measure', purpose: 'The metered feedback loop — every run, beat and event. Standard sinks.' },
]

// Lock-in tier — the portability read a partner needs. `portable` = our own
// code/data, runs anywhere; `swappable` = a vendor seam with real migration
// work; `locked` = hard vendor dependency. Defaults to portable (our code).
type Lock = 'portable' | 'swappable' | 'locked'
const LOCK_OF: Record<string, Lock> = {
  supabase: 'swappable', cloudflare: 'swappable', vercel: 'swappable', postgres: 'swappable',
  memory: 'swappable', gateway: 'swappable', cfai: 'swappable', falai: 'swappable', modal: 'swappable',
}
const lockOf = (id: string): Lock => LOCK_OF[id] ?? 'portable'
const LOCK_LABEL: Record<Lock, string> = { portable: 'Portable · runs on any host', swappable: 'Swappable · vendor seam, migration work', locked: 'Vendor-locked' }
// Single points of failure — the failure-domain story a CTO probes first.
const SPOF: Record<string, string> = {
  supabase: 'Carries identity, the system-of-record, realtime and vectors — one blast radius. Mitigated by portability: data + auth move to any Postgres + GoTrue.',
}

// Node → classical-stack layer (kept separate so the node defs stay untouched).
const STACK_OF: Record<string, StackId> = {
  core: 'agentic', clevel: 'agentic', gov: 'agentic', agent: 'agentic', roster: 'agentic', cron: 'agentic',
  router: 'ai', rack: 'ai', gateway: 'ai', cfai: 'ai', falai: 'ai', modal: 'ai',
  memory: 'ml', rag: 'ml',
  vault: 'data', postgres: 'data',
  builder: 'app', media: 'app', tools: 'app',
  hqb: 'client', arganta: 'client', kinetik: 'client', lashira: 'client', landing: 'client',
  'client-tier': 'client',
  ledger: 'observ', beats: 'observ', events: 'observ',
  supabase: 'platform', cloudflare: 'platform', vercel: 'platform',
}

// ── The nodes — real systems, honest provenance ──
interface NodeDef {
  id: string; layer: string; label: string; sub: string; prov: Prov
  next?: boolean; logos?: Logo[]
  tech?: string; repo?: string; swap?: string; headroom?: string; detail?: string
  seriesKey?: string
  /** Per-item trust & safety posture (badged truthfully, item by item). */
  safety?: { label: string; prov: Prov }[]
  /** Container node (C4 altitude fix) — ids of the real nodes it groups, drill-down in the inspector. */
  children?: string[]
  /** Quantitative headroom — only set where a real measured denominator exists. */
  util?: { used: number; cap: number; label: string }
  /** Agents view — brand logomark rendered on the card. */
  mark?: 'arganta' | 'claude' | 'openai'
  /** Agents view — which local endpoint this node's live status comes from. */
  probe?: 'bridge' | 'comfy' | 'always'
  /** Agents view — per-brain control map (who drives this tab, and to do what). */
  brains?: { brain: Brain; what: string }[]
}
const NODES: NodeDef[] = [
  // Command Core — govern
  { id: 'core', layer: 'command', label: 'Arganta Core', sub: 'agentic chat kernel · digital twin', prov: 'partial', seriesKey: 'core',
    tech: '@arganta/agent loop · C3 runtime · tool-calling', repo: 'apps/hq/src/lib/core · packages/agent',
    swap: 'model-agnostic — every reply routes through @arganta/ai', headroom: 'streaming + per-user threads before real concurrency',
    detail: 'The ported working brain: a bounded, budgeted, autonomy-gated tool loop that reasons, calls real tools (image, TTS, builder, vault search, office consult) and degrades honestly. Renamed from CEO Orb.' },
  { id: 'clevel', layer: 'command', label: 'C-Level · 6 offices', sub: 'CEO·COO·CTO·CFO·GC·CAPO', prov: 'partial',
    detail: 'Six advisory offices over the ecosystem graph. Read-only today; write-capable agents are the Agent OS v2 roadmap.' },
  { id: 'gov', layer: 'command', label: 'Governance & Trust', sub: 'approval gates · trust & safety', prov: 'partial',
    tech: 'governance.js · autonomy gate', repo: 'packages/ai · packages/agent',
    detail: 'Data-class guardrails, the autonomy ladder, and child-safety posture. Confidential data is forced local; side-effecting tools need approval. Because Arganta serves children, consent and data-handling are first-class here — badged honestly below.',
    safety: [
      { label: 'Guardian-run circles (structural consent)', prov: 'partial' },
      { label: 'Age gating', prov: 'placeholder' },
      { label: 'Verifiable parental consent (COPPA)', prov: 'placeholder' },
      { label: 'Minor data retention & deletion', prov: 'placeholder' },
    ] },

  // Think — decide
  { id: 'router', layer: 'think', label: 'Four-Tier Router', sub: 'Sovereign → Sponsored → Economy → Frontier', prov: 'live', logos: [L.claude, L.oai],
    tech: '@arganta/ai · tiers/policy/governance/ledger', repo: 'packages/ai',
    swap: 'any LLM — the cheapest capable tier wins, provider never hidden', headroom: 'more Sponsored keys (Gemini/Groq) to cut Frontier spend',
    detail: 'The multi-LLM spine. Routes every task to the lowest-cost intelligence that passes the benchmark floor: local WebLLM (free) → free API quotas → cheap paid → Claude/OpenAI. Shipped and tested.' },
  { id: 'rack', layer: 'think', label: 'Model Rack', sub: 'live runs feed · SCR gauge', prov: 'partial', seriesKey: 'core',
    repo: 'apps/hq/src/surfaces/rack', detail: 'Four tier columns, Sovereign Completion Rate, and a truthful per-run feed: actual provider · model · cost · latency · status.' },
  { id: 'gateway', layer: 'think', label: 'LLM Gateway', sub: 'llm-proxy · Gemini·Groq·DeepSeek·Claude', prov: 'partial',
    tech: 'Supabase Edge Function · router.js', repo: 'supabase/functions/llm-proxy',
    swap: 'move to Cloudflare Workers when async / multi-user arrives',
    detail: 'The truthful gateway: real provider translation (Anthropic Messages shape included), bounded fallback, cheapest-first. Deployed; needs more provider keys set.' },

  // Know — remember
  { id: 'vault', layer: 'know', label: 'Vault', sub: 'knowledge base · graph v3', prov: 'partial', seriesKey: undefined,
    repo: 'apps/hq/src/vault', detail: 'Obsidian-style founder vault, 300+ notes on a PixiJS + d3-force graph. The evidence store the agent searches.' },
  { id: 'memory', layer: 'know', label: 'Core Memory', sub: 'memory_chunk · pgvector 768d', prov: 'partial',
    tech: 'pgvector 0.8 · CF bge-base-en-v1.5', repo: 'supabase/migration_arganta_core.sql',
    headroom: 'the RAG recall + rerank layer is the next build (Scale)',
    detail: 'Conversation memory with real 768-dim embeddings from Cloudflare bge. Live-verified cosine ranking. The substrate RAG sits on.' },
  { id: 'postgres', layer: 'know', label: 'PostgreSQL', sub: 'the base · one schema, every app', prov: 'live', logos: [L.pg], seriesKey: undefined,
    tech: 'Supabase Postgres · RLS · SECURITY DEFINER RPCs', repo: 'supabase/', swap: 'any managed Postgres',
    headroom: 'read replicas + partitioning on the beats/ledger tables at 10×',
    detail: 'One schema behind every product. Real tables, real diamond float, real game counts — measured live.' },
  { id: 'rag', layer: 'know', label: 'Graph-RAG', sub: 'recall · rerank', prov: 'placeholder', next: true,
    detail: 'Planned: retrieve over memory_chunk + the vault graph, rerank, ground answers. The embeddings already flow; the recall loop is next.' },

  // Orchestrate — coordinate
  { id: 'agent', layer: 'orchestrate', label: 'Agent Loop', sub: '@arganta/agent · bounded · gated', prov: 'partial',
    tech: 'pure loop · translators · autonomy gate', repo: 'packages/agent',
    swap: 'OpenAI + Anthropic tool shapes both translated', headroom: 'delegation protocol (one level) + mission runner',
    detail: 'The ported working agent: a pure, node-testable agentic loop — budget caps, step caps, honest degrade. Generalises the old orchestrate() into a reusable kernel.' },
  { id: 'roster', layer: 'orchestrate', label: 'Agent Roster', sub: '31 advisory agents', prov: 'partial',
    repo: 'apps/hq/src/data/agents.ts', detail: 'The current agent roster — advisory today. Agent OS v2 turns these into build/analytics agents that draft artifacts into a review queue.' },
  { id: 'cron', layer: 'orchestrate', label: 'Heartbeat', sub: 'pg_cron · autonomy', prov: 'placeholder', next: true,
    detail: 'Planned: scheduled autonomous runs via pg_cron/pg_net through a service-role path (ADR-0004). Installed, idle today.' },

  // Act — execute
  { id: 'builder', layer: 'act', label: 'Single-File Builder', sub: '@arganta/builder · validate → publish', prov: 'partial',
    tech: 'kernel + validate-as-gate + versioning', repo: 'packages/builder · apps/hq/src/builder-core',
    headroom: 'the public runtime (build.arganta.app) is B5', detail: 'Lovable-lite: one complete HTML file, create → revise → validate → version → publish, driven by Core chat or the visual Builder. B1–B3 shipped with real persistence.' },
  { id: 'cfai', layer: 'act', label: 'Cloudflare Workers AI', sub: 'FLUX image · Aura TTS · bge embeddings', prov: 'partial', logos: [L.cf],
    tech: 'Workers AI · media-proxy', repo: 'supabase/functions/media-proxy',
    swap: 'Sponsored media tier — fal.ai is the Economy step up', headroom: 'move runtime onto CF Workers for async media',
    detail: 'The workhorse: free image generation (FLUX-schnell), TTS (Aura-1) and 768-dim embeddings, all live and verified. Cloudflare does action; Supabase keeps memory.' },
  { id: 'media', layer: 'act', label: 'Media Engines', sub: '@arganta/media-core · image·audio·video·brand', prov: 'partial',
    repo: 'packages/media-core · apps/hq/src/surfaces/media', headroom: 'premium fulfilment (fal.ai / Veo / ElevenLabs) gated behind approval',
    detail: 'Maturity-staged generation: deterministic Stage-0 always runs first (real PNG/audio/video), then routes up to paid providers only on approval.' },
  { id: 'tools', layer: 'act', label: 'Skills · MCP Tools', sub: 'GitHub · Supabase actions', prov: 'partial',
    detail: 'The tool surface the agent invokes — skills, MCP servers, repo and database actions. Real, but not yet fully wired into the autonomous loop.' },
  { id: 'falai', layer: 'act', label: 'fal.ai', sub: 'Economy media tier', prov: 'placeholder', next: true,
    detail: 'Planned: the primary paid, programmable media API — broad catalogue, per-gen, webhook-friendly. The next adapter after Cloudflare.' },
  { id: 'modal', layer: 'act', label: 'Modal', sub: 'cost-triggered self-host', prov: 'placeholder', next: true,
    detail: 'Deferred: self-host a workload only once its fal.ai spend proves it. Image endpoint written, undeployed.' },

  // Experience — serve
  { id: 'hqb', layer: 'experience', label: 'Circle HQ', sub: '11 builders · the cockpit', prov: 'partial', logos: [L.react, L.ts], seriesKey: 'hq',
    detail: 'This app — the operator cockpit and every builder (Game/App/Learn/Video/Music/Content/Character/Battle/World/Pixel/Agent).' },
  { id: 'arganta', layer: 'experience', label: 'ArgantaLab', sub: 'learn · KinQuest · diamonds', prov: 'partial', logos: [L.react, L.ts], seriesKey: 'arganta' },
  { id: 'kinetik', layer: 'experience', label: 'KinetikCircle', sub: 'circles · moments · KinFarm', prov: 'partial', logos: [L.react, L.ts], seriesKey: 'kinetik' },
  { id: 'lashira', layer: 'experience', label: 'LashiraBloom', sub: 'circle farm · 5 realms', prov: 'partial', logos: [L.react], seriesKey: 'lashira' },
  { id: 'landing', layer: 'experience', label: 'Landing', sub: 'living company page', prov: 'partial', logos: [L.react, L.ts], seriesKey: 'landing' },

  // Sense — learn
  { id: 'ledger', layer: 'sense', label: 'agent_runs ledger', sub: 'provider · model · cost · latency', prov: 'partial',
    repo: 'supabase/migration_agent_runs.sql', detail: 'The sensors: every AI run recorded with requested-vs-actual provider, cost and status. Powers the Model Rack and CAPO economics.' },
  { id: 'beats', layer: 'sense', label: 'Usage telemetry', sub: 'app_usage_beats · time-on-page', prov: 'partial', seriesKey: 'all',
    tech: '@arganta/usage in all 5 apps', headroom: 'the hq_engagement migration lands the last mile',
    detail: 'Time-on-page beats streamed from every app. The engagement RPC that reads them needs its migration applied.' },
  { id: 'events', layer: 'sense', label: 'Product & health events', sub: 'activation · retention · guardrails', prov: 'placeholder',
    detail: 'Planned: a unified product-event stream feeding activation, retention and operational-health signals back to Think.' },

  // Shared Spine — carry
  { id: 'supabase', layer: 'spine', label: 'Supabase', sub: 'Auth · RLS · Storage · Realtime · pgvector', prov: 'live', logos: [L.sb],
    swap: 'any Postgres + GoTrue + S3-compatible storage', headroom: 'Pro plan wildly underused — measured, not estimated',
    util: { used: 28, cap: 2_000_000, label: 'edge invocations / month' },
    detail: 'Truth and memory: identity, permissions, storage, realtime, and the vector store. The one place state lives.' },
  { id: 'cloudflare', layer: 'spine', label: 'Cloudflare', sub: 'Workers · R2 · edge · domain', prov: 'partial', logos: [L.cf],
    swap: 'any edge compute + CDN', headroom: 'Workers/Durable Objects/Queues for async, multi-user runtime',
    detail: 'The workhorse: action, routing, execution. Workers AI live; the full runtime migration off Edge Functions is triggered by the first async provider.' },
  { id: 'vercel', layer: 'spine', label: 'Vercel', sub: 'edge hosting · CDN · CI/CD', prov: 'partial', logos: [L.vc],
    swap: 'any static/edge host', detail: 'Delivery — the apps ship to the edge from here.' },
]

// C4 altitude fix: in System/Scale, don't show 6 products as peers of a
// technology like PostgreSQL — one Client-tier CONTAINER, drill down for the
// component-level detail. Core view (the mental model) keeps them as peers.
const CLIENT_TIER_IDS = ['hqb', 'arganta', 'kinetik', 'lashira', 'landing']
const CLIENT_CONTAINER: NodeDef = {
  id: 'client-tier', layer: 'experience', label: 'Client Applications', sub: `${CLIENT_TIER_IDS.length} products · the presentation tier`, prov: 'partial',
  swap: 'any web frontend — React/Vite today, the contract is framework-agnostic',
  detail: 'One container for every client surface — Circle HQ and the five products. This is Container-level altitude: click into a product below for its own component-level detail, tech and live metrics.',
  children: CLIENT_TIER_IDS,
}
const ALL_NODES: NodeDef[] = [...NODES, CLIENT_CONTAINER]

// Real inter-layer flow. `flow` marks the handful of true, animated data paths.
interface EdgeDef { s: string; t: string; flow?: boolean; next?: boolean }
const EDGES: EdgeDef[] = [
  { s: 'core', t: 'clevel' }, { s: 'core', t: 'gov' }, { s: 'core', t: 'router', flow: true },
  { s: 'router', t: 'gateway' }, { s: 'router', t: 'rack' }, { s: 'gateway', t: 'agent' },
  { s: 'router', t: 'agent', flow: true },
  { s: 'memory', t: 'agent' }, { s: 'vault', t: 'memory' },
  { s: 'agent', t: 'roster' }, { s: 'agent', t: 'builder', flow: true }, { s: 'agent', t: 'tools' },
  { s: 'agent', t: 'media' }, { s: 'agent', t: 'cfai' },
  { s: 'builder', t: 'hqb' }, { s: 'media', t: 'hqb' },
  { s: 'hqb', t: 'beats', flow: true },
  { s: 'arganta', t: 'beats' }, { s: 'kinetik', t: 'beats' }, { s: 'lashira', t: 'beats' },
  { s: 'landing', t: 'beats' },
  { s: 'beats', t: 'postgres', flow: true }, { s: 'ledger', t: 'rack' }, { s: 'events', t: 'router' },
  { s: 'memory', t: 'postgres' }, { s: 'postgres', t: 'supabase' },
  { s: 'cfai', t: 'cloudflare' }, { s: 'media', t: 'cloudflare' }, { s: 'gateway', t: 'supabase' },
  // NEXT
  { s: 'memory', t: 'rag', next: true }, { s: 'rag', t: 'postgres', next: true },
  { s: 'agent', t: 'falai', next: true }, { s: 'falai', t: 'modal', next: true },
  { s: 'gov', t: 'cron', next: true },
]

// ── Layout — auto-place nodes into stacked layer bands (no hand tuning) ──
const CARD_W = 190, GAP_X = 16, ROW_H = 122, GAP_Y = 14
const BAND_W = 1300, BAND_X = 20, BAND_TITLE = 44, BAND_PAD_B = 18, BAND_GAP = 22
const COLS = 6

interface BandBox { id: string; x: number; y: number; w: number; h: number; label: string; micro: string; c: string }
function buildLayout(nodes: NodeDef[], layers: LayerDef[], layerOf: (n: NodeDef) => string, showNext: boolean): { bands: BandBox[]; place: Record<string, { x: number; y: number }> } {
  const bands: BandBox[] = []
  const place: Record<string, { x: number; y: number }> = {}
  let y = 0
  for (const layer of layers) {
    const ns = nodes.filter(n => layerOf(n) === layer.id && (showNext || !n.next))
    if (ns.length === 0) continue
    const rows = Math.ceil(ns.length / COLS)
    const h = BAND_TITLE + rows * ROW_H + (rows - 1) * GAP_Y + BAND_PAD_B
    bands.push({ id: layer.id, x: BAND_X, y, w: BAND_W, h, label: layer.label, micro: layer.micro, c: colorOf(layer.id) })
    ns.forEach((n, i) => {
      const r = Math.floor(i / COLS), col = i % COLS
      const inRow = Math.min(COLS, ns.length - r * COLS)
      const rowW = inRow * CARD_W + (inRow - 1) * GAP_X
      const startX = BAND_X + (BAND_W - rowW) / 2
      place[n.id] = { x: startX + col * (CARD_W + GAP_X), y: y + BAND_TITLE + r * (ROW_H + GAP_Y) }
    })
    y += h + BAND_GAP
  }
  return { bands, place }
}

// The mark renderer (JSX — stays here where it's rendered; data lives in agentFabric).
const BrainMark = ({ mark, size = 13 }: { mark: NonNullable<NodeDef['mark']>; size?: number }) =>
  mark === 'arganta' ? <ArgantaMark size={size} /> : mark === 'claude' ? <ClaudeMark size={size} /> : <OpenAIMark size={size} />

// ── Node & edge renderers ──
interface CardData extends Record<string, unknown> { def: NodeDef; c: string; stats?: Stat[]; scale?: boolean; selected?: boolean; status?: AgentStatus }
interface Stat { l: string; raw: number; fmt: (n: number) => string }

function Count({ raw, fmt, run }: { raw: number; fmt: (n: number) => string; run: boolean }) {
  const [v, setV] = useState(run ? 0 : raw)
  useEffect(() => {
    if (!run) { setV(raw); return }
    let raf = 0; const t0 = performance.now(), ms = 850
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      setV(raw * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [raw, run])
  return <>{fmt(v)}</>
}

function CardNode({ data, selected }: NodeProps) {
  const d = data as CardData
  const def = d.def
  const stats = (d.stats || []) as Stat[]
  const p = PROV[def.prov]
  return (
    <div className={'af-card' + (def.next ? ' next' : '') + (selected ? ' sel' : '')} style={{ ['--af-c' as string]: d.c }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="af-head">
        <span className="t" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {def.mark && <BrainMark mark={def.mark} />}{def.label}
        </span>
        {d.status
          ? <span className={'af-live st-' + d.status} title={def.probe === 'always' ? 'always available — runs locally / deterministically' : 'live probe: ' + d.status}><i />{d.status === 'checking' ? '…' : d.status}</span>
          : <span className={'af-prov ' + p.cls} title={'provenance: ' + p.label}>{p.label}</span>}
      </div>
      <div className="s">{def.sub}</div>
      {stats.length > 0 && (
        <div className="af-stats">
          {stats.map(s => (
            <span key={s.l} className="af-stat"><b><Count raw={s.raw} fmt={s.fmt} run /></b> {s.l}</span>
          ))}
        </div>
      )}
      <div className="af-foot">
        {def.logos?.map((ic, i) => (
          <span key={i} className="af-logo" title={ic.title}>
            <svg viewBox="0 0 24 24" role="img" aria-label={ic.title}><path d={ic.path} fill={fill(ic.hex)} /></svg>
          </span>
        ))}
        {d.scale && SPOF[def.id] && <span className="af-spof" title={'Single point of failure — ' + SPOF[def.id]}>⚠ SPOF</span>}
        {d.scale && def.util && (
          <span className="af-util-chip" title={`${compact(def.util.used)} / ${compact(def.util.cap)} ${def.util.label} — measured`}>
            {compact(def.util.used)}/{compact(def.util.cap)}
          </span>
        )}
        {d.scale && def.headroom && <span className="af-10x" title={'10×: ' + def.headroom}>10×</span>}
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

interface BandData extends Record<string, unknown> { label: string; micro: string; c: string }
function BandNode({ data }: NodeProps) {
  const d = data as BandData
  return (
    <div className="af-band" style={{ ['--af-c' as string]: d.c }}>
      <span className="bl">{d.label}<i>· {d.micro}</i></span>
    </div>
  )
}

// The mental-model card (Core view) — one big card per layer.
interface LayerData extends Record<string, unknown> { layer: LayerDef; count: number; c: string; provDots: Prov[] }
function LayerNode({ data }: NodeProps) {
  const d = data as LayerData
  return (
    <div className="af-layer" style={{ ['--af-c' as string]: d.c }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <div className="af-layer-h">
        <span className="lbl">{d.layer.label}</span>
        <span className="micro">{d.layer.micro}</span>
      </div>
      <div className="af-layer-p">{d.layer.purpose}</div>
      <div className="af-layer-f">
        <span className="cnt">{d.count} system{d.count === 1 ? '' : 's'}</span>
        <span className="dots">{d.provDots.map((pv, i) => <i key={i} className={PROV[pv].cls} />)}</span>
      </div>
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
}

function PulseEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data }: EdgeProps) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 14 })
  const flow = (data as { flow?: boolean; next?: boolean } | undefined)?.flow
  const next = (data as { next?: boolean } | undefined)?.next
  const stroke = next ? LC.think : flow ? 'var(--acc)' : 'var(--bd3)'
  return (
    <>
      <BaseEdge id={id} path={path} style={{ stroke, strokeWidth: flow ? 2 : 1.4, opacity: next ? 0.6 : flow ? 0.9 : 0.42, strokeDasharray: next ? '6 5' : undefined }} />
      {flow && !REDUCED && (
        <circle r={3.2} fill="var(--acc)" className="af-pulse-dot">
          <animateMotion dur="2.6s" repeatCount="indefinite" path={path} />
        </circle>
      )}
    </>
  )
}

// Layer bands are 1300px-wide backdrop rectangles — at minimap scale they'd
// paint over the whole panel and drown out the actual node dots. A `nodeColor`
// of 'transparent' is not reliable enough here; excluding bands at the render
// level (return null) is the deterministic fix.
function MiniNode({ id, x, y, width, height, color, strokeColor, strokeWidth, borderRadius, shapeRendering }: MiniMapNodeProps) {
  if (id.startsWith('b-')) return null
  return (
    <rect x={x} y={y} width={width} height={height} rx={borderRadius} ry={borderRadius}
      style={{ fill: color, stroke: strokeColor, strokeWidth }} shapeRendering={shapeRendering} />
  )
}

const nodeTypes = { card: CardNode, band: BandNode, layer: LayerNode }
const edgeTypes = { pulse: PulseEdge }

const PROV_KEY: [Prov, string][] = [['live', 'measured'], ['partial', 'built, not fully wired'], ['placeholder', 'planned']]

export function Architecture() {
  const { theme } = useHQ()
  const [view, setView] = useState<View>('system')
  const [lens, setLens] = useState<Lens>('organs')
  const [sel, setSel] = useState<string | null>(null)
  const showNext = view === 'scale'
  const activeLayers = lens === 'organs' ? LAYERS : STACK_LAYERS
  const layerOf = (n: NodeDef): string => lens === 'organs' ? n.layer : STACK_OF[n.id]

  const [ins, setIns] = useState<SchemaInsights | null>(null)
  const [kin, setKin] = useState<KinetikStats | null>(null)
  const [gro, setGro] = useState<GrowthOverview | null>(null)
  const [eng, setEng] = useState<EngagementData | null>(null)
  const [model, setModel] = useState<SchemaModel | null>(null)

  // Agents view — live endpoint probes (real handshakes, re-run on entry).
  const [bridgeSt, setBridgeSt] = useState<AgentStatus>('checking')
  const [comfySt, setComfySt] = useState<AgentStatus>('checking')
  const [comfyInfo, setComfyInfo] = useState<string | null>(null)
  useEffect(() => {
    if (view !== 'agents') return
    setBridgeSt('checking'); setComfySt('checking'); setComfyInfo(null)
    probeBridge().then(setBridgeSt)
    probeComfy().then(({ status, info }) => { setComfySt(status); setComfyInfo(info) })
  }, [view])
  const statusOf = (n: NodeDef): AgentStatus | undefined =>
    n.probe === 'always' ? 'connected' : n.probe === 'bridge' ? bridgeSt : n.probe === 'comfy' ? comfySt : undefined

  useEffect(() => {
    live.schemaInsights().then(setIns)
    live.kinetikStats().then(setKin)
    live.growthOverview().then(setGro)
    live.engagement(14).then(setEng)
    live.schemaModel().then(setModel)
  }, [])

  // Live metric chips + per-app sparkline series, keyed by node id.
  const { stats, series } = useMemo(() => {
    const s: Record<string, Stat[]> = {}
    const ser: Record<string, number[]> = {}
    const t = (app: string) => eng?.apps.find(a => a.app === app)
    if (gro) s.core = [{ l: 'WAU', raw: gro.wau, fmt: compact }, { l: 'MAU', raw: gro.mau, fmt: compact }]
    if (ins) {
      s.arganta = [{ l: 'learners', raw: ins.learners, fmt: compact }, { l: 'active·7d', raw: ins.activeLearners7d, fmt: compact }]
      s.postgres = [{ l: 'games', raw: ins.gamesTotal, fmt: compact }, { l: '💎 float', raw: ins.diamondsFloat, fmt: compact }]
    }
    if (model) s.postgres = [{ l: 'tables', raw: model.tables.length, fmt: compact }, ...(s.postgres ?? [])].slice(0, 3)
    if (kin) s.kinetik = [{ l: 'members', raw: kin.members, fmt: compact }, { l: 'circles', raw: kin.circles, fmt: compact }]
    if (t('lashira')) s.lashira = [{ l: 'played·14d', raw: t('lashira')!.seconds, fmt: fmtDur }, { l: 'players', raw: t('lashira')!.users, fmt: compact }]
    if (t('landing')) s.landing = [{ l: 'visit·14d', raw: t('landing')!.seconds, fmt: fmtDur }, { l: 'visitors', raw: t('landing')!.users, fmt: compact }]
    if (t('hq')) s.hqb = [{ l: 'ops·14d', raw: t('hq')!.seconds, fmt: fmtDur }]
    if (t('arganta')) s.arganta.push({ l: 'time·14d', raw: t('arganta')!.seconds, fmt: fmtDur })
    if (t('kinetik') && s.kinetik) s.kinetik.push({ l: 'time·14d', raw: t('kinetik')!.seconds, fmt: fmtDur })
    if (eng) s.beats = [{ l: 'tracked·14d', raw: eng.totalSeconds, fmt: fmtDur }, { l: 'people', raw: eng.totalUsers, fmt: compact }]
    // sparkline series from daily beats, per app
    if (eng?.daily?.length) {
      const byApp: Record<string, [string, number][]> = {}
      for (const row of eng.daily) (byApp[row.app] ??= []).push([row.day, row.seconds])
      const days = Array.from(new Set(eng.daily.map(d => d.day))).sort()
      const seriesFor = (rows: [string, number][]) => {
        const m = new Map(rows); return days.map(d => m.get(d) ?? 0)
      }
      for (const app of Object.keys(byApp)) ser[app] = seriesFor(byApp[app])
      ser.all = days.map(d => eng.daily.filter(r => r.day === d).reduce((a, r) => a + r.seconds, 0))
    }
    if (gro?.northStar?.length) ser.core = gro.northStar.map(p => p.value)
    return { stats: s, series: ser }
  }, [ins, kin, gro, eng, model])

  const flow = useMemo(() => {
    if (view === 'core') {
      // mental model — one big layer card per active layer, vertical spine
      const nodes: Node[] = activeLayers.map((layer, i) => {
        const ns = NODES.filter(n => layerOf(n) === layer.id && !n.next)
        return {
          id: 'ly-' + layer.id, type: 'layer', position: { x: 470, y: i * 132 }, zIndex: 1,
          data: { layer, count: ns.length, c: colorOf(layer.id), provDots: ns.map(n => n.prov) } as LayerData,
          draggable: false, connectable: false,
        }
      })
      const edges: Edge[] = activeLayers.slice(0, -1).map((layer, i) => ({
        id: 'le' + i, source: 'ly-' + layer.id, target: 'ly-' + activeLayers[i + 1].id,
        type: 'pulse', data: { flow: i < 4 }, selectable: false,
      }))
      return { nodes, edges }
    }
    if (view === 'agents') {
      // Command hierarchy — its own layer set, live status dots, all NEXT shown.
      const { bands, place } = buildLayout(AGENT_NODES as NodeDef[], AGENT_LAYERS, n => n.layer, true)
      const cards: Node[] = (AGENT_NODES as NodeDef[]).map(n => ({
        id: n.id, type: 'card', position: place[n.id], zIndex: 1, connectable: false,
        data: { def: n, c: colorOf(n.layer), status: statusOf(n) } as CardData,
      }))
      const bandNodes: Node[] = bands.map(b => ({
        id: 'b-' + b.id, type: 'band', position: { x: b.x, y: b.y }, data: { label: b.label, micro: b.micro, c: b.c } as BandData,
        style: { width: b.w, height: b.h }, draggable: false, selectable: false, connectable: false, zIndex: 0,
      }))
      const edges: Edge[] = AGENT_EDGES.map((e, i) => ({
        id: 'ae' + i, source: e.s, target: e.t, type: 'pulse', data: { flow: e.flow, next: e.next }, selectable: false, zIndex: 0,
      }))
      return { nodes: [...bandNodes, ...cards], edges }
    }
    // C4 altitude fix: collapse the 6 client apps into one container card so a
    // technology (PostgreSQL) never sits as a visual peer of a product tier.
    const visibleNodes: NodeDef[] = [...NODES.filter(n => !CLIENT_TIER_IDS.includes(n.id)), CLIENT_CONTAINER]
    const { bands, place } = buildLayout(visibleNodes, activeLayers, layerOf, showNext)
    const cards: Node[] = visibleNodes.filter(n => showNext || !n.next).map(n => ({
      id: n.id, type: 'card', position: place[n.id], zIndex: 1, connectable: false,
      data: { def: n, c: colorOf(layerOf(n)), stats: n.children ? undefined : stats[n.id], scale: showNext } as CardData,
    }))
    const bandNodes: Node[] = bands.map(b => ({
      id: 'b-' + b.id, type: 'band', position: { x: b.x, y: b.y }, data: { label: b.label, micro: b.micro, c: b.c } as BandData,
      style: { width: b.w, height: b.h }, draggable: false, selectable: false, connectable: false, zIndex: 0,
    }))
    const ids = new Set(cards.map(c => c.id))
    const remap = (id: string) => CLIENT_TIER_IDS.includes(id) ? CLIENT_CONTAINER.id : id
    const seen = new Set<string>()
    const edges: Edge[] = []
    for (const e of EDGES) {
      if (!showNext && e.next) continue
      const s = remap(e.s), t = remap(e.t)
      if (s === t || !ids.has(s) || !ids.has(t)) continue
      const key = s + '>' + t + (e.next ? 'n' : 'f')
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ id: 'e' + edges.length, source: s, target: t, type: 'pulse', data: { flow: e.flow, next: e.next }, selectable: false, zIndex: 0 })
    }
    return { nodes: [...bandNodes, ...cards], edges }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, lens, showNext, stats, bridgeSt, comfySt])

  const liveCount = Object.keys(stats).length
  const selDef = sel ? [...ALL_NODES, ...(AGENT_NODES as NodeDef[])].find(n => n.id === sel) ?? null : null
  const selSeries = selDef?.seriesKey ? series[selDef.seriesKey] : undefined

  return (
    <div className="af-wrap">
      <div className="spread" style={{ padding: '0 0 12px', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Architecture</div>
          <div className="sub">
            {view === 'agents'
              ? <>Agentic command hierarchy · <b>Founder → Tri-Brain → Fabric → Surfaces</b> · status dots are real probes</>
              : lens === 'organs'
                ? <>Arganta OS · seven layers, one backbone · <b>Command Core → Sense</b></>
                : <>Classical stack · <b>UI/UX → Infrastructure</b> · agnostic — replicate on any tech stack</>}
            {view !== 'core' && view !== 'agents' && <span className="af-altitude"> · container-level view</span>}
            <span className="af-edgekey"> · edges = {view === 'agents' ? 'control' : 'data & control'} flow</span>
            {view !== 'agents' && liveCount > 0 && <span style={{ color: 'var(--ok)' }}> · {liveCount} nodes reporting live</span>}
          </div>
        </div>
        <div className="af-controls">
          {view !== 'agents' && (
            <div className="af-lens" title="Same graph, two lenses — our organs vs the classical stack a partner would replicate">
              {(['organs', 'stack'] as Lens[]).map(l => (
                <button key={l} className={lens === l ? 'on' : ''} onClick={() => { setLens(l); setSel(null) }}>{l}</button>
              ))}
            </div>
          )}
          <div className="af-seg">
            {(['core', 'system', 'scale', 'agents'] as View[]).map(v => (
              <button key={v} className={view === v ? 'on' : ''} onClick={() => { setView(v); setSel(null) }}>{v}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="af-canvas">
        <ReactFlow nodes={flow.nodes} edges={flow.edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView
          fitViewOptions={{ padding: 0.12 }} proOptions={{ hideAttribution: true }}
          colorMode={theme === 'dark' ? 'dark' : 'light'} minZoom={0.25} nodesConnectable={false} elevateNodesOnSelect={false}
          onNodeClick={(_, n) => { if (n.type === 'card') setSel(n.id === sel ? null : n.id) }}
          onPaneClick={() => setSel(null)}>
          <Background variant={BackgroundVariant.Dots} gap={26} size={1} />
          <Controls showInteractive={false} />
          <MiniMap pannable zoomable maskColor="rgba(0,0,0,.06)" nodeComponent={MiniNode}
            nodeColor={(n) => ((n.data as CardData)?.c || (n.data as LayerData)?.c || '#6366f1')}
            nodeStrokeWidth={0} />
        </ReactFlow>

        <div className="af-legend">
          {(view === 'agents' ? AGENT_LAYERS : activeLayers.filter(l => l.id !== 'spine')).map(l => (
            <span key={l.id} className="i"><i style={{ background: colorOf(l.id) }} />{l.label}</span>
          ))}
        </div>
        <div className="af-provkey">
          {PROV_KEY.map(([p, desc]) => (
            <span key={p} className="i" title={desc}><i className={PROV[p].cls} />{PROV[p].label}</span>
          ))}
        </div>

        {/* Built open, locked to no one */}
        <div className="af-ribbon">
          <span className="rl">Built open · locked to no one</span>
          {[L.sb, L.cf, L.vc, L.pg, L.claude, L.oai, L.react, L.ts].map((ic, i) => (
            <span key={i} className="af-logo sm" title={ic.title}>
              <svg viewBox="0 0 24 24" role="img" aria-label={ic.title}><path d={ic.path} fill={fill(ic.hex)} /></svg>
            </span>
          ))}
        </div>

        {/* Inspector drawer */}
        {selDef && (() => {
          const isAgent = selDef.layer.startsWith('ag-')
          const selLayer = (isAgent ? AGENT_LAYERS : activeLayers).find(l => l.id === (isAgent ? selDef.layer : layerOf(selDef)))
          const selColor = colorOf(isAgent ? selDef.layer : layerOf(selDef))
          const selStatus = isAgent ? statusOf(selDef) : undefined
          return (
          <div className="af-drawer" style={{ ['--af-c' as string]: selColor }}>
            {CLIENT_TIER_IDS.includes(selDef.id) && (
              <button className="af-back" onClick={() => setSel(CLIENT_CONTAINER.id)}>‹ Client Applications</button>
            )}
            <div className="dh">
              <div>
                <div className="dl">{selDef.label}</div>
                <div className="dsub">{selLayer?.label} · {selLayer?.micro}</div>
              </div>
              <button className="dx" onClick={() => setSel(null)} aria-label="close"><X size={15} /></button>
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <span className={'af-prov ' + PROV[selDef.prov].cls}>{PROV[selDef.prov].label}</span>
              {selStatus && <span className={'af-live st-' + selStatus}><i />{selStatus === 'checking' ? 'checking…' : selStatus}</span>}
            </div>
            {selDef.detail && <p className="dp">{selDef.detail}</p>}
            {selDef.id === 'ag-comfy' && comfyInfo && <div className="af-comfy-info">{comfyInfo} <i className="uv-measured">measured</i></div>}
            {selDef.brains && (
              <div className="af-brainmap">
                <div className="bmh">Tri-brain control map</div>
                {selDef.brains.map(b => {
                  const m = BRAIN_META[b.brain]
                  return (
                    <div key={b.brain} className="bmr" style={{ ['--bm-c' as string]: m.c }}>
                      <span className="bmn"><BrainMark mark={m.mark} size={12} />{m.label}</span>
                      <span className="bmw">{b.what}</span>
                    </div>
                  )
                })}
              </div>
            )}
            {selDef.children && (
              <div className="af-members">
                <div className="mh">Products in this tier</div>
                {selDef.children.map(id => {
                  const child = ALL_NODES.find(n => n.id === id)
                  if (!child) return null
                  return (
                    <button key={id} className="mrow" onClick={() => setSel(id)}>
                      <span className="ml">{child.label}</span>
                      <span className={'af-prov ' + PROV[child.prov].cls}>{PROV[child.prov].label}</span>
                    </button>
                  )
                })}
              </div>
            )}
            {selDef.safety && (
              <div className="af-safety">
                <div className="sfh">Trust &amp; Safety</div>
                {selDef.safety.map(s => (
                  <div key={s.label} className="sfr"><i className={PROV[s.prov].cls} /><span className="sfl">{s.label}</span><span className="sfp">{PROV[s.prov].label}</span></div>
                ))}
              </div>
            )}
            {selSeries && selSeries.length > 1 && <Sparkline data={selSeries} c={selColor} />}
            {SPOF[selDef.id] && <div className="af-spof-note">⚠ <b>Single point of failure.</b> {SPOF[selDef.id]}</div>}
            {selDef.util && (
              <div className="af-util">
                <div className="uh"><span>{selDef.util.label} <i className="uv-measured">measured</i></span><span className="uv">{compact(selDef.util.used)} / {compact(selDef.util.cap)}</span></div>
                <div className="ubar"><div className="ufill" style={{ width: Math.min(100, Math.max(1, (selDef.util.used / selDef.util.cap) * 100)) + '%' }} /></div>
              </div>
            )}
            <dl className="dmeta">
              {selDef.tech && <><dt>Tech</dt><dd>{selDef.tech}</dd></>}
              {selDef.repo && <><dt>Where</dt><dd className="mono">{selDef.repo}</dd></>}
              <dt>Lock-in</dt><dd><span className={'af-lock lk-' + lockOf(selDef.id)} />{LOCK_LABEL[lockOf(selDef.id)]}</dd>
              {selDef.swap && <><dt>Swap-class</dt><dd>{selDef.swap}</dd></>}
              {selDef.headroom && <><dt>At 10×</dt><dd>{selDef.headroom}</dd></>}
            </dl>
          </div>
          )
        })()}
      </div>
    </div>
  )
}

function Sparkline({ data, c }: { data: number[]; c: string }) {
  if (data.length < 2) return null
  const w = 240, h = 46, max = Math.max(...data, 1), min = Math.min(...data), rng = max - min || 1
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - ((v - min) / rng) * (h - 8) - 4])
  const line = 'M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' L ')
  const area = `${line} L ${w} ${h} L 0 ${h} Z`
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="af-spark" preserveAspectRatio="none" style={{ ['--af-c' as string]: c }}>
      <path d={area} className="fill" />
      <path d={line} className="line" />
    </svg>
  )
}

