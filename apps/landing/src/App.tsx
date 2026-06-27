import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ThreeCanvas } from './ThreeCanvas'
import { PRODUCTS, GAMES, ART } from './portfolio'

gsap.registerPlugin(ScrollTrigger)

const CONTACT_EMAIL = 'hello@arganta.app'

// ── Icons ──────────────────────────────────────────────────────
function IconApple() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
    </svg>
  )
}
function IconPlay() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M3.18 23.76c.2.13.42.2.64.2.27 0 .53-.08.76-.22L20.2 14.3a1.3 1.3 0 0 0 0-2.24L4.58.44A1.3 1.3 0 0 0 2.62 1.6V22.4c0 .54.21.96.56 1.36z"/>
    </svg>
  )
}
function IconSun() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>
    </svg>
  )
}
function IconMoon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
    </svg>
  )
}
function IconCheck() {
  return (
    <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M2 6l3 3 5-5"/>
    </svg>
  )
}
function IconArrow() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  )
}
function IconChevronDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M6 9l6 6 6-6"/>
    </svg>
  )
}
function IconMail() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>
    </svg>
  )
}

function ArgantaMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="2.5"/>
      <circle cx="16" cy="8" r="2.5" fill="white"/>
      <circle cx="12" cy="12" r="1.5" fill="white"/>
    </svg>
  )
}

// ── Store buttons ────────────────────────────────────────────
function StoreBtn({ type, href }: { type: 'apple' | 'google'; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="store-btn">
      {type === 'apple' ? <IconApple /> : <IconPlay />}
      <span className="store-btn-text">
        <span className="store-btn-small">{type === 'apple' ? 'Download on the' : 'Get it on'}</span>
        <span className="store-btn-name">{type === 'apple' ? 'App Store' : 'Google Play'}</span>
      </span>
    </a>
  )
}

// ── Phone mockup ─────────────────────────────────────────────
function PhoneMockup({ gradient, children }: { gradient: string; children: React.ReactNode }) {
  return (
    <div className="mockup-wrap">
      <div className="mockup-glow" style={{ background: gradient }} />
      <div className="phone">
        <div className="phone-notch" />
        <div className="phone-screen">
          <div className="phone-statusbar" />
          <div className="phone-content" style={{ background: gradient, opacity: 0.9 }}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function KinetikPhone() {
  const items = ['Moments', 'Stories', 'Albums', 'Routines']
  const posts = [
    { h: 80, label: 'Morning walk 🌅' },
    { h: 60, label: 'Family dinner 🍝' },
    { h: 50, label: 'Game night 🎲' },
  ]
  return (
    <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8, height: '100%' }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
        {items.map((it, i) => (
          <div key={it} style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 9, fontWeight: 600,
            whiteSpace: 'nowrap', flexShrink: 0,
            background: i === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.2)',
            color: i === 0 ? '#0891b2' : 'rgba(255,255,255,0.8)',
          }}>{it}</div>
        ))}
      </div>
      {posts.map((p, i) => (
        <div key={i} style={{
          height: p.h, borderRadius: 12, flexShrink: 0,
          background: 'rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'flex-end', padding: 8,
        }}>
          <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{p.label}</span>
        </div>
      ))}
    </div>
  )
}

function LabPhone() {
  const subjects = [
    { emoji: '🔢', name: 'Math', pct: 82 },
    { emoji: '🔬', name: 'Science', pct: 65 },
    { emoji: '📖', name: 'Reading', pct: 91 },
  ]
  return (
    <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 10, height: '100%' }}>
      <div style={{
        background: 'rgba(255,255,255,0.2)', borderRadius: 12, padding: '10px 12px',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
        }}>⭐</div>
        <div>
          <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Today's XP</div>
          <div style={{ fontSize: 16, color: '#fff', fontWeight: 800 }}>+240</div>
        </div>
      </div>
      {subjects.map(s => (
        <div key={s.name} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>
            <span>{s.emoji} {s.name}</span><span>{s.pct}%</span>
          </div>
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.2)' }}>
            <div style={{ width: `${s.pct}%`, height: '100%', borderRadius: 3, background: 'rgba(255,255,255,0.9)' }} />
          </div>
        </div>
      ))}
      <div style={{
        marginTop: 'auto', background: 'rgba(255,255,255,0.15)', borderRadius: 12,
        padding: 10, display: 'flex', gap: 6,
      }}>
        {['🎮', '📚', '🏆'].map(e => (
          <div key={e} style={{
            flex: 1, height: 40, borderRadius: 8,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
          }}>{e}</div>
        ))}
      </div>
    </div>
  )
}

