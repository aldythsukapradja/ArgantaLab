# LashiraBloom — Mechanics plan (hotspots + systematic build)

Status: PLAN. Dated 2026-07-08. Goal: turn the static map into a playable world —
every landmark becomes an interactive **hotspot** routed through ONE system, not
per-building patches.

## 1. The architecture — one hotspot spine (not scattered handlers)

Today `FarmRoom.onTap` (FarmRoom.jsx ~line 1360) routes taps in a fixed ladder:
`combat strike → field farming (tapAt) → nearest animal (tapAnimal)`. Every building
and prop is a dead blocked sprite — there is **no routing for landmarks**. That's the
one gap to close, cleanly:

```
1. farm-map.js exports HOTSPOTS[]  — data derived from BUILDINGS + PLACEMENTS:
     { rect:{x0,y0,x1,y1}, kind, id }        kind ∈ shop|castle|dungeon|ore|tree|dock|bin
2. farm-map.js exports hotspotAt(tx,ty)      — returns the hotspot under/adjacent to a tile
3. FarmRoom.onTap gains ONE new branch (before field/animal):
     const hs = hotspotAt(tx,ty); if (hs) { openHotspot(hs); return; }
4. openHotspot(hs) dispatches by hs.kind → a handler (panel or action)
```

**Every mechanic below plugs into this one registry + router.** Adding a shop, an
ore node, the dungeon = one row in `HOTSPOTS` + one branch in `openHotspot`. That is
the systematic fix — the map becomes a *table of interactions*, not hardcoded checks.

Supporting pieces (built once, shared):
- **`<HotspotModal>`** — a reusable popup (title + rows + buttons + close), styled like
  `Panels.jsx`. Shops, castle, dungeon-preview all render into it.
- **State additions** in `farm-logic.js` `_default()`/`serialize()`:
  `materials:{wood,stone,gold_ore,gem}`, `nodes:{}` (per-node cooldowns), `tools:{pickaxe,axe,rod}` tiers, `house:{tier,storage}`, `furniture:[]`.

## 2. Hotspot detection — every interactive point on the map

Derived from `BUILDINGS` + `PLACEMENTS` (post forest/mining swap). ✅ = already works.

| Hotspot | Tiles (x,y) | Kind | Mechanic | Status |
|---|---|---|---|---|
| **Castle** | 27–32, 21–26 | castle | Enter interior → decorate + storage + home upgrade | ❌ new |
| Barn | 35–37, 2–3 | animals | Barn panel (feed/collect) | ✅ button |
| Coop | 50–51, 2–3 | animals | Coop panel | ✅ button |
| Market stall | 30–31, 16–17 | sell | Sell produce → gold | ✅ (Shop) |
| Shipping bin | 22, 3 | bin | Drop → auto-sell | ◑ partial |
| **Seed shop** | 23–24, 19–20 | shop:seed | Popup: buy seeds (gold) | ❌ new |
| **General store** | 34–35, 19–20 | shop:general | Popup: buy tools/consumables | ❌ new |
| **Blacksmith** | 23–24, 28–29 | shop:smith | Popup: upgrade pickaxe/axe/rod (materials+gold) | ❌ new |
| **Animal shop** | 34–35, 28–29 | shop:animal | Popup: buy livestock + feed | ❌ new |
| **Cosmetics/Bank** | 28–29, 28–29 | shop:cosmetic | Popup: cosmetics (💎) + storage | ❌ new |
| **Dungeon gate** | 48–49, 18–19 | dungeon | Enter 1-floor dungeon → PvE + Tiger boss → loot | ❌ new |
| **Ore: gold** | 51, 21 | ore:gold | Mine → gold ore (needs Tier-2 pickaxe) | ❌ new |
| **Ore: copper** | 54, 19 | ore:copper | Mine → stone/copper | ❌ new |
| **Ore: iron** | 50, 26 | ore:iron | Mine → stone/iron | ❌ new |
| **Ore: gem** | 55, 27 | ore:gem | Mine → gem (Tier-2 pickaxe) | ❌ new |
| **Boulder** | 53, 24 | ore:stone | Mine → stone | ❌ new |
| **Forest trees** | 39–46 zone | tree | Chop → wood (hardwood needs Tier-2 axe) | ❌ new |
| **Fishing dock** | 6–8, 33–34 | dock | Cast → catch fish → sell | ❌ new |
| Battleground | 17–39, 33–45 | arena | PvE combat (walk in) | ✅ inArena |
| **PvP arena** | 40–57, 33–45 | pvp | Duels + ranked ladder | ❌ later |
| Field soil | 3–23, 3–16 | farm | Plant/harvest | ✅ tapAt |
| Animals | in pens | animal | Feed/pet/collect | ✅ tapAnimal |
| Well | 21, 18 | — | (decorative in FarmVille mode) | — |

