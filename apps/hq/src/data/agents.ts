// Circle Agent OS — the 25-agent operating system that sits above the portfolio.
// This is the deterministic spine: a typed roster + a Sense→Compute→Match→Generate
// pipeline that reads the SAME live RPCs the dashboards use. Nothing here is
// seeded — when the cloud is offline every signal degrades to an honest empty
// state rather than inventing numbers.

import { live } from './live'
import type { GrowthOverview, EconomyData, SchemaInsights, ContentMatrix } from './types'

export type Model = 'sonnet' | 'haiku' | 'det'
export type Tier = 'executive' | 'argantalab' | 'kinetik' | 'growth' | 'platform' | 'brand'
export type AgentStatus = 'active' | 'idle'

export interface Agent {
  id: string
  name: string
  role: string
  tier: Tier
  /** Sonnet 4.6 = reasoning/debate · Haiku 4.5 = classification/sense · det = pure SQL+arithmetic */
  model: Model
  mission: string
  /** what it reads */
  inputs: string[]
  /** what it produces */
  output: string
  reportsTo: string | null
  /** the CEO Agent — the AI orchestrator that can convene any agent + issue prompts */
  orchestrator?: boolean
}

export const TIER_META: Record<Tier, { label: string; accent: string }> = {
  executive: { label: 'C-Suite Executives', accent: 'var(--acc)' },
  argantalab: { label: 'ArgantaLab Tribe', accent: 'var(--mag)' },
  kinetik: { label: 'KinetikCircle Tribe', accent: 'var(--ok)' },
  growth: { label: 'Growth & Investor', accent: 'var(--warn)' },
  platform: { label: 'Platform & Security', accent: 'var(--bad)' },
  brand: { label: 'Brand & Story', accent: 'var(--acc)' },
}

export const MODEL_META: Record<Model, { label: string; bg: string; fg: string }> = {
  sonnet: { label: 'Sonnet 4.6', bg: 'var(--acc-soft)', fg: 'var(--acc-text)' },
  haiku: { label: 'Haiku 4.5', bg: 'var(--ok-bg)', fg: 'var(--ok)' },
  det: { label: 'Deterministic', bg: 'var(--bg3)', fg: 'var(--tx2)' },
}

