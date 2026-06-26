import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { World } from '@/data/learn'
import type { Item } from '@/data/learn'
import type { Drill, DrillItem } from '@/data/drills'
import { useAppStore } from '@store/appStore'
import { logLearnEvent } from '@lib/analytics'
import { recordAttempt } from '@lib/adaptive'
import { bumpQuest } from '@lib/quests'
import { earnDiamonds } from '@lib/wallet'
import { markSectionToday } from '@lib/sectionDaily'
import { renderItem } from './interactions'
import Buddy from '@components/avatar/Buddy'
import CheerSquad from '@components/openworld/CheerSquad'

// Drills reuse the journey's interaction renderers, but add two visual
// renderers of their own (an analog clock face + a flag image). Everything
// else falls through to renderItem(). A round is procedurally generated, so
// the same drill is endlessly repeatable — pure fluency practice.

const GREEN = '#16a34a', RED = '#ef4444'
const CHEER = ['Nice!', 'Got it!', 'Sharp!', 'Yes!', 'Quick!']
const NUDGE = ['Close — keep going!', 'Good try!', 'Almost!']

class ItemErrorBoundary extends Component<{ children: ReactNode; onSkip: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err: unknown) { console.warn('[drill] render failed, skipping:', err) }
  render() {
    if (this.state.failed) return (
      <div className="le-empty" style={{ textAlign: 'center' }}>
        <p>Oops — skip this one.</p>
        <button className="le-check" onClick={this.props.onSkip}>Next →</button>
      </div>
    )
    return this.props.children
  }
}

/* ── Analog clock face ─────────────────────────────────────── */
function ClockFace({ h, m, color }: { h: number; m: number; color: string }) {
  const cx = 80, cy = 80, R = 70
  const minA = m * 6, hourA = (h % 12) * 30 + m * 0.5
  const hand = (deg: number, len: number) => {
    const t = (deg - 90) * Math.PI / 180
    return { x2: cx + len * Math.cos(t), y2: cy + len * Math.sin(t) }
  }
  const mh = hand(minA, 56), hh = hand(hourA, 38)
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const t = (i * 30 - 90) * Math.PI / 180
    return { x1: cx + (R - 8) * Math.cos(t), y1: cy + (R - 8) * Math.sin(t), x2: cx + R * Math.cos(t), y2: cy + R * Math.sin(t), big: i % 3 === 0 }
  })
  return (
    <svg width="160" height="160" viewBox="0 0 160 160" className="dr-clock">
      <circle cx={cx} cy={cy} r={R} fill="var(--panel)" stroke={color} strokeWidth="4" />
      {ticks.map((t, i) => <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="var(--t3)" strokeWidth={t.big ? 3 : 1.5} />)}
      <line x1={cx} y1={cy} x2={hh.x2} y2={hh.y2} stroke="var(--t1)" strokeWidth="5" strokeLinecap="round" />
      <line x1={cx} y1={cy} x2={mh.x2} y2={mh.y2} stroke={color} strokeWidth="3.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill={color} />
    </svg>
  )
}

/* ── Shared choice grid for clock + flag (mirrors Mcq look) ── */
function ChoiceGrid({ choices, answer, onResult, color, top }: {
  choices: string[]; answer: number; onResult: (c: boolean) => void; color: string; top: ReactNode
}) {
  const [sel, setSel] = useState<number | null>(null)
  const [checked, setChecked] = useState(false)
  return (
    <div>
      <div className="dr-visual">{top}</div>
      <div className="le-opts le-opts-row">
        {choices.map((c, i) => {
          let bg = 'var(--panel)', bd = 'var(--border)'
          if (checked && i === answer) { bg = `${GREEN}22`; bd = GREEN }
          else if (checked && i === sel) { bg = `${RED}22`; bd = RED }
          else if (sel === i) { bg = `${color}22`; bd = color }
          return <button key={i} className="le-opt le-opt-lg" disabled={checked} style={{ background: bg, borderColor: bd }} onClick={() => setSel(i)}>{c}</button>
        })}
      </div>
      {!checked && <button className="le-check" disabled={sel === null} style={{ opacity: sel === null ? 0.4 : 1 }}
        onClick={() => { setChecked(true); onResult(sel === answer) }}>Check</button>}
    </div>
  )
}

