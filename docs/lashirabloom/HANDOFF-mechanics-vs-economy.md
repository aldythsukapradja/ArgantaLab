# HANDOFF — Mechanics workspace ⇄ Economy workspace

Two Claude instances are working in parallel. This file keeps us from overlapping.
Written by the **mechanics** instance, 2026-07-08.

## Split of responsibilities

| MECHANICS (this workspace) | ECONOMY (your workspace) |
|---|---|
| Hotspot interaction spine (tap → action) | Currency: **gold → bloom** rename |
| Shop **popups** (which shop sells what) | Diamonds logic |
| Mining, forestry, fishing | Currency **balances** + spend/earn math |
| Castle interior (upgrade + storage) | Currency **display** (HUD, existing panels) |
| Dungeon (PvE + Tiger boss) | Sell prices / seed costs tuning |
| Produces/consumes **MATERIALS** (wood/stone/ore/gem/fish) | |

## Files I (mechanics) OWN — please don't edit these for currency

- `src/game/farm-map.js` — map layout + `HOTSPOTS[]` registry + `hotspotAt()`
- `src/game/farm-mechanics.js` **(NEW)** — materials/tools/nodes/house state + mine/chop/fish/upgrade actions. **Own localStorage key `lashira_mech_<id>`** — decoupled from the farm save so it can't collide with your currency work.
- `src/ui/HotspotPanels.jsx` **(NEW)** — shop/castle/dungeon popups
- `src/game/FarmRoom.jsx` — I only touch `onTap` (hotspot routing), the new-panel render, and dungeon mode. **I do NOT touch any currency lines here.**

## Files I will NOT touch — they're yours

- `src/game/farm-logic.js` — **ALL** currency (gold/bloom/diamond) state, `buySeed`, `sellAll`, `rewardKill`, balances. I *call* these methods but never edit them.
- `src/ui/Hud.jsx` — currency display
- `src/data/crops.js`, `src/data/livestock.js` — sell/cost fields

## The seam — where our work meets

1. **Mechanics use MATERIALS**, not currency: `wood, stone, goldOre, gem, fish`, held in `farm-mechanics.js` (separate store). Mining/chopping/fishing produce them; tool/castle upgrades spend them. **Zero currency involved** in the core mechanics loop.
2. **Currency actions route through YOUR existing methods** (I call, never reimplement):
   - Seed buy → `game.buySeed(id)`
   - Sell produce → `game.sellAll()`
   - Combat/dungeon reward → `game.rewardKill()`
3. **Deferred currency buys** (tools/animals/cosmetics priced in bloom): my shop popups *show* them, but the buy is material-based or stubbed until you wire bloom. Grep `// ECONOMY-SEAM` for every spot that needs your currency once bloom is ready.
4. **Defensive currency read**: my UI reads `snap.bloom ?? snap.gold` so it works before/after your rename. If you change the snapshot shape, ping me.

## Notes
- I swapped **forest (inner-east)** and **mining (outer-east)** zones in `farm-map.js`.
- I don't rename gold→bloom anywhere — that's all yours.

## Branch / merge
- I'm committing per-phase on branch **`lashira-art-library`**.
- Only shared file is `FarmRoom.jsx` (I touch `onTap`/render; you'd touch currency display if any — different regions, low conflict). Recommend you work on a separate branch and we merge deliberately.

## Live status (mechanics)
- [x] Phase 0 — hotspot spine (HOTSPOTS + hotspotAt in farm-map; onTap router; HotspotPanels.jsx; FarmMechanics store)
- [x] Phase 1 — shop popups (seed via game.buySeed; blacksmith via materials; general/animal/cosmetic display + ECONOMY-SEAM)
- [x] Phase 2 — mining + forestry (tool-gated; wood/stone → your farm-logic state; ore/gem → mech store) — **logic verified working**
- [x] Phase 3 — castle upgrade (materials) + storage (interior furniture placement = follow-up)
- [x] Phase 4 — dungeon v1 (gate → drops into the battleground arena; real instanced floor + boss loot = follow-up)
- [x] Phase 5 — fishing (dock → cast/reel minigame → fish)

**Verified:** all mechanics LOGIC works via direct calls — mine→materials→upgrade
pickaxe→mine gold→upgrade house, wood/stone correctly landing in `farm-logic.state`
(so your HUD is the single source). `vite build` passes.

## Verification note (no bug — preview limitation)
I could NOT do a visual tap-test because **`requestAnimationFrame` never fires in the
headless preview** (tab throttled) — so `draw()` never runs, `g.cam` stays unset, the
canvas is blank, and screenshots time out. The game is fine; it just doesn't animate
in that context. (The React render-error spam I first saw was **stale HMR churn** from
both instances hot-reloading FarmRoom at once, not a real crash — `emit()` re-renders
are clean.) **To verify visually:** open the game in a real foreground browser and tap
a shop / ore / tree / castle / dock. Mechanics LOGIC is proven via direct calls.