// The roster. Main agents (all executives + VPs + Data Architect) run on Sonnet
// 4.6 because they reason, collaborate and debate. Specialist child agents run on
// Haiku 4.5 (sense/classification) — cheaper, narrower.
export const AGENTS: Agent[] = [
  // ── Orchestrator ──
  { id: 'ceo', name: 'CEO Agent', role: 'Chief Executive · Orchestrator', tier: 'executive', model: 'sonnet', reportsTo: null, orchestrator: true,
    mission: 'The AI orchestrator. Convenes any subset of agents, routes a prompt or scenario to them, synthesises their positions, and reports one recommendation to the human CEO.',
    inputs: ['*all agent outputs*', 'hq_growth_overview', 'hq_economy'], output: 'Orchestrated recommendation' },
  // ── C-Suite ──
  { id: 'coo', name: 'COO Agent', role: 'Chief Operations Officer', tier: 'executive', model: 'sonnet', reportsTo: 'ceo',
    mission: 'Runs the portfolio rhythm. Sends the Founder Daily Brief: what changed, what is blocked, what needs a decision.',
    inputs: ['hq_growth_overview', 'hq_economy', 'hq_schema_insights'], output: 'Founder Daily Brief' },
  { id: 'cpo', name: 'CPO Agent', role: 'Chief Product Officer', tier: 'executive', model: 'sonnet', reportsTo: 'coo',
    mission: 'Portfolio-level product brain above the VPs. Owns the wedge, prevents feature explosion.',
    inputs: ['hq_content_matrix', 'hq_growth_overview'], output: 'Product focus & roadmap' },
  { id: 'cto', name: 'CTO Agent', role: 'Chief Technology Officer', tier: 'executive', model: 'sonnet', reportsTo: 'coo',
    mission: 'Protects architecture. Schema review, RLS, game sandboxing, technical-debt warnings.',
    inputs: ['hq_schema_model', 'artifact_telemetry'], output: 'Architecture decisions' },
  { id: 'cfo', name: 'CFO Agent', role: 'Chief Financial Officer', tier: 'executive', model: 'sonnet', reportsTo: 'coo',
    mission: 'Protects money, runway, diamond economy. Models CAC/LTV, flags cost-without-revenue.',
    inputs: ['hq_economy', 'diamond_ledger'], output: 'Cost, pricing & economy' },
  { id: 'gc', name: 'GC Agent', role: 'General Counsel · Trust', tier: 'executive', model: 'sonnet', reportsTo: 'coo',
    mission: 'COPPA / GDPR-K, child protection, UGC policy, parent consent, legal checklists.',
    inputs: ['profiles', 'artifact_telemetry'], output: 'Legal & compliance checklist' },

  // ── ArgantaLab Tribe ──
  { id: 'vp-arg', name: 'VP ArgantaLab', role: 'VP Product · ArgantaLab', tier: 'argantalab', model: 'sonnet', reportsTo: 'cpo',
    mission: 'Owns ArgantaLab. Are kids learning, building, sharing? Fun in 60 seconds?',
    inputs: ['hq_growth_overview', 'hq_content_matrix'], output: 'Product direction' },
  { id: 'pm-game', name: 'PM Game Builder', role: 'Product Manager', tier: 'argantalab', model: 'haiku', reportsTo: 'vp-arg',
    mission: 'Makes the game builder magical, safe, shareable. Tracks games created / shared / played.',
    inputs: ['games', 'artifact_telemetry'], output: 'Builder roadmap' },
  { id: 'learn-dir', name: 'Learning Director', role: 'Learning Director', tier: 'argantalab', model: 'sonnet', reportsTo: 'vp-arg',
    mission: 'Cambridge-aligned curriculum, mastery loop, adaptive rules, parent explanation.',
    inputs: ['hq_content_matrix', 'item_attempts'], output: 'Curriculum spine' },
  { id: 'content-writer', name: 'Content Writer', role: 'Content Writer', tier: 'argantalab', model: 'sonnet', reportsTo: 'learn-dir',
    mission: 'Produces learning questions, stories, explanations, kid-friendly feedback.',
    inputs: ['hq_content_matrix'], output: 'Item & content production' },
  { id: 'game-design', name: 'Game Design Agent', role: 'Game Designer', tier: 'argantalab', model: 'haiku', reportsTo: 'vp-arg',
    mission: 'Makes learning feel like play — rewards, progression, buddy animations, "wow in 10s".',
    inputs: ['artifact_telemetry'], output: 'Fun & reward mechanics' },
  { id: 'kid-tester', name: 'Kid Tester Agent', role: 'Kid Tester', tier: 'argantalab', model: 'haiku', reportsTo: 'vp-arg',
    mission: 'Simulates 6/8/10/12-year personas. Where does a kid get bored, confused, or say wow?',
    inputs: ['item_attempts', 'artifact_telemetry'], output: 'Child usability feedback' },

  // ── KinetikCircle Tribe ──
  { id: 'vp-kin', name: 'VP KinetikCircle', role: 'VP Product · KinetikCircle', tier: 'kinetik', model: 'sonnet', reportsTo: 'cpo',
    mission: 'Owns the family layer — calendar, moments, parent dashboard, diamond wallet.',
    inputs: ['circles', 'circle_members'], output: 'Family-layer strategy' },
  { id: 'pm-moments', name: 'PM Calendar & Moments', role: 'Product Manager', tier: 'kinetik', model: 'haiku', reportsTo: 'vp-kin',
    mission: 'Today view, shared calendar, moments upload, memory timeline.',
    inputs: ['circles', 'artifact_telemetry'], output: 'Family utility roadmap' },
  { id: 'parent-intel', name: 'Parent Intelligence Lead', role: 'Parent Intelligence Lead', tier: 'kinetik', model: 'haiku', reportsTo: 'vp-kin',
    mission: 'Family coordination — summarise the week, suggest routines, explain kid progress.',
    inputs: ['item_attempts', 'circle_members'], output: 'Family weekly message' },
  { id: 'community', name: 'Community Agent', role: 'Community Lead', tier: 'kinetik', model: 'haiku', reportsTo: 'vp-kin',
    mission: 'Circle growth — invite flow, onboarding, sibling/friend loops, safe sharing.',
    inputs: ['circles', 'circle_members'], output: 'Circle growth' },

  // ── Growth & Investor ──
  { id: 'vp-growth', name: 'VP Growth', role: 'VP Growth', tier: 'growth', model: 'sonnet', reportsTo: 'coo',
    mission: 'Designs experiments, not "marketing". Each week: one testable growth hypothesis.',
    inputs: ['hq_acquisition', 'hq_growth_overview'], output: 'Growth experiments' },
  { id: 'retention', name: 'Retention Analyst', role: 'Retention Analyst', tier: 'growth', model: 'haiku', reportsTo: 'vp-growth',
    mission: 'D1/D7/D30 retention, weekly active kids, lessons per active kid, earn/spend ratio.',
    inputs: ['hq_retention', 'hq_growth_overview'], output: 'Habit metrics' },
  { id: 'acquisition', name: 'Acquisition Analyst', role: 'Acquisition Analyst', tier: 'growth', model: 'haiku', reportsTo: 'vp-growth',
    mission: 'Share-link, invite and class funnels — which channel brings users who return?',
    inputs: ['hq_acquisition'], output: 'Channel metrics' },
  { id: 'ir', name: 'Investor Relations', role: 'Investor Relations', tier: 'growth', model: 'sonnet', reportsTo: 'coo',
    mission: 'One-liner, deck, demo script, traction memo, monthly investor update.',
    inputs: ['hq_growth_overview', 'hq_economy'], output: 'Investor materials' },

  // ── Platform & Security ──
  { id: 'data-arch', name: 'Data Architect', role: 'Data Architect', tier: 'platform', model: 'sonnet', reportsTo: 'cto',
    mission: 'Event schema, RPC reliability, migration quality, analytics tables, tracking bugs.',
    inputs: ['hq_schema_model', 'artifact_telemetry'], output: 'Event & data quality' },
  { id: 'security', name: 'Security & Privacy', role: 'Security & Privacy', tier: 'platform', model: 'haiku', reportsTo: 'cto',
    mission: 'RLS tests, child-account risk, UGC moderation, prompt-injection, published-HTML safety.',
    inputs: ['games', 'artifact_telemetry'], output: 'Child & family safety' },
  { id: 'qa', name: 'QA / Red Team', role: 'QA Red Team', tier: 'platform', model: 'haiku', reportsTo: 'cto',
    mission: 'Break the product first — weird inputs, mobile, slow internet, child misuse.',
    inputs: ['artifact_telemetry'], output: 'Pre-launch bug surface' },
  { id: 'release', name: 'Release Manager', role: 'Release Manager', tier: 'platform', model: 'haiku', reportsTo: 'cto',
    mission: 'Release checklist, regression, rollback plan, known issues, demo readiness.',
    inputs: ['games', 'hq_app'], output: 'Shipping discipline' },

  // ── Brand & Story ──
  { id: 'brand', name: 'Brand Director', role: 'Brand Director', tier: 'brand', model: 'sonnet', reportsTo: 'coo',
    mission: 'Visual identity, tone, naming, landing copy, app-store copy, demo narrative.',
    inputs: ['hq_app'], output: 'Story & identity' },
  { id: 'content-creator', name: 'Content Creator', role: 'Content Creator · KinetikCircle', tier: 'brand', model: 'sonnet', reportsTo: 'vp-kin',
    mission: 'KinetikCircle moments, feed posts, family recaps, Circle challenges — from real events.',
    inputs: ['item_attempts', 'diamond_ledger', 'circles'], output: 'Circle content' },
  { id: 'demo', name: 'Demo Director', role: 'Demo Director', tier: 'brand', model: 'sonnet', reportsTo: 'coo',
    mission: '60-second demo script, investor / parent / kid demo paths, the wow moment.',
    inputs: ['hq_growth_overview'], output: 'Demo & wow design' },
]

