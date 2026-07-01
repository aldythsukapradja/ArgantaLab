import Buddy from './components/Buddy'
import Ring from './components/Ring'
import KinSprite from './components/KinSprite'
import OrgChart from './components/OrgChart'
import { WORLDS, RING_LABELS } from './data/worlds'
import { AGENTS } from './data/agents'

export type Tab = 'home' | 'products' | 'company' | 'pitch'

// ─────────────── HOME ───────────────
const PROOF = [
  ['2.5h', 'a day on screens · under-8s'],
  ['124B', 'hours on Roblox, 2025'],
  ['50M+', 'daily Duolingo learners'],
  ['98M', 'families on Life360'],
]
export function Home({ onLaunch, onTab }: { onLaunch: (d: string, present: boolean) => void; onTab: (t: Tab) => void }) {
  return (
    <div className="scr scr-home">
      <div className="scr-hero">
        <div className="scr-hero-buddy"><Buddy mood="wave" size={128} /></div>
        <span className="scr-kick">Arganta</span>
        <h1 className="scr-h1">One trusted OS for<br /><em>the modern family.</em></h1>
        <p className="scr-lede">We turn the screen time families already spend into intelligence, connection and growth — inside circles you trust.</p>
        <div className="scr-cta">
          <button className="scr-btn primary" onClick={() => onLaunch('editorial', true)}>▸ Watch the story</button>
          <button className="scr-btn" onClick={() => onTab('products')}>Explore products</button>
        </div>
      </div>

      <div className="scr-thesis">
        <span>Kids see play.</span>
        <span className="g">Parents see growth.</span>
      </div>

      <div className="scr-proof">
        {PROOF.map(([n, t]) => <div key={t} className="scr-proof-i"><b>{n}</b><span>{t}</span></div>)}
      </div>

      <div className="scr-band">
        <h3>Built by parents. Designed for families everywhere.</h3>
        <a className="scr-btn primary" href="mailto:hello@arganta.app?subject=Waitlist">Join the waitlist →</a>
      </div>
    </div>
  )
}

