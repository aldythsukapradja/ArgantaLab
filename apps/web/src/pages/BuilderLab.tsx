import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '@store/appStore'
import { STYLE_OPTS, FEATURE_OPTS, buildPrompt, emptyForm, type PromptForm, type PromptSegment } from '@lib/promptBuilder'
import { saveMyGame, newGameId } from '@lib/myGames'
import DeviceFrame from '@components/build/DeviceFrame'

type Phase = 'compose' | 'scroll' | 'paste' | 'publish'

export default function BuilderLab() {
  const { requireAuth, addXp, addToast, go } = useAppStore()
  const [phase, setPhase] = useState<Phase>('compose')
  const [form, setForm] = useState<PromptForm>(emptyForm())
  const [code, setCode] = useState('')
  const [title, setTitle] = useState('')
  const [savedId, setSavedId] = useState<string | null>(null)

  const { segments, full } = buildPrompt(form)
  const set = (p: Partial<PromptForm>) => setForm(f => ({ ...f, ...p }))
  const toggleFeat = (k: string) =>
    setForm(f => ({ ...f, features: f.features.includes(k) ? f.features.filter(x => x !== k) : [...f.features, k] }))

  const looksLikeGame = /<html|<!doctype|<canvas|<script/i.test(code)
  const checks = buildChecks(code)

  const save = () => {
    const t = title.trim() || form.idea.trim() || 'My Pro-Code Game'
    const id = savedId || newGameId()
    saveMyGame({ id, title: t, source: 'procode', html: code, createdAt: Date.now(), plays: 0 })
    setSavedId(id)
    if (!savedId) addXp(60)
    addToast(`Published “${t}”!`, '🚀')
  }

  return (
    <div className="lab">
      <div className="lab-head">
        <div>
          <div className="kicker"><span className="live" />&nbsp;Builder Lab · Pro-Code</div>
          <h1 className="lab-title">{PHASE_TITLE[phase]}</h1>
        </div>
        <div className="lab-phases">
          {(['compose', 'scroll', 'paste', 'publish'] as Phase[]).map((p, i) => (
            <span key={p} className={`lab-dot${phase === p ? ' on' : ''}${stepIndex(phase) > i ? ' done' : ''}`}>{i + 1}</span>
          ))}
        </div>
      </div>

      {phase === 'compose' && (
        <Compose form={form} set={set} toggleFeat={toggleFeat}
          onNext={() => { if (requireAuth('to build games')) setPhase('scroll') }} />
      )}
      {phase === 'scroll' && (
        <Scroll segments={segments} full={full}
          onBack={() => setPhase('compose')} onNext={() => setPhase('paste')} addToast={addToast} />
      )}
      {phase === 'paste' && (
        <Paste code={code} setCode={setCode} looksLikeGame={looksLikeGame} checks={checks}
          onBack={() => setPhase('scroll')} onNext={() => setPhase('publish')} />
      )}
      {phase === 'publish' && (
        <Publish code={code} title={title} setTitle={setTitle} placeholder={form.idea || 'My Pro-Code Game'}
          saved={!!savedId} onSave={save} onBack={() => setPhase('paste')} onHome={() => go({ tab: 'arganta' })} />
      )}
    </div>
  )
}

const PHASE_TITLE: Record<Phase, string> = {
  compose: 'Describe your game', scroll: 'Read your master prompt', paste: 'Paste & preview', publish: 'Publish & share',
}
const stepIndex = (p: Phase) => ['compose', 'scroll', 'paste', 'publish'].indexOf(p)

