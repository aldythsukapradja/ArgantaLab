# Combat Skills, Effects, Rewards & Reward-Pill — Concept (v1, no build yet)

Single source of truth = `packages/combat`. Everything below is **shared**: edit
once, both **Kingdom Heroes** and **LashiraBloom** update. Rendering stays
per-app; rules/numbers/skill-defs/effects live in the package.

---

## 1. The 3 skills (redefined, shared)

| Slot | Name | Type | Targets | MP (base) | Effect |
|---|---|---|---|---|---|
| 1 | **Magic Bolt** | `magic` | ONE monster (faced, else nearest in arena) | **1** | bolt fx on the target |
| 2 | **Magic Storm** | `magic_aoe` | ALL monsters in the arena | **5** | storm fx on each monster |
| 3 | **Mend** | `heal` | self (restore HP) | **3** | heal sparkle on the caster |

- MP is the farm's **stamina** (already chosen); in Kingdom it's the **mana** pool.
  Same numbers, same bar — one rule.
- Basic attack (tap / attack-circle) stays melee = 34 and costs no MP.

## 2. Level scaling (shared formula — "adjust the number depends on the level")

`L` = hero level. **MP cost is fixed; power grows with level.** All pure
functions in `packages/combat/skills.js` so both games compute identically.

```
boltDamage(L)   = 40 + 12*(L-1)      // single target
stormDamage(L)  = 24 +  8*(L-1)      // per monster (AoE, so lower each)
mendHeal(L)     = 30 + 10*(L-1)      // capped at maxHp
killReward(L)   = 2 + floor(L/2)     // Diamonds per kill
```

| Level | Bolt | Storm/ea | Mend | 💎/kill |
|---|---|---|---|---|
| 1 | 40 | 24 | 30 | 2 |
| 3 | 64 | 40 | 50 | 3 |
| 5 | 88 | 56 | 70 | 4 |
| 10 | 148 | 96 | 120 | 7 |

Monsters stay at 100 HP for now, so skills feel stronger as you level (Bolt goes
from a 3-hit to a 1-hit kill by ~L6). Numbers are easy to tune in one file.

## 3. Skill effects (port Kingdom's real spell animations)

Kingdom already has a full effect system; the farm can already fetch the same
sheets (`data.effects()` / `effectSheetUrl()` exist in the farm today).

**Plan:** move Kingdom's `spawnEffect` + `drawEffect` into
`packages/combat/effects.js` as canvas-agnostic helpers, so both games play the
**same spell animation** for a given skill:

- `loadEffects()` → the effect catalog (both apps already reach Kingdom `/data`).
- `spawnEffect(fxList, effectsAll, id, at)` → queues an animated effect at a
  position (`at` = a monster, the player, or a fixed tile).
- `drawEffect(ctx, f, now, project)` → draws the current animation frame.

Each skill carries an `fx` id (Kingdom effect id). Cast → spawn its fx:
- **Bolt** → fx on the single target.
- **Storm** → fx on every monster hit (a burst per monster).
- **Mend** → fx on the caster (green/holy sparkle).

Exact fx ids get picked from Kingdom's effect library (the SkillBrowser lists
them). Placeholder ids: Bolt `22`, Storm `131`, Mend a heal-type effect.

## 4. Skill resolution (shared, extends `resolve.js`)

- `resolveSkillSingle(monsters, originTile, facingDelta, dmg)` — faced tile first,
  else nearest live monster in range.
- `resolveSkillAoe(monsters, dmg)` — every live monster.
- `applyHeal(combat, amount)` — `hp = min(maxHp, hp + amount)`.

**Sync (farm):** unchanged referee model. Host applies authoritative damage;
a non-host casting Storm sends one `mob-hit` intent per monster; Bolt sends one.
Mend is local (only touches your own HP). Kills still pay the killer via
`mob-dead`.

## 5. Every kill → Diamonds (both games)

- Shared `killReward(L)` (table above).
- **Farm:** already credits Diamonds on kill — switch it to `killReward(level)`
  and always fire (open economy).
- **Kingdom:** also grant `killReward(L)` Diamonds **in addition to** its arena
  XP. (Open decision — see bottom. Persisting Diamonds to the ArgantaLab account
  is a small server-write follow-up; today the farm's Diamonds are device-local.)

## 6. The reward pill (replace the "ugly black inline pills")

Today rewards use the same flat dark pill as error/hint toasts
(`background: rgba(15,17,32,.92)` — one line, black, no icon). We split them:

- **Hints/errors** keep the plain slim pill (fine as-is).
- **REWARDS get a real card** — a shared `<RewardToast>` (Kingdom-canonical, both
  apps import it, matching the shared-cluster decision):
  - a large reward **icon in a colored disc** (💎 gold, 🥛/🌽 green produce, ⚔ kill),
  - the **amount** big + bold with a `+`,
  - a one-word **label** under it,
  - **frosted-glass** card, superellipse corners, soft **colored glow** matched to
    the reward type, drop shadow,
  - **spring pop-in, then float up + fade** (~1.6s),
  - stacks top-center; newest on top.

Mockup rendered in chat alongside this concept.

---

## Open decisions (adjust freely)

1. **Kingdom kill reward:** grant Diamonds too (shared rule), or keep Kingdom on
   XP only and apply the Diamond rule to the farm only? (Recommended: both grant
   Diamonds via `killReward`; Kingdom keeps XP as well.)
2. **Mend MP cost:** proposed 3. Ok, or cheaper/pricier?
3. **Scale melee with level too?** Proposed: leave melee flat at 34 (skills are
   the level-reward). Could add `meleeDamage(L)=30+4*(L-1)` if you want.
