# Battle command center — full audit (is this "all you need"?)

Dated 2026-07-08. Audits the tuning pipeline (`@arganta/combat` tuning.js + tuningRepo.js
+ HQ Battle Builder) against the goal: **one command center to control, manage, and balance
battle / PvP / PvE / boss / exp / loot dynamically, scalable to add more content.**

Run it yourself: `node packages/combat/tests/coverage-audit.mjs` (matrix) +
`node packages/combat/tests/pipeline-harness.mjs` (35/35 round-trip tests).

## Verdict (short)

**Not yet the *whole* command center, but now controlling ~⅖ of the surface live** — up from
⅓ after roadmap steps 1–3 landed (2026-07-08). The **enemy / spawn / exp / loot / player-path
axis is genuinely controllable today** (change it in HQ → it applies in the game). Still open:
**gear / skill-loadout / boss-mechanic / content-authoring**. And critically: **you can *tune*
existing monsters but not yet *add* one from HQ** — the roster is code, not data.

Coverage from the automated audit: **19 / 31 levers controllable live now (61%)** — was 10/31,
after roadmap steps 1–6 (loot drops · enemy speed · player-path damage · gear · base damage
curves · HP/MP pools · XP ladder · skill MP costs).

## What works TODAY (● = tune in HQ → live in game)

| Axis | Levers |
|---|---|
| **Player** | Path magic × / physical × (now read by the farm's melee + skills) ✅ *new* |
| **PvE enemies** | Enemy HP · Enemy ATK · Enemy speed ✅ *new* |
| **Spawn** | Max concurrent · Respawn interval · Roster |
| **Boss** | Boss stats (Tiger hp/atk/xp/bloom) |
| **Exp** | Kill XP per enemy · Global XP × |
| **Loot** | Kill Bloom · Global Bloom × · **Drop tables (material · count · rate)** ✅ *new* |
| **Gear** | Weapon ATK tiers · Armor DEF / HP tiers ✅ *new* |
| **Player (curves)** | Melee + skill base damage curves · HP/MP pools per path · XP ladder ✅ *new* |
| **Skills** | Per-slot MP cost (targeting/loadout still fixed → partial) ✅ *new* |

Backed by the round-trip pipeline (publish → `combat_tuning` → `bootCombatTuning` → live
`BESTIARY` / `SPAWN_TUNING` / `REWARD_TUNING` / `PATH_POWER` / `ZONE_MOBS`), operator-gated,
safe fallback. **Balance note:** wiring path multipliers into live PvE shifts current damage
— a warrior-path player now melees ×1.55 (harder) and casts ×0.55 (softer); mage the reverse.
Intended path identity, bounded, and now operator-tunable.

## The gaps (21 / 31), in three kinds

**A. Carried + applied, but the game doesn't read it (inert).** Fix = wire the game read.
- **Path magic/physical ×** and **PvP profile** — the farm computes player damage as
  `outgoingDamage(MELEE_DAMAGE / skillPower, weaponTier)`; it never reads `PATH_POWER`.
  So today those knobs only drive the fairness sim + *future* PvP. **Biggest surprise.**
- **PvP damage/HP/reach** — PvP combat isn't wired at all (pvp-concept §7).

**B. The game reads it, but the pipeline can't touch it (not tunable).** Fix = carry+apply.
- **Loot DROP TABLES** (material · rate) — `BESTIARY.drops` is live via `rollDrops`, but the
  config only carries hp/atk/xp/bloom. *You asked for loot — this is the missing half.*
- **Gear** — weapon ATK, armor DEF/HP, upgrade costs (`gear.js`). This is the real *player
  power axis* and it's fully outside the pipeline.
- **HP/MP pools** + **XP ladder** (`progression.js`) — not tunable.
- **Melee base damage**, **skills** (3-slot loadout, MP cost, targeting) — not tunable.
- **Enemy speed**, **zone gating** (`speedMs`, `ZONE_MOBS`) — not tunable.

**C. Not built at all.** Fix = build the system, then expose it.
- **Boss mechanics** — phases / telegraph / enrage / spawn-gate. Today the boss is just a
  big monster with tunable stats; no phase system.
- **Enemy behavior / AI** — wander/charge/aggro are hardcoded in FarmRoom.
- **Add attack types / subclasses** — concept only (attack taxonomy, subclass tree).
- **Add a new MONSTER from HQ** — see scalability below.

## Scalability verdict (the "add more monsters" question)

Two very different things:
- **Tuning existing content scales automatically.** `COMBAT_DEFAULTS.enemies` is derived from
  `Object.keys(BESTIARY)`, so the day someone adds a `BESTIARY` row *in code*, it's
  auto-tunable from HQ with zero pipeline changes. Same for spawn roster. ✅
- **Authoring NEW content from HQ does NOT scale yet.** `BESTIARY`, `SKILL_SLOTS`, paths, and
  gear are **code constants**; the pipeline ships *override deltas keyed to existing ids* — it
  can change a monster, never create one. To "add more monsters/attacks/subclasses from the
  command center without a deploy," the **registry itself must move to the database** (create
  rows, not just override rows). That is the combat-as-registry architecture in
  `battle-builder-plan.md §2` — the load-bearing next step, and the single biggest gap between
  "a tuning console" and "a content command center." ⚠️

