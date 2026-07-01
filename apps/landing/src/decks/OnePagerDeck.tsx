import { AGENTS } from '../data/agents'
import { ThemeToggle } from '../theme'

// The investor one-pager — a scrollable, proof-first brief. Numbers marked
// "TBD" are placeholders for real figures.
function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2.3" />
      <circle cx="16" cy="8" r="2.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

const KPIS = [
  { v: '3', l: 'products live', tbd: false },
  { v: String(AGENTS.length), l: 'AI agents on staff', tbd: false },
  { v: 'TBD', l: 'pilot families', tbd: true },
  { v: 'TBD', l: 'weekly retention', tbd: true },
]
const PROOF = [
  ['124B', 'hours played on Roblox in 2025 — kids already live in digital worlds'],
  ['50M+', 'people learn on Duolingo every day — gamified habit works'],
  ['98M', 'families on Life360 — households already organize in circles'],
]
const MODEL = [
  ['Families', 'Subscription', 'One plan, the whole household — every product, one circle.'],
  ['Partners', 'Per seat', 'Tutors, clubs and schools deliver ArgantaLab to their students.'],
  ['Platform', 'Rev-share', 'Third-party makers build Circle Apps on the shared spine.'],
]

export default function OnePagerDeck({ onExit }: { onExit?: () => void }) {
  return (
    <div className="op">
      <header className="op-nav">
        <button className="op-back" onClick={onExit}>← Decks</button>
        <span className="op-brand"><Mark /> Arganta</span>
        <ThemeToggle />
      </header>

      <div className="op-page">
        <section className="op-hero">
          <span className="op-tag">Investor brief · Seed · 2026</span>
          <h1 className="op-title">Turning the screen time families already spend into <em>intelligence, connection and growth.</em></h1>
          <p className="op-lede">Arganta is one trusted operating system for the modern family — a six-world learning product, a family OS, and a suite of circle apps, run by a lean AI-agent company.</p>
        </section>

        <section className="op-kpis">
          {KPIS.map(k => <div key={k.l} className={`op-kpi${k.tbd ? ' tbd' : ''}`}><b>{k.v}</b><span>{k.l}</span></div>)}
        </section>

        <section className="op-grid">
          <article className="op-card op-span">
            <h3>The problem</h3>
            <p>Children spend 2.5+ hours a day on screens that entertain but build nothing. Parents get no visibility, no growth, no peace of mind. The attention is already there — it just isn't compounding into anything.</p>
          </article>

          <article className="op-card">
            <h3>Why now</h3>
            <ul className="op-proof">{PROOF.map(([n, t]) => <li key={n}><b>{n}</b><span>{t}</span></li>)}</ul>
          </article>

          <article className="op-card op-accent">
            <h3>The wedge</h3>
            <p>Don't fight the screen — <b>redirect it.</b> Route the hours kids already spend into a six-world learning journey, inside a circle parents trust. One playful product kids pull toward daily; one dashboard parents rely on.</p>
          </article>

          <article className="op-card">
            <h3>The product</h3>
            <p><b>ArgantaLab</b> — six worlds of learning, build-a-game, pitch & ship.<br /><b>KinetikCircle</b> — the family OS: rhythm, calendar, moments.<br /><b>Circle Apps</b> — nine task apps on one shared spine.</p>
          </article>

          <article className="op-card op-span">
            <h3>Business model & go-to-market</h3>
            <div className="op-model">{MODEL.map(([n, p, d]) => <div key={n} className="op-tier"><b>{n}</b><span className="op-price">{p}</span><small>{d}</small></div>)}</div>
          </article>

          <article className="op-card op-accent">
            <h3>The moat</h3>
            <p><b>An AI-first company.</b> One human founder orchestrating {AGENTS.length} specialist agents — product, growth, safety and content — so we ship like a big team and scale without headcount. Compounded by <b>circles</b>: every family that joins deepens the trusted network and the proprietary learning data.</p>
          </article>

          <article className="op-card">
            <h3>Traction</h3>
            <p className="op-tbd-line">Pilot families · weekly retention · lessons per child · earn/spend ratio — <b>figures to be supplied.</b></p>
          </article>

          <article className="op-card">
            <h3>Team</h3>
            <p>Founded by <b>Aldyth Sukapradja</b> — built by a parent, for parents. <span className="op-note">(founder bio + advisors to be added.)</span></p>
          </article>

          <article className="op-card op-ask">
            <h3>The ask</h3>
            <p>Raising a <b>seed round</b> to scale the agent workforce and reach the first 10,000 families.</p>
            <div className="op-ask-actions">
              <a className="op-btn primary" href="mailto:hello@arganta.app?subject=Investing%20in%20Arganta">Talk to us →</a>
              <a className="op-btn" href="https://lab.arganta.app" target="_blank" rel="noopener noreferrer">See the product</a>
            </div>
            <span className="op-note">Raise amount & use of funds — to be supplied.</span>
          </article>
        </section>

        <footer className="op-foot"><span>Arganta — one trusted OS for the modern family.</span><a href="mailto:hello@arganta.app">hello@arganta.app</a></footer>
      </div>
    </div>
  )
}
