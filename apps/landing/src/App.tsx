import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ThreeCanvas } from './ThreeCanvas'

gsap.registerPlugin(ScrollTrigger)

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

// ── KinetikCircle phone UI ────────────────────────────────────
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

// ── ArgantaLab phone UI ───────────────────────────────────────
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

// ── Dashboard mockup ──────────────────────────────────────────
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

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const [dark, setDark] = useState(true)
  const heroRef = useRef<HTMLDivElement>(null)
  const heroContentRef = useRef<HTMLDivElement>(null)

  // Apply theme
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light')
  }, [dark])

  // GSAP animations
  useEffect(() => {
    // Hero entrance
    if (heroContentRef.current) {
      const els = heroContentRef.current.querySelectorAll('.hero-badge, .hero-title, .hero-sub, .hero-ctas, .hero-scroll')
      gsap.fromTo(els,
        { opacity: 0, y: 50 },
        { opacity: 1, y: 0, duration: 1, stagger: 0.12, ease: 'power3.out', delay: 0.3 }
      )
    }

    // Scroll reveals
    const reveals = document.querySelectorAll('.reveal')
    reveals.forEach(el => {
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        onEnter: () => el.classList.add('in'),
      })
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
    'Mini-games built with AI-powered Game Builder',
    'Live progress dashboard for parents',
    'Circles shared with KinetikCircle',
  ]
  const HQ_FEATURES = [
    'Portfolio view across all your apps',
    'Growth analytics & engagement KPIs',
    'Broadcast engine — reach every circle at once',
    'Game Builder, App Builder & Learn Builder',
  ]

  return (
    <>
      {/* ── Nav ──────────────────────────────────────── */}
      <header className="nav">
        <a href="/" className="nav-logo">
          <div className="nav-mark">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="2.5"/>
              <circle cx="16" cy="8" r="2.5" fill="white"/>
              <circle cx="12" cy="12" r="1.5" fill="white"/>
            </svg>
          </div>
          Arganta
        </a>
        <ul className="nav-links">
          <li><a href="#kinetik">KinetikCircle</a></li>
          <li><a href="#lab">ArgantaLab</a></li>
          <li><a href="#hq">Circle HQ</a></li>
          <li><a href="#ecosystem">Ecosystem</a></li>
        </ul>
        <div className="nav-right">
          <button className="theme-btn" onClick={() => setDark(d => !d)} aria-label="Toggle theme">
            {dark ? <IconSun /> : <IconMoon />}
          </button>
          <a href="https://hq.arganta.app" target="_blank" rel="noopener" className="btn-nav">
            Try HQ <IconArrow />
          </a>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────── */}
      <section className="hero" ref={heroRef}>
        <div className="hero-canvas">
          <ThreeCanvas dark={dark} />
        </div>

        {/* Gradient vignette overlay */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: dark
            ? 'radial-gradient(ellipse at center, transparent 30%, rgba(9,9,11,0.7) 100%)'
            : 'radial-gradient(ellipse at center, transparent 30%, rgba(255,255,255,0.8) 100%)',
        }} />

        <div className="hero-content" ref={heroContentRef}>
          <div className="hero-badge">
            <span className="hero-badge-dot" />
            Three apps. One ecosystem.
          </div>
          <h1 className="hero-title">
            Build families.<br />
            <span className="grad">Build futures.</span>
          </h1>
          <p className="hero-sub">
            Arganta powers the apps where families connect,
            kids learn, and creators bring it all to life.
          </p>
          <div className="hero-ctas">
            <a href="#kinetik" className="btn-primary">
              Explore apps <IconArrow />
            </a>
            <a href="https://hq.arganta.app" target="_blank" rel="noopener" className="btn-secondary">
              Operator login
            </a>
          </div>
        </div>

        <div className="hero-scroll">
          <span>Scroll</span>
          <IconChevronDown />
        </div>
      </section>

      {/* ── Trust strip ───────────────────────────────── */}
      <div className="trust">
        {[
          { num: '3', label: 'Live apps' },
          { num: '∞', label: 'Family moments' },
          { num: '100%', label: 'Privacy-first' },
          { num: 'One', label: 'Connected ecosystem' },
        ].map(item => (
          <div key={item.label} className="trust-item">
            <span className="trust-num">{item.num}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── KinetikCircle ─────────────────────────────── */}
      <section className="section" id="kinetik" style={{ background: 'var(--bg)' }}>
        <div className="section-inner">
          <div>
            <div className="section-eyebrow reveal">
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'linear-gradient(135deg, #22d3ee, #06b6d4)',
                display: 'inline-block',
              }} />
              Family Social
            </div>
            <h2 className="section-title reveal reveal-d1">
              Your family's<br />private universe
            </h2>
            <p className="section-desc reveal reveal-d2">
              KinetikCircle is a private social app built exclusively for families.
              Share moments, stories, albums and routines — all within your circle,
              completely away from the noise of public social media.
            </p>
            <ul className="feature-list reveal reveal-d3">
              {KINETIK_FEATURES.map(f => (
                <li key={f}>
                  <span className="feat-dot" style={{ background: 'rgba(6,182,212,0.15)', color: '#0891b2' }}>
                    <IconCheck />
                  </span>
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

      {/* ── ArgantaLab ────────────────────────────────── */}
      <section className="section" id="lab" style={{ background: 'var(--bg2)' }}>
        <div className="section-inner rev">
          <div>
            <div className="section-eyebrow reveal" style={{ color: '#7c3aed' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7c3aed, #8b5cf6)',
                display: 'inline-block',
              }} />
              Kids Education
            </div>
            <h2 className="section-title reveal reveal-d1">
              Where kids<br />fall in love with<br />
              <span style={{ background: 'linear-gradient(135deg,#7c3aed,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>learning</span>
            </h2>
            <p className="section-desc reveal reveal-d2">
              ArgantaLab is a gamified learning super-app for kids — mastery-based
              lessons, AI-authored mini-games, diamond rewards, and family circles
              that keep parents in the loop.
            </p>
            <ul className="feature-list reveal reveal-d3">
              {LAB_FEATURES.map(f => (
                <li key={f}>
                  <span className="feat-dot" style={{ background: 'rgba(124,58,237,0.12)', color: '#7c3aed' }}>
                    <IconCheck />
                  </span>
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

      {/* ── Circle HQ ─────────────────────────────────── */}
      <section className="section" id="hq" style={{ background: 'var(--bg)' }}>
        <div className="section-inner">
          <div>
            <div className="section-eyebrow reveal" style={{ color: 'var(--tx2)' }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: 'var(--tx2)',
                display: 'inline-block',
              }} />
              Operator Platform
            </div>
            <h2 className="section-title reveal reveal-d1">
              The command center<br />for your ecosystem
            </h2>
            <p className="section-desc reveal reveal-d2">
              Circle HQ is the founder OS that sits above both apps.
              Manage content, track growth, broadcast to every circle,
              and build the next feature — all from one dashboard.
            </p>
            <ul className="feature-list reveal reveal-d3">
              {HQ_FEATURES.map(f => (
                <li key={f}>
                  <span className="feat-dot" style={{ background: 'var(--bg3)', color: 'var(--tx2)' }}>
                    <IconCheck />
                  </span>
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
            <div className="mockup-glow" style={{
              background: 'linear-gradient(135deg, #7c3aed, #0ea5e9)',
              opacity: 0.08,
            }} />
            <DashboardMockup />
          </div>
        </div>
      </section>

      {/* ── Ecosystem ─────────────────────────────────── */}
      <section className="ecosystem" id="ecosystem">
        <div className="ecosystem-inner">
          <div className="section-tag reveal">The Ecosystem</div>
          <h2 className="eco-title reveal reveal-d1">
            Three apps.<br />
            <span style={{
              background: 'var(--grd)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>One circle.</span>
          </h2>
          <p className="eco-sub reveal reveal-d2">
            Each app is powerful alone. Together they form a closed-loop ecosystem
            where family life, learning, and creation reinforce each other.
          </p>
          <div className="eco-grid">
            {[
              {
                icon: '🔵',
                bg: 'rgba(6,182,212,0.12)',
                color: '#0891b2',
                title: 'KinetikCircle',
                desc: 'Private family social — moments, stories, albums and routines shared within a closed circle.',
                tag: 'circle.arganta.app',
                tagColor: 'rgba(6,182,212,0.15)',
                tagText: '#0891b2',
                href: 'https://circle.arganta.app',
                delay: 0,
              },
              {
                icon: '🟣',
                bg: 'rgba(124,58,237,0.12)',
                color: '#7c3aed',
                title: 'ArgantaLab',
                desc: 'Kids learning super-app — gamified lessons, mini-games, diamond rewards and family circles.',
                tag: 'lab.arganta.app',
                tagColor: 'rgba(124,58,237,0.15)',
                tagText: '#7c3aed',
                href: 'https://lab.arganta.app',
                delay: 100,
              },
              {
                icon: '⚙️',
                bg: 'var(--bg3)',
                color: 'var(--tx2)',
                title: 'Circle HQ',
                desc: 'The operator OS — analytics, content management, broadcast engine and all the builders.',
                tag: 'hq.arganta.app',
                tagColor: 'var(--bg3)',
                tagText: 'var(--tx2)',
                href: 'https://hq.arganta.app',
                delay: 200,
              },
            ].map(card => (
              <a key={card.title} href={card.href} target="_blank" rel="noopener"
                className={`eco-card reveal`}
                style={{ textDecoration: 'none', transitionDelay: `${card.delay}ms` }}>
                <div className="eco-icon" style={{ background: card.bg }}>
                  <span style={{ fontSize: 22 }}>{card.icon}</span>
                </div>
                <div className="eco-card-title">{card.title}</div>
                <div className="eco-card-desc">{card.desc}</div>
                <span className="eco-tag" style={{ background: card.tagColor, color: card.tagText }}>
                  {card.tag}
                </span>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────── */}
      <section className="cta-section">
        <div className="cta-glow" />
        <div className="cta-inner">
          <div className="section-tag reveal" style={{ marginBottom: 24 }}>Get started</div>
          <h2 className="cta-title reveal reveal-d1">
            Ready to build<br />
            <span style={{
              background: 'var(--grd)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>your circle?</span>
          </h2>
          <p className="cta-sub reveal reveal-d2">
            Download KinetikCircle or ArgantaLab for your family,
            or sign in to Circle HQ to manage your ecosystem.
          </p>
          <div className="cta-btns reveal reveal-d3">
            <a href="https://circle.arganta.app" target="_blank" rel="noopener" className="btn-primary">
              KinetikCircle <IconArrow />
            </a>
            <a href="https://lab.arganta.app" target="_blank" rel="noopener" className="btn-primary"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a78bfa)' }}>
              ArgantaLab <IconArrow />
            </a>
            <a href="https://hq.arganta.app" target="_blank" rel="noopener" className="btn-secondary">
              Circle HQ →
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <a href="/" className="footer-logo">
              <div className="nav-mark">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="7" stroke="white" strokeWidth="2.5"/>
                  <circle cx="16" cy="8" r="2.5" fill="white"/>
                  <circle cx="12" cy="12" r="1.5" fill="white"/>
                </svg>
              </div>
              Arganta
            </a>
            <p className="footer-tagline">
              Building the apps where families connect, kids learn, and creators thrive.
            </p>
          </div>
          <div className="footer-cols">
            <div className="footer-col">
              <div className="footer-col-title">Apps</div>
              <ul>
                <li><a href="https://circle.arganta.app" target="_blank" rel="noopener">KinetikCircle</a></li>
                <li><a href="https://lab.arganta.app" target="_blank" rel="noopener">ArgantaLab</a></li>
                <li><a href="https://hq.arganta.app" target="_blank" rel="noopener">Circle HQ</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Download</div>
              <ul>
                <li><a href="https://circle.arganta.app">App Store (Circle)</a></li>
                <li><a href="https://lab.arganta.app">App Store (Lab)</a></li>
                <li><a href="https://circle.arganta.app">Google Play (Circle)</a></li>
                <li><a href="https://lab.arganta.app">Google Play (Lab)</a></li>
              </ul>
            </div>
            <div className="footer-col">
              <div className="footer-col-title">Company</div>
              <ul>
                <li><a href="/">About</a></li>
                <li><a href="/">Privacy Policy</a></li>
                <li><a href="/">Terms of Service</a></li>
                <li><a href="/">Contact</a></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© {new Date().getFullYear()} Arganta. All rights reserved.</span>
          <button
            className="theme-btn"
            onClick={() => setDark(d => !d)}
            aria-label="Toggle theme"
            style={{ border: '1px solid var(--border)' }}
          >
            {dark ? <IconSun /> : <IconMoon />}
          </button>
        </div>
      </footer>
    </>
  )
}
