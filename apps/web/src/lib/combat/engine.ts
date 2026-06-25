// ============================================================
//  ARGANTALAB · COMBAT ENGINE  (pure, content-agnostic)
//  This is the "built once" core. It knows NOTHING about specific kin,
//  worlds, or art — only numbers. All content (abilities/kin/worlds/mounts)
//  is data fed in via configs (see data/openworld/*). The same formulas run
//  client-side now and lift into a Supabase Edge Function unchanged for
//  server-authority later — so correctness/damage/diamonds are never trusted
//  from the client in production.
//
//  Design model (see 06_COMBAT_DEPTH): a correct answer makes ENERGY + a
//  small auto-hit; the player spends Energy on a 3-ability loadout; enemies
//  have a readable weakness + telegraphed gimmick; a wrong answer hands the
//  enemy a turn. A 6-year-old can win on auto-hit alone (depth is available,
//  not mandatory). Numbers are PROVEN by Monte Carlo in sim.ts — never tuned
//  by vibe (07_ENGINEERING_LESSONS).
//
//  Every function is pure: it clones the state and returns a new one, so it's
//  safe to drive React from and trivial to test.
// ============================================================

export type AbilityKind = 'strike' | 'charge' | 'shield' | 'break' | 'focus' | 'surge'
export type Gimmick = 'none' | 'shield3' | 'healOnMiss' | 'enrage'
export type MountPerkKind = 'energyStart' | 'guardOnce' | 'captureBoost' | 'comboKeep'

export interface AbilityRuntime { id: string; kind: AbilityKind; cost: number; power: number }
export interface MountPerk { kind: MountPerkKind; value: number }

export interface PlayerConfig {
  maxHearts: number
  loadout: AbilityRuntime[]
  autoHit: number            // small damage on a correct answer
  energyPerCorrect: number   // Energy gained per correct answer (Safe wager)
  mountPerk?: MountPerk | null
}

export interface EnemyConfig {
  maxHp: number
  power: number              // hearts removed per enemy hit (usually 1)
  gimmick: Gimmick
  shieldAmount: number       // shield gained on a shield3 telegraph beat
  captureThreshold: number   // hp fraction at/below which the Friendship Window opens
}

export interface CombatState {
  // live
  hearts: number
  enemyHp: number
  energy: number
  combo: number
  round: number              // completed player rounds
  enemyShield: number
  chargeMult: number         // 1 normally; >1 when a Charge is queued
  blockNext: boolean         // a queued Guard absorbs the next enemy hit
  weaknessOpen: number       // remaining hits that get the weakness bonus
  focusNext: boolean         // next question easier (UI/policy reads this)
  capture: number            // 0..100 Friendship meter
  status: 'active' | 'capture-window' | 'won' | 'lost'
  // one-shot mount flags
  firstCorrectDone: boolean
  mountGuardLeft: number
  comboKeepLeft: number
  // static config (carried so engine fns stay single-arg & serializable)
  maxHearts: number
  enemyMaxHp: number
  enemyPower: number
  gimmick: Gimmick
  shieldAmount: number
  captureThreshold: number
  mountPerk: MountPerk | null
}

const WEAKNESS_BONUS = 1.6
const CAPTURE_ON_BREAK = 22

export function createBattle(p: PlayerConfig, e: EnemyConfig): CombatState {
  const perk = p.mountPerk ?? null
  return {
    hearts: p.maxHearts,
    enemyHp: e.maxHp,
    energy: 0,
    combo: 0,
    round: 0,
    enemyShield: 0,
    chargeMult: 1,
    blockNext: false,
    weaknessOpen: 0,
    focusNext: false,
    capture: 0,
    status: 'active',
    firstCorrectDone: false,
    mountGuardLeft: perk?.kind === 'guardOnce' ? perk.value : 0,
    comboKeepLeft: perk?.kind === 'comboKeep' ? perk.value : 0,
    maxHearts: p.maxHearts,
    enemyMaxHp: e.maxHp,
    enemyPower: e.power,
    gimmick: e.gimmick,
    shieldAmount: e.shieldAmount,
    captureThreshold: e.captureThreshold,
    mountPerk: perk,
  }
}

