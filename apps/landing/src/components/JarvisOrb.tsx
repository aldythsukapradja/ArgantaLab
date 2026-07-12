import { useEffect, useRef, useState } from 'react'
import { PIPELINE, OFFICES } from '../data/agents'
import { ensureGsap, gsap, EASE, prefersReduced } from '../lib/motion'

// ── JarvisOrb — the autonomous-company centerpiece, ported from the Circle HQ CEO
// cockpit's "lite" reactor (SVG + CSS, 60fps, no WebGL — so it animates anywhere,
// including the preview). A graduated tick-bezel + concentric rings + pulsing core,
// beside a live AGENT TICKER that streams the deterministic Sense→Compute→Match→
// Generate→Deliver pipeline the six offices actually run. Deterministic schedule
// (seeded by the clock) so it always looks alive without faking any data claim.

const VERBS: Record<string, string[]> = {
  sense: ['reads growth RPC', 'polls diamond ledger', 'scans retention cohort', 'checks circle activity'],
  compute: ['rolls up W2F', 'recomputes stickiness', 'diffs mint vs burn', 'scores activation'],
  match: ['flags a threshold', 'ranks the weakest lever', 'matches a benchmark', 'detects a mismatch'],
  generate: ['drafts the daily brief', 'writes a verdict', 'phrases an insight', 'composes a recap'],
  deliver: ['ships a card', 'files the verdict', 'posts the brief', 'updates the deck'],
}
const OFFICE_IDS = OFFICES.map(o => ({ id: o.id, label: o.label, accent: o.accent }))

