import { useEffect, useMemo, useRef, useState } from 'react'
import type { Item, InteractionKey } from '@/data/learn'
import { WORLD_BY_KEY } from '@/data/learn'
import { shuffle } from '@lib/adaptive'

// ============================================================
//  INTERACTION RENDERER ENGINE
//  Each renderer: collects input, renders its own "Check" button,
//  computes correctness, locks, then calls onResult(correct).
//  The ItemPlayer shows the post-answer banner + Continue.
// ============================================================

export interface PlayProps {
  item: Item
  onResult: (correct: boolean) => void
}

const GREEN = '#16a34a', RED = '#ef4444'
const wc = (item: Item) => WORLD_BY_KEY[item.world]?.color ?? 'var(--accent)'

function CheckBtn({ ready, onClick, label = 'Check' }: { ready: boolean; onClick: () => void; label?: string }) {
  return (
    <button className="le-check" disabled={!ready} onClick={onClick}
      style={{ opacity: ready ? 1 : 0.4, pointerEvents: ready ? 'auto' : 'none' }}>
      {label}
    </button>
  )
}

/* ── MCQ / MAP (single choice) ─────────────────────────────── */
function Mcq({ item, onResult }: PlayProps) {
  const p = item.payload as { choices: string[]; answer: number }
  const [sel, setSel] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  return (
    <div>
      <div className="le-opts">
        {p.choices.map((c, i) => {
          let bg = 'var(--panel)', bd = 'var(--border)', cl = 'var(--t1)'
          if (checked && i === p.answer) { bg = `${GREEN}22`; bd = GREEN; cl = 'var(--t1)' }
          else if (checked && i === sel) { bg = `${RED}22`; bd = RED }
          else if (sel === i) { bg = `${color}22`; bd = color }
          return (
            <button key={i} className="le-opt" disabled={checked}
              style={{ background: bg, borderColor: bd, color: cl }}
              onClick={() => setSel(i)}>{c}</button>
          )
        })}
      </div>
      {!checked && <CheckBtn ready={sel !== null} onClick={() => { setChecked(true); onResult(sel === p.answer) }} />}
    </div>
  )
}

/* ── MULTI-SELECT ──────────────────────────────────────────── */
function MultiSelect({ item, onResult }: PlayProps) {
  const p = item.payload as { choices: string[]; answers: number[] }
  const [sel, setSel] = useState<number[]>([])
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  const toggle = (i: number) => setSel(s => s.includes(i) ? s.filter(x => x !== i) : [...s, i])
  return (
    <div>
      <div className="le-opts">
        {p.choices.map((c, i) => {
          const on = sel.includes(i), shouldBe = p.answers.includes(i)
          let bg = 'var(--panel)', bd = 'var(--border)'
          if (checked && shouldBe) { bg = `${GREEN}22`; bd = GREEN }
          else if (checked && on) { bg = `${RED}22`; bd = RED }
          else if (on) { bg = `${color}22`; bd = color }
          return (
            <button key={i} className="le-opt" disabled={checked} style={{ background: bg, borderColor: bd }}
              onClick={() => toggle(i)}>{on ? '☑ ' : '☐ '}{c}</button>
          )
        })}
      </div>
      {!checked && <CheckBtn ready={sel.length > 0} onClick={() => {
        const ok = sel.length === p.answers.length && sel.every(i => p.answers.includes(i))
        setChecked(true); onResult(ok)
      }} />}
    </div>
  )
}

