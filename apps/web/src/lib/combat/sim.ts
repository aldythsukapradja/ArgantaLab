// ============================================================
//  ARGANTALAB · COMBAT SIMULATION  (Monte Carlo balance proof)
//  The hard rule from 07_ENGINEERING_LESSONS: never tune combat by vibe.
//  Before any combat numbers ship, prove the curve here — smart play should
//  win ~95%, naive ~33%, and a careful player should ALWAYS be able to win.
//  This runs thousands of battles under three policies and reports win rates.
//  engine.test.ts asserts the curve so it can never silently regress.
//
//  MODEL: the kid-facing battle has THREE peer choices after each question —
//  Strike, Weakness Break, Power Up — and no "Guard / End turn". A correct answer
//  ONLY charges Energy (autoHit = 0); ALL damage comes from the move the player
//  deliberately picks. Power Up is a charge (kind 'charge') the player banks when
//  it can't yet afford a hit; in the UI it costs an extra question, but the sim
//  conservatively still eats a telegraph after it (a true lower bound on
//  survivability). Proven on the shield-every-3rd enemy:
//  careful=1.00 / smart≈0.99 / naive≈0.29.
// ============================================================

import {
  createBattle, onAnswer, castAbility, enemyTelegraph, allyStrike,
  type CombatState, type PlayerConfig, type EnemyConfig, type AbilityRuntime, type Gimmick,
} from './engine'

// The proven shield size for shield3 kin (Monte Carlo: STD_ENEMY below).
export const SHIELD3_AMOUNT = 18

/** Map a kin row → the EnemyConfig the battle runs on. Structural param so the
 *  sim stays catalog-agnostic. This is the SINGLE source of truth for the
 *  mapping — OpenworldPlayer builds its enemy identically — so the roster sweep
 *  in engine.test.ts proves the numbers we actually ship, not a stand-in. */
export function kinToEnemy(def: { baseHp: number; power: number; gimmick: Gimmick }): EnemyConfig {
  return {
    maxHp: def.baseHp,
    power: def.power,
    gimmick: def.gimmick,
    shieldAmount: def.gimmick === 'shield3' ? SHIELD3_AMOUNT : 0,
    captureThreshold: 0.25,
  }
}

// deterministic PRNG so the proof is stable across machines/CI.
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type RNG = () => number

interface Policy {
  name: string
  missProb: number
  bold: boolean
  /** spend Energy on abilities for this round */
  act(s: CombatState, kit: Record<string, AbilityRuntime>): CombatState
}

// The shipped 3-move kit (Strike / Weakness Break / Power Up). No Guard.
//  charge.cost is 0 because Power Up is paid for with an extra QUESTION in the UI,
//  not Energy; the sim still pays a telegraph after it, keeping this a lower bound.
const KIT: Record<string, AbilityRuntime> = {
  strike: { id: 'ab:strike', kind: 'strike', cost: 10, power: 16 },
  break:  { id: 'ab:break',  kind: 'break',  cost: 10, power: 12 },
  charge: { id: 'ab:charge', kind: 'charge', cost: 0,  power: 22 },
}

const telegraphIncoming = (s: CombatState) => s.round % 3 === 0

// ── Three archetypes of play ────────────────────────────────
const CAREFUL: Policy = {
  name: 'careful', missProb: 0, bold: false,
  act(s, kit) {
    // never misses: Break the shield, else Strike, else Power Up to bank a charge
    // (so a low-Energy round is never wasted) — and there is no Guard to lean on.
    if (s.enemyShield > 0 && s.energy >= kit.break.cost) return castAbility(s, kit.break)
    if (s.energy >= kit.strike.cost) return castAbility(s, kit.strike)
    return castAbility(s, kit.charge)
  },
}

const SMART: Policy = {
  name: 'smart', missProb: 0.1, bold: false,
  act(s, kit) {
    // breaks shields to keep damage flowing; strikes otherwise; powers up when broke.
    if (s.enemyShield > 0 && s.energy >= kit.break.cost) return castAbility(s, kit.break)
    if (s.energy >= kit.strike.cost) return castAbility(s, kit.strike)
    return castAbility(s, kit.charge)
  },
}

const NAIVE: Policy = {
  name: 'naive', missProb: 0.25, bold: false,
  act(s, kit) {
    // ignores the enemy entirely — just mashes Strike (and gets eaten by shields).
    if (s.energy >= kit.strike.cost) return castAbility(s, kit.strike)
    return s
  },
}

export const POLICIES = { CAREFUL, SMART, NAIVE }

