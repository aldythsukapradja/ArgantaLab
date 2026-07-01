// ============================================================
//  ARGANTALAB · KINQUEST · BATTLE ENGINE  (pure, content-agnostic)
//  Classic 2-HP-bar, turn-based kin clash. My kin and the enemy kin trade
//  blows; a FOCUS move fires an academic quiz first — a correct answer
//  powers the hit (×1.5), a wrong one fizzles it (×0.4). Element type
//  advantage adds ×1.5 (super-effective) on the reverse edge ×0.75.
//
//  Every function is PURE: it clones the state and returns a new one, so it
//  drives React safely and is trivial to unit-test (all randomness is
//  injected via `variance`/`roll`, so tests are exact). Mirrors the design
//  of lib/combat/engine.ts — same "built once, tuned by test" discipline.
// ============================================================

import type { Element } from '@/data/openworld'
import type { Move } from '@/data/kinquest'
import { typeMultiplier } from '@/data/kinquest'

export interface Combatant {
  renderKey: string
  name: string
  element: Element
  level: number
  hp: number
  maxHp: number
  power: number       // base attack power (level/tier already baked in)
  tier: number        // evolution tier (0..2) — cosmetic; stats pre-baked
  color: string
}

export type BattleStatus = 'active' | 'win' | 'lose' | 'befriended' | 'fled'
export type Turn = 'player' | 'enemy'

export interface BattleEvent {
  kind: 'start' | 'move' | 'enemyMove' | 'guard' | 'befriend-win' | 'befriend-fail' | 'faint' | 'flee'
  by: 'player' | 'enemy'
  moveName?: string
  damage?: number
  effectiveness?: number   // type multiplier applied (1.5 / 1 / 0.75)
  quizCorrect?: boolean
  text: string
}

export interface BattleState {
  player: Combatant
  enemy: Combatant
  turn: Turn
  status: BattleStatus
  guardNext: boolean       // player Guarded → next enemy hit reduced
  isKeeper: boolean        // Keeper/boss battle → no befriend
  round: number
  lastEvent: BattleEvent | null
}

const clampHp = (hp: number, max: number) => Math.max(0, Math.min(max, hp))
const round1 = (n: number) => Math.max(0, Math.round(n))

/** Level scaling for outgoing damage — gentle so low levels still matter. */
const levelFactor = (lvl: number) => 1 + (lvl - 1) * 0.045

export function createBattle(player: Combatant, enemy: Combatant, opts: { isKeeper?: boolean } = {}): BattleState {
  return {
    player: { ...player },
    enemy: { ...enemy },
    turn: 'player',
    status: 'active',
    guardNext: false,
    isKeeper: !!opts.isKeeper,
    round: 0,
    lastEvent: { kind: 'start', by: 'player', text: `A wild ${enemy.name} appears!` },
  }
}

// ── core damage math (pure) ─────────────────────────────────
function computeDamage(atk: Combatant, def: Combatant, movePower: number, quizMult: number, variance: number) {
  const typeMult = typeMultiplier(atk.element, def.element)
  const raw = (atk.power * 0.35 + movePower) * levelFactor(atk.level) * quizMult * typeMult * variance
  return { dmg: round1(Math.max(quizMult > 0 ? 1 : 0, raw)), typeMult }
}

/** Quiz multiplier for a move: FOCUS moves swing on the answer; QUICK moves are flat. */
function quizMultFor(move: Move, quizCorrect: boolean | undefined): number {
  if (!move.quiz) return 1
  return quizCorrect ? 1.5 : 0.4
}

function settle(s: BattleState): void {
  if (s.enemy.hp <= 0) { s.status = 'win'; s.enemy.hp = 0 }
  else if (s.player.hp <= 0) { s.status = 'lose'; s.player.hp = 0 }
}

