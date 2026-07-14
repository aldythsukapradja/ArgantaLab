import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity, Boxes, ChevronRight, Clapperboard, Clock3, Command, Coins, Gauge,
  LayoutGrid, MapPin, Mic, Moon, Power, RefreshCw, Repeat2, Sparkles,
  Sun, TrendingUp, Users, X,
} from 'lucide-react'
import { useHQ } from '../shell/store'
import { cloudEnabled, live } from '../data/live'
import { AreaTrend } from '../components/d3/AreaTrend'
import { DonutD3 } from '../components/d3/DonutD3'
import { HBars } from '../components/d3/HBars'
import { PunchCard } from '../components/d3/PunchCard'
import { PortfolioWorldMap } from '../components/d3/PortfolioWorldMap'
import { appColor, appLabel, fmtDur } from '../components/d3/chartkit'
import { compact, pct } from '../lib/format'
import {
  AppLogo, buildProducts, ProductDetail, ValuationAuditPanel,
  type ProductCardModel, type ProductId, type Pulse, type InspectorView,
} from './Portfolio'
import type { ReactorSignalState } from './reactorModel'
import './landing.css'

// The old ReactorOrb is retired from the CEO Orb — the real WS2 reactor now
// renders the centre (hidden here for now; ReactorOrb.tsx removed entirely later).
import { CoreSlot as ReactorCore } from '../reactor/CoreSlot'
import { sceneFromLegacyProps, IDLE_SCENE, DEFAULT_CHOREOGRAPHY, type SceneState as ReactorScene } from '../reactor/contract'
import { useCinema } from '../cinema/director'
import { useCinemaStore } from '../cinema/store'
import { INSTRUMENTS, type InstrumentId, type StageEffect, type StageDirection } from '../cinema/contract'
import { ACTS } from '../cinema/scenario'

type StageMap = Partial<Record<InstrumentId, StageEffect>> | null

// Expand a scene's stage directions into a per-instrument effect map. Any
// instrument not named recedes while the film plays.
function buildStageMap(stage: StageDirection[]): Partial<Record<InstrumentId, StageEffect>> {
  const m: Partial<Record<InstrumentId, StageEffect>> = {}
  for (const d of stage) {
    if (d.target === 'all') INSTRUMENTS.forEach(id => { m[id] = d.effect })
    else if (d.target !== 'none') m[d.target] = d.effect
  }
  return m
}
function fxOf(id: InstrumentId, stageMap: StageMap): string | undefined {
  if (!stageMap) return undefined       // not in the cinematic → no override
  return stageMap[id] ?? 'recede'       // named effect, else recede
}
const CinemaStage = lazy(() => import('../cinema/CinemaStage').then(module => ({ default: module.CinemaStage })))

const REFRESH_MS = 45_000
const emptyPulse: Pulse = {
  i: null, k: null, o: null, e: null, v: null, r: null,
  eng: null, pw: null, au: null, geo: null,
}

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches)

  useEffect(() => {
    const media = window.matchMedia(query)
    const sync = () => setMatches(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [query])

  return matches
}

function useLandingPulse() {
  const [pulse, setPulse] = useState<Pulse | undefined>()
  const [refreshing, setRefreshing] = useState(false)
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    setRefreshing(true)
    const [i, k, o, e, v, r, eng, pw, au, geo] = await Promise.all([
      live.schemaInsights(), live.kinetikStats(), live.growthOverview(), live.economy(),
      live.portfolioVc(), live.retention(), live.engagement(30), live.powerCurve(30),
      live.audience(), live.geo(30),
    ])
    if (!alive.current) return
    setPulse({ i, k, o, e, v, r, eng, pw, au, geo })
    setUpdatedAt(Date.now())
    setRefreshing(false)
  }, [])

  useEffect(() => {
    alive.current = true
    void refresh()
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, REFRESH_MS)
    return () => { alive.current = false; window.clearInterval(timer) }
  }, [refresh])

  return { pulse, refresh, refreshing, updatedAt }
}