Also flagged: **no per-game scope** — one config would apply to Kingdom too if Kingdom ever
called `bootCombatTuning` (safe now: separate bundle, and it doesn't). Add a `game` key before
Kingdom consumes it.

## Roadmap to a true command center (prioritized)

1. ✅ **DONE — Loot drop tables → config** (`enemies[id].drops`, sanitized; `rollDrops` reads `BESTIARY.drops`).
2. ✅ **DONE — Enemy speed + zone rosters → config** (`speedMs`, `ZONE_MOBS`). (Zones are tunable; the single arena still spawns from `SPAWN_TUNING.roster`, so zone gating is "partial" until multi-zone spawning lands.)
3. ✅ **DONE — Player damage reads the tuning** — farm melee = `MELEE_DAMAGE × path.phy` + weapon; skills/heal = `pathSkillPower` (× `path.mag`) + weapon. `PATH_POWER` is now live in PvE, not just the sim. (Base curves still hardcoded — `DAMAGE_TUNING` not yet read.)
4. ✅ **DONE — Gear → config** (`gear.weapons.t*`/`gear.armor.t*`, keyed by tier so partial edits merge; `applyTuning` writes `WEAPON_TIERS`/`ARMOR_TIERS`; game already reads `weaponOf`/`armorOf`). Upgrade *costs* still hardcoded — a cheap follow-up.
5. ✅ **DONE — Progression → config.** `damage.{phys,bolt,storm,mend}` base curves (skills.js `DAMAGE_BASE`, read by `boltDamage`/`physBase`), `pools.<path>` HP/MP (progression `PATHS`, read by `pathMaxHp`), `xp.{base,growth}` ladder (`XP_LADDER`, read by `xpForLevel`, growth clamped > 1). ⚠ XP-ladder + pool edits recompute levels/HP for everyone — powerful, use carefully.
6. ✅ **DONE (partial) — Skills → config.** Per-slot `skills.<id>.manaCost` is live; targeting/type/loadout still fixed. **← next: step 7 registry-as-DB (add monsters from HQ)**
5. **Progression → config** (per-path HP/MP pools + XP-ladder params) — medium.
6. **Skills → config** (MP cost / damage / targeting per slot) — medium.
7. **Registry-as-DATA** — move BESTIARY/skills/subclasses to DB rows so HQ can *add* content
   (the scalability unlock). Larger; do after 1–6 prove the schema.
8. **Boss mechanics** (phases/enrage/gate) + **enemy AI** — build the systems, then expose.
9. **Per-game scope key**, then **wire PvP combat** (separate track).

Steps 1–3 roughly **double** live coverage (to ~⅔) for little work; step 7 is what makes
"add more monsters from HQ" real.

## Test status
- `pipeline-harness.mjs` — **35/35 pass** (round-trip, apply-to-live, fallbacks, operator
  gate, version guard, spawn/rewards/xp/bloom).
- `coverage-audit.mjs` — **10/31 live (32%)**, matrix above.
- LashiraBloom `npm run build` — clean (141 modules).

*The pipeline is solid and safe for what it covers; it is not yet the whole command center.
The roadmap above is the honest path to that.*