// Which agents are "lit up" right now is derived from whether their primary
// data source has any signal — deterministic, not decorative.
export function deriveStatus(a: Agent, has: { growth: boolean; economy: boolean; content: boolean }): AgentStatus {
  if (a.inputs.some(i => i.includes('growth') || i.includes('acquisition') || i.includes('retention'))) return has.growth ? 'active' : 'idle'
  if (a.inputs.some(i => i.includes('economy') || i.includes('diamond'))) return has.economy ? 'active' : 'idle'
  if (a.inputs.some(i => i.includes('content') || i.includes('item_attempts'))) return has.content ? 'active' : 'idle'
  return 'idle'
}

// ── The 5-layer signal pipeline ──────────────────────────────────────────────
// Each layer is tagged with the model that "reserves" it, so the UI can show a
// reasoning pill at every step. Only Generate touches an LLM in production.

export interface PipelineStage { key: string; name: string; sub: string; model: Model }
export const PIPELINE: PipelineStage[] = [
  { key: 'sense', name: 'Sense', sub: 'SQL · RPC read', model: 'haiku' },
  { key: 'compute', name: 'Compute', sub: 'Arithmetic', model: 'det' },
  { key: 'match', name: 'Match', sub: 'Thresholds', model: 'det' },
  { key: 'generate', name: 'Generate', sub: 'Narrative', model: 'sonnet' },
  { key: 'deliver', name: 'Deliver', sub: 'Brief / card', model: 'det' },
]

