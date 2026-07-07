# LashiraBloom — Map + Asset Manifest (CLEAN, single source of truth)

Status: **CONCEPT — no build.** Rewritten clean 2026-07-07 (all prior revisions
audited + superseded content deleted — see §16 audit log).

This is the authoritative map + pixel-art plan. Systems architecture companion:
[`mmorpg-architecture.md`](./mmorpg-architecture.md). Strategy/phases:
[`buildplan.md`](./buildplan.md). Where those disagree with this file on the map,
economy, dungeon, or currency, **this file wins.**

Owner-locked decisions baked in here:
- **Castle = castle** (final home upgrade + decoratable interior). NOT a dungeon.
- **Dungeon shares space with Mining** (dungeon gate in the mining zone). **1 floor
  only** for the test.
- **Currency = 🥇 Gold** for play (crops, animals, tools) — earned from **Mining**
  and the **Battleground**. Materials 🪵 Wood + 🪨 Stone for upgrades. 💎 Diamonds
  stay the separate learning/cosmetic currency.
- **Forest zone added** (east) — the source of 🪵 Wood.
- **Monsters = friendly woodland animals** (squirrel/fox/boar/deer/badger), **Tiger =
  boss**. Nothing scary (kid-safe).
- Main character + all effect animations = **Kingdom** (whitelist later). Everything
  else = **Lashira**, generated original from scratch.

---

## 1. Map size

`60×48` tiles, `TILE=48px` → **2880×2304 px**. Map center = tile `(30,24)` = px
`(1440,1152)`. Baked once into one offscreen canvas, blitted per frame.

- **iOS canvas cap = 4096 px/side, ~16.7M px area.** `2880×2304` = 6.6M px — safe,
  headroom to ~`72×56`. Beyond that → chunked bake (§14).
