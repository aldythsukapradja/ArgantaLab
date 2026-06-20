import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useAppStore } from '@store/appStore'
import { CINEMATIC_LESSONS } from '@/data/cinematic'
import { PF_GATES, PF_FINAL, PF_SUMMARY, type PFGate } from '@/data/promptForge'
import { createWorld, type CinematicWorld } from './worlds'

const Close = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
const Back = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>

type Phase = 'intro' | 'bigidea' | 'map' | 'gate' | 'final' | 'done'
const CAM: Record<Phase, string> = { intro: 'orbit', bigidea: 'approach', map: 'orbit', gate: 'terminal', final: 'core', done: 'orbit' }
const LESSON_ID = 'ai/prompt-power'

export default function PromptForge() {
  const { go, completeLesson, addXp, addToast, completedLessons } = useAppStore()
  const lesson = CINEMATIC_LESSONS[LESSON_ID]

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const worldRef = useRef<CinematicWorld | null>(null)
  const [phase, setPhase] = useState<Phase>('intro')
  const [gateIdx, setGateIdx] = useState(0)
  const [doneGates, setDoneGates] = useState<number[]>([])

  useEffect(() => {
    document.body.classList.add('cine-mode')
    if (!canvasRef.current) return () => document.body.classList.remove('cine-mode')
    const w = createWorld('neural', canvasRef.current)
    worldRef.current = w
    const onResize = () => w.resize()
    window.addEventListener('resize', onResize)
    return () => { document.body.classList.remove('cine-mode'); window.removeEventListener('resize', onResize); w.dispose(); worldRef.current = null }
  }, [])

  useEffect(() => {
    const w = worldRef.current
    if (!w) return
    w.goTo(CAM[phase])
    w.spotlight(phase === 'gate' || phase === 'final' || phase === 'done')
    if (phase === 'done') w.pulse()
    gsap.fromTo('.pf-stage', { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, ease: 'power2.out' })
  }, [phase, gateIdx])

  const allDone = doneGates.length === PF_GATES.length
  const finishLesson = () => {
    if (!completedLessons.includes(LESSON_ID)) { completeLesson(LESSON_ID); addXp(lesson?.xp ?? 50) }
    go({ lessonId: null })
  }
  const completeGate = (i: number, badge: string) => {
    if (!doneGates.includes(i)) { setDoneGates(d => [...d, i]); addToast(`Badge: ${badge}`, '🏅') }
    setPhase('map')
  }

  return (
    <div className="cine pf">
      <canvas ref={canvasRef} className="cine-canvas" />
      <div className="cine-grad" />

      <div className="cine-top">
        <button className="cine-x" onClick={() => go({ lessonId: null })}><Close /></button>
        <div className="cine-loc">
          <b>Prompt Forge</b>
          <span>The 5 Prompt Powers · {doneGates.length}/{PF_GATES.length} unlocked</span>
        </div>
        <span className="cine-xp">+{lesson?.xp ?? 50} XP</span>
      </div>

      <div className="pf-stage" key={phase + gateIdx}>
        {phase === 'intro' && <Intro onStart={() => setPhase('bigidea')} />}
        {phase === 'bigidea' && <BigIdea onNext={() => setPhase('map')} />}
        {phase === 'map' && (
          <GateMap
            doneGates={doneGates}
            allDone={allDone}
            onPick={(i) => { setGateIdx(i); setPhase('gate') }}
            onFinal={() => setPhase('final')}
          />
        )}
        {phase === 'gate' && (
          <Gate
            gate={PF_GATES[gateIdx]}
            onDone={(badge) => completeGate(gateIdx, badge)}
            onBack={() => setPhase('map')}
          />
        )}
        {phase === 'final' && <Final onDone={() => setPhase('done')} onBack={() => setPhase('map')} />}
        {phase === 'done' && <Done onFinish={finishLesson} />}
      </div>
    </div>
  )
}

/* ── Intro ── */
function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="pf-center">
      <div className="cs-emoji">🤖</div>
      <div className="cs-badge">PROMPT FORGE</div>
      <h1 className="cs-headline">Welcome to the Prompt Forge.</h1>
      <p className="pf-lead">AI can build fast. But if your idea is messy, the result becomes messy too. Today you learn the five powers of great prompting.</p>
      <button className="btn btn-primary pf-cta" onClick={onStart}>Start Mission →</button>
    </div>
  )
}

