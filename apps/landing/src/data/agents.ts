// The REAL Circle HQ agent roster (ported verbatim from apps/hq/src/data/agents.ts,
// static parts only — no live/Supabase deps). One human CEO, 25 specialist agents.
export type Model = 'sonnet' | 'haiku' | 'det'
export type Tier = 'executive' | 'argantalab' | 'kinetik' | 'growth' | 'platform' | 'brand'

export interface Agent {
  id: string; name: string; role: string; tier: Tier; model: Model
  mission: string; reportsTo: string | null; orchestrator?: boolean
}

export const TIER_META: Record<Tier, { label: string; accent: string }> = {
  executive: { label: 'C-Suite', accent: '#8b5cf6' },
  argantalab: { label: 'ArgantaLab Tribe', accent: '#a855f7' },
  kinetik: { label: 'KinetikCircle Tribe', accent: '#06b6d4' },
  growth: { label: 'Growth & Investor', accent: '#f59e0b' },
  platform: { label: 'Platform & Security', accent: '#ef4444' },
  brand: { label: 'Brand & Story', accent: '#ec4899' },
}
export const MODEL_META: Record<Model, { label: string; bg: string; fg: string }> = {
  sonnet: { label: 'Sonnet 4.6', bg: 'rgba(6,182,212,.16)', fg: '#0891b2' },
  haiku: { label: 'Haiku 4.5', bg: 'rgba(16,185,129,.16)', fg: '#059669' },
  det: { label: 'Deterministic', bg: 'rgba(148,163,184,.18)', fg: '#64748b' },
}

