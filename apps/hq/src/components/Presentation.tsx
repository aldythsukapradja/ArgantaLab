import { useEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { X, ArrowLeft, ArrowRight, Sun, Moon } from 'lucide-react'
import type { GrowthOverview, AcquisitionData, EconomyData } from '../data/types'
import { kindLabel, type HeroCard, type ScoreRow, type GrowthInsight } from '../data/growth'

interface Palette {
  bg: string; ink: string; dim: string; faint: string
  acc: string; acc2: string; mag: string; ok: string; warn: string
  panel: string; line: string; barInk: string
}
const DARK: Palette = {
  bg: 'radial-gradient(1200px 720px at 18% -5%, #20285a 0%, #0b1020 55%, #060912 100%)',
  ink: '#f8fafc', dim: '#94a3b8', faint: '#64748b', acc: '#818cf8', acc2: '#a5b4fc',
  mag: '#ff5c8a', ok: '#4ade80', warn: '#fbbf24', panel: 'rgba(255,255,255,0.055)', line: 'rgba(255,255,255,0.12)', barInk: '#0b1020',
}
const LIGHT: Palette = {
  bg: 'radial-gradient(1200px 720px at 18% -5%, #e8ecff 0%, #f7f8fc 55%, #eef1f8 100%)',
  ink: '#0f172a', dim: '#475569', faint: '#94a3b8', acc: '#5b5bf0', acc2: '#4338ca',
  mag: '#e11d6b', ok: '#16a34a', warn: '#d97706', panel: 'rgba(15,23,42,0.045)', line: 'rgba(15,23,42,0.10)', barInk: '#ffffff',
}

interface Props {
  overview: GrowthOverview
  acquisition: AcquisitionData | null
  economy: EconomyData | null
  heroes: HeroCard[]
  score: ScoreRow[]
  insight: GrowthInsight
  who: string
  onClose: () => void
}

export function Presentation({ overview: o, acquisition: a, economy: e, heroes, score, insight, who, onClose }: Props) {
  const [i, setI] = useState(0)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const dir = useRef(1)
  const tilt = useRef<HTMLDivElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const c = theme === 'dark' ? DARK : LIGHT

  const slides = [
    coverSlide, northStarSlide, numbersSlide, scorecardSlide,
    ...(a && a.funnel.length ? [funnelSlide] : []),
    ...(e ? [economySlide] : []),
    closingSlide,
  ]
  const total = slides.length
  const go = (d: number) => {
    const next = Math.min(total - 1, Math.max(0, i + d))
    if (next !== i) { dir.current = d; setI(next) }
  }

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'PageDown') go(1)
      else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') go(-1)
      else if (ev.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // 3D slide-enter timeline.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      tl.from(el, { rotationY: dir.current * 16, z: -280, opacity: 0, transformPerspective: 1100, transformOrigin: 'center center', duration: 0.7, ease: 'power3.out' }, 0)
      const path = el.querySelector('.pres-line') as SVGPathElement | null
      if (path) {
        const len = path.getTotalLength()
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
        tl.to(path, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.inOut' }, 0.35)
      }
      el.querySelectorAll<HTMLElement>('[data-count]').forEach(node => {
        const to = parseFloat(node.dataset.count || '0')
        const dec = parseInt(node.dataset.dec || '0', 10)
        const suffix = node.dataset.suffix || ''
        const obj = { v: 0 }
        tl.to(obj, { v: to, duration: 1.3, ease: 'power2.out', onUpdate: () => { node.textContent = obj.v.toFixed(dec) + suffix } }, 0.35)
      })
      tl.from('.pres-anim', { opacity: 0, y: 42, rotationX: -32, transformPerspective: 700, transformOrigin: 'top center', duration: 0.7, stagger: 0.07, ease: 'power3.out' }, 0.2)
        .from('.pres-pop', { opacity: 0, scale: 0.82, rotationY: dir.current * 38, transformPerspective: 700, duration: 0.6, stagger: 0.05, ease: 'back.out(1.5)' }, 0.28)
        .from('.pres-bar', { scaleX: 0, transformOrigin: 'left center', duration: 0.9, stagger: 0.07, ease: 'power3.out' }, 0.25)
    }, stage)
    return () => ctx.revert()
  }, [i])

  // Mouse-driven 3D parallax tilt of the whole scene.
  useEffect(() => {
    const el = tilt.current
    if (!el) return
    const onMove = (ev: MouseEvent) => {
      const x = ev.clientX / window.innerWidth - 0.5
      const y = ev.clientY / window.innerHeight - 0.5
      gsap.to(el, { rotationY: x * 6, rotationX: -y * 6, transformPerspective: 1400, transformOrigin: 'center center', duration: 0.7, ease: 'power2.out' })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: c.bg, color: c.ink, fontFamily: 'var(--font)', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: 22, left: 30, display: 'flex', alignItems: 'center', gap: 10, zIndex: 30 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#818cf8,#ff5c8a)' }} />
        <div style={{ fontSize: 13, letterSpacing: '.04em', color: c.dim }}>CIRCLE HQ · GROWTH REVIEW</div>
      </div>
      <div style={{ position: 'absolute', top: 20, right: 24, display: 'flex', gap: 10, zIndex: 30 }}>
        <button onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')} aria-label="Toggle theme"
          style={iconBtn(c)}>{theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}</button>
        <button onClick={onClose} aria-label="Exit presentation" style={iconBtn(c)}><X size={16} /></button>
      </div>

      <div ref={tilt} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', transformStyle: 'preserve-3d' }}>
        <div ref={stage} key={i} style={{ width: '100%', padding: '0 clamp(40px, 9vw, 160px)', transformStyle: 'preserve-3d' }}>
          {slides[i]({ o, a, e, heroes, score, insight, who, c })}
        </div>
      </div>

      <div style={{ position: 'absolute', top: 74, bottom: 86, left: 0, right: 0, display: 'flex', zIndex: 10 }}>
        <div onClick={() => go(-1)} style={{ flex: 1, cursor: i > 0 ? 'w-resize' : 'default' }} />
        <div onClick={() => go(1)} style={{ flex: 2, cursor: i < total - 1 ? 'e-resize' : 'default' }} />
      </div>

      <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 30 }}>
        <button onClick={() => go(-1)} disabled={i === 0} style={navBtn(c, i === 0)}><ArrowLeft size={15} /></button>
        <div style={{ display: 'flex', gap: 7 }}>
          {slides.map((_, k) => (
            <span key={k} onClick={() => { dir.current = k > i ? 1 : -1; setI(k) }} style={{
              width: k === i ? 22 : 7, height: 7, borderRadius: 99, cursor: 'pointer',
              background: k === i ? c.acc : c.faint, transition: 'all .3s',
            }} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={i === total - 1} style={navBtn(c, i === total - 1)}><ArrowRight size={15} /></button>
        <div style={{ position: 'absolute', right: 30, fontSize: 12, color: c.faint }}>{i + 1} / {total}</div>
      </div>
    </div>
  )
}

const iconBtn = (c: Palette): React.CSSProperties => ({
  width: 34, height: 34, borderRadius: 9, background: c.panel, border: `1px solid ${c.line}`, color: c.dim, display: 'grid', placeItems: 'center', cursor: 'pointer',
})
const navBtn = (c: Palette, disabled: boolean): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: 10, background: c.panel, border: `1px solid ${c.line}`,
  color: disabled ? c.faint : c.ink, display: 'grid', placeItems: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
})

