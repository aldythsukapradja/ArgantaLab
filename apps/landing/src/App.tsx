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

type SceneId = 'open' | 'problem' | 'mechanism' | 'worlds' | 'quest' | 'proof' | 'trust' | 'cta'

interface Scene {
  id: SceneId
  kicker: string
  title: ReactNode
  body: ReactNode
  visual: ReactNode
  accent: string
}

const worlds = WORLDS.slice(0, 6)

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
    <svg className={dir === 'left' ? 'flip' : ''} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
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

function OpeningScene() {
  return (
    <div className="cine-visual open-visual">
      <div className="orbit-halo" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="hero-orbit-shell actor-main">
        <OrbitCapture />
      </div>
      <div className="floating-ledger actor-side">
        <span>Argons minted</span>
        <b><CountUp to={4280} /></b>
        <small>knowledge currency</small>
      </div>
      <div className="kin-comet-row actor-side">
        {KIN.slice(0, 5).map((kin, index) => (
          <i key={kin.id} style={{ '--d': `${index * 0.08}s`, '--kin': kin.color } as CSSProperties}>
            <KinSprite kin={kin.id} size={52} bob />
          </i>
        ))}
      </div>
    </div>
  )
}

function ProblemScene() {
  const cards = [
    ['Hours vanish', 'time without evidence'],
    ['Rewards are random', 'coins without meaning'],
    ['Parents see summaries', 'activity without proof'],
    ['Learning is separate', 'school outside play'],
  ] as const
  return (
    <div className="cine-visual problem-cinema">
      <div className="blackbox actor-main">
        <div className="blackbox-core">
          <span>black box</span>
          <b>Games already have the time.</b>
          <small>Growth is trapped inside the session.</small>
        </div>
        <div className="blackbox-crack" />
      </div>
      <div className="problem-orbit">
        {cards.map(([title, note], index) => (
          <article key={title} className={`problem-shard s${index + 1}`}>
            <b>{title}</b>
            <span>{note}</span>
            <i />
          </article>
        ))}
      </div>
    </div>
  )
}

function MechanismScene() {
  return (
    <div className="cine-visual mechanism-cinema">
      <div className="mechanism-rings actor-main" style={{ '--c0': '#22d3ee', '--c1': '#8b5cf6' } as CSSProperties}>
        {worlds.map((world, index) => (
          <div key={world.key} className={`mechanism-ring r${index + 1}`} style={{ '--world': world.color } as CSSProperties}>
            <KinetikRing pct={[82, 64, 48, 76, 57, 91][index]} size={96} value={<span>{world.icon}</span>} label={world.name} />
          </div>
        ))}
        <div className="mechanism-core">
          <CircleEmblem accent={['#22d3ee', '#8b5cf6']} active size={86} />
          <b>Play becomes proof</b>
        </div>
      </div>
      <div className="quest-peek actor-side">
        <QACapture />
      </div>
    </div>
  )
}

function WorldsScene() {
  return (
    <div className="cine-visual worlds-cinema">
      <div className="map-starfield actor-main">
        <WorldMapCapture />
      </div>
      <div className="world-index actor-side">
        {worlds.map(world => (
          <span key={world.key} style={{ '--world': world.color } as CSSProperties}>
            <i>{world.icon}</i>
            <b>{world.name}</b>
          </span>
        ))}
      </div>
    </div>
  )
}

function QuestScene() {
  return (
    <div className="cine-visual quest-cinema">
      <div className="land-portal actor-main">
        <ArgantaLandCapture />
      </div>
      <div className="qa-portal actor-side">
        <QACapture />
      </div>
    </div>
  )
}

function ProofScene() {
  const signals = [
    ['Skill mastery', 78, '#22d3ee'],
    ['Bloom depth', 63, '#8b5cf6'],
    ['Daily rhythm', 86, '#22c55e'],
    ['Argons ledger', 91, '#f6b83f'],
  ] as const
  return (
    <div className="cine-visual proof-cinema">
      <div className="proof-orb actor-main" style={{ '--c0': '#22d3ee', '--c1': '#8b5cf6' } as CSSProperties}>
        <KinetikRing pct={78} size={180} value={<CountUp to={78} fmt={n => `${Math.round(n)}%`} />} label="mastery" />
        <div className="proof-buddy"><Buddy mood="celebrate" size={126} color="#8b5cf6" /></div>
      </div>
      <div className="signal-stack actor-side">
        {signals.map(([label, value, color]) => (
          <span key={label} style={{ '--signal': color } as CSSProperties}>
            <b>{label}</b>
            <i><em style={{ width: `${value}%` }} /></i>
            <strong>{value}%</strong>
          </span>
        ))}
      </div>
    </div>
  )
}

