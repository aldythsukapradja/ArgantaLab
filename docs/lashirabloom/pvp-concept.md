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