/* ── TYPE ANSWER ───────────────────────────────────────────── */
function TypeAnswer({ item, onResult }: PlayProps) {
  const p = item.payload as { answer: string; accept?: string[]; numeric?: boolean }
  const [val, setVal] = useState('')
  const [checked, setChecked] = useState(false)
  const norm = (s: string) => s.trim().toLowerCase()
  const ok = useMemo(() => [p.answer, ...(p.accept ?? [])].some(a => norm(a) === norm(val)), [val, p])
  return (
    <div>
      <input className="le-input" autoFocus inputMode={p.numeric ? 'numeric' : 'text'} disabled={checked}
        value={val} onChange={e => setVal(e.target.value)} placeholder="Type your answer…"
        onKeyDown={e => { if (e.key === 'Enter' && val.trim() && !checked) { setChecked(true); onResult(ok) } }}
        style={{ borderColor: checked ? (ok ? GREEN : RED) : 'var(--border)' }} />
      {checked && !ok && <p className="le-correct-note">Answer: <b>{p.answer}</b></p>}
      {!checked && <CheckBtn ready={val.trim().length > 0} onClick={() => { setChecked(true); onResult(ok) }} />}
    </div>
  )
}

/* ── SPEED RECALL (TTRS) ───────────────────────────────────── */
function SpeedRecall({ item, onResult }: PlayProps) {
  const p = item.payload as { questions: { q: string; a: string }[]; seconds?: number }
  const total = p.seconds ?? 60
  const [idx, setIdx] = useState(0)
  const [val, setVal] = useState('')
  const [score, setScore] = useState(0)
  const [left, setLeft] = useState(total)
  const [done, setDone] = useState(false)
  const doneRef = useRef(false)
  const color = wc(item)

  const finish = (sc: number) => {
    if (doneRef.current) return
    doneRef.current = true; setDone(true)
    onResult(sc >= Math.ceil(p.questions.length * 0.6))
  }
  useEffect(() => {
    if (done) return
    if (left <= 0) { finish(score); return }
    const t = setTimeout(() => setLeft(l => l - 1), 1000)
    return () => clearTimeout(t)
  }, [left, done]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    const q = p.questions[idx]
    const correct = val.trim() === q.a.trim()
    const ns = correct ? score + 1 : score
    if (correct) setScore(ns)
    setVal('')
    if (idx + 1 >= p.questions.length) finish(ns)
    else setIdx(idx + 1)
  }
  if (done) return <div className="le-speed-done" style={{ color }}>⚡ {score}/{p.questions.length} correct!</div>
  const q = p.questions[idx]
  return (
    <div className="le-speed">
      <div className="le-speed-top">
        <span className="le-speed-time" style={{ color: left <= 10 ? RED : color }}>⏱ {left}s</span>
        <span className="le-speed-score">⚡ {score}</span>
      </div>
      <div className="le-speed-q" style={{ color }}>{q.q}</div>
      <input className="le-input" autoFocus inputMode="text" value={val}
        onChange={e => setVal(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && val.trim()) submit() }} placeholder="=" />
      <button className="le-check" onClick={submit} style={{ opacity: val.trim() ? 1 : 0.4 }}>Next →</button>
    </div>
  )
}

/* ── WORD BANK / CODE BLOCKS ───────────────────────────────── */
function WordBank({ item, onResult, vertical = false }: PlayProps & { vertical?: boolean }) {
  const p = item.payload as { tiles: string[]; answer: string[] }
  const tiles = useMemo(() => shuffle(p.tiles.map((t, i) => ({ t, i }))), [item.id])
  const [picked, setPicked] = useState<{ t: string; i: number }[]>([])
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  const avail = tiles.filter(t => !picked.some(p2 => p2.i === t.i))
  const ok = picked.map(x => x.t).join(' ') === p.answer.join(' ')
  return (
    <div>
      <div className="le-bank-line" style={{ borderColor: checked ? (ok ? GREEN : RED) : color, flexDirection: vertical ? 'column' : 'row' }}>
        {picked.length === 0 && <span className="le-ph">Tap the tiles in order…</span>}
        {picked.map((x, k) => (
          <button key={k} className="le-tile sel" disabled={checked} style={{ borderColor: color }}
            onClick={() => setPicked(picked.filter((_, j) => j !== k))}>{x.t}</button>
        ))}
      </div>
      <div className="le-bank-pool">
        {avail.map(t => (
          <button key={t.i} className="le-tile" disabled={checked}
            onClick={() => setPicked([...picked, t])}>{t.t}</button>
        ))}
      </div>
      {checked && !ok && <p className="le-correct-note">Answer: <b>{p.answer.join(' ')}</b></p>}
      {!checked && <CheckBtn ready={picked.length === p.tiles.length} onClick={() => { setChecked(true); onResult(ok) }} />}
    </div>
  )
}