// ─────────────── PRODUCTS ───────────────
const RING_PCT: Record<string, number> = { NUM: 80, WRD: 55, WON: 100, LOG: 35, WLD: 70, LIF: 45 }
function MiniOrbit() {
  return (
    <div className="mini-orbit">
      <span className="mini-orbit-buddy"><Buddy mood="happy" size={54} /></span>
      {WORLDS.map((w, i) => { const a = (-90 + i * 60) * Math.PI / 180; const x = 50 + 40 * Math.cos(a), y = 50 + 40 * Math.sin(a)
        return <span key={w.key} className="mini-orbit-node" style={{ left: `${x}%`, top: `${y}%` }}><Ring pct={RING_PCT[w.key]} color={w.color} size={30} /></span> })}
    </div>
  )
}
const PRODUCTS = [
  { id: 'argantalab', name: 'ArgantaLab', color: '#8b5cf6', tag: 'Six-world learning', pts: ['Six worlds of intelligence', 'Build, pitch & ship games', 'Parent-visible progress'] },
  { id: 'kinetik', name: 'KinetikCircle', color: '#06b6d4', tag: 'The family OS', pts: ['Today, calendar, moments', 'Energy-coded routines', 'One private circle'] },
  { id: 'circleapps', name: 'Circle Apps', color: '#10b981', tag: 'One platform, nine apps', pts: ['Padel · kitchen · travel · vault', 'Circle-aware by default', 'Add what you need'] },
]
export function Products({ onLaunch }: { onLaunch: (d: string, present: boolean) => void }) {
  return (
    <div className="scr">
      <div className="scr-head"><span className="scr-kick">Products</span><h2 className="scr-h2">Three products, <em>one circle.</em></h2></div>
      <div className="prodlist">
        {PRODUCTS.map(p => (
          <div key={p.id} className="prodx" style={{ ['--wc' as string]: p.color }}>
            <div className="prodx-top">
              <div>
                <span className="prodx-tag" style={{ color: p.color }}>{p.tag}</span>
                <h3 className="prodx-name">{p.name}</h3>
              </div>
              <span className="prodx-dot" style={{ background: p.color }} />
            </div>
            <ul className="prodx-pts">{p.pts.map(pt => <li key={pt}>{pt}</li>)}</ul>
            {p.id === 'argantalab' && <div className="prodx-preview"><MiniOrbit /></div>}
            {p.id === 'kinetik' && <div className="prodx-preview kin"><span className="prodx-kin">🎾 ⚽ 🍳 ✈️</span></div>}
            {p.id === 'circleapps' && <div className="prodx-preview apps"><span>🎾</span><span>🍳</span><span>✈️</span><span>🔐</span></div>}
            <button className="scr-btn primary sm" onClick={() => onLaunch('general', false)}>Take the tour →</button>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────── COMPANY ───────────────
const AGENT_STATS = [['1', 'human CEO'], [String(AGENTS.length), 'AI agents'], ['3', 'products run'], ['24/7', 'always on']]
export function Company() {
  return (
    <div className="scr">
      <div className="scr-head"><span className="scr-kick">The company</span><h2 className="scr-h2">A company run by <em>agents.</em></h2>
        <p className="scr-lede">Arganta runs lean by design — one human founder orchestrating a workforce of specialist AI agents, so we ship like a big team and scale without headcount.</p></div>
      <div className="scr-stats">{AGENT_STATS.map(([v, l]) => <div key={l} className="scr-stat"><b>{v}</b><span>{l}</span></div>)}</div>
      <div className="scr-org"><OrgChart /></div>
      <div className="scr-founder">
        <span className="scr-founder-face"><Buddy mood="happy" size={72} /></span>
        <div>
          <span className="scr-kick">The founder</span>
          <h3 className="scr-h3">Built by a parent, for parents.</h3>
          <p className="scr-lede sm">Aldyth Sukapradja — building the calm, ambitious version of childhood screen time. <span className="scr-note">(add photo + story)</span></p>
        </div>
      </div>
    </div>
  )
}

// ─────────────── PITCH ───────────────
const KPIS = [['3', 'products live', false], [String(AGENTS.length), 'AI agents', false], ['TBD', 'pilot families', true], ['TBD', 'wk retention', true]]
const WHYNOW = [['124B', 'hours on Roblox in 2025 — kids live in digital worlds'], ['50M+', 'daily Duolingo learners — gamified habit works'], ['98M', 'families on Life360 — households organize in circles']]
const MODEL = [['Families', 'Subscription', 'One plan, the whole household.'], ['Partners', 'Per seat', 'Tutors, clubs & schools.'], ['Platform', 'Rev-share', 'Third-party circle-app makers.']]
export function Pitch({ onLaunch }: { onLaunch: (d: string, present: boolean) => void }) {
  return (
    <div className="scr">
      <div className="scr-head"><span className="scr-kick">Investor pitch · Seed · 2026</span><h2 className="scr-h2">Turn screen time into <em>intelligence time.</em></h2>
        <p className="scr-lede">One trusted OS for the modern family — a six-world learning product, a family OS, and a suite of circle apps, run by a lean AI-agent company.</p></div>

      <div className="scr-kpis">{KPIS.map(([v, l, tbd]) => <div key={l as string} className={`scr-kpi${tbd ? ' tbd' : ''}`}><b>{v}</b><span>{l}</span></div>)}</div>

      <div className="pitchgrid">
        <article className="pcard"><h4>The problem</h4><p>Kids spend 2.5+ hours a day on screens that entertain but build nothing. Parents get no visibility. The attention is already there — it just isn't compounding.</p></article>
        <article className="pcard"><h4>Why now</h4><ul className="pproof">{WHYNOW.map(([n, t]) => <li key={n}><b>{n}</b><span>{t}</span></li>)}</ul></article>
        <article className="pcard accent"><h4>The wedge</h4><p>Don't fight the screen — <b>redirect it.</b> Route the hours kids already spend into a six-world journey inside a circle parents trust.</p></article>
        <article className="pcard"><h4>The product</h4><p><b>ArgantaLab</b> · six-world learning.<br /><b>KinetikCircle</b> · the family OS.<br /><b>Circle Apps</b> · nine task apps, one spine.</p></article>
        <article className="pcard"><h4>Business model</h4><div className="pmodel">{MODEL.map(([n, pr, d]) => <div key={n} className="ptier"><b>{n}</b><span>{pr}</span><small>{d}</small></div>)}</div></article>
        <article className="pcard accent"><h4>The moat</h4><p>An <b>AI-first company</b> ({AGENTS.length} agents, one founder) compounded by <b>circles</b> — every family deepens the trusted network and the learning data.</p></article>
        <article className="pcard"><h4>Traction</h4><p className="scr-note">Pilot families · retention · lessons/child — <b>figures to be supplied.</b></p></article>
        <article className="pcard"><h4>Team</h4><p>Founded by <b>Aldyth Sukapradja</b>. <span className="scr-note">(bio + advisors TBD)</span></p></article>
        <article className="pcard ask"><h4>The ask</h4><p>Raising a <b>seed round</b> to scale the agent workforce and reach the first 10,000 families.</p>
          <div className="scr-cta"><a className="scr-btn primary sm" href="mailto:hello@arganta.app?subject=Investing%20in%20Arganta">Talk to us →</a><button className="scr-btn sm" onClick={() => onLaunch('editorial', true)}>Watch the story</button></div>
          <span className="scr-note">Raise amount & use of funds — TBD.</span></article>
      </div>
    </div>
  )
}