**18 hotspots, ~11 need new mechanics.** Grouped: 5 shops · castle · dungeon · mining(5 nodes) · forestry · fishing · PvP.

## 3. Build plan — phased, each verifiable in the preview

**Phase 0 — Hotspot spine (unblocks everything).**
`HOTSPOTS[]` + `hotspotAt()` in farm-map; `openHotspot()` router in FarmRoom;
`<HotspotModal>` component; state fields (materials/nodes/tools/house). No mechanic
yet — just the plumbing + a debug toast on tap so every hotspot is confirmed live.

**Phase 1 — Shop popups (you asked for this; simplest win).**
`<ShopModal>` fed by a `SHOPS` data table (id → title + items[{name,icon,price,cur,buy}]).
Handlers reuse `buySeed`; add `buyTool/buyAnimal/buyFeed/buyCosmetic`. Tap a shop → its
popup. Ship all 5.

**Phase 2 — Mining + Forestry (feeds materials).**
`mine(nodeId)` / `chop(treeId)`: check tool tier → grant material → set node cooldown
(`state.nodes[id]=minedAt`) → node greys out, respawns on a timer (timestamp-derived,
like crops) → player Get-swing animation + FX. Adds 🪵 wood / 🪨 stone / 🥇 gold-ore to
inventory. Tier gates gem/gold behind the blacksmith pickaxe.

**Phase 3 — Castle interior.**
Tap castle → `<CastleModal>` (v1): **Upgrade Home** (tier, costs wood+stone+gold) +
**Storage** view. v2: enter an interior room and place furniture on a grid (furniture
art already generated). Home tier swaps the exterior sprite (art tiers exist).

**Phase 4 — Dungeon (reuses the combat engine).**
Tap dungeon gate → flip into a **dungeon instance** (same pattern as `inArena`/`combat.on`,
but a themed 1-floor room) → spawn woodland monsters (`@arganta/combat`, art ready) →
**Tiger boss** in the end room → clear → server-style loot roll → gold + materials →
exit. Gentle: defeat = exit, keep loot (per your spec).

**Phase 5 — Fishing.**
Tap dock/water → cast → short tap-timing bar → catch → fish added to produce → sell at
market. Rod tier (blacksmith) affects catch.

**Phase 6 — PvP (later; needs netcode).**
Duel via the presence channel; ranked ladder (season-capped). Deferred — needs the
server-adjudication tier from `mmorpg-architecture.md §5.3`.

## 4. Data model touched (farm-logic.js)

```
state.materials = { wood, stone, goldOre, gem }     // gathering output
state.tools     = { pickaxe:1, axe:1, rod:1 }        // blacksmith upgrades, gate gathering
state.nodes     = { '51,21': minedAtMs, ... }        // per-node respawn cooldowns
state.house     = { tier:1, storage:60 }             // castle upgrade + storage cap
state.furniture = [ {item,x,y}, ... ]                // castle decoration (v2)
```
All additive to `_default()` + `serialize()` + `applyIntent()` (new intent kinds:
`mine`, `chop`, `house`, `furniture`) so it stays circle-synced like the farm.

## 5. Recommended order to build NOW
**Phase 0 → Phase 1 (shops) → Phase 2 (mining/forestry) → Phase 4 (dungeon) →
Phase 3 (castle) → Phase 5 (fishing).** Shops first (fast, visible, you asked); mining
next (feeds materials that shops/castle spend); dungeon (reuses combat, high wow).

---
*Plan only — no mechanics built yet. Forest/mining spots already swapped in farm-map.js.*
