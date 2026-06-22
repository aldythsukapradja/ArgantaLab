import { useState } from 'react'
import { useAppStore } from '@store/appStore'
import {
  PITCH_TEMPLATES, PITCH_SLIDES, TEMPLATE_BY_KEY, loadPitches, savePitch, deletePitch, newPitch,
  type PitchDeck, type PitchTemplate,
} from '@lib/pitch'
import PitchPresent from '@components/pitch/PitchPresent'

type Mode = 'pick' | 'edit'

export default function PitchBuilder() {
  const { learnerName, addToast } = useAppStore()
  const [mode, setMode] = useState<Mode>('pick')
  const [deck, setDeck] = useState<PitchDeck | null>(null)
  const [decks, setDecks] = useState<PitchDeck[]>(() => loadPitches())
  const [present, setPresent] = useState<PitchDeck | null>(null)

  const startNew = (tpl: PitchTemplate) => { setDeck(newPitch(tpl.key, learnerName)); setMode('edit') }
  const editExisting = (d: PitchDeck) => { setDeck(d); setMode('edit') }

  const commit = (d: PitchDeck) => { setDeck(d) }
  const saveAndExit = (d: PitchDeck) => {
    if (!d.title.trim()) d.title = d.slides.title || 'My Game'
    setDecks(savePitch(d)); setMode('pick'); addToast('Pitch saved! 🎤', '✨')
  }
  const remove = (id: string) => setDecks(deletePitch(id))

  if (present) return <PitchPresent deck={present} onExit={() => setPresent(null)} />

  if (mode === 'edit' && deck) {
    return <Editor deck={deck} onChange={commit} onSave={saveAndExit} onCancel={() => setMode('pick')} onPresent={setPresent} />
  }

  return (
    <div className="screen pitch" style={{ justifyContent: 'flex-start', gap: 16 }}>
      <div>
        <div className="kicker"><span className="live" />&nbsp;Pitch Studio</div>
        <h1 className="h-title" style={{ marginTop: 8 }}>Pitch your <span className="g">game</span></h1>
        <p className="lead">Pick a stage, fill in 6 slides, then press <b>Present</b> for a fancy animated show — just like a real founder.</p>
      </div>

      <div className="section-label">Choose your stage</div>
      <div className="pitch-templates">
        {PITCH_TEMPLATES.map(t => (
          <button key={t.key} className="pitch-tpl" onClick={() => startNew(t)}
            style={{ ['--c1' as string]: t.c1, ['--c2' as string]: t.c2 }}>
            <div className="pitch-tpl-inner">
              <div className="pitch-tpl-front">
                <span className="pitch-tpl-emoji">{t.emoji}</span>
                <b>{t.name}</b>
              </div>
              <div className="pitch-tpl-back">
                <p>{t.tagline}</p>
                <span className="pitch-tpl-go">Start ▶</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      {decks.length > 0 && (
        <>
          <div className="section-label">My pitches</div>
          <div className="pitch-saved">
            {decks.map(d => {
              const t = TEMPLATE_BY_KEY[d.template]
              return (
                <div key={d.id} className="pitch-saved-card" style={{ borderColor: `${t?.c1}55` }}>
                  <span className="pitch-saved-emoji" style={{ background: `${t?.c1}22` }}>{d.emoji}</span>
                  <div className="pitch-saved-meta"><b>{d.title || 'Untitled'}</b><small>{t?.name}</small></div>
                  <button className="pitch-saved-play" style={{ background: t?.c1 }} onClick={() => setPresent(d)}>▶ Present</button>
                  <button className="pitch-saved-edit" onClick={() => editExisting(d)}>✏️</button>
                  <button className="pitch-saved-del" onClick={() => remove(d.id)}>✕</button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Editor ────────────────────────────────────────────────────
function Editor({ deck, onChange, onSave, onCancel, onPresent }: {
  deck: PitchDeck; onChange: (d: PitchDeck) => void; onSave: (d: PitchDeck) => void
  onCancel: () => void; onPresent: (d: PitchDeck) => void
}) {
  const t = TEMPLATE_BY_KEY[deck.template]
  const [slide, setSlide] = useState(0)
  const cur = PITCH_SLIDES[slide]
  const set = (val: string) => {
    const slides = { ...deck.slides, [cur.key]: val }
    onChange({ ...deck, slides, title: cur.key === 'title' ? val : deck.title })
  }
  const filled = PITCH_SLIDES.filter(s => deck.slides[s.key]?.trim()).length

  return (
    <div className="screen pitch-edit" style={{ ['--c1' as string]: t.c1, ['--c2' as string]: t.c2, justifyContent: 'flex-start', gap: 14 }}>
      <div className="pitch-edit-head">
        <button className="le-back" onClick={onCancel}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg></button>
        <div><b>{t.emoji} {t.name}</b><small>{filled}/6 slides filled</small></div>
        <button className="pitch-present-btn" onClick={() => onPresent(deck)}>▶ Present</button>
      </div>

      {/* themed live preview of the current slide */}
      <div className="pitch-edit-preview" style={{ background: `linear-gradient(140deg, ${t.c1}, ${t.c2})` }}>
        <span className="pitch-edit-num">{slide + 1}/6</span>
        <span className="pitch-edit-emoji">{t.emoji}</span>
        <div className="pitch-edit-label">{cur.label}</div>
        <div className="pitch-edit-text">{deck.slides[cur.key] || cur.hint}</div>
      </div>

      <div className="pitch-edit-slides">
        {PITCH_SLIDES.map((s, i) => (
          <button key={s.key} className={`pitch-edit-chip${slide === i ? ' on' : ''}${deck.slides[s.key]?.trim() ? ' done' : ''}`}
            onClick={() => setSlide(i)}>{i + 1}</button>
        ))}
      </div>

      <label className="pitch-edit-field">
        <b>{cur.label}</b>
        <span>{cur.hint}</span>
        {cur.key === 'title'
          ? <input className="le-input" value={deck.slides[cur.key] || ''} onChange={e => set(e.target.value)} placeholder={cur.hint} maxLength={40} />
          : <textarea className="le-input pitch-edit-ta" value={deck.slides[cur.key] || ''} onChange={e => set(e.target.value)} placeholder={cur.hint} maxLength={160} rows={3} />}
      </label>

      <div className="pitch-edit-nav">
        <button className="btn btn-ghost" disabled={slide === 0} onClick={() => setSlide(s => s - 1)}>← Back</button>
        {slide < 5
          ? <button className="btn btn-primary" onClick={() => setSlide(s => s + 1)}>Next →</button>
          : <button className="btn btn-primary" onClick={() => onSave(deck)}>💾 Save pitch</button>}
      </div>
    </div>
  )
}