// ── internal: deal damage to the enemy, honoring charge → weakness → shield ──
function strike(s: CombatState, base: number, opts: { weakness?: boolean; bypassShield?: boolean } = {}): void {
  let dmg = base
  if (s.chargeMult > 1) { dmg *= s.chargeMult; s.chargeMult = 1 }
  if (opts.weakness && s.weaknessOpen > 0) { dmg *= WEAKNESS_BONUS; s.weaknessOpen -= 1; s.capture = Math.min(100, s.capture + 6) }
  if (!opts.bypassShield && s.enemyShield > 0) {
    const absorbed = Math.min(s.enemyShield, dmg)
    s.enemyShield -= absorbed; dmg -= absorbed
  }
  s.enemyHp = Math.max(0, s.enemyHp - dmg)
}

// ── the enemy takes a swing (on player miss, or on a telegraphed beat) ──
function enemyHit(s: CombatState, extra = 0): void {
  let dmg = s.enemyPower + extra
  if (s.gimmick === 'enrage') dmg += Math.floor(s.round / 3)
  if (s.blockNext) { s.blockNext = false; return }
  if (s.mountGuardLeft > 0) { s.mountGuardLeft -= 1; return }
  s.hearts = Math.max(0, s.hearts - dmg)
}

function settle(s: CombatState): void {
  if (s.hearts <= 0) { s.status = 'lost'; return }
  if (s.enemyHp <= 0) { s.status = 'won'; return }
  if (s.enemyHp / s.enemyMaxHp <= s.captureThreshold) s.status = 'capture-window'
}

/**
 * Resolve the answer phase of a round.
 *  - correct → Energy (+ mount energyStart on the first one) + a small auto-hit, combo++
 *  - wrong   → combo resets (unless a comboKeep mount saves it), the enemy gets a free
 *              swing, and a healOnMiss enemy mends a little.
 * `bold` (the wager) doubles Energy on a hit but makes a miss sting harder.
 */
export function onAnswer(
  prev: CombatState,
  o: { correct: boolean; difficulty?: number; speedFactor?: number; bold?: boolean; energyPerCorrect: number; autoHit: number },
): CombatState {
  if (prev.status !== 'active') return prev
  const s: CombatState = { ...prev }
  s.round += 1
  s.focusNext = false
  if (o.correct) {
    let gain = o.energyPerCorrect * (o.bold ? 2 : 1)
    if (!s.firstCorrectDone && s.mountPerk?.kind === 'energyStart') { gain += s.mountPerk.value; }
    s.firstCorrectDone = true
    s.energy += gain
    s.combo += 1
    // A correct answer can land a small auto-hit (autoHit > 0). With autoHit = 0
    // the answer ONLY charges Energy — all damage then comes from the move the
    // player deliberately picks (Strike/Weakness Break), and the weakness window
    // is preserved for that move instead of being spent on a free hit.
    if (o.autoHit > 0) strike(s, o.autoHit, { weakness: true })
  } else {
    if (s.comboKeepLeft > 0) s.comboKeepLeft -= 1
    else s.combo = 0
    if (s.gimmick === 'healOnMiss') s.enemyHp = Math.min(s.enemyMaxHp, s.enemyHp + Math.round(s.enemyMaxHp * 0.05))
    enemyHit(s, o.bold ? 1 : 0) // a wrong answer hands the enemy a turn
  }
  settle(s)
  return s
}

/** Fire a loadout ability. Pure no-op (returns prev) if Energy is short or battle is over. */
export function castAbility(prev: CombatState, ab: AbilityRuntime): CombatState {
  if (prev.status !== 'active' && prev.status !== 'capture-window') return prev
  if (prev.energy < ab.cost) return prev
  const s: CombatState = { ...prev }
  s.energy -= ab.cost
  switch (ab.kind) {
    case 'strike': strike(s, ab.power, { weakness: true }); break
    case 'charge': s.chargeMult = Math.max(s.chargeMult, ab.power / 10); break
    case 'shield': s.blockNext = true; break
    case 'break':  s.enemyShield = 0; s.weaknessOpen = 2; s.capture = Math.min(100, s.capture + CAPTURE_ON_BREAK); strike(s, ab.power, { bypassShield: true }); break
    case 'focus':  s.focusNext = true; break
    case 'surge':  /* co-op: routes Energy to a teammate; solo = banked, no-op */ break
  }
  settle(s)
  return s
}

