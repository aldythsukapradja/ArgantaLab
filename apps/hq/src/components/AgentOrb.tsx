import { useEffect, useRef, useState } from 'react'
import { Sparkles, X, Send, Crown } from 'lucide-react'
import {
  PIPELINE, MODEL_META, AGENTS,
  agentSense, agentCompute, agentMatch, agentGenerate, routeIntent,
  type Model, type Sensed, type Computed, type Signal,
} from '../data/agents'
import { SCENARIOS, scenarioById } from '../data/scenarios'
import { ChartView, type ChartData } from './charts'
import { useHQ, type AgentSize } from '../shell/store'

const CHIPS = [
  { label: '📋 Daily Brief', prompt: 'Give me my daily brief' },
  { label: '🎯 Focus', prompt: 'What should I focus on this week?' },
  { label: '⚠️ Blockers', prompt: "What's blocking me?" },
  { label: '💎 Economy', prompt: 'Economy health check' },
  { label: '🤖 Agents', prompt: 'Show agent OS status' },
]

// Scenario quick-launchers — the CEO Agent orchestrates these in-chat, convening
// the scenario's agents and rendering the live chart inline.
const SCN_LABEL: Record<string, string> = {
  'growth-review': '📈 Growth', 'retention-triangle': '🔺 Retention',
  'acquisition-funnel': '🌪 Funnel', 'diamond-economy': '💎 Economy map', 'content-coverage': '📚 Content',
}

const agentName = (id: string) => AGENTS.find(a => a.id === id)?.name || id
const ceoAgent = AGENTS.find(a => a.orchestrator)!

interface Step { ico: string; label: string; model: Model; done: boolean }
interface Msg { role: 'user' | 'agent'; text: string; steps?: Step[]; convened?: string[]; chart?: ChartData }

const SIZE_GLYPH: Record<AgentSize, string> = { small: '–', expanded: '□', full: '⤢' }