export interface Sensed {
  growth: GrowthOverview | null
  economy: EconomyData | null
  insights: SchemaInsights | null
  content: ContentMatrix | null
  source: 'supabase-live' | 'offline'
}

export async function agentSense(): Promise<Sensed> {
  const [growth, economy, insights, content] = await Promise.all([
    live.growthOverview(), live.economy(), live.schemaInsights(), live.contentMatrix(),
  ])
  const any = growth || economy || insights || content
  return { growth, economy, insights, content, source: any ? 'supabase-live' : 'offline' }
}

export interface Computed {
  wau: number | null
  stickiness: number | null
  wowPct: number | null
  accuracy: number | null
  coverage: number | null
  float: number | null
  learners: number | null
  gamesPublic: number | null
  contentLivePct: number | null
}

export function agentCompute(s: Sensed): Computed {
  const g = s.growth, e = s.economy, i = s.insights, c = s.content
  const contentLivePct = c && c.totals.authored > 0
    ? Math.round((c.totals.live / c.totals.authored) * 100) : null
  return {
    wau: g?.wau ?? null,
    stickiness: g?.stickiness ?? null,
    wowPct: g?.wowPct ?? null,
    accuracy: g?.accuracyPct ?? null,
    coverage: e?.coverage ?? null,
    float: e?.float ?? null,
    learners: i?.learners ?? g?.learners ?? null,
    gamesPublic: i?.gamesPublic ?? null,
    contentLivePct,
  }
}

export interface Signal { tone: 'ok' | 'warn' | 'info'; text: string }

export function agentMatch(c: Computed): Signal[] {
  const out: Signal[] = []
  if (c.wau == null) {
    out.push({ tone: 'info', text: 'No live growth data — connect Supabase & sign in as operator' })
    return out
  }
  if (c.wowPct != null && c.wowPct < 0) out.push({ tone: 'warn', text: `Weekly active down ${Math.abs(c.wowPct)}% WoW — retention risk` })
  if (c.wowPct != null && c.wowPct > 0) out.push({ tone: 'ok', text: `Weekly active up ${c.wowPct}% WoW` })
  if (c.stickiness != null && c.stickiness < 20) out.push({ tone: 'warn', text: `Stickiness ${c.stickiness}% (<20% target) — needs daily-quest loop` })
  if (c.coverage != null && c.coverage < 50) out.push({ tone: 'warn', text: `Diamond sink coverage ${c.coverage}% — diamonds piling up` })
  if (c.accuracy != null && c.accuracy < 60) out.push({ tone: 'warn', text: `Mastery accuracy ${c.accuracy}% — items may be too hard` })
  if (c.contentLivePct != null && c.contentLivePct < 60) out.push({ tone: 'info', text: `Only ${c.contentLivePct}% of authored content is live` })
  if (out.length === 0) out.push({ tone: 'ok', text: 'All monitored signals within healthy range' })
  return out
}

// ── Generate (the only LLM-reserved step) ────────────────────────────────────
// In production this prompt + the computed facts go to Sonnet 4.6. Here we keep
// it deterministic-template so the demo never fabricates: same facts, scripted
// phrasing, routed by intent. Markdown-lite (**bold**) rendered by the UI.

export type Intent = 'brief' | 'focus' | 'blockers' | 'economy' | 'agents' | 'general'

export function routeIntent(prompt: string): Intent {
  const p = prompt.toLowerCase()
  if (/brief|status|how are we|how am i|today/.test(p)) return 'brief'
  if (/focus|priorit|what should|next/.test(p)) return 'focus'
  if (/block|stuck|risk|problem|wrong/.test(p)) return 'blockers'
  if (/econ|diamond|money|cost|runway|pricing/.test(p)) return 'economy'
  if (/agent|os |roster|team|who/.test(p)) return 'agents'
  return 'general'
}

const n = (v: number | null, suffix = '') => v == null ? '—' : `${v}${suffix}`

