import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { DeviceFrame } from './embed/DeviceFrame'
import { cloudEnabled } from './lib/supabase'
import { signInWithGoogle, signOut, useAuth } from './lib/auth'
import { useHqPitch, type PitchData } from './lib/hq'
import { useTheme } from './theme'
import {
  AgentIcon,
  IconDefinitions,
  PortfolioIcon,
  type AgentIconId,
  type PortfolioIconId,
} from './company/IconSystem'
import './styles/company.css'

const LegacyExperience = lazy(() => import('./LegacyExperience'))

type Perspective = 'public' | 'investor' | 'founder'
type ChapterId = 'origin' | 'worlds' | 'architecture' | 'pulse' | 'trajectory'
type Truth = 'Live' | 'Verified' | 'Derived' | 'Reported' | 'Modeled' | 'Planned' | 'Pending'
type Frame = 'phone' | 'desktop'

interface Chapter {
  id: ChapterId
  label: string
  path: string
}

interface Product {
  id: PortfolioIconId
  name: string
  role: string
  world: string
  accent: string
  description: string
  url?: string
  status: 'Live surface' | 'Venture' | 'Embedded layer'
  tabs: string[]
}

const CHAPTERS: Chapter[] = [
  { id: 'origin', label: 'Origin', path: '/' },
  { id: 'worlds', label: 'Worlds', path: '/worlds' },
  { id: 'architecture', label: 'Architecture', path: '/architecture' },
  { id: 'pulse', label: 'Pulse', path: '/pulse' },
  { id: 'trajectory', label: 'Trajectory', path: '/trajectory' },
]

const PRODUCTS: Product[] = [
  {
    id: 'arganta',
    name: 'Arganta Core',
    role: 'Ground · route · explain',
    world: 'Intelligence layer',
    accent: '#F2B544',
    description: 'The embedded intelligence pipeline that grounds requests, routes work, generates outcomes and preserves evidence.',
    status: 'Embedded layer',
    tabs: ['Sense', 'Compute', 'Match', 'Generate', 'Deliver', 'Evidence'],
  },
  {
    id: 'life',
    name: 'ArgantaLife',
    role: 'Calm · connect · grow',
    world: 'Family',
    accent: '#FF7A59',
    description: 'The family-growth proposition: one calmer rhythm for coordination, play, learning and remembered context.',
    url: 'https://circle.arganta.app',
    status: 'Venture',
    tabs: ['Today', 'Calendar', 'Moments', 'Apps', 'You', 'Bloom'],
  },
  {
    id: 'energy',
    name: 'ArgantaEnergy',
    role: 'Evidence · uncertainty · decision',
    world: 'Industry',
    accent: '#2E7CF6',
    description: 'Explainable lifecycle workbenches and specialist agents from exploration through reservoir management.',
    url: 'https://energy.arganta.app',
    status: 'Live surface',
    tabs: ['Explore', 'Field', 'Well', 'Reservoir', 'Knowledge', 'Data'],
  },
  {
    id: 'studio',
    name: 'ArgantaStudio',
    role: 'Direct · create · ship',
    world: 'Creation',
    accent: '#A06CE8',
    description: 'A Brand-OS-governed path from brief through media, software, games, automation and approved publishing.',
    url: 'https://studio.arganta.app',
    status: 'Live surface',
    tabs: ['Direction', 'Brand', 'Image', 'Video', 'Audio', 'Build', 'Publish'],
  },
  {
    id: 'hq',
    name: 'ArgantaHQ',
    role: 'Govern · coordinate · remember',
    world: 'Operating system',
    accent: '#AF9BE8',
    description: 'The founder operating system for products, evidence, people, agents, risks, decisions and approvals.',
    url: 'https://hq.arganta.app',
    status: 'Live surface',
    tabs: ['Command', 'Portfolio', 'Growth', 'Data', 'Vault', 'Agents', 'Brand'],
  },
  {
    id: 'kinetik',
    name: 'KinetikCircle',
    role: 'Connect · rhythm · remember',
    world: 'Family',
    accent: '#EC93B5',
    description: 'Private family coordination and remembered context—the connective substrate for ArgantaLife.',
    url: 'https://circle.arganta.app',
    status: 'Live surface',
    tabs: ['Circle', 'Today', 'Calendar', 'Moments', 'Memory', 'Trust'],
  },
  {
    id: 'lab',
    name: 'ArgantaLab',
    role: 'Learn · build · ship',
    world: 'Learning',
    accent: '#7BAEE8',
    description: 'Short mastery loops unlock making, testing and publishing inside a trusted family ecosystem.',
    url: 'https://lab.arganta.app',
    status: 'Live surface',
    tabs: ['Journey', 'Learn', 'Build', 'Arena', 'Worlds', 'Fame'],
  },
  {
    id: 'lashira',
    name: 'LashiraBloom',
    role: 'Play · cultivate · belong',
    world: 'Family play',
    accent: '#6EC492',
    description: 'A shared farm-and-adventure world where adult play and child learning contribute to the same circle.',
    url: 'https://bloom.arganta.app',
    status: 'Live surface',
    tabs: ['Bloom', 'Farm', 'Explore', 'Battle', 'Circle', 'Create'],
  },
]

const LOOP = [
  ['Concept', 'Name the human tension and the smallest honest promise.'],
  ['Build', 'Ship a real surface that can be entered, not a presentation of one.'],
  ['Observe', 'Instrument behavior, quality, cost and trust.'],
  ['Prove', 'Separate evidence from belief and scenarios from results.'],
  ['Scale', 'Allocate only after a repeatable loop earns it.'],
]

