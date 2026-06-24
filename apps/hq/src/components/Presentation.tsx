import { useEffect, useRef, useState, type ReactNode } from 'react'
import gsap from 'gsap'
import { X, ArrowLeft, ArrowRight } from 'lucide-react'
import type { GrowthOverview, AcquisitionData, EconomyData } from '../data/types'
import type { HeroCard, ScoreRow, GrowthInsight } from '../data/growth'

const KIND_LABEL: Record<string, string> = {
  starter: 'Starter grant', reward: 'Lesson rewards', earn: 'Earned in play', gift: 'Family gifts', spend: 'Spent in shop',
}

// Always-dark boardroom palette (independent of app theme).
const C = {
  ink: '#f8fafc', dim: '#94a3b8', faint: '#64748b',
  acc: '#818cf8', acc2: '#a5b4fc', mag: '#ff5c8a', ok: '#4ade80', warn: '#fbbf24',
  panel: 'rgba(255,255,255,0.05)', line: 'rgba(255,255,255,0.10)',
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
  const stage = useRef<HTMLDivElement>(null)
  const slides = [
    coverSlide, northStarSlide, numbersSlide, scorecardSlide,
    ...(a && a.funnel.length ? [funnelSlide] : []),
    ...(e ? [economySlide] : []),
    closingSlide,
  ]
  const total = slides.length

  const go = (d: number) => setI(v => Math.min(total - 1, Math.max(0, v + d)))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') go(1)
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(-1)
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Animate each slide on enter.
  useEffect(() => {
    const el = stage.current
    if (!el) return
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      const path = el.querySelector('.pres-line') as SVGPathElement | null
      if (path) {
        const len = path.getTotalLength()
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
        tl.to(path, { strokeDashoffset: 0, duration: 1.5, ease: 'power2.inOut' }, 0.15)
      }
      el.querySelectorAll<HTMLElement>('[data-count]').forEach(node => {
        const to = parseFloat(node.dataset.count || '0')
        const dec = parseInt(node.dataset.dec || '0', 10)
        const suffix = node.dataset.suffix || ''
        const obj = { v: 0 }
        tl.to(obj, {
          v: to, duration: 1.3, ease: 'power2.out',
          onUpdate: () => { node.textContent = obj.v.toFixed(dec) + suffix },
        }, 0.2)
      })
      tl.from('.pres-anim', { opacity: 0, y: 26, duration: 0.7, stagger: 0.07, ease: 'power3.out' }, 0)
        .from('.pres-pop', { opacity: 0, scale: 0.92, duration: 0.5, stagger: 0.05, ease: 'back.out(1.6)' }, 0.25)
        .from('.pres-bar', { scaleX: 0, transformOrigin: 'left center', duration: 0.9, stagger: 0.07, ease: 'power3.out' }, 0.2)
    }, stage)
    return () => ctx.revert()
  }, [i])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'radial-gradient(1200px 700px at 20% 0%, #1a2148 0%, #0b1020 55%, #070a16 100%)',
      color: C.ink, fontFamily: 'var(--font)', overflow: 'hidden',
    }}>
      <div style={{ position: 'absolute', top: 22, left: 30, display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 26, height: 26, borderRadius: 8, background: 'linear-gradient(135deg,#818cf8,#ff5c8a)' }} />
        <div style={{ fontSize: 13, letterSpacing: '.04em', color: C.dim }}>CIRCLE HQ · GROWTH REVIEW</div>
      </div>
      <button onClick={onClose} aria-label="Exit presentation" style={{
        position: 'absolute', top: 20, right: 24, width: 34, height: 34, borderRadius: 9,
        background: C.panel, border: `1px solid ${C.line}`, color: C.dim, display: 'grid', placeItems: 'center', cursor: 'pointer',
      }}><X size={16} /></button>

      <div ref={stage} key={i} style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '0 clamp(40px, 9vw, 160px)',
      }}>
        {slides[i]({ o, a, e, heroes, score, insight, who })}
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, display: 'flex', pointerEvents: 'none' }}>
        <div onClick={() => go(-1)} style={{ flex: 1, pointerEvents: 'auto', cursor: i > 0 ? 'w-resize' : 'default' }} />
        <div onClick={() => go(1)} style={{ flex: 2, pointerEvents: 'auto', cursor: i < total - 1 ? 'e-resize' : 'default' }} />
      </div>

      <div style={{ position: 'absolute', bottom: 24, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <button onClick={() => go(-1)} disabled={i === 0} style={navBtn(i === 0)}><ArrowLeft size={15} /></button>
        <div style={{ display: 'flex', gap: 7 }}>
          {slides.map((_, k) => (
            <span key={k} onClick={() => setI(k)} style={{
              width: k === i ? 22 : 7, height: 7, borderRadius: 99, cursor: 'pointer',
              background: k === i ? C.acc : C.faint, transition: 'all .3s',
            }} />
          ))}
        </div>
        <button onClick={() => go(1)} disabled={i === total - 1} style={navBtn(i === total - 1)}><ArrowRight size={15} /></button>
        <div style={{ position: 'absolute', right: 30, fontSize: 12, color: C.faint }}>{i + 1} / {total}</div>
      </div>
    </div>
  )
}

