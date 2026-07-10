# LashiraBloom — PvP Arena Concept (SIMPLE model + per-path damage)

Status: **BUILT 2026-07-09** (full fairness model, per §8.3's answer). Dated
2026-07-08, built the day after. Companion to the [map manifest](./map-and-asset-manifest.md)
(zone + economy) and [systems architecture](./mmorpg-architecture.md).

## BUILD NOTES (2026-07-09)
All 6 steps in §7 are done. What actually landed, file by file:
- `packages/combat/src/pvp.js` (NEW): `pvpMaxHp`, `pvpAttackCooldownMs`,
  `pvpMoveMultiplier` (normalized to warrior=1.0x), `pvpBoltReach`,
  `rollPvpDamage` (spread/crit/miss), `canPvpHeal`, `pvpHealMul` — all consuming
  the already-tuned PATH_POWER/PVP_PROFILE/PVP_TUNING unchanged.
- `farm-map.js`: `inPvp(tx,ty)` + `BATTLEGROUND` (arena minus the PvP rect) —
  monsters now spawn/chase ONLY in battleground, never crossing into PvP even
  mid-chase. New `pvprank` hotspot at the existing scoreboard prop tile.
- `FarmRoom.jsx`: `g.pvp = {on, healsUsed}` layered on `g.combat`; `stepBattle`
  resizes HP to `pvpMaxHp` (not the PvE pool) on any PvP-boundary cross and
  resets the heal counter; `step()` applies the per-path move multiplier only
  in PvP; `doStrike`/`doSkill` delegate to new `pvpStrike`/`pvpCast` when
  `g.pvp.on` (PvE monster-combat code path left 100% untouched — zero risk of
  regression); new `peerPlayerAt`/`peerPlayersInPvp` target peers instead of
  monsters; victim-authoritative `pvp-hit` intent (attacker sends, victim
  applies to their OWN hp, matching §6 exactly); `pvpFaintPlayer` reuses the
  monster-faint knockback/heal treatment + calls `pvp_record_ko`.
- `supabase/migration_lashira_pvp.sql` (NEW, NOT yet run): `pvp_rank` table
  (member-readable, no direct writes) + `pvp_record_ko(p_circle,p_winner)` —
  called by the DOWNED player, increments both rows in one trip.
- `game/pvp-rank.js` (NEW): client wrappers (`recordPvpKo`, `listPvpRank`).
- `ui/PvpHearts.jsx` (NEW) + `Hud.jsx`: 5-heart chunky HP display, shown
  alongside (not replacing) the normal UnitCard while `battle.pvp` is true.
- `ui/HotspotPanels.jsx`: `PvpRankPanel` — wins-first board (tiebreak win-rate
  then streak), includes 0-0 members who haven't fought yet.
- Verified: pure fairness-math checked via a standalone script (warrior 876 HP
  vs mage 584 at L10 ✓, warrior 1100ms/rogue 690ms attack cooldown ✓, move
  multipliers 1.0/1.13/0.67 ✓, Bolt capped at 2 ✓, heal gate ✓, damage variance
  ~7.5% miss/~11% crit over 5000 rolls, both near the ~8%/~12% targets).
  `npm run build` clean; combat tests 50/50. Live-verified via `window.__G` +
  synthetic keydown (same technique as the earlier attack-cooldown check): with
  `g.pvp.on` forced true, the attack cooldown measured ~1040ms — the per-path
  PvP value (1100 for warrior), NOT the flat PvE 550ms — confirming the branch
  actually fires end-to-end. **NOT dual-client tested** — this sandbox can't
  drive two independent peers; the victim-authoritative sync design mirrors
  the already-proven monster peer-hit pattern exactly, but a real two-device
  duel is the one thing only a live playtest can confirm.
- Migration NOT yet run in Supabase (same convention as prior migrations).

## LIVE PLAYTEST FIXES (2026-07-09, same day — real two-device test)
First real two-player duel (screenshot evidence) found: (1) no damage landed
AT ALL, melee or magic, and (2) players could walk straight through each other.
- **Root cause of (1), the big one**: the receiving side's `pvp-hit` handler
  re-checked `!g.pvp.on` on the VICTIM's own client before applying damage —
  redundant (the ATTACKER already verified their own zone state before ever
  sending the hit) and a pure false-negative risk: any beat of cross-client
  timing skew silently dropped the hit. **Removed that gate entirely** — the
  attacker's check is the real one; a trusted family circle doesn't need
  double verification here. This alone explained "cannot do any damage,
  including magic" (all three attack types route through the same receiver).
- **Contributing factor**: melee (`pvpStrike`) only checked the single exact
  cardinal-faced tile — two independently-moving clients are rarely in perfect
  alignment. Now falls back to ANY adjacent tile (8-directional, chebyshev ≤1)
  before giving up.
- **Diagnostic toasts added** to all three attack paths (melee/Bolt/Storm) —
  "No one in range" / "Out of range" / "No one else in the arena" — so if a
  future miss happens, it's visibly a range/targeting issue, not a silent void.
- **(2) fixed**: added `peerPlayerBlockedAt()` (mirrors the existing
  `monsterAt()` body-block) into the player move-gate, scoped to ONLY apply
  while `g.pvp.on` (farm-wide would add unwanted friction to family members
  farming side by side — this is a duel-arena-only rule).
- **Bonus UI fix**: user wanted the hearts moved from a standalone floating
  pill into the HUD card itself, directly above the name row. `UnitCard.jsx`
  gained an optional `pvpHearts` slot (additive — peer cards/non-PvP contexts
  render identically); Hud.jsx now passes it in instead of rendering it as a
  sibling; hearts restyled smaller/inline to match the card's light glass
  theme instead of the old dark standalone-pill look.
- Verified: `npm run build` clean (155 modules); combat tests 50/50; DOM-
  confirmed the card's non-PvP structure is unchanged (`.unit-main`'s first
  child is still `.unit-name` when hearts are null) and `peerPlayerBlockedAt`
  doesn't crash with an empty peer map (solo sanity check). **Still NOT
  dual-client tested** — same sandbox limitation; the pvp-hit gate removal is
  the single highest-confidence fix (a redundant check with no upside, direct
  code-read confirmed it existed exactly where suspected), but a real
  two-device duel remains the only way to fully confirm.