/* ── Big Idea ── */
function BigIdea({ onNext }: { onNext: () => void }) {
  return (
    <div className="pf-center">
      <div className="cs-badge">THE BIG IDEA</div>
      <h1 className="cs-headline">You are the architect. AI is the builder.</h1>
      <div className="pf-compare">
        <div className="pf-bad">
          <div className="pf-h">😵 Messy</div>
          <p>“Make me a game.”</p>
        </div>
        <div className="pf-good">
          <div className="pf-h">✨ Clear</div>
          <p>“Make a colourful monster tower-defence game for kids 6–12, keyboard controls, build turrets, beat bosses, unlock weapons.”</p>
        </div>
      </div>
      <p className="pf-lead">Prompting is not about sounding smart. It is about explaining clearly.</p>
      <button className="btn btn-primary pf-cta" onClick={onNext}>Learn the 5 Prompt Powers →</button>
    </div>
  )
}

/* ── Gate Map ── */
function GateMap({ doneGates, allDone, onPick, onFinal }: {
  doneGates: number[]; allDone: boolean; onPick: (i: number) => void; onFinal: () => void
}) {
  return (
    <div className="pf-map">
      <h1 className="cs-headline">Unlock all five gates.</h1>
      <div className="pf-gates">
        {PF_GATES.map((g, i) => {
          const done = doneGates.includes(i)
          return (
            <button key={g.num} className={`pf-gate${done ? ' done' : ''}`} onClick={() => onPick(i)}>
              <div className="pf-gate-num">Power {g.num}</div>
              <div className="pf-gate-ic">{done ? '✅' : g.emoji}</div>
              <h3>{g.short}</h3>
              {done && <span className="pf-gate-badge">🏅 {g.badge}</span>}
            </button>
          )
        })}
      </div>
      <button className="btn btn-primary pf-cta" disabled={!allDone} onClick={onFinal}>
        {allDone ? '⚡ Final Trial →' : `Unlock all 5 to begin the Trial`}
      </button>
    </div>
  )
}

/* ── Gate (mini lesson + challenge) ── */
function Gate({ gate, onDone, onBack }: { gate: PFGate; onDone: (badge: string) => void; onBack: () => void }) {
  const [solved, setSolved] = useState(false)
  return (
    <div className="pf-gatebody">
      <div className="pf-gatehead">
        <button className="cine-x" onClick={onBack}><Back /></button>
        <div><div className="cs-badge">POWER {gate.num}</div><h2 className="pf-gtitle">{gate.emoji} {gate.title}</h2></div>
      </div>

      <div className="pf-scroll">
        <ul className="pf-lessonlist">
          {gate.lesson.map((l, i) => <li key={i}>{l}</li>)}
        </ul>

        <div className="pf-ex">
          <div className="pf-ex-row bad"><span>Weak</span><p>{gate.example.weak}</p></div>
          <div className="pf-ex-row good"><span>Strong</span><p>{gate.example.strong}</p></div>
        </div>

        <Challenge gate={gate} onSolved={() => setSolved(true)} />
      </div>

      <button className="btn btn-primary pf-cta" disabled={!solved} onClick={() => onDone(gate.badge)}>
        {solved ? `🏅 Claim “${gate.badge}” →` : 'Solve the challenge to continue'}
      </button>
    </div>
  )
}

