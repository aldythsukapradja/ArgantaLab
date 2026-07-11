---
type: journey-phase
phase: P6
dates: 2026-07-05 → 2026-07-08
commits: 100+
status: frozen
tags: [arganta, journey, P6]
---

# P6 · LashiraBloom

> [!abstract] The heaviest active build — a Stardew-style farm grown into a tiered-combat RPG on the Kingdom spine, off a currency it renamed twice in two days
> Four days, 100+ commits: [[LashiraBloom]] went from "you farm as your real Kingdom Hero" to a live farm loop + real-time crops + living animals + a shared `@arganta/combat` engine (skills, gear, loot, boss, XP to 99, VFX broadcast) on a 60×48 castle-center map with an 82-asset art library. The convergence bet — reuse Kingdom's canvas-2D compositor rather than a fresh engine — held. The scar is the money: the economy was specced as **open Diamonds**, respecced as **Gold**, and shipped as **Bloom** 🌸, all inside ~24h.

## Shipped
*(from [[00-MASTER-KB#9 · Build Timeline — 22 days|§9]])*

- **Farm loop 1–8** — open economy → real-time (minutes-capped) crops → living animals with care/pens → Kin loadout (farm as your real Hero) → **Bloom** currency. Cloud save via `farm-save.js` + `migration_lashira_farm_cloud.sql`.
- **Combat 1–16** — the shared `@arganta/combat` package: skill formulas (`boltDamage`/`stormDamage`/`mendHeal`/`killReward`), `effects.js` (`spawnEffect`/`drawEffect`), `RewardToast`, monster scaling, VFX broadcast, XP to 99.
- **One-hotspot-spine map** — `HOTSPOTS[]` + `hotspotAt()` + `openHotspot` router + one reusable modal; mining/forestry/shops all land as additive rows (`mechanics-plan`).
- **60×48 castle-center map** — woodland monsters + Tiger boss, rebuilt around a castle center (`map-and-asset-manifest`).
- **82-asset art library** — overnight PixelLab run, 82 originals, core set wired + build-verified (`generation-progress`).
- **Cosmetic Forge** — shop / buy / equip / enhance + cosmetics, stats shipped **display-only** (`CHARACTER-FORGE-SHOP-CONCEPT`).
- **Kingdom engine, copied** — `src/engine/{compositor,data,palettes}.js` copied wholesale from `apps/kingdom` (`apps/lashira/web/README`).

## Tried & abandoned / superseded

> [!warning] P6's signature dead-end is currency thrash — a name that shipped, then two that didn't
> The economy was relitigated three times. `LASHIRABLOOM-GAMEPLAY-CONCEPT` (Jul 7) locked a single **open Diamonds** economy ("balance only goes up"). `LASHIRABLOOM-FARMVILLE-CONCEPT` (Jul 8) resolved the kid/adult tension by inventing **Gold**. **Bloom** replaced Gold the same day (§13, 2026-07-08). `map-and-asset-manifest` even self-supersedes its own Gold→Bloom mid-file.

| Locked / proposed | Fate | Replaced by |
|---|---|---|
| **Open Diamonds economy** — one currency, balance only up (`LASHIRABLOOM-GAMEPLAY-CONCEPT`) | superseded — a testing crutch | **Bloom** (via Gold, days later) |
| **Gold** as the kid-earnable play currency (`LASHIRABLOOM-FARMVILLE-CONCEPT`) | superseded **same day** — lived < 24h | **Bloom** 🌸 |
| **3-axis RuneScape/RO progression** — Axis B Activity Skills · per-path skill trees · prestige/hiscores/cards (`LASHIRABLOOM-PROGRESSION-DESIGN`) | scope-reduced — only the dressing-room slice built | **live-equip gear buy/wear/enhance** (Character Page spills into [[P7-polish\|P7]]) |
| **Dead-end materials** — ore/gem/fish with no sink · 100-HP mobs vs 600+ dmg (`economy-combat-remap`) | diagnosed & partly closed | **each gathered material → a gear input**; smelt/cook/socket sinks still unbuilt |
| **Gear stats → real combat math** (`CHARACTER-FORGE-SHOP-CONCEPT`) | deliberately deferred | **display-only**, gated until a balance review of shared `gear.js` |

> [!note] The bug that named the lesson
> `LASHIRABLOOM-PROGRESSION-DESIGN` documents its own mistake: *"Wear restarts the game"* — `window.location.reload()` was the lazy equip path. The real fix (swap `g.resources` via the already-standalone `loadPlayerResources`, no reload) shipped. Cheap path first, correct path when it bit.

## Decisions made here
*(from [[00-MASTER-KB#13 · Decision Log|§13]])*

| Date | Decision | Rationale | Holds? |
|---|---|---|---|
| **2026-07-07** | **`@arganta/combat` canonical; Kingdom consumes it** | single source — edit once, both games update | ✅ |
| **2026-07-08** | **Gold → Bloom** 🌸 | brand coherence | ✅ |

> [!success] The bet that shipped near-verbatim
> `COMBAT-SKILLS-CONCEPT` was marked "no build yet" — then landed in `packages/combat` almost line-for-line: the skill formulas, shared effect helpers, and `RewardToast` all became the live engine for **both** Kingdom and LashiraBloom. "Single source of truth = `packages/combat`, edit once both update" is the compounding instinct that made this phase's platform work pay. (Fossil: `killReward` still comments *"Diamonds per kill"* — a pre-Bloom relic.)

## What it taught

> [!tip] Copy-now-extract-later is a debt you always sign and never pay
> The Kingdom avatar engine (`compositor`/`data`/`palettes`) was copied *wholesale* into Lashira with an *"Extract to a shared package later"* TODO — never done. That single convenience is the exact 3×-duplication instinct behind [[00-MASTER-KB#11 · Debt Register|D2/D3]]. Note the split verdict: the code that was made *shared* (`@arganta/combat`) compounds; the code that was *copied* becomes debt. Same day, same repo, opposite outcomes. → [[reuse-the-spine-dont-rebuild|copy now extract later is debt]] · [[reuse-the-spine-dont-rebuild|single source of truth]]

- **Lock late — a currency renamed twice in a day is a design decided in code, not doc.** Diamonds-open → Gold → Bloom, three "final" answers in ~24h. Naming and economy are the parts most tempting to freeze early and most likely to move once the game is playable. Ship the mechanic; let the noun settle last. → [[declare-when-you-supersede|lock late]]
- **Turn the map into a table of interactions, not a pile of handlers.** `mechanics-plan`'s one registry (`HOTSPOTS[]`) + one router (`openHotspot`) + one reusable modal is why mining, forestry, and shops were all *additive rows* instead of bespoke code. The structural instinct — data + a dispatcher — is the same one that made combat a registry-and-sim. → [[reuse-the-spine-dont-rebuild|one registry one router]]
- **A no-rewrite spine bet can generalize further than the plan.** `buildplan`'s "farm → full RPG, don't re-architect identity or economy" held: the farm loop generalized into combat/PvP/realms without touching the Hero source or the wallet. Reusing the single-character source (farm-as-your-real-Hero) is the same single-source pattern that made the combat package compound. → [[reuse-the-spine-dont-rebuild|reuse over rebuild]]
- **Close the loop or the content is inert.** `economy-combat-remap` caught the honest flaw — gathered materials with no sink, trivial mobs against 600+ damage — and fixed it by making every material a gear input. A gather system with no downstream consumer is a chore, not a loop. → [[build-both-sides-of-the-wire|close the loop]]
- **Headless renders validate logic, not scale.** `farm-flow-redesign` ships phases "code-review-sound but not e2e-verified" because the headless preview throttles `requestAnimationFrame`, so `g.cam` never populates. The recurring caveat across this whole build (and P5's orb): for visual/real-time work, offscreen proves the code runs — only a screen proves it *looks right*. → **headless preview lies for visual work**
- **Harness before humans.** `LASHIRABLOOM-SYNC-ART-HANDOFF` (Fable) carries the hardest-won process rules of the cluster: two harnesses must pass before asking the user; *never join the live family circle as a test player* (a rogue agent login caused real presence chaos); test the **production build**, not `vite dev` (HMR/StrictMode double-mount faked bugs); one change per phase, revert a phase, never patch a patch — all born from a 2-hour regression spiral. → [[write-the-audit-first|harness before humans]]
- **PixelLab is strong on tiles, weakest on animate characters.** `generation-progress`: 82 originals shipped, but animals landed as **static sprites** with animation deliberately deferred — the multi-frame character/animal case is where the AI art pipeline stalls. → **ai art strong on tiles weak on motion**

> [!failure] What all of it polishes
> Every system above compounds — and serves a game with **0 external players** ([[00-MASTER-KB#11 · Debt Register|D1]]). The retention layer (daily quests + streak) that would give a stranger a reason to return is still ⚠️ partial. "Dad built it" is not a wedge.

## Links

- Neighbors · [[P5-hq-command]] → **P6** → [[P7-polish]]
- Master · [[00-MASTER-KB#9 · Build Timeline — 22 days|§9 timeline]] · [[00-MASTER-KB#13 · Decision Log|§13 decisions]] (combat canonical · Gold→Bloom) · [[00-MASTER-KB#11 · Debt Register|§11 debt]] (D1, D2, D3)
- Product built here · [[LashiraBloom]] (farm loop · combat · economy · Forge · castle map) · [[Kingdom]] (engine source) · `@arganta/combat` (shared spine)
- Shipped near-verbatim · `COMBAT-SKILLS-CONCEPT` · `mechanics-plan` · `forest-mine-mapping` · `apps/lashira/web/README`
- Partial / superseded · `LASHIRABLOOM-GAMEPLAY-CONCEPT` (open Diamonds) · `LASHIRABLOOM-FARMVILLE-CONCEPT` (Gold, < 24h) · `LASHIRABLOOM-PROGRESSION-DESIGN` (Axis B unbuilt) · `economy-combat-remap` (sinks unbuilt) · `buildplan` · `map-and-asset-manifest`
- Process record · `LASHIRABLOOM-SYNC-ART-HANDOFF` (Fable's test-harness war-story rules)
- Attribution · `packages/combat/src/icons/CREDITS.md` · `apps/lashira/web/public/farm-art/produce/CREDITS.md`
