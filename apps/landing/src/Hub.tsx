import { lazy, Suspense } from 'react'
import { ThemeToggle, useTheme } from './theme'

const HubBg = lazy(() => import('./three/HubBg'))

interface DeckCard { id: string; no: string; name: string; tag: string; desc: string; live: boolean; kind: 'modes' | 'open' }

const DECKS: DeckCard[] = [
  { id: 'editorial', no: '01', name: 'The story', tag: 'For everyone', desc: 'The cinematic version — the fastest way to feel what we build. Best for a first look.', live: true, kind: 'modes' },
  { id: 'general', no: '02', name: 'The product tour', tag: 'For families & partners', desc: 'The full interactive flight — every product, world and idea, up close.', live: true, kind: 'open' },
  { id: 'onepager', no: '03', name: 'The investor brief', tag: 'For investors', desc: 'Thesis, market, model, moat, traction and the ask — the five-minute version.', live: true, kind: 'open' },
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

      <div className="hubx-body">
      <section className="hubx-hero">
        <span className="hubx-kicker">Arganta · company profile</span>
        <h1 className="hubx-title">One trusted OS for<br /><em>the modern family.</em></h1>
        <p className="hubx-lede">For the families we build for, the partners we grow with, and the investors backing the future of the family. Choose how you'd like to explore.</p>
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
                    <button className="deck-btn" onClick={() => onOpen(d.id, false)}>View</button>
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
      </div>

      <footer className="hubx-foot">
        <span>Built by parents. Designed for families everywhere.</span>
        <a href="mailto:hello@arganta.app">hello@arganta.app</a>
      </footer>
    </div>
  )
}