/* ── CLOZE (fill the blank) ────────────────────────────────── */
function Cloze({ item, onResult }: PlayProps) {
  const p = item.payload as { before: string; after: string; options: string[]; answer: string }
  const [sel, setSel] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  return (
    <div>
      <p className="le-cloze">
        {p.before}<span className="le-blank" style={{ borderColor: color, color }}>{sel ?? '____'}</span>{p.after}
      </p>
      <div className="le-opts le-opts-row">
        {p.options.map((o, i) => {
          let bg = 'var(--panel)', bd = 'var(--border)'
          if (checked && o === p.answer) { bg = `${GREEN}22`; bd = GREEN }
          else if (checked && o === sel) { bg = `${RED}22`; bd = RED }
          else if (sel === o) { bg = `${color}22`; bd = color }
          return <button key={i} className="le-opt" disabled={checked} style={{ background: bg, borderColor: bd }} onClick={() => setSel(o)}>{o}</button>
        })}
      </div>
      {!checked && <CheckBtn ready={sel !== null} onClick={() => { setChecked(true); onResult(sel === p.answer) }} />}
    </div>
  )
}

/* ── MATCH PAIRS / LABEL ───────────────────────────────────── */
function MatchPairs({ item, onResult }: PlayProps) {
  const raw = item.payload as { pairs?: [string, string][]; scene?: string }
  const pairs = raw.pairs ?? []
  const lefts = useMemo(() => pairs.map(p => p[0]), [item.id])
  const rights = useMemo(() => shuffle(pairs.map(p => p[1])), [item.id])
  const [selL, setSelL] = useState<string | null>(null)
  const [links, setLinks] = useState<Record<string, string>>({})
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  const correctMap = Object.fromEntries(pairs)
  const linkR = (r: string) => {
    if (!selL || checked) return
    setLinks(l => {
      const next = { ...l }
      for (const k of Object.keys(next)) if (next[k] === r) delete next[k]
      next[selL] = r; return next
    })
    setSelL(null)
  }
  const allLinked = Object.keys(links).length === lefts.length
  return (
    <div>
      {raw.scene && <div className="le-scene">{raw.scene}</div>}
      <div className="le-match">
        <div className="le-match-col">
          {lefts.map(l => {
            const linked = links[l]
            const right = checked ? (correctMap[l] === linked ? GREEN : RED) : (selL === l ? color : linked ? color : 'var(--border)')
            return <button key={l} className="le-mrow" disabled={checked} style={{ borderColor: right }}
              onClick={() => setSelL(l)}>{l}{linked && <small> → {linked}</small>}</button>
          })}
        </div>
        <div className="le-match-col">
          {rights.map(r => {
            const used = Object.values(links).includes(r)
            return <button key={r} className="le-mrow" disabled={checked} style={{ opacity: used ? 0.45 : 1, borderColor: 'var(--border)' }}
              onClick={() => linkR(r)}>{r}</button>
          })}
        </div>
      </div>
      {!checked && <CheckBtn ready={allLinked} onClick={() => {
        const ok = pairs.every(([l, r]) => links[l] === r); setChecked(true); onResult(ok)
      }} />}
    </div>
  )
}

