import { lazy, Suspense } from 'react'
import { ThemeToggle, useTheme } from './theme'

const HubBg = lazy(() => import('./three/HubBg'))

interface DeckCard { id: string; no: string; name: string; tag: string; desc: string; live: boolean; kind: 'modes' | 'open' }

const DECKS: DeckCard[] = [
  { id: 'editorial', no: '01', name: 'Editorial', tag: 'Cinematic scroll', desc: 'The story, told slow and confident. Smooth-scroll, editorial type, the real product in your hand.', live: true, kind: 'modes' },
  { id: 'general', no: '02', name: 'General', tag: 'Interactive deck', desc: 'The full cinematic flight — every world, product and idea, as a camera that travels the cosmos.', live: true, kind: 'open' },
  { id: 'pitch', no: '03', name: 'Investor one-pager', tag: 'Coming soon', desc: 'The tight, proof-first version — one metric, one ask, five minutes.', live: false, kind: 'open' },
]

function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="2.3" />
      <circle cx="16" cy="8" r="2.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    </svg>
  )
}

export default function Hub({ onOpen }: { onOpen: (id: string, present: boolean) => void }) {
  const { dark } = useTheme()
  return (
    <div className="hubx">
      <Suspense fallback={null}><HubBg dark={dark} /></Suspense>

      <header className="hubx-nav">
        <span className="hubx-brand"><Mark /> Arganta</span>
        <ThemeToggle />
      </header>

      <section className="hubx-hero">
        <span className="hubx-kicker">The Arganta presentations</span>
        <h1 className="hubx-title">One idea,<br /><em>told a few different ways.</em></h1>
        <p className="hubx-lede">Pick an experience below.</p>
      </section>

      <section className="hubx-decks">
        {DECKS.map(d => (
          <article key={d.id} className={`deckcard${d.live ? '' : ' soon'}`}>
            <span className="deck-no">{d.no}</span>
            <div className="deck-main">
              <div className="deck-top">
                <h2 className="deck-name">{d.name}</h2>
                <span className="deck-tag">{d.tag}</span>
              </div>
              <p className="deck-desc">{d.desc}</p>
            </div>
            {d.live ? (
              <div className="deck-actions">
                {d.kind === 'modes' ? (
                  <>
                    <button className="deck-btn" onClick={() => onOpen(d.id, false)}>Scroll</button>
                    <button className="deck-btn primary" onClick={() => onOpen(d.id, true)}>Present ▸</button>
                  </>
                ) : (
                  <button className="deck-btn primary" onClick={() => onOpen(d.id, false)}>Open →</button>
                )}
              </div>
            ) : <span className="deck-soon">Soon</span>}
          </article>
        ))}
      </section>

      <footer className="hubx-foot">
        <span>Built by parents. Designed for families everywhere.</span>
        <a href="mailto:hello@arganta.app">hello@arganta.app</a>
      </footer>
    </div>
  )
}