- **Keep `TILE=48`** (matches the Kingdom avatar grid, which we don't touch). All art
  targets the 48px grid; buildings in multiples of 48.

---

## 2. Zone layout (castle exactly centered)

**Castle centering (exact):** 8×8 tiles at `x[26–33], y[20–27]`. X margins 26·8·26,
Y margins 20·8·20 → symmetric. Castle px `(1248,960)–(1632,1344)`, center
`(1440,1152)` = map center. ✅

| Zone | Tiles x0–x1, y0–y1 | Size | Note |
|---|---|---|---|
| **Farm** (biggest) | 2–25, 2–17 | 24×16 = 384 | largest zone |
| **Animal pens** (cow\|sheep\|chick) | 34–57, 2–17 | 24×16 = 384 | = farm size; 3 columns |
| Castle north approach (path) | 26–33, 2–17 | 8×16 | aligns to castle |
| Plaza + shops (ring) | 22–37, 18–31 | — | shops on plaza edges |
| **Castle** (centered) | 26–33, 20–27 | 8×8 | home; decoratable interior |
| Greenhouse (small, upgradeable) | 3–9, 19–26 | ~7×8 | grows with tier |
| **Flower garden** (fills the west gap) | 10–21, 18–27 | 12×10 | decorative + flower crops; wraps the greenhouse, no empty space |
| Fishing lake | 2–17, 28–45 | 16×18 | SW |
| **Mining + Dungeon gate** | 38–47, 18–31 | 10×14 | dungeon (1 floor) lives here |
| **Forest** (wood) | 48–57, 18–31 | 10×14 | choppable trees → 🪵 |
| Arena wall (+ gate 28–29) | y=32, x15–57 | — | upgradeable |
| Battleground (PvE) | 19–39, 33–45 | 21×13 | woodland mobs |
| PvP arena | 41–57, 33–45 | 17×13 | everyone, gentle |
| Tree border | x0 & 59, y0 & 47 | 1-tile ring | |

Thematic gradient: **homestead north** (farm + animals) · **peaceful west**
(greenhouse + fishing) · **wild resources east** (mining/dungeon + forest) ·
**martial south** (battleground + PvP, walled).

```
     x:0   2         25 26  33 34         57 59
        ┌────────────── TREE BORDER ───────────────┐ y0
        │ ┌─── FARM (biggest) ───┐║║┌ ANIMAL PENS ─┐│ y2
        │ │ x2–25 y2–17 =384     │║║│ x34–57 =384   ││
        │ │                      │║║│ cow|sheep|chik││
        │ └──────────────────────┘║║└──────────────┘│ y17
        │ ┌GREENH┐  ╔══ PLAZA+SHOPS ══╗ ┌MINE+DUNG┐┌FOREST┐ y18
        │ │x3–9  │  ║  ╔═══════════╗  ║ │x38–47   ││x48–57│ y20
        │ │small │  ║  ║  CASTLE ★  ║  ║ │stone·   ││ wood ││
        │ └──────┘  ║  ╚═══════════╝  ║ │gold ▼dun││ chop ││
        │ ┌FISHING┐ ╚═══ shops ═══════╝ └─────────┘└──────┘ y31
        │ │x2–17  │══ ARENA WALL + GATE(28,32) ═════════════│ y32
        │ │y28–45 │┌ BATTLEGROUND ─┐┌── PvP ARENA ─┐        │ y33
        │ └───────┘│ x19–39 y33–45 ││ x41–57 y33–45│        │
        │          └───────────────┘└──────────────┘        │ y45
        └────────────── TREE BORDER ───────────────┘ y47
```

---

## 3. Economy (FINAL, single consistent model)

| Token | Type | Earn | Spend |
|---|---|---|---|
| 🥇 **Gold** | play currency (shared circle pool) | Mining (gold ore) · Battleground (drops) · selling crops/produce/fish | seeds · animals · feed · tools · gold-part of upgrades |
| 🪵 **Wood** | material (shared pool) | **Forestry** — chop Forest trees | structure upgrades |
| 🪨 **Stone** | material (shared pool) | Mining (rock/boulder) | structure upgrades |
| 💎 **Diamond** | learning currency (individual) | kids: learning the 6 Worlds · adults: normal | cosmetics only |

- **Kids can progress the farm freely** — they earn Gold/Wood/Stone by playing; their
  💎 (learning currency) is never spent on play, only cosmetics. Learning wall intact.
- **Upgrades**: leader/owner only; cost 🪵 + 🪨 + 🥇 from the shared pools.
- (Supersedes every earlier currency scheme — Bloom wall, diamond-only, etc.)

---

## 4. Every building — function + currency

| Building | Zone | Does | Spends | Earns |
|---|---|---|---|---|
| Castle (Home) | center | Save/sleep, storage, **decorate interior** (leader). Evolves Shack→Castle. | Upgrade: 🪵🪨🥇 (leader) | — |
| Barn | pens | Shelters cows+sheep; feed→milk/wool | Feed (🥇) | Milk/wool → 🥇 |
| Coop | pens | Shelters chickens; collect eggs | Feed (🥇) | Eggs → 🥇 |
| Silo | farm | Stores hay/fodder | — | — |
| Greenhouse | west | All-season planting | Seeds (🥇) | Crops → 🥇 |
| Well | farm | Refill watering can | — | — |
| Shipping bin | farm | Auto-sell dropped goods | — | 🥇 |
| Seed shop | plaza | Buy seeds | 🥇 | — |
| General store | plaza | Buy tools (can, rod, chest) | 🥇 | — |
| Blacksmith | plaza | Upgrade tools (pickaxe/axe/sword tiers) | 🪵🪨🥇 | — |
| Animal shop | plaza | Buy livestock + feed | 🥇 | — |
| Cosmetics / bank | plaza | Buy cosmetics; store items | 💎 (cosmetics) | — |
| Market stalls | plaza | Sell produce/fish/ore | — | 🥇 |
| Notice board | plaza | Quests / daily tasks | — | 🥇 / 💎 (learn) |
| Fishing dock | fishing | Fish (needs rod) | — | Fish → 🥇 |
| Mine / quarry | mining | Gather stone + gold (tool-gated); **dungeon gate here** | tools | 🪨 🥇 |
| Forest | forest | **Chop trees → wood** (tool-gated for hardwood) | tools (axe) | 🪵 |
| Battleground | south | Open PvE vs woodland animals | — | 🥇 · loot |
| PvP arena | south | Duel (everyone, gentle); ladder | free | rank → cosmetics |
| Arena wall | mid | Gate to martial zone; upgrade unlocks PvP ranked + tougher PvE | Upgrade: 🪨🥇 (leader) | — |

**Tools tiered** (blacksmith): Tier-1 = stone + soft wood; **Tier-2 required for gold
+ hardwood**. Gives the blacksmith purpose + a gathering ladder.

---

## 5. Upgrade popups (leader-only, materials + gold)

```
╔═══════ EXPAND FARM ═══════╗   ╔════ UPGRADE GREENHOUSE ════╗
║ 🌾 Farm  Lv2 → Lv3        ║   ║ 🪟 Greenhouse  Lv1 → Lv2   ║
║ Plots: 24 → 40 (+16)      ║   ║ Beds: 4 → 8 · all-season   ║
║ 🪵40 🪨20        🥇250    ║   ║ 🪵30 🪨30        🥇400    ║
║ [ Upgrade ]   [ Close ]   ║   ║ [ Upgrade ]   [ Close ]    ║
╚═══════════════════════════╝   ╚════════════════════════════╝
╔══════ UPGRADE HOME ═══════╗   ╔═══ FORTIFY ARENA WALL ════╗
║ 🏰 Homestead → CASTLE ★    ║   ║ 🧱 Wall  Tier1 → Tier2     ║
║ Rooms 4→8 · Storage 60→200 ║   ║ Unlocks PvP ranked +       ║
║ +Trophy hall               ║   ║ tougher PvE / better loot  ║
║ 🪵500 🪨400      🥇5000   ║   ║ 🪨200            🥇1500   ║
║ [ Upgrade ]   [ Close ]    ║   ║ [ Upgrade ]   [ Close ]    ║
╚═══════════════════════════╝   ╚═══════════════════════════╝
        (all upgrades: circle leader / owner only)
```

Shop "what it sells" popups (tap building → vendor list, prices in 🥇): seed shop,
general store, blacksmith, animal shop, cosmetics/bank. (No NPC needed for MVP.)

---

## 6. Castle evolution — 5 tiers, exterior + DECORATABLE interior (not a dungeon)

Home evolves Shack → Cottage → Farmhouse → Manor → **Castle**. Each tier swaps the
exterior sprite and unlocks a bigger decoratable interior Room (more furniture slots).

```
 T1 SHACK(2×2)  T2 COTTAGE(3×3)  T3 FARMHOUSE(4×3)  T4 MANOR(6×4)   T5 CASTLE(8×8)★
   ▛▀▜            ▛▀▀▜             ▛▀▀▀▜              ▛▀▀▀▀▜          ╔▛▀▀▀▀▀▜╗ towers
   ▌🚪▐           ▌🪟🚪▐           ▌🪟🚪🪟▐            ▌🪟🚪🪟▐        ║▌🏳🚪🏳▐║ banners
   ▙▄▟            ▙▄▄▟             ▙▄▄▄▟              ▙▄▄▄▄▟          ╚▙▄▄▄▄▄▟╝
  1 room         2 rooms          3 rooms            5 rooms         8 rooms
  🛏📦           🛏🔥🍳           🛏🔥🍳🪑🖼          🛏🛏🔥🍳📦       👑throne 🏆trophy hall
                 +stove,table     +kitchen,rug       +2nd bedroom    big storage, decorate free
```

Placeable furniture slots scale T1≈2 → T5≈20+. Interior is **safe + decorative**
(leader places/moves furniture). No combat inside the castle.

---

## 7. Dungeon — 1 floor, inside the Mining zone (test build)

The **dungeon gate sits in the Mining zone**; entering → a **single-floor** dungeon
Room (this is a test — depth comes later). Co-op with circle members, **gentle** (on
defeat you exit and keep loot gathered so far; no harsh penalty).

```sql
dungeon      (id, circle_id, floor_count=1, seed, state)
dungeon_room (dungeon_id, x, y, kind ∈ entry|combat|boss, cleared)
dungeon_spawn(room_id, monster_kind, count)          -- woodland mobs, shared combat rules
dungeon_loot (room_id, roll_seed, drops_json)        -- SERVER-rolled → 🥇 + materials
```
- **Boss = the Tiger** (§8) at the end room.
- Loot server-rolled → 🥇 / materials; access gated by the wall tier.
- Reuses `@arganta/combat` + the instance/portal machinery (architecture §5.4).

---

## 8. Monsters — friendly woodland animals (kid-safe), Tiger = boss

Replaces the old slime/bat/blob. All non-scary, cute woodland critters. Live in the
**Battleground** and the **Dungeon**. Each = 1 `create_character` sheet + animations.

| Monster | Role | Behavior | Animations |
|---|---|---|---|
| 🐿️ Squirrel | weakest, fast | darts, low HP | walk 4f · hurt 2f · faint 4f |
| 🦊 Fox | light skirmisher | quick nips | walk 4f · pounce 4f · hurt 2f · faint 4f |
| 🦡 Badger | tanky | slow, sturdy | walk 4f · swipe 4f · hurt 2f · faint 4f |
| 🐗 Boar | charger | rushes in a line | walk 4f · charge 4f · hurt 2f · faint 4f |
| 🦌 Deer | ranged-ish | kicks, evasive | walk 4f · kick 4f · hurt 2f · faint 4f |
| 🐯 **Tiger** | **BOSS** | dungeon end room; big + telegraphed pounce | walk 4f · pounce 6f · roar 4f · hurt 2f · faint 6f |

"Faint" not "die" (kid-friendly — they flop over, not gore). No blood/skulls; defeat
= a puff + they scamper/faint. Effect FX (puffs, stars) = **Kingdom-whitelisted**.

---

## 9. Forest zone (the wood source)

New east zone `x48–57, y18–31`. Choppable trees regrow on a timestamp; chopping =
player **attack animation** (Kingdom) + wood-chip FX (Kingdom). Yields 🪵 Wood.

Assets: forest-floor ground, **choppable tree** (+ chopped stump + falling state),
**wood-log pile**, forest mushrooms, forest bushes/ferns. Hardwood trees gated behind
a Tier-2 axe.

---

## 10. Art ownership — Kingdom vs Lashira

| **KINGDOM** (whitelist later) | **LASHIRA** (generate fresh — this manifest) |
|---|---|
| Main character / hero avatar | All terrain, buildings, castle + furniture, props |
| **All effect / combat animations** (sparks, dust, puffs, splashes, coin/level pops) | Animated world objects (windmill, water, torches, flags, gate) |
| Mount | Animals + **woodland monsters** (walk/attack/hurt/faint) |
| 💎 Diamond icon | Crops, ore, wood, fishing props, structures, forest |
| | UI panels, NPC portraits, 🥇/🪵/🪨 icons |

---

## 10b. Art direction — "wow but lightweight" (recommended)

**Recommendation: cozy-cute pixel = Stardew warmth + Animal Crossing softness +
FarmVille color-pop & juice.** Clean, bright, readable 48px pixel art.

Why this is the best solution:
- Your existing `reference/slices` are **already** this cozy-warm pixel look — building
  on it keeps everything consistent.
- **Pixel art is inherently lightweight** (small PNGs, integer scaling, no shaders/3D)
  — "light" comes for free.
- The "wow" in FarmVille/Animal Crossing is **~80% motion + color + feedback**, not
  static detail. So we get engagement from **animation** (windmill, water shimmer,
  crop-pop), a **bright saturated palette**, and **Kingdom FX** — while base tiles stay
  clean + light.

What we borrow from each:
- **FarmVille** → bright saturated palette, chunky readable objects, satisfying reward pop.
- **Animal Crossing** → soft rounded shapes, cute proportions, cozy wholesome tone.
- **Stardew** → the warm 3/4 top-down farm structure + seasonal charm.
- **Harvest Moon** → gentle simplicity (don't over-detail).

**Avoid** Stardew's dense/dark retro detail + "highly detailed shading" — it looks
muddy *and* reads heavier. Keep it clean + bright.

**PixelLab recipe to hit it:** `view: high top-down · detail: medium · shading:
basic/medium (NOT highly-detailed) · outline: selective`, palette-locked to the
reference slices.

What PixelLab actually produces (honest):
- Wang **tilesets**: clean, seamless — very good. ✓
- **Map objects** (buildings, props, furniture): good, consistent, cute. ✓
- **Characters/animals/monsters**: decent but the weakest link — multi-frame animation
  may need re-rolls/touch-ups. Expect iteration on the ~9 character sheets.
- Overall: genuinely nice + cohesive for a cozy farm (your existing slices prove the
  bar is reachable). Not a top human artist's hero pieces, but "wow" enough for an
  engaging MVP.

---

## 11. Master component table — every asset, tool, count (single table)

**L = generate in Lashira · K = Kingdom (whitelist).** Qty = distinct sprites/sheets.

| Category | Component | PixelLab tool | Qty | Animation | Src |
|---|---|---|---|---|---|
| Terrain | Grass Wang + variants | topdown_tileset / tiles_pro | 5 | — | L |
| Terrain | Path/soil/water/sand/stone Wang | topdown_tileset | 5 | shore opt | L |
| Terrain | Forest-floor Wang | topdown_tileset | 1 | — | L |
| Deco | Border/forest trees | map_object | 3 | canopy sway opt | L |
| Deco | Bushes/rocks/stump/ferns | map_object | 6 | — | L |
| Deco | Flowers/tufts/mushrooms | map_object | 6 | — | L |
| Deco | Fences (straight/corner/gate) | map_object | 3 | gate 2f | L |
| Deco | Signposts + fountain | map_object | 4 | water 4f | L |
| Flowers | Flower-garden varieties × 4 + bench/arch trellis | map_object | 5 | sway 2f | L |
| Forest | Choppable tree (+stump/fall) | map_object | 3 | fall 3f | L |
| Forest | Wood-log pile | map_object | 1 | — | L |
| Farm | Crops 6 × 4 growth stages | 1_direction_object | 24 | staged | L |
| Farm | Barn / coop / silo | map_object | 3 | — | L |
| Farm | Windmill | map_object | 1 | blades 6f | L |
| Farm | Scarecrow / bin / tool rack | map_object | 3 | sway·lid | L |
| Animals | Cow / sheep / chicken | character+animate | 3 | walk4 + idle2 | L |
| Animals | Troughs + produce icons | map_object | 5 | — | L |
| Greenhouse | Exterior × 3 tiers | map_object | 3 | — | L |
| Greenhouse | Beds + glass shimmer | map_object/animate | 2 | 3f | L |
| Shops | Buildings × 5 | map_object | 5 | — | L |
| Shops | Stalls × 2 + signs × 5 | map_object | 7 | awning·sway | L |
| Fishing | Dock / reeds / lily | map_object | 4 | sway 3f | L |
| Fishing | Fish × 3 + bobber + bucket | map_object | 5 | jump·ripple | L |
| Mining | Ore nodes × 4 (copper/iron/gold/gem) | map_object | 4 | gem glint 3f | L |
| Mining | Boulders / beams / cart / tracks | map_object | 5 | roll 4f | L |
| Mining | Dungeon gate + torches | map_object | 2 | portal·flame | L |
| Dungeon | Floor tileset (1) + props (chest/crate/barrel/torch) | topdown_tileset/map_object | 5 | torch 3f | L |
| Monsters | Woodland × 5 + Tiger boss | character+animate | 6 | walk+attack+hurt+faint | L |
| PvP | Walls × 2 tiers + gate/stands/board | map_object | 5 | gate 2f | L |
| PvP | Arena torches | map_object | 1 | flame 3f | L |
| Castle | Exteriors × 5 tiers | map_object | 5 | — | L |
| Castle | Banners / torches / door | map_object | 4 | wave·flame·open | L |
| Castle | Interior tilesets × 2 | topdown_tileset | 2 | — | L |
| Castle | Placeable furniture | map_object | 14 | fireplace 3f | L |
| UI | Popup + shop frames + buttons | ui_asset | 3 | — | L |
| UI | Emote bubbles × 6 | map_object | 6 | — | L |
| UI | NPC portraits × 8 (later) | portrait_character | 8 | moods | L |
| UI | Currency icons 🥇/🪵/🪨 | map_object | 3 | — | L |
| UI | 💎 Diamond icon | — | 1 | — | K |
| FX | All effects | — | — | one-shots | K |
| Character | Main hero avatar | — | — | all | K |

**Total for Lashira ≈ 180 distinct assets** (~9 multi-frame character sheets: 3
animals + 6 monsters; ~155 cheap map_object/tile/ui). Fits the 1,824-generation
balance with room to spare.

---

## 12. Animation manifest (per zone, quick reference)

Every animation lives in the **per-frame layer** above the baked ground.
`*` = effect → **Kingdom-whitelisted**, not Lashira-generated.

- **World:** fountain water 4f · fence gate 2f · *hit-spark/dust/splash/puff/coin/level*
- **Castle:** flag wave 4f · torch 3f · door 2f · fireplace 3f (interior)
- **Farm:** windmill 6f · crop stages · bin lid · *watering splash*
- **Forest:** tree fall 3f · canopy sway · *wood chips*
- **Greenhouse:** glass shimmer 3f
- **Shops:** sign sway 3f · *chimney smoke / anvil sparks*
- **Fishing:** water shimmer 4f · reed sway 3f · fish jump 4f · bobber ripple 4f
- **Mining/Dungeon:** ore glint 3f · dungeon-gate portal 4f · torches 3f · *mining dust*
- **Monsters:** walk 4f + attack 4f + hurt 2f + faint 4f (Tiger boss +roar/bigger)
- **Animals:** walk 4f + idle 2f
- **PvP:** gate 2f · torches 3f

---

## 13. Performance & scalability (build requirements for one-map MVP)

1. **Viewport-cull every dynamic draw** (crops, animated tiles, actors, monsters) →
   per-frame cost tracks screen size, not map size.
2. **Proximity-LOD the sims** — a zone only ticks when the player is near (the arena
   already does this). Off-screen zones cost ~0.
3. **Cap concurrent actors** (~5/species, ~5 mobs) + broadcast only on-screen/owned.

At `60×48` the map itself is a non-issue (one iOS-safe blit); scale = culling +
proximity-LOD, added once and inherited by every zone.

---

## 14. What's missing to scale later (design the seams in now)

1. **Map as DATA + a Bloom Command editor** — collision/layout is hardcoded in
   `farm-map.js` today; must become a tilemap format. **Biggest gap.**
2. **Depth-sort (y-sort) + overhead layer** — walk behind castle/trees/roofs.
3. **Viewport culling + proximity-LOD** (§13) — the perf core.
4. **Texture atlas + manifest loader** — 175 PNGs → packed, not 175 fetches.
5. **Room/portal + instancing** — castle interior + dungeon Rooms.
6. **Server-adjudication + append-only ledgers** — gold/materials/loot anti-cheat.
7. **Chunked background bake** — iOS 4096 escape hatch past ~72×56.
8. **Animated-terrain per-frame layer** — water/portal can't be baked.
9. **Unified interactable registry** — one "what's tappable at tile X" lookup.
10. **Pathfinding (A\*)** — NPC/Kin task-walking on a big map.
11. **Placeable-furniture + per-structure-level save schema.**

Items **1–3** shape the build from day one; the rest land per mechanic.

---

## 15. Generation batches (fire order)

Balance: **1,824 generations.** ~175 assets across 6 batches.

| Batch | Contents | ~jobs | Depends on |
|---|---|---|---|
| **B0 Terrain** | 6 Wang sets + grass variants (incl. forest floor) | ~7 | nothing (layout-independent) |
| B1 Farm + Castle | soil, crops, barn/coop/silo, windmill, castle 5 tiers | ~35 | layout |
| B2 Zones static | shops, greenhouse, fishing, ore, forest, arena, dungeon | ~45 | layout |
| B3 Actors | 3 animals + 6 woodland monsters (multi-frame) | ~9 sheets | layout |
| B4 Animated objects | windmill, water, torches, flags, gate, fountain | ~14 | polish |
| B5 UI + furniture + polish | popups, furniture, emotes, portraits, icons | ~35 | last |

**B0 is layout-independent → safe to start anytime.** B1+ need the §2 grid locked.

---

## 16. Audit log — conflicts found + resolved (this rewrite)

Deleted/superseded to remove confusion:
1. **Castle-as-dungeon** (old §19) → **DELETED.** Castle is decorate-only; dungeon
   moved to the Mining zone (§7), 1 floor.
2. **Currency churn** (two-currency Bloom wall → diamond-only → …) → **REPLACED** by
   the single model in §3: 🥇 Gold play currency, 🪵🪨 materials, 💎 learning/cosmetics.
3. **Multi-floor dungeon** → **1 floor** (test).
4. **Scary monsters** (slime/bat/blob) → **woodland animals + Tiger boss** (§8).
5. **No wood source** → **Forest zone added** (§9), east.
6. **Stray revision sections** (old §12/§17/§22/§23 deltas) → folded into these clean
   sections and removed.
7. **`mmorpg-architecture.md`** still describes a generic instanced dungeon Room — that
   maps to the **Mining dungeon gate** now; no castle dungeon. (Minor; flagged, not
   yet rewritten there — this file governs.)

No remaining internal contradictions in this file.

---

## 17. One open assumption to confirm

I kept **💎 Diamonds** as the separate learning/cosmetic currency (so the "learning is
the gate" philosophy survives) while **🥇 Gold** runs all play. If you'd rather **drop
Diamonds entirely** and make Gold the only currency, say so — it's a one-line change here.

---

*End. Concept + manifest only — nothing built, no generation fired yet.*