function DashboardMockup() {
  const bars = [30, 55, 42, 70, 85, 62, 90]
  const stats = [
    { label: 'Circles', val: '1.2k' },
    { label: 'Members', val: '8.4k' },
    { label: 'Posts · 7d', val: '3.1k' },
    { label: 'Reactions', val: '42k' },
  ]
  return (
    <div className="dashboard">
      <div className="dash-topbar">
        <div className="dash-dot" style={{ background: '#ef4444' }} />
        <div className="dash-dot" style={{ background: '#f59e0b' }} />
        <div className="dash-dot" style={{ background: '#22c55e' }} />
        <div style={{ flex: 1, marginLeft: 8, height: 6, borderRadius: 3, background: 'var(--border)' }} />
      </div>
      <div className="dash-body">
        <div className="dash-row" style={{ gridTemplateColumns: 'repeat(2,1fr)', display: 'grid', gap: 10 }}>
          {stats.map(s => (
            <div key={s.label} className="dash-card">
              <div className="dash-card-label">{s.label}</div>
              <div className="dash-card-val">{s.val}</div>
            </div>
          ))}
        </div>
        <div className="dash-bar">
          <div className="dash-bar-label">Growth · Last 7 days</div>
          <div className="dash-bars">
            {bars.map((h, i) => (
              <div key={i} className="dash-bar-item" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
        <div className="dash-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          <div className="dash-card">
            <div className="dash-card-label">Broadcasts live</div>
            <div className="dash-card-val" style={{ fontSize: 18 }}>14</div>
          </div>
          <div className="dash-card">
            <div className="dash-card-label">Discover views</div>
            <div className="dash-card-val" style={{ fontSize: 18 }}>2.8k</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const VALUES = [
  { icon: '👨‍👩‍👧‍👦', title: 'Family-first', desc: 'We build for circles, not crowds. Every product is designed for the people who matter most.' },
  { icon: '🔒', title: 'Privacy by design', desc: 'Your data stays in your circle. No ads, no selling, no public feeds — calm by default.' },
  { icon: '⚡', title: 'AI-native', desc: 'We build with AI at the core — from authoring games to shipping features at studio speed.' },
  { icon: '🚀', title: 'Ship & iterate', desc: 'Real products in production, improved continuously. We learn from live usage, not slides.' },
]

const STATS = [
  { num: '3', label: 'Products live' },
  { num: '4+', label: 'Games shipped' },
  { num: '100%', label: 'Privacy-first' },
  { num: '1', label: 'Connected ecosystem' },
]

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true)
  const heroContentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  useEffect(() => {
    if (heroContentRef.current) {
      const els = heroContentRef.current.querySelectorAll('.hero-badge, .hero-title, .hero-sub, .hero-ctas')
      gsap.fromTo(els,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.12, ease: 'power3.out', delay: 0.3 }
      )
    }
    const reveals = document.querySelectorAll('.reveal')
    reveals.forEach(el => {
      ScrollTrigger.create({ trigger: el, start: 'top 88%', onEnter: () => el.classList.add('in') })
    })
    return () => ScrollTrigger.getAll().forEach(t => t.kill())
  }, [])

  const KINETIK_FEATURES = [
    'Private Circles — one per family, invite-only',
    'Moments feed — photos, videos, stories & kudos',
    'Routines & shared family calendar',
    'Discover feed with platform-authored cards',
  ]
  const LAB_FEATURES = [
    'Mastery-based lessons with XP & diamond rewards',
    'Mini-games built with the AI Game Builder',
    'Live progress dashboard for parents',
    'Circles shared with KinetikCircle',
  ]
  const HQ_FEATURES = [
    'Portfolio view across every app',
    'Growth analytics & engagement KPIs',
    'Broadcast engine — reach every circle at once',
    'Game, App & Learn builders, AI-powered',
  ]

  return (
    <>
      {/* ── Nav ──────────────────────────────────────── */}
      <header className="nav">
        <a href="#top" className="nav-logo">
          <div className="nav-mark"><ArgantaMark /></div>
          Arganta
        </a>
        <ul className="nav-links">
          <li><a href="#about">About</a></li>
          <li><a href="#products">Products</a></li>
          <li><a href="#work">Work</a></li>
          <li><a href="#contact">Contact</a></li>
        </ul>
        <div className="nav-right">
          <button className="theme-btn" onClick={() => setDark(d => !d)} aria-label="Toggle theme">
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <a href="#contact" className="btn-nav">
            Get in touch <IconArrow />
          </a>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="hero" id="top">
        <div className="hero-canvas">
          <ThreeCanvas dark={dark} />
        </div>
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: dark
            ? 'radial-gradient(ellipse at center, transparent 30%, rgba(9,9,11,0.7) 100%)'
            : 'radial-gradient(ellipse at center, transparent 30%, rgba(255,255,255,0.8) 100%)',
        }} />
        <div className="hero-content" ref={heroContentRef}>
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Arganta · Family Technology Studio
          </div>
          <h1 className="hero-title">
            We build the apps<br />
            <span className="grad">families grow with.</span>
          </h1>
          <p className="hero-sub">
            Arganta is a product studio crafting a connected ecosystem —
            where families share private moments, kids fall in love with
            learning, and operators run it all from one place.
          </p>
          <div className="hero-ctas">
            <a href="#products" className="btn-primary">
              See our products <IconArrow />
            </a>
            <a href="#about" className="btn-secondary">
              About the studio
            </a>
          </div>
        </div>
        <div className="hero-scroll">
          <span>Scroll</span>
          <IconChevronDown />
        </div>
      </section>

      {/* ── About ────────────────────────────────────── */}
      <section className="about" id="about">
        <div className="about-inner">
          <div className="about-sticky reveal">
            <div className="section-eyebrow" style={{ marginBottom: 24 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--grd)', display: 'inline-block' }} />
              About Arganta
            </div>
            <h2 className="about-lead">
              One studio.<br />
              <span className="mut">A connected ecosystem of products for modern families.</span>
            </h2>
          </div>
          <div className="about-body reveal reveal-d1">
            <p>
              Arganta started with a simple belief: <strong>families deserve technology
              built for them</strong> — not for advertisers, algorithms or endless scroll.
            </p>
            <p>
              So we build products that work together as one. <strong>KinetikCircle</strong> gives
              every family a private space to share life. <strong>ArgantaLab</strong> turns learning
              into something kids actually love. And <strong>Circle HQ</strong> is the operator OS
              that powers it all — analytics, content, and AI-driven builders under one roof.
            </p>
            <p>
              Every product is privacy-first, AI-native, and designed around a single
              idea: <strong>bring the people in your circle closer.</strong> We ship fast,
              learn from real usage, and treat each release as a promise to the families who use it.
            </p>
            <div className="about-signature">
              <div className="about-sig-mark"><ArgantaMark size={22} /></div>
              <div className="about-sig-text">
                <b>Arganta</b>
                Building family technology, one circle at a time.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Stats band ───────────────────────────────── */}
      <div className="stats-band">
        <div className="stats-inner">
          {STATS.map((s, i) => (
            <div key={s.label} className={`stat-big reveal reveal-d${i + 1}`}>
              <div className="stat-big-num">{s.num}</div>
              <div className="stat-big-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Values ───────────────────────────────────── */}
      <section className="values">
        <div className="values-inner">
          <div className="section-tag reveal">How we build</div>
          <h2 className="eco-title reveal reveal-d1" style={{ fontSize: 'clamp(30px,4vw,46px)' }}>
            Principles behind<br />every product.
          </h2>
          <div className="values-grid">
            {VALUES.map((v, i) => (
              <div key={v.title} className={`value-card reveal reveal-d${i + 1}`}>
                <div className="value-icon">{v.icon}</div>
                <div className="value-title">{v.title}</div>
                <div className="value-desc">{v.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Products ─────────────────────────────────── */}
      <div id="products" />

      {/* KinetikCircle */}
      <section className="section" style={{ background: 'var(--bg)' }}>
        <div className="section-inner">
          <div>
            <div className="section-eyebrow reveal">
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #22d3ee, #06b6d4)', display: 'inline-block' }} />
              Product · Family Social
            </div>
            <h2 className="section-title reveal reveal-d1">Your family's<br />private universe</h2>
            <p className="section-desc reveal reveal-d2">
              KinetikCircle is a private social app built exclusively for families.
              Share moments, stories, albums and routines — all within your circle,
              away from the noise of public social media.
            </p>
            <ul className="feature-list reveal reveal-d3">
              {KINETIK_FEATURES.map(f => (
                <li key={f}>
                  <span className="feat-dot" style={{ background: 'rgba(6,182,212,0.15)', color: '#0891b2' }}><IconCheck /></span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="reveal reveal-d4">
              <div className="store-btns">
                <StoreBtn type="apple" href="https://circle.arganta.app" />
                <StoreBtn type="google" href="https://circle.arganta.app" />
              </div>
              <a href="https://circle.arganta.app" target="_blank" rel="noopener" className="btn-try">
                Try in browser <IconArrow />
              </a>
            </div>
          </div>
          <div className="reveal">
            <PhoneMockup gradient="linear-gradient(160deg, #0891b2 0%, #22d3ee 50%, #67e8f9 100%)">
              <KinetikPhone />
            </PhoneMockup>
          </div>
        </div>
      </section>

      {/* ArgantaLab */}
      <section className="section" style={{ background: 'var(--bg2)' }}>
        <div className="section-inner rev">
          <div>
            <div className="section-eyebrow reveal" style={{ color: '#7c3aed' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)', display: 'inline-block' }} />
              Product · Kids Education
            </div>
            <h2 className="section-title reveal reveal-d1">
              Where kids<br />fall in love with<br />
              <span style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>learning</span>
            </h2>
            <p className="section-desc reveal reveal-d2">
              ArgantaLab is a gamified learning super-app — mastery-based lessons,
              AI-authored mini-games, diamond rewards, and family circles that keep
              parents in the loop.
            </p>
            <ul className="feature-list reveal reveal-d3">
              {LAB_FEATURES.map(f => (
                <li key={f}>
                  <span className="feat-dot" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}><IconCheck /></span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="reveal reveal-d4">
              <div className="store-btns">
                <StoreBtn type="apple" href="https://lab.arganta.app" />
                <StoreBtn type="google" href="https://lab.arganta.app" />
              </div>
              <a href="https://lab.arganta.app" target="_blank" rel="noopener" className="btn-try">
                Try in browser <IconArrow />
              </a>
            </div>
          </div>
          <div className="reveal">
            <PhoneMockup gradient="linear-gradient(160deg, #5b21b6 0%, #7c3aed 50%, #a78bfa 100%)">
              <LabPhone />
            </PhoneMockup>
          </div>
        </div>
      </section>

      {/* Circle HQ */}
      <section className="section" style={{ background: 'var(--bg)' }}>
        <div className="section-inner">
          <div>
            <div className="section-eyebrow reveal" style={{ color: 'var(--tx2)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--tx2)', display: 'inline-block' }} />
              Product · Operator Platform
            </div>
            <h2 className="section-title reveal reveal-d1">The command center<br />for the ecosystem</h2>
            <p className="section-desc reveal reveal-d2">
              Circle HQ is the founder OS that sits above every app. Manage content,
              track growth, broadcast to every circle, and build the next feature —
              all from one dashboard.
            </p>
            <ul className="feature-list reveal reveal-d3">
              {HQ_FEATURES.map(f => (
                <li key={f}>
                  <span className="feat-dot" style={{ background: 'var(--bg3)', color: 'var(--tx2)' }}><IconCheck /></span>
                  {f}
                </li>
              ))}
            </ul>
            <div className="reveal reveal-d4">
              <a href="https://hq.arganta.app" target="_blank" rel="noopener" className="btn-primary">
                Open Circle HQ <IconArrow />
              </a>
            </div>
          </div>
          <div className="mockup-wrap reveal">
            <div className="mockup-glow" style={{ background: 'linear-gradient(135deg, #7c3aed, #0ea5e9)', opacity: 0.08 }} />
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── Portfolio / Work ─────────────────────────── */}
      <section className="portfolio" id="work">
        <div className="portfolio-inner">
          <div className="section-tag reveal">Selected Work</div>
          <h2 className="eco-title reveal reveal-d1" style={{ fontSize: 'clamp(30px,4vw,46px)' }}>
            Games we've shipped,<br />
            <span style={{ background: 'var(--grd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>built with AI.</span>
          </h2>
          <p className="eco-sub reveal reveal-d2">
            Playable HTML games authored inside Circle HQ's Game Builder and
            shipped live inside ArgantaLab. Click any title to play.
          </p>
          <div className="port-grid">
            {GAMES.map((g, i) => (
              <a key={g.id} href={g.href} target="_blank" rel="noopener"
                className={`port-card reveal reveal-d${(i % 4) + 1}`}>
                <div className="port-art" style={{ background: ART(g.hue) }}>
                  <span className="port-art-emoji">{g.emoji}</span>
                  <span className="port-art-play"><IconPlay /></span>
                </div>
                <div className="port-info">
                  <div className="port-name">{g.name}</div>
                  <div className="port-desc">{g.desc}</div>
                  <div className="port-tags">
                    {g.tags.map(t => <span key={t} className="port-tag">{t}</span>)}
                  </div>
                </div>
              </a>
            ))}
          </div>
          <p className="port-note reveal">
            …and more shipping continuously. Every game is built with AI + HTML inside our own tooling.
          </p>
        </div>
      </section>

      {/* ── Promotion / Download ─────────────────────── */}
      <section className="ecosystem">
        <div className="ecosystem-inner">
          <div className="section-tag reveal">Get the apps</div>
          <h2 className="eco-title reveal reveal-d1">
            Bring Arganta<br />
            <span style={{ background: 'var(--grd)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>to your family.</span>
          </h2>
          <p className="eco-sub reveal reveal-d2">
            Download our consumer apps, or sign in to Circle HQ to run the ecosystem.
          </p>
          <div className="eco-grid">
            {PRODUCTS.map((p, i) => (
              <div key={p.id} className={`eco-card reveal reveal-d${i + 1}`}>
                <div className="eco-icon" style={{ background: p.gradient }}>
                  <span style={{ fontSize: 22, filter: 'grayscale(1) brightness(3)' }}>
                    {p.id === 'kinetik' ? '🔵' : p.id === 'lab' ? '🟣' : '⚙️'}
                  </span>
                </div>
                <div className="eco-card-title">{p.name}</div>
                <div className="eco-card-desc">{p.desc}</div>
                {p.id === 'hq' ? (
                  <a href={p.href} target="_blank" rel="noopener" className="btn-try" style={{ marginTop: 18 }}>
                    Open dashboard <IconArrow />
                  </a>
                ) : (
                  <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <div className="store-btns" style={{ marginBottom: 0 }}>
                      <StoreBtn type="apple" href={p.href} />
                      <StoreBtn type="google" href={p.href} />
                    </div>
                    <a href={p.href} target="_blank" rel="noopener" className="btn-try">
                      Try in browser <IconArrow />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Contact ──────────────────────────────────── */}
      <section className="contact" id="contact">
        <div className="contact-card reveal">
          <div className="section-tag" style={{ marginBottom: 22 }}>Let's talk</div>
          <h2 className="contact-title">
            Building something<br />for families?
          </h2>
          <p className="contact-sub">
            Partnerships, press, or just want to say hello —
            we'd love to hear from you.
          </p>
          <a href={`mailto:${CONTACT_EMAIL}`} className="contact-email">
            <IconMail /> {CONTACT_EMAIL}
          </a>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <a href="#top" className="footer-logo">
              <div className="nav-mark"><ArgantaMark size={14} /></div>
              Arganta
            </a>
            <p className="footer-tagline">
              A family technology studio. Building the apps where families connect,
              kids learn, and creators thrive.
            </p>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <div className="footer-col-title">Products</div>
              <ul>
                <li><a href="https://circle.arganta.app" target="_blank" rel="noopener">KinetikCircle</a></li>
                <li><a href="https://lab.arganta.app" target="_blank" rel="noopener">ArgantaLab</a></li>
                <li><a href="https://hq.arganta.app" target="_blank" rel="noopener">Circle HQ</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Company</div>
              <ul>
                <li><a href="#about">About</a></li>
                <li><a href="#work">Work</a></li>
                <li><a href="#contact">Contact</a></li>
                <li><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Legal</div>
              <ul>
                <li><a href="#">Privacy Policy</a></li>
                <li><a href="#">Terms of Service</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Arganta. All rights reserved.</span>
          <button className="theme-btn" onClick={() => setDark(d => !d)} aria-label="Toggle theme" style={{ border: '1px solid var(--border)' }}>
            {dark ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </footer>
    </>
  )
}
