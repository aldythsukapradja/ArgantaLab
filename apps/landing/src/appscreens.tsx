import Buddy from './components/Buddy'
import OrgChart from './components/OrgChart'
import { AGENTS } from './data/agents'

export type Tab = 'home' | 'products' | 'about' | 'pitch'
export type Launch = (deck: string, opt?: { present?: boolean; flight?: string }) => void

// ─────────────── HOME (fit-to-viewport) ───────────────
const PROOF = [
  ['2.5h', 'a day on screens'],
  ['124B', 'hours on Roblox'],
  ['50M+', 'daily Duolingo'],
  ['98M', 'families · Life360'],
]
export function Home({ onLaunch, onTab }: { onLaunch: Launch; onTab: (t: Tab) => void }) {
  return (
    <div className="scr scr-home">
      <div className="scr-hero">
        <div className="scr-hero-buddy"><Buddy mood="wave" size={112} /></div>
        <span className="scr-kick">Arganta</span>
        <h1 className="scr-h1">One trusted OS for<br /><em>the modern family.</em></h1>
        <p className="scr-lede">We turn the screen time families already spend into intelligence, connection and growth — inside circles you trust.</p>
        <div className="scr-cta">
          <button className="scr-btn primary" onClick={() => onLaunch('editorial', { present: true })}>▸ Watch the story</button>
          <button className="scr-btn" onClick={() => onTab('products')}>Explore products</button>
        </div>
      </div>
      <div className="scr-thesis"><span>Kids see play.</span><span className="g">Parents see growth.</span></div>
      <div className="scr-proof">{PROOF.map(([n, t]) => <div key={t} className="scr-proof-i"><b>{n}</b><span>{t}</span></div>)}</div>
    </div>
  )
}

// ─────────────── PRODUCTS (fit, each card → its presentation) ───────────────
const PRODUCTS = [
  { id: 'argantalab', name: 'ArgantaLab', color: '#8b5cf6', tag: 'Six-world learning', line: 'Learn, build, pitch & ship — parents see real growth.' },
  { id: 'kinetik', name: 'KinetikCircle', color: '#06b6d4', tag: 'The family OS', line: 'Routines, calendar, moments — the rhythm of family life.' },
  { id: 'circleapps', name: 'Circle Apps', color: '#10b981', tag: 'One platform, nine apps', line: 'Padel, kitchen, travel, vault — every task, one circle.' },
]
export function Products({ onLaunch }: { onLaunch: Launch }) {
  return (
    <div className="scr scr-products">
      <div className="scr-head"><span className="scr-kick">Products</span><h2 className="scr-h2">Three products, <em>one circle.</em></h2></div>
      <div className="prodlist">
        {PRODUCTS.map(p => (
          <button key={p.id} className="prodx" style={{ ['--wc' as string]: p.color }} onClick={() => onLaunch('general', { flight: p.id })}>
            <span className="prodx-dot" style={{ background: p.color }} />
            <div className="prodx-body">
              <span className="prodx-tag" style={{ color: p.color }}>{p.tag}</span>
              <h3 className="prodx-name">{p.name}</h3>
              <p className="prodx-line">{p.line}</p>
            </div>
            <span className="prodx-go" style={{ color: p.color }}>▸</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─────────────── ABOUT (founder + the agent team, fit) ───────────────
export function About() {
  return (
    <div className="scr scr-about">
      <div className="scr-head"><span className="scr-kick">About</span><h2 className="scr-h2">Built by a parent, <em>run by agents.</em></h2></div>
      <div className="about-founder">
        <span className="about-face"><Buddy mood="happy" size={68} /></span>
        <div className="about-founder-txt">
          <b>Aldyth Sukapradja</b>
          <span className="about-role">Founder</span>
          <p>Building the calm, ambitious version of childhood screen time I want for my own family. <span className="scr-note">(add photo + story)</span></p>
        </div>
      </div>
      <div className="about-team">
        <div className="about-team-head"><span className="scr-kick">The team</span><span className="about-team-count">1 human · {AGENTS.length} AI agents</span></div>
        <OrgChart />
      </div>
    </div>
  )
}
