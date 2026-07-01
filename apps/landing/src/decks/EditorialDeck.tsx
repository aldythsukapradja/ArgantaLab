import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import Buddy from '../components/Buddy'
import Ring from '../components/Ring'
import KinSprite from '../components/KinSprite'
import AvatarSprite from '../components/AvatarSprite'
import { WORLDS, RING_LABELS } from '../data/worlds'
import { AGENTS, TIER_META, MODEL_META, type Tier } from '../data/agents'
import { ThemeToggle } from '../theme'

gsap.registerPlugin(ScrollTrigger)

const EN = { care: '#F2738C', mind: '#48A7EA', growth: '#27B79A', memory: '#8E7BEA', play: '#ECA13A', calm: '#7C89C4' }
const ORBIT_PCT: Record<string, number> = { NUM: 80, WRD: 55, WON: 100, LOG: 35, WLD: 70, LIF: 45 }
const TIER_ORDER: Tier[] = ['executive', 'argantalab', 'kinetik', 'growth', 'platform', 'brand']
const FLOW = [
  { tm: '3am', t: 'Ngaji', e: 'growth', done: true }, { tm: '9am', t: 'Math Miss Rani', e: 'growth', done: true, clash: true },
  { tm: '9am', t: 'ArgantaLAB', e: 'calm', done: true }, { tm: '2:30pm', t: 'Gitar', e: 'growth', done: true },
]

function Section({ id, className = '', children }: { id: string; className?: string; children: React.ReactNode }) {
  return <section id={id} className={`ed-section ${className}`}>{children}</section>
}
function Lines({ children }: { children: React.ReactNode[] }) {
  return <>{children.map((c, i) => <span key={i} className="ed-line"><span className="ed-line-in">{c}</span></span>)}</>
}