/* ── SORT / CATEGORIZE ─────────────────────────────────────── */
function SortCategorize({ item, onResult }: PlayProps) {
  const p = item.payload as { buckets: string[]; items: { text: string; bucket: number }[] }
  const items = useMemo(() => shuffle(p.items.map((x, i) => ({ ...x, i }))), [item.id])
  const [place, setPlace] = useState<Record<number, number>>({})
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  const allPlaced = Object.keys(place).length === items.length
  return (
    <div>
      <div className="le-sort-items">
        {items.filter(x => place[x.i] === undefined).map(x => (
          <span key={x.i} className="le-tile">{x.text}</span>
        ))}
      </div>
      <div className="le-sort-buckets">
        {p.buckets.map((b, bi) => (
          <div key={bi} className="le-bucket">
            <div className="le-bucket-h" style={{ color }}>{b}</div>
            {items.filter(x => place[x.i] === bi).map(x => {
              const right = checked ? (x.bucket === bi ? GREEN : RED) : color
              return <button key={x.i} className="le-tile sel" disabled={checked} style={{ borderColor: right }}
                onClick={() => setPlace(pl => { const n = { ...pl }; delete n[x.i]; return n })}>{x.text}</button>
            })}
            {!checked && <button className="le-bucket-drop" onClick={() => {
              const next = items.find(x => place[x.i] === undefined)
              if (next) setPlace(pl => ({ ...pl, [next.i]: bi }))
            }}>+ drop here</button>}
          </div>
        ))}
      </div>
      {!checked && <CheckBtn ready={allPlaced} onClick={() => {
        const ok = items.every(x => place[x.i] === x.bucket); setChecked(true); onResult(ok)
      }} />}
    </div>
  )
}

/* ── SEQUENCE ORDER ────────────────────────────────────────── */
function SequenceOrder({ item, onResult }: PlayProps) {
  const p = item.payload as { items: string[] }
  const correct = p.items
  const [order, setOrder] = useState<string[]>(() => {
    let s = shuffle(correct)
    if (s.join('|') === correct.join('|') && correct.length > 1) s = shuffle(correct)
    return s
  })
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= order.length || checked) return
    const n = [...order];[n[i], n[j]] = [n[j], n[i]]; setOrder(n)
  }
  return (
    <div>
      <div className="le-seq">
        {order.map((t, i) => {
          const right = checked ? (t === correct[i] ? GREEN : RED) : color
          return (
            <div key={t} className="le-seq-row" style={{ borderColor: right }}>
              <span className="le-seq-n" style={{ background: color }}>{i + 1}</span>
              <span className="le-seq-t">{t}</span>
              {!checked && <span className="le-seq-arrows">
                <button onClick={() => move(i, -1)} disabled={i === 0}>▲</button>
                <button onClick={() => move(i, 1)} disabled={i === order.length - 1}>▼</button>
              </span>}
            </div>
          )
        })}
      </div>
      {!checked && <CheckBtn ready onClick={() => { setChecked(true); onResult(order.join('|') === correct.join('|')) }} />}
    </div>
  )
}

/* ── TAP TO FIX ────────────────────────────────────────────── */
function TapToFix({ item, onResult }: PlayProps) {
  const p = item.payload as { tokens: string[]; wrong: number; fix: string }
  const [sel, setSel] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  return (
    <div>
      <p className="le-fix">
        {p.tokens.map((t, i) => {
          let bd = 'transparent', bg = 'transparent'
          if (checked && i === p.wrong) { bg = `${GREEN}22`; bd = GREEN }
          else if (checked && i === sel) { bg = `${RED}22`; bd = RED }
          else if (sel === i) { bg = `${color}22`; bd = color }
          return <button key={i} className="le-token" disabled={checked} style={{ background: bg, borderColor: bd }} onClick={() => setSel(i)}>{t}</button>
        })}
      </p>
      {checked && <p className="le-correct-note">Should be: <b>{p.fix}</b></p>}
      {!checked && <CheckBtn ready={sel !== null} onClick={() => { setChecked(true); onResult(sel === p.wrong) }} />}
    </div>
  )
}