export const AGENTS: Agent[] = [
  { id: 'ceo', name: 'CEO Agent', role: 'Chief Executive · Orchestrator', tier: 'executive', model: 'sonnet', reportsTo: null, orchestrator: true, mission: 'Convenes any subset of agents, routes a prompt, synthesises positions, reports one recommendation to the human CEO.' },
  { id: 'coo', name: 'COO Agent', role: 'Chief Operations Officer', tier: 'executive', model: 'sonnet', reportsTo: 'ceo', mission: 'Runs the portfolio rhythm. Sends the Founder Daily Brief.' },
  { id: 'cpo', name: 'CPO Agent', role: 'Chief Product Officer', tier: 'executive', model: 'sonnet', reportsTo: 'coo', mission: 'Owns the wedge, prevents feature explosion.' },
  { id: 'cto', name: 'CTO Agent', role: 'Chief Technology Officer', tier: 'executive', model: 'sonnet', reportsTo: 'coo', mission: 'Protects architecture, schema, sandboxing, tech-debt.' },
  { id: 'cfo', name: 'CFO Agent', role: 'Chief Financial Officer', tier: 'executive', model: 'sonnet', reportsTo: 'coo', mission: 'Protects money, runway, the Argon economy. Models CAC/LTV.' },
  { id: 'gc', name: 'GC Agent', role: 'General Counsel · Trust', tier: 'executive', model: 'sonnet', reportsTo: 'coo', mission: 'COPPA / GDPR-K, child protection, parent consent.' },
  { id: 'vp-arg', name: 'VP ArgantaLab', role: 'VP Product', tier: 'argantalab', model: 'sonnet', reportsTo: 'cpo', mission: 'Owns ArgantaLab. Are kids learning, building, sharing?' },
  { id: 'pm-game', name: 'PM Game Builder', role: 'Product Manager', tier: 'argantalab', model: 'haiku', reportsTo: 'vp-arg', mission: 'Makes the game builder magical, safe, shareable.' },
  { id: 'learn-dir', name: 'Learning Director', role: 'Learning Director', tier: 'argantalab', model: 'sonnet', reportsTo: 'vp-arg', mission: 'Cambridge-aligned curriculum, mastery loop, adaptive rules.' },
  { id: 'content-writer', name: 'Content Writer', role: 'Content Writer', tier: 'argantalab', model: 'sonnet', reportsTo: 'learn-dir', mission: 'Produces learning questions, stories, kid-friendly feedback.' },
  { id: 'game-design', name: 'Game Design Agent', role: 'Game Designer', tier: 'argantalab', model: 'haiku', reportsTo: 'vp-arg', mission: 'Makes learning feel like play — rewards, progression, wow.' },
  { id: 'kid-tester', name: 'Kid Tester Agent', role: 'Kid Tester', tier: 'argantalab', model: 'haiku', reportsTo: 'vp-arg', mission: 'Simulates 6/8/10/12-year personas. Where does a kid get bored?' },
  { id: 'vp-kin', name: 'VP KinetikCircle', role: 'VP Product', tier: 'kinetik', model: 'sonnet', reportsTo: 'cpo', mission: 'Owns the family layer — calendar, moments, dashboard, wallet.' },
  { id: 'pm-moments', name: 'PM Calendar & Moments', role: 'Product Manager', tier: 'kinetik', model: 'haiku', reportsTo: 'vp-kin', mission: 'Today view, shared calendar, moments, memory timeline.' },
  { id: 'parent-intel', name: 'Parent Intelligence', role: 'Parent Intelligence Lead', tier: 'kinetik', model: 'haiku', reportsTo: 'vp-kin', mission: 'Summarise the week, suggest routines, explain progress.' },
  { id: 'community', name: 'Community Agent', role: 'Community Lead', tier: 'kinetik', model: 'haiku', reportsTo: 'vp-kin', mission: 'Circle growth — invite flow, onboarding, safe sharing.' },
  { id: 'vp-growth', name: 'VP Growth', role: 'VP Growth', tier: 'growth', model: 'sonnet', reportsTo: 'coo', mission: 'One testable growth hypothesis every week.' },
  { id: 'retention', name: 'Retention Analyst', role: 'Retention Analyst', tier: 'growth', model: 'haiku', reportsTo: 'vp-growth', mission: 'D1/D7/D30 retention, weekly active kids, earn/spend ratio.' },
  { id: 'acquisition', name: 'Acquisition Analyst', role: 'Acquisition Analyst', tier: 'growth', model: 'haiku', reportsTo: 'vp-growth', mission: 'Share-link, invite and class funnels.' },
  { id: 'ir', name: 'Investor Relations', role: 'Investor Relations', tier: 'growth', model: 'sonnet', reportsTo: 'coo', mission: 'One-liner, deck, demo script, monthly investor update.' },
  { id: 'data-arch', name: 'Data Architect', role: 'Data Architect', tier: 'platform', model: 'sonnet', reportsTo: 'cto', mission: 'Event schema, RPC reliability, analytics quality.' },
  { id: 'security', name: 'Security & Privacy', role: 'Security & Privacy', tier: 'platform', model: 'haiku', reportsTo: 'cto', mission: 'RLS tests, UGC moderation, published-HTML safety.' },
  { id: 'qa', name: 'QA / Red Team', role: 'QA Red Team', tier: 'platform', model: 'haiku', reportsTo: 'cto', mission: 'Break the product first — weird inputs, child misuse.' },
  { id: 'release', name: 'Release Manager', role: 'Release Manager', tier: 'platform', model: 'haiku', reportsTo: 'cto', mission: 'Release checklist, regression, rollback, demo readiness.' },
  { id: 'brand', name: 'Brand Director', role: 'Brand Director', tier: 'brand', model: 'sonnet', reportsTo: 'coo', mission: 'Visual identity, tone, naming, landing & app-store copy.' },
  { id: 'demo', name: 'Demo Director', role: 'Demo Director', tier: 'brand', model: 'sonnet', reportsTo: 'coo', mission: '60-second demo script, the wow moment.' },
]

export interface PipelineStage { key: string; name: string; sub: string; model: Model }
export const PIPELINE: PipelineStage[] = [
  { key: 'sense', name: 'Sense', sub: 'SQL · RPC read', model: 'haiku' },
  { key: 'compute', name: 'Compute', sub: 'Arithmetic', model: 'det' },
  { key: 'match', name: 'Match', sub: 'Thresholds', model: 'det' },
  { key: 'generate', name: 'Generate', sub: 'Narrative', model: 'sonnet' },
  { key: 'deliver', name: 'Deliver', sub: 'Brief / card', model: 'det' },
]