interface SlideArgs {
  o: GrowthOverview; a: AcquisitionData | null; e: EconomyData | null
  heroes: HeroCard[]; score: ScoreRow[]; insight: GrowthInsight; who: string; c: Palette
}

const kicker = (text: string, c: Palette): ReactNode => (
  <div className="pres-anim" style={{ fontSize: 13, letterSpacing: '.14em', color: c.acc2, marginBottom: 18 }}>{text.toUpperCase()}</div>
)

function coverSlide({ who, c }: SlideArgs) {
  return (
    <div>
      {kicker('Quarterly growth review', c)}
      <h1 className="pres-anim" style={{ fontSize: 'clamp(40px, 7vw, 86px)', fontWeight: 700, lineHeight: 1.02, letterSpacing: '-.02em', margin: 0, color: c.ink }}>
        ArgantaLab is<br /><span style={{ color: c.acc }}>compounding.</span>
      </h1>
      <p className="pres-anim" style={{ fontSize: 'clamp(16px, 2vw, 22px)', color: c.dim, marginTop: 24, maxWidth: 620, lineHeight: 1.5 }}>
        An engagement-first read on the learning super-app — north-star, retention and the unicorn scorecard, every number live.
      </p>
      <div className="pres-anim" style={{ marginTop: 36, fontSize: 14, color: c.faint }}>Prepared by {who} · Circle HQ</div>
    </div>
  )
}