const STEP_ICON: Record<string, string> = { sense: '⚡', compute: '🔢', match: '🎯', generate: '✦', deliver: '📬' }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function Pill({ model }: { model: Model }) {
  const m = MODEL_META[model]
  return <span className="pill" style={{ background: m.bg, color: m.fg, fontSize: 10.5, fontWeight: 600, padding: '3px 10px', whiteSpace: 'nowrap' }}>{m.label}</span>
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
  const { agentOpen: open, agentSize: size, toggleAgent, closeAgent, setAgentSize } = useHQ()
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState<Msg[]>([])
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

  // CEO Agent orchestrates a scenario in-chat: convene agents → live pipeline →
  // render the chart inline + headline + insight.
  async function runScenario(id: string) {
    if (busy) return
    const scn = scenarioById(id)
    if (!scn) return
    setBusy(true)
    setInput('')
    setMsgs(m => [...m, { role: 'user', text: `Run scenario · ${scn.title}` }])

    // Thinking
    const think = { role: 'agent' as const, text: '' }
    setMsgs(m => [...m, { ...think, text: '' }])
    setMsgs(m => { const c = [...m]; c[c.length - 1] = { role: 'agent', text: '', steps: [] }; return c })
    await sleep(350)

    // Convene the agents (CEO + owner + participants), one by one.
    const order = [ceoAgent.id, ...new Set([scn.ownerId, ...scn.participantIds])]
    setMsgs(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], convened: [] }; return c })
    for (const aid of order) {
      setMsgs(m => { const c = [...m]; const l = c[c.length - 1]; c[c.length - 1] = { ...l, convened: [...(l.convened || []), aid] }; return c })
      await sleep(230)
    }

    // Animate the 5-layer pipeline while the live scenario runs.
    const steps: Step[] = PIPELINE.map(s => ({ ico: STEP_ICON[s.key], label: s.name + ' — …', model: s.model, done: false }))
    setMsgs(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], steps: steps.map(s => ({ ...s })) }; return c })
    const upd = (mut: (s: Step[]) => void) => setMsgs(m => { const c = [...m]; const l = c[c.length - 1]; if (l.steps) { mut(l.steps); c[c.length - 1] = { ...l } } return c })

    await sleep(120)
    const res = await scn.run()
    upd(s => { s[0] = { ...s[0], label: `Sense — ${res ? 'supabase-live' : 'offline'}`, done: true } })
    await sleep(200); upd(s => { s[1] = { ...s[1], label: `Compute — ${res ? 'metrics derived' : 'no data'}`, done: true } })
    await sleep(200); upd(s => { s[2] = { ...s[2], label: `Match — ${scn.sources.length} source${scn.sources.length !== 1 ? 's' : ''}`, done: true } })
    await sleep(480); upd(s => { s[3] = { ...s[3], label: 'Generate — narrative ready', done: true } })
    await sleep(120); upd(s => { s[4] = { ...s[4], label: `Deliver — ${res ? 'chart + brief' : 'empty state'}`, done: true } })

    if (!res) {
      const txt = `**${scn.title}** _(CEO Agent · ${agentName(scn.ownerId)})_\n\nNo live signal yet — reads ${scn.sources.join(', ')}. Sign in as operator with data flowing to render the chart.`
      for (let i = 1; i <= txt.length; i += 3) { const slice = txt.slice(0, i); setMsgs(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: slice }; return c }); await sleep(7) }
      setMsgs(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: txt }; return c })
      setBusy(false); return
    }

    // Attach the chart, then typewriter the headline + insight.
    setMsgs(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], chart: res.chart }; return c })
    const txt = `**${res.headline}** _(CEO Agent · ${agentName(scn.ownerId)} · live SQL)_\n\n${res.insight}`
    for (let i = 1; i <= txt.length; i += 3) { const slice = txt.slice(0, i); setMsgs(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: slice }; return c }); await sleep(7) }
    setMsgs(m => { const c = [...m]; c[c.length - 1] = { ...c[c.length - 1], text: txt }; return c })
    setBusy(false)
  }

  return (
    <>
      <button className="agent-orb" aria-label="Open COO Agent" onClick={() => toggleAgent()}
        style={{ transform: open ? 'scale(.9)' : 'scale(1)' }}>
        <Sparkles size={22} color="#fff" />
      </button>

      {open && (
        <div className={'agent-panel ' + size}>
          <div className="agent-head">
            <div className="agent-lights">
              <button className={'al red' + (size === 'small' ? ' on' : '')} title="Small" aria-label="Small" onClick={() => setAgentSize('small')}><span>{SIZE_GLYPH.small}</span></button>
              <button className={'al yellow' + (size === 'expanded' ? ' on' : '')} title="Expanded" aria-label="Expanded" onClick={() => setAgentSize('expanded')}><span>{SIZE_GLYPH.expanded}</span></button>
              <button className={'al green' + (size === 'full' ? ' on' : '')} title="Full screen" aria-label="Full screen" onClick={() => setAgentSize('full')}><span>{SIZE_GLYPH.full}</span></button>
            </div>
            <div style={{ width: 32, height: 32, borderRadius: 9, flex: 'none', display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,var(--acc),var(--mag,#8a5cf6))' }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>COO Agent</div>
              <div style={{ fontSize: 11, color: 'var(--tx3)' }}>Circle AI OS · live SQL pipeline</div>
            </div>
            <Pill model="sonnet" />
            <button className="agent-x" onClick={() => closeAgent()} aria-label="Close"><X size={15} /></button>
          </div>

          <div className="agent-chips">
            {CHIPS.map(c => (
              <button key={c.label} className="agent-chip" disabled={busy} onClick={() => run(c.prompt)}>{c.label}</button>
            ))}
          </div>
          <div className="agent-chips agent-scn">
            <span className="agent-scn-lbl"><Crown size={11} /> Orchestrate</span>
            {SCENARIOS.map(s => (
              <button key={s.id} className="agent-chip scn" disabled={busy} onClick={() => runScenario(s.id)} title={s.question}>
                {SCN_LABEL[s.id] || s.title}
              </button>
            ))}
          </div>

          <div className="agent-msgs" ref={scrollRef}>
            {msgs.map((m, i) => (
              <div key={i} className={'agent-msg ' + m.role}>
                {m.convened && m.convened.length > 0 && (
                  <div className="agent-convened">
                    {m.convened.map(aid => {
                      const a = AGENTS.find(x => x.id === aid)!
                      return (
                        <span key={aid} className="pill" style={{ gap: 5, background: a.orchestrator ? 'linear-gradient(135deg,var(--acc),var(--mag))' : 'var(--bg3)', color: a.orchestrator ? '#fff' : 'var(--tx)' }}>
                          {a.orchestrator ? <Crown size={10} /> : <Sparkles size={10} />}{a.name}
                        </span>
                      )
                    })}
                  </div>
                )}
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
                {m.chart && <div className="agent-chart"><ChartView data={m.chart} /></div>}
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