function renderDrillItem(item: DrillItem, color: string, onResult: (correct: boolean) => void): JSX.Element {
  if (item.type === 'clock') {
    const p = item.payload as { h: number; m: number; choices: string[]; answer: number }
    return <ChoiceGrid choices={p.choices} answer={p.answer} onResult={onResult} color={color} top={<ClockFace h={p.h} m={p.m} color={color} />} />
  }
  if (item.type === 'flag') {
    const p = item.payload as { code: string; choices: string[]; answer: number }
    return <ChoiceGrid choices={p.choices} answer={p.answer} onResult={onResult} color={color}
      top={<img className="dr-flag" alt="flag" src={`https://flagcdn.com/w320/${p.code}.png`} srcSet={`https://flagcdn.com/w640/${p.code}.png 2x`} />} />
  }
  // standard interaction
  return renderItem(item as Item, onResult)
}

interface Props { world: World; drill: Drill; onExit: () => void }

export default function DrillPlayer({ world, drill, onExit }: Props) {
  const { addXp, resolvedOutfit, stageKey } = useAppStore()
  const acc = resolvedOutfit()
  const queue = useMemo(() => drill.gen(stageKey), [drill.key, stageKey]) // eslint-disable-line react-hooks/exhaustive-deps
  const [idx, setIdx] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [lastCorrect, setLastCorrect] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [done, setDone] = useState(false)
  const earnedXp = useRef(0)
  const shownAt = useRef(Date.now())

  const total = queue.length
  const item = idx < total ? queue[idx] : null
  useEffect(() => { shownAt.current = Date.now() }, [idx])

  const handleResult = (correct: boolean) => {
    if (answered || !item) return
    setAnswered(true); setLastCorrect(correct)
    recordAttempt(item.world, item.skill, correct)
    logLearnEvent(item as Item, correct, Date.now() - shownAt.current)
    if (correct) { setCorrectCount(c => c + 1); earnedXp.current += item.xp ?? 4 }
  }

  const next = () => {
    if (idx + 1 >= total) finish()
    else { setIdx(idx + 1); setAnswered(false) }
  }

  const finish = () => {
    setDone(true)
    const ratio = total ? correctCount / total : 0
    const gems = ratio >= 0.6 ? drill.diamonds : Math.ceil(drill.diamonds / 2)
    if (earnedXp.current > 0) { addXp(earnedXp.current); bumpQuest('xp', earnedXp.current) }
    if (gems > 0) earnDiamonds(gems, 'drill', `drill:${drill.world}:${drill.key}`)
    markSectionToday(drill.world, 'drills')
    bumpQuest('node')
  }

  if (done) {
    const ratio = total ? correctCount / total : 0
    const gems = ratio >= 0.6 ? drill.diamonds : Math.ceil(drill.diamonds / 2)
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1
    return (
      <div className="le-results">
        <Buddy mood="celebrate" size={104} color={world.color} bob={false} outfit={acc} />
        <div className="le-results-stars">{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
        <h2>{drill.emoji} {drill.title}</h2>
        <p className="le-results-sub">{correctCount} / {total} correct · +{earnedXp.current} XP · +{gems} 💎</p>
        <div className="dr-result-actions">
          <button className="le-check" style={{ background: world.color }} onClick={onExit}>Done →</button>
        </div>
      </div>
    )
  }

  return (
    <div className="le-player">
      <div className="le-player-top">
        <button className="le-x" onClick={onExit} aria-label="Exit">✕</button>
        <div className="le-progress"><i style={{ width: `${(idx / total) * 100}%`, background: world.color }} /></div>
        <span className="le-count" style={{ color: world.color }}>{idx + 1}/{total}</span>
      </div>

      <CheerSquad cheering={answered && lastCorrect} />

      <div className="le-stage">
        <div className="le-prompt">{item!.prompt}</div>
        <div key={item!.id} className="le-render">
          <ItemErrorBoundary onSkip={() => { if (!answered) handleResult(false); next() }}>
            {renderDrillItem(item!, world.color, handleResult)}
          </ItemErrorBoundary>
        </div>
      </div>

      {answered && (
        <div className="le-feedback" style={{ borderColor: lastCorrect ? GREEN : RED }}>
          <div className="le-feedback-row">
            <Buddy mood={lastCorrect ? 'celebrate' : 'sad'} size={56} color={world.color} bob={false} outfit={acc} />
            <div>
              <div className="le-feedback-h" style={{ color: lastCorrect ? GREEN : RED }}>
                {lastCorrect ? CHEER[idx % CHEER.length] : NUDGE[idx % NUDGE.length]}
              </div>
              {item!.explanation && <p className="le-feedback-x">{item!.explanation}</p>}
            </div>
          </div>
          <button className="le-check" style={{ background: lastCorrect ? GREEN : world.color }} onClick={next}>
            {idx + 1 >= total ? 'Finish' : 'Continue →'}
          </button>
        </div>
      )}
    </div>
  )
}
