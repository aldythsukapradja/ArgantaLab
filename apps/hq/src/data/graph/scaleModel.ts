// CTO architecture & scale model — deterministic. Maps a family count to the
// per-layer monthly cost of the stack, so the architecture's economics are
// explicit. All `simulated` (real pricing shapes, projected). The per-active
// cost reconciles with Treasury's $0.08/active infra load at ~10k families.

export type LayerKey = 'ui' | 'agent' | 'aiml' | 'data' | 'infra'

export interface Layer {
  key: LayerKey
  n: string            // ① … ⑤
  label: string
  sub: string
  color: string
  components: string[]
  scalesWith: string
  costDriver: string
  why: string          // why we need it
  risk: string         // risk if absent
}

export const LAYERS: Layer[] = [
  { key: 'ui', n: '①', label: 'UI / UX', sub: 'the client apps', color: 'var(--acc)',
    components: ['ArgantaLab', 'KinetikCircle', 'Circle HQ', 'Landing'],
    scalesWith: 'active users · bandwidth', costDriver: 'media delivery (Kinetik moments)',
    why: 'The two hooks live here — the kid’s pull and the parent’s stick. No UI, no product.',
    risk: 'Without a CDN, bandwidth for photos/video explodes past 100k.' },
  { key: 'agent', n: '②', label: 'Agent', sub: 'the AI agent OS', color: 'var(--mag)',
    components: ['27-agent OS', 'Sense→Compute→Match→Generate', 'CEO orchestrator'],
    scalesWith: 'agent invocations', costDriver: 'LLM tokens (Generate only)',
    why: 'Deterministic-first: SQL + arithmetic do the work; the LLM only phrases. That keeps the OS at ~$3/mo instead of thousands.',
    risk: 'LLM-first design would 100–1000× the agent bill and fabricate numbers.' },
  { key: 'aiml', n: '③', label: 'AI / ML', sub: 'the learning brain', color: 'var(--acc-text)',
    components: ['mastery / Leitner', 'difficulty adaptation', 'content-gen', 'recommendation', 'RCA'],
    scalesWith: 'learning events', costDriver: 'inference / compute',
    why: 'Adaptive mastery is the depth hook — it decides what each kid sees next.',
    risk: 'Static content flattens engagement; the depth lever stalls.' },
  { key: 'data', n: '④', label: 'Data', sub: 'Supabase spine', color: 'var(--ok)',
    components: ['Postgres', 'Auth · RLS', 'Storage', 'RPCs', 'identity spine', 'hq_event / learn_event'],
    scalesWith: 'rows · storage · DB compute', costDriver: 'tier jumps + media storage',
    why: 'One spine backs all three apps — a single identity + wallet + telemetry source of truth.',
    risk: 'Duplicated identity/wallet per app = drift, double cost, and trust bugs.' },
  { key: 'infra', n: '⑤', label: 'Infra / Scale', sub: 'the physical bill', color: 'var(--warn)',
    components: ['Vercel edge', 'Supabase compute', 'CDN', 'storage buckets'],
    scalesWith: 'everything', costDriver: 'egress bandwidth + compute tier',
    why: 'The scaling substrate — where the $/active actually gets spent.',
    risk: 'Under-provisioned compute at a tier jump = latency and outages.' },
]

export const TIERS = [1000, 10000, 100000, 1000000]
export const TREASURY_PER_ACTIVE = 0.08   // the Treasury infra load to reconcile with

const clamp01 = (x: number) => Math.max(0, Math.min(1, x))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

// stepped Supabase/compute base as scale crosses tiers
function baseCompute(f: number): number {
  if (f < 50_000) return 25          // Pro
  if (f < 300_000) return 25 + 110   // + small compute add-on
  return 25 + 960                    // dedicated / read-replicas
}

export interface Cost { ui: number; agent: number; aiml: number; data: number; infra: number; total: number; perActive: number }

// per-layer $/mo at a given family count. Economies of scale pull compute/
// bandwidth per-active down; media storage per-active drifts up.
export function costAt(f: number): Cost {
  const t = clamp01((Math.log10(Math.max(1000, f)) - 3) / 3)  // 1k→0, 1M→1
  const dataPA = lerp(0.030, 0.015, t)     // DB compute per active ↓
  const storagePA = lerp(0.020, 0.026, t)  // media storage per active ↑
  const bwPA = lerp(0.018, 0.008, t)       // egress per active ↓ (CDN)
  const aimlPA = lerp(0.006, 0.003, t)
  const uiPA = lerp(0.006, 0.003, t)

  const data = f * dataPA + f * storagePA + baseCompute(f)
  const infra = f * bwPA + 20              // + Vercel base
  const agent = f * 0.001 + 3              // deterministic-first: near-flat
  const aiml = f * aimlPA
  const ui = f * uiPA + 15                 // misc/domains
  const total = data + infra + agent + aiml + ui
  return { ui, agent, aiml, data, infra, total, perActive: f > 0 ? total / f : 0 }
}

export interface CurvePoint { f: number; ui: number; agent: number; aiml: number; data: number; infra: number; total: number; perActive: number; [k: string]: number }
// log-spaced curve 1k → 1M for the stacked cost-vs-scale chart
export function costCurve(points = 28): CurvePoint[] {
  const out: CurvePoint[] = []
  for (let i = 0; i < points; i++) {
    const f = Math.round(Math.pow(10, 3 + (3 * i) / (points - 1)))
    const c = costAt(f)
    out.push({ f, ...c })
  }
  return out
}

export const fmtFamilies = (f: number) => (f >= 1e6 ? (f / 1e6).toFixed(f % 1e6 ? 1 : 0) + 'M' : f >= 1e3 ? Math.round(f / 1e3) + 'k' : String(Math.round(f)))