const navBtn = (disabled: boolean): React.CSSProperties => ({
  width: 36, height: 36, borderRadius: 10, background: C.panel, border: `1px solid ${C.line}`,
  color: disabled ? C.faint : C.ink, display: 'grid', placeItems: 'center', cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.4 : 1,
})

interface SlideArgs {
  o: GrowthOverview; a: AcquisitionData | null; e: EconomyData | null
  heroes: HeroCard[]; score: ScoreRow[]; insight: GrowthInsight; who: string
}

const kicker = (text: string): ReactNode => (
  <div className="pres-anim" style={{ fontSize: 13, letterSpacing: '.14em', color: C.acc2, marginBottom: 18 }}>{text.toUpperCase()}</div>
)

function coverSlide({ who }: SlideArgs) {
  return (
    <div>
      {kicker('Quarterly growth review')}
      <h1 className="pres-anim" style={{ fontSize: 'clamp(40px, 7vw, 86px)', fontWeight: 700, lineHeight: 1.02, letterSpacing: '-.02em', margin: 0 }}>
        ArgantaLab is<br /><span style={{ color: C.acc }}>compounding.</span>
      </h1>
      <p className="pres-anim" style={{ fontSize: 'clamp(16px, 2vw, 22px)', color: C.dim, marginTop: 24, maxWidth: 620, lineHeight: 1.5 }}>
        An engagement-first read on the learning super-app — north-star, retention and the unicorn scorecard, every number live.
      </p>
      <div className="pres-anim" style={{ marginTop: 36, fontSize: 14, color: C.faint }}>Prepared by {who} · Circle HQ</div>
    </div>
  )
}

