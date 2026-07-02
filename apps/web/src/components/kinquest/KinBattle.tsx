// ============================================================
//  ARGANTALAB · KINQUEST · KIN BATTLE  (classic 2-HP-bar clash, staged)
//  Turn-based: my kin vs the enemy kin. A FOCUS move fires an academic quiz
//  (scaled to the kid's stage) — a correct answer powers the hit. v2 adds the
//  full battle THEATRE: slide-in intros, typewriter battle text, attack lunge
//  + hit-flash + screen shake + floating damage numbers, ticking HP bars,
//  faint drops, a live XP bar with "grew to Lv X!" beats, and a bag of earned
//  items (Berry Juice heal · Bond Berry catch-boost).
//
//  All battle math lives in lib/kinquest (pure, tested). This file is only
//  presentation + pacing. Party HP is reported back so damage PERSISTS.
// ============================================================

import { useEffect, useRef, useState } from 'react'
import KinSprite from '@components/openworld/KinSprite'
import {
  createBattle, playerMove, guard, enemyTurn, attemptBefriend, befriendChance, useHeal,
  type BattleState, type Combatant,
} from '@lib/kinquest/battle'
import { xpForWin, xpToNext, applyXp } from '@lib/kinquest/growth'
import { ITEMS, item as itemDef } from '@lib/kinquest/items'
import { makeQuizFeed, type BattleQuestion } from '@lib/kinquest/quiz'
import { FOCUS_MOVE, QUICK_MOVE, ELEMENT_META } from '@/data/kinquest'
import type { Region } from '@/data/kinquest'

export type BattleOutcome = 'win' | 'lose' | 'fled' | 'befriended'
export interface XpEvent { idx: number; gained: number }
export interface BattleResult {
  outcome: BattleOutcome
  befriendedRender?: string
  enemyMaxLevel: number
  partyHp: number[]          // final hp per party slot → persisted by the shell
  xpEvents: XpEvent[]        // xp paid per party slot → persisted by the shell
}

const rand = (lo = 0.9, hi = 1.1) => lo + Math.random() * (hi - lo)

// ── battle text that types itself out, old-school ──────────
function TypeText({ text }: { text: string }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    setN(0)
    if (!text) return
    const iv = setInterval(() => setN(v => (v >= text.length ? (clearInterval(iv), v) : v + 1)), 22)
    return () => clearInterval(iv)
  }, [text])
  return <>{text.slice(0, n)}<span className="kqb-caret" /></>
}

// ── an HP readout that TICKS toward its target ─────────────
function useTicked(target: number): number {
  const [disp, setDisp] = useState(target)
  const ref = useRef(target)
  useEffect(() => {
    const iv = setInterval(() => {
      const d = target - ref.current
      if (Math.abs(d) < 1) { ref.current = target; setDisp(target); clearInterval(iv); return }
      ref.current += d * 0.22 + Math.sign(d) * 0.6
      setDisp(Math.round(ref.current))
    }, 34)
    return () => clearInterval(iv)
  }, [target])
  return disp
}

function HpBar({ c, right, growth }: { c: Combatant; right?: boolean; growth?: { level: number; xp: number } }) {
  const disp = useTicked(c.hp)
  const pct = Math.max(0, Math.min(100, Math.round((disp / c.maxHp) * 100)))
  const hue = pct > 50 ? '#3de08a' : pct > 22 ? '#ffc24b' : '#ff5d5d'
  const meta = ELEMENT_META[c.element]
  return (
    <div className={`kqb-hpcard${right ? ' r' : ''}`}>
      <div className="kqb-hprow">
        <b className="kqb-hpname">{c.name}</b>
        <span className="kqb-hplv">Lv{growth?.level ?? c.level}</span>
        <span className="kqb-hpel" style={{ color: meta.color }}>{meta.icon}</span>
      </div>
      <div className="kqb-hptrack">
        <div className="kqb-hpfill" style={{ width: `${pct}%`, background: hue }} />
      </div>
      <div className="kqb-hpfoot">
        {growth && (
          <div className="kqb-xptrack" title="XP to next level">
            <i style={{ width: `${Math.min(100, Math.round(((growth.xp) / xpToNext(growth.level)) * 100))}%` }} />
          </div>
        )}
        <span className="kqb-hpnum">{disp}/{c.maxHp}</span>
      </div>
    </div>
  )
}

