// ============================================================
//  ARGANTALAB · OPENWORLD · OpenworldPlayer  (the battle screen)
//  Where it all meets: the pure combat engine (lib/combat/engine.ts) drives
//  the numbers, the kin/ability catalogs supply the content, and the sprites
//  render it. Questions come from the SAME per-world drills the Journey uses,
//  so a battle is real practice — a correct answer makes Energy + a small
//  auto-hit; you spend Energy on a 3-ability loadout; the enemy telegraphs a
//  gimmick beat. Weaken a kin to the Friendship Window, then befriend it.
//
//  Engine numbers are PROVEN by Monte Carlo at the reference fixture (hp110,
//  shield26, 5 hearts); individual kin scale around it by rarity. Telemetry +
//  rewards reuse the existing pipes (recordAttempt / logLearnEvent / addXp /
//  addDiamonds). Diamonds buy cosmetics only — combat never sells progress.
// ============================================================

import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { World } from '@/data/learn'
import type { Item } from '@/data/learn'
import type { DrillItem } from '@/data/drills'
import { DRILLS_BY_WORLD } from '@/data/drills'
import { useAppStore } from '@store/appStore'
import { logLearnEvent } from '@lib/analytics'
import { recordAttempt } from '@lib/adaptive'
import { bumpQuest } from '@lib/quests'
import { renderItem } from '@components/learn2/interactions'
import {
  createBattle, onAnswer, castAbility, enemyTelegraph, attemptCapture,
  captureChance, xpForTurn, diamondsForVictory,
  type CombatState, type PlayerConfig, type EnemyConfig, type AbilityRuntime,
} from '@lib/combat/engine'
import { kin as kinDef, ability, DEFAULT_LOADOUT, KIN, type KinDef } from '@/data/openworld'
import { befriendKin } from '@lib/nexus'
import { earnDiamonds } from '@lib/wallet'
import { markSectionToday } from '@lib/sectionDaily'
import { myMounts } from '@lib/mounts'
import KinSprite from './KinSprite'
import AvatarSprite from './AvatarSprite'

// Proven reference fixture (see lib/combat/sim.ts + engine.test.ts).
// AUTO_HIT = 0: a correct answer only charges Energy — the kin takes damage ONLY
// from the move the kid then picks (Strike / Weakness Break).
const AUTO_HIT = 0, ENERGY_PER_CORRECT = 10, MAX_HEARTS = 5, SHIELD3_AMOUNT = 18
// Co-op buddy (bots-first): for now a VISUAL placeholder — a friendly kin cheers
// at your side but deals NO damage (local co-op is cosmetic until real
// multi-device co-op lands; the proven allyStrike balance in sim.ts is kept for
// that future). It just bobs/flashes on a timer.
const BUDDY_EVERY_MS = 5500
const GREEN = '#16a34a', RED = '#ef4444'
const TIER: Record<string, number> = { common: 1, rare: 2, epic: 3, legendary: 4 }

// An ability icon per kind — tiny inline glyphs are fine for UI chrome.
const ABILITY_EMOJI: Record<string, string> = { strike: '⚔️', charge: '🔋', shield: '🛡️', break: '💥', focus: '🎯', surge: '🤝' }

// Phases of a turn. After a question you pick ONE move: Strike or Weakness Break
// (both end the turn), or Power Up — which asks one MORE question ('powerup') to
// charge your next hit, then drops you back to the action menu. No Guard, no
// separate "End turn" button: the move you pick IS the end of your turn.
type Phase = 'question' | 'action' | 'powerup' | 'capture' | 'over'

class ItemBoundary extends Component<{ children: ReactNode; onSkip: () => void }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(e: unknown) { console.warn('[openworld] question render failed, skipping:', e) }
  render() {
    if (this.state.failed) return <button className="le-check" onClick={this.props.onSkip}>Skip this one →</button>
    return this.props.children
  }
}

// Build the enemy config from a kin row. shield3 kin use the proven shield size.
function enemyFrom(def: KinDef): EnemyConfig {
  return {
    maxHp: def.baseHp,
    power: def.power,
    gimmick: def.gimmick,
    shieldAmount: def.gimmick === 'shield3' ? SHIELD3_AMOUNT : 0,
    captureThreshold: 0.25,
  }
}