function northStarSlide({ o }: SlideArgs) {
  const pts = o.northStar
  const W = 900, H = 320, padT = 30, padB = 30
  const max = Math.max(1, ...pts.map(p => p.value))
  const x = (idx: number) => (idx * W) / Math.max(1, pts.length - 1)
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB)
  const line = pts.map((p, idx) => `${idx ? 'L' : 'M'}${x(idx).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  return (
    <div>
      {kicker('North-star metric')}
      <div className="pres-anim" style={{ display: 'flex', alignItems: 'baseline', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 'clamp(48px, 8vw, 96px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}>
          <span data-count={o.wau} data-dec="0">0</span>
        </div>
        <div style={{ fontSize: 20, color: C.dim }}>weekly active learners completing a mastery loop</div>
      </div>
      <div className="pres-anim" style={{ marginTop: 24 }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: '46vh' }} preserveAspectRatio="xMidYMid meet">
          {[0.25, 0.5, 0.75].map(f => <line key={f} x1={0} x2={W} y1={padT + f * (H - padT - padB)} y2={padT + f * (H - padT - padB)} stroke={C.line} />)}
          <path d={`${line} L${W},${H - padB} L0,${H - padB} Z`} fill="rgba(129,140,248,0.14)" />
          <path className="pres-line" d={line} fill="none" stroke={C.acc} strokeWidth={3.5} strokeLinejoin="round" strokeLinecap="round" />
          {pts.map((p, idx) => <circle key={idx} className="pres-pop" cx={x(idx)} cy={y(p.value)} r={5} fill={C.acc} />)}
          {pts.map((p, idx) => <text key={'l' + idx} x={x(idx)} y={H - 8} fontSize={13} fill={C.faint} textAnchor="middle">{p.week}</text>)}
        </svg>
      </div>
    </div>
  )
}

function numbersSlide({ o, heroes }: SlideArgs) {
  const metrics = [
    { label: heroes[0].label, to: o.wau, dec: 0, suffix: '', verdict: heroes[0].sub },
    { label: 'Stickiness · DAU/MAU', to: o.stickiness ?? 0, dec: 1, suffix: '%', verdict: 'daily habit' },
    { label: 'New learners · 7d', to: o.newLearners7d, dec: 0, suffix: '', verdict: heroes[2].sub },
    { label: 'Accuracy · 30d', to: o.accuracyPct ?? 0, dec: 0, suffix: '%', verdict: 'mastery signal' },
  ]
  return (
    <div>
      {kicker('The engagement core')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: 'clamp(20px,3vw,44px)', maxWidth: 880 }}>
        {metrics.map(m => (
          <div key={m.label} className="pres-pop">
            <div style={{ fontSize: 'clamp(38px, 6vw, 66px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1 }}>
              <span data-count={m.to} data-dec={m.dec} data-suffix={m.suffix}>0</span>
            </div>
            <div style={{ fontSize: 17, color: C.ink, marginTop: 8 }}>{m.label}</div>
            <div style={{ fontSize: 13, color: C.acc2, marginTop: 2 }}>{m.verdict}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function scorecardSlide({ score }: SlideArgs) {
  return (
    <div>
      {kicker('Unicorn scorecard · benchmarked')}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
        {score.map(s => {
          const pending = s.tone === 'pending'
          const col = s.tone === 'success' ? C.ok : s.tone === 'warning' ? C.warn : s.tone === 'danger' ? C.mag : pending ? C.faint : C.acc2
          return (
            <div key={s.key} className="pres-pop" style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 12, padding: '14px 14px' }}>
              <div style={{ fontSize: 12.5, color: C.dim, minHeight: 32 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: pending ? C.faint : C.ink, margin: '4px 0' }}>{s.value}</div>
              <div style={{ fontSize: 11, color: col }}>{pending ? 'pending' : s.note.split('·')[0].trim()}</div>
            </div>
          )
        })}
      </div>
      <div className="pres-anim" style={{ marginTop: 22, fontSize: 14, color: C.faint }}>
        Live engagement metrics scored today · revenue ratios activate with monetization.
      </div>
    </div>
  )
}

function funnelSlide({ a }: SlideArgs) {
  if (!a) return null
  const top = a.funnel[0]?.count || 1
  return (
    <div>
      {kicker('Activation funnel')}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'clamp(12px, 2.2vh, 22px)', maxWidth: 840 }}>
        {a.funnel.map((s, idx) => {
          const w = Math.max(9, Math.round((100 * s.count) / top))
          const prev = idx === 0 ? s.count : a.funnel[idx - 1].count
          const conv = idx === 0 ? 100 : prev > 0 ? Math.round((100 * s.count) / prev) : 0
          return (
            <div key={s.stage} className="pres-anim">
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontSize: 16, color: C.dim }}>{s.stage}</span>
                <span style={{ fontSize: 14, color: C.acc2 }}>{idx === 0 ? 'top of funnel' : `${conv}% of previous`}</span>
              </div>
              <div style={{ height: 40, borderRadius: 11, background: C.panel, overflow: 'hidden' }}>
                <div className="pres-bar" style={{ width: `${w}%`, height: '100%', borderRadius: 11, background: 'linear-gradient(90deg,#818cf8,#a5b4fc)', display: 'flex', alignItems: 'center', paddingLeft: 16 }}>
                  <span style={{ fontSize: 18, fontWeight: 700, color: '#0b1020' }}><span data-count={s.count} data-dec="0">0</span></span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function economySlide({ e }: SlideArgs) {
  if (!e) return null
  const max = Math.max(1, ...e.sources.map(s => s.amount))
  const big: [string, number, string][] = [
    ['Float held', e.float, ''], ['Minted', e.minted, ''], ['Spent', e.spent, ''],
  ]
  return (
    <div>
      {kicker('Diamond economy')}
      <div style={{ display: 'flex', gap: 'clamp(24px, 5vw, 72px)', flexWrap: 'wrap', marginBottom: 28 }}>
        {big.map(([lab, val]) => (
          <div key={lab} className="pres-pop">
            <div style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 700, lineHeight: 1 }}><span data-count={val} data-dec="0">0</span></div>
            <div style={{ fontSize: 15, color: C.dim, marginTop: 6 }}>{lab}</div>
          </div>
        ))}
        <div className="pres-pop">
          <div style={{ fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 700, lineHeight: 1, color: e.coverage != null && e.coverage >= 50 ? C.ok : C.warn }}>
            <span data-count={e.coverage ?? 0} data-dec="0" data-suffix="%">0</span>
          </div>
          <div style={{ fontSize: 15, color: C.dim, marginTop: 6 }}>Sink coverage</div>
        </div>
      </div>
      <div style={{ maxWidth: 760, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {e.sources.map(s => (
          <div key={s.kind} className="pres-anim" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ width: 140, fontSize: 14, color: C.dim }}>{KIND_LABEL[s.kind] ?? s.kind}</span>
            <div style={{ flex: 1, height: 18, borderRadius: 6, background: C.panel, overflow: 'hidden' }}>
              <div className="pres-bar" style={{ width: `${Math.max(4, Math.round((100 * s.amount) / max))}%`, height: '100%', borderRadius: 6, background: s.kind === 'spend' ? C.mag : C.acc }} />
            </div>
            <span style={{ width: 70, textAlign: 'right', fontSize: 14, color: C.ink }}>{s.amount.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function closingSlide({ insight }: SlideArgs) {
  return (
    <div>
      {kicker('The story')}
      <h2 className="pres-anim" style={{ fontSize: 'clamp(30px, 5vw, 60px)', fontWeight: 700, letterSpacing: '-.02em', lineHeight: 1.08, margin: 0, maxWidth: 900 }}>
        {insight.headline}.
      </h2>
      <p className="pres-anim" style={{ fontSize: 'clamp(16px, 2vw, 22px)', color: C.dim, marginTop: 22, maxWidth: 760, lineHeight: 1.55 }}>
        {insight.body}
      </p>
      <div className="pres-anim" style={{ marginTop: 34, display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 18px', borderRadius: 999, background: C.panel, border: `1px solid ${C.line}`, fontSize: 15, color: C.acc2 }}>
        Engagement-stage today → revenue scorecard next
      </div>
    </div>
  )
}
