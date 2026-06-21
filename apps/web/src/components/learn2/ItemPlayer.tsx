import { useEffect, useRef, useState } from 'react'
import type { Item, World, JourneyNode } from '@/data/learn'
import { useAppStore } from '@store/appStore'
import { getItems } from '@lib/content'
import { pickItems, recordAttempt, repairItem } from '@lib/adaptive'
import { renderItem } from './interactions'

const GREEN = '#16a34a', RED = '#ef4444'

interface Props {
  world: World
  node: JourneyNode
  onExit: () => void
  onComplete: (stars: number) => void
}

/** Plays a sequence of items for one journey node. */
export default function ItemPlayer({ world, node, onExit, onComplete }: Props) {
  const { addXp, addToast } = useAppStore()
  const [queue, setQueue] = useState<Item[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [answered, setAnswered] = useState(false)
  const [lastCorrect, setLastCorrect] = useState(false)
  const [correctCount, setCorrectCount] = useState(0)
  const [done, setDone] = useState(false)
  const poolRef = useRef<Item[]>([])
  const usedRef = useRef<Set<string>>(new Set())
  const earnedXp = useRef(0)

  useEffect(() => {
    let cancelled = false
    getItems(world.key, node.skills).then(pool => {
      if (cancelled) return
      poolRef.current = pool
      const picked = pickItems(pool, Math.min(node.itemCount, pool.length || node.itemCount))
      picked.forEach(p => usedRef.current.add(p.id))
      setQueue(picked.length ? picked : [])
    })
    return () => { cancelled = true }
  }, [world.key, node.key]) // eslint-disable-line react-hooks/exhaustive-deps

  const total = queue?.length ?? 0
  const item = queue && idx < queue.length ? queue[idx] : null

  const handleResult = (correct: boolean) => {
    if (answered || !item) return
    setAnswered(true)
    setLastCorrect(correct)
    recordAttempt(item.world, item.skill, correct)
    if (correct) {
      setCorrectCount(c => c + 1)
      earnedXp.current += item.xp ?? 10
    } else {
      // Mistake repair: queue one easier item of the same skill (capped to +2 total)
      const repair = repairItem(poolRef.current, item, usedRef.current)
      if (repair && queue && queue.length < node.itemCount + 2) {
        usedRef.current.add(repair.id)
        setQueue([...queue, repair])
      }
    }
  }

  const next = () => {
    if (!queue) return
    if (idx + 1 >= queue.length) {
      finish()
    } else {
      setIdx(idx + 1)
      setAnswered(false)
    }
  }

  const finish = () => {
    setDone(true)
    const ratio = total ? correctCount / total : 0
    const stars = ratio >= 0.9 ? 3 : ratio >= 0.6 ? 2 : 1
    if (earnedXp.current > 0) addXp(earnedXp.current)
    onComplete(stars)
  }

  if (queue === null) return <div className="le-loading">Loading…</div>
  if (queue.length === 0) return (
    <div className="le-empty">
      <p>No questions here yet.</p>
      <button className="btn btn-ghost" onClick={onExit}>← Back</button>
    </div>
  )

  if (done) {
    const stars = total && correctCount / total >= 0.9 ? 3 : total && correctCount / total >= 0.6 ? 2 : 1
    return (
      <div className="le-results">
        <div className="le-results-stars">{'⭐'.repeat(stars)}{'☆'.repeat(3 - stars)}</div>
        <h2>{node.type === 'boss' ? 'Boss cleared!' : 'Node complete!'}</h2>
        <p className="le-results-sub">{correctCount} / {total} correct · +{earnedXp.current} XP · +{node.rewardDiamonds} 💎</p>
        <button className="le-check" style={{ background: world.color }} onClick={onExit}>Continue →</button>
      </div>
    )
  }

  return (
    <div className="le-player">
      <div className="le-player-top">
        <button className="le-x" onClick={onExit} aria-label="Exit">✕</button>
        <div className="le-progress">
          <i style={{ width: `${(idx / total) * 100}%`, background: world.color }} />
        </div>
        <span className="le-count" style={{ color: world.color }}>{idx + 1}/{total}</span>
      </div>

      <div className="le-stage">
        <div className="le-prompt">{item!.prompt}</div>
        {/* key remounts the renderer per item so internal state resets */}
        <div key={item!.id + idx} className="le-render">
          {renderItem(item!, handleResult)}
        </div>
      </div>

      {answered && (
        <div className="le-feedback" style={{ borderColor: lastCorrect ? GREEN : RED }}>
          <div className="le-feedback-h" style={{ color: lastCorrect ? GREEN : RED }}>
            {lastCorrect ? '✅ Correct!' : '❌ Not quite'}
          </div>
          {item!.explanation && <p className="le-feedback-x">{item!.explanation}</p>}
          <button className="le-check" style={{ background: lastCorrect ? GREEN : world.color }} onClick={next}>
            {idx + 1 >= total ? 'Finish' : 'Continue →'}
          </button>
        </div>
      )}
    </div>
  )
}