function SignalFrame({ eyebrow, title, meta, className = '', instrument, fx, children }: {
  eyebrow: string; title: string; meta: string; className?: string
  instrument?: InstrumentId; fx?: string; children: React.ReactNode
}) {
  return (
    <section className={`ld-panel ${className}`} data-instrument={instrument} data-fx={fx}>
      <div className="ld-panel-head">
        <div><span>{eyebrow}</span><h2>{title}</h2><p>{meta}</p></div>
        <i aria-hidden="true" />
      </div>
      <div className="ld-panel-body">{children}</div>
    </section>
  )
}

function NoSignal({ children }: { children: React.ReactNode }) {
  return <div className="ld-empty"><span /><p>{children}</p></div>
}

function MetricStrip({ items, columns = 3 }: {
  items: { label: string; value: string; Icon: LucideIcon; tone?: string }[]
  columns?: number
}) {
  return (
    <div className="ld-metrics" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
      {items.map(({ label, value, Icon, tone }) => (
        <div key={label} style={tone ? { '--metric-tone': tone } as React.CSSProperties : undefined}>
          <span className="ld-metric-icon"><Icon size={13} /></span>
          <span className="ld-metric-copy"><b>{value}</b><small>{label}</small></span>
        </div>
      ))}
    </div>
  )
}

interface InstrumentProps {
  pulse: Pulse
  products: ProductCardModel[]
  selected: ProductId | null
  hovered: ProductId | null
  onSelect: (id: ProductId) => void
  onHover: (id: ProductId | null) => void
}

function LeftInstruments({ pulse, booted, stageMap }: Pick<InstrumentProps, 'pulse'> & { booted: boolean; stageMap: StageMap }) {
  const { o: growth, geo } = pulse
  const trend = growth?.northStar ?? []
  const regionUsers = geo?.regions.reduce((sum, region) => sum + region.users, 0) ?? 0
  const regionSeconds = geo?.regions.reduce((sum, region) => sum + region.seconds, 0) ?? 0

  return (
    <aside className={`ld-rail ld-rail-left ${booted ? 'is-booted' : ''}`} aria-label="Reach, trajectory, and valuation">
      <SignalFrame instrument="reach" fx={fxOf('reach', stageMap)} eyebrow="EXTERNAL FIELD OF VIEW" title="World Reach" meta="Live timezone regions · no GPS or IP" className="ld-map-panel ld-entrance-reach">
        <div className="ld-map">
          {geo?.regions.length ? <PortfolioWorldMap geo={geo} height={246} /> : <NoSignal>No live timezone activity has reached hq_geo.</NoSignal>}
        </div>
        <MetricStrip items={[
          { label: 'Regions', value: geo ? compact(geo.regions.length) : '—', Icon: MapPin, tone: 'var(--ld-cyan)' },
          { label: 'People', value: geo ? compact(regionUsers) : '—', Icon: Users, tone: 'var(--ld-violet)' },
          { label: 'Attention', value: geo ? fmtDur(regionSeconds) : '—', Icon: Clock3, tone: 'var(--ld-green)' },
        ]} />
      </SignalFrame>

      <SignalFrame instrument="engaged" fx={fxOf('engaged', stageMap)} eyebrow="PORTFOLIO TRAJECTORY" title="Weekly Engaged" meta="North-star series from hq_growth_overview" className="ld-trend-panel ld-entrance-engaged">
        <div className="ld-chart-fill">
          {trend.length >= 2
            ? <AreaTrend labels={trend.map(point => point.week)} series={[{ key: 'value', label: 'Weekly engaged', color: 'var(--ld-cyan)', area: true }]} data={trend.map(point => ({ value: point.value }))} height={118} />
            : <NoSignal>A comparable live weekly series has not formed yet.</NoSignal>}
        </div>
        <MetricStrip items={[
          { label: 'WAU', value: growth ? compact(growth.wau) : '—', Icon: Activity, tone: 'var(--ld-cyan)' },
          { label: 'Stickiness', value: growth?.stickiness == null ? '—' : pct(growth.stickiness), Icon: Gauge, tone: 'var(--ld-green)' },
          { label: 'WoW', value: growth?.wowPct == null ? '—' : `${growth.wowPct > 0 ? '+' : ''}${growth.wowPct}%`, Icon: TrendingUp, tone: 'var(--ld-violet)' },
        ]} />
      </SignalFrame>

      <section className="ld-panel ld-valuation-panel ld-entrance-valuation" aria-label="Arganta valuation audit"
        data-instrument="valuation" data-fx={fxOf('valuation', stageMap)}>
        <ValuationAuditPanel />
      </section>
    </aside>
  )
}