/* ── NUMBER LINE ───────────────────────────────────────────── */
function NumberLine({ item, onResult }: PlayProps) {
  const p = item.payload as { min: number; max: number; answer: number; tol?: number; label?: string }
  const tol = p.tol ?? (p.max - p.min) * 0.05
  const [val, setVal] = useState((p.min + p.max) / 2)
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  const ok = Math.abs(val - p.answer) <= tol
  return (
    <div>
      <p className="le-nl-target" style={{ color }}>Find: <b>{p.label ?? p.answer}</b></p>
      <input type="range" className="le-range" min={p.min} max={p.max} step={(p.max - p.min) / 100} value={val}
        disabled={checked} onChange={e => setVal(+e.target.value)} style={{ accentColor: checked ? (ok ? GREEN : RED) : color }} />
      <div className="le-nl-scale"><span>{p.min}</span><span>{p.max}</span></div>
      {checked && <p className="le-correct-note" style={{ color: ok ? GREEN : RED }}>{ok ? 'Spot on!' : `Answer was ${p.label ?? p.answer}`}</p>}
      {!checked && <CheckBtn ready onClick={() => { setChecked(true); onResult(ok) }} />}
    </div>
  )
}

/* ── SLIDER ESTIMATE ───────────────────────────────────────── */
function SliderEstimate({ item, onResult }: PlayProps) {
  const p = item.payload as { min: number; max: number; answer: number; tol?: number; unit?: string }
  const tol = p.tol ?? 0
  const [val, setVal] = useState(Math.round((p.min + p.max) / 2))
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  const ok = Math.abs(val - p.answer) <= tol
  return (
    <div>
      <div className="le-slider-val" style={{ color: checked ? (ok ? GREEN : RED) : color }}>{val}{p.unit ?? ''}</div>
      <input type="range" className="le-range" min={p.min} max={p.max} step={1} value={val}
        disabled={checked} onChange={e => setVal(+e.target.value)} style={{ accentColor: color }} />
      <div className="le-nl-scale"><span>{p.min}{p.unit}</span><span>{p.max}{p.unit}</span></div>
      {checked && !ok && <p className="le-correct-note">Answer: <b>{p.answer}{p.unit}</b></p>}
      {!checked && <CheckBtn ready onClick={() => { setChecked(true); onResult(ok) }} />}
    </div>
  )
}

/* ── LISTEN & CHOOSE (phonics, speechSynthesis) ────────────── */
function ListenChoose({ item, onResult }: PlayProps) {
  const p = item.payload as { say: string; choices: string[]; answer: number }
  const [sel, setSel] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  const speak = () => {
    try { const u = new SpeechSynthesisUtterance(p.say); u.rate = 0.8; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u) } catch { /* ignore */ }
  }
  useEffect(() => { speak() }, [item.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div>
      <button className="le-listen" style={{ borderColor: color, color }} onClick={speak}>🔊 Play the sound again</button>
      <div className="le-opts le-opts-row" style={{ marginTop: 14 }}>
        {p.choices.map((c, i) => {
          let bg = 'var(--panel)', bd = 'var(--border)'
          if (checked && i === p.answer) { bg = `${GREEN}22`; bd = GREEN }
          else if (checked && i === sel) { bg = `${RED}22`; bd = RED }
          else if (sel === i) { bg = `${color}22`; bd = color }
          return <button key={i} className="le-opt le-opt-lg" disabled={checked} style={{ background: bg, borderColor: bd }} onClick={() => setSel(i)}>{c}</button>
        })}
      </div>
      {!checked && <CheckBtn ready={sel !== null} onClick={() => { setChecked(true); onResult(sel === p.answer) }} />}
    </div>
  )
}

