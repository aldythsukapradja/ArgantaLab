// About — the public company page (F5). The old landing survives here as pills;
// each pill mounts an existing deck untouched. The operator `command` tab is gone.
import { lazy, Suspense, useState } from 'react'
import { Mark } from './Mark'

const GeneralDeck = lazy(() => import('../decks/GeneralDeck'))
const EditorialDeck = lazy(() => import('../decks/EditorialDeck'))

type Pill = 'company' | 'about' | 'products' | 'pitch'
const PILLS: { id: Pill; label: string }[] = [
  { id: 'company', label: 'Company Profile' },
  { id: 'about', label: 'About' },
  { id: 'products', label: 'Products' },
  { id: 'pitch', label: 'Pitch' },
]

export function About({ initial = 'about', onOpenChat }: { initial?: Pill; onOpenChat: () => void }) {
  const [pill, setPill] = useState<Pill>(initial)
  const [deck, setDeck] = useState<null | { kind: 'general' | 'editorial'; flight?: string }>(null)

  if (deck) {
    const exit = () => setDeck(null)
    return (
      <Suspense fallback={<div className="ac-root"><div className="ac-loading"><Mark size={40} /></div></div>}>
        {deck.kind === 'general' ? <GeneralDeck flight={deck.flight} onExit={exit} /> : <EditorialDeck present={false} onExit={exit} />}
      </Suspense>
    )
  }

  return (
    <div className="ac-root">
      <div className="ac-col">
        <div className="ac-top">
          <div className="ac-top-left"><Mark size={26} breathe="off" /><span className="ac-wordmark">Arganta</span></div>
          <button className="ac-ghost" onClick={onOpenChat}>Open Arganta Chat</button>
        </div>

        <div className="ac-about-pills">
          {PILLS.map(p => (
            <button key={p.id} className={'ac-pill' + (pill === p.id ? ' ac-pill--active' : '')} onClick={() => setPill(p.id)}>{p.label}</button>
          ))}
        </div>

        <div className="ac-about-body">
          {pill === 'about' && (
            <section>
              <h1 className="ac-greeting" style={{ textAlign: 'left' }}>The family’s second brain.</h1>
              <p style={{ color: 'var(--ink-soft)', marginTop: 12, fontSize: 18, lineHeight: 1.6 }}>
                Arganta keeps up with your family’s calendar, the kids’ learning, meals, trips and the budget —
                and answers the way you’d ask a friend. One warm place, no dashboards to learn.
              </p>
              <button className="ac-pill ac-pill--active" style={{ marginTop: 24 }} onClick={onOpenChat}>Open Arganta Chat →</button>
            </section>
          )}
          {pill === 'company' && (
            <section>
              <h1 className="ac-greeting" style={{ textAlign: 'left' }}>Arganta</h1>
              <p style={{ color: 'var(--ink-soft)', marginTop: 12, fontSize: 18, lineHeight: 1.6 }}>
                The company behind KinetikCircle, KinQuest and LashiraBloom — building a family operating system
                where kids learn through play and parents get a second brain.
              </p>
              <button className="ac-pill" style={{ marginTop: 24 }} onClick={() => setDeck({ kind: 'general' })}>See the full story →</button>
            </section>
          )}
          {pill === 'products' && (
            <section>
              <h1 className="ac-greeting" style={{ textAlign: 'left' }}>Products</h1>
              <p style={{ color: 'var(--ink-soft)', marginTop: 12, fontSize: 18 }}>Explore the Arganta family of apps.</p>
              <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
                <button className="ac-pill" onClick={() => setDeck({ kind: 'general', flight: 'kinetik' })}>KinetikCircle</button>
                <button className="ac-pill" onClick={() => setDeck({ kind: 'general', flight: 'kinquest' })}>KinQuest</button>
                <button className="ac-pill" onClick={() => setDeck({ kind: 'editorial' })}>Editorial deck</button>
              </div>
            </section>
          )}
          {pill === 'pitch' && (
            <section>
              <h1 className="ac-greeting" style={{ textAlign: 'left' }}>Pitch</h1>
              <p style={{ color: 'var(--ink-soft)', marginTop: 12, fontSize: 18 }}>The investor story, in one flight.</p>
              <button className="ac-pill ac-pill--active" style={{ marginTop: 20 }} onClick={() => setDeck({ kind: 'general' })}>Open the pitch →</button>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

export type { Pill }