/**
 * The enemy's telegraphed beat at the end of a round: shield3 raises a shield and
 * swings; enrage/none swing; healOnMiss stays passive here. Every 3rd round, so the
 * player can read it and pre-Guard. Pure.
 */
export function enemyTelegraph(prev: CombatState): CombatState {
  if (prev.status !== 'active') return prev
  const s: CombatState = { ...prev }
  if (s.round % 3 === 0) {
    if (s.gimmick === 'shield3') { s.enemyShield += s.shieldAmount; enemyHit(s) }
    else if (s.gimmick === 'enrage') { enemyHit(s) }
    else if (s.gimmick === 'none') { enemyHit(s) }
    // healOnMiss enemies pressure you only when you slip — no scheduled swing
  }
  settle(s)
  return s
}

/**
 * A teammate's hit on the SHARED enemy (co-op). Pure: it chips the same enemy
 * HP/shield the local player is fighting, but never touches the player's energy,
 * hearts, or combo — the ally is a HELPER whose hits only speed the win. A
 * 'breaker' ally also strips the shield and opens the weakness window (its role).
 * Same shape as the rest of the engine, so it lifts to the server unchanged when
 * a real teammate replaces the bot.
 */
export function allyStrike(prev: CombatState, power: number, opts: { breakShield?: boolean } = {}): CombatState {
  if (prev.status !== 'active' && prev.status !== 'capture-window') return prev
  const s: CombatState = { ...prev }
  if (opts.breakShield && s.enemyShield > 0) {
    s.enemyShield = 0
    s.weaknessOpen = Math.max(s.weaknessOpen, 2)
    s.capture = Math.min(100, s.capture + CAPTURE_ON_BREAK)
  }
  strike(s, power, { bypassShield: !!opts.breakShield })
  settle(s)
  return s
}

/** Chance (0..1) that a befriend attempt succeeds, given the weakened state. */
export function captureChance(s: CombatState, mountBoost = 0): number {
  const hpFrac = s.enemyHp / s.enemyMaxHp
  const base = 0.25 + s.capture / 100 * 0.45 + (1 - hpFrac) * 0.25 + mountBoost / 100
  return Math.max(0, Math.min(0.97, base))
}

/** Resolve a befriend attempt at the Friendship Window. Must answer the capture Q (skill-gated). */
export function attemptCapture(
  prev: CombatState,
  o: { answeredCorrect: boolean; roll: number; mountBoost?: number },
): { state: CombatState; success: boolean } {
  const s: CombatState = { ...prev }
  if (s.status !== 'capture-window') return { state: s, success: false }
  const success = o.answeredCorrect && o.roll <= captureChance(s, o.mountBoost ?? 0)
  s.status = success ? 'won' : 'active' // a missed befriend leaves the battle live (it may flee / you defeat it)
  return { state: s, success }
}

// ── reward math (pure) ──────────────────────────────────────
export function xpForTurn(difficulty: number, speedFactor: number, combo: number): number {
  const base = 6
  const comboMult = 1 + Math.min(combo, 6) * 0.1
  return Math.round(base * Math.max(1, difficulty) * Math.max(0.6, speedFactor) * comboMult)
}

export function diamondsForVictory(enemyTier: number, firstClear: boolean, captured: boolean): number {
  // Defeat pays a bit more raw diamonds; befriending pays less now but the kin
  // harvests diamonds later in the Nexus. Diamonds buy cosmetics/mounts only.
  let d = 8 + enemyTier * 4
  if (firstClear) d += 10
  d = captured ? Math.round(d * 0.7) : d
  return d
}

// ── canon adaptive rating (PersonRingRating Elo, 05_STATE_CONTRACT) ──
export function nextRating(rating: number, qDiff: number, correct: boolean): number {
  const expected = 1 / (1 + Math.pow(10, (qDiff - rating) / 4))
  const r = correct ? rating + 0.4 * (1 - expected) : rating - 0.4 * expected
  return Math.max(1, Math.min(10, r))
}
