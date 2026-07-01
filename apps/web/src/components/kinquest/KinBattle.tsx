// ============================================================
//  ARGANTALAB · KINQUEST · KIN BATTLE  (classic 2-HP-bar clash)
//  Turn-based: my kin vs the enemy kin, both with a health bar. A FOCUS move
//  fires an academic quiz (scaled to the kid's stage) — a correct answer
//  powers the hit, a wrong one fizzles it. Guard softens the next blow;
//  Befriend catches a weakened wild kin. Keepers field a whole TEAM.
//
//  All battle math lives in lib/kinquest/battle.ts (pure, tested). This file
//  is only presentation + pacing: it drives the engine and animates results.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import KinSprite from '@components/openworld/KinSprite'
import {
  createBattle, playerMove, guard, enemyTurn, attemptBefriend, befriendChance,
  type BattleState, type Combatant,
} from '@lib/kinquest/battle'
import { makeQuizFeed, type BattleQuestion } from '@lib/kinquest/quiz'
import { movesFor, FOCUS_MOVE, QUICK_MOVE, ELEMENT_META } from '@/data/kinquest'
import type { Region } from '@/data/kinquest'

export type BattleOutcome = 'win' | 'lose' | 'fled' | 'befriended'
export interface BattleResult {
  outcome: BattleOutcome
  befriendedRender?: string
  enemyMaxLevel: number
}

const rand = (lo = 0.9, hi = 1.1) => lo + Math.random() * (hi - lo)

function HpBar({ c, right }: { c: Combatant; right?: boolean }) {
  const pct = Math.round((c.hp / c.maxHp) * 100)
  const hue = pct > 50 ? '#3de08a' : pct > 22 ? '#ffc24b' : '#ff5d5d'
  const meta = ELEMENT_META[c.element]
  return (
    <div className={`kqb-hpcard${right ? ' r' : ''}`}>
      <div className="kqb-hprow">
        <b className="kqb-hpname">{c.name}</b>
        <span className="kqb-hplv">Lv{c.level}</span>
        <span className="kqb-hpel" style={{ color: meta.color }}>{meta.icon}</span>
      </div>
      <div className="kqb-hptrack">
        <div className="kqb-hpfill" style={{ width: `${pct}%`, background: hue }} />
      </div>
      <div className="kqb-hpnum">{c.hp}/{c.maxHp}</div>
    </div>
  )
}

