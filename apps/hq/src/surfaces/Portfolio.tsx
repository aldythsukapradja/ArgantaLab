import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  ArrowDownRight, ArrowUpRight, CheckCircle2, ChevronRight, Circle,
  CircleDashed, Clock3, Compass, ExternalLink, GraduationCap, Layers3, LayoutDashboard,
  Lightbulb, LoaderCircle, Monitor, Repeat2, Rocket, ShieldCheck, Smartphone, Sparkles,
  Sprout, TrendingUp, Users, X, Zap,
} from 'lucide-react'
import { gsap } from 'gsap'
import './portfolio.css'
import { live } from '../data/live'
import type { KinetikStats } from '../data/live'
import type {
  AudienceData, EconomyData, EngagementData, GeoData, GrowthOverview,
  PortfolioVc, PowerCurve, RetentionData, SchemaInsights,
} from '../data/types'
import { AreaTrend } from '../components/d3/AreaTrend'
import { DonutD3 } from '../components/d3/DonutD3'
import { HBars } from '../components/d3/HBars'
import { PunchCard } from '../components/d3/PunchCard'
import { SparkArea, VCols } from '../components/d3/micro'
import { PortfolioWorldMap } from '../components/d3/PortfolioWorldMap'
import { appColor, appLabel, fmtDur, slotColor } from '../components/d3/chartkit'
import { valuationEstimate } from '../data/graph/valuation'
import { Empty, Loading } from '../components/Empty'
import { compact, pct } from '../lib/format'

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: 36500, label: 'All time' },
] as const
const AUDIT_VALUATION = {
  asOf: '13 Jul 2026', low: 1.8, point: 2.2, high: 2.8, safeCap: 2.5,
  qarPoint: 8.0, qarSafe: 9.1, confidence: 'Medium-low',
} as const
const REFRESH_MS = 45_000
const APP_ORDER = ['arganta', 'kinetik', 'lashira', 'hq', 'landing'] as const
export type ProductId = typeof APP_ORDER[number]
type Health = 'good' | 'watch' | 'quiet'
type PreviewMode = 'desktop' | 'mobile'
export type InspectorView = 'overview' | PreviewMode

const PRODUCT_PREVIEWS: Record<ProductId, string> = {
  arganta: 'https://lab.arganta.app/',
  landing: 'https://www.arganta.app/',
  hq: 'https://hq.arganta.app/',
  lashira: 'https://lashirabloom-game-one.vercel.app/',
  kinetik: 'https://circle.arganta.app/',
}
const PREVIEW_VIEWPORTS: Record<PreviewMode, { width: number; height: number; radius: number }> = {
  desktop: { width: 1440, height: 900, radius: 18 },
  mobile: { width: 390, height: 844, radius: 42 },
}
const PREVIEW_CHROME_HEIGHT = 38

const rangeShort = (days: number) => days === 36500 ? 'all time' : `${days}d`

export interface Pulse {
  i: SchemaInsights | null
  k: KinetikStats | null
  o: GrowthOverview | null
  e: EconomyData | null
  v: PortfolioVc | null
  r: RetentionData | null
  eng: EngagementData | null
  pw: PowerCurve | null
  au: AudienceData | null
  geo: GeoData | null
}

export interface ProductCardModel {
  id: ProductId
  name: string
  role: string
  connected: boolean
  health: Health
  healthLabel: string
  primary: string
  primaryLabel: string
  primaryValue: number | null
  primaryUnit: string
  primaryPeriod?: string
  secondary: { value: string; label: string }[]
  interpretation: string
  spark: number[]
}

interface DetailMetric {
  label: string
  value: string
  context: string
  icon: typeof Users
}

interface AttentionItem {
  tone: 'critical' | 'watch' | 'positive'
  label: string
  detail: string
  product: string
}

function useLivePulse(days: number) {
  const [pulse, setPulse] = useState<Pulse | undefined>(undefined)
  const [flight, setFlight] = useState(false)
  const [stamp, setStamp] = useState<number | null>(null)
  const [, forceTick] = useState(0)
  const alive = useRef(true)

  const fetchAll = useCallback(async () => {
    setFlight(true)
    const [i, k, o, e, v, r, eng, pw, au, geo] = await Promise.all([
      live.schemaInsights(), live.kinetikStats(), live.growthOverview(),
      live.economy(), live.portfolioVc(), live.retention(),
      live.engagement(days), live.powerCurve(Math.min(days, 90)), live.audience(), live.geo(days),
    ])
    if (!alive.current) return
    setPulse({ i, k, o, e, v, r, eng, pw, au, geo })
    setStamp(Date.now())
    setFlight(false)
  }, [days])

  useEffect(() => {
    alive.current = true
    void fetchAll()
    const refresh = setInterval(() => {
      if (document.visibilityState === 'visible') void fetchAll()
    }, REFRESH_MS)
    const clock = setInterval(() => forceTick(t => t + 1), 5000)
    return () => { alive.current = false; clearInterval(refresh); clearInterval(clock) }
  }, [fetchAll])

  return { pulse, flight, stamp }
}

