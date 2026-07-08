# LashiraBloom — PvP Arena Concept (SIMPLE model + per-path damage)

Status: **CONCEPT + first code landed.** Dated 2026-07-08. Rewritten to the owner's
simple spec (2026-07-08). Companion to the [map manifest](./map-and-asset-manifest.md)
(zone + economy) and [systems architecture](./mmorpg-architecture.md).

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

## 2. The four paths (from `progression.js`, unchanged)

| Path id | Displayed | Identity | L1 HP / MP | L99 HP / MP |
|---|---|---|---|---|
| `warrior` | Guardian ⚔️ | tank, huge HP, **big physical** | 120 / 30 | 10,018 / 1,990 |
| `rogue` | Shadow 🗡️ | skirmisher, high physical | 100 / 45 | 7,548 / 3,573 |
| `poet` | Mystic ✨ | caster, 2nd magic | 85 / 60 | 5,573 / 5,940 |
| `mage` | Arcanist 🔮 | glass cannon, **top magic** | 70 / 75 | 4,382 / 8,013 |

The HP/MP spread already balances PvP for free: the mage hits hardest with magic but has
the smallest HP pool (dies fast); the warrior soaks damage and clobbers physically but
his spells are weak. **Damage multipliers reinforce that identity; the pools punish it.**

---

## 3. Per-path damage model (the core new work) ✅ code landed

Added to `packages/combat/src/skills.js` — additive, so **Kingdom's live PvE is
untouched** until a caller opts in (PvP does).

### 3.1 The multipliers

```js
export const PATH_POWER = {
  warrior: { mag: 0.60, phy: 1.60 },   // weak magic, biggest physical
  rogue:   { mag: 0.85, phy: 1.30 },
  poet:    { mag: 1.25, phy: 0.85 },   // 2nd magic
  mage:    { mag: 1.50, phy: 0.60 },   // top magic, weakest physical
};
```

- **Magic order (mag):** Mage 1.50 > Poet 1.25 > Rogue 0.85 > Warrior 0.60 — exactly
  the owner's "mage higher, poet second, warrior last."
- **Physical order (phy):** Warrior 1.60 > Rogue 1.30 > Poet 0.85 > Mage 0.60 — the
  warrior's "big physical attack."

### 3.2 The seam (two new functions + a level-scaled physical base)

```js
export function physBase(L) { return 34 + 10 * (lv(L) - 1); }         // physical now scales w/ level
export function pathSkillPower(skill, pathId, L) {                    // magic (bolt/storm/mend)
  return Math.round(skillPower(skill, L) * pathPower(pathId).mag);
}
export function pathPhysPower(pathId, L) {                            // melee / PvP strike
  return Math.round(physBase(L) * pathPower(pathId).phy);
}
```

Why `physBase` scales with level now: HP pools balloon with level (warrior L99 ≈ 10k HP),
so a flat 34-damage strike would never end a high-level fight. Scaling physical like the
magic bases keeps fights the right length at every level. (The old flat `MELEE_DAMAGE=34`
and `PVP_DAMAGE=25` stay in the file for Kingdom's current PvE; PvP uses the new helpers.)

### 3.3 What the numbers actually look like

**Physical strike** = `pathPhysPower(path, L)` · **Bolt (magic)** = `pathSkillPower(bolt, path, L)`:

| Path | L1 phys / bolt | L10 phys / bolt | L25 phys / bolt |
|---|---|---|---|
| **Warrior** | **54** / 24 | **198** / 89 | **438** / 197 |
| **Rogue** | 44 / 34 | 161 / 126 | 356 / 279 |
| **Poet** | 29 / 50 | 105 / 185 | 233 / 410 |
| **Mage** | 20 / **60** | 74 / **222** | 164 / **492** |

Reading it: at every level the **warrior tops the physical column** and the **mage tops
the magic column**, with poet 2nd magic and rogue 2nd physical — the exact ordering asked
for. Storm (AoE) and Mend (heal) use the same `mag` multiplier, so casters also heal /
AoE harder; the warrior's spells are weak across the board — his answer is the strike.

### 3.4 How PvP consumes it (wiring, next step — not yet done)

- **Physical strike** on a player in the PvP zone → `pathPhysPower(attackerPath, attackerL)`.
- **Skill** on a player → `pathSkillPower(skill, attackerPath, attackerL)` (Mend heals self).
- The **victim** applies the number to its own HP (existing victim-authoritative model) and,
  on reaching 0, **faints** and reports a KO to the rank (§4). Attacker path/level come from
  the hero spec (`pathForWeapon(weapon)` until an explicit class picker exists).

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

## 7. Build steps (small)

0. **Per-path damage helpers** — `PATH_POWER`, `physBase`, `pathSkillPower`, `pathPhysPower`
   in `@arganta/combat`. ✅ **done** (this doc's landing).
1. **Player as a hittable target** — extend `hitTile`/`doStrike`/`doSkill` so a peer avatar
   in the PvP zone takes `pathPhysPower` / `pathSkillPower`; victim self-applies.
2. **Faint + KO** — downed animation + `pvp-ko` intent.
3. **`pvp_rank` table + RPC-lite write** — increment W/L on KO.
4. **Rank board** — signpost popup in-zone + "Circle PvP Rank" in Bloom Command.
5. **Hearts HUD** in the PvP zone (optional polish).

Steps 1–4 are the game; step 0 (the damage math you asked for) is already in the shared
package and inert until step 1 calls it.

---

## 8. Open confirmations (small)

1. **Rank metric** — plain **wins** (recommended, simplest) or a win/loss ratio?
2. **Path source** — use `pathForWeapon(hero.weapon)` for now (warrior/rogue/poet/mage
   inferred from the equipped weapon), or wait for an explicit class picker?
3. **Multiplier feel** — the §3.1 numbers are a first pass. Want warrior's physical even
   more dominant, or the mage even glassier? One-line tweak in `PATH_POWER`.

---

## 9. What was cut from the earlier concept (and why)

Removed per the "simple PvP" spec: the **Friendly vs Ranked two-tier split**, **cross-circle
matchmaking**, **level-bracketing**, **server-adjudication / deterministic lockstep**,
**cosmetic reward tiers**, and **season ladders**. All of that was solving *cross-circle,
contested, tamper-proof* PvP — which this design intentionally isn't. If cross-circle
ranked ever comes back, the server tier in `mmorpg-architecture.md §5.3/§7.5` is the path,
and `pvp_rank` becomes `pvp_ranking`. Not now.

---

*End. Concept + the per-path damage code (in `@arganta/combat`). Player-hit wiring +
circle-rank table are the remaining build steps.*
