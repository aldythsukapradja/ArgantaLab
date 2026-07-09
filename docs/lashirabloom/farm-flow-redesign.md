# LashiraBloom — Farm Flow + Combat + Audio Redesign

Concept locked 2026-07-09. Build reference for the 9-phase pass that fixes the
farm loop's dead ends, makes combat two-sided, and adds audio + ambience.

## Why (root causes found in code)
- **The Bag is dead.** `_harvest()` credits 🌸 Bloom directly and never fills
  `produce`; the Bag panel + `sellAll()` read `produce`, so the bag is always
  empty and "Sell all" is always disabled. No gather→carry→sell loop exists.
- **Crops are single-use** — harvest wipes the plot; no regrow, no removal tool.
- **The controller isn't one system** — the battle cluster is the skinnable
  shared `ActionCluster`; the farm cluster is a separate hand-rolled emoji row
  that ignores the skin. So the Action Skin picker only repaints battle buttons.
- **Spawn is wrong** — player starts at tile `[12,12]`, dead center of the field.
- **Monster overlap** — the player move gate checks only `blockedAt` (map
  collision), not monster tiles; monsters avoid the player's tile but the player
  walks through them (one-sided collision).
- **Monsters never attack** — `m.atk` is set on spawn but read nowhere; the
  shared monster state machine has only `stand/hit/die`. `g.combat.hp`/`deadUntil`
  exist but nothing damages or faints the player. Combat is one-way.
- **No audio anywhere** — SFX + ambience is from scratch; the embed CSP blocks
  external hosts, so all sound must be bundled or synthesized in-browser.

## Locked decisions
| Area | Decision |
|---|---|
| Tap model | Hybrid — ripe = instant harvest; empty/growing = fan-out; long-press = full fan-out; Plant-All/Harvest-All stay |
| Harvest → currency | Bag → sell later: harvest drops an item in 🎒 Bag; sell for Gold at Shop / Sell-all |
| Re-harvest | All crops regrow until sickled |
| Skin icons | One farm glyph set, repainted by the active skin's material (`vars`) |
| SFX | Synthesized in-browser WebAudio (zero assets, CSP-safe) |
| Ambient audio | On, low volume, toggleable (Settings slider) |
| Faint stakes | No loss — knockback + full heal + brief timeout (kid-safe) |
| Combat depth | Telegraphed windup (dodgeable) + armor DEF mitigates |

## Build phases (each independently shippable)
1. **Spawn** — start at castle courtyard `~[30,27]`, not mid-field.
2. **Bag loop** — `_harvest` → `produce` (item) instead of instant Bloom; wire
   `sellAll` + Bag panel (revives the dead bag).
3. **Regrow + sickle** — `regrow:<ms>` on every crop; harvest keeps the plant +
   resets the ripen timer; new `sickle` tool + `removeCrop()` frees the tile.
4. **Tap fan-out** — radial menu + hybrid routing in the pointer handler
   (Plant▸picker / Harvest·"Open" / Sickle per tile state).
5. **Monster collision** — `monsterAt()` (tile + mid-step `from`) OR'd into the
   player move gate → mutual body-blocking.
6. **Monsters attack back** — shared state machine gains `chase →
   attack(windup→strike→recover)`; aggro radius; armor DEF mitigates; faint →
   `deadUntil` timeout + heal + knockback; `aggroRange`/`atkCooldownMs` added to
   the HQ tuning pipeline.
7. **Controller re-skin** — farm cluster consumes `skinOf(skinId).vars` + one
   farm glyph set (seed·harvest·sickle·sleep·mount); ~5 new SVGs.
8. **SFX** — dependency-free `sfx.js`, mute+volume in Settings, silenced when tab
   hidden; action→cue map (farm/movement/UI/combat).
9. **Ambient** — low-volume looping farm audio bed (zone-aware later) +
   deterministic particle layer (cherry petals + light motes), under the
   mute/reduce-motion gate.

## Phases 10–12 — Bag / Home / Shop UI redesign (locked 2026-07-09)
10. **RPG grid Bag** — slotted grid (icon + ×count badge, type-tinted border);
    category tabs All/Seeds/Produce/Materials/Gear; **soft capacity** = used /
    castle-storage slots (upgrading the castle grows the bag); tap-cell detail
    footer with a type-adaptive action. Threads the `mech` snapshot in.
11. **Home hub** — quicknav shrinks to Home · Shop · Bag · Quests; Home gains
    sub-tabs **🏡 House · 🐄 Animals · 🍃 Kin** (Barn + Kin moved in verbatim).
12. **Unified gallery Shop** — one Shop, sub-tabs 🌱 Seeds · 🐮 Animals · ⚒ Forge
    · 🏪 General · 💎 Cosmetics · 🧺 Sell. Gallery body = big featured ware (◀ ▶)
    + thumbnail strip; action adapts Buy/Craft/Upgrade/Sell. **Tapping a map shop
    opens this Shop at that merchant's sub-tab** — merges the two shop systems
    (Panels.Shop + HotspotPanels shops). Castle/dungeon/fishing hotspots unchanged.

## Cross-cutting
- Sync stays intact — bag/regrow/remove ride existing `plot`+`stock` intents;
  monster `state` rides the host heartbeat; player HP & all audio are
  local/victim-authoritative.
- Shop/Bag redesign is presentation only — all buys/sells keep routing through
  the existing `game.*` / `mechGame.*` methods.
- Currency field is still `bloom` (🌸) though the v3.5 manifest calls it Gold —
  optional rename during the bag rewrite.
- New combat knobs (`aggroRange`, `atkCooldownMs`) join the `speedMs`/`drops`
  already in the tuning pipeline so HQ can balance two-sided combat live.
