import { useEffect, useState } from 'react'
import Buddy from '../components/Buddy'
import Ring from '../components/Ring'
import KinSprite from '../components/KinSprite'
import { WORLDS, RING_LABELS } from '../data/worlds'
import { useIsActive } from './active'

// Scene box size on the virtual stage. Every scene is centred on its (x,y).
export const SCENE_W = 1180
export const SCENE_H = 780

// ── shared bits ───────────────────────────────────────────────
function Kicker({ children }: { children: React.ReactNode }) {
  return <div className="kicker reveal"><span className="kdot" />{children}</div>
}
function Grad({ children }: { children: React.ReactNode }) {
  return <em className="grad">{children}</em>
}

// A ring that fills from 0 → target once its scene is the active one.
function LiveRing({ id, pct, color, size = 64, showText }: { id: string; pct: number; color: string; size?: number; showText?: boolean }) {
  const active = useIsActive(id)
  const [v, setV] = useState(0)
  useEffect(() => {
    if (active) { const t = setTimeout(() => setV(pct), 380); return () => clearTimeout(t) }
    setV(0)
  }, [active, pct])
  return <Ring pct={v} color={color} size={size} showText={showText} />
}

// A bar that grows once active.
function LiveBar({ id, pct, color }: { id: string; pct: number; color: string }) {
  const active = useIsActive(id)
  return <div className="lbar"><i style={{ width: active ? `${pct}%` : 0, background: color }} /></div>
}

// ── 0 · HERO ──────────────────────────────────────────────────
function Hero() {
  const [mood, setMood] = useState<'wave' | 'happy'>('wave')
  useEffect(() => { const t = setInterval(() => setMood(m => (m === 'wave' ? 'happy' : 'wave')), 2600); return () => clearInterval(t) }, [])
  return (
    <div className="sc sc-hero">
      <div className="hero-buddy reveal"><Buddy mood={mood} size={210} /></div>
      <Kicker>ArgantaLab</Kicker>
      <h1 className="headline reveal">Kids are already<br />living inside <Grad>screens.</Grad></h1>
      <p className="lede reveal">The question isn't whether children spend time in digital worlds.<br />It's whether that time <b>builds them</b> — or just consumes them.</p>
      <div className="hero-hint reveal">Press <kbd>→</kbd> or scroll to take flight</div>
    </div>
  )
}