export default function EditorialDeck({ present = false, onExit }: { present?: boolean; onExit?: () => void }) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lenisRef = useRef<Lenis | null>(null)
  const [playing, setPlaying] = useState(present)

  // smooth scroll + scroll-triggered reveals
  useEffect(() => {
    document.documentElement.classList.add('page-scroll')
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1 })
    lenisRef.current = lenis
    lenis.on('scroll', ScrollTrigger.update)
    const tick = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.ed-line-in').forEach(el => {
        gsap.from(el, { yPercent: 118, duration: 1, ease: 'power4.out',
          scrollTrigger: { trigger: el, start: 'top 88%' } })
      })
      gsap.utils.toArray<HTMLElement>('.ed-in').forEach(el => {
        gsap.from(el, { y: 46, opacity: 0, duration: 1, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 86%' } })
      })
      gsap.utils.toArray<HTMLElement>('.ed-device').forEach(el => {
        gsap.fromTo(el, { y: 80, rotateX: 8, opacity: 0 }, { y: 0, rotateX: 0, opacity: 1, duration: 1.2, ease: 'power3.out',
          scrollTrigger: { trigger: el, start: 'top 82%' } })
        gsap.to(el, { yPercent: -8, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'bottom top', scrub: true } })
      })
    }, rootRef)

    return () => { ctx.revert(); gsap.ticker.remove(tick); lenis.destroy(); lenisRef.current = null }
  }, [])

  // present: auto-scroll section to section with dwell; any wheel hands back control
  useEffect(() => {
    if (!playing) return
    const secs = Array.from(rootRef.current?.querySelectorAll('.ed-section') ?? [])
    let i = 0, timer: number
    const advance = () => {
      const lenis = lenisRef.current
      if (!lenis) return
      lenis.scrollTo(secs[i] as HTMLElement, { duration: 1.7 })
      i = (i + 1) % secs.length
      timer = window.setTimeout(advance, 3600)
    }
    timer = window.setTimeout(advance, 400)
    const stop = () => setPlaying(false)
    window.addEventListener('wheel', stop, { passive: true, once: true })
    window.addEventListener('touchstart', stop, { passive: true, once: true })
    return () => { clearTimeout(timer); window.removeEventListener('wheel', stop); window.removeEventListener('touchstart', stop) }
  }, [playing])

  return (
    <div className="ed" ref={rootRef}>
      <header className="ed-nav">
        <button className="ed-back" onClick={onExit} data-cursor="back">← Decks</button>
        <span className="ed-brand">Arganta</span>
        <div className="ed-nav-r">
          <button className="ed-present" onClick={() => setPlaying(p => !p)} data-cursor={playing ? 'pause' : 'play'}>{playing ? 'Pause' : 'Present'}</button>
          <ThemeToggle className="ed-theme" />
        </div>
      </header>

      {/* 00 hero */}
      <Section id="ed-hero" className="ed-center ed-hero">
        <div className="ed-core" aria-hidden><span /></div>
        <h1 className="ed-display xl"><Lines>{['Screen time,', <em key="e">rewritten.</em>]}</Lines></h1>
        <span className="ed-scrollcue ed-in">scroll ↓</span>
      </Section>

      {/* 01 thesis */}
      <Section id="ed-thesis" className="ed-center">
        <h2 className="ed-display"><Lines>{['Kids see play.', <em key="e">Parents see growth.</em>]}</Lines></h2>
        <p className="ed-sub ed-in">The same hour on a screen, pointed at something that lasts.</p>
      </Section>

      {/* 02 problem */}
      <Section id="ed-problem" className="ed-center">
        <span className="ed-kick ed-in">The problem</span>
        <div className="ed-bignum ed-in">2.5<span>hrs / day</span></div>
        <h2 className="ed-display sm"><Lines>{['A childhood of screens,', <em key="e">building nothing.</em>]}</Lines></h2>
      </Section>

      {/* 03 product */}
      <Section id="ed-product" className="ed-split">
        <div className="ed-copy">
          <span className="ed-kick ed-in">The product · ArgantaLab</span>
          <h2 className="ed-display sm ed-in">One playful world.<br />Six kinds of intelligence.</h2>
          <p className="ed-body ed-in">A companion to grow, six worlds to master, a daily ring to close. Everything a kid loves about a game, aimed at everything a parent wants them to become.</p>
        </div>
        <div className="ed-device orbit-device">
          <div className="orbit">
            <svg className="orbit-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
              {WORLDS.map((w, i) => { const a = (-90 + i * 60) * Math.PI / 180; return <line key={w.key} x1="50" y1="50" x2={50 + 38 * Math.cos(a)} y2={50 + 38 * Math.sin(a)} stroke={w.color} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.4" /> })}
            </svg>
            <div className="orbit-buddy"><Buddy mood="happy" size={110} /></div>
            {WORLDS.map((w, i) => { const a = (-90 + i * 60) * Math.PI / 180; const x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a)
              return <div key={w.key} className="orbit-node" style={{ left: `${x}%`, top: `${y}%` }}>
                <span className="orbit-ring"><Ring pct={ORBIT_PCT[w.key]} color={w.color} size={62} /><span className="orbit-glyph" style={{ color: w.color }}>{w.icon}</span></span>
                <span className="orbit-label">{RING_LABELS[w.key]}</span>
              </div> })}
          </div>
        </div>
      </Section>

      {/* 04 make & ship */}
      <Section id="ed-make" className="ed-center">
        <span className="ed-kick ed-in">Create</span>
        <h2 className="ed-display sm ed-in">They don't just play games.<br /><em>They build, pitch, and ship them.</em></h2>
        <div className="ed-steps ed-in">
          {['Build a game', 'Learn to code', 'Prompt an AI', 'Pitch it', 'Ship it'].map(s => <span key={s} className="ed-step">{s}</span>)}
        </div>
        <div className="ed-kinrow ed-in">
          {[['countfox', '#f59e0b'], ['letterowl', '#3b82f6'], ['datadragon', '#8b5cf6'], ['mapturtle', '#ef4444'], ['galaxyfawn', '#10b981']].map(([r, c]) => (
            <KinSprite key={r} render={r} color={c} size={64} bob />
          ))}
        </div>
      </Section>

      {/* 05 family — KinetikCircle */}
      <Section id="ed-family" className="ed-split reverse">
        <div className="ed-copy">
          <span className="ed-kick ed-in">The family layer · KinetikCircle</span>
          <h2 className="ed-display sm ed-in">Learning lives inside<br />real family life.</h2>
          <p className="ed-body ed-in">One calm view of the whole circle's day — routines, plans and energy, colour-coded by what kind of time it is. Learning sits in the rhythm, not beside it.</p>
        </div>
        <div className="ed-device">
          <div className="kt-screen">
            <div className="kt-hero">
              <div className="kt-hero-txt"><span className="kt-eyebrow">TUESDAY, JUNE 30</span><b className="kt-greet">Good evening, Aldyth</b><span className="kt-sub">All 7 done — beautiful work.</span></div>
              <div className="kt-ring"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" className="kt-ring-t" /><circle cx="40" cy="40" r="34" className="kt-ring-b" transform="rotate(-90 40 40)" /></svg><span className="kt-ring-c"><b>7</b><i>of 7</i></span></div>
            </div>
            <div className="kt-flowlbl">TODAY'S FLOW</div>
            <div className="kt-flow">
              {FLOW.map((a, i) => <div key={i} className="kt-ev"><span className="kt-t">{a.tm}</span><span className="kt-node" style={{ background: EN[a.e as keyof typeof EN] }}>{a.done && '✓'}</span><span className="kt-ev-b"><b>{a.t}</b></span>{a.clash && <span className="kt-clash">CLASH</span>}</div>)}
            </div>
          </div>
        </div>
      </Section>

      {/* 06 proof */}
      <Section id="ed-proof" className="ed-split">
        <div className="ed-copy">
          <span className="ed-kick ed-in">Parent view</span>
          <h2 className="ed-display sm ed-in">They see play.<br /><em>You see progress.</em></h2>
          <p className="ed-body ed-in">Behind the fun: skills mastered, depth of thinking, gaps to close. The one screen that tells you your child is actually growing.</p>
        </div>
        <div className="ed-device">
          <div className="dash">
            <div className="dash-kpis">{[['7', 'day streak'], ['41m', 'today'], ['6/6', 'rings']].map(([v, l]) => <div key={l} className="dash-kpi"><b>{v}</b><span>{l}</span></div>)}</div>
            {[['Number sense', 82, '#f59e0b'], ['Reading', 64, '#3b82f6'], ['Science', 91, '#10b981'], ['Logic & code', 47, '#8b5cf6']].map(([l, p, c]) => (
              <div key={l as string} className="dash-row"><div className="dash-row-top"><span>{l}</span><b style={{ color: c as string }}>{p}%</b></div><div className="lbar"><i style={{ width: `${p}%`, background: c as string }} /></div></div>
            ))}
          </div>
        </div>
      </Section>

      {/* 07 agents */}
      <Section id="ed-agents" className="ed-center">
        <span className="ed-kick ed-in">The company</span>
        <h2 className="ed-display sm ed-in">A company run by <em>agents.</em></h2>
        <p className="ed-sub ed-in">One human founder. A workforce of 25 specialist AI agents — lean by default, scaling without headcount.</p>
        <div className="roster ed-in">
          {TIER_ORDER.map(t => (
            <div key={t} className="roster-tier">
              <span className="roster-label" style={{ color: TIER_META[t].accent }}>{TIER_META[t].label}</span>
              <div className="roster-row">{AGENTS.filter(a => a.tier === t).map(a => (
                <span key={a.id} className={`agent-pill${a.orchestrator ? ' boss' : ''}`} style={{ ['--tc' as string]: TIER_META[t].accent }} title={a.mission}><b>{a.name}</b><i className="model-dot" style={{ background: MODEL_META[a.model].fg }} /></span>
              ))}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* 08 founder */}
      <Section id="ed-founder" className="ed-center">
        <div className="ed-founder ed-in">
          <span className="ed-face"><AvatarSprite size={92} mood="happy" /></span>
          <div>
            <span className="ed-kick">The founder</span>
            <h2 className="ed-display xs">Built by a parent, for parents.</h2>
            <p className="ed-body">Aldyth Sukapradja — building the calm, ambitious version of childhood screen time I want for my own family. <span className="ed-note">(add your photo + story here)</span></p>
          </div>
        </div>
      </Section>

      {/* 09 cta */}
      <Section id="ed-cta" className="ed-center ed-cta">
        <h2 className="ed-display"><Lines>{['Make screen time', <em key="e">count.</em>]}</Lines></h2>
        <div className="ed-cta-actions ed-in">
          <a className="ed-btn primary" href="https://lab.arganta.app" target="_blank" rel="noopener noreferrer" data-cursor="open">Explore ArgantaLab →</a>
          <a className="ed-btn" href="mailto:hello@arganta.app" data-cursor="write">Join the waitlist</a>
        </div>
        <p className="ed-foot ed-in">Arganta — one trusted OS for the modern family.</p>
      </Section>
    </div>
  )
}