/** Player fires a move at the enemy. variance defaults to 1 (deterministic for tests). */
export function playerMove(prev: BattleState, move: Move, o: { quizCorrect?: boolean; variance?: number } = {}): BattleState {
  if (prev.status !== 'active' || prev.turn !== 'player') return prev
  const s: BattleState = { ...prev, player: { ...prev.player }, enemy: { ...prev.enemy } }
  const qm = quizMultFor(move, o.quizCorrect)
  const { dmg, typeMult } = computeDamage(s.player, s.enemy, move.power, qm, o.variance ?? 1)
  s.enemy.hp = clampHp(s.enemy.hp - dmg, s.enemy.maxHp)
  s.round += 1
  const eff = typeMult > 1 ? ' Super effective!' : typeMult < 1 ? ' Not very effective…' : ''
  s.lastEvent = {
    kind: 'move', by: 'player', moveName: move.name, damage: dmg, effectiveness: typeMult,
    quizCorrect: o.quizCorrect,
    text: `${s.player.name} used ${move.name}! −${dmg}${eff}`,
  }
  settle(s)
  if (s.status === 'win') s.lastEvent = { kind: 'faint', by: 'enemy', text: `${s.enemy.name} fainted!` }
  else s.turn = 'enemy'
  return s
}

/** Player Guards — the next enemy hit is halved. Passes the turn. */
export function guard(prev: BattleState): BattleState {
  if (prev.status !== 'active' || prev.turn !== 'player') return prev
  const s: BattleState = { ...prev, player: { ...prev.player } }
  s.guardNext = true
  s.turn = 'enemy'
  s.lastEvent = { kind: 'guard', by: 'player', text: `${s.player.name} braces for the next hit!` }
  return s
}

/** Befriend chance (0..1). Zero on Keeper battles or a healthy enemy. */
export function befriendChance(s: BattleState, quizCorrect = false): number {
  if (s.isKeeper) return 0
  const frac = s.enemy.hp / s.enemy.maxHp
  if (frac > 0.55) return 0
  const base = 0.18 + (1 - frac) * 0.6 + (quizCorrect ? 0.15 : 0)
  return Math.max(0, Math.min(0.95, base))
}

/** Attempt to befriend the weakened wild kin. roll ∈ [0,1); success if roll < chance. */
export function attemptBefriend(prev: BattleState, o: { roll: number; quizCorrect?: boolean }): BattleState {
  if (prev.status !== 'active' || prev.turn !== 'player') return prev
  const s: BattleState = { ...prev, player: { ...prev.player }, enemy: { ...prev.enemy } }
  const chance = befriendChance(s, o.quizCorrect)
  const success = chance > 0 && o.roll < chance
  if (success) {
    s.status = 'befriended'
    s.lastEvent = { kind: 'befriend-win', by: 'player', text: `You befriended ${s.enemy.name}! 💗` }
  } else {
    s.turn = 'enemy'
    s.lastEvent = { kind: 'befriend-fail', by: 'player', text: `${s.enemy.name} slipped free!` }
  }
  return s
}

/** The enemy takes its turn. variance defaults to 1 (deterministic for tests). */
export function enemyTurn(prev: BattleState, o: { variance?: number } = {}): BattleState {
  if (prev.status !== 'active' || prev.turn !== 'enemy') return prev
  const s: BattleState = { ...prev, player: { ...prev.player }, enemy: { ...prev.enemy } }
  // enemy uses a flat attack (its "quick" move) — always lands
  const { dmg, typeMult } = computeDamage(s.enemy, s.player, 14, 1, o.variance ?? 1)
  let final = dmg
  if (s.guardNext) { final = Math.max(1, Math.round(dmg * 0.4)); s.guardNext = false }
  s.player.hp = clampHp(s.player.hp - final, s.player.maxHp)
  const eff = typeMult > 1 ? ' Super effective!' : typeMult < 1 ? ' Not very effective…' : ''
  s.lastEvent = {
    kind: 'enemyMove', by: 'enemy', damage: final, effectiveness: typeMult,
    text: `${s.enemy.name} attacks! −${final}${eff}`,
  }
  settle(s)
  if (s.status === 'lose') s.lastEvent = { kind: 'faint', by: 'player', text: `${s.player.name} fainted!` }
  else s.turn = 'player'
  return s
}

/** Flee a wild battle (never a Keeper). */
export function flee(prev: BattleState): BattleState {
  if (prev.status !== 'active' || prev.isKeeper) return prev
  return { ...prev, status: 'fled', lastEvent: { kind: 'flee', by: 'player', text: 'Got away safely!' } }
}