/* ── Phase 1: Compose ── */
function Compose({ form, set, toggleFeat, onNext }: {
  form: PromptForm; set: (p: Partial<PromptForm>) => void; toggleFeat: (k: string) => void; onNext: () => void
}) {
  const ready = form.idea.trim().length > 2
  return (
    <div className="lab-body">
      <div className="lab-form">
        <Field label="🎯 What's your game idea?" value={form.idea} onChange={v => set({ idea: v })}
          placeholder="a ninja jumping across rooftops" />
        <Field label="👶 Who is it for?" value={form.audience} onChange={v => set({ audience: v })}
          placeholder="my little sister, age 6" />
        <Field label="🎮 What does the player do?" value={form.action} onChange={v => set({ action: v })}
          placeholder="tap to jump, don't fall off" />
        <Field label="🏆 When do you win?" value={form.winText} onChange={v => set({ winText: v })}
          placeholder="you reach 1000 points" />

        <div className="lab-field">
          <label>🎨 What should it look like?</label>
          <div className="lab-chips">
            {STYLE_OPTS.map(s => (
              <button key={s.key} className={`lab-chip${form.style === s.key ? ' on' : ''}`} onClick={() => set({ style: s.key })}>
                {s.emoji} {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="lab-field">
          <label>🛟 Must have… (pick any)</label>
          <div className="lab-chips">
            {FEATURE_OPTS.map(f => (
              <button key={f.key} className={`lab-chip${form.features.includes(f.key) ? ' on' : ''}`} onClick={() => toggleFeat(f.key)}>
                {f.emoji} {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="lab-nav">
        <span className="lab-hint-sm">Fill these in and we'll forge your prompt.</span>
        <button className="btn btn-primary" disabled={!ready} onClick={onNext}>Forge my prompt ⚡</button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="lab-field">
      <label>{label}</label>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  )
}

/* ── Phase 2: The Spell Scroll (creative read) ── */
function Scroll({ segments, full, onBack, onNext, addToast }: {
  segments: PromptSegment[]; full: string; onBack: () => void; onNext: () => void; addToast: (m: string, e?: string) => void
}) {
  const [active, setActive] = useState(-1)
  const [read, setRead] = useState(false)
  const [copied, setCopied] = useState(false)
  const refs = useRef<(HTMLDivElement | null)[]>([])
  const timer = useRef<number | undefined>(undefined)

  const readAloud = () => {
    setRead(false)
    let i = 0
    const tick = () => {
      setActive(i)
      refs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      i++
      if (i < segments.length) timer.current = window.setTimeout(tick, 2000)
      else { timer.current = window.setTimeout(() => { setActive(-1); setRead(true) }, 1800) }
    }
    tick()
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = async () => {
    try { await navigator.clipboard.writeText(full) } catch { /* ignore */ }
    setCopied(true); addToast('Prompt copied! Take it to Claude or ChatGPT.', '📋')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="lab-body">
      <div className="scroll-intro">
        <p>This is your <b>master prompt</b> — a magic spell made of the 5 Prompt Powers. Read each part, then copy the whole spell and give it to an AI builder.</p>
        <button className="btn btn-soft" onClick={readAloud}>📖 Read it to me</button>
      </div>

      <div className="scroll">
        {segments.map((s, i) => (
          <div key={i} ref={el => (refs.current[i] = el)} className={`rune${active === i ? ' lit' : ''}`}>
            <div className="rune-side">
              <span className="rune-emoji">{s.emoji}</span>
              <span className="rune-n">{i + 1}</span>
            </div>
            <div className="rune-body">
              <span className="rune-tag">{s.tag} · {s.power} power</span>
              <p className="rune-text">{s.text}</p>
              <p className="rune-note">💡 {s.note}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="lab-nav">
        <button className="btn btn-ghost" onClick={onBack}>← Edit answers</button>
        <div className="lab-nav-r">
          <button className={`btn ${copied ? 'btn-soft' : 'btn-primary'}`} onClick={copy}>{copied ? '✓ Copied!' : '📋 Copy the spell'}</button>
          <button className="btn btn-primary" disabled={!read && !copied} onClick={onNext}>I have the code →</button>
        </div>
      </div>
    </div>
  )
}

/* ── Phase 3: Paste & Preview ── */
function Paste({ code, setCode, looksLikeGame, checks, onBack, onNext }: {
  code: string; setCode: (v: string) => void; looksLikeGame: boolean
  checks: { ok: boolean; msg: string }[]; onBack: () => void; onNext: () => void
}) {
  return (
    <div className="lab-body lab-paste">
      <div className="paste-col">
        <label className="lab-field-label">Paste the code the AI gave you</label>
        <textarea className="paste-area" value={code} onChange={e => setCode(e.target.value)}
          placeholder={'<!DOCTYPE html>\n<html>\n  … paste your game here …\n</html>'} spellCheck={false} />
        <div className="paste-checks">
          {!code ? <span className="chk">Paste your game to see it come alive →</span>
            : checks.map((c, i) => <span key={i} className={`chk ${c.ok ? 'ok' : 'warn'}`}>{c.ok ? '✓' : '⚠'} {c.msg}</span>)}
        </div>
      </div>
      <div className="preview-col">
        {looksLikeGame
          ? <DeviceFrame html={code} />
          : <div className="preview-empty"><div className="pe-emoji">🎮</div><b>Your game will appear here</b><span>Paste the HTML and switch between Desktop, iPad, and iPhone.</span></div>}
      </div>
      <div className="lab-nav lab-nav-full">
        <button className="btn btn-ghost" onClick={onBack}>← Back to prompt</button>
        <button className="btn btn-primary" disabled={!looksLikeGame} onClick={onNext}>Publish it →</button>
      </div>
    </div>
  )
}

/* ── Phase 4: Publish ── */
function Publish({ code, title, setTitle, placeholder, saved, onSave, onBack, onHome }: {
  code: string; title: string; setTitle: (v: string) => void; placeholder: string
  saved: boolean; onSave: () => void; onBack: () => void; onHome: () => void
}) {
  return (
    <div className="lab-body lab-paste">
      <div className="preview-col"><DeviceFrame html={code} /></div>
      <div className="paste-col">
        <label className="lab-field-label">Name your game</label>
        <input className="wiz-name" value={title} placeholder={placeholder} onChange={e => setTitle(e.target.value)} />
        {!saved ? (
          <button className="btn btn-primary wiz-save" onClick={onSave}>🚀 Publish to My Games (+60 XP)</button>
        ) : (
          <div className="lab-shared">
            <div className="wiz-saved">✓ Published! It's in your Game Collection.</div>
            <button className="btn btn-ghost" onClick={onHome}>See my games →</button>
          </div>
        )}
        <p className="lab-hint-sm">Pro-Code games save to your collection. Cloud share links arrive with the marketplace update.</p>
      </div>
      <div className="lab-nav lab-nav-full">
        <button className="btn btn-ghost" onClick={onBack}>← Back to preview</button>
      </div>
    </div>
  )
}

function buildChecks(code: string): { ok: boolean; msg: string }[] {
  if (!code) return []
  return [
    { ok: /<html|<!doctype/i.test(code), msg: 'It is an HTML page' },
    { ok: /<script/i.test(code), msg: 'It has game code (JavaScript)' },
    { ok: !/https?:\/\/(?!localhost)/i.test(code), msg: /https?:\/\/(?!localhost)/i.test(code) ? 'Uses the internet — ask the AI to make it ONE file' : 'It is self-contained' },
  ]
}