export function AppLogo({ app, size = 28 }: { app: string; size?: number }) {
  if (app === 'kinetik') {
    return (
      <span className="pf-logo" style={{ width: size, height: size, borderRadius: size * .27, overflow: 'hidden' }}>
        <svg width="100%" height="100%" viewBox="0 0 44 44" role="img" aria-label="KinetikCircle">
          <defs><linearGradient id={`pf-kinetik-${size}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#22D3EE" /><stop offset="1" stopColor="#8B5CF6" /></linearGradient></defs>
          <rect width="44" height="44" rx="11" fill={`url(#pf-kinetik-${size})`} />
          <circle cx="22" cy="22" r="9" fill="none" stroke="#fff" strokeWidth="3.4" />
          <circle cx="29" cy="15.5" r="2.9" fill="#fff" />
        </svg>
      </span>
    )
  }
  const cfg: Record<string, { bg: string; Icon: typeof GraduationCap }> = {
    arganta: { bg: 'var(--ch1)', Icon: GraduationCap },
    lashira: { bg: 'var(--ch2)', Icon: Sprout },
    hq: { bg: 'var(--mag)', Icon: CircleDashed },
    landing: { bg: 'var(--ch5)', Icon: Rocket },
  }
  const { bg, Icon } = cfg[app] ?? { bg: 'var(--bg3)', Icon: Circle }
  return <span className="pf-logo" style={{ width: size, height: size, borderRadius: size * .27, background: bg }}><Icon size={Math.round(size * .52)} color="#fff" /></span>
}

function dailyFor(eng: EngagementData | null, app: string) {
  if (!eng) return []
  const days = Array.from(new Set(eng.daily.map(d => d.day)))
  return days.map(day => eng.daily.find(d => d.day === day && d.app === app)?.seconds ?? 0)
}

function topPage(eng: EngagementData | null, app: string) {
  return eng?.pages.find(p => p.app === app) ?? null
}

function engagementFor(eng: EngagementData | null, app: string) {
  return eng?.apps.find(a => a.app === app) ?? null
}

export function buildProducts(p: Pulse, days: number): ProductCardModel[] {
  const { i, k, o, v, eng } = p
  const a = (id: string) => engagementFor(eng, id)
  const page = (id: string) => topPage(eng, id)
  const models: ProductCardModel[] = [
    {
      id: 'arganta', name: 'ArgantaLab', role: 'Learning engine', connected: !!i,
      health: o?.wowPct != null && o.wowPct < 0 ? 'watch' : 'good',
      healthLabel: o?.wowPct != null && o.wowPct < 0 ? 'Needs attention' : 'Healthy',
      primary: o ? compact(o.wau) : '—', primaryLabel: 'weekly active learners',
      primaryValue: o?.wau ?? null, primaryUnit: 'weekly learners',
      secondary: [
        { value: v?.lessonsPerKidDay == null ? '—' : String(v.lessonsPerKidDay), label: 'lessons / day' },
        { value: o?.stickiness == null ? '—' : pct(o.stickiness), label: 'stickiness' },
      ],
      interpretation: o?.wowPct == null ? 'Waiting for a comparable week.' : o.wowPct < 0 ? `Weekly engagement is down ${Math.abs(o.wowPct)}%.` : `Weekly engagement is up ${o.wowPct}%.`,
      spark: dailyFor(eng, 'arganta'),
    },
    {
      id: 'kinetik', name: 'KinetikCircle', role: 'Circle coordination', connected: !!k,
      health: k && k.posts7d > 0 ? 'good' : 'watch', healthLabel: k && k.posts7d > 0 ? 'Active' : 'Low activity',
      primary: k ? compact(k.members) : '—', primaryLabel: 'circle members',
      primaryValue: k?.members ?? null, primaryUnit: 'members',
      secondary: [
        { value: k ? compact(k.circles) : '—', label: 'circles' },
        { value: k ? compact(k.posts7d) : '—', label: 'posts · 7d' },
      ],
      interpretation: k?.posts7d ? `${k.posts7d} posts kept circles moving this week.` : 'The network exists; recent posting is quiet.',
      spark: dailyFor(eng, 'kinetik'),
    },
    {
      id: 'lashira', name: 'LashiraBloom', role: 'Play and progression', connected: !!a('lashira'),
      health: a('lashira') ? 'good' : 'quiet', healthLabel: a('lashira') ? 'Reporting' : 'Awaiting signal',
      primary: a('lashira') ? compact(a('lashira')!.users) : '—', primaryLabel: 'active players',
      primaryValue: a('lashira')?.users ?? null,
      primaryUnit: a('lashira')?.users === 1 ? 'active player' : 'active players',
      secondary: [
        { value: a('lashira') ? fmtDur(a('lashira')!.seconds) : '—', label: `attention · ${rangeShort(days)}` },
        { value: page('lashira')?.page ?? '—', label: 'top scene' },
      ],
      interpretation: a('lashira') ? `${page('lashira')?.page ?? 'Gameplay'} is earning the most time.` : 'Open the game once after a green deploy to verify beats.',
      spark: dailyFor(eng, 'lashira'),
    },
    {
      id: 'hq', name: 'Circle HQ', role: 'Founder operating system', connected: !!a('hq'),
      health: a('hq') ? 'good' : 'quiet', healthLabel: a('hq') ? 'Live' : 'Awaiting signal',
      primary: a('hq') ? fmtDur(a('hq')!.seconds) : '—', primaryLabel: `operator attention · ${rangeShort(days)}`,
      primaryValue: a('hq') ? Math.round(a('hq')!.seconds / 360) / 10 : null,
      primaryUnit: 'h attention', primaryPeriod: rangeShort(days),
      secondary: [
        { value: a('hq') ? compact(a('hq')!.users) : '—', label: 'operators' },
        { value: page('hq')?.page ?? '—', label: 'top workspace' },
      ],
      interpretation: page('hq') ? `${page('hq')!.page} is the most-used HQ surface.` : 'HQ usage will appear after the next heartbeat.',
      spark: dailyFor(eng, 'hq'),
    },
    {
      id: 'landing', name: 'Landing', role: 'Acquisition surface', connected: !!a('landing'),
      health: a('landing') && a('landing')!.users > 1 ? 'good' : 'watch', healthLabel: a('landing') && a('landing')!.users > 1 ? 'Receiving visits' : 'Thin traffic',
      primary: a('landing') ? compact(a('landing')!.users) : '—', primaryLabel: `visitors · ${rangeShort(days)}`,
      primaryValue: a('landing')?.users ?? null,
      primaryUnit: 'visitors', primaryPeriod: rangeShort(days),
      secondary: [
        { value: a('landing') ? fmtDur(a('landing')!.avgSession ?? 0) : '—', label: 'average visit' },
        { value: page('landing')?.page ?? '—', label: 'top section' },
      ],
      interpretation: a('landing') ? `${page('landing')?.page ?? 'The site'} gets the deepest visits.` : 'Traffic instrumentation has not reported yet.',
      spark: dailyFor(eng, 'landing'),
    },
  ]
  return models
}

function buildAttention(p: Pulse, products: ProductCardModel[]): AttentionItem[] {
  const { o, v, eng } = p
  const items: AttentionItem[] = []
  if (o?.wowPct != null && o.wowPct < 0) items.push({ tone: 'critical', label: 'Weekly engagement is falling', detail: `${Math.abs(o.wowPct)}% fewer active learners than the previous week.`, product: 'ArgantaLab' })
  if (v?.d1Retention != null && v.d1Retention < 40) items.push({ tone: 'critical', label: 'Next-day return is below target', detail: `${pct(v.d1Retention)} return the next day; the working benchmark is 40%.`, product: 'Retention' })
  const external = eng?.apps.filter(app => app.app !== 'hq') ?? []
  const externalSeconds = external.reduce((sum, app) => sum + app.seconds, 0)
  const top = external[0]
  if (top && externalSeconds > 0 && top.seconds / externalSeconds > .55) items.push({ tone: 'watch', label: 'External attention is concentrated', detail: `${appLabel(top.app)} owns ${Math.round(100 * top.seconds / externalSeconds)}% of customer-facing time.`, product: appLabel(top.app) })
  const disconnected = products.find(x => !x.connected)
  if (disconnected) items.push({ tone: 'watch', label: `${disconnected.name} is not reporting`, detail: 'The portfolio cannot judge retention or depth until usage beats arrive.', product: disconnected.name })
  if (v?.activationRate != null && v.activationRate >= 50) items.push({ tone: 'positive', label: 'Activation is holding', detail: `${pct(v.activationRate)} of new accounts reach a meaningful action within 48 hours.`, product: 'Ecosystem' })
  if (items.length === 0) items.push({ tone: 'positive', label: 'No urgent portfolio signal', detail: 'The connected products are inside their current operating bands.', product: 'Ecosystem' })
  return items.slice(0, 3)
}

function portfolioNarrative(p: Pulse) {
  const { o, eng } = p
  if (!o) return 'The portfolio is connected, but the north-star rollup is still loading its first comparable period.'
  const top = eng?.apps.find(app => app.app !== 'hq')
  if (o.wowPct != null && o.wowPct < 0) return `Weekly engagement is down ${Math.abs(o.wowPct)}%. ${top ? `${appLabel(top.app)} currently earns the most measured attention.` : 'Attention data will show where the change originated.'}`
  if (o.wowPct != null && o.wowPct > 0) return `Weekly engagement is up ${o.wowPct}%. ${top ? `${appLabel(top.app)} is leading the portfolio.` : ''}`
  return `${compact(o.wau)} people were meaningfully active this week. The next job is turning activity into a repeatable habit.`
}

export function Portfolio() {
  const [days, setDays] = useState<number>(14)
  const { pulse, flight, stamp } = useLivePulse(days)

  if (pulse === undefined) return <div className="pf-wrap"><Loading label="Loading portfolio brief…" /></div>
  const offline = !pulse.i && !pulse.k && !pulse.o && !pulse.v
  if (offline) return <div className="pf-wrap"><Empty title="Portfolio Brief needs a live connection">Connect Supabase and sign in as operator. The brief will assemble itself from the existing portfolio signals.</Empty></div>

  const ago = stamp ? Math.max(0, Math.round((Date.now() - stamp) / 1000)) : null

  return <PortfolioBrief pulse={pulse} days={days} setDays={setDays} ago={ago} flight={flight} />
}

export function PortfolioBrief({ pulse, days, setDays, ago = 0, flight = false }: {
  pulse: Pulse; days: number; setDays: (days: number) => void; ago?: number | null; flight?: boolean
}) {
  const [selected, setSelected] = useState<ProductId | null>(null)
  const products = buildProducts(pulse, days)
  const attention = buildAttention(pulse, products)

  useEffect(() => {
    if (!selected) return
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelected(null) }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [selected])

  return (
    <div className="pf-wrap">
      <div className="pf-shell">
        <PortfolioHeader pulse={pulse} days={days} setDays={setDays} ago={ago} flight={flight} />
        <div className="pf-command-grid">
          <AttentionOverview eng={pulse.eng} days={days} />
          <FounderAttention items={attention} />
        </div>
        <ProductFleet products={products} onSelect={setSelected} />
      </div>
      {selected && <ProductDetail product={products.find(product => product.id === selected)!} pulse={pulse} days={days} onClose={() => setSelected(null)} />}
    </div>
  )
}

export function PortfolioHeader({ pulse, days, setDays, ago, flight }: {
  pulse: Pulse; days: number; setDays: (d: number) => void; ago: number | null; flight: boolean
}) {
  const { o, v } = pulse
  const down = o?.wowPct != null && o.wowPct < 0
  return (
    <header className="pf-header">
      <div className="pf-header-copy">
        <div className="pf-eyebrow"><span className="pf-live-dot" />Portfolio brief <span>· live company signal</span></div>
        <div className="pf-headline-row">
          <div className="pf-hero-number">{o ? compact(o.wau) : '—'}</div>
          <div>
            <h1>Weekly engaged</h1>
            <div className={`pf-delta ${down ? 'down' : 'up'}`}>
              {down ? <ArrowDownRight size={15} /> : <ArrowUpRight size={15} />}
              {o?.wowPct == null ? 'Awaiting comparison' : `${Math.abs(o.wowPct)}% week over week`}
            </div>
          </div>
        </div>
        <p className="pf-narrative">{portfolioNarrative(pulse)}</p>
      </div>

      <div className="pf-header-side">
        <div className="pf-period" role="group" aria-label="Portfolio date range">
          {RANGES.map(range => <button key={range.days} className={days === range.days ? 'on' : ''} onClick={() => setDays(range.days)}>{range.label}</button>)}
        </div>
        <div className="pf-refresh"><span className={flight ? 'spinning' : ''} />{flight ? 'Refreshing signals' : `Updated ${ago == null ? '—' : ago < 5 ? 'just now' : `${ago}s ago`}`}</div>
        <div className="pf-inputs">
          <div><span>Activation</span><b>{v?.activationRate == null ? '—' : pct(v.activationRate)}</b></div>
          <div><span>D1 return</span><b>{v?.d1Retention == null ? '—' : pct(v.d1Retention)}</b></div>
          <div><span>Lessons / day</span><b>{v?.lessonsPerKidDay ?? '—'}</b></div>
          <div><span>Active circles</span><b>{v ? compact(v.flywheelCount) : '—'}</b></div>
        </div>
      </div>
    </header>
  )
}

export function AttentionOverview({ eng, days }: { eng: EngagementData | null; days: number }) {
  const external = (eng?.apps ?? []).filter(app => app.app !== 'hq' && app.seconds > 0)
  const externalTotal = external.reduce((sum, app) => sum + app.seconds, 0)
  const allApps = (eng?.apps ?? []).filter(app => app.seconds > 0)
  return (
    <section className="card pf-attention">
      <div className="pf-section-head">
        <div><div className="pf-kicker">Attention</div><h2>Where the portfolio earns time</h2><p>Customer-facing products are separated from Circle HQ, the internal development platform · last {days === 36500 ? 'all time' : `${days} days`}.</p></div>
      </div>
      {!eng || allApps.length === 0 ? <PortfolioEmpty headline="Attention has not arrived yet" body="The live usage trackers are connected; this view fills as products are used." /> : (
        <div className="pf-attention-visuals">
          <div className="pf-donut-panel">
            <div className="pf-chart-label"><span>External portfolio</span><b>Customer-facing share of time</b></div>
            {external.length ? <DonutD3 size={190} centerValue={fmtDur(externalTotal)} centerLabel="external time" valueFmt={fmtDur}
              slices={external.map(app => ({ label: appLabel(app.app), value: app.seconds, color: appColor(app.app) }))} />
              : <PortfolioEmpty headline="No external usage yet" body="Circle HQ is intentionally excluded from this donut." />}
          </div>
          <div className="pf-bars-panel">
            <div className="pf-chart-label"><span>Operating context</span><b>All measured attention</b><small>Circle HQ appears only here.</small></div>
            <HBars labelWidth={112} barH={18} valueFmt={fmtDur} bars={allApps.map(app => ({ label: appLabel(app.app), value: app.seconds, color: appColor(app.app) }))} />
          </div>
        </div>
      )}
    </section>
  )
}

export function FounderAttention({ items }: { items: AttentionItem[] }) {
  return (
    <aside className="card pf-founder">
      <div className="pf-section-head compact">
        <div><div className="pf-kicker"><Sparkles size={13} />Founder attention</div><h2>What deserves a decision</h2><p>Derived from current portfolio signals—not a separate data source.</p></div>
      </div>
      <div className="pf-attention-list">
        {items.map((item, index) => (
          <div className={`pf-attention-item ${item.tone}`} key={item.label}>
            <span className="pf-rank">0{index + 1}</span>
            <div><div className="pf-item-meta"><span>{item.product}</span><i /></div><h3>{item.label}</h3><p>{item.detail}</p></div>
            <ChevronRight size={17} />
          </div>
        ))}
      </div>
      <div className="pf-founder-note"><Lightbulb size={15} /><span>The brief prioritizes direction, return, concentration, and missing signal. It never invents a metric.</span></div>
    </aside>
  )
}

export function ProductFleet({ products, onSelect }: { products: ProductCardModel[]; onSelect: (id: ProductId) => void }) {
  return (
    <section className="pf-fleet">
      <div className="pf-section-head inline">
        <div><div className="pf-kicker">Product fleet</div><h2>Five products, one operating view</h2></div>
        <p>Select a product to inspect its operating detail.</p>
      </div>
      <div className="pf-product-grid">
        {products.map(product => (
          <button key={product.id} className="pf-product-card" onClick={() => onSelect(product.id)} aria-haspopup="dialog">
            <div className="pf-product-top">
              <AppLogo app={product.id} />
              <div className="pf-product-name"><b>{product.name}</b><span>{product.role}</span></div>
              <span className={`pf-health ${product.health}`}><i />{product.healthLabel}</span>
            </div>
            <div className="pf-product-primary">
              <b>{product.primaryValue != null ? compact(product.primaryValue) : product.primary} <i>{product.primaryUnit}</i></b>
              <span>{product.primaryPeriod ? `${product.primaryPeriod} · ` : ''}{product.primaryLabel}</span>
            </div>
            <div className="pf-product-secondary">
              {product.secondary.map(metric => <div key={metric.label}><b>{metric.value}</b><span>{metric.label}</span></div>)}
            </div>
            <div className="pf-product-spark">{product.spark.filter(Boolean).length > 1 ? <SparkArea values={product.spark} color={appColor(product.id)} height={34} /> : <span>Trend builds with repeat visits</span>}</div>
            <p className="pf-product-read">{product.interpretation}</p>
            <div className="pf-inspect">Inspect product <ChevronRight size={14} /></div>
          </button>
        ))}
      </div>
    </section>
  )
}

function detailMetrics(product: ProductCardModel, p: Pulse, days: number): DetailMetric[] {
  const { i, k, o, v, e, eng } = p
  const a = engagementFor(eng, product.id)
  const page = topPage(eng, product.id)
  const common: DetailMetric[] = [
    { label: 'People', value: a ? compact(a.users) : '—', context: 'measured active people', icon: Users },
    { label: 'Attention', value: a ? fmtDur(a.seconds) : '—', context: `total · ${rangeShort(days)}`, icon: Clock3 },
    { label: 'Average session', value: a?.avgSession ? fmtDur(a.avgSession) : '—', context: 'active session time', icon: Repeat2 },
    { label: 'Top surface', value: page?.page ?? '—', context: 'most attention', icon: Compass },
  ]
  if (product.id === 'arganta') return [
    { label: 'Learners', value: i ? compact(i.learners) : '—', context: 'registered learners', icon: Users },
    { label: 'Core action', value: v?.lessonsPerKidDay == null ? '—' : String(v.lessonsPerKidDay), context: 'lessons per active kid / day', icon: Zap },
    { label: 'Depth', value: o?.accuracyPct == null ? '—' : pct(o.accuracyPct), context: 'learning accuracy', icon: Layers3 },
    { label: 'Comeback', value: v?.d1Retention == null ? '—' : pct(v.d1Retention), context: 'next-day return', icon: Repeat2 },
    { label: 'Habit', value: o?.stickiness == null ? '—' : pct(o.stickiness), context: 'DAU / MAU', icon: TrendingUp },
    { label: 'Economy', value: e?.coverage == null ? '—' : pct(e.coverage), context: 'recurring mint covered by spend', icon: Sparkles },
  ]
  if (product.id === 'kinetik') return [
    { label: 'People', value: k ? compact(k.members) : '—', context: 'circle members', icon: Users },
    { label: 'Reach', value: k ? compact(k.circles) : '—', context: 'connected circles', icon: Compass },
    { label: 'Core action', value: k ? compact(k.posts7d) : '—', context: 'posts over 7 days', icon: Zap },
    { label: 'Depth', value: k ? compact(k.reactions) : '—', context: 'reactions', icon: Layers3 },
    { label: 'Habit', value: k?.calPerDay == null ? '—' : String(k.calPerDay), context: 'calendar actions / day', icon: Repeat2 },
    { label: 'Flywheel', value: v && v.familiesTotal ? pct(100 * v.flywheelCount / v.familiesTotal) : '—', context: 'active family circles', icon: TrendingUp },
  ]
  return [...common, {
    label: 'Interactions', value: a?.clicks ? compact(a.clicks) : '—', context: 'measured clicks', icon: Zap,
  }, {
    label: 'Frequency', value: a?.users ? (a.sessions / a.users).toFixed(1) : '—', context: 'sessions per person', icon: TrendingUp,
  }]
}

function InspectorViewSwitcher({ view, onChange }: { view: InspectorView; onChange: (view: InspectorView) => void }) {
  const options: { view: InspectorView; label: string; Icon: typeof LayoutDashboard }[] = [
    { view: 'overview', label: 'Overview', Icon: LayoutDashboard },
    { view: 'desktop', label: 'Desktop', Icon: Monitor },
    { view: 'mobile', label: 'Mobile', Icon: Smartphone },
  ]

  const choose = (nextView: InspectorView, button: HTMLButtonElement) => {
    if (nextView === view) return
    gsap.fromTo(button, { scale: .94 }, { scale: 1, duration: .42, ease: 'back.out(2.4)', overwrite: true })
    onChange(nextView)
  }

  return (
    <div className="pf-inspector-modes" role="group" aria-label="Product inspector view">
      {options.map(({ view: option, label, Icon }) => (
        <button
          type="button"
          key={option}
          className={view === option ? 'on' : ''}
          aria-pressed={view === option}
          onClick={event => choose(option, event.currentTarget)}
        >
          <Icon size={14} />{label}
        </button>
      ))}
    </div>
  )
}

function LiveProductPreview({ product, mode }: { product: ProductCardModel; mode: PreviewMode }) {
  const [loaded, setLoaded] = useState(false)
  const [fit, setFit] = useState(100)
  const stageRef = useRef<HTMLDivElement>(null)
  const deviceRef = useRef<HTMLDivElement>(null)
  const veilRef = useRef<HTMLDivElement>(null)
  const firstLayout = useRef(true)
  const previousMode = useRef<PreviewMode>(mode)
  const url = PRODUCT_PREVIEWS[product.id]
  const hostname = new URL(url).hostname
  const viewport = PREVIEW_VIEWPORTS[mode]

  useEffect(() => setLoaded(false), [url])

  useLayoutEffect(() => {
    const stage = stageRef.current
    const device = deviceRef.current
    const veil = veilRef.current
    if (!stage || !device || !veil) return

    let lastWidth = 0
    let lastHeight = 0
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const modeChanged = previousMode.current !== mode

    const fitDevice = (animate: boolean, animateModeChange = false) => {
      const bounds = stage.getBoundingClientRect()
      if (!bounds.width || !bounds.height) return
      lastWidth = bounds.width
      lastHeight = bounds.height
      const inset = bounds.width < 560 ? 24 : 46
      const deviceHeight = viewport.height + PREVIEW_CHROME_HEIGHT
      const scale = Math.max(.12, Math.min(
        1,
        (bounds.width - inset) / viewport.width,
        (bounds.height - inset) / deviceHeight,
      ))
      setFit(current => Math.abs(current - Math.round(scale * 100)) > 0 ? Math.round(scale * 100) : current)

      gsap.killTweensOf([device, veil])
      const target = {
        width: viewport.width,
        height: deviceHeight,
        scale,
        borderRadius: viewport.radius,
        xPercent: -50,
        yPercent: -50,
        transformOrigin: '50% 50%',
      }

      if (!animate || reducedMotion || firstLayout.current) {
        gsap.set(device, target)
        gsap.set(veil, { opacity: 0 })
        firstLayout.current = false
        return
      }

      const duration = animateModeChange ? .9 : .38
      const timeline = gsap.timeline({ defaults: { overwrite: 'auto' } })
      timeline
        .to(veil, { opacity: animateModeChange ? .28 : .12, duration: .16, ease: 'power2.out' }, 0)
        .to(device, { ...target, duration, ease: animateModeChange ? 'expo.inOut' : 'power3.out' }, 0)
        .to(veil, { opacity: 0, duration: .4, ease: 'power2.out' }, Math.max(.12, duration * .52))
    }

    fitDevice(true, modeChanged)
    previousMode.current = mode

    const resizeObserver = new ResizeObserver(entries => {
      const bounds = entries[0]?.contentRect
      if (!bounds || (Math.abs(bounds.width - lastWidth) < 1 && Math.abs(bounds.height - lastHeight) < 1)) return
      fitDevice(true, false)
    })
    resizeObserver.observe(stage)

    return () => {
      resizeObserver.disconnect()
      gsap.killTweensOf([device, veil])
    }
  }, [mode, viewport.height, viewport.radius, viewport.width])

  return (
    <section className="pf-live-preview" style={{ '--pf-live-accent': appColor(product.id) } as CSSProperties} aria-label={`${product.name} live product preview`}>
      <div className="pf-live-toolbar">
        <div className="pf-live-heading">
          <span>Live product</span>
          <b>Responsive application canvas</b>
        </div>
        <div className="pf-live-tools">
          <span className="pf-live-fit" aria-live="polite">Fit · {fit}%</span>
        </div>
      </div>

      <div className="pf-live-stage" ref={stageRef} data-mode={mode}>
        <div className="pf-live-stage-glow" />
        <div className="pf-live-device" ref={deviceRef} data-mode={mode}>
          <div className="pf-live-browserbar">
            <span className="pf-live-traffic" aria-hidden="true"><i /><i /><i /></span>
            <span className="pf-live-address">{hostname}</span>
            <a href={url} target="_blank" rel="noreferrer" aria-label={`Open ${product.name} in a new tab`} title="Open live app">
              <ExternalLink size={15} />
            </a>
          </div>
          <iframe
            className="pf-live-iframe"
            src={url}
            title={`${product.name} live ${mode} preview`}
            loading="eager"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="fullscreen; clipboard-read; clipboard-write"
            allowFullScreen
            onLoad={() => setLoaded(true)}
          />
          <div className="pf-live-veil" ref={veilRef} />
          <div className={`pf-live-loading${loaded ? ' loaded' : ''}`} aria-hidden={loaded}>
            <LoaderCircle size={20} />
            <span>Opening {product.name}</span>
          </div>
          <span className="pf-live-home" aria-hidden="true" />
        </div>
      </div>
      <p className="pf-live-caption">Interactive live surface · {viewport.width} × {viewport.height} viewport, scaled to fit</p>
    </section>
  )
}

export function ProductDetail({ product, pulse, days, onClose, view: viewProp, onViewChange }: { product: ProductCardModel; pulse: Pulse; days: number; onClose: () => void; view?: InspectorView; onViewChange?: (view: InspectorView) => void }) {
  const [internalView, setInternalView] = useState<InspectorView>('overview')
  const view = viewProp ?? internalView // the Director (or the voice/gesture copilot) can drive the tab externally
  const setView = (next: InspectorView) => { setInternalView(next); onViewChange?.(next) }
  const viewPanelRef = useRef<HTMLDivElement>(null)
  const overviewLayoutRef = useRef<HTMLDivElement>(null)
  const { eng, r, pw, au, geo } = pulse
  const labels = eng ? Array.from(new Set(eng.daily.map(d => d.day))) : []
  const values = dailyFor(eng, product.id)
  const pages = eng?.pages.filter(page => page.app === product.id).slice(0, 5) ?? []
  const metrics = detailMetrics(product, pulse, days)
  const roleTotal = au?.roles.reduce((sum, role) => sum + role.count, 0) ?? 0
  const devices = (au?.devices ?? []).filter(device => device.device !== 'unknown')
  const deviceTotal = devices.reduce((sum, device) => sum + device.seconds, 0)
  const retentionCurve = useMemo(() => {
    if (!r?.cohorts.length) return []
    return r.horizons.map((horizon, index) => {
      const points = r.cohorts.map(cohort => cohort.ret[index]).filter((value): value is number => value != null)
      return { horizon, value: points.length ? Math.round(points.reduce((sum, value) => sum + value, 0) / points.length) : 0 }
    })
  }, [r])
  const power = pw?.histogram.map(bucket => ({ label: `${bucket.daysActive}d`, value: bucket.users })) ?? []

  useLayoutEffect(() => {
    const panel = viewPanelRef.current
    if (!panel) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      gsap.set(panel, { clearProps: 'all' })
      return
    }
    gsap.fromTo(
      panel,
      { opacity: 0, y: 9, scale: .992 },
      { opacity: 1, y: 0, scale: 1, duration: .42, ease: 'power3.out', clearProps: 'transform', overwrite: true },
    )
    return () => { gsap.killTweensOf(panel) }
  }, [view])

  useLayoutEffect(() => {
    if (view !== 'overview') return
    const panel = viewPanelRef.current
    const layout = overviewLayoutRef.current
    if (!panel || !layout) return

    let frame = 0
    const fitOverview = () => {
      layout.style.width = '100%'
      layout.style.height = 'calc(100% - 12px)'
      layout.style.transform = 'none'
      layout.style.transformOrigin = '0 0'

      if (panel.clientWidth < 760) return
      const main = layout.querySelector<HTMLElement>('.pf-detail-main')
      const signals = layout.querySelector<HTMLElement>('.pf-signals')
      const availableHeight = Math.max(1, panel.clientHeight - 12)
      const contentHeight = Math.max(main?.scrollHeight ?? 0, signals?.scrollHeight ?? 0)
      const requiredHeight = Math.max(availableHeight, contentHeight + 32)
      const scale = Math.min(1, availableHeight / requiredHeight)
      if (scale >= .995) return

      layout.style.width = `${100 / scale}%`
      layout.style.height = `${requiredHeight}px`
      layout.style.transform = `scale(${scale})`
    }
    const scheduleFit = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(() => { frame = window.requestAnimationFrame(fitOverview) })
    }

    scheduleFit()
    const settleTimer = window.setTimeout(scheduleFit, 320)
    const resizeObserver = new ResizeObserver(scheduleFit)
    resizeObserver.observe(panel)
    return () => {
      window.cancelAnimationFrame(frame)
      window.clearTimeout(settleTimer)
      resizeObserver.disconnect()
    }
  }, [view])

  return (
    <div className="pf-modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
    <section className={`card pf-detail view-${view}`} data-view={view} style={{ '--pf-live-accent': appColor(product.id) } as CSSProperties} role="dialog" aria-modal="true" aria-labelledby="pf-product-dialog-title">
      <div className="pf-detail-head">
        <div className="pf-detail-title"><AppLogo app={product.id} size={34} /><div><div className="pf-kicker">Selected product</div><h2 id="pf-product-dialog-title">{product.name} operating detail</h2><p>{product.interpretation}</p></div></div>
        <InspectorViewSwitcher view={view} onChange={setView} />
        <div className="pf-detail-actions"><span className={`pf-health ${product.health}`}><i />{product.healthLabel}</span><button className="pf-modal-close" onClick={onClose} aria-label="Close product inspector" autoFocus><X size={18} /></button></div>
      </div>

      <div className="pf-inspector-panel" ref={viewPanelRef} key={view === 'overview' ? 'overview' : 'live'}>
      {view === 'overview' ? <div className="pf-detail-layout" ref={overviewLayoutRef}>
        <div className="pf-detail-main">
          <div className="pf-metric-grid">
            {metrics.map(({ label, value, context, icon: Icon }) => <div className="pf-metric" key={label}><Icon size={15} /><span>{label}</span><b>{value}</b><small>{context}</small></div>)}
          </div>
          <div className="pf-detail-charts">
            <div className="pf-subpanel">
              <div className="pf-subhead"><div><span>Daily attention</span><b>{product.name} rhythm</b></div><span>{rangeShort(days)} view</span></div>
              {labels.length >= 3 && values.some(Boolean)
                ? <AreaTrend labels={labels} series={[{ key: 'value', label: product.name, color: appColor(product.id), area: true }]} data={values.map(value => ({ value }))} height={180} valueFmt={fmtDur} />
                : <PortfolioEmpty headline="A trend needs three days" body="Daily activity will replace this state after repeat visits." />}
            </div>
            <div className="pf-subpanel">
              <div className="pf-subhead"><div><span>Top surfaces</span><b>Where depth accumulates</b></div></div>
              {pages.length ? <HBars bars={pages.map(page => ({ label: page.page, value: page.seconds, color: appColor(product.id) }))} valueFmt={fmtDur} labelWidth={118} barH={17} />
                : <PortfolioEmpty headline="No surfaces tracked" body="Page and scene depth appears as usage beats arrive." />}
            </div>
          </div>
          <div className="pf-intelligence-grid">
            <ValuationAuditPanel />
            <div className="pf-intel-panel pf-map-panel">
              <div className="pf-subhead"><div><span>Live reach</span><b>Timezone activity map</b></div><small>Coarse · kid-safe · never GPS/IP</small></div>
              {geo?.regions.length ? <PortfolioWorldMap geo={geo} height={230} /> : <PortfolioEmpty headline="No timezone signal yet" body="The map renders only live hq_geo regions." />}
            </div>
          </div>
        </div>

        <aside className="pf-signals">
          <div className="pf-subhead"><div><span>Ecosystem context</span><b>Signals around this product</b></div></div>
          <div className="pf-signal-block">
            <span>Retention curve</span>
            {retentionCurve.length >= 2 ? <AreaTrend labels={retentionCurve.map(point => point.horizon)} series={[{ key: 'value', label: 'Still active', color: 'var(--ch2)', area: true }]} data={retentionCurve.map(point => ({ value: point.value }))} height={100} valueFmt={value => `${Math.round(value)}%`} /> : <small>No cohorts yet</small>}
          </div>
          <div className="pf-signal-block">
            <span>Power-user curve</span>
            {power.some(point => point.value > 0) ? <VCols values={power} height={76} labelEvery={3} ariaLabel="Power user curve" /> : <small>Repeat visits will form the curve.</small>}
          </div>
          {eng && eng.punch.filter(point => point.seconds > 0).length >= 6 && <div className="pf-signal-block"><span>Weekly rhythm</span><PunchCard punch={eng.punch} /></div>}
          {roleTotal > 0 && <SplitSignal label="Audience" items={au!.roles.map((role, index) => ({ label: `${role.role} ${role.count}`, value: role.count, color: slotColor(index) }))} total={roleTotal} />}
          {deviceTotal > 0 && <SplitSignal label="Devices" items={devices.map((device, index) => ({ label: `${device.device} ${Math.round(100 * device.seconds / deviceTotal)}%`, value: device.seconds, color: slotColor(index + 3) }))} total={deviceTotal} />}
          <div className="pf-signal-block">
            <span>Regions · timezone, kid-safe</span>
            {geo?.regions.length ? <HBars bars={geo.regions.slice(0, 3).map(region => ({ label: region.tz.split('/').pop()!.replace(/_/g, ' '), value: region.seconds, color: 'var(--ch6)' }))} valueFmt={fmtDur} labelWidth={88} barH={10} /> : <small>No coarse region signal yet.</small>}
          </div>
        </aside>
      </div> : <div className="pf-detail-layout pf-detail-layout-live">
        <LiveProductPreview product={product} mode={view} />
      </div>}
      </div>
    </section>
    </div>
  )
}