const AGENT_GROUPS: {
  label: string
  accent: string
  agents: { id: AgentIconId; name: string; role: string }[]
}[] = [
  {
    label: 'ArgantaHQ · executive offices',
    accent: '#AF9BE8',
    agents: [
      { id: 'ceo', name: 'CEO', role: 'Direction and final decisions' },
      { id: 'coo', name: 'COO', role: 'Operating rhythm and delivery' },
      { id: 'cto', name: 'CTO', role: 'Architecture and reliability' },
      { id: 'cfo', name: 'CFO', role: 'Capital, cost and scenarios' },
      { id: 'gc', name: 'GC', role: 'Risk, rights and governance' },
      { id: 'capo', name: 'CAPO', role: 'People and agent orchestration' },
    ],
  },
  {
    label: 'ArgantaEnergy · technical agents',
    accent: '#2E7CF6',
    agents: [
      { id: 'exploration', name: 'Exploration', role: 'Basin and prospect evidence' },
      { id: 'field', name: 'Field', role: 'Development options' },
      { id: 'well', name: 'Well', role: 'Well planning and delivery' },
      { id: 'reservoir', name: 'Reservoir', role: 'Dynamic subsurface reasoning' },
      { id: 'drilling', name: 'Drilling', role: 'Execution and uncertainty' },
    ],
  },
  {
    label: 'ArgantaStudio · creation agents',
    accent: '#A06CE8',
    agents: [
      { id: 'art-director', name: 'Art Director', role: 'Taste and visual coherence' },
      { id: 'product', name: 'Product', role: 'Experience and software' },
      { id: 'media', name: 'Media', role: 'Image, video and audio' },
      { id: 'transform', name: 'Transform', role: 'Source-to-output systems' },
      { id: 'launch', name: 'Launch', role: 'Approval and publishing' },
    ],
  },
]

const PATH_TITLES: Record<string, string> = {
  '/': 'Origin — Arganta',
  '/worlds': 'Worlds — Arganta',
  '/architecture': 'Architecture — Arganta',
  '/pulse': 'Pulse — Arganta',
  '/trajectory': 'Trajectory — Arganta',
  '/settings': 'Settings — Arganta',
  '/settings/perspective': 'Perspective Settings — Arganta',
  '/settings/appearance': 'Appearance Settings — Arganta',
  '/settings/access': 'Founder Access — Arganta',
  '/settings/legacy': 'Legacy Landing — Arganta',
  '/legacy': 'Legacy Landing — Arganta',
}

function cleanPath(pathname: string) {
  if (pathname !== '/' && pathname.endsWith('/')) return pathname.slice(0, -1)
  return pathname
}

function navIcon(id: ChapterId) {
  const common = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (id === 'origin') return <svg {...common}><path d="M12 2.8v4M12 17.2v4M2.8 12h4M17.2 12h4" /><circle cx="12" cy="12" r="3.4" /><path d="m5.5 5.5 2.2 2.2m8.6 8.6 2.2 2.2m0-13-2.2 2.2m-8.6 8.6-2.2 2.2" /></svg>
  if (id === 'worlds') return <svg {...common}><circle cx="12" cy="12" r="3" /><ellipse cx="12" cy="12" rx="9" ry="4.6" /><ellipse cx="12" cy="12" rx="4.6" ry="9" transform="rotate(35 12 12)" /><circle cx="20.5" cy="12" r="1" fill="currentColor" stroke="none" /></svg>
  if (id === 'architecture') return <svg {...common}><path d="m12 3 8 4.3-8 4.3-8-4.3L12 3Z" /><path d="m4 12.1 8 4.3 8-4.3M4 16.8l8 4.2 8-4.2" /></svg>
  if (id === 'pulse') return <svg {...common}><path d="M2.5 12h4l2.2-6 4.1 12 2.6-7 1.7 3h4.4" /></svg>
  return <svg {...common}><path d="M3 18.5c4.5 0 6-2.3 8.4-6.4C13.7 8 16.2 5.5 21 5.5" /><path d="M16.5 3.5 21 5.5l-3.2 3.8" /><circle cx="3" cy="18.5" r="1.4" fill="currentColor" stroke="none" /></svg>
}

function Link({
  href,
  navigate,
  children,
  className,
}: {
  href: string
  navigate: (path: string) => void
  children: ReactNode
  className?: string
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        navigate(href)
      }}
    >
      {children}
    </a>
  )
}

function TruthBadge({ status }: { status: Truth }) {
  return <span className={`truth truth-${status.toLowerCase()}`}>{status}</span>
}

function SectionHead({
  index,
  eyebrow,
  title,
  copy,
}: {
  index: string
  eyebrow: string
  title: string
  copy: string
}) {
  return (
    <header className="section-head reveal">
      <div className="section-number">{index}</div>
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <p className="section-copy">{copy}</p>
    </header>
  )
}

function PerspectiveAvatar({ perspective }: { perspective: Perspective }) {
  return (
    <span className={`perspective-avatar perspective-${perspective}`} aria-hidden="true">
      {perspective === 'public' && <PortfolioIcon id="arganta" size={25} color="#F2B544" />}
      {perspective === 'investor' && <span className="avatar-rings"><i /><i /><i /></span>}
      {perspective === 'founder' && <PortfolioIcon id="hq" size={25} color="#AF9BE8" />}
    </span>
  )
}