export function agentGenerate(intent: Intent, c: Computed, signals: Signal[], s: Sensed): string {
  const liveTag = s.source === 'supabase-live' ? '_(COO Agent · Sonnet 4.6 · live SQL)_' : '_(COO Agent · Sonnet 4.6 · offline)_'
  const sigLines = signals.map(x => `${x.tone === 'warn' ? '⚠️' : x.tone === 'ok' ? '✅' : '→'} ${x.text}`).join('\n')

  if (intent === 'brief') {
    return `**Founder Daily Brief** ${liveTag}\n\n` +
      `**📊 Portfolio**\n` +
      `• Weekly active learners: ${n(c.wau)}  ·  WoW ${c.wowPct == null ? '—' : (c.wowPct > 0 ? '+' : '') + c.wowPct + '%'}\n` +
      `• Stickiness (DAU/MAU): ${n(c.stickiness, '%')}  ·  Mastery accuracy: ${n(c.accuracy, '%')}\n` +
      `• Total learners: ${n(c.learners)}  ·  Public games: ${n(c.gamesPublic)}\n` +
      `• Diamond float: ${n(c.float)}  ·  Sink coverage: ${n(c.coverage, '%')}\n\n` +
      `**⚡ Signals**\n${sigLines}\n\n` +
      `**🎯 Focus today**: ${c.wau == null ? 'Wire live telemetry so every signal computes.' : (c.stickiness != null && c.stickiness < 20) ? 'Ship the daily-quest loop — stickiness is the binding constraint.' : 'Protect the share loop and parent progress card.'}`
  }
  if (intent === 'focus') {
    return `**CPO · Product Focus** _(Sonnet 4.6 reasoning)_\n\n` +
      `The wedge: **kid builds → learns → earns diamonds → shares → parent returns.**\n\n` +
      `This week's one priority: **${
        c.contentLivePct != null && c.contentLivePct < 60 ? 'Close the content gap — push authored items live before adding worlds.' :
        c.stickiness != null && c.stickiness < 20 ? 'Daily-quest loop to lift stickiness above 20%.' :
        'Ship the WhatsApp share card and measure signup conversion.'}**\n\n` +
      `CFO note: full 25-agent OS runs ~$2.20/mo — cost is not the constraint, focus is.`
  }
  if (intent === 'blockers') {
    const warns = signals.filter(x => x.tone === 'warn')
    return `**COO · Blockers** ${liveTag}\n\n` +
      (warns.length ? warns.map((x, i) => `${i + 1}. ${x.text}`).join('\n') : 'No critical blockers — all monitored signals healthy.') +
      `\n\n**Pending migrations** (unlock more live signals):\n• migration_growth.sql — Growth RPCs\n• migration_nexus.sql — Phase D family loops`
  }
  if (intent === 'economy') {
    return `**CFO · Economy Health** _(Sonnet 4.6)_\n\n` +
      `**💎 Diamond economy** ${liveTag}\n` +
      `• Float held: ${n(c.float)}  ·  Sink coverage: ${n(c.coverage, '%')}\n` +
      `• Ledger is append-only — balance = SUM(delta). Earned in play, spent on cosmetics. No real-money path.\n\n` +
      `**💰 Operating cost**\n• Full 25-agent LLM OS: ~$2.20 / month\n• Supabase + Vercel: free tier\n\n` +
      `${c.coverage != null && c.coverage < 50 ? '⚠️ Sink coverage is low — diamonds are minting faster than they are spent. Add a shop sink.' : '✅ Economy balanced for the engagement stage.'}`
  }
  if (intent === 'agents') {
    const byTier = AGENTS.reduce<Record<string, number>>((m, a) => { m[a.tier] = (m[a.tier] || 0) + 1; return m }, {})
    return `**COO · Agent OS** _(Sonnet 4.6)_\n\n` +
      `${AGENTS.length} agents across 6 tiers:\n` +
      Object.entries(byTier).map(([t, k]) => `• ${TIER_META[t as Tier].label}: ${k}`).join('\n') +
      `\n\nPipeline is deterministic-first — Sense → Compute → Match run on SQL + arithmetic; only **Generate** uses an LLM. See the Agent Builder surface for the full roster.`
  }
  return `**COO Agent** ${liveTag}\n\n` +
    `I run a 5-layer pipeline over the live Circle data:\n⚡ Sense → 🔢 Compute → 🎯 Match → ✦ Generate → 📬 Deliver\n\n` +
    `Try: **"daily brief"**, **"focus"**, **"blockers"**, **"economy"**, or **"agent status"**.`
}