/* ── Challenge renderer ── */
function Challenge({ gate, onSolved }: { gate: PFGate; onSolved: () => void }) {
  const c = gate.challenge
  const [txt, setTxt] = useState('')
  const [pick, setPick] = useState<number | null>(null)
  const [seq, setSeq] = useState<number[]>([])
  const [ok, setOk] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const win = (m: string) => { setOk(true); setMsg(m); onSolved() }

  if (c.kind === 'write') {
    const check = () => {
      const low = txt.toLowerCase()
      const hits = c.keywords.filter(k => low.includes(k)).length
      if (txt.trim().length > 18 && hits >= c.minHits) win(c.success)
      else setMsg('Add more detail — who is it for, the goal, the style, or what not to change.')
    }
    return (
      <div className="pf-challenge">
        <div className="pf-cq">🎮 {c.prompt}</div>
        <textarea className="pf-input" rows={3} value={txt} disabled={ok}
          onChange={e => setTxt(e.target.value)} placeholder={c.placeholder} />
        {!ok && <button className="btn btn-soft" onClick={check}>Check my prompt</button>}
        {msg && <div className={`pf-fb${ok ? ' ok' : ''}`}>{ok ? '✓ ' : '💡 '}{msg}</div>}
      </div>
    )
  }

  if (c.kind === 'choice') {
    return (
      <div className="pf-challenge">
        <div className="pf-cq">🎮 {c.prompt}</div>
        <div className="pf-options">
          {c.options.map((o, i) => (
            <button key={i}
              className={`pf-opt${pick === i ? (i === c.correct ? ' right' : ' wrong') : ''}`}
              disabled={ok}
              onClick={() => { setPick(i); if (i === c.correct) win(c.explain); else setMsg('Not quite — try the other one.') }}
            >{o}</button>
          ))}
        </div>
        {msg && <div className={`pf-fb${ok ? ' ok' : ''}`}>{ok ? '✓ ' : '💡 '}{msg}</div>}
      </div>
    )
  }

  // order
  const correct = c.correct
  const tap = (i: number) => {
    if (ok || seq.includes(i)) return
    const next = [...seq, i]
    setSeq(next)
    if (next.length === c.items.length) {
      if (next.every((v, k) => v === correct[k])) win('Perfect loop! Prompt → Review → Test → Improve.')
      else { setMsg('Not the right order — tap Reset and try again.'); }
    }
  }
  return (
    <div className="pf-challenge">
      <div className="pf-cq">🎮 {c.prompt}</div>
      <div className="pf-seq">
        {seq.map((i, k) => <span key={k} className="pf-chip on">{k + 1}. {c.items[i]}</span>)}
      </div>
      <div className="pf-options">
        {c.items.map((it, i) => (
          <button key={i} className="pf-opt" disabled={ok || seq.includes(i)} onClick={() => tap(i)}>{it}</button>
        ))}
      </div>
      {!ok && seq.length > 0 && <button className="btn btn-soft" onClick={() => { setSeq([]); setMsg(null) }}>Reset</button>}
      {msg && <div className={`pf-fb${ok ? ' ok' : ''}`}>{ok ? '✓ ' : '💡 '}{msg}</div>}
    </div>
  )
}

/* ── Final Trial ── */
function Final({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
  const [txt, setTxt] = useState('')
  const [ok, setOk] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const [showEx, setShowEx] = useState(false)
  const check = () => {
    const low = txt.toLowerCase()
    const hits = PF_FINAL.keywords.filter(k => low.includes(k)).length
    if (txt.trim().length > 50 && hits >= PF_FINAL.minHits) { setOk(true); setMsg('A clear blueprint. You are ready.') }
    else setMsg('Include all six: what, who, the goal, the first feature, the style, and what not to change.')
  }
  return (
    <div className="pf-gatebody">
      <div className="pf-gatehead">
        <button className="cine-x" onClick={onBack}><Back /></button>
        <div><div className="cs-badge">FINAL TRIAL</div><h2 className="pf-gtitle">⚡ Write a powerful build prompt</h2></div>
      </div>
      <div className="pf-scroll">
        <p className="pf-lead">{PF_FINAL.prompt}</p>
        <textarea className="pf-input" rows={5} value={txt} disabled={ok}
          onChange={e => setTxt(e.target.value)} placeholder={PF_FINAL.placeholder} />
        {!ok && <div className="pf-row">
          <button className="btn btn-soft" onClick={check}>Check my prompt</button>
          <button className="btn btn-soft" onClick={() => setShowEx(s => !s)}>{showEx ? 'Hide example' : 'Show example'}</button>
        </div>}
        {showEx && <div className="pf-example">{PF_FINAL.example}</div>}
        {msg && <div className={`pf-fb${ok ? ' ok' : ''}`}>{ok ? '✓ ' : '💡 '}{msg}</div>}
      </div>
      <button className="btn btn-primary pf-cta" disabled={!ok} onClick={onDone}>Forge the master prompt →</button>
    </div>
  )
}

/* ── Done ── */
function Done({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="pf-center">
      <div className="cs-emoji">🏆</div>
      <div className="cs-badge">{PF_FINAL.reward}</div>
      <h1 className="cs-headline">You are now a Prompt Apprentice.</h1>
      <div className="pf-summary">
        {PF_SUMMARY.map(([t, d], i) => (
          <div key={i} className="pf-sum"><b>{i + 1}. {t}</b><span>{d}</span></div>
        ))}
      </div>
      <p className="pf-quote">“A great prompt is not a magic spell. It is a clear blueprint.”</p>
      <button className="btn btn-primary pf-cta" onClick={onFinish}>Finish & claim XP →</button>
    </div>
  )
}