function RightInstruments({ pulse, products, selected, hovered, onSelect, onHover, booted, stageMap }: InstrumentProps & { booted: boolean; stageMap: StageMap }) {
  const { v: portfolio, eng: engagement, r: retention, e: economy } = pulse
  const external = (engagement?.apps ?? []).filter(app => app.app !== 'hq' && app.seconds > 0)
  const externalTotal = external.reduce((sum, app) => sum + app.seconds, 0)
  const appBars = (engagement?.apps ?? [])
    .filter(app => app.seconds > 0)
    .map(app => ({ label: appLabel(app.app), value: app.seconds, color: appColor(app.app) }))
  const rhythm = engagement?.punch.filter(point => point.seconds > 0) ?? []
  const latestCohort = retention?.cohorts.find(cohort => cohort.ret.some(value => value != null))

  return (
    <aside className={`ld-rail ld-rail-right ${booted ? 'is-booted' : ''}`} aria-label="Products, attention, and rhythm">
      <SignalFrame instrument="products" fx={fxOf('products', stageMap)} eyebrow="LIVE PRODUCT FLEET" title="Five Products" meta="Select a product here or from its matching orbit" className="ld-products-panel ld-entrance-products">
        <div className="ld-products">
          {products.map((product, index) => {
            const active = product.id === selected || product.id === hovered
            return (
              <button key={product.id} className={active ? 'active' : ''} onClick={() => onSelect(product.id)}
                onPointerEnter={() => onHover(product.id)} onPointerLeave={() => onHover(null)} aria-haspopup="dialog"
                title={`${product.name} · ${product.primaryValue ?? product.primary} ${product.primaryUnit}`}
                style={{ '--product-tone': appColor(product.id), '--pod-index': index } as React.CSSProperties}>
                <AppLogo app={product.id} size={28} />
                <span><b>{product.name}</b><small>{product.role}</small></span>
                <strong>{product.primaryValue != null ? compact(product.primaryValue) : product.primary} <i>{product.primaryUnit}</i></strong>
                <ChevronRight size={14} className="ld-chevron" />
              </button>
            )
          })}
        </div>
      </SignalFrame>

      <SignalFrame instrument="access" fx={fxOf('access', stageMap)} eyebrow="BEHAVIORAL SENSOR" title="Access & Attention" meta="Measured people and time · trailing 30 days" className="ld-access-panel ld-entrance-access">
        <div className="ld-access-visuals">
          <div className="ld-access-donut">
            {external.length
              ? <DonutD3 size={126} centerValue={fmtDur(externalTotal)} centerLabel="external time" valueFmt={fmtDur}
                  legend={false} ringWidth={13}
                  slices={external.map(app => ({ label: appLabel(app.app), value: app.seconds, color: appColor(app.app) }))} />
              : <NoSignal>No external usage yet.</NoSignal>}
          </div>
          <div className="ld-access-bars">
            {appBars.length
              ? <HBars bars={appBars} valueFmt={fmtDur} labelWidth={82} barH={10} />
              : <NoSignal>No live app-usage beats are available.</NoSignal>}
          </div>
        </div>
        <MetricStrip items={[
          { label: 'People', value: engagement ? compact(engagement.totalUsers) : '—', Icon: Users, tone: 'var(--ld-violet)' },
          { label: 'Time', value: engagement ? fmtDur(engagement.totalSeconds) : '—', Icon: Clock3, tone: 'var(--ld-cyan)' },
          { label: 'Apps', value: engagement ? compact(engagement.apps.length) : '—', Icon: Boxes, tone: 'var(--ld-green)' },
        ]} />
      </SignalFrame>

      <SignalFrame instrument="rhythm" fx={fxOf('rhythm', stageMap)} eyebrow="VISIT RHYTHM" title="When Arganta Is Alive" meta="Live day × hour engagement" className="ld-rhythm-panel ld-entrance-rhythm">
        <div className="ld-rhythm-chart">{rhythm.length >= 6 ? <PunchCard punch={engagement!.punch} /> : <NoSignal>The live hourly rhythm needs more usage beats.</NoSignal>}</div>
        <MetricStrip columns={4} items={[
          { label: 'Activation', value: portfolio?.activationRate == null ? '—' : pct(portfolio.activationRate), Icon: Activity, tone: 'var(--ld-cyan)' },
          { label: 'D1 return', value: portfolio?.d1Retention == null ? '—' : pct(portfolio.d1Retention), Icon: Repeat2, tone: 'var(--ld-green)' },
          { label: 'Latest cohort', value: latestCohort ? compact(latestCohort.size) : '—', Icon: Users, tone: 'var(--ld-violet)' },
          { label: 'Coverage', value: economy?.coverage == null ? '—' : pct(economy.coverage), Icon: Coins, tone: '#f5b54f' },
        ]} />
      </SignalFrame>
    </aside>
  )
}