// deterministic PRNG so the stream is stable per second, not random per render
function seeded(n: number) { let a = n | 0; return () => { a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }

function makeEvent(tick: number) {
  const r = seeded(tick * 2654435761)
  const stage = PIPELINE[Math.floor(r() * PIPELINE.length)]
  const office = OFFICE_IDS[Math.floor(r() * OFFICE_IDS.length)]
  const verb = VERBS[stage.key][Math.floor(r() * VERBS[stage.key].length)]
  return { id: tick, stage: stage.name, office: office.label, accent: office.accent, verb }
}

export function JarvisOrb({ big = false }: { big?: boolean }) {
  const [feed, setFeed] = useState(() => Array.from({ length: 5 }, (_, i) => makeEvent(1000 - i)))
  const [pulse, setPulse] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    let tick = 1001
    // battery: the ticker pauses with the tab
    let id: ReturnType<typeof setInterval> | null = null
    const play = () => { if (!id) id = setInterval(() => { setFeed(f => [makeEvent(tick++), ...f].slice(0, 5)); setPulse(p => p + 1) }, 2200) }
    const halt = () => { if (id) { clearInterval(id); id = null } }
    const onVis = () => (document.visibilityState === 'hidden' ? halt() : play())
    play(); document.addEventListener('visibilitychange', onVis)
    return () => { halt(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // boot sequence: the orb powers on — rings flicker in, core ignites, panels
  // cascade. Runs when the orb first becomes visible; opacity-only on the ring
  // groups (their spin lives in CSS transforms — never fight it).
  useEffect(() => {
    const root = rootRef.current
    if (!root || prefersReduced() || document.visibilityState === 'hidden') return
    ensureGsap()
    let done = false
    const io = new IntersectionObserver(es => {
      if (done || !es.some(e => e.isIntersecting)) return
      done = true; io.disconnect()
      const ctx = gsap.context(() => {
        const tl = gsap.timeline({ defaults: { ease: EASE.out } })
        tl.from(root.querySelector('.jarvis-orb'), { scale: 0.82, opacity: 0, duration: 0.9, ease: EASE.soft }, 0)
          .from(root.querySelectorAll('.jarvis-orb > g, .jarvis-orb > circle'), { opacity: 0, duration: 0.5, stagger: 0.07 }, 0.15)
          .from(root.querySelector('.jarvis-badge'), { y: -10, opacity: 0, duration: 0.5 }, 0.7)
          .from(root.querySelectorAll('.jarvis-tickhead, .jarvis-ev'), { x: 16, opacity: 0, duration: 0.45, stagger: 0.06 }, 0.55)
          .from(root.querySelectorAll('.jarvis-pipe-st'), { y: 8, opacity: 0, duration: 0.35, stagger: 0.05 }, 0.9)
      }, root)
      // one-shot: no revert needed — end state is the natural state
      void ctx
    })
    io.observe(root)
    return () => io.disconnect()
  }, [])

  return (
    <div className={`jarvis${big ? ' big' : ''}`} ref={rootRef}>
      <div className="jarvis-orbwrap" data-pulse={pulse % 2}>
        <svg viewBox="0 0 400 400" className="jarvis-orb" role="img" aria-label="Autonomous company core">
          <defs>
            <radialGradient id="jcore" cx="50%" cy="44%" r="56%"><stop offset="0%" stopColor="#fff" /><stop offset="48%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#6d28d9" /></radialGradient>
            <radialGradient id="jglow" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#8b5cf6" stopOpacity=".3" /><stop offset="100%" stopColor="#8b5cf6" stopOpacity="0" /></radialGradient>
          </defs>
          {/* graduated tick bezel */}
          <g className="j-rC" stroke="#8b5cf6" strokeWidth="1.4">
            {Array.from({ length: 72 }).map((_, i) => { const a = (i / 72) * Math.PI * 2, lg = i % 6 === 0, R0 = 191, R1 = lg ? 178 : 185
              return <line key={i} x1={(200 + Math.cos(a) * R0).toFixed(1)} y1={(200 + Math.sin(a) * R0).toFixed(1)} x2={(200 + Math.cos(a) * R1).toFixed(1)} y2={(200 + Math.sin(a) * R1).toFixed(1)} strokeOpacity={lg ? 0.6 : 0.28} /> })}
          </g>
          <g fill="none" strokeLinecap="round">
            <g className="j-rA" stroke="#8b5cf6"><circle cx="200" cy="200" r="168" strokeWidth="1.4" strokeOpacity=".5" strokeDasharray="200 860" /><circle cx="200" cy="200" r="168" strokeWidth="1.2" strokeOpacity=".14" /></g>
            <g className="j-rB" stroke="#8b5cf6"><circle cx="200" cy="200" r="138" strokeWidth="2" strokeOpacity=".6" /><path d="M200 56v12M200 332v12M56 200h12M332 200h12" strokeWidth="1.3" strokeOpacity=".5" /></g>
            <g className="j-rB2" stroke="#06b6d4"><circle cx="200" cy="200" r="120" strokeWidth="1.2" strokeOpacity=".5" strokeDasharray="1.5 7" /></g>
            <g className="j-rA" stroke="#06b6d4"><circle cx="200" cy="200" r="84" strokeWidth="1.4" strokeOpacity=".5" strokeDasharray="90 438" /></g>
            <g className="j-rC" stroke="#8b5cf6"><circle cx="200" cy="200" r="66" strokeWidth="1.2" strokeOpacity=".55" strokeDasharray="6 5" /></g>
          </g>
          <g className="j-sweep"><path d="M200 200 L200 62 A138 138 0 0 1 294 100 Z" fill="#8b5cf6" opacity=".08" /></g>
          <circle cx="200" cy="200" r="96" fill="url(#jglow)" />
          <circle cx="200" cy="200" r="40" fill="url(#jcore)" className="j-core" />
          <circle cx="200" cy="197" r="15" fill="#fff" opacity=".95" />
        </svg>
        <div className="jarvis-badge"><b>27</b><span>agents</span></div>
      </div>

      <div className="jarvis-side">
        <div className="jarvis-tickhead"><span className="j-live"><i />LIVE</span> Agent activity</div>
        <div className="jarvis-feed">
          {feed.map((e, i) => (
            <div key={e.id} className={`jarvis-ev${i === 0 ? ' new' : ''}`} style={{ ['--ac' as string]: e.accent }}>
              <span className="jarvis-ev-stage">{e.stage}</span>
              <span className="jarvis-ev-txt"><b>{e.office}</b> {e.verb}</span>
            </div>
          ))}
        </div>
        <div className="jarvis-pipe">{PIPELINE.map((p, i) => <span key={p.key} className="jarvis-pipe-st" style={{ ['--pi' as string]: i }}>{p.name}</span>)}</div>
      </div>
    </div>
  )
}