function TrustScene() {
  const chips = ['Private circles', 'Parent-aware sharing', 'Learning-gated rewards', 'Server ledger', 'Moderated publishing']
  return (
    <div className="cine-visual trust-cinema">
      <div className="circle-constellation actor-main">
        {[
          ['Family', '#f43f5e', '#fb7185'],
          ['Class', '#22d3ee', '#6366f1'],
          ['Tutor', '#f59e0b', '#ec4899'],
        ].map(([label, a, b], index) => (
          <div key={label} className={`trust-circle c${index + 1}`}>
            <CircleEmblem accent={[a, b]} active={index === 0} size={96} />
            <b>{label}</b>
          </div>
        ))}
      </div>
      <div className="trust-capsules actor-side">
        {chips.map(chip => <span key={chip}>{chip}</span>)}
      </div>
    </div>
  )
}

function CtaScene() {
  return (
    <div className="cine-visual cta-cinema">
      <div className="cta-sigil actor-main">
        <ArgantaMark size={74} />
      </div>
      <div className="cta-actions actor-side">
        <a className="primary-btn" href="https://lab.arganta.app">Explore ArgantaLab <IconArrow /></a>
        <a className="secondary-btn" href={`mailto:${CONTACT_EMAIL}?subject=Learning%20Partner%20with%20ArgantaLab`}>Learning Partner</a>
        <a className="secondary-btn" href={`mailto:${CONTACT_EMAIL}`}>Contact Founder</a>
        <footer>Built by parents. Designed for global families.</footer>
      </div>
    </div>
  )
}

const scenes: Scene[] = [
  {
    id: 'open',
    kicker: 'ArgantaLab',
    title: <><span>Kids see play. </span><em>Parents see growth.</em></>,
    body: 'ArgantaLab turns the hours kids spend in games into measurable learning, powered by Argons and daily rings that make growth visible.',
    visual: <OpeningScene />,
    accent: '#22d3ee',
  },
  {
    id: 'problem',
    kicker: 'The Black Box',
    title: <><span>Screen time is huge. </span><em>The signal is hidden.</em></>,
    body: 'Games are already earning attention. The missing layer is proof: what improved, what habit formed, and what parents should do next.',
    visual: <ProblemScene />,
    accent: '#fb7185',
  },
  {
    id: 'mechanism',
    kicker: 'The Conversion Engine',
    title: <><span>Every session becomes </span><em>a growth event.</em></>,
    body: 'Questions fill rings. Rings mint Argons. Argons unlock worlds, Kin, and parent-visible progress.',
    visual: <MechanismScene />,
    accent: '#8b5cf6',
  },
  {
    id: 'worlds',
    kicker: 'Six Worlds',
    title: <><span>One game universe. </span><em>Six intelligences.</em></>,
    body: 'NumberDash, WordQuest, WonderLab, LogicLand, WorldTrail, and LifeQuest turn curriculum into places kids want to enter.',
    visual: <WorldsScene />,
    accent: '#f6b83f',
  },
  {
    id: 'quest',
    kicker: 'Real Play',
    title: <><span>Learning is not a worksheet. </span><em>It is movement.</em></>,
    body: 'Buddy walks, Kin appear, and real Q&A moments become the gate between play and reward.',
    visual: <QuestScene />,
    accent: '#22c55e',
  },
  {
    id: 'proof',
    kicker: 'Parent Proof',
    title: <><span>The parent sees </span><em>the intelligence behind play.</em></>,
    body: 'Skill mastery, rhythm, Bloom depth, and the Argons ledger become a calm proof layer over the child’s week.',
    visual: <ProofScene />,
    accent: '#22d3ee',
  },
  {
    id: 'trust',
    kicker: 'Trust Layer',
    title: <><span>Competition belongs </span><em>inside trusted circles.</em></>,
    body: 'Family, class, tutor, and learning partners can motivate without public pressure or anonymous social loops.',
    visual: <TrustScene />,
    accent: '#ec4899',
  },
  {
    id: 'cta',
    kicker: 'Start Here',
    title: <><span>Turn screen time into </span><em>intelligence time.</em></>,
    body: 'For families, tutors, clubs, and learning partners ready to make game time measurable, meaningful, and alive.',
    visual: <CtaScene />,
    accent: '#22d3ee',
  },
]

