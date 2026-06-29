import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import Buddy from '@components/avatar/Buddy'
import KinSprite from '@components/openworld/KinSprite'
import { KIN } from '@/data/openworld'
import { WORLDS } from '@/data/learn'
import { Ring as KinetikRing, CountUp } from '../../kinetik/src/apps/ui'
import { CircleEmblem } from '../../kinetik/src/components/CircleEmblem'
import '../../kinetik/src/styles/apps.css'
import { ArgantaBoxScene } from './ArgantaBoxScene'
import { ArgantaLandCapture, OrbitCapture, QACapture, WorldMapCapture } from './ProductCaptures'

const CONTACT_EMAIL = 'hello@arganta.app'

type SlideId =
  | 'promise'
  | 'problem'
  | 'answer'
  | 'worlds'
  | 'companions'
  | 'rings'
  | 'argons'
  | 'nexus'
  | 'circle'
  | 'parents'
  | 'create'
  | 'safety'
  | 'cta'

interface Slide {
  id: SlideId
  kicker: string
  title: ReactNode
  body?: ReactNode
  visual: ReactNode
  mode?: 'center' | 'split' | 'final'
}

const worlds = WORLDS.slice(0, 6)

const ringData = [
  ['Number', 82, worlds[0].color],
  ['Word', 64, worlds[1].color],
  ['Wonder', 48, worlds[2].color],
  ['Logic', 76, worlds[3].color],
  ['World', 57, worlds[4].color],
  ['Life', 91, worlds[5].color],
] as const

const ledgerRows = [
  ['+120', 'solved fraction boss', 'learning'],
  ['+80', 'read aloud streak', 'habit'],
  ['-30', 'missed agreed routine', 'consequence'],
  ['+150', 'presented Wonder project', 'creation'],
] as const

const parentSignals = [
  ['Skill mastery', 78],
  ['Learning gaps', 42],
  ['Daily rhythm', 86],
  ['Bloom depth', 63],
  ['Argons economy', 91],
] as const

const trust = [
  'Private circles by default',
  'Parent-aware sharing',
  'Learning-gated rewards',
  'Server-controlled Argons ledger',
  'Moderated publishing',
  'Human judgment with agentic support',
]

function ArgantaMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="16" cy="8" r="2.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

function IconArrow({ dir = 'right' }: { dir?: 'left' | 'right' }) {
  return (
    <svg className={dir === 'left' ? 'flip' : ''} width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function IconSun() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  )
}

function IconMoon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function PromiseVisual() {
  return <OrbitCapture />
}

function ProblemVisual() {
  const items = [
    ['Hours vanish', 'attention without evidence', 74],
    ['Rewards are random', 'coins without meaning', 58],
    ['Parents see summaries', 'activity without proof', 44],
    ['Learning is separate', 'school outside play', 68],
    ['Progress is hard to prove', 'growth without a ledger', 36],
  ] as const
  return (
    <div className="problem-visual pres-pop">
      <div className="problem-scan" aria-hidden />
      <div className="problem-core">
        <small>black box</small>
        <b>Games already have the time.</b>
        <span>Most of it is not connected to measurable growth.</span>
      </div>
      <div className="problem-stack">
        {items.map(([item, note, value], i) => (
          <div key={item} className={`problem-card p${i + 1}`}>
            <small>{String(i + 1).padStart(2, '0')}</small>
            <span>{item}</span>
            <b>{note}</b>
            <i><em style={{ width: `${value}%` }} /></i>
          </div>
        ))}
      </div>
      <div className="problem-signal">
        <span>screen time</span>
        <i />
        <span>growth signal</span>
      </div>
    </div>
  )
}

function AnswerVisual() {
  return <QACapture />
}

function WorldsVisual() {
  return <WorldMapCapture />
}

