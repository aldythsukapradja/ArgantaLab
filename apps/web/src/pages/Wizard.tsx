import { useMemo, useState } from 'react'
import { useAppStore } from '@store/appStore'
import {
  GAME_TYPES, WORLDS, CHARACTERS, STYLES, SPEEDS, DIFFICULTIES, POWERUPS,
  STEP_HINTS, STEPS, defaultConfig, suggestTitle, type Opt, type WizardConfig,
} from '@/data/wizard'
import { generateGame } from '@lib/gameGen'
import { saveMyGame, newGameId, type SavedGame } from '@lib/myGames'
import { pushGame } from '@lib/gamesCloud'

const WORLD_BG: Record<string, string> = {
  space: 'linear-gradient(135deg,#0a0e27,#1a1147)', ocean: 'linear-gradient(135deg,#012a4a,#01497c)',
  volcano: 'linear-gradient(135deg,#2b0a0a,#6a1212)', ice: 'linear-gradient(135deg,#0a2a3a,#16526b)',
  jungle: 'linear-gradient(135deg,#0c2a12,#1a4d24)', city: 'linear-gradient(135deg,#0a0a1a,#241047)',
}

export default function Wizard() {
  const { requireAuth, addXp, addToast, go, ownsItem, buyItem, session } = useAppStore()
  const [step, setStep] = useState(0)
  const [cfg, setCfg] = useState<WizardConfig>(defaultConfig())
  const [savedId, setSavedId] = useState<string | null>(null)

  const stepKey = STEPS[step]
  const hint = STEP_HINTS[stepKey]

  const set = (patch: Partial<WizardConfig>) => setCfg(c => ({ ...c, ...patch }))
  const togglePU = (k: string) =>
    setCfg(c => ({ ...c, powerups: c.powerups.includes(k) ? c.powerups.filter(p => p !== k) : [...c.powerups, k] }))

  const canNext =
    stepKey === 'type' ? !!cfg.type :
    stepKey === 'world' ? !!cfg.world :
    stepKey === 'character' ? !!cfg.character :
    true

  const html = useMemo(
    () => (stepKey === 'play' ? generateGame({ ...cfg, title: cfg.title || suggestTitle(cfg) }) : ''),
    [stepKey, cfg],
  )

  const next = () => {
    if (step === 0 && !requireAuth('to build games')) return
    setStep(s => Math.min(STEPS.length - 1, s + 1))
  }
  const back = () => setStep(s => Math.max(0, s - 1))
  const restart = () => { setCfg(defaultConfig()); setStep(0); setSavedId(null) }

  const save = () => {
    const title = cfg.title || suggestTitle(cfg)
    const id = savedId || newGameId()
    const game: SavedGame = { id, title, source: 'wizard', config: { ...cfg, title }, html: generateGame({ ...cfg, title }), createdAt: Date.now(), plays: 0 }
    saveMyGame(game)
    if (session && session !== 'loading') pushGame(session.user.id, game)
    setSavedId(id)
    if (!savedId) addXp(40)
    addToast(`Saved “${title}” to your games!`, '🎮')
  }

  return (
    <div className="wiz">
      <div className="wiz-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Game Wizard</div>
          <h1 className="wiz-title">{stepKey === 'play' ? 'Your game is ready! 🎉' : 'Build a game'}</h1>
        </div>
        <BuildChip cfg={cfg} />
      </div>

      <div className="wiz-steps">
        {STEPS.map((s, i) => (
          <button key={s} className={`wiz-pip${i === step ? ' on' : ''}${i < step ? ' done' : ''}`}
            onClick={() => i < step && setStep(i)} disabled={i > step}>
            <i />
          </button>
        ))}
      </div>

      <div className="wiz-body">
        {stepKey === 'type' && <Picker title="What kind of game?" opts={GAME_TYPES} value={cfg.type} onPick={k => set({ type: k })} showNote />}
        {stepKey === 'world' && <Picker title="Where does it happen?" opts={WORLDS} value={cfg.world} onPick={k => set({ world: k })} grid
          owns={ownsItem} buy={(o) => buyItem(o.key, o.price ?? 0, o.label)} />}
        {stepKey === 'character' && <Picker title="Who is your hero?" opts={CHARACTERS} value={cfg.character} onPick={k => set({ character: k })} grid
          owns={ownsItem} buy={(o) => buyItem(o.key, o.price ?? 0, o.label)} />}
        {stepKey === 'style' && <Picker title="Pick your look" opts={STYLES} value={cfg.style} onPick={k => set({ style: k })} grid />}
        {stepKey === 'settings' && (
          <div className="wiz-section">
            <Picker title="How fast?" opts={SPEEDS} value={cfg.speed} onPick={k => set({ speed: k })} grid small />
            <Picker title="How hard?" opts={DIFFICULTIES} value={cfg.difficulty} onPick={k => set({ difficulty: k })} grid small />
          </div>
        )}
        {stepKey === 'powerups' && (
          <MultiPicker title="Pick your power-ups (any number)" opts={POWERUPS} values={cfg.powerups} onToggle={togglePU} />
        )}
        {stepKey === 'play' && (
          <PlayStep cfg={cfg} html={html} saved={!!savedId} onSave={save} onTitle={t => set({ title: t })}
            suggested={suggestTitle(cfg)} onPlayCatalogue={() => go({ tab: 'arganta' })} />
        )}

        {hint && stepKey !== 'play' && (
          <div className="wiz-hint">
            <span className="wiz-hint-tag">{hint.tag}</span>
            <p>{hint.text}</p>
          </div>
        )}
      </div>

      <div className="wiz-nav">
        <button className="btn btn-ghost" onClick={step === 0 ? restart : back}>{step === 0 ? 'Reset' : '← Back'}</button>
        {stepKey !== 'play'
          ? <button className="btn btn-primary" disabled={!canNext} onClick={next}>{step === STEPS.length - 2 ? 'Build it! ⚡' : 'Next →'}</button>
          : <button className="btn btn-ghost" onClick={restart}>Make another</button>}
      </div>
    </div>
  )
}