function App() {
  const [active, setActive] = useState(0)
  const [dark, setDark] = useState(true)
  const dir = useRef(1)
  const stageRef = useRef<HTMLElement>(null)
  const scene = scenes[active]

  const goTo = (index: number) => {
    const next = Math.max(0, Math.min(scenes.length - 1, index))
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
          return Math.min(scenes.length - 1, step + 1)
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
        opacity: 0,
        x: reduce ? 0 : dir.current * 72,
        z: reduce ? 0 : -260,
        rotationY: reduce ? 0 : dir.current * 18,
        transformPerspective: 1400,
      }, {
        opacity: 1,
        x: 0,
        z: 0,
        rotationY: 0,
        duration: reduce ? 0.01 : 0.88,
        ease: 'power3.out',
      })
      tl.fromTo('.scene-kicker', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: reduce ? 0.01 : 0.42, ease: 'power2.out' }, 0.05)
        .fromTo('.scene-title', { clipPath: 'inset(0 100% 0 0)', opacity: 0 }, { clipPath: 'inset(0 0% 0 0)', opacity: 1, duration: reduce ? 0.01 : 0.78, ease: 'power3.out' }, 0.12)
        .fromTo('.scene-body', { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: reduce ? 0.01 : 0.56, ease: 'power2.out' }, 0.42)
        .fromTo('.actor-main', { scale: reduce ? 1 : 0.72, y: reduce ? 0 : 52, opacity: 0, rotationX: reduce ? 0 : -12 }, {
          scale: 1,
          y: 0,
          opacity: 1,
          rotationX: 0,
          duration: reduce ? 0.01 : 0.82,
          ease: 'back.out(1.45)',
        }, 0.18)
        .fromTo('.actor-side, .problem-shard, .world-index span, .trust-capsules span, .signal-stack span', {
          y: reduce ? 0 : 34,
          opacity: 0,
          scale: reduce ? 1 : 0.86,
        }, {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: reduce ? 0.01 : 0.58,
          stagger: reduce ? 0 : 0.055,
          ease: 'power3.out',
        }, 0.45)
      gsap.to('.orbit-halo span', { rotate: '+=360', duration: reduce ? 0.01 : 18, repeat: reduce ? 0 : -1, ease: 'none', stagger: 1.4 })
      gsap.to('.cta-sigil, .mechanism-core, .proof-orb', { y: reduce ? 0 : -10, duration: 2.6, repeat: reduce ? 0 : -1, yoyo: true, ease: 'sine.inOut' })
    }, el)
    return () => ctx.revert()
  }, [active])

  return (
    <div className="deck-app cine-app" data-scene={scene.id} style={{ '--scene-accent': scene.accent } as CSSProperties}>
      <div className="scene-canvas" aria-hidden>
        <ArgantaBoxScene dark={dark} step={active} />
      </div>
      <div className="cine-grid-depth" aria-hidden />
      <div className="stage-wash" aria-hidden />

      <header className="stage-brand">
        <button className="brand-lockup" onClick={() => goTo(0)} aria-label="Replay from beginning">
          <span><ArgantaMark /></span>
          <b>ArgantaLab</b>
        </button>
        <div className="act-label">{scene.kicker}</div>
      </header>

      <div className="stage-actions" aria-label="Presentation controls">
        <button className="stage-btn ghost" onClick={() => setDark(d => !d)} aria-label="Toggle theme">
          {dark ? <IconSun /> : <IconMoon />}
        </button>
        <button className="stage-btn" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label="Previous slide">
          <IconArrow dir="left" />
        </button>
        <button className="stage-btn" onClick={() => goTo(active + 1)} disabled={active === scenes.length - 1} aria-label="Next slide">
          <IconArrow />
        </button>
      </div>

      <main className="cine-stage" aria-live="polite">
        <section ref={stageRef} key={scene.id} className={`cine-scene scene-${scene.id}`}>
          <div className="scene-copy">
            <p className="scene-kicker">{scene.kicker}</p>
            <h1 className="scene-title">{scene.title}</h1>
            <p className="scene-body">{scene.body}</p>
          </div>
          <div className="scene-visual">
            {scene.visual}
          </div>
        </section>
      </main>

      <div className="progress-rail cinematic" aria-label="Scene progress">
        {scenes.map((item, index) => (
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
        <span>{String(active + 1).padStart(2, '0')} / {String(scenes.length).padStart(2, '0')}</span>
      </div>
    </div>
  )
}

export default App
