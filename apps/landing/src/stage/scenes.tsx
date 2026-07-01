import { useEffect, useState } from 'react'
import Buddy from '../components/Buddy'
import Ring from '../components/Ring'
import KinSprite from '../components/KinSprite'
import AvatarSprite from '../components/AvatarSprite'
import MountSprite from '../components/MountSprite'
import { WORLDS, RING_LABELS } from '../data/worlds'
import { TOWN_KIN, TOWN_HABITATS, SHOP_COSMETICS, SHOP_MOUNTS } from '../data/kinworld'
import { PIPELINE } from '../data/agents'
import OrgChart from '../components/OrgChart'
import { useIsActive } from './active'

export const SCENE_W = 1180
export const SCENE_H = 780

// ── shared bits ───────────────────────────────────────────────
export function Kicker({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <div className="kicker reveal" style={tone ? { color: tone } : undefined}><span className="kdot" style={tone ? { background: tone } : undefined} />{children}</div>
}
export function Grad({ children }: { children: React.ReactNode }) { return <em className="grad">{children}</em> }
function Chips({ items, sm }: { items: string[]; sm?: boolean }) {
  return <div className="chips reveal">{items.map(c => <span key={c} className={`chip${sm ? ' sm' : ''}`}>{c}</span>)}</div>
}
function Split({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return <div className="sc sc-split"><div className="sc-col">{left}</div><div className="sc-col sc-stage">{right}</div></div>
}
function Center({ children }: { children: React.ReactNode }) { return <div className="sc sc-center">{children}</div> }

function LiveRing({ id, pct, color, size = 64, showText }: { id: string; pct: number; color: string; size?: number; showText?: boolean }) {
  const active = useIsActive(id)
  const [v, setV] = useState(0)
  useEffect(() => { if (active) { const t = setTimeout(() => setV(pct), 380); return () => clearTimeout(t) } setV(0) }, [active, pct])
  return <Ring pct={v} color={color} size={size} showText={showText} />
}
function LiveBar({ id, pct, color }: { id: string; pct: number; color: string }) {
  const active = useIsActive(id)
  return <div className="lbar"><i style={{ width: active ? `${pct}%` : 0, background: color }} /></div>
}
const ORBIT_PCT: Record<string, number> = { NUM: 80, WRD: 55, WON: 100, LOG: 35, WLD: 70, LIF: 45 }

// ════════════════════════ HUB ════════════════════════
export function Hub({ onPick }: { onPick: (id: string) => void }) {
  return (
    <Center>
      <div className="hub-mark reveal"><Buddy mood="wave" size={120} /></div>
      <Kicker>the arganta cosmos</Kicker>
      <h1 className="headline reveal">One trusted OS for the<br /><Grad>modern family.</Grad></h1>
      <p className="lede wide reveal">Fly in. Pick a path.</p>
      <div className="gateways reveal">
        <button className="gateway on" onClick={() => onPick('products')}>
          <span className="gw-ic">▸</span><b>Products</b><small>Take the tour — three apps, one world</small><span className="gw-badge">start here</span>
        </button>
        <button className="gateway" onClick={() => onPick('company')}>
          <span className="gw-ic">◆</span><b>Company</b><small>The thesis — an AI-first family OS</small>
        </button>
        <button className="gateway" onClick={() => onPick('vision')}>
          <span className="gw-ic">✦</span><b>Vision</b><small>Where it goes — the five-year flight</small>
        </button>
      </div>
    </Center>
  )
}

// ════════════════════════ SUB-HUB (products) ════════════════════════
const PRODUCTS = [
  { id: 'argantalab', name: 'ArgantaLab', color: '#8b5cf6', tag: 'Six-world learning', line: 'Kids learn, build, pitch and ship — parents see real growth.' },
  { id: 'kinetik', name: 'KinetikCircle', color: '#06b6d4', tag: 'The family OS', line: 'Routines, calendar, moments — the rhythm of family life.' },
  { id: 'circleapps', name: 'Circle Apps', color: '#10b981', tag: 'One platform, nine apps', line: 'Padel, kitchen, travel, vault — every task, one circle.' },
]
export function SubHub({ onPick }: { onPick: (id: string) => void }) {
  return (
    <Center>
      <Kicker>products</Kicker>
      <h2 className="headline sm reveal">Pick a world to <Grad>fly into.</Grad></h2>
      <div className="prodcards reveal">
        {PRODUCTS.map(p => (
          <button key={p.id} className="prodcard" style={{ ['--wc' as string]: p.color }} onClick={() => onPick(p.id)}>
            <span className="prod-dot" style={{ background: p.color }} />
            <b>{p.name}</b>
            <span className="prod-tag" style={{ color: p.color }}>{p.tag}</span>
            <small>{p.line}</small>
            <span className="prod-go">Enter ▸</span>
          </button>
        ))}
      </div>
    </Center>
  )
}

// ════════════════════════ ARGANTALAB FLIGHT ════════════════════════
export function ALDive() {
  return (
    <Center>
      <div className="dive-art reveal">
        <div className="dive-islands">
          {WORLDS.map((w, i) => <span key={w.key} className="dive-island" style={{ ['--wc' as string]: w.color, left: `${12 + i * 15}%`, top: `${20 + (i % 3) * 26}%` }}>{w.emoji}</span>)}
        </div>
        <div className="dive-buddy"><Buddy mood="happy" size={120} /></div>
      </div>
      <Kicker tone="#8b5cf6">ArgantaLab</Kicker>
      <h2 className="headline reveal">Every screen is a doorway.<br /><Grad>This one opens a world.</Grad></h2>
      <p className="lede wide reveal">Drop through the clouds into KinWorld — six worlds of intelligence, one daily adventure.</p>
    </Center>
  )
}

const OUTFIT = { hat: { render: 'crown', color: '#f59e0b' }, face: { render: 'shades', color: '#1e293b' }, back: { render: 'cape', color: '#8b5cf6' } }
export function ALIdentity() {
  return (
    <Split
      left={<>
        <Kicker tone="#8b5cf6">Your companion</Kicker>
        <h2 className="headline sm reveal">Meet <Grad>Buddy.</Grad></h2>
        <p className="lede reveal">One character that lives everywhere — dress it, grow it, ride a mount. Kids form a real attachment, and that's what brings them back every day.</p>
        <Chips items={['Skins', 'Hats', 'Faces', 'Capes', 'Mounts', 'Backgrounds']} sm />
      </>}
      right={<div className="identity reveal">
        <div className="identity-buddy"><Buddy mood="happy" size={150} outfit={OUTFIT} /></div>
        <div className="identity-mount"><MountSprite render="sandstrider" color="#f59e0b" size={120} /></div>
      </div>}
    />
  )
}

export function ALWorlds() {
  return (
    <Center>
      <Kicker tone="#8b5cf6">Six worlds, one journey</Kicker>
      <h2 className="headline sm reveal">Every kind of <Grad>intelligence.</Grad></h2>
      <div className="orbit reveal">
        <svg className="orbit-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          {WORLDS.map((w, i) => { const a = (-90 + i * 60) * Math.PI / 180; return <line key={w.key} x1="50" y1="50" x2={50 + 38 * Math.cos(a)} y2={50 + 38 * Math.sin(a)} stroke={w.color} strokeWidth="0.4" strokeDasharray="2 2" opacity="0.4" /> })}
        </svg>
        <div className="orbit-buddy"><Buddy mood="happy" size={120} /></div>
        {WORLDS.map((w, i) => { const a = (-90 + i * 60) * Math.PI / 180; const x = 50 + 38 * Math.cos(a), y = 50 + 38 * Math.sin(a)
          return <div key={w.key} className="orbit-node" style={{ left: `${x}%`, top: `${y}%` }}>
            <span className="orbit-ring"><LiveRing id="al-worlds" pct={ORBIT_PCT[w.key]} color={w.color} size={68} /><span className="orbit-glyph" style={{ color: w.color }}>{w.icon}</span></span>
            <span className="orbit-label">{RING_LABELS[w.key]}</span>
          </div> })}
      </div>
    </Center>
  )
}

const TRAIL = [
  { t: 'Counting', s: 'done', ic: '★' }, { t: 'Add & Subtract', s: 'done', ic: '★' },
  { t: 'Number Chest', s: 'done', ic: '🎁', chest: true }, { t: 'Times Tables', s: 'current', ic: '▶' },
  { t: 'Fractions', s: 'lock', ic: '🔒' }, { t: 'Boss: Math Dragon', s: 'lock', ic: '🔥', boss: true },
]
export function ALJourney() {
  return (
    <div className="sc sc-center jr-scene" style={{ ['--wc' as string]: '#f59e0b' }}>
      <Kicker tone="#f59e0b">The journey · NumberDash</Kicker>
      <h2 className="headline sm reveal">A trail you walk <Grad>fresh each day.</Grad></h2>
      <div className="jr-trail reveal">
        {TRAIL.map((n, i) => (
          <div key={n.t} className={`jr-row ${i % 2 ? 'r' : 'l'}${n.s === 'current' ? ' current' : ''}`}>
            <span className={`jr-link${n.s === 'done' ? ' on' : ''}`} />
            <button className={`jr-node ${n.s}${n.boss ? ' boss' : ''}${n.chest ? ' chest' : ''}`}>{n.ic}</button>
            {n.s === 'current' && <span className="jr-here"><Buddy size={54} mood="happy" color="#f59e0b" /></span>}
            <span className="jr-label">{n.t}{n.boss && <em> · Boss</em>}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ALLesson() {
  const [pick, setPick] = useState<number | null>(null)
  return (
    <Split
      left={<>
        <Kicker tone="#f59e0b">A lesson, not a worksheet</Kicker>
        <h2 className="headline sm reveal">Eighteen ways to <Grad>think.</Grad></h2>
        <p className="lede reveal">Tap, type, match, sort, sequence, speak, drag a number line, write code. Every question is a tiny game with instant feedback — and Buddy cheering you on.</p>
        <div className="ring-inline reveal"><LiveRing id="al-lesson" pct={100} color="#f59e0b" size={66} showText /><span>close the daily ring</span></div>
      </>}
      right={<div className="lesson-card reveal">
        <div className="lesson-top"><span className="lesson-skill" style={{ background: '#f59e0b22', color: '#b45309' }}>Times Tables</span><Buddy size={46} mood={pick === 1 ? 'celebrate' : 'think'} color="#f59e0b" /></div>
        <p className="lesson-q">What is <b>7 × 6</b>?</p>
        <div className="lesson-choices">{['36', '42', '48', '40'].map((c, i) => <button key={c} className={`lesson-choice${pick === i ? (i === 1 ? ' right' : ' wrong') : ''}`} onClick={() => setPick(i)}>{c}</button>)}</div>
        <div className="lesson-rew"><span>+15 XP</span><span>+5 ✦</span></div>
      </div>}
    />
  )
}

const FIELD_KIN = [
  { r: 'countfox', c: '#f59e0b', x: 18, y: 28 }, { r: 'letterowl', c: '#3b82f6', x: 72, y: 22 },
  { r: 'cloudcat', c: '#10b981', x: 80, y: 66 }, { r: 'datadragon', c: '#8b5cf6', x: 28, y: 70 },
  { r: 'mapturtle', c: '#ef4444', x: 52, y: 48 },
]
export function ALKin() {
  return (
    <Split
      left={<>
        <Kicker tone="#10b981">Openworld · ArgantaLand</Kicker>
        <h2 className="headline sm reveal">Explore. Befriend. <Grad>Collect.</Grad></h2>
        <p className="lede reveal">Walk a living map, meet wild Kin, answer to befriend them. Every creature comes home to your KinTown — a kingdom that grows with everything learned.</p>
        <Chips items={['Six maps', 'Dozens of Kin', 'Co-op with your circle', 'A growing castle']} sm />
      </>}
      right={<div className="ow-field reveal">
        <div className="ow-grid" />
        {FIELD_KIN.map(k => <span key={k.r} className="ow-kin" style={{ left: `${k.x}%`, top: `${k.y}%` }}><KinSprite render={k.r} color={k.c} size={66} bob /></span>)}
        <span className="ow-hero"><AvatarSprite mount="sandstrider" size={92} /></span>
      </div>}
    />
  )
}

// KinWorld — the living town basemap. Befriended Kin wander the roads around a
// central castle where the player rides; the town is built from the six habitats.
export function ALKinTown() {
  return (
    <Center>
      <Kicker tone="#10b981">KinWorld · the living town</Kicker>
      <h2 className="headline sm reveal">A kingdom that <Grad>grows with you.</Grad></h2>
      <div className="kw-map reveal">
        <div className="kw-grass" />
        <div className="kw-road kw-road-h" />
        <div className="kw-road kw-road-v" />
        <div className="kw-ring" />
        {TOWN_HABITATS.map(h => (
          <span key={h.name} className="kw-habitat" style={{ left: `${h.x}%`, top: `${h.y}%`, ['--wc' as string]: h.color }} title={h.name}>{h.emoji}</span>
        ))}
        <div className="kw-castle">
          <span className="kw-castle-ic">🏰</span>
          <span className="kw-rider"><AvatarSprite mount="sandstrider" size={70} mood="happy" /></span>
        </div>
        {TOWN_KIN.map(k => (
          <span key={k.name} className="kw-kin" title={k.name}
            style={{ left: `${k.x}%`, top: `${k.y}%`, ['--dx' as string]: `${k.dx}px`, ['--dy' as string]: `${k.dy}px`, animationDuration: `${k.dur}s` }}>
            <KinSprite render={k.render} color={k.color} size={48} bob />
          </span>
        ))}
      </div>
      <p className="lede reveal">Every Kin you befriend comes home to roam the town — living proof of everything learned.</p>
    </Center>
  )
}

function ShopBuddy({ slot, render, color }: { slot: string; render: string; color: string }) {
  return <Buddy size={66} mood="idle" bob={false} outfit={{ [slot]: { render, color } } as never} />
}
export function ALShop() {
  return (
    <Split
      left={<>
        <Kicker tone="#f59e0b">The Shop</Kicker>
        <h2 className="headline sm reveal">Spend Argons on<br /><Grad>a look that's theirs.</Grad></h2>
        <p className="lede reveal">Earned by learning, spent on cosmetics and mounts. Real choices, real motivation — and parents set the rules behind the wallet.</p>
        <div className="shop-mounts reveal">{SHOP_MOUNTS.map(m => (
          <div key={m.name} className="shop-mount"><MountSprite render={m.render} color={m.color} size={64} /><span className="shop-price">{m.price} ✦</span></div>
        ))}</div>
      </>}
      right={<div className="shop-grid reveal">{SHOP_COSMETICS.map(c => (
        <div key={c.name} className="shop-card" style={{ ['--wc' as string]: c.color }}>
          <span className="shop-thumb"><ShopBuddy slot={c.slot} render={c.render} color={c.color} /></span>
          <b>{c.name}</b>
          <span className="shop-price" style={{ color: c.color }}>{c.price} ✦</span>
        </div>
      ))}</div>}
    />
  )
}

const GAME_STEPS = ['Type', 'World', 'Character', 'Play']
export function ALBuild() {
  const [step, setStep] = useState(3)
  return (
    <Split
      left={<>
        <Kicker tone="#8b5cf6">Create · learn to code</Kicker>
        <h2 className="headline sm reveal">They don't just play games.<br /><Grad>They build them.</Grad></h2>
        <p className="lede reveal">A guided builder turns an idea into a real, playable game in minutes — then a pro mode to drop in their own code. From idea to playable, kids learn how software is made.</p>
        <div className="step-rail reveal">{GAME_STEPS.map((s, i) => <button key={s} className={`step${i <= step ? ' on' : ''}`} onClick={() => setStep(i)}>{i + 1}. {s}</button>)}</div>
      </>}
      right={<div className="device reveal">
        <div className="device-bar"><span /><span /><span /></div>
        <div className="device-screen game">
          <div className="game-sky" />
          <span className="game-player"><Buddy size={54} mood="happy" /></span>
          <span className="game-coin" style={{ left: '64%' }}>✦</span>
          <span className="game-coin" style={{ left: '80%', top: '40%' }}>✦</span>
          <div className="game-hud">SCORE 1200 · ▶ playable</div>
        </div>
      </div>}
    />
  )
}

export function ALPrompt() {
  return (
    <Split
      left={<>
        <Kicker tone="#06b6d4">Prompt engineering</Kicker>
        <h2 className="headline sm reveal">Learn to think <Grad>with AI.</Grad></h2>
        <p className="lede reveal">Inside the Neural Forge, kids learn the real skill of the next decade — how to ask, refine, and direct an AI. Clear instructions in, better results out.</p>
        <Chips items={['Be specific', 'Give examples', 'Set the role', 'Iterate']} sm />
      </>}
      right={<div className="forge reveal">
        <div className="forge-row me"><span className="forge-tag">child</span><p>"make a poster for my lemonade stand"</p></div>
        <div className="forge-row me up"><span className="forge-tag">refined</span><p>"Design a bright poster for a kids' lemonade stand. Big title, price $1, sun and lemons, happy colors."</p></div>
        <div className="forge-row ai"><span className="forge-tag">AI</span><p>✦ A clear, colorful poster — first try.</p></div>
      </div>}
    />
  )
}

const PITCH = { emoji: '🚀', label: 'The pitch', text: '"LemonadeDash — race to make the most lemonade before the sun sets!"' }
export function ALPitch() {
  return (
    <Center>
      <Kicker tone="#ef4444">Pitch the product</Kicker>
      <h2 className="headline sm reveal">Then they stand up and <Grad>sell it.</Grad></h2>
      <div className="pitch-slide reveal">
        <span className="pitch-emoji">{PITCH.emoji}</span>
        <span className="pitch-label">{PITCH.label}</span>
        <p className="pitch-text">{PITCH.text}</p>
        <div className="pitch-dots">{['title', 'idea', 'play', 'best', 'learned', 'cta'].map((s, i) => <span key={s} className={`pd${i === 2 ? ' on' : ''}`} />)}</div>
      </div>
      <p className="lede reveal">A cinematic pitch builder teaches kids to tell a story, own a stage, and present with confidence.</p>
    </Center>
  )
}

export function ALShip() {
  return (
    <Split
      left={<>
        <Kicker tone="#10b981">Ship it</Kicker>
        <h2 className="headline sm reveal">Built. Pitched. <Grad>Published.</Grad></h2>
        <p className="lede reveal">One tap publishes their game to the Library for their circle to play. Real makers ship — and seeing friends play what you built is the best reward there is.</p>
        <Chips items={['Publish to Library', 'Share with the circle', 'Track plays']} sm />
      </>}
      right={<div className="store reveal">
        {[['LemonadeDash', '#f59e0b', '🍋', 42], ['SpaceMath', '#8b5cf6', '🚀', 31], ['WordRunner', '#3b82f6', '📖', 28], ['KinQuest', '#10b981', '🐾', 19]].map(([t, c, e, p]) => (
          <div key={t as string} className="store-card" style={{ ['--wc' as string]: c as string }}>
            <span className="store-thumb">{e}</span><b>{t}</b><small>{p} plays</small>
          </div>
        ))}
      </div>}
    />
  )
}

const SKILLBARS = [
  { l: 'Number sense', p: 82, c: '#f59e0b' }, { l: 'Reading', p: 64, c: '#3b82f6' },
  { l: 'Science', p: 91, c: '#10b981' }, { l: 'Logic & code', p: 47, c: '#8b5cf6' },
]
export function ALParent() {
  return (
    <Split
      left={<>
        <Kicker tone="#8b5cf6">Parent view</Kicker>
        <h2 className="headline sm reveal">They see play.<br />You see <Grad>progress.</Grad></h2>
        <p className="lede reveal">A daily pulse and a deep report: skills mastered, depth of thinking, gaps to close, time on task. Know exactly how your child is growing — every single day.</p>
        <Chips items={['Daily pulse', 'Skill mastery', 'Bloom depth', 'Gaps to close']} sm />
      </>}
      right={<div className="dash reveal">
        <div className="dash-kpis">{[['7', 'day streak'], ['41m', 'today'], ['6/6', 'rings']].map(([v, l]) => <div key={l} className="dash-kpi"><b>{v}</b><span>{l}</span></div>)}</div>
        {SKILLBARS.map(s => <div key={s.l} className="dash-row"><div className="dash-row-top"><span>{s.l}</span><b style={{ color: s.c }}>{s.p}%</b></div><LiveBar id="al-parent" pct={s.p} color={s.c} /></div>)}
      </div>}
    />
  )
}

// ════════════════════════ KINETIK FLIGHT ════════════════════════
// Faithful recreations of the real KinetikCircle pages (Today / Calendar / Moments)
// — same energy palette + member colours as apps/kinetik.
const EN = { care: '#F2738C', mind: '#48A7EA', growth: '#27B79A', memory: '#8E7BEA', play: '#ECA13A', calm: '#7C89C4' }
const KM: Record<string, { n: string; i: string; c: string }> = {
  kinara: { n: 'Kinara', i: 'K', c: '#0EA5E9' },
  abdil: { n: 'Abdildasigma', i: 'AB', c: '#6366F1' },
  keyla: { n: 'Keyla', i: 'KE', c: '#F59E0B' },
  aldyth: { n: 'Aldyth', i: 'AL', c: '#8B5CF6' },
}
function Av({ id, sm }: { id: string; sm?: boolean }) {
  const m = KM[id]
  return <span className={`kt-av${sm ? ' sm' : ''}`} style={{ background: m.c }}>{m.i}</span>
}

const TODAY_FLOW = [
  { tm: '3am', t: 'Ngaji', who: 'keyla', e: 'growth', done: true },
  { tm: '9am', t: 'MAth Miss Rani', who: 'keyla', e: 'growth', done: true, clash: true },
  { tm: '9am', t: 'ArgantaLAB', who: 'abdil', e: 'calm', done: true },
  { tm: '9am', t: 'ArgantaLAB', who: 'keyla', e: 'calm', done: true, clash: true },
  { tm: '12:30pm', t: 'Car wash 2 car', who: 'kinara', e: 'mind', done: true },
  { tm: '2:30pm', t: 'Gitar', who: 'abdil', e: 'growth', done: true },
]
const TOMORROW = [{ tm: '9am', t: 'Ngaji', e: 'growth' }, { tm: '9am', t: 'Olah Raga', e: 'calm' }, { tm: '10am', t: 'ArgantaLAB', e: 'calm' }]
export function KToday() {
  return (
    <Split
      left={<>
        <Kicker tone="#06b6d4">KinetikCircle · Today</Kicker>
        <h2 className="headline sm reveal">The rhythm of <Grad>family life.</Grad></h2>
        <p className="lede reveal">One calm view of the day — routines, plans and energy for the whole circle, colour-coded by what kind of time it is. Learning lives inside real life, not beside it.</p>
      </>}
      right={<div className="kt-screen reveal">
        <div className="kt-hero">
          <div className="kt-hero-txt">
            <span className="kt-eyebrow">TUESDAY, JUNE 30</span>
            <b className="kt-greet">Good evening, Aldyth</b>
            <span className="kt-sub">All 7 done — beautiful work. 2 clashed.</span>
          </div>
          <div className="kt-ring">
            <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" className="kt-ring-t" /><circle cx="40" cy="40" r="34" className="kt-ring-b" transform="rotate(-90 40 40)" /></svg>
            <span className="kt-ring-c"><b>7</b><i>of 7</i></span>
          </div>
        </div>
        <div className="kt-allset">
          <span className="kt-check"><svg viewBox="0 0 56 56"><circle cx="28" cy="28" r="25" /><path d="M17 29l7.5 7.5L40 20" /></svg></span>
          <b>You're all set</b><span>All 7 plans done. Enjoy the rest of your day.</span>
        </div>
        <div className="kt-tmrw">
          <div className="kt-tmrw-head"><span className="kt-tmrw-lbl">TOMORROW</span><span className="kt-tmrw-pill">7 plans</span></div>
          {TOMORROW.map(t => <div key={t.t} className="kt-tmrw-it"><span className="kt-t">{t.tm}</span><span className="kt-dot" style={{ background: EN[t.e as keyof typeof EN] }} /><span className="kt-ti">{t.t}</span></div>)}
          <span className="kt-more">+4 more</span>
        </div>
        <div className="kt-flowlbl">TODAY'S FLOW</div>
        <div className="kt-flow">
          {TODAY_FLOW.map((a, i) => (
            <div key={i} className="kt-ev">
              <span className="kt-t">{a.tm}</span>
              <span className="kt-node" style={{ background: EN[a.e as keyof typeof EN] }}>{a.done && '✓'}</span>
              <span className="kt-ev-b"><b>{a.t}</b><Av id={a.who} sm /></span>
              {a.clash && <span className="kt-clash">CLASH</span>}
            </div>
          ))}
        </div>
      </div>}
    />
  )
}

const BOARD = [
  { d: 'MON', n: 6, ev: { abdil: [['Ngaji', '9am', 'growth'], ['ArgantaLAB', '10:30am', 'calm']], keyla: [['Olah Raga', '8:30am', 'calm'], ['ArgantaLAB', '9am', 'calm'], ['Math Miss Risa', '2pm', 'growth']] } },
  { d: 'TUE', n: 7, ev: { abdil: [['ArgantaLAB', '9am', 'calm'], ['Gitar', '2:30pm', 'growth']], keyla: [['Ngaji', '3am', 'growth'], ['ArgantaLAB', '9am', 'calm'], ['Gymnastic', '4pm', 'play']] } },
  { d: 'WED', n: 8, ev: { abdil: [['Ngaji', '9am', 'growth'], ['ArgantaLAB', '10:30am', 'calm']], keyla: [['Olah Raga', '9am', 'calm'], ['English Miss', '3pm', 'growth'], ['Gymnastic', '4pm', 'play']] } },
]
const MONTH_CHIPS = ['8:30a Olah', '9a Ngaji', '9a Argant']
function monthCells() {
  const cells: { day: number | null; today?: boolean }[] = []
  for (let i = 0; i < 6; i++) cells.push({ day: null }) // June 2026 starts Mon → 1 blank from Sun
  for (let d = 1; d <= 30; d++) cells.push({ day: d, today: d === 30 })
  while (cells.length % 7) cells.push({ day: null })
  return cells
}
export function KCalendar() {
  const [view, setView] = useState<'board' | 'month'>('board')
  const cols = ['kinara', 'abdil', 'keyla', 'aldyth']
  return (
    <Split
      left={<>
        <Kicker tone="#06b6d4">Calendar</Kicker>
        <h2 className="headline sm reveal">Board view or <Grad>month view.</Grad></h2>
        <p className="lede reveal">Events and recurring routines merge into one calendar. See the week as a per-person board, or zoom out to the whole month — the circle, in sync.</p>
        <div className="toggle reveal"><button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Board</button><button className={view === 'month' ? 'on' : ''} onClick={() => setView('month')}>Month</button></div>
      </>}
      right={<div className="kc reveal">
        <div className="kc-bar"><span className="kc-today">Today</span><b>{view === 'board' ? 'Jul 6 – Jul 12' : 'June 2026'}</b><span className="kc-nav">‹ ›</span></div>
        {view === 'board' ? (
          <div className="kc-board">
            <div className="kc-row kc-head"><span className="kc-daycell" />{cols.map(id => <span key={id} className="kc-colhead"><Av id={id} sm /></span>)}</div>
            {BOARD.map(day => (
              <div key={day.d} className="kc-row">
                <span className="kc-daycell"><b>{day.d}</b><i>{day.n}</i></span>
                {cols.map(id => (
                  <span key={id} className="kc-col">
                    {((day.ev as Record<string, string[][]>)[id] ?? []).map((e, j) => (
                      <span key={j} className="kc-ev" style={{ background: EN[e[2] as keyof typeof EN] }}>{e[0]}<i>{e[1]}</i></span>
                    ))}
                  </span>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <div className="kc-month">
            <div className="kc-wk">{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <span key={i}>{d}</span>)}</div>
            <div className="kc-grid">
              {monthCells().map((c, i) => (
                <span key={i} className={`kc-cell${c.day ? '' : ' empty'}${c.today ? ' today' : ''}`}>
                  {c.day && <i className="kc-num">{c.day}</i>}
                  {c.day && c.day % 7 !== 0 && c.day < 28 && MONTH_CHIPS.slice(0, 2).map((m, j) => (
                    <span key={j} className="kc-mchip" style={{ background: `${[EN.calm, EN.growth][j]}22`, color: [EN.calm, EN.growth][j] }}>{m}</span>
                  ))}
                  {c.day && c.day % 7 !== 0 && c.day < 28 && <span className="kc-mmore">+2</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>}
    />
  )
}

const STORIES = ['kinara', 'keyla', 'abdil', 'aldyth']
const POSTS = [
  { who: 'kinara', time: '2h', emoji: '🏝️', grad: 'linear-gradient(135deg,#7dd3fc,#a5f3fc)', cap: 'Beach day with the whole circle ☀️', h: 12, c: 3, d: 5 },
  { who: 'keyla', time: '1d', emoji: '🏆', grad: 'linear-gradient(135deg,#fde68a,#fca5a5)', cap: 'Keyla won her gymnastics medal! 🤸', h: 24, c: 7, d: 12 },
]
const MSUBS = ['Feed', 'Moments', 'Videos', 'Albums', 'Milestones']
export function KMoments() {
  return (
    <Split
      left={<>
        <Kicker tone="#06b6d4">Moments</Kicker>
        <h2 className="headline sm reveal">The memories, <Grad>kept together.</Grad></h2>
        <p className="lede reveal">A private family feed — photos, stories, videos, albums and milestones. Every trip and tiny win, shared only inside your circle.</p>
        <Chips items={['Feed', 'Stories', 'Albums', 'Milestones']} sm />
      </>}
      right={<div className="km reveal">
        <div className="km-tabs">{MSUBS.map((s, i) => <span key={s} className={`km-tab${i === 0 ? ' on' : ''}`}>{s}</span>)}</div>
        <div className="km-stories">
          <span className="km-story add"><span className="km-story-ring">＋</span><i>Add</i></span>
          {STORIES.map(id => <span key={id} className="km-story"><span className="km-story-ring" style={{ ['--ac' as string]: KM[id].c }}><Av id={id} /></span><i>{KM[id].n.split(' ')[0]}</i></span>)}
        </div>
        {POSTS.map((p, i) => (
          <div key={i} className="km-post">
            <div className="km-post-head"><Av id={p.who} /><div><b>{KM[p.who].n.split(' ')[0]}</b><small>{p.time}</small></div></div>
            <div className="km-photo" style={{ background: p.grad }}><span>{p.emoji}</span></div>
            <div className="km-react">{['❤️', '🏆', '😂', '😍', '👏', '🔥'].map(r => <span key={r}>{r}</span>)}</div>
            <div className="km-cap"><b>{KM[p.who].n.split(' ')[0]}</b> {p.cap}</div>
            <div className="km-meta"><span>❤️ {p.h}</span><span>💬 {p.c}</span><span>✦ {p.d}</span></div>
          </div>
        ))}
      </div>}
    />
  )
}

export function KApps() {
  const APPS = [['🎾', 'Matchday', '#10b981'], ['🍳', 'Kitchen', '#f59e0b'], ['✈️', 'Travel', '#06b6d4'], ['🔐', 'Vault', '#8b5cf6']]
  return (
    <Split
      left={<>
        <Kicker tone="#06b6d4">Apps</Kicker>
        <h2 className="headline sm reveal">A store of <Grad>circle apps.</Grad></h2>
        <p className="lede reveal">Add the tools your family actually needs — each one circle-aware out of the box. The OS grows with you.</p>
      </>}
      right={<div className="appgrid reveal">{APPS.map(([e, n, c]) => <div key={n as string} className="app-tile" style={{ ['--wc' as string]: c as string }}><span>{e}</span><b>{n}</b></div>)}</div>}
    />
  )
}

export function KMe() {
  const MEMBERS = [['Aldyth', 'Owner', '#F43F5E'], ['Kinara', 'Co-leader', '#0EA5E9'], ['Baginda', 'Member', '#10B981'], ['Keyla', 'Member', '#F59E0B']]
  return (
    <Split
      left={<>
        <Kicker tone="#06b6d4">Me · the passport</Kicker>
        <h2 className="headline sm reveal">Your circle, <Grad>your identity.</Grad></h2>
        <p className="lede reveal">A family passport — who's in the circle, their roles and tiers. One private space, no strangers, fully yours.</p>
      </>}
      right={<div className="passport reveal">
        <div className="pass-head"><span className="pass-crest">✦</span><div><b>Sukapradja Family</b><small>4 members · private circle</small></div></div>
        {MEMBERS.map(([n, r, c]) => <div key={n as string} className="pass-row"><span className="pass-av" style={{ background: c as string }}>{(n as string)[0]}</span><b>{n}</b><span className="pass-role">{r}</span></div>)}
      </div>}
    />
  )
}

const MILESTONES = [
  { e: '🎉', t: 'Keyla read her first book', tm: 'Mon', c: '#3b82f6' },
  { e: '🏅', t: 'Baginda closed all 6 rings', tm: 'Tue', c: '#f59e0b' },
  { e: '🎂', t: "Kinara's birthday", tm: 'Thu', c: '#ec4899' },
  { e: '🚀', t: 'Family shipped a game', tm: 'Sat', c: '#10b981' },
]
export function KMilestone() {
  return (
    <Split
      left={<>
        <Kicker tone="#06b6d4">Milestones</Kicker>
        <h2 className="headline sm reveal">The wins, <Grad>remembered.</Grad></h2>
        <p className="lede reveal">Every first, streak and celebration becomes a milestone on the family timeline — small moments that add up to a childhood.</p>
      </>}
      right={<div className="milestones reveal">{MILESTONES.map(m => (
        <div key={m.t} className="ms-row" style={{ ['--wc' as string]: m.c }}>
          <span className="ms-dot">{m.e}</span>
          <div className="ms-body"><b>{m.t}</b><small>{m.tm}</small></div>
        </div>
      ))}</div>}
    />
  )
}

// ════════════════════════ CIRCLE APPS FLIGHT ════════════════════════
export function CAOverview() {
  return (
    <Center>
      <Kicker tone="#10b981">Circle Apps</Kicker>
      <h2 className="headline reveal">Nine apps.<br /><Grad>One platform.</Grad></h2>
      <p className="lede wide reveal">Not a super-app — a constellation of focused, task-shaped apps, each powered by the same trusted circle.</p>
    </Center>
  )
}
export function CAMontage() {
  const APPS = [['🎾', 'Matchday'], ['🛒', 'Grocery'], ['🍳', 'Cooking'], ['💬', 'Chatbot'], ['🎯', 'Coaching'], ['🔥', 'Habits'], ['📸', 'Album'], ['✈️', 'Travel'], ['💰', 'Budget']]
  return (
    <Center>
      <Kicker tone="#10b981">The suite</Kicker>
      <h2 className="headline sm reveal">Every family task, <Grad>covered.</Grad></h2>
      <div className="ca-grid reveal">{APPS.map(([e, n]) => <div key={n} className="ca-tile"><span>{e}</span><b>{n}</b></div>)}</div>
    </Center>
  )
}
export function CASpine() {
  return (
    <Center>
      <Kicker tone="#10b981">The shared spine</Kicker>
      <h2 className="headline sm reveal">Circles power <Grad>them all.</Grad></h2>
      <p className="lede wide reveal">One identity, one membership, one source of truth. Build once on the circle — every app inherits trust, roles and privacy for free.</p>
      <Chips items={['Shared identity', 'Roles & privacy', 'One data spine', 'Add apps anytime']} />
    </Center>
  )
}

// ════════════════════════ COMPANY (ARGANTA) FLIGHT ════════════════════════
export function CMission() {
  return (
    <Center>
      <div className="hub-mark reveal"><Buddy mood="wave" size={108} /></div>
      <Kicker>Arganta · the company</Kicker>
      <h2 className="headline reveal">One trusted OS for the<br /><Grad>modern family.</Grad></h2>
      <p className="lede wide reveal">We turn the screen time families already spend into intelligence, connection and growth — inside circles you trust.</p>
    </Center>
  )
}
const PROOF = [
  { big: '2.5 hours', sub: 'a day on screens — children under 8', tone: '#06b6d4' },
  { big: '124 billion', sub: 'hours played on Roblox in 2025', tone: '#8b5cf6' },
  { big: '50 million+', sub: 'people learn on Duolingo every day', tone: '#10b981' },
  { big: '98 million', sub: 'families stay connected on Life360', tone: '#f59e0b' },
]
export function CWhyNow() {
  return (
    <Split
      left={<>
        <Kicker>Why now</Kicker>
        <h2 className="headline sm reveal">Each pillar is <Grad>already proven.</Grad></h2>
        <p className="lede reveal">Games proved engagement. Learning apps proved daily habit. Family apps proved circles. The attention exists — it just isn't building anything yet.</p>
      </>}
      right={<div className="proof-grid reveal">{PROOF.map(p => <div key={p.sub} className="proof" style={{ ['--tone' as string]: p.tone }}><b>{p.big}</b><span>{p.sub}</span></div>)}</div>}
    />
  )
}
export function CWedge() {
  return (
    <Center>
      <Kicker>The wedge</Kicker>
      <h2 className="headline sm reveal">Turn screen time into<br /><Grad>intelligence time.</Grad></h2>
      <p className="lede wide reveal">Our insight: don't fight the screen — redirect it. Take the hours families already spend and route them into a six-world learning journey, inside a trusted circle. One platform, many products.</p>
      <Chips items={['ArgantaLab', 'KinetikCircle', 'Circle Apps', '→ Circles OS']} />
    </Center>
  )
}

const AGENT_STATS = [['1', 'human CEO'], ['26', 'AI agents'], ['3', 'products run'], ['24/7', 'always on']]
const AGENT_PROPS = ['Lean by default', 'Real-time KPIs', 'Agile decisions', 'Scales without headcount']
export function CAgents() {
  return (
    <Center>
      <Kicker>The agentic engine · Circle HQ</Kicker>
      <h2 className="headline sm reveal">A company run by <Grad>agents.</Grad></h2>
      <div className="agent-stats reveal">{AGENT_STATS.map(([v, l]) => <div key={l} className="agent-stat"><b>{v}</b><span>{l}</span></div>)}</div>
      <div className="agent-props reveal">{AGENT_PROPS.map(p => <span key={p} className="prop-chip">{p}</span>)}</div>
      <div className="reveal" style={{ width: '100%', display: 'flex', justifyContent: 'center' }}><OrgChart /></div>
    </Center>
  )
}

export function CMetrics() {
  const LINE = [22, 30, 28, 42, 55, 60, 78, 90]
  const max = Math.max(...LINE)
  const pts = LINE.map((v, i) => `${(i / (LINE.length - 1)) * 100},${100 - (v / max) * 92}`).join(' ')
  return (
    <Split
      left={<>
        <Kicker>Command center · insight</Kicker>
        <h2 className="headline sm reveal">One brain, <Grad>every metric.</Grad></h2>
        <p className="lede reveal">Circle HQ reads the same live data the agents act on — growth, retention, the Argon economy, portfolio health — so decisions are made on signal, not vibes.</p>
        <div className="metric-kpis reveal">{[['D7', '—%'], ['WAK', '—'], ['LTV', '$—']].map(([l, v]) => <div key={l} className="metric-kpi"><b>{v}</b><span>{l}</span></div>)}</div>
      </>}
      right={<div className="chartcard reveal">
        <div className="chart-head"><b>Weekly active · trend</b><span className="chart-up">▲ growth</span></div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg">
          <polyline points={pts} fill="none" stroke="url(#cg)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <defs><linearGradient id="cg" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#8b5cf6" /><stop offset="100%" stopColor="#10b981" /></linearGradient></defs>
        </svg>
        <div className="chart-bars">{[40, 62, 55, 78, 70, 92, 84, 96].map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div>
      </div>}
    />
  )
}
export function CBuilders() {
  return (
    <Split
      left={<>
        <Kicker>The command center</Kicker>
        <h2 className="headline sm reveal">One brain feeds<br /><Grad>both apps.</Grad></h2>
        <p className="lede reveal">Circle HQ is the operator OS — game, app, lesson, agent and content builders that ship straight into ArgantaLab and KinetikCircle, with portfolio and growth insight in one place.</p>
        <Chips items={['Game builder', 'App builder', 'Content studio', 'Agent builder']} sm />
      </>}
      right={<div className="hq reveal">
        <div className="hq-rail">{['◷', '◆', '✦', '◈', '▣'].map((g, i) => <span key={i} className={`hq-ic${i === 1 ? ' on' : ''}`}>{g}</span>)}</div>
        <div className="hq-body">
          <div className="hq-kpis">{[['25', 'agents'], ['5', 'builders'], ['3', 'products']].map(([v, l]) => <div key={l} className="hq-kpi"><b>{v}</b><span>{l}</span></div>)}</div>
          <div className="pipeline">{PIPELINE.map((s, i) => <span key={s.key} className="pipe-stage"><b>{s.name}</b><small>{s.sub}</small>{i < PIPELINE.length - 1 && <i className="pipe-arrow">→</i>}</span>)}</div>
        </div>
      </div>}
    />
  )
}
export function CModel() {
  const TIERS = [['Family', '$ / month', 'all products, one circle'], ['Partner', 'per seat', 'tutors · clubs · schools'], ['Platform', 'rev-share', 'circle app makers']]
  return (
    <Center>
      <Kicker>Business model · go-to-market</Kicker>
      <h2 className="headline sm reveal">Built to <Grad>compound.</Grad></h2>
      <div className="tiers reveal">{TIERS.map(([n, p, d]) => <div key={n} className="tier"><b>{n}</b><span className="tier-price">{p}</span><small>{d}</small></div>)}</div>
      <p className="lede reveal" style={{ opacity: 0.7 }}>Placeholder pricing — final numbers to be supplied.</p>
    </Center>
  )
}
export function CTractionAsk() {
  return (
    <Split
      left={<>
        <Kicker>Traction · team</Kicker>
        <h2 className="headline sm reveal">Built by parents,<br /><Grad>for families.</Grad></h2>
        <div className="kpibig reveal">{[['3', 'products live'], ['8', 'AI agents'], ['9', 'circle apps'], ['—', 'pilot families']].map(([v, l]) => <div key={l} className="kpibig-cell"><b>{v}</b><span>{l}</span></div>)}</div>
        <p className="lede reveal" style={{ opacity: 0.7 }}>Real metrics to be supplied.</p>
      </>}
      right={<div className="ask reveal">
        <h3>The ask</h3>
        <p>Raise to scale the agent workforce and reach the first 10,000 families.</p>
        <div className="ask-actions"><a className="btn-primary" href="mailto:hello@arganta.app?subject=Investing%20in%20Arganta">Talk to us →</a></div>
      </div>}
    />
  )
}

// ════════════════════════ VISION FLIGHT ════════════════════════
export function VChild() {
  return (
    <Center>
      <div className="v-ground reveal"><Buddy mood="happy" size={120} /></div>
      <Kicker>The vision</Kicker>
      <h2 className="headline sm reveal">It starts with <Grad>one child.</Grad></h2>
      <p className="lede reveal">A kid, playing — and quietly becoming capable.</p>
    </Center>
  )
}
export function VFamily() {
  return (
    <Center>
      <Kicker>One family</Kicker>
      <h2 className="headline sm reveal">A whole life, <Grad>in circles.</Grad></h2>
      <div className="v-family reveal">{['📚', '🎾', '🍳', '✈️', '💰', '🔥'].map((e, i) => <span key={i} className="v-orb" style={{ ['--i' as string]: i }}>{e}</span>)}</div>
      <p className="lede reveal">Learning, play, meals, trips, money, habits — one trusted system.</p>
    </Center>
  )
}
export function VAll() {
  return (
    <Center>
      <Kicker>Every family</Kicker>
      <h2 className="headline sm reveal">One OS for<br /><Grad>families everywhere.</Grad></h2>
      <div className="v-map reveal">{Array.from({ length: 24 }).map((_, i) => <span key={i} className="v-node" style={{ ['--i' as string]: i }} />)}</div>
    </Center>
  )
}
export function VFlywheel() {
  return (
    <Center>
      <Kicker>The flywheel</Kicker>
      <h2 className="headline sm reveal">More circles,<br /><Grad>smarter everything.</Grad></h2>
      <div className="flywheel reveal">{['More circles', 'Smarter agents', 'Better outcomes', 'More trust'].map((s, i) => <span key={s} className="fw-node" style={{ ['--i' as string]: i }}>{s}</span>)}</div>
    </Center>
  )
}
export function VLine() {
  return (
    <Center>
      <div className="v-lines reveal">
        <span className="line-kids">Kids see play.</span>
        <span className="line-parents">Parents see growth.</span>
      </div>
    </Center>
  )
}
export function VInvite() {
  return (
    <Center>
      <div className="cta-mark reveal"><Buddy mood="wave" size={116} /></div>
      <h2 className="headline reveal">Join the <Grad>flight.</Grad></h2>
      <p className="lede reveal">For families, tutors, clubs, learning partners — and the investors who want to build the future of the family.</p>
      <div className="cta-actions reveal">
        <a className="btn-primary" href="https://lab.arganta.app" target="_blank" rel="noopener noreferrer">Explore ArgantaLab →</a>
        <a className="btn-secondary" href="mailto:hello@arganta.app">Get in touch</a>
      </div>
    </Center>
  )
}