// ── 1 · THE PROBLEM ───────────────────────────────────────────
const PROOF = [
  { big: '2.5 hours', sub: 'a day on screens — children under 8', tone: '#22d3ee' },
  { big: '124 billion', sub: 'hours played on Roblox in 2025', tone: '#8b5cf6' },
  { big: '50 million+', sub: 'people learn on Duolingo every day', tone: '#10b981' },
  { big: '98 million', sub: 'families stay connected on Life360', tone: '#f59e0b' },
]
function Problem() {
  return (
    <div className="sc sc-split">
      <div className="sc-col">
        <Kicker>The problem</Kicker>
        <h2 className="headline sm reveal">Screen time is <Grad>winning.</Grad></h2>
        <p className="lede reveal">Games proved engagement. Learning apps proved daily habit. Family apps proved circles. The attention is <b>already there</b> — it's just not building anything.</p>
      </div>
      <div className="sc-col proof-grid">
        {PROOF.map(p => (
          <div key={p.sub} className="proof reveal" style={{ ['--tone' as string]: p.tone }}>
            <b>{p.big}</b><span>{p.sub}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 2 · THE ANSWER ────────────────────────────────────────────
function Answer() {
  return (
    <div className="sc sc-center">
      <div className="answer-mark reveal"><Buddy mood="celebrate" size={140} /></div>
      <Kicker>The product answer</Kicker>
      <h2 className="headline reveal">Turn screen time into<br /><Grad>intelligence time.</Grad></h2>
      <p className="lede wide reveal">ArgantaLab is one playful world where kids learn, quest, grow a companion, earn rewards, and compete safely — while parents see real growth. Six intelligences, one daily habit.</p>
      <div className="answer-chips reveal">
        {['Six worlds', 'A companion', 'Daily rings', 'Argons', 'Trusted circles', 'Parent view'].map(c => <span key={c} className="chip">{c}</span>)}
      </div>
    </div>
  )
}

// ── 3 · SIX WORLDS (real orbit, like PlayHome) ────────────────
const ORBIT_PCT: Record<string, number> = { NUM: 80, WRD: 55, WON: 100, LOG: 35, WLD: 70, LIF: 45 }
function SixWorlds() {
  return (
    <div className="sc sc-center">
      <Kicker>Six worlds, one journey</Kicker>
      <h2 className="headline sm reveal">Every kind of <Grad>intelligence.</Grad></h2>
      <div className="orbit reveal">
        <svg className="orbit-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {WORLDS.map((w, i) => {
            const a = (-90 + i * 60) * Math.PI / 180
            const x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a)
            return <line key={w.key} x1="50" y1="50" x2={x} y2={y} stroke={w.color} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.4" />
          })}
        </svg>
        <div className="orbit-buddy"><Buddy mood="happy" size={132} /></div>
        {WORLDS.map((w, i) => {
          const a = (-90 + i * 60) * Math.PI / 180
          const x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a)
          return (
            <div key={w.key} className="orbit-node" style={{ left: `${x}%`, top: `${y}%` }}>
              <span className="orbit-ring">
                <LiveRing id="worlds" pct={ORBIT_PCT[w.key]} color={w.color} size={70} />
                <span className="orbit-glyph" style={{ color: w.color }}>{w.icon}</span>
              </span>
              <span className="orbit-label">{RING_LABELS[w.key]}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 4 · DAILY RINGS ───────────────────────────────────────────
function Rings() {
  return (
    <div className="sc sc-split">
      <div className="sc-col">
        <Kicker>Daily rings</Kicker>
        <h2 className="headline sm reveal">Close your rings,<br />every <Grad>single day.</Grad></h2>
        <p className="lede reveal">Each world has a daily ring that fills as you play and resets at midnight. Six small wins a day — the habit loop that made fitness and language apps stick, pointed at real learning.</p>
        <div className="ring-legend reveal">🔥 streaks · ⭐ stars · 💎 Argons on every close</div>
      </div>
      <div className="sc-col ring-board reveal">
        {WORLDS.map(w => (
          <div key={w.key} className="ring-cell">
            <LiveRing id="rings" pct={ORBIT_PCT[w.key]} color={w.color} size={92} showText />
            <span style={{ color: w.color }}>{RING_LABELS[w.key]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 5 · THE JOURNEY (real Journey trail look) ─────────────────
const TRAIL = [
  { t: 'Counting', s: 'done', ic: '★' },
  { t: 'Add & Subtract', s: 'done', ic: '★' },
  { t: 'Number Chest', s: 'done', ic: '🎁', chest: true },
  { t: 'Times Tables', s: 'current', ic: '▶' },
  { t: 'Fractions', s: 'lock', ic: '🔒' },
  { t: 'Boss: Math Dragon', s: 'lock', ic: '🔥', boss: true },
]
function Journey() {
  return (
    <div className="sc sc-center jr-scene" style={{ ['--wc' as string]: '#f59e0b' }}>
      <Kicker>The journey · NumberDash</Kicker>
      <h2 className="headline sm reveal">A trail you walk <Grad>fresh each day.</Grad></h2>
      <div className="jr-trail reveal">
        {TRAIL.map((n, i) => (
          <div key={n.t} className={`jr-row ${i % 2 ? 'r' : 'l'}${n.s === 'current' ? ' current' : ''}`}>
            <span className={`jr-link${n.s === 'done' ? ' on' : ''}`} />
            <button className={`jr-node ${n.s}${n.boss ? ' boss' : ''}${n.chest ? ' chest' : ''}`}>{n.ic}</button>
            {n.s === 'current' && <span className="jr-here"><Buddy size={56} mood="happy" color="#f59e0b" /></span>}
            <span className="jr-label">{n.t}{n.boss && <em> · Boss</em>}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 6 · A LESSON (real item-player look) ──────────────────────
function Lesson() {
  const [pick, setPick] = useState<number | null>(null)
  return (
    <div className="sc sc-split">
      <div className="sc-col">
        <Kicker>A lesson, not a worksheet</Kicker>
        <h2 className="headline sm reveal">Eighteen ways to <Grad>think.</Grad></h2>
        <p className="lede reveal">Tap, type, match, sort, sequence, speak, drag a number line, label a diagram, write code. Every question is a tiny game with instant feedback — and a Buddy cheering you on.</p>
        <div className="lesson-types reveal">{['Tap', 'Type', 'Match', 'Sort', 'Sequence', 'Speak', 'Number line', 'Code'].map(t => <span key={t} className="chip sm">{t}</span>)}</div>
      </div>
      <div className="sc-col">
        <div className="lesson-card reveal">
          <div className="lesson-top"><span className="lesson-skill" style={{ background: '#f59e0b22', color: '#f59e0b' }}>Times Tables</span><Buddy size={48} mood={pick === 1 ? 'celebrate' : 'think'} color="#f59e0b" /></div>
          <p className="lesson-q">What is <b>7 × 6</b>?</p>
          <div className="lesson-choices">
            {['36', '42', '48', '40'].map((c, i) => (
              <button key={c} className={`lesson-choice${pick === i ? (i === 1 ? ' right' : ' wrong') : ''}`} onClick={() => setPick(i)}>{c}</button>
            ))}
          </div>
          <div className="lesson-rew"><span>+15 XP</span><span>+5 💎</span></div>
        </div>
      </div>
    </div>
  )
}

// ── 7 · OPENWORLD + KIN (Argantaland look) ────────────────────
const FIELD_KIN = [
  { r: 'countfox', c: '#f59e0b', x: 16, y: 30 },
  { r: 'letterowl', c: '#3b82f6', x: 70, y: 22 },
  { r: 'cloudcat', c: '#10b981', x: 80, y: 64 },
  { r: 'datadragon', c: '#8b5cf6', x: 30, y: 70 },
  { r: 'mapturtle', c: '#ef4444', x: 52, y: 46 },
]
function Openworld() {
  return (
    <div className="sc sc-split">
      <div className="sc-col">
        <Kicker>Openworld · ArgantaLand</Kicker>
        <h2 className="headline sm reveal">Explore. Befriend. <Grad>Collect.</Grad></h2>
        <p className="lede reveal">Walk a living map, meet wild <b>Kin</b>, and answer questions to befriend them. Every creature you win comes home to your Nexus. Learning becomes a world worth exploring.</p>
        <div className="ow-meta reveal">🗺️ Six maps · 🐾 dozens of Kin · 🤝 co-op with your circle</div>
      </div>
      <div className="sc-col">
        <div className="ow-field reveal">
          <div className="ow-grid" />
          {FIELD_KIN.map(k => (
            <span key={k.r} className="ow-kin" style={{ left: `${k.x}%`, top: `${k.y}%` }}><KinSprite render={k.r} color={k.c} size={70} bob /></span>
          ))}
          <span className="ow-hero"><Buddy size={64} mood="happy" /></span>
        </div>
      </div>
    </div>
  )
}

// ── 8 · NEXUS (habitats) ──────────────────────────────────────
const HABITAT_KIN: Record<string, string> = { NUM: 'countfox', WRD: 'letterowl', WON: 'galaxyfawn', LOG: 'datadragon', WLD: 'mapturtle', LIF: 'moodlamb' }
function Nexus() {
  return (
    <div className="sc sc-center">
      <Kicker>The Nexus</Kicker>
      <h2 className="headline sm reveal">A home that <Grad>grows with you.</Grad></h2>
      <p className="lede reveal">Befriended Kin live in habitats you build and upgrade. Your castle levels up as the collection grows — proof of everything learned, made tangible.</p>
      <div className="nexus-grid reveal">
        {WORLDS.map(w => (
          <div key={w.key} className="nexus-card" style={{ ['--wc' as string]: w.color }}>
            <span className="nexus-habitat">{w.habitatEmoji}</span>
            <KinSprite render={HABITAT_KIN[w.key]} color={w.color} size={62} />
            <b>{w.habitat}</b>
            <small style={{ color: w.color }}>{RING_LABELS[w.key]}</small>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 9 · ARGONS ────────────────────────────────────────────────
const LEDGER = [
  { t: 'Closed the Number ring', a: '+40', k: 'earn' },
  { t: 'Befriended a Count Fox', a: '+25', k: 'earn' },
  { t: '7-day streak bonus', a: '+50', k: 'earn' },
  { t: 'New hat for Buddy', a: '−60', k: 'spend' },
  { t: 'Skipped practice (parent rule)', a: '−15', k: 'cost' },
]
function Argons() {
  return (
    <div className="sc sc-split">
      <div className="sc-col">
        <Kicker>Argons</Kicker>
        <h2 className="headline sm reveal">An economy that<br /><Grad>rewards effort.</Grad></h2>
        <p className="lede reveal">Argons are earned by learning and spent on cosmetics for Buddy. Real choices, real consequences — and parents can set the rules behind the wallet.</p>
        <div className="argon-controls reveal">{['Daily caps', 'Spend approvals', 'Effort multipliers'].map(c => <span key={c} className="chip sm">{c}</span>)}</div>
      </div>
      <div className="sc-col">
        <div className="wallet reveal">
          <div className="wallet-top"><span>Argon balance</span><b>4,280 ✦</b></div>
          <div className="wallet-ledger">
            {LEDGER.map(l => (
              <div key={l.t} className={`wledger ${l.k}`}><span>{l.t}</span><b>{l.a}</b></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 10 · CIRCLES ──────────────────────────────────────────────
const BOARD = [
  { n: 'Kinara', xp: 1240, me: false },
  { n: 'You', xp: 1180, me: true },
  { n: 'Baginda', xp: 940, me: false },
  { n: 'Keyla', xp: 760, me: false },
]
function Circles() {
  return (
    <div className="sc sc-split">
      <div className="sc-col">
        <Kicker>Trusted circles</Kicker>
        <h2 className="headline sm reveal">Compete with people<br />you <Grad>actually know.</Grad></h2>
        <p className="lede reveal">No strangers, no open chat. Kids race their family and class circle on a weekly leaderboard — the safe, motivating kind of competition.</p>
      </div>
      <div className="sc-col">
        <div className="board reveal">
          <div className="board-head"><span>This week · Sukapradja Family</span><b>🏆</b></div>
          {BOARD.map((b, i) => (
            <div key={b.n} className={`board-row${b.me ? ' me' : ''}`}>
              <span className="board-rank">{i + 1}</span>
              <span className="board-name">{b.n}</span>
              <span className="board-xp">{b.xp.toLocaleString()} XP</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 11 · PARENT VIEW ──────────────────────────────────────────
const SKILLBARS = [
  { l: 'Number sense', p: 82, c: '#f59e0b' },
  { l: 'Reading', p: 64, c: '#3b82f6' },
  { l: 'Science', p: 91, c: '#10b981' },
  { l: 'Logic & code', p: 47, c: '#8b5cf6' },
]
function Parent() {
  return (
    <div className="sc sc-split">
      <div className="sc-col">
        <Kicker>Parent view</Kicker>
        <h2 className="headline sm reveal">They see play.<br />You see <Grad>progress.</Grad></h2>
        <p className="lede reveal">Behind the fun is a real dashboard: skills mastered, depth of thinking, gaps to close, daily rhythm. Know exactly how your child is growing.</p>
      </div>
      <div className="sc-col">
        <div className="dash reveal">
          <div className="dash-head"><b>Skill mastery</b><span>last 30 days</span></div>
          {SKILLBARS.map(s => (
            <div key={s.l} className="dash-row">
              <div className="dash-row-top"><span>{s.l}</span><b style={{ color: s.c }}>{s.p}%</b></div>
              <LiveBar id="parent" pct={s.p} color={s.c} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 12 · KINETIK ──────────────────────────────────────────────
const AGENDA = [
  { tm: '07:30', t: 'Morning routine', s: 'done' },
  { tm: '15:00', t: 'ArgantaLab — close 3 rings', s: 'done' },
  { tm: '17:00', t: 'Padel with the circle', s: 'now' },
  { tm: '19:30', t: 'Family dinner', s: 'next' },
  { tm: '20:30', t: 'Wind-down + reading', s: 'next' },
]
function Kinetik() {
  return (
    <div className="sc sc-split">
      <div className="sc-col">
        <Kicker>KinetikCircle</Kicker>
        <h2 className="headline sm reveal">The family's <Grad>operating system.</Grad></h2>
        <p className="lede reveal">ArgantaLab is one app in a family ecosystem. KinetikCircle runs the rhythm — routines, calendar, energy, moments — so learning lives inside real family life.</p>
      </div>
      <div className="sc-col">
        <div className="today reveal">
          <div className="today-head"><div><b>Good afternoon, Aldyth</b><small>Tuesday · 2 of 5 done</small></div><div className="today-ring"><LiveRing id="kinetik" pct={40} color="#22d3ee" size={54} showText /></div></div>
          {AGENDA.map(a => (
            <div key={a.t} className={`today-row ${a.s}`}>
              <span className="today-tm">{a.tm}</span>
              <span className="today-t">{a.t}</span>
              <span className="today-dot" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── 13 · AGENTIC ENGINE ───────────────────────────────────────
const AGENTS = [
  ['🎯', 'Tutor', 'picks the next best question'],
  ['🧭', 'Pathfinder', 'plots the daily journey'],
  ['🧠', 'Mastery', 'tracks depth, not just score'],
  ['🎨', 'Maker', 'turns ideas into lessons'],
  ['🛡️', 'Guardian', 'keeps it safe & age-right'],
  ['📊', 'Analyst', 'writes the parent report'],
]
function Agentic() {
  return (
    <div className="sc sc-center">
      <Kicker>The agentic engine</Kicker>
      <h2 className="headline sm reveal">Quietly intelligent, <Grad>underneath.</Grad></h2>
      <p className="lede reveal">A team of AI agents personalizes every child's path, generates fresh content, and writes for parents — so the experience adapts the moment a child does.</p>
      <div className="agent-grid reveal">
        {AGENTS.map(([ic, n, d]) => (
          <div key={n} className="agent-card"><span className="agent-ic">{ic}</span><b>{n}</b><small>{d}</small></div>
        ))}
      </div>
    </div>
  )
}

// ── 14 · SAFETY ───────────────────────────────────────────────
function Safety() {
  return (
    <div className="sc sc-center">
      <div className="shield reveal">
        <span className="shield-ring r1" /><span className="shield-ring r2" /><span className="shield-ring r3" />
        <span className="shield-core">🛡️</span>
      </div>
      <Kicker>Safe by design</Kicker>
      <h2 className="headline sm reveal">Built for kids. <Grad>Trusted by parents.</Grad></h2>
      <div className="trust-chips reveal">
        {['No open chat', 'No strangers', 'No ads', 'Circle-only', 'Age-tuned content', 'Parent controls', 'Privacy-first', 'Screen-time aware'].map(c => <span key={c} className="chip">{c}</span>)}
      </div>
    </div>
  )
}

// ── 15 · FINAL ────────────────────────────────────────────────
function Final() {
  return (
    <div className="sc sc-center final">
      <div className="final-split reveal">
        <div className="final-side"><span className="final-label">What kids see</span><div className="final-ic">🌍 🐾 ⭕ ✦ 🎉</div></div>
        <div className="final-side"><span className="final-label">What parents see</span><div className="final-ic">📊 🧠 📈 🎯 💡</div></div>
      </div>
      <div className="final-lines">
        <span className="line-kids reveal">Kids see play.</span>
        <span className="line-parents reveal">Parents see growth.</span>
      </div>
    </div>
  )
}

// ── 16 · CTA ──────────────────────────────────────────────────
function CTA() {
  return (
    <div className="sc sc-center">
      <div className="cta-mark reveal"><Buddy mood="wave" size={120} /></div>
      <h2 className="headline reveal">Make screen time<br /><Grad>count.</Grad></h2>
      <p className="lede reveal">ArgantaLab — the six-world intelligence product for families, tutors, clubs, and learning partners.</p>
      <div className="cta-actions reveal">
        <a className="btn-primary" href="https://lab.arganta.app" target="_blank" rel="noopener noreferrer">Explore ArgantaLab →</a>
        <a className="btn-secondary" href="mailto:hello@arganta.app?subject=Learning%20Partner">Become a Learning Partner</a>
      </div>
      <p className="cta-foot reveal">Built by parents. Designed for families everywhere.</p>
    </div>
  )
}

// ── constellation layout ──────────────────────────────────────
export interface Scene { id: string; title: string; x: number; y: number; node: React.ReactNode }
export const SCENES: Scene[] = [
  { id: 'hero',      title: 'Living inside screens', x: 0,     y: 0,     node: <Hero /> },
  { id: 'problem',   title: 'The problem',           x: 1700,  y: -420,  node: <Problem /> },
  { id: 'answer',    title: 'The answer',            x: 3300,  y: 260,   node: <Answer /> },
  { id: 'worlds',    title: 'Six worlds',            x: 4950,  y: -520,  node: <SixWorlds /> },
  { id: 'rings',     title: 'Daily rings',           x: 6550,  y: 180,   node: <Rings /> },
  { id: 'journey',   title: 'The journey',           x: 7900,  y: 1120,  node: <Journey /> },
  { id: 'lesson',    title: 'A lesson',              x: 9450,  y: 560,   node: <Lesson /> },
  { id: 'openworld', title: 'Openworld & Kin',       x: 11050, y: -240,  node: <Openworld /> },
  { id: 'nexus',     title: 'The Nexus',             x: 12550, y: 380,   node: <Nexus /> },
  { id: 'argons',    title: 'Argons',                x: 14100, y: -460,  node: <Argons /> },
  { id: 'circles',   title: 'Trusted circles',       x: 15600, y: 200,   node: <Circles /> },
  { id: 'parent',    title: 'Parent view',           x: 17150, y: -380,  node: <Parent /> },
  { id: 'kinetik',   title: 'KinetikCircle',         x: 18650, y: 380,   node: <Kinetik /> },
  { id: 'agentic',   title: 'Agentic engine',        x: 20150, y: -300,  node: <Agentic /> },
  { id: 'safety',    title: 'Safe by design',        x: 21600, y: 420,   node: <Safety /> },
  { id: 'final',     title: 'Kids play, parents grow', x: 23100, y: -120, node: <Final /> },
  { id: 'cta',       title: 'Take flight',           x: 24600, y: 300,   node: <CTA /> },
]