function northStarSlide({ o, c }: SlideArgs) {
  const pts = o.northStar
  const W = 900, H = 320, padT = 30, padB = 30
  const max = Math.max(1, ...pts.map(p => p.value))
  const x = (idx: number) => (idx * W) / Math.max(1, pts.length - 1)
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const line = pts.map((p, idx) => `${idx ? 'L' : 'M'}${x(idx).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  return (
    <div>
      {kicker('North-star metric', c)}
      <div className="pres-anim" style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'clamp(48px, 8vw, 96px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, color: c.ink }}>
          <span data-count={o.wau} data-dec="0">0</span>
        </div>
        <div style={{ fontSize: 20, color: c.dim }}>weekly active learners completing a mastery loop</div>
      </div>
      <div className="pres-anim" style={{ marginTop: 24 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: '46vh' }} preserveAspectRatio="xMidYMid meet">
          {[0.25, 0.5, 0.75].map(f => <line key={f} x1={0} x2={W} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke={c.line} />)}
          <path d={`${line} L${W},${H - padB} L0,${H - padB} Z`} fill={theme3dFill(c)} />
          <path className="pres-line" d={line} fill="none" stroke={c.acc} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, idx) => <circle key={idx} className="pres-pop" cx={x(idx)} cy={y(p.value)} r={5} fill={c.acc} />)}
          {pts.map((p, idx) => <text key={'l' + idx} x={x(idx)} y={H - 8} fontSize={13} fill={c.faint} textAnchor="middle">{p.week}</text>)}
        </svg>
      </div>
    </div>
  )
}
const theme3dFill = (c: Palette) => c.acc === DARK.acc ? 'rgba(129,140,248,0.16)' : 'rgba(91,91,240,0.12)'

function numbersSlide({ o, heroes, c }: SlideArgs) {
  const metrics = [
    { label: heroes[0].label, to: o.wau, dec: 0, suffix: '', verdict: heroes[0].sub },
    { label: 'Stickiness · DAU/MAU', to: o.stickiness ?? 0, dec: 1, suffix: '%', verdict: 'daily habit' },
    { label: 'New learners · 7d', to: o.newLearners7d, dec: 0, suffix: '', verdict: heroes[2].sub },
    { label: 'Accuracy · 30d', to: o.accuracyPct ?? 0, dec: 0, suffix: '%', verdict: 'mastery signal' },
  ]
  return (
    <div>
      {kicker('The engagement core', c)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'clamp(20px,3vw,44px)', maxWidth: 880 }}>
        {metrics.map(m => (
          <div key={m.label} className="pres-pop">
            <div style={{ fontSize: 'clamp(38px, 6vw, 66px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1, color: c.ink }}>
              <span data-count={m.to} data-dec={m.dec} data-suffix={m.suffix}>0</span>
            </div>
            <div style={{ fontSize: 17, color: c.ink, marginTop: 8 }}>{m.label}</div>
            <div style={{ fontSize: 13, color: c.acc2, marginTop: 2 }}>{m.verdict}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function scorecardSlide({ score, c }: SlideArgs) {
  return (
    <div>
      {kicker('Unicorn scorecard · benchmarked', c)}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
        {score.map(s => {
          const pending = s.tone === 'pending'
          const col = s.tone === 'success' ? c.ok : s.tone === 'warning' ? c.warn : s.tone === 'danger' ? c.mag : pending ? c.faint : c.acc2
          return (
            <div key={s.key} className="pres-pop" style={{ background: c.panel, border: `1px solid ${c.line}`, borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 12.5, color: c.dim, minHeight: 32 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: pending ? c.faint : c.ink, margin: '4px 0' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: col }}>{pending ? 'pending' : s.note.split('·')[0].trim()}</div>
            </div>
          )
        })}
      </div>
      <div className="pres-anim" style={{ marginTop: 22, fontSize: 14, color: c.faint }}>
        Live engagement metrics scored today · revenue ratios activate with monetization.
      </div>
    </div>
  )
}

function funnelSlide({ a, c }: SlideArgs) {
  if (!a) return null
  const top = a.funnel[0]?.count || 1
  return (
    <div>
      {kicker('Activation funnel', c)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 2.2vh, 22px)', maxWidth: 860 }}>
        {a.funnel.map((s, idx) => {
          const w = Math.max(9, Math.round((100 * s.count) / top))
          const prev = idx === 0 ? s.count : a.funnel[idx - 1].count
          const conv = idx === 0 ? 100 : prev > 0 ? Math.round((100 * s.count) / prev) : 0
          return (
            <div key={s.stage} className="pres-anim">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 16, color: c.dim }}>{s.stage}</span>
                <span style={{ fontSize: 14, color: c.acc2 }}>{idx === 0 ? 'top of funnel' : `${conv}% of previous`}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ flex: 1, height: 38, borderRadius: 11, background: c.panel, overflow: 'hidden' }}>
                  <div className="pres-bar" style={{ width: `${w}%`, height: '100%', borderRadius: 11, background: `linear-gradient(90deg, ${c.acc}, ${c.acc2})` }} />
                </div>
                <span style={{ width: 70, fontSize: 22, fontWeight: 700, color: c.ink }}><span data-count={s.count} data-dec="0">0</span></span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function economySlide({ e, c }: SlideArgs) {
  if (!e) return null
  // Recurring earn loop — the one-time starter grant is held aside so the deck
  // tells the honest economic story, not the 250k onboarding floor.
  const starter = e.starterGrant ?? (e.sources.find(s => s.kind === 'starter')?.amount ?? 0)
  const recurring = e.recurringMinted ?? Math.max(0, e.minted - starter)
  const loop = e.sources.filter(s => s.kind !== 'starter')
  const max = Math.max(1, ...loop.map(s => s.amount))
  const isSink = (k: string, flow?: string) => flow ? flow === 'sink' : ['spend', 'deduct'].includes(k)
  const big: [string, number][] = [['Float held', e.float], ['Recurring earn', recurring], ['Spent', e.spent]]
  return (
    <div>
      {kicker('Diamond economy · recurring loop', c)}
      <div style={{ display: 'flex', gap: 'clamp(24px, 5vw, 72px)', flexWrap: 'wrap', marginBottom: 28 }}>
        {big.map(([lab, val]) => (
          <div key={lab} className="pres-pop">
            <div style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 700, lineHeight: 1, color: c.ink }}><span data-count={val} data-dec="0">0</span></div>
            <div style={{ fontSize: 15, color: c.dim, marginTop: 6 }}>{lab}</div>
          </div>
        ))}
        <div className="pres-pop">
          <div style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 700, lineHeight: 1, color: e.coverage != null && e.coverage >= 50 ? c.ok : c.warn }}>
            <span data-count={e.coverage ?? 0} data-dec="0" data-suffix="%">0</span>
          </div>
          <div style={{ fontSize: 15, color: c.dim, marginTop: 6 }}>Sink coverage</div>
        </div>
      </div>
      <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {loop.map(s => (
          <div key={s.kind} className="pres-anim" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 140, fontSize: 14, color: c.dim }}>{kindLabel(s.kind)}</span>
            <div style={{ flex: 1, height: 18, borderRadius: 6, background: c.panel, overflow: 'hidden' }}>
              <div className="pres-bar" style={{ width: `${Math.max(4, Math.round((100 * s.amount) / max))}%`, height: '100%', borderRadius: 6, background: isSink(s.kind, s.flow) ? c.mag : c.acc }} />
            </div>
            <span style={{ width: 70, textAlign: 'right', fontSize: 14, color: c.ink }}>{s.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function closingSlide({ insight, c }: SlideArgs) {
  return (
    <div>
      {kicker('The story', c)}
      <h2 className="pres-anim" style={{ fontSize: 'clamp(30px, 5vw, 60px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.08, margin: 0, maxWidth: 900, color: c.ink }}>
        {insight.headline}.
      </h2>
      <p className="pres-anim" style={{ fontSize: 'clamp(16px, 2vw, 22px)', color: c.dim, marginTop: 22, maxWidth: 760, lineHeight: 1.55 }}>
        {insight.body}
      </p>
      <div className="pres-anim" style={{ marginTop: 34, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 999, background: c.panel, border: `1px solid ${c.line}`, fontSize: 15, color: c.acc2 }}>
        Engagement-stage today → revenue scorecard next
      </div>
    </div>
  )
}