function MobileInstruments({ open, onClose, ...props }: InstrumentProps & { open: boolean; onClose: () => void }) {
  if (!open) return null
  return (
    <section className="ld-mobile-instruments" aria-label="Six live Arganta instruments" aria-modal="true" role="dialog">
      <header className="ld-mobile-instruments-head">
        <div><span>JARVIS LIVE FIELD</span><b>Six operating instruments</b></div>
        <button onClick={onClose} aria-label="Close live instruments"><X size={18} /></button>
      </header>
      <div className="ld-mobile-instruments-flow">
        <LeftInstruments pulse={props.pulse} booted stageMap={null} />
        <RightInstruments {...props} booted stageMap={null} />
      </div>
    </section>
  )
}

export function Landing({ who: _who = 'Operator' }: { who?: string }) {
  const { go, openPalette, toggleAgent, theme, toggleTheme } = useHQ()
  const { pulse = emptyPulse, refresh, refreshing, updatedAt } = useLandingPulse()
  const [selected, setSelected] = useState<ProductId | null>(null)
  const [hoveredProduct, setHoveredProduct] = useState<ProductId | null>(null)
  const [chartsOpen, setChartsOpen] = useState(false)
  const [bootKey, setBootKey] = useState(0)
  const [booted, setBooted] = useState(false)
  const [skipBoot, setSkipBoot] = useState(false)
  const [cinemaOn, setCinemaOn] = useState(false)
  const isMobile = useMediaQuery('(max-width: 680px)')
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const cinema = useCinema() // the Director — drives the reactor + instruments during the cinematic
  const cinemaOverrides = useCinemaStore(s => s.overrides)
  const prevCinema = useRef(false)

  const { o: growth, v: portfolio, eng: engagement, geo, e: economy, i: schema, k: kinetik } = pulse
  const products = useMemo(() => buildProducts(pulse, 30), [pulse])
  const signalCount = [schema, growth, portfolio, engagement, geo, economy, kinetik].filter(Boolean).length
  const hasLiveSignal = signalCount > 0
  const signalState: ReactorSignalState = signalCount >= 5 ? 'live' : signalCount > 0 ? 'partial' : 'offline'
  const liveLabel = !cloudEnabled ? 'CONNECTION REQUIRED' : hasLiveSignal ? 'LIVE SIGNAL' : 'AWAITING SIGNAL'
  const updatedLabel = updatedAt ? new Date(updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'

  const openProduct = useCallback((id: ProductId) => setSelected(id), [])
  const finishBoot = useCallback(() => {
    setBooted(true)
    window.sessionStorage.setItem('ld-reactor-booted', '1')
  }, [])
  const replayBoot = useCallback(() => {
    setBooted(false)
    setSkipBoot(false)
    setBootKey(key => key + 1)
  }, [])
  const skipIgnition = useCallback(() => {
    setSkipBoot(true)
    finishBoot()
  }, [finishBoot])

  // The WS2 reactor doesn't emit onBootComplete, so drive the ignition dismissal
  // here: hold the overlay briefly, then boot the cockpit (instruments animate in).
  useEffect(() => {
    if (booted) return
    const t = window.setTimeout(finishBoot, 1500)
    return () => window.clearTimeout(t)
  }, [booted, bootKey, finishBoot])

  // Enter/exit the cinematic: start the film on open, pause on close.
  useEffect(() => {
    if (cinemaOn && !prevCinema.current) cinema.startAuto()
    else if (!cinemaOn && prevCinema.current) cinema.pause()
    prevCinema.current = cinemaOn
  }, [cinemaOn, cinema])

  useEffect(() => {
    if (!isMobile) setChartsOpen(false)
  }, [isMobile])

  useEffect(() => {
    if (!chartsOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setChartsOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [chartsOpen])

  const instrumentProps: InstrumentProps = {
    pulse, products, selected, hovered: hoveredProduct,
    onSelect: openProduct, onHover: setHoveredProduct,
  }

  // The one reactor scene — Director-driven while the cinematic plays, else the
  // live cockpit's legacy state. One mounted reactor, no remount on toggle.
  const stageMap: StageMap = cinemaOn
    ? buildStageMap(cinemaOverrides[cinema.scene.id]?.stage ?? cinema.state.stage)
    : null
  const reactorScene: ReactorScene = cinemaOn
    ? {
        ...IDLE_SCENE, state: cinema.state.core, focusProduct: cinema.state.product ?? null, intensity: 0.72,
        speaker: cinema.scene.voice === 'KF' ? 'specialist' : 'jarvis',
        choreography: DEFAULT_CHOREOGRAPHY[cinema.state.core], signal: signalState, reducedMotion,
        sceneTime: cinema.progress, sceneDuration: 1, sceneId: cinema.scene.id,
      }
    : sceneFromLegacyProps({ dark: theme === 'dark', selectedProduct: selected, signalState, skipBoot, reducedMotion })

  // Act III auto-demo: the product popup opens on the scene's product and cycles
  // Overview → Desktop → Mobile with the narration beats, matching the recorded story.
  const cinemaBeat = cinemaOn && cinema.scene.act === 3 ? cinema.scene.beat : null
  const cinemaPopupOpen = cinemaBeat === 'overview' || cinemaBeat === 'demo' || cinemaBeat === 'summary'
  const cinemaView: InspectorView = cinemaBeat === 'demo' ? (cinema.progress < 0.5 ? 'desktop' : 'mobile') : 'overview'
  const cinemaPopupModel = cinemaPopupOpen ? products.find(p => p.id === cinema.scene.product) ?? null : null

  return (
    <main className="ld" data-theme={theme} data-cinema={cinemaOn ? 'on' : 'off'} data-mobile-charts={chartsOpen ? 'open' : 'closed'}
      style={cinemaOn ? ({ ['--act-accent']: ACTS[cinema.scene.act].accent } as React.CSSProperties) : undefined}>
      <div className="ld-grid-field" aria-hidden="true" />
      <header className="ld-topbar">
        <button className="ld-brand" onClick={() => go('home')} aria-label="Jarvis Digital Twin home">
          <span className="ld-brand-mark">A</span>
          <span><b>ARGANTA</b><small>JARVIS DIGITAL TWIN</small></span>
        </button>
        <div className={`ld-live ${hasLiveSignal ? 'on' : ''}`}><i />{liveLabel}<span>· {updatedLabel}</span></div>
        <div className="ld-actions">
          <button onClick={() => setCinemaOn(true)} aria-label="Play cinematic" title="Play cinematic"><Clapperboard size={15} /></button>
          <button onClick={replayBoot} aria-label="Replay reactor ignition" title="Replay reactor ignition"><Power size={15} /></button>
          <button onClick={() => void refresh()} aria-label="Refresh live signals" title="Refresh live signals"><RefreshCw size={15} className={refreshing ? 'spin' : ''} /></button>
          <button onClick={openPalette} aria-label="Open HQ menu" title="Open HQ menu"><LayoutGrid size={15} /></button>
          <button onClick={toggleTheme} aria-label="Switch color theme" title="Switch color theme">{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}</button>
        </div>
      </header>

      <div className="ld-layout">
        {!isMobile && <LeftInstruments pulse={pulse} booted={booted} stageMap={stageMap} />}

        <section className="ld-stage" aria-label="Arganta architecture and knowledge reactor">
          <div className="ld-stage-aura" aria-hidden="true" />
          <div className="ld-reactor-shell">
            <div className="ld-orb">
              <ReactorCore key={bootKey} renderer="r3f" state={reactorScene}
                onSelectProduct={cinemaOn ? undefined : openProduct}
                onHoverProduct={cinemaOn ? undefined : setHoveredProduct} />
            </div>

            <button className="ld-core-open" onClick={() => setChartsOpen(true)}
              aria-label="Open six live instruments" title="Open six live instruments" />

            {!booted && (
              <div className={`ld-ignition ${skipBoot ? 'complete' : ''}`} role="status" aria-live="polite">
                <span>ARGANTA SYSTEMS</span>
                <strong>Architecture ignition</strong>
                <button onClick={skipIgnition}>Skip sequence</button>
              </div>
            )}
          </div>
        </section>

        {!isMobile && <RightInstruments {...instrumentProps} booted={booted} stageMap={stageMap} />}
      </div>

      <nav className="ld-dock" aria-label="HQ sections">
        <button onClick={() => go('portfolio')}><LayoutGrid size={18} /><span>Portfolio</span></button>
        <button onClick={() => go('growth')}><TrendingUp size={18} /><span>Analytics</span></button>
        <button className="ld-mic" onClick={() => toggleAgent()} aria-label="Talk to Jarvis"><span /><Mic size={22} /></button>
        <button onClick={() => go('command')}><Command size={18} /><span>Command</span></button>
        <button onClick={() => go('game')}><Boxes size={18} /><span>Build</span></button>
      </nav>

      {!hasLiveSignal && <div className="ld-provenance"><Sparkles size={12} /> No demo values · connect and sign in to populate the live instruments</div>}
      {isMobile && <MobileInstruments open={chartsOpen} onClose={() => setChartsOpen(false)} {...instrumentProps} />}
      {cinemaPopupModel
        ? <ProductDetail product={cinemaPopupModel} pulse={pulse} days={30} view={cinemaView} onClose={() => { /* Director-controlled during the cinematic */ }} />
        : selected && <ProductDetail product={products.find(product => product.id === selected)!} pulse={pulse} days={30} onClose={() => setSelected(null)} />}
      {cinemaOn && <Suspense fallback={null}><CinemaStage cinema={cinema} onExit={() => setCinemaOn(false)} /></Suspense>}
    </main>
  )
}
