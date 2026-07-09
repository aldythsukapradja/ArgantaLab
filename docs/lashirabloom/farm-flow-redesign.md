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

## Phase 13 — Multi-Farm: My Farm / Circle Farm / Visit (built 2026-07-09)
Personal farm (`lashira_farm_saves`, already keyed only by `user_id` — circle-
independent) becomes reachable + swappable alongside the existing shared circle
farm (`circle_game_saves`, unchanged). Visiting a circle-mate's personal farm is
**not a new storage scope** — read-only load of their existing save, gated by a
new server RPC; writes are already structurally owner-only (the save RPC can
only ever write `auth.uid()`'s own row).
- **New SQL** (`supabase/migration_lashira_multi_farm.sql`, NOT yet run):
  `shares_circle_with(p_other)`, `list_circle_members(p_circle)` (roster —
  `circle_members` RLS only lets a plain member read their OWN row, so the
  Travel picker needs a definer RPC), `load_member_farm_state(p_owner)`
  (read-only, gated by shares_circle_with).
- **farm-save.js**: `loadMemberFarmState`, `listCircleMembers` client helpers.
- **FarmLogic** (`farm-logic.js`): `constructor(profile, circleId, {visitOwnerId,
  visitOwnerName})`. Visit mode → `viewerRole:'visitor'`, `_loadVisit()` (no
  local fallback, no reconcile-push-back, skips `profileProgress` so the
  OWNER's diamonds/xp/bloom display, not the viewer's), `frozen=true` (blocks
  save via the existing kicked-session mechanism), and every deliberate mutator
  (`tapAt`/`buySeed`/`sellAll`/`sleep`/etc. — `VISITOR_LOCKED_ACTIONS`) is
  shadowed on the instance with a flash-and-no-op. Background/system calls
  (`sweepStalePlots` — `VISITOR_LOCKED_SILENT`) no-op silently (no spurious
  toast on load). `setPath` deliberately left functional (viewer's own cosmetic
  HP/MP curve, touches no farm state). `snapshot()` exposes `viewerRole` +
  `visitOwnerName` for the UI.
- **App.jsx**: `farmScope` state generalizes the old single `circleId` —
  `{kind:'circle'}` (default, UNCHANGED landing) / `{kind:'personal'}` /
  `{kind:'visit', ownerId, ownerName}`. Reuses the existing `key={...}`
  remount-to-swap trick (extended with the scope). `homeCircleId` stays
  threaded separately from the active `circleId` so Travel can always list
  circle-mates regardless of which scope is currently active.
- **FarmRoom.jsx**: `visitOwnerId`/`visitOwnerName`/`homeCircleId`/`onTravel`
  props; `isVisitor` gates `new FarmLogic(...)`, skips `setExternalKins`
  (would've overlaid the VIEWER's own Kin roster onto the visited farm —
  leaving it unset makes `kinRoster()` fall back to the OWNER's saved
  `state.kins`), makes `onTapInteract`/`openFieldFan` no-op immediately after
  the cursor-tile highlight (look-only, including gathering nodes — deliberate:
  FarmMechanics is per-VIEWER not per-farm, so letting a visitor gather in
  someone else's space would be a confusing exception to "visit = don't
  touch"), and locks the Space/E/1/2/3 keyboard shortcuts (R/mount stays).
  Fetches the circle roster via `listCircleMembers(homeCircleId)`.
- **Home hub**: 4th sub-tab **🚪 Travel** — a farm-tile grid (🏡 My Farm always
  first, 🌾 Circle Farm if `homeCircleId`, then a 👁 tile per OTHER circle
  member) reusing the Bag-grid/Shop-gallery visual language; "Here now" badge
  on the active scope. Tapping a tile calls `onTravel(scope)` → App.jsx swaps.
- **Hud.jsx**: visit-mode replaces the whole farm action cluster with just the
  Mount button (harmless, viewer's own), shows a `.visit-banner` ("👁 Visiting
  X's Farm — look, but only they can work it").
- Verified: `npm run build` clean (150 modules); guest preview confirmed the
  Travel tab, tile states (My Farm "Here now" when no circle), and a clean
  scope-swap remount (no console errors). NOT e2e-tested with a real second
  circle member (needs live multi-account Supabase data this sandbox doesn't
  have) — the visit-mode banner/neutering/hidden-controller path is
  code-reviewed-sound but not yet clicked through live.
- **Known minor gap**: Active-Kin display in Settings during a visit derives
  "deployed" from the VIEWER's own `kinLoadout` (localStorage), not the OWNER's
  real loadout — cosmetic mismatch only, no mutation risk.
- **Migration NOT yet run** in Supabase — same convention as prior LashiraBloom
  migrations (flagged, not executed by the agent).

## Phase 14 — Attack + skill cooldowns (built 2026-07-09)
Bug: `doStrike()`/`doSkill()` had ZERO rate-limit — only an MP-cost check —
so mashing Space/1/2/3 landed damage/casts on every keypress. Fixed with the
same timestamp-gate pattern as the monster attack cooldown (Phase 6), plus a
radial "pie" cooldown-wipe on the action-cluster buttons so a blocked press has
a visible reason, not a silent no-op.
- `packages/combat/constants.js`: `MELEE_ATTACK_COOLDOWN_MS = 550`.
- `packages/combat/skills.js`: each `SKILL_SLOTS` entry gains `cdMs` (bolt 900,
  storm 2600, mend 1800 — roughly scaled to cost/power); passes through
  `battleSkillsFor` untouched (spread already carries unknown fields).
- `packages/combat/cluster.jsx`: `ActionCluster` gains OPTIONAL `cooldowns`
  (array parallel to skills, 0..1) + `attackCooldown` (0..1) props — fully
  additive/backward-compatible, Kingdom's TestRoom doesn't pass them so nothing
  changes there until it opts in. `.cooling` class + a `.cd-wipe` span
  (`conic-gradient` bound to `--cd`) render only when a fraction is > 0.
- `FarmRoom.jsx`: `g.combat.atkReadyAt` / `skillReadyAt[3]` (perf.now()
  timestamps) gate `doStrike()`/`doSkill(i)` at the top — a press inside the
  cooldown window just returns, no damage/cast/stamina-spend. New `cooldownUI`
  state polls at ~11fps (`setInterval`, only while `battle.on`) to feed the
  visual wipe smoothly without pushing the 60fps canvas loop through React.
- Verified (via `window.__G` + synthetic keydown dispatch — the doc'd headless-
  preview limitation still applies, `document.hidden` throttles rAF to ~0 so
  the arena-transition itself couldn't be driven live): a burst of 6 rapid
  Space presses advances `atkReadyAt` exactly ONCE, a press after the 550ms
  window correctly re-arms it; the same held for a skill slot with
  `combat.on` forced true. `npm run build` clean (150 modules); combat package
  tests 50/50. The `.cd-wipe` visual itself is code-reviewed (standard
  conic-gradient technique, mirrors `.skill-circle.active`'s existing
  conditional-class pattern) but not clicked-through live — needs a real
  browser tab in the arena, same as prior combat-visual work this session.

## Phase 15 — Tile popup, Shop quantities, Bag seed pouch (built 2026-07-09)
Four polish fixes, concept-approved then built (Sonnet assessed sufficient,
same class of UI/logic work as everything else this session).
- **Tile-fan positioning fixed** (`TileFan.jsx` + `FarmRoom.jsx`): the popup
  used to center on the raw tap PIXEL, covering the tile. Now anchored to the
  tile's own on-screen rect (new `tileRectOnScreen(g,tx,ty)` helper using the
  live camera, called at both `onTapInteract`'s field branch and
  `openFieldFan`) via a measure-then-place pass: renders once invisibly,
  measures its real size via a ref, places itself ABOVE the tile by default,
  auto-flips BELOW if there isn't room, clamps horizontally/vertically to stay
  on-screen. Position is computed once at open (not live-tracked if you walk
  away mid-decision) — a deliberate, documented simplification.
- **Always shows every crop** (`TileFan.jsx` empty-tile view): removed the
  owned-only filter. Owned crops still plant on tap; a crop with 0 stock shows
  dimmed + a 🛒 tag and tapping it closes the fan and opens the Shop on the
  Seeds tab directly (`onOpenShop` prop → FarmRoom's existing `setShopTab`/
  `setPanel` plumbing) — no more dead-end "no seeds" message.
- **Shop quantity buttons** (`QtyDialog.jsx`): `[1,5,10]+Max` → `[1,10,50,100]`,
  Max removed on purpose (no single-tap wallet-drain); stepper/input unchanged
  for anything in between.
- **Bag seed pouch** (`styles.css`): `.bagcell.seed` gets a CSS-drawn
  drawstring-pouch shape (`::before`/`::after`, tan-brown gradient + tie) with
  the crop emoji shrunk + z-index'd above it — reads as a seed packet, not a
  bare floating icon. Scoped to the Bag only (not the tile-fan's seed picker).
- Verified: `npm run build` clean (150 modules). DOM-checked live: the seed
  pouch (`::before` gradient + emoji at z-index 2, 19px) and the Shop's exact
  `[1,10,50,100]` buttons. **NOT** e2e-verified: TileFan positioning/all-crops/
  buy-shortcut — this preview sandbox's canvas reports a 0×0 viewport (same
  documented gotcha as all prior FarmRoom canvas work), so `g.cam` never
  populates and the tap→tile-fan flow can't be driven without a real browser.
  Code-reviewed sound; needs your eyes on an actual tap.

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