const LOADOUT: AbilityRuntime[] = DEFAULT_LOADOUT
  .map(id => ability(id))
  .filter(Boolean)
  .map(a => ({ id: a!.id, kind: a!.kind, cost: a!.cost, power: a!.power }))

// The three peer moves the kid chooses between. Strike + Weakness Break commit
// the turn; Power Up (charge) is the "answer one more to hit harder" option.
const STRIKE = LOADOUT.find(a => a.kind === 'strike')!
const BREAK  = LOADOUT.find(a => a.kind === 'break')!
const CHARGE = LOADOUT.find(a => a.kind === 'charge')!

// Endless, renderItem-compatible question stream sourced from the world's drills.
function buildQueue(worldKey: string): DrillItem[] {
  const drills = DRILLS_BY_WORLD[worldKey] ?? []
  const items = drills.flatMap(d => d.gen())
    // clock/flag need DrillPlayer's bespoke renderers; the battle uses the
    // standard interaction layer, so keep the renderItem-native types.
    .filter(it => it.type === 'mcq' || it.type === 'type')
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[items[i], items[j]] = [items[j], items[i]] }
  return items
}

interface Props { world: World; kinId: string; coop?: boolean; onExit: () => void }

export default function OpenworldPlayer({ world, kinId, coop = false, onExit }: Props) {
  const { addXp, addToast } = useAppStore()
  // The kid rides their equipped mount into battle (cosmetic + perk). Loaded from
  // the cloud; on-foot if none equipped or offline.
  const [mount, setMount] = useState<string | undefined>(undefined)
  useEffect(() => { myMounts().then(m => setMount(m.equipped ?? undefined)) }, [])
  const def = kinDef(kinId)!
  // The co-op ally — a friendly kin from this world fighting at your side.
  const buddyKin = useMemo(() => KIN.find(k => k.world === world.key.toLowerCase() && k.id !== kinId) ?? null, [world.key, kinId])
  const [buddyFlash, setBuddyFlash] = useState(false)
  const player: PlayerConfig = useMemo(() => ({ maxHearts: MAX_HEARTS, loadout: LOADOUT, autoHit: AUTO_HIT, energyPerCorrect: ENERGY_PER_CORRECT, mountPerk: null }), [])

  const [s, setS] = useState<CombatState>(() => createBattle(player, enemyFrom(def)))
  const [phase, setPhase] = useState<Phase>('question')
  const [queue, setQueue] = useState<DrillItem[]>(() => buildQueue(world.key))
  const [qIdx, setQIdx] = useState(0)
  const [lastCorrect, setLastCorrect] = useState(false)
  const [outcome, setOutcome] = useState<'befriend' | 'defeat' | null>(null)
  const [note, setNote] = useState<string>('')
  const earnedXp = useRef(0)
  const shownAt = useRef(Date.now())
  const rewarded = useRef(false)

  // Co-op buddy is a visual placeholder — it cheers on a timer but deals no
  // damage (see note by BUDDY_EVERY_MS).
  useEffect(() => {
    if (!coop) return
    const id = setInterval(() => { setBuddyFlash(true); setTimeout(() => setBuddyFlash(false), 700) }, BUDDY_EVERY_MS)
    return () => clearInterval(id)
  }, [coop])

  // Pull the next question, regenerating the deck endlessly so a battle never
  // runs dry (pure fluency pressure, like the drills).
  const drawItem = (): DrillItem => {
    if (qIdx + 1 >= queue.length) { const fresh = buildQueue(world.key); setQueue(fresh); setQIdx(0); return fresh[0] }
    const next = queue[qIdx + 1]; setQIdx(qIdx + 1); return next
  }
  const item = queue[qIdx]
  const hpFrac = s.enemyHp / s.enemyMaxHp

  const finish = (won: boolean, befriended: boolean) => {
    if (rewarded.current) return
    rewarded.current = true
    setOutcome(befriended ? 'befriend' : 'defeat'); setPhase('over')
    if (won) {
      const d = diamondsForVictory(TIER[def.rarity] ?? 1, true, befriended)
      if (d > 0) earnDiamonds(d, 'openworld', `openworld:${def.id}`)
      bumpQuest('boss')
    }
    if (earnedXp.current > 0) { addXp(earnedXp.current); bumpQuest('xp', earnedXp.current) }
    markSectionToday(def.world.toUpperCase(), 'openworld') // match WorldHub's UPPERCASE world.key
  }

  // ── answer phase: a correct answer powers the engine, then you choose a move ──
  const onQuestionResult = (correct: boolean) => {
    if (phase !== 'question') return
    const ns = onAnswer(s, { correct, energyPerCorrect: ENERGY_PER_CORRECT, autoHit: AUTO_HIT })
    recordAttempt(item.world, item.skill, correct)
    logLearnEvent(item as Item, correct, Date.now() - shownAt.current)
    if (correct) earnedXp.current += xpForTurn(item.difficulty ?? 2, 1, ns.combo)
    setS(ns); setLastCorrect(correct)
    if (ns.status === 'lost') finish(false, false)
    else if (ns.status === 'won') finish(true, false)
    else if (ns.status === 'capture-window') { setNote('It’s worn out — befriend it!'); setPhase('capture') }
    // both right AND wrong land on the action menu — there's always a move to make.
    else { setNote(correct ? '' : 'Missed! Power Up to claw back some Energy.'); setPhase('action') }
  }

  // Commit the turn with Strike or Weakness Break: fire the move, then the enemy
  // takes its telegraphed beat, then a fresh question. This IS "end turn".
  const commit = (ab: AbilityRuntime) => {
    const cs = castAbility(s, ab)
    if (cs === s) return // shouldn't happen — buttons gate on Energy
    if (cs.status === 'won') { setS(cs); return finish(true, false) }
    if (cs.status === 'capture-window') { setS(cs); setNote('It’s worn out — befriend it!'); return setPhase('capture') }
    const ns = enemyTelegraph(cs)
    setS(ns)
    if (ns.status === 'lost') return finish(false, false)
    if (ns.status === 'won') return finish(true, false)
    if (ns.status === 'capture-window') { setNote('It’s worn out — befriend it!'); return setPhase('capture') }
    drawItem(); shownAt.current = Date.now(); setLastCorrect(true); setNote(''); setPhase('question')
  }

  // Power Up: spend an extra QUESTION (not the turn) to charge. Draw a bonus
  // question and hand control to the 'powerup' phase.
  const startPowerUp = () => { drawItem(); shownAt.current = Date.now(); setNote(''); setPhase('powerup') }

  const onPowerUpResult = (correct: boolean) => {
    if (phase !== 'powerup') return
    const ans = onAnswer(s, { correct, energyPerCorrect: ENERGY_PER_CORRECT, autoHit: AUTO_HIT })
    recordAttempt(item.world, item.skill, correct)
    logLearnEvent(item as Item, correct, Date.now() - shownAt.current)
    if (correct) earnedXp.current += xpForTurn(item.difficulty ?? 2, 1, ans.combo)
    setLastCorrect(correct)
    if (ans.status === 'lost') { setS(ans); return finish(false, false) }
    if (ans.status === 'won') { setS(ans); return finish(true, false) }
    if (ans.status === 'capture-window') { setS(ans); setNote('It’s worn out — befriend it!'); return setPhase('capture') }
    // Correct → bank the charge (next Strike/Break hits ~2.2×). Wrong → no charge,
    // and onAnswer already handed the enemy its free swing. Either way, back to the menu.
    const ns = correct ? castAbility(ans, CHARGE) : ans
    setS(ns)
    setNote(correct ? '⚡ Charged! Your next attack hits ~2.2× as hard.' : 'No charge that time — pick a move.')
    setPhase('action')
  }

  // ── befriend phase: skill-gated capture ──
  const onCaptureResult = (correct: boolean) => {
    if (phase !== 'capture') return
    recordAttempt(item.world, item.skill, correct)
    logLearnEvent(item as Item, correct, Date.now() - shownAt.current)
    if (correct) earnedXp.current += xpForTurn(item.difficulty ?? 2, 1, s.combo)
    const { state, success } = attemptCapture(s, { answeredCorrect: correct, roll: Math.random(), mountBoost: 0 })
    if (success) {
      // Persist to the cloud roster (server-authoritative; best-effort so the
      // celebration never blocks on the network). It shows up in the Nexus.
      befriendKin(def.id, def.world).catch(() => {})
      addToast(`${def.name} joined your Nexus!`, '✨'); finish(true, true)
    }
    else {
      setS(state) // battle stays live (status back to 'active') — weaken more, then try again
      setNote(correct ? `${def.name} wriggled free — keep at it!` : 'Missed the question — it slipped away.')
      drawItem(); shownAt.current = Date.now(); setPhase('question')
    }
  }

  // ════════════════ RESULTS ════════════════
  if (phase === 'over') {
    const won = outcome !== null && (s.status === 'won' || outcome === 'befriend')
    const d = won ? diamondsForVictory(TIER[def.rarity] ?? 1, true, outcome === 'befriend') : 0
    return (
      <div className="le-results ow-results">
        <KinSprite kin={def.id} size={120} bob={outcome === 'befriend'} />
        <h2 style={{ marginTop: 8 }}>
          {outcome === 'befriend' ? `${def.name} is your friend! ✨` : won ? `${def.name} tuckered out!` : `${def.name} got away…`}
        </h2>
        <p className="le-results-sub">
          {outcome === 'befriend' ? 'It’s waiting in your Nexus now.' : won ? 'A clean win.' : 'No worries — try again!'}
          {' '}· +{earnedXp.current} XP{d > 0 ? ` · +${d} 💎` : ''}
        </p>
        <div className="dr-result-actions">
          <button className="le-check" style={{ background: world.color }} onClick={onExit}>Done →</button>
        </div>
      </div>
    )
  }

  // ════════════════ BATTLE HUD ════════════════
  return (
    <div className="ow-stage" style={{ ['--ow' as string]: def.color }}>
      <div className="ow-top">
        <button className="le-x" onClick={onExit} aria-label="Leave battle">✕</button>
        <div className="ow-enemy-meta">
          <b>{def.name}</b>
          <span className="ow-rarity" style={{ background: `${def.color}22`, color: def.color }}>{def.rarity}</span>
          <span className="ow-weak">weak to {def.element}</span>
        </div>
      </div>

      {/* enemy */}
      <div className="ow-enemy">
        <div className="ow-enemy-art" style={{ transform: lastCorrect && phase !== 'question' ? 'translateX(4px)' : 'none' }}>
          <KinSprite kin={def.id} size={132} bob={phase === 'question'} />
        </div>
        <div className="ow-hpwrap">
          <div className="ow-hp"><i style={{ width: `${Math.max(0, hpFrac) * 100}%`, background: def.color }} /></div>
          {s.enemyShield > 0 && <div className="ow-shield">🛡️ {s.enemyShield}</div>}
          <small className="ow-hp-num">{Math.ceil(s.enemyHp)}/{s.enemyMaxHp}{s.weaknessOpen > 0 ? ' · WEAK!' : ''}</small>
        </div>
        {def.gimmick === 'shield3' && <div className="ow-tell">Shields every 3rd beat — Break it! (next beat in {3 - (s.round % 3 || 3) + (s.round % 3 === 0 ? 0 : 0)})</div>}
      </div>

      {/* player status */}
      <div className="ow-playerbar">
        <div className="ow-hearts">{Array.from({ length: s.maxHearts }, (_, i) => <span key={i} className={i < s.hearts ? 'on' : ''}>{i < s.hearts ? '❤️' : '🤍'}</span>)}</div>
        <div className="ow-energy" title="Energy">⚡ <b>{s.energy}</b></div>
        {s.combo > 1 && <div className="ow-combo">🔥 {s.combo}×</div>}
        <div className="ow-rider"><AvatarSprite mood={lastCorrect ? 'happy' : 'idle'} size={52} mount={mount} /></div>
        {coop && buddyKin && (
          <div className={`ow-buddy${buddyFlash ? ' hit' : ''}`} title={`${buddyKin.name} is cheering you on`}>
            <KinSprite kin={buddyKin.id} size={46} bob />
            <span className="ow-buddy-tag">{buddyFlash ? '📣' : '🤝'}</span>
          </div>
        )}
      </div>

      {note && phase !== 'question' && phase !== 'powerup' && <div className="ow-note">{note}</div>}

      {/* question */}
      {phase === 'question' && (
        <div className="ow-q">
          <div className="le-prompt">{item.prompt}</div>
          <div key={item.id} className="le-render">
            <ItemBoundary onSkip={() => onQuestionResult(false)}>
              {renderItem(item as Item, onQuestionResult)}
            </ItemBoundary>
          </div>
        </div>
      )}

      {/* action: pick ONE move. Strike / Weakness Break end the turn; Power Up asks one more question. */}
      {phase === 'action' && (
        <div className="ow-actions">
          {s.chargeMult > 1 && <div className="ow-charged">⚡ Charged! Next hit lands ×{s.chargeMult.toFixed(1)}</div>}
          <div className="ow-abilities">
            <button className="ow-ab" disabled={s.energy < STRIKE.cost} style={{ opacity: s.energy >= STRIKE.cost ? 1 : 0.4, borderColor: s.energy >= STRIKE.cost ? def.color : 'var(--border)' }} onClick={() => commit(STRIKE)}>
              <span className="ow-ab-ic">{ABILITY_EMOJI.strike}</span>
              <b>Strike</b>
              <small>⚡{STRIKE.cost} · ends turn</small>
            </button>
            <button className="ow-ab" disabled={s.energy < BREAK.cost} style={{ opacity: s.energy >= BREAK.cost ? 1 : 0.4, borderColor: s.energy >= BREAK.cost ? def.color : 'var(--border)' }} onClick={() => commit(BREAK)}>
              <span className="ow-ab-ic">{ABILITY_EMOJI.break}</span>
              <b>Weakness Break</b>
              <small>⚡{BREAK.cost} · strips shield</small>
            </button>
            <button className="ow-ab ow-ab-pu" onClick={startPowerUp}>
              <span className="ow-ab-ic">{ABILITY_EMOJI.charge}</span>
              <b>Power Up</b>
              <small>+1 question · ×2.2</small>
            </button>
          </div>
          <p className="ow-hint">
            {s.energy < STRIKE.cost
              ? 'Low on Energy — Power Up answers one more question to recharge.'
              : 'Strike or Weakness Break to attack, or Power Up to charge a bigger hit first.'}
          </p>
        </div>
      )}

      {/* power-up: a bonus question that charges your next attack */}
      {phase === 'powerup' && (
        <div className="ow-q">
          <div className="ow-pu-banner">🔋 Power Up — answer to charge your next hit ~2.2×!</div>
          <div className="le-prompt">{item.prompt}</div>
          <div key={`pu-${item.id}`} className="le-render">
            <ItemBoundary onSkip={() => onPowerUpResult(false)}>
              {renderItem(item as Item, onPowerUpResult)}
            </ItemBoundary>
          </div>
        </div>
      )}

      {/* befriend */}
      {phase === 'capture' && (
        <div className="ow-capture">
          <div className="ow-capture-head">
            <b style={{ color: def.color }}>Friendship Window!</b>
            <span>Answer to befriend · {Math.round(captureChance(s) * 100)}% chance</span>
          </div>
          <div className="le-prompt">{item.prompt}</div>
          <div key={`cap-${item.id}`} className="le-render">
            <ItemBoundary onSkip={() => onCaptureResult(false)}>
              {renderItem(item as Item, onCaptureResult)}
            </ItemBoundary>
          </div>
        </div>
      )}

      {/* feedback strip — only on the action menu (right after an answer) */}
      {phase === 'action' && (
        <div className="ow-fb" style={{ color: lastCorrect ? GREEN : RED }}>
          {lastCorrect ? `Charged +${ENERGY_PER_CORRECT}⚡ — now pick your move!` : 'The kin struck back!'}
        </div>
      )}
    </div>
  )
}
