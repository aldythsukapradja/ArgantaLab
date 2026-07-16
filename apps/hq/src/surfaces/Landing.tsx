import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  Activity, Boxes, Building2, ChevronRight, Clapperboard, Clock3, Coins, Gauge,
  Hammer, Hand, HelpCircle, LayoutGrid, LineChart, MapPin, Mic, MessageCircle, Moon, Power,
  RefreshCw, Repeat2, Sparkles, Sun, TrendingUp, Users, X,
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
import { useCopilotStore } from '../copilot/store'

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
const CinemaNodes = lazy(() => import('../cinema/CinemaNodes').then(module => ({ default: module.CinemaNodes })))

const INSPECTOR_VIEWS: InspectorView[] = ['overview', 'desktop', 'mobile']
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
  const { go, openPalette, closePalette, paletteOpen, agentOpen, closeAgent, theme, toggleTheme } = useHQ()
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

  const [productView, setProductView] = useState<InspectorView>('overview')
  const openProduct = useCallback((id: ProductId) => { setSelected(id); setProductView('overview') }, [])

  // "activate" opens the cinematic — same action as the topbar clapperboard.
  const playCinema = useCallback(() => setCinemaOn(true), [])

  // "close" / pinch closes whatever's actually open here, in priority order:
  // cinema, then the product popup, then the agent panel, then the command
  // palette. A no-op if nothing is open.
  const closeWhatIsOpen = useCallback(() => {
    if (cinemaOn) { setCinemaOn(false); return }
    if (selected) { setSelected(null); return }
    if (agentOpen) { closeAgent(); return }
    if (paletteOpen) { closePalette(); return }
  }, [cinemaOn, selected, agentOpen, closeAgent, paletteOpen, closePalette])

  // Gesture swipe: cycle the 5 product cards, or the Overview→Desktop→Mobile
  // inspector view when a popup is open.
  const cycleProduct = useCallback((dir: 'left' | 'right') => {
    setSelected(current => {
      const ids = products.map(p => p.id)
      if (!ids.length) return current
      const idx = current ? ids.indexOf(current) : -1
      const next = idx === -1
        ? (dir === 'right' ? 0 : ids.length - 1)
        : (idx + (dir === 'right' ? 1 : -1) + ids.length) % ids.length
      return ids[next]
    })
  }, [products])
  const cycleProductView = useCallback((dir: 'left' | 'right') => {
    setProductView(current => {
      const idx = INSPECTOR_VIEWS.indexOf(current)
      const next = (idx + (dir === 'right' ? 1 : -1) + INSPECTOR_VIEWS.length) % INSPECTOR_VIEWS.length
      return INSPECTOR_VIEWS[next]
    })
  }, [])
  const handleGestureSwipe = useCallback((dir: 'left' | 'right') => {
    if (selected) cycleProductView(dir)
    else cycleProduct(dir)
  }, [selected, cycleProductView, cycleProduct])

  // The copilot lives globally (GlobalCopilot in Shell) so it survives
  // navigation. While the orb is on screen, Landing injects its surface-local
  // actions + swipe behaviour so "open lashira" / "activate" / swipe act
  // directly here instead of routing through the navigate-home bridge. Landing
  // reads armed/amplitude from the store to keep the orb pulsing to the voice.
  const setContext = useCopilotStore(s => s.setContext)
  const clearContext = useCopilotStore(s => s.clearContext)
  const consumePending = useCopilotStore(s => s.consumePending)
  const setSuppressed = useCopilotStore(s => s.setSuppressed)
  const toggleVoice = useCopilotStore(s => s.toggleVoice)
  const toggleGesture = useCopilotStore(s => s.toggleGesture)
  const openHelp = useCopilotStore(s => s.openHelp)
  const voiceArmed = useCopilotStore(s => s.armed)
  const voiceAmplitude = useCopilotStore(s => s.amplitude)
  const gestureActive = useCopilotStore(s => s.gestureActive)
  const gestureLoading = useCopilotStore(s => s.gestureLoading)

  // Mic fan (desktop + mobile): a tap fans out Voice / Chat petals; long-press
  // (500ms) is instant voice for the power path. If voice is already armed, a
  // tap always stops it — the fan never appears mid-listen.
  const [fanOpen, setFanOpen] = useState(false)
  const micHold = useRef<{ t: number; fired: boolean }>({ t: 0, fired: false })
  const micPressStart = useCallback(() => {
    micHold.current.fired = false
    micHold.current.t = window.setTimeout(() => { micHold.current.fired = true; setFanOpen(false); toggleVoice() }, 500)
  }, [toggleVoice])
  const micPressEnd = useCallback(() => { window.clearTimeout(micHold.current.t) }, [])
  const handleMicTap = useCallback(() => {
    if (micHold.current.fired) { micHold.current.fired = false; return } // long-press already toggled voice
    if (voiceArmed) { toggleVoice(); return }
    setFanOpen(open => !open)
  }, [voiceArmed, toggleVoice])
  useEffect(() => {
    if (!fanOpen) return
    const t = window.setTimeout(() => setFanOpen(false), 5000) // idle auto-dismiss
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setFanOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => { window.clearTimeout(t); window.removeEventListener('keydown', onKey) }
  }, [fanOpen])
  useEffect(() => { if (cinemaOn) setFanOpen(false) }, [cinemaOn])

  // "show desktop/mobile/overview" only means something while a popup is open.
  const setProductViewCtx = useCallback((view: InspectorView) => {
    if (selected) setProductView(view)
  }, [selected])

  useEffect(() => {
    setContext({
      actions: { openProduct, playCinema, close: closeWhatIsOpen, refresh: () => void refresh(), setProductView: setProductViewCtx },
      onSwipe: handleGestureSwipe,
    })
    return () => clearContext()
  }, [setContext, clearContext, openProduct, playCinema, closeWhatIsOpen, handleGestureSwipe, refresh, setProductViewCtx])

  // Apply a product/cinema requested from another surface (navigate-home bridge).
  useEffect(() => {
    const { product, cinema: wantCinema } = consumePending()
    if (product) openProduct(product)
    if (wantCinema) setCinemaOn(true)
  }, [consumePending, openProduct])

  // Hide the global bottom-left dock during the cinema/boot takeover.
  useEffect(() => { setSuppressed(cinemaOn); return () => setSuppressed(false) }, [cinemaOn, setSuppressed])
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
    if (cinemaOn && !prevCinema.current) {
      cinema.startAuto()
      void import('../cinema/CinemaNodes') // warm the heavy cortex chunk before Act V
    } else if (!cinemaOn && prevCinema.current) cinema.pause()
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
    : voiceArmed
      // The orb only *animates* to the voice (a breathing pulse on live mic
      // amplitude) — it never restructures or explodes while listening.
      ? { ...IDLE_SCENE, state: 'listening', intensity: 0.3 + voiceAmplitude * 0.7, signal: signalState, reducedMotion }
      : sceneFromLegacyProps({ dark: theme === 'dark', selectedProduct: selected, signalState, skipBoot, reducedMotion })

  // Act III auto-demo: the product popup opens on the scene's product and cycles
  // Overview → Desktop → Mobile with the narration beats, matching the recorded story.
  const cinemaBeat = cinemaOn && cinema.scene.act === 3 ? cinema.scene.beat : null
  const cinemaPopupOpen = cinemaBeat === 'overview' || cinemaBeat === 'demo' || cinemaBeat === 'summary'
  const cinemaView: InspectorView = cinemaBeat === 'demo' ? (cinema.progress < 0.5 ? 'desktop' : 'mobile') : 'overview'
  const cinemaPopupModel = cinemaPopupOpen ? products.find(p => p.id === cinema.scene.product) ?? null : null

  // Deep-dive: Acts IV–VI dissolve the reactor into the real 3D cortex.
  // Mount the cortex EARLY (from Act III) so its heavy build (model + tissue +
  // R3F/shader warmup) happens behind the reactor while a product clip plays —
  // otherwise the whole init hits the main thread at 4.1→4.2 and the transition
  // hangs. It stays mounted-but-hidden until `nodesRevealed`, then fades in.
  const nodesRevealed = cinemaOn && cinema.state.nodes.visible
  const mountNodes = cinemaOn && cinema.scene.act >= 3 && cinema.scene.act <= 6

  return (
    <main className="ld" data-theme={theme} data-cinema={cinemaOn ? 'on' : 'off'} data-dive={nodesRevealed ? 'on' : 'off'} data-mobile-charts={chartsOpen ? 'open' : 'closed'}
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
          <button onClick={toggleGesture} className={gestureActive ? 'ld-gesture-on' : ''}
            aria-label={gestureActive ? 'Turn off hand gesture (camera)' : 'Turn on hand gesture (camera)'}
            aria-pressed={gestureActive}
            title={gestureActive ? 'Hand gesture on — swipe to cycle products/views, pinch to close' : gestureLoading ? 'Loading hand model…' : 'Turn on hand gesture (uses camera)'}>
            <Hand size={15} className={gestureLoading ? 'spin' : ''} />
          </button>
          <button onClick={openHelp} aria-label="Voice & gesture commands" title="Voice & gesture commands"><HelpCircle size={15} /></button>
        </div>
      </header>

      <div className="ld-layout">
        {!isMobile && <LeftInstruments pulse={pulse} booted={booted} stageMap={stageMap} />}

        <section className="ld-stage" aria-label="Arganta architecture and knowledge reactor">
          <div className="ld-stage-aura" aria-hidden="true" />
          <div className="ld-reactor-shell">
            <div className="ld-orb">
              <ReactorCore key={bootKey} renderer="r3f" state={reactorScene} interactive={!cinemaOn} centered={!cinemaOn}
                manualExplosion={cinemaOn && cinema.scene.id === '4.1' ? cinema.progress : null}
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

      {/* Dock mirrors the mobile 4-tab taxonomy (Company / Insights / Studio /
          Forge — see shell/MobileNav.tsx MGROUPS); each button lands on that
          tab's default surface. On mobile the mic fans out into Voice / Chat
          (chat = Arganta Core full-screen); if already listening, a tap stops
          immediately — never fan mid-conversation. Long-press = instant voice. */}
      <nav className="ld-dock" aria-label="HQ sections">
        <button onClick={() => go('portfolio')}><Building2 size={18} /><span>Company</span></button>
        <button onClick={() => go('growth')}><LineChart size={18} /><span>Insights</span></button>
        <button className={`ld-mic ${voiceArmed ? 'is-listening' : ''}`}
          onClick={handleMicTap}
          onPointerDown={micPressStart}
          onPointerUp={micPressEnd}
          onPointerLeave={micPressEnd}
          aria-pressed={voiceArmed}
          aria-expanded={fanOpen}
          aria-label={voiceArmed ? 'Stop voice commands' : 'Open voice or chat'}>
          <span /><Mic size={22} />
        </button>
        <button onClick={() => go('broadcast')}><Clapperboard size={18} /><span>Studio</span></button>
        <button onClick={() => go('game')}><Hammer size={18} /><span>Forge</span></button>
      </nav>

      {fanOpen && (
        <div className="ld-fan-wrap" role="menu" aria-label="Voice or chat">
          <div className="ld-fan-backdrop" onClick={() => setFanOpen(false)} />
          <button className="ld-fan-petal ld-fan-voice" role="menuitem"
            onClick={() => { setFanOpen(false); toggleVoice() }}>
            <Mic size={18} /><span>Voice</span>
          </button>
          <button className="ld-fan-petal ld-fan-chat" role="menuitem"
            onClick={() => { setFanOpen(false); go('core') }}>
            <MessageCircle size={18} /><span>Chat</span>
          </button>
        </div>
      )}

      {!hasLiveSignal && <div className="ld-provenance"><Sparkles size={12} /> No demo values · connect and sign in to populate the live instruments</div>}
      {isMobile && <MobileInstruments open={chartsOpen} onClose={() => setChartsOpen(false)} {...instrumentProps} />}
      {cinemaPopupModel
        ? <ProductDetail product={cinemaPopupModel} pulse={pulse} days={30} view={cinemaView} onClose={() => { /* Director-controlled during the cinematic */ }} />
        : selected && <ProductDetail product={products.find(product => product.id === selected)!} pulse={pulse} days={30}
            view={productView} onViewChange={setProductView} onClose={() => setSelected(null)} />}
      {mountNodes && <Suspense fallback={null}><CinemaNodes scene={cinema.state} revealed={nodesRevealed} /></Suspense>}
      {cinemaOn && <Suspense fallback={null}><CinemaStage cinema={cinema} onExit={() => setCinemaOn(false)} /></Suspense>}
      {/* Copilot HUD / flash / cheat-sheet now live globally in <GlobalCopilot> (Shell). */}
    </main>
  )
}