export function ValuationAuditPanel({ compact = false }: { compact?: boolean } = {}) {
  const engine = valuationEstimate(AUDIT_VALUATION.asOf)
  const max = Math.max(6, ...engine.methods.map(method => method.high))
  const pctOf = (value: number) => `${Math.max(0, Math.min(100, 100 * value / max))}%`
  return (
    <div className={`pf-intel-panel pf-valuation${compact ? ' compact' : ''}`}>
      <div className="pf-subhead"><div><span>Arganta valuation</span><b>Latest valuation audit</b></div><small>Snapshot · {AUDIT_VALUATION.asOf}</small></div>
      <div className="pf-valuation-hero">
        <div><span>Audit point estimate</span><b>${AUDIT_VALUATION.point.toFixed(1)}M</b><small>≈ QAR {AUDIT_VALUATION.qarPoint.toFixed(1)}M</small></div>
        <div><span>Defensible pre-money range</span><b>${AUDIT_VALUATION.low.toFixed(1)}M–${AUDIT_VALUATION.high.toFixed(1)}M</b><small>{AUDIT_VALUATION.confidence} confidence</small></div>
        <div><span>Fundraising opening</span><b>${AUDIT_VALUATION.safeCap.toFixed(1)}M SAFE</b><small>≈ QAR {AUDIT_VALUATION.qarSafe.toFixed(1)}M</small></div>
      </div>
      <div className="pf-valuation-scale">
        <div className="pf-value-track">
          <i className="audit-band" style={{ left: pctOf(AUDIT_VALUATION.low), width: pctOf(AUDIT_VALUATION.high - AUDIT_VALUATION.low) }} />
          <i className="audit-point" style={{ left: pctOf(AUDIT_VALUATION.point) }} />
          <i className="safe-point" style={{ left: pctOf(AUDIT_VALUATION.safeCap) }} />
        </div>
        <div className="pf-value-axis"><span>$0</span><span>${(max / 2).toFixed(1)}M</span><span>${max.toFixed(0)}M</span></div>
      </div>
      {!compact && <>
        <div className="pf-methods">
          {engine.methods.map(method => <div className="pf-method" key={method.method}><span>{method.label}</span><div><i style={{ left: pctOf(method.low), width: pctOf(method.high - method.low) }} /></div><b>${method.low.toFixed(2)}–{method.high.toFixed(2)}M</b></div>)}
        </div>
        <div className="pf-audit-note"><ShieldCheck size={14} /><span>Authoritative run: 13 Jul audit. The six-method engine is shown only as a reproducibility cross-check; it does not replace the audited conclusion.</span></div>
      </>}
    </div>
  )
}

function SplitSignal({ label, items, total }: { label: string; items: { label: string; value: number; color: string }[]; total: number }) {
  return <div className="pf-signal-block"><span>{label}</span><div className="pf-split-bar">{items.map(item => <i key={item.label} title={item.label} style={{ width: `${Math.max(3, 100 * item.value / total)}%`, background: item.color }} />)}</div><div className="pf-split-labels">{items.slice(0, 3).map(item => <small key={item.label}>{item.label}</small>)}</div></div>
}

function PortfolioEmpty({ headline, body }: { headline: string; body: string }) {
  return <div className="pf-empty"><CheckCircle2 size={18} /><div><b>{headline}</b><span>{body}</span></div></div>
}