/* live mini-preview of the build so far */
function BuildChip({ cfg }: { cfg: WizardConfig }) {
  if (!cfg.type && !cfg.world && !cfg.character) return null
  const char = CHARACTERS.find(c => c.key === cfg.character)?.emoji
  return (
    <div className="wiz-chip" style={{ background: WORLD_BG[cfg.world] || 'var(--panel)' }}>
      <span className="wiz-chip-char">{char || '✨'}</span>
      <div className="wiz-chip-meta">
        <b>{cfg.title || suggestTitle(cfg)}</b>
        <span>{[GAME_TYPES.find(t => t.key === cfg.type)?.label, WORLDS.find(w => w.key === cfg.world)?.label].filter(Boolean).join(' · ')}</span>
      </div>
    </div>
  )
}

function Picker({ title, opts, value, onPick, grid, small, showNote, owns, buy }: {
  title: string; opts: Opt[]; value: string; onPick: (k: string) => void
  grid?: boolean; small?: boolean; showNote?: boolean
  owns?: (k: string) => boolean; buy?: (o: Opt) => boolean
}) {
  const handle = (o: Opt) => {
    const locked = !!o.price && owns && !owns(o.key)
    if (locked) { if (buy && buy(o)) onPick(o.key); return }
    onPick(o.key)
  }
  return (
    <div className="wiz-pick">
      <h2 className="wiz-q">{title}</h2>
      <div className={`wiz-opts${grid ? ' grid' : ''}${small ? ' small' : ''}`}>
        {opts.map(o => {
          const locked = !!o.price && owns && !owns(o.key)
          return (
            <button key={o.key} className={`wiz-opt${value === o.key ? ' sel' : ''}${locked ? ' locked' : ''}${o.rarity ? ' ' + o.rarity : ''}`} onClick={() => handle(o)}>
              {o.rarity && <span className="wiz-opt-rarity">{o.rarity}</span>}
              <span className="wiz-opt-e">{o.emoji}</span>
              <span className="wiz-opt-l">{o.label}</span>
              {showNote && o.note && <span className="wiz-opt-n">{o.note}</span>}
              {locked && <span className="wiz-opt-price">💎 {o.price}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MultiPicker({ title, opts, values, onToggle }: {
  title: string; opts: Opt[]; values: string[]; onToggle: (k: string) => void
}) {
  return (
    <div className="wiz-pick">
      <h2 className="wiz-q">{title}</h2>
      <div className="wiz-opts grid">
        {opts.map(o => (
          <button key={o.key} className={`wiz-opt${values.includes(o.key) ? ' sel' : ''}`} onClick={() => onToggle(o.key)}>
            <span className="wiz-opt-check">{values.includes(o.key) ? '✓' : ''}</span>
            <span className="wiz-opt-e">{o.emoji}</span>
            <span className="wiz-opt-l">{o.label}</span>
            {o.note && <span className="wiz-opt-n">{o.note}</span>}
          </button>
        ))}
      </div>
    </div>
  )
}

function PlayStep({ cfg, html, saved, onSave, onTitle, suggested, onPlayCatalogue }: {
  cfg: WizardConfig; html: string; saved: boolean; onSave: () => void
  onTitle: (t: string) => void; suggested: string; onPlayCatalogue: () => void
}) {
  return (
    <div className="wiz-play">
      <div className="wiz-frame">
        <iframe title="game preview" srcDoc={html} sandbox="allow-scripts allow-pointer-lock" />
      </div>
      <div className="wiz-panel">
        <label className="wiz-label">Name your game</label>
        <input className="wiz-name" value={cfg.title} placeholder={suggested} onChange={e => onTitle(e.target.value)} />
        <div className="wiz-summary">
          {[
            ['Type', GAME_TYPES.find(t => t.key === cfg.type)?.label],
            ['World', WORLDS.find(w => w.key === cfg.world)?.label],
            ['Hero', CHARACTERS.find(c => c.key === cfg.character)?.label],
            ['Style', STYLES.find(s => s.key === cfg.style)?.label],
            ['Speed', SPEEDS.find(s => s.key === cfg.speed)?.label],
            ['Power-ups', cfg.powerups.length ? cfg.powerups.length : 'None'],
          ].map(([k, v]) => <div key={k as string} className="wiz-sum"><span>{k}</span><b>{v}</b></div>)}
        </div>
        {!saved
          ? <button className="btn btn-primary wiz-save" onClick={onSave}>💾 Save to My Games (+40 XP)</button>
          : <>
              <div className="wiz-saved">✓ Saved! Find it in your Game Collection.</div>
              <button className="btn btn-ghost" onClick={onPlayCatalogue}>Go to my games →</button>
            </>}
      </div>
    </div>
  )
}