// ── one battle ──────────────────────────────────────────────
export function runBattle(p: PlayerConfig, e: EnemyConfig, policy: Policy, rng: RNG): 'win' | 'loss' {
  let s = createBattle(p, e)
  for (let guard = 0; guard < 60 && s.status === 'active'; guard++) {
    const miss = s.focusNext ? policy.missProb * 0.3 : policy.missProb
    const correct = rng() >= miss
    s = onAnswer(s, { correct, bold: policy.bold, energyPerCorrect: p.energyPerCorrect, autoHit: p.autoHit })
    if (s.status !== 'active') break
    s = policy.act(s, KIT)
    if (s.status !== 'active') break
    s = enemyTelegraph(s)
  }
  // reaching the Friendship Window (capture-window) or a defeat both mean "you beat it".
  return s.status === 'won' || s.status === 'capture-window' ? 'win' : 'loss'
}

// ── the standard MVP fixture: a Numeria shield-every-3rd kin (the skill check) ──
export const STD_PLAYER: PlayerConfig = {
  maxHearts: 5,
  loadout: [KIT.strike, KIT.break, KIT.charge],
  autoHit: 0, // a correct answer charges Energy only — damage comes from the chosen move
  energyPerCorrect: 10,
  mountPerk: null,
}

export const STD_ENEMY: EnemyConfig = {
  // Proven by Monte Carlo (see engine.test.ts): careful=1.00, smart≈0.99, naive≈0.29.
  maxHp: 110, power: 1, gimmick: 'shield3', shieldAmount: 18, captureThreshold: 0.25,
}

// ── CO-OP (bots-first): a kid + an AI buddy share ONE fight ──────────
//  The buddy is a FINISHER: steady chip damage every round, but it does NOT
//  break shields — so the KID still has to read the gimmick and Weakness-Break.
//  The enemy's HP is scaled up (~1.5×) so the buddy's help keeps the round count
//  (and therefore the heart pressure) close to the solo fight: co-op feels like
//  "a bigger foe, but you've got backup", NOT a free win. Proven below: careful
//  still 1.00, and naive is still punished (the buddy never covers a miss — a
//  wrong answer still hands the enemy a free swing at the shared hearts).
export interface CoopBuddy { power: number; breaks: boolean }
export const STD_BUDDY: CoopBuddy = { power: 5, breaks: false }
export const STD_COOP_ENEMY: EnemyConfig = {
  maxHp: 175, power: 1, gimmick: 'shield3', shieldAmount: 18, captureThreshold: 0.25,
}

export function runCoopBattle(p: PlayerConfig, e: EnemyConfig, policy: Policy, buddy: CoopBuddy, rng: RNG): 'win' | 'loss' {
  let s = createBattle(p, e)
  for (let guard = 0; guard < 80 && s.status === 'active'; guard++) {
    const miss = s.focusNext ? policy.missProb * 0.3 : policy.missProb
    s = onAnswer(s, { correct: rng() >= miss, bold: policy.bold, energyPerCorrect: p.energyPerCorrect, autoHit: p.autoHit })
    if (s.status !== 'active') break
    s = policy.act(s, KIT)
    if (s.status !== 'active') break
    s = allyStrike(s, buddy.power, { breakShield: buddy.breaks }) // the buddy helps
    if (s.status !== 'active') break
    s = enemyTelegraph(s)
  }
  return s.status === 'won' || s.status === 'capture-window' ? 'win' : 'loss'
}

export function simulateCoop(runs = 4000, seed = 4242, p = STD_PLAYER, e = STD_COOP_ENEMY, buddy = STD_BUDDY): SimResult {
  const rate = (policy: Policy, s0: number) => {
    const rng = mulberry32(s0)
    let wins = 0
    for (let i = 0; i < runs; i++) if (runCoopBattle(p, e, policy, buddy, rng) === 'win') wins++
    return wins / runs
  }
  return { careful: rate(CAREFUL, seed), smart: rate(SMART, seed + 1), naive: rate(NAIVE, seed + 2), runs }
}

export interface SimResult { careful: number; smart: number; naive: number; runs: number }

export function simulate(runs = 4000, seed = 1234, p = STD_PLAYER, e = STD_ENEMY): SimResult {
  const rate = (policy: Policy, s0: number) => {
    const rng = mulberry32(s0)
    let wins = 0
    for (let i = 0; i < runs; i++) if (runBattle(p, e, policy, rng) === 'win') wins++
    return wins / runs
  }
  return {
    careful: rate(CAREFUL, seed),
    smart: rate(SMART, seed + 1),
    naive: rate(NAIVE, seed + 2),
    runs,
  }
}