export default function KinBattle({
  region, stage, playerParty, enemyTeam, isKeeper, keeperName, onEnd,
}: {
  region: Region
  stage: string
  playerParty: Combatant[]
  enemyTeam: Combatant[]
  isKeeper: boolean
  keeperName?: string
  onEnd: (r: BattleResult) => void
}) {
  const [party, setParty] = useState<Combatant[]>(() => playerParty.map(c => ({ ...c })))
  const [activeIdx, setActiveIdx] = useState(0)
  const [enemyIdx, setEnemyIdx] = useState(0)
  const [bs, setBs] = useState<BattleState>(() =>
    createBattle({ ...playerParty[0] }, { ...enemyTeam[0] }, { isKeeper }))
  const [question, setQuestion] = useState<BattleQuestion | null>(null)
  const [pending, setPending] = useState<'focus' | 'befriend' | null>(null)
  const [busy, setBusy] = useState(false)
  const [banner, setBanner] = useState<string>(bs.lastEvent?.text ?? '')
  const [quizFeedback, setQuizFeedback] = useState<{ correct: boolean; text: string } | null>(null)
  const [hitFx, setHitFx] = useState<'player' | 'enemy' | null>(null)
  const [showSwap, setShowSwap] = useState(false)

  const feed = useRef(makeQuizFeed(region.drillWorld, stage))
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); return t }
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  const enemyMaxLevel = Math.max(...enemyTeam.map(e => e.level))
  const active = party[activeIdx]
  const moves = movesFor(active.element)
  const canBefriend = !isKeeper && bs.status === 'active' && befriendChance(bs) > 0
  const livingBench = party.filter((k, i) => i !== activeIdx && k.hp > 0)

  // keep the active party member's hp in sync with the live battle
  const commit = (next: BattleState) => {
    setBs(next)
    setParty(p => p.map((k, i) => (i === activeIdx ? { ...k, hp: next.player.hp } : k)))
    setBanner(next.lastEvent?.text ?? '')
  }

  // ── enemy takes its turn, then hand control back (or end) ──
  const runEnemyTurn = (from: BattleState) => {
    setBusy(true)
    later(() => {
      const next = enemyTurn(from, { variance: rand() })
      setHitFx('player'); later(() => setHitFx(null), 260)
      commit(next)
      later(() => {
        if (next.status === 'lose') handlePlayerFaint(next)
        else setBusy(false)
      }, 550)
    }, 620)
  }

  // ── after any player action resolves ──
  const afterPlayer = (next: BattleState) => {
    setHitFx('enemy'); later(() => setHitFx(null), 260)
    commit(next)
    if (next.status === 'befriended') { later(() => onEnd({ outcome: 'befriended', befriendedRender: next.enemy.renderKey, enemyMaxLevel }), 900); return }
    if (next.status === 'win') { later(() => handleEnemyFaint(next), 700); return }
    runEnemyTurn(next)
  }

  // ── an enemy fainted: next in the Keeper's team, or victory ──
  const handleEnemyFaint = (from: BattleState) => {
    const nextI = enemyIdx + 1
    if (nextI < enemyTeam.length) {
      const nextEnemy = { ...enemyTeam[nextI] }
      setEnemyIdx(nextI)
      const fresh = createBattle({ ...party[activeIdx], hp: from.player.hp }, nextEnemy, { isKeeper })
      setBs(fresh)
      setBanner(`${keeperName ?? 'Keeper'} sends out ${nextEnemy.name}!`)
      setBusy(false)
    } else {
      onEnd({ outcome: 'win', enemyMaxLevel })
    }
  }

  // ── the active kin fainted: swap in the next living kin, or defeat ──
  const handlePlayerFaint = (from: BattleState) => {
    const nextI = party.findIndex((k, i) => i !== activeIdx && k.hp > 0)
    if (nextI >= 0) {
      setActiveIdx(nextI)
      const fresh = createBattle({ ...party[nextI] }, { ...from.enemy }, { isKeeper })
      setBs(fresh)
      setBanner(`${from.player.name} fainted! Go, ${party[nextI].name}!`)
      setBusy(false)
    } else {
      onEnd({ outcome: 'lose', enemyMaxLevel })
    }
  }

  // ── player actions ──
  const doQuick = () => {
    if (busy || bs.turn !== 'player' || bs.status !== 'active') return
    afterPlayer(playerMove(bs, QUICK_MOVE, { variance: rand() }))
  }
  const openQuiz = (kind: 'focus' | 'befriend') => {
    if (busy || bs.turn !== 'player' || bs.status !== 'active') return
    setPending(kind)
    setQuestion(feed.current())
    setQuizFeedback(null)
  }
  const answer = (idx: number) => {
    if (!question || !pending) return
    const correct = idx === question.answer
    setQuizFeedback({ correct, text: correct ? 'Correct!' : (question.explanation || 'Not quite…') })
    later(() => {
      const kind = pending
      setQuestion(null); setPending(null); setQuizFeedback(null)
      if (kind === 'focus') {
        afterPlayer(playerMove(bs, FOCUS_MOVE[active.element], { quizCorrect: correct, variance: rand() }))
      } else {
        const res = attemptBefriend(bs, { roll: Math.random(), quizCorrect: correct })
        afterPlayer(res)
      }
    }, correct ? 700 : 1200)
  }
  const doGuard = () => {
    if (busy || bs.turn !== 'player' || bs.status !== 'active') return
    runEnemyTurn(guard(bs))
  }
  const doSwap = (i: number) => {
    setShowSwap(false)
    if (busy || i === activeIdx || party[i].hp <= 0) return
    setActiveIdx(i)
    const fresh = createBattle({ ...party[i] }, { ...bs.enemy }, { isKeeper })
    setBanner(`Go, ${party[i].name}!`)
    // swapping costs a turn — the enemy strikes
    runEnemyTurn(fresh)
  }
  const doFlee = () => {
    if (isKeeper || busy) return
    onEnd({ outcome: 'fled', enemyMaxLevel })
  }

  const menuOpen = !busy && bs.turn === 'player' && bs.status === 'active' && !question

  return (
    <div className="kqb" style={{ ['--rc' as string]: region.color }}>
      {/* battlefield */}
      <div className="kqb-field">
        <div className="kqb-side kqb-enemy">
          <HpBar c={bs.enemy} right />
          <div className={`kqb-sprite kqb-esprite${hitFx === 'enemy' ? ' hit' : ''}`}>
            <KinSprite render={bs.enemy.renderKey} color={bs.enemy.color} size={112} bob={menuOpen} />
          </div>
          {isKeeper && (
            <div className="kqb-team">
              {enemyTeam.map((e, i) => (
                <span key={i} className={`kqb-teamdot${i < enemyIdx ? ' out' : i === enemyIdx ? ' on' : ''}`} />
              ))}
            </div>
          )}
        </div>

        <div className="kqb-side kqb-mine">
          <div className={`kqb-sprite kqb-msprite${hitFx === 'player' ? ' hit' : ''}`}>
            <KinSprite render={active.renderKey} color={active.color} size={124} bob={menuOpen} />
          </div>
          <HpBar c={{ ...active, hp: bs.player.hp }} />
        </div>
      </div>

      {/* banner */}
      <div className="kqb-banner">{banner}</div>

      {/* quiz overlay */}
      {question && (
        <div className="kqb-quiz">
          <div className="kqb-quiz-head">
            <span className="kqb-quiz-tag">{pending === 'befriend' ? '💗 Befriend check' : `${region.icon} ${region.name} · quiz`}</span>
            <div className="kqb-quiz-q">{question.prompt}</div>
          </div>
          <div className="kqb-quiz-choices">
            {question.choices.map((c, i) => {
              const isAns = quizFeedback && i === question.answer
              const state = quizFeedback ? (isAns ? ' correct' : '') : ''
              return (
                <button key={i} className={`kqb-choice${state}`} disabled={!!quizFeedback} onClick={() => answer(i)}>
                  {c}
                </button>
              )
            })}
          </div>
          {quizFeedback && (
            <div className={`kqb-quiz-fb${quizFeedback.correct ? ' ok' : ' no'}`}>{quizFeedback.text}</div>
          )}
        </div>
      )}

      {/* action menu */}
      {menuOpen && !showSwap && (
        <div className="kqb-menu">
          <button className="kqb-act kqb-act-focus" onClick={() => openQuiz('focus')}>
            <b>{FOCUS_MOVE[active.element].emoji} {FOCUS_MOVE[active.element].name}</b>
            <small>Answer to power up</small>
          </button>
          <button className="kqb-act" onClick={doQuick}>
            <b>{QUICK_MOVE.emoji} {QUICK_MOVE.name}</b>
            <small>Reliable chip</small>
          </button>
          <button className="kqb-act" onClick={doGuard}>
            <b>🛡 Guard</b>
            <small>Soften next hit</small>
          </button>
          {canBefriend ? (
            <button className="kqb-act kqb-act-friend" onClick={() => openQuiz('befriend')}>
              <b>💗 Befriend</b>
              <small>{Math.round(befriendChance(bs) * 100)}% chance</small>
            </button>
          ) : livingBench.length > 0 ? (
            <button className="kqb-act" onClick={() => setShowSwap(true)}>
              <b>🔄 Swap</b>
              <small>{livingBench.length} ready</small>
            </button>
          ) : (
            <button className="kqb-act kqb-act-dim" onClick={doFlee} disabled={isKeeper}>
              <b>🏃 {isKeeper ? 'No escape' : 'Flee'}</b>
              <small>{isKeeper ? 'Keeper battle' : 'Leave the fight'}</small>
            </button>
          )}
        </div>
      )}

      {/* swap tray */}
      {showSwap && (
        <div className="kqb-menu kqb-swaptray">
          {party.map((k, i) => (
            <button key={i} className={`kqb-act${i === activeIdx ? ' kqb-act-dim' : ''}`}
              disabled={i === activeIdx || k.hp <= 0} onClick={() => doSwap(i)}>
              <div className="kqb-swapmini"><KinSprite render={k.renderKey} color={k.color} size={34} /></div>
              <b>{k.name}</b>
              <small>{k.hp <= 0 ? 'Fainted' : `${k.hp}/${k.maxHp} HP`}</small>
            </button>
          ))}
          <button className="kqb-act kqb-act-dim" onClick={() => setShowSwap(false)}><b>← Back</b></button>
        </div>
      )}
    </div>
  )
}