function GlobalShell({
  path,
  perspective,
  navigate,
  onOpenLens,
  children,
}: {
  path: string
  perspective: Perspective
  navigate: (path: string) => void
  onOpenLens: () => void
  children: ReactNode
}) {
  const chapter = CHAPTERS.find((item) => item.path === path)?.id
  const utility = path.startsWith('/settings')

  return (
    <div className="company-shell">
      <header className="desktop-nav glass">
        <Link href="/" navigate={navigate} className="brand-link">
          <PortfolioIcon id="arganta" size={31} color="#F2B544" />
          <span>Arganta</span>
        </Link>
        <nav className="desktop-chapters" aria-label="Company chapters">
          {CHAPTERS.map((item) => (
            <Link
              key={item.id}
              href={item.path}
              navigate={navigate}
              className={chapter === item.id ? 'active' : ''}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="desktop-actions">
          <button className="lens-button" type="button" onClick={onOpenLens}>
            <PerspectiveAvatar perspective={perspective} />
            <span>{perspective === 'public' ? 'Explore' : perspective === 'investor' ? 'Partner' : 'Founder'}</span>
          </button>
          <Link href="/settings" navigate={navigate} className={`settings-button${utility ? ' active' : ''}`} aria-label="Settings">
            <span />
            <span />
            <span />
          </Link>
        </div>
      </header>

      <header className="mobile-header glass">
        <Link href="/" navigate={navigate} className="brand-link" aria-label="Arganta home">
          <PortfolioIcon id="arganta" size={30} color="#F2B544" />
          <span>Arganta</span>
        </Link>
        <button className="mobile-lens" type="button" onClick={onOpenLens} aria-label="Choose perspective">
          <PerspectiveAvatar perspective={perspective} />
        </button>
        <Link href="/settings" navigate={navigate} className="mobile-settings" aria-label="Settings">
          <span />
          <span />
          <span />
        </Link>
      </header>

      <main className={utility ? 'utility-main' : 'chapter-main'}>{children}</main>

      {!utility && (
        <nav className="mobile-bottom-nav glass" aria-label="Company chapters">
          {CHAPTERS.map((item) => (
            <Link
              key={item.id}
              href={item.path}
              navigate={navigate}
              className={chapter === item.id ? 'active' : ''}
            >
              <span className="mobile-nav-icon">{navIcon(item.id)}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      )}
    </div>
  )
}

function LensDialog({
  current,
  isOperator,
  onClose,
  onSelect,
}: {
  current: Perspective
  isOperator: boolean
  onClose: () => void
  onSelect: (perspective: Perspective) => void
}) {
  const choices: { id: Perspective; name: string; descriptor: string }[] = [
    { id: 'public', name: 'Explore', descriptor: 'Products, purpose and public proof.' },
    { id: 'investor', name: 'Partner', descriptor: 'Market, architecture, risk and trajectory.' },
    { id: 'founder', name: 'Founder', descriptor: isOperator ? 'The complete operating perspective.' : 'Sign in to unlock the complete view.' },
  ]
  return (
    <div className="lens-overlay" role="dialog" aria-modal="true" aria-labelledby="lens-title" onMouseDown={onClose}>
      <div className="lens-dialog glass" onMouseDown={(event) => event.stopPropagation()}>
        <button className="dialog-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <p className="eyebrow">One company truth · three lenses</p>
        <h2 id="lens-title">Choose your perspective.</h2>
        <div className="lens-grid">
          {choices.map((choice) => (
            <button
              key={choice.id}
              type="button"
              className={`lens-choice lens-${choice.id}${current === choice.id ? ' active' : ''}`}
              onClick={() => onSelect(choice.id)}
            >
              <PerspectiveAvatar perspective={choice.id} />
              <strong>{choice.name}</strong>
              <span>{choice.descriptor}</span>
              {choice.id === 'founder' && !isOperator && <small>Protected</small>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function Origin({
  perspective,
  navigate,
}: {
  perspective: Perspective
  navigate: (path: string) => void
}) {
  return (
    <>
      <section className="origin-hero page-hero">
        <div className="origin-copy reveal">
          <p className="eyebrow">Independent product house · Doha and the world</p>
          <h1>A company built as a <em>living system.</em></h1>
          <p className="hero-lede">
            Arganta creates connected worlds for family growth, expert decisions and governed creation—then makes the evidence visible.
          </p>
          <div className="hero-actions">
            <Link href="/worlds" navigate={navigate} className="button button-primary">Enter the worlds</Link>
            <Link href="/pulse" navigate={navigate} className="button button-secondary">See what is live</Link>
          </div>
        </div>
        <div className="constellation" aria-label="Arganta product constellation">
          <div className="constellation-orbit orbit-one" />
          <div className="constellation-orbit orbit-two" />
          {PRODUCTS.map((product, index) => {
            const positions = [
              ['50%', '50%'], ['49%', '4%'], ['84%', '22%'], ['92%', '62%'],
              ['68%', '86%'], ['28%', '86%'], ['8%', '61%'], ['16%', '20%'],
            ]
            return (
              <div
                key={product.id}
                className={`constellation-node node-${product.id}`}
                style={{
                  '--node-x': positions[index][0],
                  '--node-y': positions[index][1],
                  '--node-accent': product.accent,
                  '--node-delay': `${index * 90}ms`,
                } as CSSProperties}
              >
                <span><PortfolioIcon id={product.id} size={index === 0 ? 92 : 62} color={product.accent} /></span>
                <small>{product.name}</small>
              </div>
            )
          })}
        </div>
      </section>

      <section className="editorial-section">
        <SectionHead
          index="01.1"
          eyebrow="The founder thesis"
          title="Turn attention into something that compounds."
          copy="The screen is not the enemy. The question is what the hours on the other side of it build: skill, connection, evidence, confidence—or nothing."
        />
        <div className="thesis-band reveal">
          <article><span>Children</span><h3>See play.</h3><p>Short quests, real creation, persistent worlds and meaningful progression.</p></article>
          <article><span>Parents</span><h3>See growth.</h3><p>Coordination, evidence, reflection and one calmer weekly rhythm.</p></article>
          <article><span>Together</span><h3>Build a life.</h3><p>Shared systems turn individual activity into family memory and momentum.</p></article>
        </div>
      </section>

      <section className="editorial-section loop-section">
        <SectionHead
          index="01.2"
          eyebrow="How Arganta moves"
          title="Belief becomes evidence."
          copy="Every venture follows the same operating cadence. Scale is a consequence of proof, not presentation."
        />
        <div className="operating-loop">
          {LOOP.map(([name, description], index) => (
            <article key={name} className="loop-step reveal">
              <b>{String(index + 1).padStart(2, '0')}</b>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="editorial-section roots-section">
        <div className="roots-statement reveal">
          <p className="eyebrow">Rooted here · designed to travel</p>
          <h2>Built between Doha, Indonesia and a family’s real week.</h2>
        </div>
        <div className="roots-copy reveal">
          <p>Arganta begins with lived problems: the household that needs calm, the child who learns through making, the expert who needs evidence before a decision, and the founder who needs one coherent company memory.</p>
          {perspective === 'investor' && <p><TruthBadge status="Planned" /> The portfolio is sequenced around evidence: family ritual first, expert delivery where demand is strongest, shared infrastructure only where it improves control or margin.</p>}
          {perspective === 'founder' && <p><TruthBadge status="Verified" /> Founder lens is active. Internal operating evidence and direct HQ entry are available throughout the profile.</p>}
        </div>
      </section>

      <ChapterCta
        eyebrow="Next chapter"
        title="The system becomes tangible."
        action="Explore Worlds"
        href="/worlds"
        navigate={navigate}
      />
    </>
  )
}

function DeviceTheatre({ product }: { product: Product }) {
  const [frame, setFrame] = useState<Frame>('phone')
  const [live, setLive] = useState(false)

  useEffect(() => setLive(false), [product.id])

  return (
    <div className="device-theatre reveal" style={{ '--product-accent': product.accent } as CSSProperties}>
      <div className="device-copy">
        <div className="device-heading">
          <PortfolioIcon id={product.id} size={68} color={product.accent} />
          <div>
            <p className="eyebrow">{product.world} · {product.status}</p>
            <h2>{product.name}</h2>
            <p>{product.role}</p>
          </div>
        </div>
        <p className="device-description">{product.description}</p>
        <div className="product-tabs">
          {product.tabs.map((tab) => <span key={tab}>{tab}</span>)}
        </div>
        <div className="device-actions">
          {product.url && (
            <button className="button button-primary" type="button" onClick={() => setLive((value) => !value)}>
              {live ? 'Return to preview' : 'Preview live app'}
            </button>
          )}
          {product.url && <a className="button button-secondary" href={product.url} target="_blank" rel="noreferrer">Open full app ↗</a>}
          {!product.url && <a className="button button-secondary" href="/architecture">See the intelligence layer</a>}
        </div>
      </div>
      <div className="device-stage">
        <div className="frame-toggle" aria-label="Preview size">
          <button className={frame === 'phone' ? 'active' : ''} type="button" onClick={() => setFrame('phone')}>Mobile</button>
          <button className={frame === 'desktop' ? 'active' : ''} type="button" onClick={() => setFrame('desktop')}>Desktop</button>
        </div>
        <DeviceFrame frame={frame} label={product.url ? new URL(product.url).host : 'arganta.app'}>
          {live && product.url ? (
            <iframe
              className="product-iframe"
              src={product.url}
              title={`${product.name} live preview`}
              loading="lazy"
              allow="fullscreen; autoplay; gamepad"
            />
          ) : (
            <div className="product-poster">
              <div className="poster-aurora" />
              <PortfolioIcon id={product.id} size={frame === 'phone' ? 116 : 146} color={product.accent} />
              <strong>{product.name}</strong>
              <span>{product.role}</span>
              <small>{product.status}</small>
            </div>
          )}
        </DeviceFrame>
      </div>
    </div>
  )
}

function Worlds({ perspective, navigate }: { perspective: Perspective; navigate: (path: string) => void }) {
  const [selectedId, setSelectedId] = useState<PortfolioIconId>('kinetik')
  const selected = PRODUCTS.find((product) => product.id === selectedId) ?? PRODUCTS[0]

  return (
    <>
      <section className="page-hero chapter-hero worlds-hero">
        <div className="chapter-hero-copy reveal">
          <p className="eyebrow">Chapter 02 · Worlds</p>
          <h1>Different doors. <em>One living spine.</em></h1>
          <p>Every world has a distinct reason to return. Identity, evidence, creation and governance connect them underneath.</p>
        </div>
        <div className="app-lineup reveal" role="list" aria-label="Arganta product lineup">
          {PRODUCTS.map((product) => (
            <button
              key={product.id}
              type="button"
              className={selected.id === product.id ? 'active' : ''}
              onClick={() => setSelectedId(product.id)}
              style={{ '--product-accent': product.accent } as CSSProperties}
            >
              <span className="app-icon-shell"><PortfolioIcon id={product.id} size={59} color={product.accent} /></span>
              <strong>{product.name}</strong>
              <small>{product.world}</small>
            </button>
          ))}
        </div>
      </section>

      <section className="editorial-section device-section">
        <DeviceTheatre product={selected} />
      </section>

      <section className="editorial-section world-groups-section">
        <SectionHead
          index="02.2"
          eyebrow="Portfolio logic"
          title="Four worlds. Clear jobs."
          copy="Arganta is not eight identical startups. Each surface earns its place through a critical loop and an accountable role."
        />
        <div className="world-groups">
          {[
            ['Family', '#FF7A59', 'KinetikCircle · ArgantaLife · LashiraBloom', 'Coordinate the week, turn play into progress and preserve trusted family context.'],
            ['Industry', '#2E7CF6', 'ArgantaEnergy', 'Make complex technical decisions explainable, auditable and easier to repeat.'],
            ['Creation', '#A06CE8', 'ArgantaStudio', 'Move from intent to governed media, software, games and publishing.'],
            ['Enabling', '#F2B544', 'ArgantaHQ · ArgantaLab · Arganta Core', 'Ground intelligence, build capability, preserve evidence and govern the portfolio.'],
          ].map(([name, accent, products, description]) => (
            <article key={name} className="world-group reveal" style={{ '--group-accent': accent } as CSSProperties}>
              <div className="world-index" />
              <p className="eyebrow">{products}</p>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
        {perspective !== 'public' && (
          <div className="perspective-note reveal">
            <TruthBadge status="Verified" />
            <strong>Portfolio sequencing</strong>
            <p>The public app surface is not treated as proof of demand. Maturity, retention, paid delivery and reusable advantage remain separate evidence gates.</p>
          </div>
        )}
      </section>

      <ChapterCta
        eyebrow="Next chapter"
        title="See what connects the worlds."
        action="Open Architecture"
        href="/architecture"
        navigate={navigate}
      />
    </>
  )
}

function Architecture({ perspective, navigate }: { perspective: Perspective; navigate: (path: string) => void }) {
  const layers = [
    ['Experience', 'The screens, rituals and workbenches people actually enter.'],
    ['Product', 'Domain logic for family, learning, energy, creation and company operations.'],
    ['Data', 'Identity, circles, content, progress, events, evidence and lineage.'],
    ['Intelligence', 'Grounding, retrieval, routing, generation, evaluation and memory.'],
    ['Agents', 'Specialists with explicit mandates, inputs, outputs and limits.'],
    ['Human governance', 'Decision rights, approval, trust, safety and final accountability.'],
  ]

  return (
    <>
      <section className="page-hero chapter-hero architecture-hero">
        <div className="chapter-hero-copy reveal">
          <p className="eyebrow">Chapter 03 · Architecture</p>
          <h1>Intelligence needs <em>structure.</em></h1>
          <p>The moat is not model access. It is the governed path from real activity to evidence, decision, action and memory.</p>
        </div>
        <div className="architecture-hero-visual reveal" aria-hidden="true">
          {layers.slice().reverse().map(([name], index) => (
            <div key={name} style={{ '--layer-index': index } as CSSProperties}><span>{name}</span></div>
          ))}
        </div>
      </section>

      <section className="editorial-section">
        <SectionHead
          index="03.1"
          eyebrow="The company stack"
          title="One decision can be traced all the way down."
          copy="Architecture is useful only when it makes ownership, evidence and boundaries clearer."
        />
        <div className="architecture-stack">
          {layers.map(([name, description], index) => (
            <article key={name} className="architecture-layer reveal" style={{ '--layer-hue': `${36 + index * 32}` } as CSSProperties}>
              <b>{String(index + 1).padStart(2, '0')}</b>
              <h3>{name}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="editorial-section agents-section">
        <SectionHead
          index="03.2"
          eyebrow="Agent constellation"
          title="Specialists orbit a human decision."
          copy="Agents increase capacity. Consequential decisions remain human-owned, and every output needs a visible route back to its evidence."
        />
        <div className="agent-groups">
          {AGENT_GROUPS.map((group) => (
            <section key={group.label} className="agent-group reveal" style={{ '--agent-accent': group.accent } as CSSProperties}>
              <header><span /><h3>{group.label}</h3><small>{group.agents.length} agents</small></header>
              <div className="agent-list">
                {group.agents.map((agent) => (
                  <article key={agent.id}>
                    <AgentIcon id={agent.id} size={72} color={group.accent} />
                    <strong>{agent.name}</strong>
                    <span>{agent.role}</span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="editorial-section governance-section">
        <div className="governance-card reveal">
          <div>
            <p className="eyebrow">Decision boundary</p>
            <h2>Autonomy ends where consequence begins.</h2>
          </div>
          <div className="governance-grid">
            {['Scope', 'Allowed actions', 'Data access', 'Required approvals', 'Evidence trail', 'Human escalation'].map((item, index) => (
              <span key={item}><b>{index + 1}</b>{item}</span>
            ))}
          </div>
          {perspective === 'founder' && (
            <a className="button button-primary" href="https://hq.arganta.app" target="_blank" rel="noreferrer">Open the operating system ↗</a>
          )}
        </div>
      </section>

      <ChapterCta
        eyebrow="Next chapter"
        title="Architecture earns belief through proof."
        action="Read the Pulse"
        href="/pulse"
        navigate={navigate}
      />
    </>
  )
}

interface Metric {
  label: string
  value: number | null | undefined
  unit?: string
  truth: Truth
  definition: string
}

function fmt(value: number | null | undefined, unit?: string) {
  if (value === null || value === undefined) return 'Not yet measured'
  const formatted = Math.abs(value) >= 1000 ? new Intl.NumberFormat('en-US').format(value) : String(value)
  return unit === '%' ? `${formatted}%` : unit ? `${formatted} ${unit}` : formatted
}

function metricsFor(data: PitchData | null, perspective: Perspective): Metric[] {
  const publicMetrics: Metric[] = [
    { label: 'Live learning worlds', value: data?.worldsLive, truth: data ? 'Live' : 'Pending', definition: 'World records currently marked live.' },
    { label: 'Published learning items', value: data?.itemsLive, truth: data ? 'Live' : 'Pending', definition: 'Items available in the shared content catalog.' },
    { label: 'Public games', value: data?.gamesPublic, truth: data ? 'Live' : 'Pending', definition: 'Games whose database visibility is public.' },
  ]
  const investorMetrics: Metric[] = [
    ...publicMetrics,
    { label: 'Weekly active profiles', value: data?.wau, truth: data ? 'Live' : 'Pending', definition: 'Distinct profiles with tracked activity during the last seven days.' },
    { label: 'Daily / monthly stickiness', value: data?.stickiness, unit: '%', truth: data ? 'Derived' : 'Pending', definition: 'Daily active profiles divided by monthly active profiles.' },
    { label: 'Next-day return', value: data?.d1, unit: '%', truth: data ? 'Derived' : 'Pending', definition: 'Tracked profiles returning on the following day over the current measurement window.' },
  ]
  if (perspective === 'public') return publicMetrics
  if (perspective === 'investor') return investorMetrics
  return [
    ...investorMetrics,
    { label: 'Profiles', value: data?.learners, truth: data ? 'Live' : 'Pending', definition: 'All profile records. This is deliberately not labeled learners.' },
    { label: 'Child profiles', value: data?.kids, truth: data ? 'Live' : 'Pending', definition: 'Protected aggregate of child-role profiles.' },
    { label: 'Family circles', value: data?.familiesTotal, truth: data ? 'Live' : 'Pending', definition: 'Circle records whose kind is family.' },
    { label: 'Activity depth', value: data?.depth, truth: data ? 'Derived' : 'Pending', definition: 'Tracked seven-day activity events divided by weekly active profiles.' },
    { label: 'Learning accuracy', value: data?.accuracyPct, unit: '%', truth: data?.accuracyPct == null ? 'Pending' : 'Derived', definition: 'Correct item attempts over the current tracked window.' },
    { label: 'Tracked attempts', value: data?.attemptsTotal, truth: data ? 'Live' : 'Pending', definition: 'All item-attempt records currently stored.' },
  ]
}

function MetricTile({ metric }: { metric: Metric }) {
  const [open, setOpen] = useState(false)
  return (
    <article className={`metric-card reveal${metric.value == null ? ' metric-empty' : ''}`}>
      <div className="metric-top"><span>{metric.label}</span><TruthBadge status={metric.truth} /></div>
      <strong>{fmt(metric.value, metric.unit)}</strong>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        {open ? 'Hide definition' : 'View definition'}
      </button>
      {open && <p>{metric.definition}</p>}
    </article>
  )
}

function Pulse({
  perspective,
  data,
  loading,
  navigate,
}: {
  perspective: Perspective
  data: PitchData | null
  loading: boolean
  navigate: (path: string) => void
}) {
  const metrics = metricsFor(data, perspective)
  const updated = data?.generatedAt ? new Date(data.generatedAt) : null
  const freshness = updated ? Math.max(0, Date.now() - updated.getTime()) : null
  const fresh = freshness !== null && freshness < 5 * 60 * 1000

  return (
    <>
      <section className="page-hero chapter-hero pulse-hero">
        <div className="chapter-hero-copy reveal">
          <p className="eyebrow">Chapter 04 · Pulse</p>
          <h1>Truth has a <em>timestamp.</em></h1>
          <p>Every important number declares where it came from, what it means, how fresh it is and what it still cannot prove.</p>
          <div className={`live-state ${fresh ? 'fresh' : data ? 'stale' : 'offline'}`}>
            <span className="live-dot" />
            <strong>{loading ? 'Connecting to company data' : fresh ? 'Live company feed' : data ? 'Feed available · refresh delayed' : 'Live data unavailable'}</strong>
            {updated && <small>Updated {updated.toLocaleString()}</small>}
          </div>
        </div>
        <div className={`pulse-wave ${data ? 'active' : 'paused'}`} aria-hidden="true">
          <i /><i /><i /><i /><i /><i /><i /><i /><i /><i /><i />
        </div>
      </section>

      <section className="editorial-section metrics-section">
        <SectionHead
          index="04.1"
          eyebrow={`${perspective === 'public' ? 'Public proof' : perspective === 'investor' ? 'Partner proof' : 'Founder operating proof'}`}
          title="Measured now. Never mocked."
          copy="Unavailable values remain unavailable. A zero is shown only when the verified value is actually zero."
        />
        <div className="metrics-grid">
          {metrics.map((metric) => <MetricTile key={metric.label} metric={metric} />)}
        </div>
      </section>

      <section className="editorial-section evidence-section">
        <SectionHead
          index="04.2"
          eyebrow="Evidence hierarchy"
          title="A claim is only as useful as its label."
          copy="The interface distinguishes operating truth from researched context, forecasts and work that has not yet been instrumented."
        />
        <div className="truth-ledger reveal">
          {([
            ['Live', 'Directly returned by a current operational source.'],
            ['Verified', 'Checked against a named artifact, deployment or primary record.'],
            ['Derived', 'Calculated from visible definitions and source inputs.'],
            ['Reported', 'External context with source and publication date.'],
            ['Modeled', 'A scenario—not observed company performance.'],
            ['Planned', 'Approved direction with no completion claim.'],
            ['Pending', 'Not yet measured or not safe to assert.'],
          ] as [Truth, string][]).map(([status, description]) => (
            <div key={status}><TruthBadge status={status} /><p>{description}</p></div>
          ))}
        </div>
      </section>

      {perspective !== 'public' && (
        <section className="editorial-section battle-section">
          <div className="battle-card reveal">
            <p className="eyebrow">Battle test</p>
            <h2>The repository is evidence of capacity—not market validation.</h2>
            <div>
              <article><strong>Built</strong><p>Multiple deployed products, a shared data substrate, working builders and operating surfaces.</p></article>
              <article><strong>Unproven</strong><p>Representative retention, repeatable paid acquisition and external revenue at meaningful scale.</p></article>
              <article><strong>Next proof</strong><p>Repeated family ritual, referenceable expert delivery and reconciled economics.</p></article>
            </div>
          </div>
        </section>
      )}

      <ChapterCta
        eyebrow="Next chapter"
        title="Proof gives direction its shape."
        action="Follow the Trajectory"
        href="/trajectory"
        navigate={navigate}
      />
    </>
  )
}

function Trajectory({ perspective, navigate }: { perspective: Perspective; navigate: (path: string) => void }) {
  const horizons = [
    {
      phase: 'Now',
      label: 'Prove the ritual',
      items: ['Put real families inside a repeatable weekly loop', 'Finish the missing retention and activation instrumentation', 'Turn deployed surfaces into coherent product experiences'],
    },
    {
      phase: 'Next',
      label: 'Earn repeatability',
      items: ['Convert trusted use into payment evidence', 'Productize repeated Energy and Studio delivery', 'Publish referenceable outcomes and operating cost'],
    },
    {
      phase: 'Then',
      label: 'Compound the system',
      items: ['Scale only the loops that retain and contribute', 'Expand shared infrastructure where it improves margin', 'Build the trusted graph into durable advantage'],
    },
  ]
  return (
    <>
      <section className="page-hero chapter-hero trajectory-hero">
        <div className="chapter-hero-copy reveal">
          <p className="eyebrow">Chapter 05 · Trajectory</p>
          <h1>Direction is a series of <em>earned horizons.</em></h1>
          <p>Arganta does not need more possible futures. It needs the next proof that changes which future deserves capital.</p>
        </div>
        <div className="trajectory-orbit reveal" aria-hidden="true">
          <span className="trajectory-start" />
          <i />
          <i />
          <i />
          <b>Now</b>
          <b>Next</b>
          <b>Then</b>
        </div>
      </section>

      <section className="editorial-section horizon-section">
        <SectionHead
          index="05.1"
          eyebrow="90-day operating horizon"
          title="Move one evidence gate at a time."
          copy="Milestones are described by the evidence they must create, not the volume of work they contain."
        />
        <div className="horizon-grid">
          {horizons.map((horizon, index) => (
            <article key={horizon.phase} className="horizon-card reveal">
              <header><b>{String(index + 1).padStart(2, '0')}</b><span>{horizon.phase}</span></header>
              <h3>{horizon.label}</h3>
              <ul>{horizon.items.map((item) => <li key={item}>{item}</li>)}</ul>
            </article>
          ))}
        </div>
      </section>

      <section className="editorial-section gtm-section">
        <SectionHead
          index="05.2"
          eyebrow="Go-to-market"
          title="From one trusted circle outward."
          copy="Distribution begins with concentrated communities where feedback, trust and invitations can travel together."
        />
        <div className="gtm-path reveal">
          {[
            ['Invite', 'One useful family ritual gives another household a reason to join.'],
            ['Prove', 'Activation and retention are measured before acquisition is amplified.'],
            ['Concentrate', 'Doha and Indonesia offer warm, connected early communities.'],
            ['Expand', 'Classrooms, communities and partners reuse the trusted-circle substrate.'],
          ].map(([name, description], index) => (
            <article key={name}><b>{index + 1}</b><h3>{name}</h3><p>{description}</p></article>
          ))}
        </div>
      </section>

      {perspective !== 'public' && (
        <section className="editorial-section capital-section">
          <div className="capital-card reveal">
            <div>
              <p className="eyebrow">Capital discipline</p>
              <h2>Fund proof, not breadth.</h2>
            </div>
            <div>
              <article><TruthBadge status="Planned" /><h3>Product</h3><p>Deepen the few loops with observable return behavior.</p></article>
              <article><TruthBadge status="Planned" /><h3>Evidence</h3><p>Instrument retention, payment, delivery cost and quality.</p></article>
              <article><TruthBadge status="Modeled" /><h3>Scenario</h3><p>Financial outcomes remain scenario ranges until invoices and cohorts exist.</p></article>
            </div>
          </div>
        </section>
      )}

      <section className="closing-section">
        <div className="closing-mark"><PortfolioIcon id="arganta" size={92} color="#F2B544" /></div>
        <p className="eyebrow">Origin becomes trajectory</p>
        <h2>Build what deserves to exist.</h2>
        <p>Arganta is available today through its products—and still honest about the proof required tomorrow.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="mailto:hello@arganta.app">Start a conversation</a>
          <Link href="/worlds" navigate={navigate} className="button button-secondary">Explore the products</Link>
        </div>
      </section>
    </>
  )
}

function Settings({
  path,
  perspective,
  isOperator,
  authState,
  navigate,
  setPerspective,
}: {
  path: string
  perspective: Perspective
  isOperator: boolean
  authState: ReturnType<typeof useAuth>['state']
  navigate: (path: string) => void
  setPerspective: (perspective: Perspective) => void
}) {
  const { dark, set: setDark } = useTheme()
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  const login = async () => {
    setAuthBusy(true)
    setAuthError(null)
    localStorage.setItem('arganta-pending-perspective-v2', 'founder')
    try {
      await signInWithGoogle()
    } catch (error) {
      setAuthBusy(false)
      setAuthError(error instanceof Error ? error.message : 'Could not start sign in.')
    }
  }

  const section = path.split('/')[2] || 'overview'
  const settingsNav = [
    ['overview', '/settings', 'Settings'],
    ['perspective', '/settings/perspective', 'Perspective'],
    ['appearance', '/settings/appearance', 'Appearance'],
    ['access', '/settings/access', 'Founder Access'],
    ['legacy', '/settings/legacy', 'Legacy Landing'],
  ]

  return (
    <div className="settings-page">
      <header className="settings-mobile-back">
        <Link href="/" navigate={navigate}>← Company profile</Link>
      </header>
      <aside className="settings-sidebar">
        <div>
          <p className="eyebrow">Arganta</p>
          <h1>Settings</h1>
        </div>
        <nav aria-label="Settings sections">
          {settingsNav.map(([id, href, label]) => (
            <Link key={id} href={href} navigate={navigate} className={section === id || (section === 'overview' && id === 'overview') ? 'active' : ''}>
              <span>{label}</span><b>›</b>
            </Link>
          ))}
        </nav>
        <Link href="/" navigate={navigate} className="settings-return">← Return to profile</Link>
      </aside>

      <div className="settings-content">
        {(section === 'overview' || section === 'perspective') && (
          <section className="settings-panel">
            <p className="eyebrow">Perspective</p>
            <h2>Choose what matters to you.</h2>
            <p>One company truth, curated around the questions each audience needs answered.</p>
            <div className="settings-lenses">
              {([
                ['public', 'Explore', 'Purpose, products and public proof.'],
                ['investor', 'Partner', 'Market, architecture, risk and direction.'],
                ['founder', 'Founder', isOperator ? 'Complete company operating view.' : 'Protected operating perspective.'],
              ] as [Perspective, string, string][]).map(([id, name, description]) => (
                <button key={id} type="button" className={perspective === id ? 'active' : ''} onClick={() => setPerspective(id)}>
                  <PerspectiveAvatar perspective={id} />
                  <span><strong>{name}</strong><small>{description}</small></span>
                  {id === 'founder' && !isOperator && <i>Locked</i>}
                </button>
              ))}
            </div>
          </section>
        )}

        {(section === 'overview' || section === 'appearance') && (
          <section className="settings-panel">
            <p className="eyebrow">Appearance</p>
            <h2>Light by default. Dark when you choose it.</h2>
            <p>The landing never overrides the first visit based on operating-system preference.</p>
            <div className="theme-options">
              <button type="button" className={!dark ? 'active' : ''} onClick={() => setDark(false)}>
                <span className="theme-preview theme-light"><i /><i /><i /></span>
                <strong>Light</strong><small>Starpaper</small>
              </button>
              <button type="button" className={dark ? 'active' : ''} onClick={() => setDark(true)}>
                <span className="theme-preview theme-dark"><i /><i /><i /></span>
                <strong>Dark</strong><small>Night glass</small>
              </button>
            </div>
          </section>
        )}

        {(section === 'overview' || section === 'access') && (
          <section className="settings-panel access-panel">
            <p className="eyebrow">Founder Access</p>
            <h2>{isOperator ? 'Founder perspective is unlocked.' : 'Open the complete perspective.'}</h2>
            <p>{isOperator ? 'Internal operating proof and direct HQ access are available.' : 'Authenticate with the authorized Arganta account. Access is verified against the live operator role.'}</p>
            {!cloudEnabled ? (
              <div className="access-state pending"><span /><strong>Cloud authentication is not connected in this environment.</strong></div>
            ) : authState === 'loading' ? (
              <div className="access-state pending"><span /><strong>Checking access…</strong></div>
            ) : isOperator ? (
              <div className="access-actions">
                <div className="access-state verified"><span /><strong>Authorized · live</strong></div>
                <button type="button" className="button button-primary" onClick={() => setPerspective('founder')}>Use Founder perspective</button>
                <a className="button button-secondary" href="https://hq.arganta.app" target="_blank" rel="noreferrer">Open ArgantaHQ ↗</a>
                <button type="button" className="text-button" onClick={() => signOut()}>Sign out</button>
              </div>
            ) : (
              <div className="access-actions">
                {authState === 'denied' && <div className="access-state denied"><span /><strong>This account is not authorized for Founder access.</strong></div>}
                <button type="button" className="button button-primary google-button" onClick={login} disabled={authBusy}>
                  <GoogleMark /> {authBusy ? 'Opening…' : 'Continue with Google'}
                </button>
                {authError && <p className="settings-error">{authError}</p>}
                <small>Authentication identifies you. The database authorization check decides what you can view.</small>
              </div>
            )}
          </section>
        )}

        {(section === 'overview' || section === 'legacy') && (
          <section className="settings-panel legacy-panel">
            <p className="eyebrow">Legacy Landing</p>
            <h2>The previous experience, preserved.</h2>
            <p>The former Arganta Chat and company decks remain available in an isolated surface. Their visual runtime does not load with the new public profile.</p>
            <div className="legacy-preview">
              <iframe src="/legacy/#/about" title="Legacy Arganta landing preview" loading="lazy" />
              <div className="legacy-preview-bar"><span><i /><i /><i /></span><b>Legacy · preserved</b></div>
            </div>
            <a className="button button-secondary" href="/legacy/#/about">Open Legacy Landing</a>
          </section>
        )}
      </div>
    </div>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.77 24c0-1.6.27-3.14.76-4.59l-7.98-6.19A24 24 0 0 0 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  )
}

function ChapterCta({
  eyebrow,
  title,
  action,
  href,
  navigate,
}: {
  eyebrow: string
  title: string
  action: string
  href: string
  navigate: (path: string) => void
}) {
  return (
    <section className="chapter-cta reveal">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <Link href={href} navigate={navigate}>{action}<span>→</span></Link>
    </section>
  )
}

function App() {
  const [path, setPath] = useState(() => cleanPath(window.location.pathname))
  const [lensOpen, setLensOpen] = useState(false)
  const [perspective, setPerspectiveState] = useState<Perspective>(() => {
    const stored = localStorage.getItem('arganta-perspective-v2')
    return stored === 'investor' || stored === 'founder' ? stored : 'public'
  })
  const auth = useAuth()
  const { data, loading } = useHqPitch()

  const navigate = useCallback((nextPath: string) => {
    const [pathname, hash] = nextPath.split('#')
    const clean = cleanPath(pathname || '/')
    window.history.pushState({}, '', `${clean}${hash ? `#${hash}` : ''}`)
    setPath(clean)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    const onPopState = () => setPath(cleanPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  useEffect(() => {
    const old = window.location.hash.replace(/^#\/?/, '').split('/')[0]
    if (path === '/' && ['about', 'company', 'products', 'pitch', 'command', 'login'].includes(old)) {
      window.location.replace(`/legacy/${window.location.hash}`)
    }
  }, [path])

  useEffect(() => {
    document.title = PATH_TITLES[path] ?? 'Arganta — A living company system'
    const description = document.querySelector('meta[name="description"]')
    description?.setAttribute('content', 'Arganta is a connected product house for family growth, expert decisions and governed creation—grounded in real products and visible evidence.')
  }, [path])

  useEffect(() => {
    if (auth.isOperator && localStorage.getItem('arganta-pending-perspective-v2') === 'founder') {
      localStorage.removeItem('arganta-pending-perspective-v2')
      localStorage.setItem('arganta-perspective-v2', 'founder')
      setPerspectiveState('founder')
    }
  }, [auth.isOperator])

  const effectivePerspective: Perspective = perspective === 'founder' && !auth.isOperator ? 'public' : perspective

  const setPerspective = useCallback((next: Perspective) => {
    if (next === 'founder' && !auth.isOperator) {
      setLensOpen(false)
      navigate('/settings/access')
      return
    }
    localStorage.setItem('arganta-perspective-v2', next)
    setPerspectiveState(next)
    setLensOpen(false)
  }, [auth.isOperator, navigate])

  const content = useMemo(() => {
    if (path === '/worlds') return <Worlds perspective={effectivePerspective} navigate={navigate} />
    if (path === '/architecture') return <Architecture perspective={effectivePerspective} navigate={navigate} />
    if (path === '/pulse') return <Pulse perspective={effectivePerspective} data={data} loading={loading} navigate={navigate} />
    if (path === '/trajectory') return <Trajectory perspective={effectivePerspective} navigate={navigate} />
    if (path.startsWith('/settings')) {
      return (
        <Settings
          path={path}
          perspective={effectivePerspective}
          isOperator={auth.isOperator}
          authState={auth.state}
          navigate={navigate}
          setPerspective={setPerspective}
        />
      )
    }
    return <Origin perspective={effectivePerspective} navigate={navigate} />
  }, [path, effectivePerspective, navigate, data, loading, auth.isOperator, auth.state, setPerspective])

  if (path === '/legacy') {
    return (
      <div className="legacy-route">
        <a className="legacy-back glass" href="/settings/legacy">← New company profile</a>
        <Suspense fallback={<div className="legacy-loading"><PortfolioIcon id="arganta" size={54} color="#F2B544" /></div>}>
          <LegacyExperience />
        </Suspense>
      </div>
    )
  }

  return (
    <>
      <IconDefinitions />
      <GlobalShell
        path={path}
        perspective={effectivePerspective}
        navigate={navigate}
        onOpenLens={() => setLensOpen(true)}
      >
        {content}
      </GlobalShell>
      {lensOpen && (
        <LensDialog
          current={effectivePerspective}
          isOperator={auth.isOperator}
          onClose={() => setLensOpen(false)}
          onSelect={setPerspective}
        />
      )}
    </>
  )
}

export default App