export default function KinBattle({
  region, stage, playerParty, partyGrowth, enemyTeam, isKeeper, keeperName, bag, onUseItem, onEnd,
}: {
  region: Region
  stage: string
  playerParty: Combatant[]                       // built with PERSISTED hp
  partyGrowth: { level: number; xp: number }[]   // parallel: xp bar state
  enemyTeam: Combatant[]
  isKeeper: boolean
  keeperName?: string
  bag: Record<string, number>
  onUseItem: (id: string) => boolean             // consume from the save; false = none left
  onEnd: (r: BattleResult) => void
}) {
  const firstAlive = Math.max(0, playerParty.findIndex(k => k.hp > 0))
  const [party, setParty] = useState<Combatant[]>(() => playerParty.map(c => ({ ...c })))
  const [growth, setGrowth] = useState(() => partyGrowth.map(g => ({ ...g })))
  const [activeIdx, setActiveIdx] = useState(firstAlive)
  const [enemyIdx, setEnemyIdx] = useState(0)
  const [bs, setBs] = useState<BattleState>(() =>
    createBattle({ ...playerParty[firstAlive] }, { ...enemyTeam[0] }, { isKeeper }))
  const [question, setQuestion] = useState<BattleQuestion | null>(null)
  const [pending, setPending] = useState<'focus' | 'befriend' | null>(null)
  const [busy, setBusy] = useState(true)          // busy during the intro
  const [banner, setBanner] = useState<string>(
    isKeeper ? `Keeper ${keeperName ?? ''} sends out ${enemyTeam[0].name}!` : `A wild ${enemyTeam[0].name} appeared!`)
  const [quizFeedback, setQuizFeedback] = useState<{ correct: boolean; text: string } | null>(null)
  const [hitFx, setHitFx] = useState<'player' | 'enemy' | null>(null)
  const [faintFx, setFaintFx] = useState<'player' | 'enemy' | null>(null)
  const [entering, setEntering] = useState(true)
  const [shake, setShake] = useState<'' | 's' | 'b'>('')
  const [dmg, setDmg] = useState<{ key: number; side: 'player' | 'enemy'; text: string; big: boolean } | null>(null)
  const [tray, setTray] = useState<'none' | 'swap' | 'bag'>('none')
  const [bagCounts, setBagCounts] = useState(bag)

  const feed = useRef(makeQuizFeed(region.drillWorld, stage))
  const xpEvents = useRef<XpEvent[]>([])
  const timers = useRef<ReturnType<typeof setTimeout>[]>([])
  const later = (fn: () => void, ms: number) => { const t = setTimeout(fn, ms); timers.current.push(t); return t }
  useEffect(() => () => { timers.current.forEach(clearTimeout) }, [])

  // intro: sprites slide in, then hand over control
  useEffect(() => { later(() => { setEntering(false); setBusy(false) }, 950) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const enemyMaxLevel = Math.max(...enemyTeam.map(e => e.level))
  const active = party[activeIdx]
  const canBefriend = !isKeeper && bs.status === 'active' && befriendChance(bs) > 0
  const livingBench = party.filter((k, i) => i !== activeIdx && k.hp > 0)

  const hpSnapshot = (next: BattleState) =>
    party.map((k, i) => (i === activeIdx ? next.player.hp : k.hp))

  const finish = (outcome: BattleOutcome, next: BattleState, extra: Partial<BattleResult> = {}) =>
    onEnd({ outcome, enemyMaxLevel, partyHp: hpSnapshot(next), xpEvents: xpEvents.current, ...extra })

  const commit = (next: BattleState) => {
    setBs(next)
    setParty(p => p.map((k, i) => (i === activeIdx ? { ...k, hp: next.player.hp } : k)))
    setBanner(next.lastEvent?.text ?? '')
  }

  const showDamage = (side: 'player' | 'enemy', amount: number | undefined, mult: number | undefined) => {
    if (!amount) return
    const big = (mult ?? 1) > 1
    setDmg({ key: Date.now(), side, text: `−${amount}`, big })
    setShake(big ? 'b' : 's'); later(() => setShake(''), 340)
    setHitFx(side); later(() => setHitFx(null), 300)
  }

  // ── enemy takes its turn ──
  const runEnemyTurn = (from: BattleState) => {
    setBusy(true)
    later(() => {
      const next = enemyTurn(from, { variance: rand() })
      showDamage('player', next.lastEvent?.damage, next.lastEvent?.effectiveness)
      commit(next)
      later(() => {
        if (next.status === 'lose') handlePlayerFaint(next)
        else setBusy(false)
      }, 620)
    }, 680)
  }

  // ── after any player action resolves ──
  const afterPlayer = (next: BattleState) => {
    if (next.lastEvent?.kind === 'move') showDamage('enemy', next.lastEvent.damage, next.lastEvent.effectiveness)
    commit(next)
    if (next.status === 'befriended') {
      later(() => finish('befriended', next, { befriendedRender: next.enemy.renderKey }), 1000)
      return
    }
    if (next.status === 'win') { later(() => handleEnemyFaint(next), 500); return }
    runEnemyTurn(next)
  }

  // ── an enemy fainted: XP beat → next team member or victory ──
  const handleEnemyFaint = (from: BattleState) => {
    setBusy(true)
    setFaintFx('enemy')
    setBanner(`${from.enemy.name} fainted!`)
    later(() => {
      // XP beat — the active kin earns, the bar fills, maybe a level-up pop
      const gained = xpForWin(from.enemy.level, isKeeper)
      xpEvents.current.push({ idx: activeIdx, gained })
      const g = growth[activeIdx]
      const r = applyXp(g.level, g.xp, gained)
      setBanner(`${from.player.name} gained ${gained} XP!`)
      setGrowth(gs => gs.map((x, i) => (i === activeIdx ? { level: r.level, xp: r.xp } : x)))
      later(() => {
        const proceed = () => {
          setFaintFx(null)
          const nextI = enemyIdx + 1
          if (nextI < enemyTeam.length) {
            const nextEnemy = { ...enemyTeam[nextI] }
            setEnemyIdx(nextI)
            setEntering(true)
            setBs(createBattle({ ...party[activeIdx], hp: from.player.hp }, nextEnemy, { isKeeper }))
            setBanner(`${keeperName ?? 'Keeper'} sends out ${nextEnemy.name}!`)
            later(() => { setEntering(false); setBusy(false) }, 900)
          } else {
            finish('win', from)
          }
        }
        if (r.levelsGained > 0) {
          setBanner(`⭐ ${from.player.name} grew to Lv ${r.level}!`)
          // level up mid-battle: stats rise right away, new hp headroom arrives filled
          setParty(p => p.map((k, i) => {
            if (i !== activeIdx) return k
            const scale = 1 + r.levelsGained * 0.06
            const maxHp = Math.round(k.maxHp * scale)
            return { ...k, level: r.level, maxHp, hp: Math.min(maxHp, k.hp + (maxHp - k.maxHp)), power: Math.round(k.power * scale) }
          }))
          later(proceed, 1300)
        } else proceed()
      }, 1100)
    }, 700)
  }

  // ── the active kin fainted: swap in the next living kin, or defeat ──
  const handlePlayerFaint = (from: BattleState) => {
    setFaintFx('player')
    setBanner(`${from.player.name} fainted!`)
    later(() => {
      const nextI = party.findIndex((k, i) => i !== activeIdx && k.hp > 0)
      if (nextI >= 0) {
        setFaintFx(null)
        setActiveIdx(nextI)
        setEntering(true)
        setBs(createBattle({ ...party[nextI] }, { ...from.enemy }, { isKeeper }))
        setBanner(`Go, ${party[nextI].name}!`)
        later(() => { setEntering(false); setBusy(false) }, 900)
      } else {
        finish('lose', from)
      }
    }, 900)
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
        afterPlayer(attemptBefriend(bs, { roll: Math.random(), quizCorrect: correct }))
      }
    }, correct ? 700 : 1200)
  }
  const doGuard = () => {
    if (busy || bs.turn !== 'player' || bs.status !== 'active') return
    const next = guard(bs)
    commit(next)
    runEnemyTurn(next)
  }
  const doSwap = (i: number) => {
    setTray('none')
    if (busy || i === activeIdx || party[i].hp <= 0) return
    setActiveIdx(i)
    setEntering(true)
    const fresh = createBattle({ ...party[i] }, { ...bs.enemy }, { isKeeper })
    setBs(fresh)
    setBanner(`Go, ${party[i].name}!`)
    later(() => { setEntering(false); runEnemyTurn(fresh) }, 800)
  }
  const doItem = (id: string) => {
    setTray('none')
    if (busy || bs.turn !== 'player' || bs.status !== 'active') return
    const def = itemDef(id)
    if (!def || (bagCounts[id] ?? 0) <= 0) return
    if (def.effect === 'heal' && bs.player.hp >= bs.player.maxHp) { setBanner(`${bs.player.name} is already at full health!`); return }
    if (def.effect === 'befriend' && (isKeeper || befriendChance(bs) <= 0)) { setBanner('The wild kin is too lively — weaken it first!'); return }
    if (!onUseItem(id)) return
    setBagCounts(b => ({ ...b, [id]: (b[id] ?? 1) - 1 }))
    if (def.effect === 'heal') {
      const next = useHeal(bs, def.power)
      commit(next)
      runEnemyTurn(next)
    } else {
      setBanner(`You offered a ${def.name}…`)
      later(() => afterPlayer(attemptBefriend(bs, { roll: Math.random(), berryBoost: def.power })), 700)
    }
  }
  const doFlee = () => {
    if (isKeeper || busy) return
    finish('fled', bs)
  }

  const menuOpen = !busy && bs.turn === 'player' && bs.status === 'active' && !question && tray === 'none'

  return (
    <div className={`kqb${shake ? ` kqb-shake-${shake}` : ''}`} style={{ ['--rc' as string]: region.color }}>
      {/* battlefield */}
      <div className="kqb-field">
        <div className="kqb-stage-e" aria-hidden />
        <div className="kqb-stage-m" aria-hidden />
        <div className="kqb-side kqb-enemy">
          <HpBar c={bs.enemy} right />
          <div className={`kqb-sprite kqb-esprite${hitFx === 'enemy' ? ' hit' : ''}${faintFx === 'enemy' ? ' faint' : ''}${entering ? ' enter-r' : ''}`}>
            <KinSprite render={bs.enemy.renderKey} color={bs.enemy.color} size={112} bob={menuOpen} />
            {dmg && dmg.side === 'enemy' && <span key={dmg.key} className={`kqb-dmg${dmg.big ? ' big' : ''}`}>{dmg.text}</span>}
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
          <div className={`kqb-sprite kqb-msprite${hitFx === 'player' ? ' hit' : ''}${faintFx === 'player' ? ' faint' : ''}${entering ? ' enter-l' : ''}`}>
            <KinSprite render={active.renderKey} color={active.color} size={124} bob={menuOpen} />
            {dmg && dmg.side === 'player' && <span key={dmg.key} className={`kqb-dmg${dmg.big ? ' big' : ''}`}>{dmg.text}</span>}
          </div>
          <HpBar c={{ ...active, hp: bs.player.hp }} growth={growth[activeIdx]} />
        </div>
      </div>

      {/* battle text */}
      <div className="kqb-banner"><TypeText text={banner} /></div>

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
      {menuOpen && (
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
          ) : (
            <button className="kqb-act" onClick={() => setTray('swap')} disabled={livingBench.length === 0}>
              <b>🔄 Swap</b>
              <small>{livingBench.length} ready</small>
            </button>
          )}
          <button className="kqb-act" onClick={() => setTray('bag')}>
            <b>🎒 Bag</b>
            <small>{ITEMS.reduce((a, i) => a + (bagCounts[i.id] ?? 0), 0)} items</small>
          </button>
          {canBefriend && livingBench.length > 0 ? (
            <button className="kqb-act" onClick={() => setTray('swap')}>
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
      {!busy && tray === 'swap' && (
        <div className="kqb-menu kqb-swaptray">
          {party.map((k, i) => (
            <button key={i} className={`kqb-act${i === activeIdx || k.hp <= 0 ? ' kqb-act-dim' : ''}`}
              disabled={i === activeIdx || k.hp <= 0} onClick={() => doSwap(i)}>
              <div className="kqb-swapmini"><KinSprite render={k.renderKey} color={k.color} size={34} /></div>
              <b>{k.name}</b>
              <small>{k.hp <= 0 ? 'Fainted' : `${k.hp}/${k.maxHp} HP`}</small>
            </button>
          ))}
          <button className="kqb-act kqb-act-dim" onClick={() => setTray('none')}><b>← Back</b></button>
        </div>
      )}

      {/* bag tray */}
      {!busy && tray === 'bag' && (
        <div className="kqb-menu kqb-swaptray">
          {ITEMS.map(it => {
            const n = bagCounts[it.id] ?? 0
            return (
              <button key={it.id} className={`kqb-act${n <= 0 ? ' kqb-act-dim' : ''}`} disabled={n <= 0} onClick={() => doItem(it.id)}>
                <b>{it.emoji} {it.name} ×{n}</b>
                <small>{it.blurb}</small>
              </button>
            )
          })}
          <button className="kqb-act kqb-act-dim" onClick={() => setTray('none')}><b>← Back</b></button>
        </div>
      )}
    </div>
  )
}