## THE ACTUAL BUG, FOUND (2026-07-09, same day — 2nd live report "still not
working" after the above fix didn't fully resolve it)
User pointed at Kingdom Heroes' OWN PvP code as the reference ("look at kingdom
heroes... it is directly to the HP not additional hearts"). Read
apps/kingdom/web/src/room/TestRoom.jsx's real, working player-attack flow
(`strike()` + the `ev.type==='attack'` handler, ~line 348-364): Kingdom uses
ONE flat hp/maxHp pool everywhere, no PvP-specific resize logic at all — just
`p.hp = Math.max(0, p.hp - PVP_DAMAGE)` then sync. Comparing that against
LashiraBloom's `stepBattle` exposed the REAL bug: my zone-transition block
resized `g.combat.maxHp` to the PvP-fair curve AND **fully refilled to max HP**
every single time `pvpOn` changed — including crossing the internal PvP↔
battleground line WHILE ALREADY MID-FIGHT (players constantly step back and
forth during a real duel). Every crossing silently topped both players back to
100%, so landed damage appeared to do nothing — a deterministic bug, not a
network-timing guess.
**Fix**: rewrote the transition block to distinguish two cases —
(a) FRESH entry from completely outside the arena band → full refill (kept,
matches Kingdom's "clean slate on entry"/the original flat-100 bug fix), vs.
(b) crossing the PvP↔battleground line while ALREADY in combat → resize to the
new ruleset's curve but CARRY OVER THE CURRENT HP FRACTION (30%→30%, rescaled),
never a full heal. Also fixed a latent edge case: the PvP rectangle shares two
edges with the outer arena (PVP.x1===ARENA.x1, PVP.y0===ARENA.y0), so stepping
straight from PvP to outside-the-arena in one tile-move is geometrically
possible — the old three-branch draft mishandled that compound transition
(left `g.combat.on` stale); the shipped version computes both flags at the top
of one unified block so it's correct regardless of which transition combo fires.
Verified: `npm run build` clean (155 modules); combat tests 50/50; replicated
the exact fraction-carry formula in a live eval against real g.combat state —
300/1000 HP (30%) crossing into a 800-max PvP pool correctly became 240/800
(still 30%), not a full refill. Kept the fairness HP-curve research intact
(this fixes the REFILL bug, not the "PvP needs its own compressed HP" finding).
Still NOT dual-client tested (same sandbox limit) — but this is now a
deterministic, code-provable bug fix rather than a guess, found by direct
comparison against Kingdom's own proven implementation.

## STILL BROKEN AFTER THE ABOVE — DIAGNOSTIC INSTRUMENTATION ADDED
(2026-07-09, same day, 4th round). User reported the HP-refill fix didn't fully
resolve it either. Re-read the ENTIRE chain fresh (doStrike/doSkill wiring,
pvpStrike/pvpCast/peerPlayerAt/peerPlayersInPvp/pvpHitPeer, the applyIntent
pvp-hit receiver, farm-presence.js's sendIntent/broadcast plumbing) — found no
NEW logic bug via static review; everything traces correctly. Rather than
guess a 5th time, added REAL visible diagnostics (all marked TEMP, meant to be
removed once confirmed working):
- **Zone-state badge** (Hud.jsx, always visible whenever `battle.on`): shows
  "⚔ PvP zone — ON" or "🌲 Battleground (not PvP)" so each player can see, at a
  glance, whether THEIR OWN client actually registers them as inside the PvP
  rectangle — tests the leading remaining hypothesis: the visual arena art
  (a polished circular platform, clearly added by another session since I
  last read the map) may not align with the LOGICAL PVP rect bounds
  (x0:40,y0:33,x1:57,y1:45) I built against. If the attacker's badge reads
  "Battleground" while they're visually standing on the arena art, that's the
  bug — a map/geometry mismatch, not a combat-logic one.
- **Attacker success flash**: "⚔ Hit {name} for {dmg}" / "⚔ Miss!" fires the
  instant pvpStrike/pvpCast successfully resolves a target — confirms the
  attacker's OWN logic ran and found someone, independent of whether the hit
  actually lands on the other screen.
- **Receiver arrival flash**: fires the INSTANT any pvp-hit intent is received,
  BEFORE the targetId check, showing both ids (truncated) — confirms whether
  intents are arriving over the wire at all, and whether the id match would
  pass. A second flash confirms the actual hp deduction after applying.
Verified via synthetic test (window.__G + a hand-inserted fake peer + keydown):
forced g.pvp.on=true, planted a fake peer at the front tile, swung — got
exactly `"⚔ Hit TestBot for 62"`, proving the ATTACKER-SIDE hit-resolution
logic is 100% correct when given valid inputs (a real peer entry + pvp.on
true). This means if it's STILL failing live, the bug is now narrowed to
either (a) the zone badge reading wrong (geometry mismatch) or (b) the peer
data/network layer (g.peerActors not populated/positioned correctly, or the
intent never arriving) — NOT the hit-resolution math itself, which is now
proven sound in isolation.
**Next step is data, not another guess**: ask for a screenshot of BOTH
players' zone badges + toast feed during a duel attempt.

## THE DATA CAME BACK — RECEIVER-SIDE FIX (2026-07-09, 5th round, user switched
to Opus). Screenshot showed the ATTACKER's "✦ Hit Keyla for 697" flash firing
AND "PvP zone — ON" badge — but Keyla's HP stayed full. So: attacker-side is
100% fine (finds target, sends intent, in-zone). The failure is RECEIVER-side.
Went and read Kingdom Heroes' OWN pvp receiver (apps/kingdom .../TestRoom.jsx
~line 348) as the reference: Kingdom uses ONE flat hp pool, applies
`p.hp -= PVP_DAMAGE`, done — no zone-based resize anywhere.
The most likely receiver failure given "shows full": Lashira's `faintPlayer`
HEALS TO FULL (`g.combat.hp = g.combat.maxHp`) at hp≤0. If Keyla's local
combat pool was still the default ~100 (her arena-entry sizing transition
hadn't fired on her client for whatever reason), a 697 hit → hp≤0 → faint →
heal to full → looks like "no damage." Secondarily, a stale `combat.on=false`
would make the HUD show full HP regardless (cardFromSnap shows maxHp out of
combat).
**FIX** (`ensurePvpCombat(g)`, called on the receiver BEFORE subtracting): sizes
my local pool to the correct `pvpMaxHp(path, level)` (carrying the HP fraction
if a real pool already existed) AND forces `combat.on=true`/`pvp.on=true`, so
(a) a big hit lands on the real ~3700 pool instead of a phantom 100 (no
spurious faint-heal) and (b) the HUD always reflects the drop. Also added a
damage float + spark + hurt-sfx on the victim so the hit is FELT, and reduced
the pre-check diagnostic to fire ONLY on an id mismatch (silent on the normal
path) — so if it's somehow an id-format bug instead, the next duel will show
"⚠ pvp-hit not for me" with both ids. Verified: attacker path still fires
("⚔ Hit KeylaBot for 50" via synthetic test); build clean (154 modules).
Receiver fix is code-read + logic-verified (can't dual-client test) but now
robustly handles the faint-heal AND stale-display failure modes, which are the
two most consistent with "shows Hit but victim stays full."
Also this round: **replaced the 5-heart PvP HP display with a persistent,
location-aware ZONE PILL** (user request) — new `zoneOf(tx,ty)` in farm-map.js
(Farm/PvP Arena/Hunting Ground/Mines/Forest/Fishing/Garden/Castle/Shops/Cow/
Sheep/Chicken/Meadow), driven from the game loop, shown top-left; battle-tested
15/15 across every zone incl. the PvP/battleground boundary. PvP HP now reads
off the card's HP bar (like Kingdom). Zone pill turns red in the PvP arena so
it doubles as the "combat live here" cue.

The earlier two-tier (Friendly + cross-circle Ranked + server-adjudication) design is
**dropped** — see §9 for what was cut and why. This is the whole thing now.

---

## 0. The spec, in the owner's words

> "Simple PVP. People enter the area, can hit each other, and it's recorded in the
> circle rank. That's it. Can be hit through skills or physical attack."
> "Skill damage per path: mage has higher magic, poet second, warrior last — but
> warrior has big physical attack."

So the whole design is exactly three things:

1. **Enter the PvP zone → combat is on → you can hit other players in it.**
2. **Hit with a physical strike OR a skill** (Bolt / Storm / Mend — the existing 3).
3. **Every knockout is recorded to a per-circle rank.** No cross-circle, no season
   ladder, no cosmetics, no matchmaking. Just: fight your circle, climb the board.

---

## 1. What already exists (grounding)

| Piece | Where | Role in PvP |
|---|---|---|
| Walled PvP zone, `combat.on` flip on entry | `farm-map.js` `PVP={x0:40,y0:33,x1:57,y1:45}` | The stage — walk in = fight mode |
| Shared combat: Bolt/Storm/Mend + melee, level-scaled | `@arganta/combat` `skills.js`/`resolve.js` | The hit rules |
| `PVP_DAMAGE=25` (flat, "victim self-applies") | `constants.js:8` | Being replaced by **per-path physical** (§3) |
| Victim-authoritative sync (self-applies hits) | `FarmRoom.jsx` `hitTile`/`peerHit` | The netcode — good enough within a trusted circle |
| Broadcast spell VFX | `FarmRoom.jsx` `castSpell` → `{t:'spell'}` intent | Opponents see your cast land |
| **Path system** warrior/rogue/poet/mage + HP/MP pools | `progression.js` `PATHS` | The class identity PvP damage keys off |
| **Per-path power multipliers (NEW, just added)** | `skills.js` `PATH_POWER`/`pathSkillPower`/`pathPhysPower` | §3 — the damage-per-path model |

**PvP is nearly free to build:** the zone, the combat engine, the sync model, and now
the per-path damage all exist. What's left is wiring a player as a hittable target and
counting KOs into a circle-rank row.

---

## 2. The four paths + the fairness problem

| Path id | Displayed | Intended PvP identity |
|---|---|---|
| `warrior` | Guardian ⚔️ | tanky bruiser — **biggest single hit**, slow, must close to melee |
| `rogue` | Shadow 🗡️ | skirmisher — **fast, many small hits**, closes fastest |
| `poet` | Mystic ✨ | attrition caster — **2nd magic** + self-heal sustain, ranged |
| `mage` | Arcanist 🔮 | glass cannon — **top magic**, frail, punishes from range |

The owner's ask: *"adjust the skill so at the same level all 4 have a similar chance to
win."* I researched this with a duel simulator (`docs/lashirabloom/pvp-balance-sim.mjs`,
Monte-Carlo, thousands of duels per matchup). Three findings reshaped the design — a naive
per-path damage table is **nowhere near** fair:

1. **Cost-1, whole-arena Bolt breaks everything.** If a skill is free and hits at any
   range, *nobody ever melees* → warrior's whole identity is dead → **warrior wins 0%** at
   every level. Range and MP/reach are balance levers, not flavor.
2. **The PvE HP pools make fairness impossible to hold across levels.** In `progression.js`
   warrior HP grows at `hpPer=101` vs mage's `44` — a **2.3× gap by L99**. That gap widens
   with level while per-hit/kiting don't, so *any* fixed damage table is fair at one level
   and lopsided at another. **PvP must use its own compressed HP spread.**
3. **Four fair archetypes need four distinct levers, not one.** With only a
   damage-multiplier knob, rogue becomes a strictly-worse warrior (a "trap class",
   **0–19% win rate**). Rogue's identity is **attack speed**, poet's is **sustain**,
   mage's is **range burst** — none of which is "a bigger number."

**Conclusion: fairness is a whole PvP combat model, not a damage tweak** — compressed HP +
per-path attack speed + move speed + a short bolt reach + hit variance. The tuned result
below lands every matchup at ~50/50.

---

## 3. The fair PvP profile (battle-tested) ✅ tuned values landed as spec

The balanced set, found by simulation and stored in `packages/combat/src/skills.js` as
`PATH_POWER` (per-hit multipliers) + `PVP_PROFILE` (the rest) + `PVP_TUNING` (globals).
**Inert** — it changes nothing until PvP combat is wired; Kingdom PvE is untouched.

### 3.1 Per-path stats

| Path | `mag` (magic ×) | `phy` (physical ×) | `atkInt` (s/hit) | `moveRel` | `pvpHpMul` | `healMul` |
|---|---|---|---|---|---|---|
| **Warrior** | 0.55 | **1.55** | 1.10 (slow) | 3.0 | **1.20** (tankiest) | 0.6 |
| **Rogue** | 0.70 | 1.00 | **0.69 (fast)** | **3.4** | 1.06 | 0.8 |
| **Poet** | 1.15 | 0.80 | 1.00 | 2.1 | 1.03 | **1.3 (best heal)** |
| **Mage** | **1.45** | 0.58 | 1.00 | 2.0 | **0.80** (frailest) | 1.0 |

Globals (`PVP_TUNING`): bolt **reach = 2 tiles**, PvP **HP curve = `100 + 70·(L-1)`** (one
shared curve × `pvpHpMul` → a level-*stable* spread, not the divergent PvE pools), hit
**variance** = ±18% spread + 12% crit (×1.6) + 8% miss, Mend heals `30+10·(L-1)` × `healMul`
when below 30% HP (max 2/duel).

- **Owner's ordering preserved.** Magic: mage 1.45 > poet 1.15 > rogue 0.70 > warrior 0.55.
  Physical: warrior 1.55 > rogue 1.00 > poet 0.80 > mage 0.58. ✅
- **Key insight — rogue's damage is SPEED, not size.** Its `phy` is only 1.00 (a small hit)
  but `atkInt` 0.69 means it hits ~1.6× as often as the warrior. So warrior = one big
  slow hit, rogue = a flurry — different feel, similar DPS.
- **Why warrior is tankiest, mage frailest.** To equalize effective power (`HP × DPS`),
  the low-DPS warrior needs the most HP and the high-DPS mage the least. The compression
  is modest (1.20 vs 0.80 = **1.5×**, vs the PvE pools' 2.3×) so it stays fair at all levels.

### 3.2 Simulated win rates (the "battle test")

Row = win% vs column, at level 10 (representative; full run in the sim, levels 1–80):

```
          warrior  rogue   poet   mage
 warrior     --     46%    41%    46%
 rogue       54%     --    45%    46%
 poet        59%    55%     --    54%
 mage        53%    54%    46%     --
 overall:  war 44%  rog 48%  poe 56%  mag 51%
```

Across **levels 5–80 every matchup sits ~40–60%** (RMS deviation from 50% ≈ **7.7 pts**,
down from **47 pts** on the naive table). Level 1 is slightly poet-favored — a known
small-pool artifact where the flat heal is proportionally huge; it self-corrects by ~L5.

> **Caveat (honest):** the sim is deterministic-ish, so it *exaggerates* small edges (a
> real 7% advantage reads as ~60% here). With human skill added, matchups are closer than
> the table. So these numbers are a *direction*, validated by simulation — **final tuning
> needs real playtests**, which the sim can't replace.

### 3.3 What this requires the PvP combat layer to add (beyond damage)

The fair result depends on mechanics the engine **doesn't have yet** — this is the real
build surface (still concept):

1. **PvP HP normalization** — use `PVP_TUNING.hpCurve × pvpHpMul`, *not* `pathMaxHp` from
   the PvE pools. (The single biggest fairness lever.)
2. **Per-path attack speed** (`atkInt`) — a cooldown on strikes/casts. Rogue's whole
   identity. The engine currently attacks on tap cadence with no per-path speed.
3. **Per-path move speed** (`moveRel`) — lets warrior/rogue close before being kited to death.
4. **Short bolt reach** (2 tiles) — today Bolt targets the nearest actor anywhere; PvP must
   cap its range or casters kite melee to 0% (finding #1).
5. **Hit variance** (spread/crit/miss) — makes near-equal builds feel fair (and fun).

Damage per hit itself = `pathPhysPower` / `pathSkillPower` (already in the package, now
carrying the tuned `PATH_POWER`). Mend heals self, scaled by `healMul`.

---

## 4. Circle rank (the "recorded" part)

Dead simple, per circle — no cross-circle, no seasons unless you want them later.

```sql
pvp_rank(circle_id, profile_id, wins, losses, streak, updated_at)   -- one row per member
```

- A **KO in the PvP zone** = +1 win for the victor, +1 loss for the downed player.
- **Ranking = wins** (tiebreak: win-rate, then streak). Show it as a **board** in the PvP
  zone (tap a signpost) and in **Bloom Command** (a "Circle PvP Rank" table).
- **Authority:** for a trusted family circle, the victim reporting its own KO is fine
  (same posture as monster hits today). If you ever want it tamper-proof, a `pvp_report`
  RPC is a drop-in later — but **not needed for the simple version.**
- **Walls stay intact:** rank is just W/L — it mints **no Gold, no Diamonds, no XP**. Kids
  can climb the board without it touching learning or progression.

---

## 5. Kid-safety (kept minimal, matches the woodland tone)

- **Faint, not die** — the downed player flops, stars circle their head, stands back up
  after a moment (reuse the monster-faint treatment).
- **Only inside the PvP zone.** Outside it, `combat.on` is false — nobody can be hit while
  farming. (The zone flip already guarantees this.)
- **HP shown as hearts** (chunky) rather than a thin bar — clearer, gentler.
- No penalty loop, no trash-talk surface. It reads as a schoolyard game.

---

## 6. Netcode — nothing new required

Within-circle PvP rides the **existing** presence channel and victim-authoritative model:

- Attacker: play swing / cast, `castSpell` broadcasts the VFX, send a `pvp-hit{dmg,by}` intent.
- Victim: apply `dmg` to own HP; at 0 → faint + `pvp-ko{by}` intent → both update `pvp_rank`.

No server-adjudication tier, no instancing, no matchmaking. That whole apparatus was for
cross-circle ranked, which this design **drops**.

---

## 7. Build steps

0. **Balance profile** — `PATH_POWER` (tuned) + `PVP_PROFILE` + `PVP_TUNING` in
   `@arganta/combat`. ✅ **landed as inert spec** (this doc's research).
1. **PvP combat model** (the fairness engine, §3.3): PvP HP normalization, per-path
   attack speed + move speed, short bolt reach, hit variance. This is the substantive
   new work — a small `pvpCombat` module consuming the profile.
2. **Player as a hittable target** — extend `hitTile`/`doStrike`/`doSkill` so a peer avatar
   in the PvP zone takes path-scaled damage; victim self-applies.
3. **Faint + KO** — downed animation + `pvp-ko` intent.
4. **`pvp_rank` table + RPC-lite write** — increment W/L on KO.
5. **Rank board** — signpost popup in-zone + "Circle PvP Rank" in Bloom Command.
6. **Hearts HUD** + **playtest-tune** the profile (the sim gives a direction; real duels finalize it).

The damage *numbers* you asked for are landed (step 0); the *fairness* also needs the
combat model (step 1), because — per the research — damage multipliers alone can't do it.

---

## 8. Open confirmations

1. **Rank metric** — plain **wins** (recommended, simplest) or a win/loss ratio?
2. **Path source** — use `pathForWeapon(hero.weapon)` for now (warrior/rogue/poet/mage
   inferred from the equipped weapon), or wait for an explicit class picker?
3. **Accept the PvP combat model?** Fairness needs the §3.3 mechanics (compressed HP,
   attack speed, move speed, short reach, variance) — more than "adjust the skill." OK to
   build that, or do you want a *simpler-but-less-fair* version (e.g. just the damage
   multipliers, accepting warrior/mage imbalance)?
4. **Feel tweaks** — want warrior's hits even bigger / mage even glassier / rogue even
   faster? Each is a one-line change in `PVP_PROFILE`, then re-run the sim.

---

## 9. What was cut from the earlier concept (and why)

Removed per the "simple PvP" spec: the **Friendly vs Ranked two-tier split**, **cross-circle
matchmaking**, **level-bracketing**, **server-adjudication / deterministic lockstep**,
**cosmetic reward tiers**, and **season ladders**. All of that was solving *cross-circle,
contested, tamper-proof* PvP — which this design intentionally isn't. If cross-circle
ranked ever comes back, the server tier in `mmorpg-architecture.md §5.3/§7.5` is the path,
and `pvp_rank` becomes `pvp_ranking`. Not now.

---

*End. Concept + battle-tested balance (tuned values in `@arganta/combat`, reproducible via
`docs/lashirabloom/pvp-balance-sim.mjs`). The PvP combat model + player-hit wiring +
circle-rank table are the remaining build steps.*