function CompanionsVisual() {
  return (
    <div className="companions-visual pres-pop">
      <div className="buddy-card">
        <Buddy mood="wave" size={190} color="#8b5cf6" />
        <b>Buddy</b>
        <span>The child's progress companion.</span>
      </div>
      <div className="kin-card-grid">
        {KIN.slice(0, 8).map(k => (
          <span key={k.id} style={{ '--kin': k.color } as CSSProperties}>
            <KinSprite kin={k.id} size={64} bob />
            <b>{k.name}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

function RingsVisual() {
  return (
    <div className="rings-visual pres-pop" style={{ '--c0': '#22d3ee', '--c1': '#8b5cf6' } as CSSProperties}>
      {ringData.map(([label, pct, color]) => (
        <div key={label} className="ring-card" style={{ '--c0': color, '--c1': '#8b5cf6' } as CSSProperties}>
          <KinetikRing pct={pct} size={88} value={<CountUp to={pct} fmt={n => `${Math.round(n)}%`} />} label={label} />
        </div>
      ))}
      <div className="today-nudge">
        <span>Today's nudge</span>
        <b>Play Wonder to fill the lowest ring.</b>
      </div>
    </div>
  )
}

function ArgonsVisual() {
  return (
    <div className="argons-visual pres-pop">
      <div className="wallet-card">
        <span>Knowledge currency</span>
        <b><CountUp to={4280} /> Argons</b>
        <small>Visible effort. Accountable economy.</small>
      </div>
      {ledgerRows.map(([amount, reason, kind]) => (
        <div key={`${amount}-${reason}`} className={`ledger-row ${kind}`}>
          <b>{amount}</b>
          <span>{reason}</span>
          <small>{kind}</small>
        </div>
      ))}
    </div>
  )
}

function NexusVisual() {
  return <ArgantaLandCapture />
}

function CircleVisual() {
  const circles = [
    ['Family', '#f43f5e', '#fb7185'],
    ['Class', '#22d3ee', '#6366f1'],
    ['Tutor', '#f59e0b', '#ec4899'],
  ] as const
  return (
    <div className="circle-visual pres-pop">
      {circles.map(([label, a, b], i) => (
        <div key={label} className="circle-card">
          <CircleEmblem accent={[a, b]} active={i === 0} size={58} />
          <b>{label} circle</b>
          <span>Trusted challenge space</span>
        </div>
      ))}
      <div className="challenge-board">
        {['Ring streak', 'Argons earned', 'Kin collected', 'World mastery'].map((item, i) => (
          <div key={item}><span>{i + 1}</span><b>{item}</b></div>
        ))}
      </div>
    </div>
  )
}

function ParentsVisual() {
  return (
    <div className="parents-visual pres-pop" style={{ '--c0': '#22d3ee', '--c1': '#8b5cf6' } as CSSProperties}>
      <div className="parent-top">
        <KinetikRing pct={78} size={112} value={<CountUp to={78} fmt={n => `${Math.round(n)}%`} />} label="mastery" />
        <div>
          <span>Parent signal</span>
          <b>Wonder high. Logic needs confidence.</b>
        </div>
      </div>
      <div className="parent-bars">
        {parentSignals.map(([label, pct]) => <span key={label}><b>{label}</b><i><em style={{ width: `${pct}%` }} /></i><small>{pct}%</small></span>)}
      </div>
    </div>
  )
}

function CreateVisual() {
  const steps = ['Learn foundation', 'Complete quest', 'Build creation', 'Present it', 'Improve it']
  return (
    <div className="create-visual pres-pop">
      {steps.map((step, i) => <span key={step} className="create-stage"><i>{i + 1}</i><b>{step}</b></span>)}
      <div className="agent-row">
        {['Planner', 'Builder', 'Tester', 'Reviewer', 'Safety', 'Curriculum'].map(agent => <i key={agent}>{agent}</i>)}
      </div>
    </div>
  )
}

function SafetyVisual() {
  return (
    <div className="safety-visual pres-pop">
      <div className="safety-core">
        <div className="trust-shield"><ArgantaMark size={38} /></div>
        <b>Family trust layer</b>
        <span>Privacy, moderation, parent controls, and human judgment around the creative engine.</span>
      </div>
      <div className="trust-grid">
        {trust.map((item, i) => <span key={item} className={`trust-chip t${i + 1}`}>{item}</span>)}
      </div>
    </div>
  )
}

function CtaVisual() {
  return (
    <div className="cta-visual pres-pop">
      <div className="cta-mark"><ArgantaMark size={44} /></div>
      <a className="primary-btn" href="https://lab.arganta.app">Explore ArgantaLab <IconArrow /></a>
      <a className="secondary-btn" href={`mailto:${CONTACT_EMAIL}?subject=Learning%20Partner%20with%20ArgantaLab`}>Learning Partner</a>
      <a className="secondary-btn" href={`mailto:${CONTACT_EMAIL}`}>Contact Founder</a>
      <footer>Built by parents. Designed for global families.</footer>
    </div>
  )
}

const slides: Slide[] = [
  {
    id: 'promise',
    kicker: 'ArgantaLab',
    title: (
      <>
        <span>Kids see play. </span>
        <em>Parents see growth.</em>
      </>
    ),
    body: 'ArgantaLab turns the hours kids spend in games into measurable learning — powered by Argons, a knowledge currency that makes growth visible.',
    visual: <PromiseVisual />,
    mode: 'split',
  },
  {
    id: 'problem',
    kicker: 'The Problem',
    title: (
      <>
        <span>The hours are there. </span>
        <em>The growth is invisible.</em>
      </>
    ),
    body: 'Games capture attention beautifully. Parents still struggle to know what skill grew, what habit formed, and what should happen next.',
    visual: <ProblemVisual />,
    mode: 'split',
  },
  {
    id: 'answer',
    kicker: 'The Product Loop',
    title: (
      <>
        <span>Turn game loops into </span>
        <em>growth loops.</em>
      </>
    ),
    body: 'Learn, fill rings, earn Argons, grow Buddy, capture Kin, and turn every session into a parent-visible signal.',
    visual: <AnswerVisual />,
    mode: 'split',
  },
  {
    id: 'worlds',
    kicker: 'Six Worlds',
    title: (
      <>
        <span>Six worlds train </span>
        <em>six intelligences.</em>
      </>
    ),
    body: 'NumberDash, WordQuest, WonderLab, LogicLand, WorldTrail, and LifeQuest connect play to a real learning foundation.',
    visual: <WorldsVisual />,
    mode: 'split',
  },
  {
    id: 'companions',
    kicker: 'Buddy & Kin',
    title: (
      <>
        <span>The learning feels </span>
        <em>alive.</em>
      </>
    ),
    body: 'Buddy creates attachment. Kin create discovery. Together they make progress emotional, collectible, and memorable.',
    visual: <CompanionsVisual />,
    mode: 'split',
  },
  {
    id: 'rings',
    kicker: 'Daily Rings',
    title: (
      <>
        <span>Rings turn effort </span>
        <em>into rhythm.</em>
      </>
    ),
    body: 'A child can feel today. A parent can see the pattern. The product quietly builds the habit underneath.',
    visual: <RingsVisual />,
    mode: 'split',
  },
  {
    id: 'argons',
    kicker: 'Argons',
    title: (
      <>
        <span>A knowledge currency </span>
        <em>parents can guide.</em>
      </>
    ),
    body: 'Argons reward learning, care, creation, and real-world effort. Parents keep reward and consequence controls calm, visible, and accountable.',
    visual: <ArgonsVisual />,
    mode: 'split',
  },
  {
    id: 'nexus',
    kicker: 'ArgantaLand',
    title: (
      <>
        <span>Kids walk into </span>
        <em>learning worlds.</em>
      </>
    ),
    body: 'Buddy, Kin, maps, and questions are connected inside real play spaces, so learning feels like movement through a world.',
    visual: <NexusVisual />,
    mode: 'split',
  },
  {
    id: 'circle',
    kicker: 'Trusted Circles',
    title: (
      <>
        <span>Competition belongs </span>
        <em>inside trust.</em>
      </>
    ),
    body: 'Safe circles turn family, tutor, class, or friend energy into motivation without public pressure or anonymous social loops.',
    visual: <CircleVisual />,
    mode: 'split',
  },
  {
    id: 'parents',
    kicker: 'Parent Growth View',
    title: (
      <>
        <span>Parents see the signal </span>
        <em>behind the play.</em>
      </>
    ),
    body: 'Skill mastery, gaps, Bloom depth, rhythm, and the Argons ledger become a calm picture of growth.',
    visual: <ParentsVisual />,
    mode: 'split',
  },
  {
    id: 'create',
    kicker: 'Creation Layer',
    title: (
      <>
        <span>After kids learn, </span>
        <em>they build.</em>
      </>
    ),
    body: 'ArgantaLab helps kids turn intelligence into projects, stories, presentations, and playable creations.',
    visual: <CreateVisual />,
    mode: 'split',
  },
  {
    id: 'safety',
    kicker: 'Trust Layer',
    title: (
      <>
        <span>Safe by design. </span>
        <em>Creative by nature.</em>
      </>
    ),
    body: 'A family-first product needs privacy, parent awareness, learning gates, moderation, and human judgment.',
    visual: <SafetyVisual />,
    mode: 'split',
  },
  {
    id: 'cta',
    kicker: 'Start Here',
    title: (
      <>
        <span>Turn screen time into </span>
        <em>intelligence time.</em>
      </>
    ),
    body: 'For families, tutors, clubs, and learning partners ready to make screen time meaningful.',
    visual: <CtaVisual />,
    mode: 'final',
  },
]

function App() {
  const [active, setActive] = useState(0)
  const [dark, setDark] = useState(true)
  const dir = useRef(1)
  const tiltRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const slide = slides[active]

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(slides.length - 1, index))
    if (next !== active) dir.current = next > active ? 1 : -1
    setActive(next)
  }

  useEffect(() => {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  }, [dark])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight' || event.key === ' ' || event.key === 'Enter') {
        event.preventDefault()
        setActive(step => {
          dir.current = 1
          return Math.min(slides.length - 1, step + 1)
        })
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setActive(step => {
          dir.current = -1
          return Math.max(0, step - 1)
        })
      } else if (event.key.toLowerCase() === 'r') {
        event.preventDefault()
        dir.current = -1
        setActive(0)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const ctx = gsap.context(() => {
      const tl = gsap.timeline()
      tl.fromTo(el, {
        rotationY: reduce ? 0 : dir.current * 15,
        z: reduce ? 0 : -220,
        opacity: 0,
        transformPerspective: 1100,
        transformOrigin: 'center center',
      }, {
        rotationY: 0,
        z: 0,
        opacity: 1,
        duration: reduce ? 0.01 : 0.75,
        ease: 'power3.out',
      })
      el.querySelectorAll<SVGGeometryElement>('.pres-line').forEach(path => {
        const len = path.getTotalLength()
        gsap.set(path, { strokeDasharray: len, strokeDashoffset: len })
        tl.to(path, { strokeDashoffset: 0, duration: reduce ? 0.01 : 1.25, ease: 'power2.inOut' }, 0.24)
      })
      el.querySelectorAll<HTMLElement>('[data-count]').forEach(node => {
        const to = parseFloat(node.dataset.count || '0')
        const suffix = node.dataset.suffix || ''
        const obj = { v: 0 }
        tl.to(obj, {
          v: to,
          duration: reduce ? 0.01 : 1.1,
          ease: 'power2.out',
          onUpdate: () => { node.textContent = Math.round(obj.v).toLocaleString() + suffix },
        }, 0.18)
      })
      tl.fromTo('.kicker', { y: reduce ? 0 : 14, opacity: 0 }, { y: 0, opacity: 1, duration: reduce ? 0.01 : 0.42, ease: 'power2.out' }, 0.04)
        .fromTo('.cs-headline', { clipPath: 'inset(0 100% 0 0)', opacity: 0 }, { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: reduce ? 0.01 : 0.72, ease: 'power3.out' }, 0.1)
        .fromTo('.slide-body', { opacity: 0, y: reduce ? 0 : 24 }, { opacity: 1, y: 0, duration: reduce ? 0.01 : 0.52, ease: 'power2.out' }, 0.32)
        .fromTo('.pres-anim:not(.kicker):not(.slide-body)', { opacity: 0, y: reduce ? 0 : 34 }, { opacity: 1, y: 0, duration: reduce ? 0.01 : 0.64, stagger: reduce ? 0 : 0.07, ease: 'power3.out' }, 0.08)
        .fromTo('.pres-pop', { opacity: 0, scale: reduce ? 1 : 0.9, rotationY: reduce ? 0 : dir.current * 24 }, { opacity: 1, scale: 1, rotationY: 0, duration: reduce ? 0.01 : 0.7, ease: 'back.out(1.5)' }, 0.18)
        .fromTo('.problem-card, .loop-step, .world-card, .kin-card-grid span, .ring-card, .ledger-row, .habitat, .circle-card, .parent-bars span, .create-stage, .trust-chip', {
          opacity: 0,
          y: reduce ? 0 : 22,
          rotationX: reduce ? 0 : -14,
          transformPerspective: 700,
        }, {
          opacity: 1,
          y: 0,
          rotationX: 0,
          duration: reduce ? 0.01 : 0.58,
          stagger: reduce ? 0 : 0.045,
          ease: 'power3.out',
        }, 0.34)
        .fromTo('.buddy-stage .buddy, .loop-center .buddy, .loop-center svg:last-child, .world-art svg, .safety-core, .cta-mark', {
          opacity: 0,
          scale: reduce ? 1 : 0.72,
          rotationY: reduce ? 0 : -38,
        }, {
          opacity: 1,
          scale: 1,
          rotationY: 0,
          duration: reduce ? 0.01 : 0.66,
          stagger: reduce ? 0 : 0.035,
          ease: 'back.out(1.7)',
        }, 0.28)
        .fromTo('.pres-bar', { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: reduce ? 0.01 : 0.72, stagger: reduce ? 0 : 0.06, ease: 'power3.out' }, 0.2)
        .fromTo('.mini-bars i, .parent-bars em, .problem-card em', { scaleX: 0, transformOrigin: 'left center' }, { scaleX: 1, duration: reduce ? 0.01 : 0.78, stagger: reduce ? 0 : 0.04, ease: 'power3.out' }, 0.42)
      gsap.to('.problem-scan', { xPercent: 440, duration: reduce ? 0.01 : 2.8, repeat: reduce ? 0 : -1, ease: 'none' })
      gsap.to('.loop-center', { y: reduce ? 0 : -6, duration: 2.6, yoyo: true, repeat: reduce ? 0 : -1, ease: 'sine.inOut' })
    }, el)
    return () => ctx.revert()
  }, [active])

  useEffect(() => {
    const el = tiltRef.current
    if (!el) return
    const onMove = (event: MouseEvent) => {
      const x = event.clientX / window.innerWidth - 0.5
      const y = event.clientY / window.innerHeight - 0.5
      gsap.to(el, { rotationY: x * 5, rotationX: -y * 4, transformPerspective: 1400, transformOrigin: 'center center', duration: 0.75, ease: 'power2.out' })
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  return (
    <div className="deck-app">
      <div className="scene-canvas" aria-hidden>
        <ArgantaBoxScene dark={dark} step={active} />
      </div>
      <div className="stage-wash" aria-hidden />

      <header className="stage-brand">
        <button className="brand-lockup" onClick={() => goTo(0)} aria-label="Replay from beginning">
          <span><ArgantaMark /></span>
          <b>ArgantaLab</b>
        </button>
        <div className="act-label">{slide.kicker}</div>
      </header>

      <div className="stage-actions" aria-label="Presentation controls">
        <button className="stage-btn ghost" onClick={() => setDark(d => !d)} aria-label="Toggle theme">
          {dark ? <IconSun /> : <IconMoon />}
        </button>
        <button className="stage-btn" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous slide">
          <IconArrow dir="left" />
        </button>
        <button className="stage-btn" onClick={() => goTo(active + 1)} disabled={active === slides.length - 1} aria-label="Next slide">
          <IconArrow />
        </button>
      </div>

      <main className="slide-stage" aria-live="polite">
        <div ref={tiltRef} className="tilt-shell">
          <section ref={stageRef} key={slide.id} className={`deck-slide ${slide.mode ?? 'split'}`}>
            <div className="slide-copy">
              <p className="kicker pres-anim">{slide.kicker}</p>
              <h1 className="cs-headline">{slide.title}</h1>
              {slide.body && <p className="slide-body pres-anim">{slide.body}</p>}
            </div>
            <div className="slide-visual">
              {slide.visual}
            </div>
          </section>
        </div>
      </main>

      <div className="progress-rail" aria-label="Slide progress">
        {slides.map((item, index) => (
          <button
            key={item.id}
            className={`progress-dot ${index === active ? 'on' : ''}`}
            onClick={() => goTo(index)}
            aria-label={`Go to ${item.kicker}`}
            aria-current={index === active ? 'step' : undefined}
          />
        ))}
      </div>

      <div className="stage-footer">
        <span>{String(active + 1).padStart(2, '0')} / {String(slides.length).padStart(2, '0')}</span>
      </div>
    </div>
  )
}

export default App