/* ── PREDICT → TEST → EXPLAIN ──────────────────────────────── */
function PredictTestExplain({ item, onResult }: PlayProps) {
  const p = item.payload as { predict: { prompt: string; choices: string[]; answer: number }; sim: string; explain: { prompt: string; choices: string[]; answer: number } }
  const [phase, setPhase] = useState<'predict' | 'sim' | 'explain'>('predict')
  const [predSel, setPredSel] = useState<number | null>(null)
  const [expSel, setExpSel] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  const color = wc(item)
  if (phase === 'predict') return (
    <div>
      <p className="le-pte-prompt">{p.predict.prompt}</p>
      <div className="le-opts le-opts-row">
        {p.predict.choices.map((c, i) => (
          <button key={i} className="le-opt" style={{ background: predSel === i ? `${color}22` : 'var(--panel)', borderColor: predSel === i ? color : 'var(--border)' }} onClick={() => setPredSel(i)}>{c}</button>
        ))}
      </div>
      <CheckBtn ready={predSel !== null} label="Run the test →" onClick={() => setPhase('sim')} />
    </div>
  )
  if (phase === 'sim') return (
    <div className="le-pte-sim">
      <div className="le-pte-sim-art">{p.sim}</div>
      <p className="le-pte-result" style={{ color: predSel === p.predict.answer ? GREEN : color }}>
        {predSel === p.predict.answer ? '✅ Your prediction was right!' : '🤔 Surprise! Watch what happens.'}
      </p>
      <CheckBtn ready label="Now explain why →" onClick={() => setPhase('explain')} />
    </div>
  )
  return (
    <div>
      <p className="le-pte-prompt">{p.explain.prompt}</p>
      <div className="le-opts">
        {p.explain.choices.map((c, i) => {
          let bg = 'var(--panel)', bd = 'var(--border)'
          if (checked && i === p.explain.answer) { bg = `${GREEN}22`; bd = GREEN }
          else if (checked && i === expSel) { bg = `${RED}22`; bd = RED }
          else if (expSel === i) { bg = `${color}22`; bd = color }
          return <button key={i} className="le-opt" disabled={checked} style={{ background: bg, borderColor: bd }} onClick={() => setExpSel(i)}>{c}</button>
        })}
      </div>
      {!checked && <CheckBtn ready={expSel !== null} onClick={() => { setChecked(true); onResult(expSel === p.explain.answer) }} />}
    </div>
  )
}

/* ── PARTY / QUEST ─────────────────────────────────────────── */
function Party({ item, onResult }: PlayProps) {
  const p = item.payload as { task?: string; quest?: boolean; prompt?: string; reveal?: string }
  const [revealed, setRevealed] = useState(false)
  const color = wc(item)
  if (p.quest) return (
    <div className="le-quest">
      <div className="le-quest-art">🎯</div>
      <p className="le-quest-task">{p.task}</p>
      <p className="le-quest-note">Do it in real life, then mark it done. A grown-up can confirm later.</p>
      <button className="le-check" onClick={() => onResult(true)}>✅ I did it!</button>
    </div>
  )
  return (
    <div className="le-quest">
      <div className="le-quest-art">🎉</div>
      <p className="le-quest-task">{p.prompt}</p>
      {revealed
        ? <p className="le-quest-reveal" style={{ color }}>{p.reveal}</p>
        : <button className="le-listen" style={{ borderColor: color, color }} onClick={() => setRevealed(true)}>👀 Reveal</button>}
      {revealed && <button className="le-check" onClick={() => onResult(true)}>Got it →</button>}
    </div>
  )
}

// ── Registry ────────────────────────────────────────────────
type Renderer = (props: PlayProps) => JSX.Element
const REGISTRY: Record<InteractionKey, Renderer> = {
  mcq: Mcq,
  map: Mcq,
  multi: MultiSelect,
  type: TypeAnswer,
  speed: SpeedRecall,
  bank: WordBank,
  code: (props) => <WordBank {...props} vertical />,
  cloze: Cloze,
  match: MatchPairs,
  label: MatchPairs,
  sort: SortCategorize,
  seq: SequenceOrder,
  fix: TapToFix,
  numline: NumberLine,
  slider: SliderEstimate,
  listen: ListenChoose,
  pte: PredictTestExplain,
  party: Party,
}

export function renderItem(item: Item, onResult: (correct: boolean) => void): JSX.Element {
  const R = REGISTRY[item.type] ?? Mcq
  return <R item={item} onResult={onResult} />
}

export const SUPPORTED_TYPES = Object.keys(REGISTRY) as InteractionKey[]
