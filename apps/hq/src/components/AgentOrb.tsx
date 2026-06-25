import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send } from 'lucide-react'
import {
  PIPELINE, MODEL_META,
  agentSense, agentCompute, agentMatch, agentGenerate, routeIntent,
  type Model, type Sensed, type Computed, type Signal,
} from '../data/agents'

const CHIPS = [
  { label: '📋 Daily Brief', prompt: 'Give me my daily brief' },
  { label: '🎯 Focus', prompt: 'What should I focus on this week?' },
  { label: '⚠️ Blockers', prompt: "What's blocking me?" },
  { label: '💎 Economy', prompt: 'Economy health check' },
  { label: '🤖 Agents', prompt: 'Show agent OS status' },
]

interface Step { ico: string; label: string; model: Model; done: boolean }
interface Msg { role: 'user' | 'agent'; text: string; steps?: Step[] }

type PanelSize = 'small' | 'expanded' | 'full'
const SIZE_GLYPH: Record<PanelSize, string> = { small: '–', expanded: '□', full: '⤢' }

const STEP_ICON: Record<string, string> = { sense: '⚡', compute: '🔢', match: '🎯', generate: '✦', deliver: '📬' }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function Pill({ model }: { model: Model }) {
  const m = MODEL_META[model]
  return <span className="pill" style={{ background: m.bg, color: m.fg, fontSize: 9.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{m.label}</span>
}

// Markdown-lite → **bold** and newlines. Input is our own generated text, safe.
function render(text: string) {
  const html = text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/_\((.+?)\)_/g, '<em style="color:var(--tx3);font-size:11px">($1)</em>')
    .replace(/\n/g, '<br/>')
  return { __html: html }
}

export function AgentOrb() {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [size, setSize] = useState<PanelSize>('expanded')
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: 1e9, behavior: 'smooth' }) }, [msgs, busy])
  useEffect(() => {
    if (open && msgs.length === 0) setMsgs([{
      role: 'agent',
      text: "**Hi 👋** I'm your **COO Agent** — I run the Circle AI OS over live SQL. I sense, compute, match, then synthesise with Sonnet 4.6. Ask me anything.",
    }])
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  async function run(prompt: string) {
    if (busy) return
    setBusy(true)
    setInput('')
    setMsgs(m => [...m, { role: 'user', text: prompt }])

    // Live pipeline. Steps animate as each layer resolves.
    const steps: Step[] = PIPELINE.map(s => ({ ico: STEP_ICON[s.key], label: s.name + ' — …', model: s.model, done: false }))
    const idx = msgs.length // placeholder; we push then mutate by ref via functional updates
    const push = (text: string) => setMsgs(m => [...m, { role: 'agent', text, steps: steps.map(s => ({ ...s })) }])
    push('')
    const update = (mut: (s: Step[]) => void) => setMsgs(m => {
      const copy = [...m]; const last = copy[copy.length - 1]
      if (last?.steps) { mut(last.steps); copy[copy.length - 1] = { ...last } }
      return copy
    })
    void idx

    // ⚡ Sense (live SQL)
    await sleep(120)
    const sensed: Sensed = await agentSense()
    update(s => { s[0] = { ...s[0], label: `Sense — ${sensed.source}`, done: true } })
    await sleep(200)
    // 🔢 Compute
    const computed: Computed = agentCompute(sensed)
    update(s => { s[1] = { ...s[1], label: `Compute — ${computed.wau == null ? 'no live metrics' : 'metrics derived'}`, done: true } })
    await sleep(220)
    // 🎯 Match
    const signals: Signal[] = agentMatch(computed)
    update(s => { s[2] = { ...s[2], label: `Match — ${signals.length} signal${signals.length !== 1 ? 's' : ''}`, done: true } })
    await sleep(240)
    // ✦ Generate (Sonnet)
    await sleep(520)
    const out = agentGenerate(routeIntent(prompt), computed, signals, sensed)
    update(s => { s[3] = { ...s[3], label: 'Generate — narrative ready', done: true } })
    await sleep(120)
    update(s => { s[4] = { ...s[4], label: 'Deliver — streaming', done: true } })

    // 📬 Typewriter stream
    for (let i = 1; i <= out.length; i += 3) {
      const slice = out.slice(0, i)
      setMsgs(m => { const c = [...m]; const last = c[c.length - 1]; c[c.length - 1] = { ...last, text: slice }; return c })
      await sleep(8)
    }
    setMsgs(m => { const c = [...m]; const last = c[c.length - 1]; c[c.length - 1] = { ...last, text: out }; return c })
    setBusy(false)
  }

  return (
    <>
      <button className="agent-orb" aria-label="Open COO Agent" onClick={() => setOpen(o => !o)}
        style={{ transform: open ? 'scale(.9)' : 'scale(1)' }}>
        <Sparkles size={22} color="#fff" />
      </button>

      {open && (
        <div className={'agent-panel ' + size}>
          <div className="agent-head">
            <div className="agent-lights">
              <button className={'al red' + (size === 'small' ? ' on' : '')} title="Small" aria-label="Small" onClick={() => setSize('small')}><span>{SIZE_GLYPH.small}</span></button>
              <button className={'al yellow' + (size === 'expanded' ? ' on' : '')} title="Expanded" aria-label="Expanded" onClick={() => setSize('expanded')}><span>{SIZE_GLYPH.expanded}</span></button>
              <button className={'al green' + (size === 'full' ? ' on' : '')} title="Full screen" aria-label="Full screen" onClick={() => setSize('full')}><span>{SIZE_GLYPH.full}</span></button>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,var(--acc),var(--mag,#8a5cf6))' }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>COO Agent</div>
              <div style={{ fontSize: 11, color: 'var(--tx3)' }}>Circle AI OS · live SQL pipeline</div>
            </div>
            <Pill model="sonnet" />
            <button className="agent-x" onClick={() => setOpen(false)} aria-label="Close"><X size={15} /></button>
          </div>

          <div className="agent-chips">
            {CHIPS.map(c => (
              <button key={c.label} className="agent-chip" disabled={busy} onClick={() => run(c.prompt)}>{c.label}</button>
            ))}
          </div>

          <div className="agent-msgs" ref={scrollRef}>
            {msgs.map((m, i) => (
              <div key={i} className={'agent-msg ' + m.role}>
                {m.steps && (
                  <div className="agent-steps">
                    {m.steps.map((s, k) => (
                      <div key={k} className={'agent-step' + (s.done ? ' done' : '')}>
                        <span style={{ width: 14, textAlign: 'center', flex: 'none' }}>{s.ico}</span>
                        <span style={{ flex: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{s.label}</span>
                        <Pill model={s.model} />
                      </div>
                    ))}
                  </div>
                )}
                {m.text && <div className="agent-bubble" dangerouslySetInnerHTML={render(m.text)} />}
              </div>
            ))}
            {busy && msgs[msgs.length - 1]?.role !== 'agent' && (
              <div className="agent-msg agent"><div className="agent-bubble"><span className="agent-dots"><i /><i /><i /></span></div></div>
            )}
          </div>

          <div className="agent-composer">
            <input className="agent-input" value={input} placeholder="Ask the COO Agent…" disabled={busy}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && input.trim()) run(input.trim()) }} />
            <button className="agent-send" disabled={busy || !input.trim()} onClick={() => input.trim() && run(input.trim())} aria-label="Send">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
