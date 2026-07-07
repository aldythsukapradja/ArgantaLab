# LashiraBloom — One-Map Overworld + Pixel/Animation Manifest (concept)

Status: **CONCEPT — no build.** Dated 2026-07-07. Companion to
[`mmorpg-architecture.md`](./mmorpg-architecture.md) and [`buildplan.md`](./buildplan.md).

**Owner brief:** rebuild the map from scratch as a SINGLE overworld holding every
mechanic — **castle (center, = final upgrade, the only enterable building, with a
placeable interior), shops, hot houses (greenhouses), fishing, mining, dungeon
gate, farm, battleground, PvE, PvP arena.** Map every pixel asset + the animation
each needs. **Do NOT touch the main character** (owned by the Kingdom app).

> Why one map for the MVP: validating all mechanics + rendering + sync + perf in
> one scene *before* splitting into rooms is the right de-risking move. It stays
> consistent with the Room architecture — the **castle interior is the first
> separate Room** (proves the portal system), and heavy zones (esp. the dungeon)
> graduate to instanced Rooms later. One map now; not a dead end.

---

## 1. Map size — verdict, with the numbers

**Current map is too small** for ten zones + a central castle. It's `40×34`
tiles at `TILE=48` = **1920×1632 px** (farm + a small arena, and already full).

**Recommended: `60×48` tiles = `2880×2304 px`.** Rationale:

- **iOS canvas ceiling is the hard constraint.** The ground is baked ONCE into an
  offscreen canvas (`buildFarmMap`) and blitted each frame. iOS/Safari caps a
  single canvas at **4096 px/side and ~16.7 M px area**. `2880×2304` = 6.6 M px —
  comfortably safe, with headroom to grow to ~`72×56` before hitting the cap.
- **Keep `TILE=48`.** The main character is a Kingdom Heroes avatar authored to a
  48 px world grid — since we must not touch it, all new art targets the 48 px
  grid (buildings in multiples of 48). Don't drop to 16/32 px.
- **Map size is cheap; actor/animation count is the real cost** (see §6). A bigger
  baked canvas is one blit of the *visible region* per frame — size barely moves
  the needle. What scales is how many actors + animated tiles are drawn/simulated,
  which we control with culling + proximity-LOD, not by shrinking the map.

**If we ever exceed 4096/side:** switch the background from one baked canvas to
**chunked bake** (bake per NxN-tile chunk, blit only visible chunks). That's the
scalability escape hatch — not needed at 60×48, but it's how this grows unbounded.

| | Tiles | Pixels | iOS-safe? | Fits all zones? |
|---|---|---|---|---|
| Now | 40×34 | 1920×1632 | ✅ | ❌ too small |
| **Recommended** | **60×48** | **2880×2304** | ✅ (6.6M px) | ✅ with breathing room |
| Max single-canvas | ~85×85 | ~4080×4080 | ⚠ at the cap | (overkill) |
| Beyond | any | chunked bake | ✅ | requires chunking |

---

## 2. Zone layout (schematic — castle center, activities ringed)

Thematic gradient: **home/peace north & center → water west → resources/wild east
→ martial south** (battleground + PvP walled off, reusing today's arena-gate).

```
┌───────────────────────────────── 60 wide ─────────────────────────────────┐
│ 🌲🌲🌲 forest + rock border (collision) all around 🌲🌲🌲                    │
│                                                                            │
│  ┌── FARM ─────────┐     ┌── SHOPS / MARKET ROW ──────┐                     │
│  │ fields, barn,   │     │ seed · general · blacksmith │                    │
│  │ coop, silo,     │     │ animal · cosmetic  🏪🏪🏪   │                    │
│  │ 🌾 WINDMILL     │     └──────────────┬─────────────┘                     │
│  ├── HOT HOUSES ───┤            ┌───────┴───────┐                           │
│  │ greenhouses     │            │  MARKET PLAZA  │  (fountain 💧)           │
│  │ 🪟🪟 glass beds │       ┌────┴───────────────┴────┐                      │
│  └─────────────────┘       │      👑  CASTLE  👑      │  ← FINAL upgrade    │
│                            │   (ENTERABLE → interior  │    only enterable   │
│  ┌── FISHING ──────┐       │    Room; place furniture)│    building         │
│  │ lake, dock,     │       └────┬───────────────┬────┘   ┌── MINING ──────┐ │
│  │ reeds, 🎣 🐟    │            │    main paths   │       │ quarry, ore     │ │
│  └─────────────────┘            │                 │       │ nodes, cart ⛏  │ │
│                        ═════════╪═ ARENA WALL + GATE ═════│  ▼ DUNGEON GATE│ │
│              ┌── BATTLEGROUND (PvE) ──────┐               └─────────────────┘ │
│              │ wild ground, dead trees,   │      ┌── PvP ARENA ───────────┐  │
│              │ roaming mobs 👹 slime/bat  │      │ colosseum floor, stands │  │
│              │ ⚔ (combat.on flips here)   │      │ 🏟 scoreboard, gates ⚔ │  │
│              └────────────────────────────┘      └─────────────────────────┘  │
│ 🌲🌲🌲 forest border 🌲🌲🌲                                                   │
└────────────────────────────────────────────────────────────────────────────┘
```

- **Only the castle has an interior.** Every other structure is a facade you
  interact with from outside (tap shop → panel; tap greenhouse bed → plant).
- **Martial south is walled** with a gate — reuses the existing `ARENA_WALL`/gate +
  `inArena()`→`combat.on` mechanism, extended to two sub-zones (PvE field, PvP
  colosseum). Monsters only spawn/tick when the player is in the martial band.
- **Dungeon gate** sits inside Mining (the descent) — tapping it later mints an
  instanced dungeon Room; for the MVP it can be a portal stub.

### 2.5 Coordinate-accurate layout (castle EXACTLY centered)

Grid `60×48`, `TILE=48` → `2880×2304 px`. Map center = tile `(30, 24)` = px `(1440, 1152)`.

**Castle centering (exact math):** castle = **8×8 tiles at `x[26–33], y[20–27]`**.
- X: margins `0–25` (26 tiles) · castle 8 · `34–59` (26 tiles) → **26+8+26 = 60**, symmetric.
- Y: margins `0–19` (20 tiles) · castle 8 · `28–47` (20 tiles) → **20+8+20 = 48**, symmetric.
- Castle px = `(1248, 960)–(1632, 1344)`, center `(1440, 1152)` = map center. ✅

**Zone coordinate table** (tile rect inclusive → pixel rect):

| Zone | Tiles x0–x1, y0–y1 | Pixels |
|---|---|---|
| **CASTLE** (center) | 26–33, 20–27 | 1248–1632, 960–1344 |
| Castle plaza/courtyard (walkable ring) | 23–36, 16–30 | 1104–1776, 768–1488 |
| Fountain (plaza) | 29–30, 16 | 1392–1488, 768–816 |
| Farm | 2–24, 2–17 | 96–1200, 96–864 |
| Shops / Market | 35–57, 2–12 | 1680–2784, 96–624 |
| Greenhouse | 2–14, 19–29 | 96–720, 912–1440 |
| Fishing lake | 2–16, 31–45 | 96–816, 1488–2208 |
| Mining | 39–57, 15–30 | 1872–2784, 720–1488 |
| Dungeon gate (in Mining) | 52–55, 16–19 | 2496–2688, 768–960 |
| Arena wall (+ gate x28–29) | y=31, x17–57 | y 1488–1536 |
| Battleground (PvE) | 17–38, 33–45 | 816–1872, 1584–2208 |
| PvP arena | 41–57, 33–45 | 1968–2784, 1584–2208 |
| Tree border | x0 & x59, y0 & y47 | 1-tile ring |

**Annotated sketch** (axis = tile numbers; blocks to scale; table above is authoritative):

```
     x:0    2        24 26   33 35        57 59
        ┌────────────── TREE BORDER ──────────────┐  y0
        │  ┌── FARM ────────┐   ┌─ SHOPS/MARKET ─┐ │  y2
        │  │ x2–24  y2–17   │   │ x35–57 y2–12   │ │
        │  │                │   └────────────────┘ │  y12
        │  │                │      plaza approach   │
        │  └────────────────┘   ┌ fountain(29,16) ┐ │  y16
        │  ┌─ GREENHOUSE ─┐  ╔═══════════════╗      │  y19
        │  │ x2–14        │  ║    CASTLE      ║ ┌─ MINING ─┐  y20
        │  │ y19–29       │  ║  x26–33        ║ │ x39–57   │
        │  │              │  ║  y20–27        ║ │ y15–30   │
        │  │              │  ║  ★ MAP CENTER  ║ │ ▼DUNGEON │  y27
        │  └──────────────┘  ╚═══════════════╝ └──────────┘  y29
        │ ══════════ ARENA WALL + GATE(28,31) ═══════════════│  y31
        │ ┌ FISH ┐ ┌── BATTLEGROUND ───┐ ┌── PvP ARENA ──┐   │  y33
        │ │x2–16 │ │ x17–38  y33–45     │ │ x41–57 y33–45 │   │
        │ │y31–45│ └───────────────────┘ └───────────────┘   │  y45
        └────────────── TREE BORDER ──────────────┘  y47
```

---

## 3. Castle = final upgrade + the only interior

The castle is **the top tier of the house-upgrade ladder** (Shack → Cottage →
Farmhouse → Homestead → **Castle**). Art + system implications:

- **Exterior:** one big sprite per tier (the castle is the largest, ~`8×8` tiles =
  `384×384`). Only the final tier is the castle; earlier tiers are the existing
  smaller house art.
- **Interior Room:** entering the door portals to `room:castle:<circleId>` — a
  separate small Room with its own floor/wall tileset.
- **Placeable furniture:** the "place stuff inside" system = a **furniture catalog
  of map objects** the player drops on a grid (server-validated purchases; grid
  snap). Art = a starter furniture set (§7C). This is the first real test of the
  Room + placement systems.

---

## 4. Animation types in this engine (how each is implemented)

The ground is **baked once** and can't animate. So every animation is drawn in the
**per-frame dynamic pass** (like crops already are). Five kinds:

| Kind | Example | Implementation | PixelLab tool |
|---|---|---|---|
| **Animated tile** (loop) | water shimmer, lava, portal | per-frame tile layer, culled to viewport | `create_map_object` base + `animate_object` (v3) |
| **Animated object** (loop) | windmill, waterwheel, torch, flag, chimney smoke | per-frame sprite, N frames cycled | `create_map_object` + `animate_object` |
| **Actor animation** | animals, monsters, NPCs walk/attack | directional sheets, frame by state | `create_character` + `animate_character` |
| **Effect** (one-shot) | dig dust, hit spark, splash, harvest sparkle | triggered short sequence, then gone | `animate_object` (v3, one-shot) |
| **Staged** (not frame anim) | crop growth stages | discrete sprite swap by growth % | `create_1_direction_object` per stage |

**Architectural note for build:** animated terrain (water, portal, lava) must be a
**per-frame layer above the baked ground**, culled to the viewport. Static ground
stays baked. This is the one engine addition the animated map needs.

---

## 5. Terrain foundation (P0 — do first, layout-independent)

These are needed regardless of exact zone positions, so they can generate now.
All via `create_topdown_tileset` (Wang autotiles → seamless blended edges).

| Slot | Wang set | Zones served |
|---|---|---|
| `terrain.grass` (+ 3–4 variants via `create_tiles_pro`) | base | everywhere |
| `terrain.grass↔path` | grass ↔ dirt path | plaza, roads, farm |
| `terrain.grass↔soil` | grass ↔ tilled soil | farm, greenhouses |
| `terrain.grass↔water` | grass ↔ water (shore) | fishing lake |
| `terrain.grass↔sand` | grass ↔ arena sand | PvP colosseum, battleground |
| `terrain.stone/cave` | rocky quarry + cave floor | mining, dungeon gate |

---

## 6. Performance & scalability plan (the "one map, all mechanics" bet)

Big single map is fine **if** these three hold (none exist yet — they're the build
requirements that make it scale):

1. **Viewport-cull every dynamic draw.** Crops, animated tiles, actors, effects —
   draw only what's on screen (+1 tile margin). The baked ground already blits only
   the visible region; extend the same discipline to the per-frame pass. This makes
   per-frame cost proportional to *screen size, not map size*.
2. **Proximity-LOD the simulations.** A zone only ticks when the player is near it
   (the arena already does this — monsters spawn only when the player is inside).
   Generalize: farm crops always tick (timestamp-derived, cheap), but monster AI,
   animated objects, fishing ripples, NPC wander only run within ~1 screen of the
   player. Off-screen zones cost ~0.
3. **Cap concurrent actors + sync payload.** Presence broadcasts actor positions;
   payload scales with actor count. Cap simultaneous animals/mobs (e.g. ≤5/species,
   ≤5 mobs — today's numbers) and only broadcast on-screen/owned actors.

**Verdict:** at `60×48` the map itself is a non-issue (one iOS-safe blit). Scale is
governed by culling + proximity-LOD, which we add once and every zone inherits.
That's exactly what testing all mechanics in one map will prove.

---

## 7. Full asset + animation manifest (by zone)

Priority: **P0** foundation · **P1** core (mechanic works) · **P2** polish/juice.
"Anim" column: type × frame count. Tool = PixelLab tool.

### 7A. World / shared
| Asset | Static tool | Anim | P |
|---|---|---|---|
| 5 terrain Wang sets (§5) | `create_topdown_tileset` | — | P0 |
| Grass variants (clover, pebble, flower) | `create_tiles_pro` | — | P0 |
| Border tree ×3 variants | `create_map_object` | (P2: canopy sway 2f) | P0 |
| Bushes, rocks, stumps, flower clumps, tufts | `create_map_object` | — | P1 |
| Fence straight + corner + gate | `create_map_object` | gate open 2f | P0 |
| Signposts / zone signs | `create_map_object` | — | P1 |
| Fountain (plaza centerpiece) | `create_map_object` | **water loop 4f** | P1 |
| Effects: hit spark, dig dust, splash, harvest sparkle, coin pop, level-up | — | **one-shot 4–6f** | P1 |
| Ambient: fireflies, falling leaves | — | loop 4f | P2 |

### 7B. Castle (center) + interior
| Asset | Static tool | Anim | P |
|---|---|---|---|
| Castle exterior (final tier, ~384×384) | `create_map_object` | — | P1 |
| House tiers 1–4 (smaller, for upgrade path) | `create_map_object` | — | P1 |
| Castle banners / flags | `create_map_object` | **flag wave 3–4f** | P1 |
| Castle wall torches | `create_map_object` | **flame flicker 3f** | P1 |
| Castle door | `create_map_object` | open/close 2f | P1 |
| Interior floor + wall tileset | `create_topdown_tileset` | — | P1 |
| **Furniture set** (§7C) | `create_map_object` | select (fireplace 3f) | P1 |

### 7C. Furniture (placeable inside castle) — starter set
`create_map_object` each: rug, wooden table, chairs, bed, bookshelf, storage chest,
trophy stand, wall banner, potted plant, lamp/candelabra, **fireplace (anim: fire
3f)**, kitchen counter, barrel, painting. (~14 objects; grows over time.)

### 7D. Farm
| Asset | Static tool | Anim | P |
|---|---|---|---|
| Tilled soil dry + watered | (from §5 soil Wang) | — | P0 |
| 6 crops × 4 growth stages | `create_1_direction_object` per stage | **staged** (P2: ripe sway 2f) | P1 |
| Barn, coop, silo | `create_map_object` | — | P1 |
| **Windmill** (landmark) | `create_map_object` | **blades rotate 4–6f loop** | P1 |
| Scarecrow | `create_map_object` | sway 2f | P2 |
| Shipping bin | `create_map_object` | lid open 2f | P1 |
| Watering effect | — | one-shot splash 4f | P1 |

### 7E. Hot houses (greenhouses)
| Asset | Static tool | Anim | P |
|---|---|---|---|
| Greenhouse building (glass roof) | `create_map_object` | — | P1 |
| Interior planting beds | `create_map_object` | — | P1 |
| Glass shimmer / steam vent | — | **loop 3f** | P2 |

### 7F. Shops / market
| Asset | Static tool | Anim | P |
|---|---|---|---|
| Shop buildings ×5 (seed, general, blacksmith, animal, cosmetic/bank) | `create_map_object` | — | P1 |
| Market stalls | `create_map_object` (exists) | awning flap 2f | P1 |
| Hanging shop signs | `create_map_object` | **sign sway 3f** | P2 |
| Blacksmith chimney smoke | — | **smoke loop 4f** | P2 |
| Blacksmith anvil sparks | — | one-shot 3f | P2 |

### 7G. Fishing (animation-heavy)
| Asset | Static tool | Anim | P |
|---|---|---|---|
| Water body (from grass↔water Wang) | `create_topdown_tileset` | **surface shimmer loop 4f** | P1 |
| Dock / pier | `create_map_object` | — | P1 |
| Reeds / cattails / lilies | `create_map_object` | **sway loop 3f** | P2 |
| Fish shadow + jump | `create_map_object` | **jump one-shot 4f** | P1 |
| Bobber + cast ripple | — | **one-shot 4f** | P1 |
| Bucket / fish caught pop | `create_map_object` | one-shot 3f | P2 |

### 7H. Mining + dungeon gate
| Asset | Static tool | Anim | P |
|---|---|---|---|
| Rocky ground (from stone/cave Wang) | `create_topdown_tileset` | — | P0 |
| Ore nodes ×4 (copper, iron, gold, gem) | `create_map_object` | **gem glint loop 3f** | P1 |
| Boulders, rubble | `create_map_object` | — | P1 |
| Mine cart + tracks | `create_map_object` | (P2: cart roll 4f) | P2 |
| Support beams / scaffold | `create_map_object` | — | P2 |
| Mining dust effect | — | one-shot 4f | P1 |
| **Dungeon gate / cave mouth** | `create_map_object` | **portal swirl loop 4f** | P1 |
| Gate torches | `create_map_object` | flame 3f | P1 |

### 7I. Battleground (PvE)
| Asset | Static tool | Anim | P |
|---|---|---|---|
| Wild/trodden ground (sand Wang) | `create_topdown_tileset` | — | P0 |
| Dead trees, bones, banners | `create_map_object` | banner wave 3f | P2 |
| **Monsters ×3** (slime, bat, blob — match `@arganta/combat` kinds) | `create_character` | **walk 4f + attack 4f + hurt 2f + die 4f** | P1 |
| Hit spark / damage number pop | — | one-shot 4f | P1 |
| Monster spawn/despawn poof | — | one-shot 4f | P2 |

### 7J. PvP arena
| Asset | Static tool | Anim | P |
|---|---|---|---|
| Colosseum floor (sand/stone) | `create_topdown_tileset` | — | P1 |
| Arena walls + entrance gates | `create_map_object` | gate open 2f | P1 |
| Spectator stands | `create_map_object` | (P2: crowd bob 2f) | P2 |
| Scoreboard / ranking banner | `create_map_object` | — | P1 |
| Arena torches / victory flames | `create_map_object` | **flame 3f** | P2 |

### 7K. Animals (exist as static — need real frames)
| Asset | Tool | Anim | P |
|---|---|---|---|
| Cow, sheep, chicken, horse | `create_character` (from current art as ref) | **walk 4f + idle 2f** | P1 |

> **Main character: untouched.** No player/hero art in this manifest — the Kingdom
> Heroes compositor renders the farmer, and it stays the source of truth. Emote
> bubbles (for the town-hall "expression" idea) are a separate overhead layer, not
> a change to the avatar — deferred to the social phase.

---

## 8. Generation plan (phased, budget-aware)

Balance today: **1824 generations remaining** (Tier 1). Rough phasing:

| Batch | Contents | ~Assets | When |
|---|---|---|---|
| **B0 Terrain** | 5 Wang sets + grass variants | ~6 jobs | **first — layout-independent, defines the look** |
| B1 Farm+Castle core | soil, windmill, barn/coop/silo, castle exterior, crops | ~20 | after layout sign-off |
| B2 Zones static | shops, greenhouse, fishing dock, ore nodes, arena walls | ~25 | " |
| B3 Actors | animals + 3 monsters (walk/attack/hurt/die) | ~15 (multi-frame) | " |
| B4 Animated objects | windmill, water, torches, flags, portal, fountain | ~12 | polish |
| B5 Effects + furniture + polish | sparks, splashes, furniture set, ambient | ~25 | last |

Terrain (B0) is safe to start **now** because grass/path/water/soil/stone are
needed no matter where zones land. Everything after B0 depends on the map size +
layout being confirmed (so we don't regenerate against a changed grid).

---

---

## 9. Art ownership split — Kingdom vs LashiraBloom (LOCKED per owner)

Two art sources, cleanly divided:

| Owned by **KINGDOM** (whitelisted into Lashira later) | Generated FRESH in **LASHIRA** (this manifest) |
|---|---|
| **Main character / hero avatar** (the compositor rig) | ALL terrain, Wang tilesets, ground variants |
| **All effect / combat animations** (hit sparks, skill FX, damage pops, spell effects, level-up, coin pop) | ALL buildings, castle + furniture, props, decoration |
| | Animated world objects (windmill, water, torches, flags, portal, fountain) |
| | Animals + monsters (walk/attack/hurt/die) |
| | Crops, ore, fishing props, arena/shop/greenhouse structures |
| | UI panels, NPC portraits/expressions |

**Consequence for this doc:** the *effect* rows in §7 (hit spark, dig dust, splash,
harvest sparkle, coin pop, level-up, mining dust, monster poof, etc.) are **Kingdom
-sourced (whitelisted), NOT Lashira-generated** — they're listed for completeness
of the animation map, but drop out of Lashira's generation batches (§8). Everything
else in §7 is Lashira-original, generated from scratch via PixelLab.

> Rationale: Kingdom is the character + FX authority (shared via `@arganta/combat`
> visuals + the compositor). Lashira owns the *world*. Clean seam, no duplication,
> and Lashira's world art is 100% original IP.

---

## 10. Master mechanics matrix (unlock + map EVERYTHING now)

Every mechanic → where it lives → Lashira art → animation → system + authority tier
(§5 of the architecture doc). This is the single "is everything accounted for?" view.

| # | Mechanic | Zone | Lashira art | Animation | System · authority |
|---|---|---|---|---|---|
| 1 | Overworld move/explore | all | terrain, deco, border | — | RoomRuntime · client |
| 2 | Farming (till/plant/water/harvest) | Farm | soil Wang, 6×4 crops, tools | crop stages; watering FX* | FarmModule · timestamp-derived |
| 3 | Greenhouse (all-season) | Hot houses | greenhouse, beds | glass shimmer | FarmModule variant · timestamp |
| 4 | Livestock husbandry | Farm | cow/sheep/chicken/horse | walk 4f + idle 2f | HusbandryModule · timestamp + host-sim |
| 5 | Shipping / selling | Farm (bin), Shops | shipping bin, stalls | lid, awning | ShippingModule · **server-adjudicated** |
| 6 | Fishing | Fishing lake | water, dock, reeds, fish | water 4f, jump 4f, bobber | FishingModule · timestamp + server catch |
| 7 | Mining | Mining | rock Wang, ore ×4, cart | gem glint; dust FX* | MiningModule · timestamp + **server claim** |
| 8 | Dungeon (instanced PvE) | Dungeon gate | gate, cave floor | portal swirl 4f | DungeonModule · instance + **server loot** |
| 9 | PvE combat | Battleground | monsters ×3 | walk/attack/hurt/die | CombatModule (`@arganta/combat`) · host-sim + server loot |
| 10 | PvP duels + ranking | PvP arena | colosseum, walls, board | gate, flames | PvpModule · **server-adjudicated** + season ladder |
| 11 | Shops / vendors | Shops | 5 shop buildings, signs | sign sway, smoke | ShopModule · server purchase |
| 12 | House/castle upgrade | Castle | 5 tiers (→castle) | door, banners | HouseModule · **server purchase** |
| 13 | Castle interior + furniture | Castle interior (Room) | floor/wall, ~14 furniture | fireplace 3f | PlacementModule · server purchase + grid snap |
| 14 | Kin deployment (Harvest Sprites) | Farm/overworld | (Kin art — Lashira or shared) | idle/task | KinModule · owner-sim |
| 15 | Mounts (travel) | overworld | (mount — Kingdom rig) | Kingdom | reuse · owner-sim |
| 16 | Quests / notice board | Shops/Castle | board prop | — | QuestModule · server |
| 17 | Town-hall social + expressions | plaza/shops | NPCs, portraits, emote bubbles | portrait moods; emote 3f | SocialModule · presence + emote intent |
| 18 | Progression (XP/level) | all | (HUD) | — | Kingdom XP RPC (adult-play/kid-learn) |
| 19 | Economy (Bloom / 💎 wall) | all | currency icons, HUD | coin pop* | ledger · **server, schema wall** |
| 20 | Multiplayer presence | all | nameplates | — | `farm-presence.js` · circle shard |
| 21 | Seasons / festivals (later) | Town/plaza | seasonal tints, festival props | banners | LiveOps · server |

\* = effect animation → **Kingdom-whitelisted** (§9), not Lashira-generated.

**Everything the owner listed is present:** mining(7) · farm(2) · husbandry/"cow
ships"(4,5) · PvP(10) · PvE(9) · town hall+expressions(17) · house/castle
upgrade(12,13) · original pixel art(all Lashira rows) · dungeon(8) · shops(11) ·
hot houses(3) · fishing(6) · battleground(9) · castle-only-interior(13).

---

## 11. What's missing to SCALE this up later (gaps to design in now)

The one-map MVP works, but these are the systems that must exist for it to scale
past the MVP. **Design the seams now even if built later** — retrofitting them is
expensive. Ranked by how load-bearing they are:

1. **Map as DATA, not code (+ a Bloom Command editor).** Today collision/layout is
   built procedurally in `farm-map.js` (hardcoded rects + `blocked` Set). A 60×48,
   10-zone world must become a **tilemap data format** (rows/JSON: layer, tile, x,
   y, collision, interactable) that the engine renders and Bloom Command edits.
   Without this, every map tweak is a code change and the map can't grow. **Biggest gap.**
2. **Depth sort (y-sort) + overhead layer.** Tall objects (castle, trees, roofs)
   need per-actor draw-order by foot-Y, and an **overhead layer** the player walks
   *under* (behind the castle, under tree canopies). The current flat draw won't
   read correctly with big buildings.
3. **Viewport culling + proximity-LOD** (§6). Draw/simulate only what's near the
   player. The scalability core — without it, 21 mechanics in one scene will chug.
4. **Texture atlas + manifest loader.** 100+ generated PNGs shouldn't be 100
   fetches / draw-calls. Pack into atlases; load via a manifest. Needed before the
   asset count climbs.
5. **Room/portal + instancing.** Castle interior = Room #1 (now); dungeon =
   instanced Rooms (later). The transition system generalizes today's arena gate.
6. **Server-adjudication tier + append-only ledgers.** For every value/contest
   event (sell, mine, loot, PvP, purchase). The anti-cheat spine (architecture §5.3).
7. **Chunked background bake.** Escape hatch for the iOS 4096px canvas cap if the
   map grows past ~72×56. Not needed at 60×48, but design the bake to be chunkable.
8. **Animated-terrain per-frame layer** (§4). Water/portal/lava can't be baked.
9. **Unified interactable registry.** One "what's tappable at tile X" lookup across
   crops/animals/ore/fish/shops/NPCs, so `tapAt` scales beyond farming.
10. **Basic pathfinding (A\*)** for NPC/Kin task-walking across a big map (current
    actors wander randomly; fine for pens, not for a town).
11. **Placeable-furniture save schema** (per-object position/rotation) for the
    castle interior — a new state shape the sync spine must carry.

**Bottom line:** nothing here blocks the MVP, but items **1, 2, 3** especially
should shape the build from day one — they're cheap to design in and painful to add
later. The rest can land as each mechanic comes online.

---

---

## 12. Layout v2 (supersedes §2.5) — farm biggest, animals = farm, greenhouse small

Owner revisions: **farm is the biggest zone; cow+sheep+chicken pens COMBINED equal
the farm's size; greenhouse is a small (upgradeable) house.** Castle stays exactly
centered.

| Zone | Tiles x0–x1, y0–y1 | Size | Note |
|---|---|---|---|
| **FARM** (biggest) | 2–25, 2–18 | 24×17 = **408** | largest single zone |
| **ANIMAL PENS** (cow\|sheep\|chick) | 34–57, 2–18 | 24×17 = **408** | = farm size; 3 columns ~8×17 each |
| Castle north approach (path) | 26–33, 2–18 | 8×17 | aligns to castle width |
| **CASTLE** (centered) | 26–33, 20–27 | 8×8 | unchanged, dead center |
| Plaza + Shops ring | 22–37, 18–31 | — | shops = buildings on plaza edge |
| Fountain | 29–30, 18 | 2×1 | plaza centerpiece |
| **GREENHOUSE** (small, upgradeable) | 3–9, 20–27 | ~7×8 | building ~3×3; grows with tier |
| Fishing lake | 2–18, 29–45 | 17×17 | SW |
| Mining + dungeon | 40–57, 20–31 | 18×12 | dungeon gate 52–55, 21–24 |
| Arena wall (+ gate 28–29) | y=32, x15–57 | — | upgradeable (unlocks PvP/dungeon) |
| Battleground (PvE) | 20–39, 33–45 | 20×13 | |
| PvP arena | 41–57, 33–45 | 17×13 | |

```
     x:0   2         25 26  33 34         57 59
        ┌────────────── TREE BORDER ───────────────┐ y0
        │ ┌─── FARM (biggest) ───┐║║┌ ANIMAL PENS ─┐│ y2
        │ │ x2–25 y2–18  =408    │║║│ x34–57 =408   ││
        │ │                      │║║│ cow|sheep|chik││
        │ └──────────────────────┘║║└──────────────┘│ y18
        │ ┌GREENH┐  ╔══ PLAZA+SHOPS ══╗              │ y18
        │ │x3–9  │  ║  ╔═══════════╗  ║ ┌─ MINING ─┐ │ y20
        │ │small │  ║  ║  CASTLE   ║  ║ │ x40–57   │ │
        │ │upgrd │  ║  ║ x26–33 ★  ║  ║ │ y20–31   │ │
        │ └──────┘  ║  ╚═══════════╝  ║ │ ▼DUNGEON  │ │ y27
        │ ┌FISHING┐ ╚═══ shops ═══════╝ └──────────┘ │ y31
        │ │x2–18  │══ ARENA WALL + GATE(28,32) ══════│ y32
        │ │y29–45 │┌ BATTLEGROUND ─┐┌── PvP ARENA ─┐ │ y33
        │ └───────┘│ x20–39 y33–45 ││ x41–57 y33–45│ │
        │          └───────────────┘└──────────────┘ │ y45
        └────────────── TREE BORDER ───────────────┘ y47
```

---

## 13. Economy — 💎 Diamond currency + 3 shared materials (leader-gated)

**Currency: 💎 Diamonds only** (buy/sell). **Upgrades cost Diamonds + materials:**
🪵 Wood · 🪨 Stone · 🥇 Gold. All four are a **shared circle stockpile**. **Only the
circle leader/owner may spend them** — to upgrade structures OR decorate the
castle-dungeon interior. Members gather + contribute; the leader builds.

**Gather → build loop** (this is what closes the earlier "orphaned mining" gap —
every zone now feeds progression):

| Resource | Source | Authority |
|---|---|---|
| 🪵 Wood | **Forestry** — chop trees (§18) | timestamp respawn + server claim |
| 🪨 Stone | Mining — rock/boulder nodes | timestamp respawn + server claim |
| 🥇 Gold | Mining — gold ore (rarer) | timestamp + tool-tier gate + server claim |
| 💎 Diamond | Sell produce/fish/ore + (kids) learning | server ledger |

Overrides the two-currency Bloom wall in `buildplan.md §2`.

---

## 14. Upgrade popups (Diamond-gated) — text sketches

Four upgradeable structures. Each tap → a Diamond upgrade popup (UI: `create_ui_asset`
frame + `Panels.jsx`):

```
╔═══════ EXPAND FARM ═══════╗   ╔════ UPGRADE GREENHOUSE ════╗
║ 🌾 Farm  Lv2 → Lv3        ║   ║ 🪟 Greenhouse  Lv1 → Lv2   ║
║ Plots:  24 → 40 (+16)     ║   ║ Beds: 4 → 8 · all-season   ║
║ ─────────────────────     ║   ║ +heated (winter crops)     ║
║ Cost:  💎 250             ║   ║ Cost:  💎 400              ║
║ [ Upgrade ]   [ Close ]   ║   ║ [ Upgrade ]   [ Close ]    ║
╚═══════════════════════════╝   ╚════════════════════════════╝

╔══════ UPGRADE HOME ═══════╗   ╔═══ FORTIFY ARENA WALL ════╗
║ 🏰 Homestead → CASTLE      ║   ║ 🧱 Wall  Tier1 → Tier2     ║
║ FINAL evolution!           ║   ║ Unlocks PvP ranked ladder  ║
║ Rooms 4→8 · Storage 60→200 ║   ║ +Dungeon gate access       ║
║ +Trophy hall               ║   ║ +Tougher PvE spawns/loot   ║
║ Cost:  💎 5000            ║   ║ Cost:  💎 1500            ║
║ [ Upgrade ]   [ Close ]    ║   ║ [ Upgrade ]   [ Close ]    ║
╚═══════════════════════════╝   ╚═══════════════════════════╝
```

---

## 15. Shop / market "what it sells" popups

Tap a shop building → a vendor popup listing stock + Diamond prices (no NPC needed
for MVP; building + popup):

```
╔═══════ SEED SHOP ═════════╗   ╔══════ ANIMAL SHOP ════════╗
║ 🌱 Sprout's Seeds         ║   ║ 🐮 Willa's Livestock      ║
║ 🥬 Turnip seed     💎 5   ║   ║ 🐄 Cow            💎 300  ║
║ 🥕 Carrot seed     💎 8   ║   ║ 🐑 Sheep          💎 250  ║
║ 🍓 Strawberry      💎 15  ║   ║ 🐔 Chicken        💎 120  ║
║ 🎃 Pumpkin         💎 20  ║   ║ 🌾 Feed ×10       💎 10   ║
║ [ Buy ]        [ Close ]  ║   ║ [ Buy ]        [ Close ]  ║
╚═══════════════════════════╝   ╚═══════════════════════════╝

╔═══ GENERAL STORE ═════════╗   ╔═══ BLACKSMITH ════════════╗
║ 🏪 Hazel's Goods          ║   ║ ⚒ Forge's Tools           ║
║ 🪣 Watering can    💎 40  ║   ║ ⛏ Pickaxe Lv2     💎 200 ║
║ 🎣 Fishing rod     💎 60  ║   ║ 🪓 Axe Lv2        💎 180  ║
║ 📦 Storage chest   💎 80  ║   ║ ⚔ Sword Lv2       💎 350  ║
║ [ Buy ]        [ Close ]  ║   ║ [ Upgrade ]    [ Close ]  ║
╚═══════════════════════════╝   ╚═══════════════════════════╝
```
(5th shop = Cosmetics/Bank, 💎-only cosmetics + storage.)

---

## 16. Castle evolution — 5 tiers, exterior + interior (the progress you'll see)

The home evolves Shack → Cottage → Farmhouse → Manor → **Castle**. Each upgrade swaps
the exterior sprite AND unlocks more interior (a bigger interior Room + more placeable
slots). Exterior grows in footprint; interior grows in rooms/furniture capacity.

```
 TIER 1 — SHACK (2×2)        TIER 2 — COTTAGE (3×3)      TIER 3 — FARMHOUSE (4×3)
   ▛▀▀▜  small hut             ▛▀▀▀▜  +chimney            ▛▀▀▀▀▜  +2nd window
   ▌🚪▐                        ▌🪟🚪▐                      ▌🪟🚪🪟▐  bigger roof
   ▙▄▄▟                        ▙▄▄▄▟                      ▙▄▄▄▄▟
  interior: 1 room            interior: 2 rooms          interior: 3 rooms
   ┌─────┐                     ┌───────┐                  ┌─────────┐
   │🛏 📦│                     │🛏 🔥  │                  │🛏 🔥 🍳 │
   └─────┘                     │🍳 🪑  │                  │🪑 📦 🖼 │
   bed, chest                  └───────┘                  └─────────┘
                               +stove, table              +kitchen, rug, painting

 TIER 4 — MANOR (6×4)                 TIER 5 — CASTLE (8×8)  ★ FINAL
   ▛▀▀▀▀▀▀▜  two floors                 ╔═▛▀▀▀▀▀▀▀▀▜═╗  towers + banners
   ▌🪟🪟🚪🪟▐  balcony                   ║▌🏳🪟🚪🪟🏳▐║  portcullis gate
   ▙▄▄▄▄▄▄▟                             ╚═▙▄▄▄▄▄▄▄▄▟═╝
  interior: 5 rooms                    interior: 8 rooms + grand hall
   ┌───────────┐                        ┌───────────────────┐
   │🛏 🛏 🔥 🍳│                        │  👑 THRONE  🏆🏆   │  trophy hall
   │🪑 📦 📦 🖼│                        │🛏🛏 🔥🔥 🍳 📦📦📦 │  big storage
   └───────────┘                        │🪑🪑 🖼🖼 🪴 🕯🕯   │  decorate freely
   +2nd bedroom, big storage            └───────────────────┘
```

Furniture unlocked scales per tier (placeable slots: T1≈2 → T5≈20+). The full
placeable set is §7C.

---

## 17. MASTER COMPONENT TABLE — every asset, tool, count (single table)

**L = LashiraBloom (generate fresh) · K = Kingdom (whitelist later).** Qty = distinct
sprites/sheets. Multi-frame (animals/monsters) cost more generations each.

| Category | Component | PixelLab tool | Qty | Animation | Src |
|---|---|---|---|---|---|
| Terrain | Base grass Wang set | topdown_tileset | 1 | — | L |
| Terrain | Grass variants (clover/pebble/flower/plain) | tiles_pro | 4 | — | L |
| Terrain | Grass↔path Wang | topdown_tileset | 1 | — | L |
| Terrain | Grass↔tilled-soil Wang | topdown_tileset | 1 | — | L |
| Terrain | Grass↔water shore Wang | topdown_tileset | 1 | shimmer opt | L |
| Terrain | Grass↔sand Wang | topdown_tileset | 1 | — | L |
| Terrain | Stone/cave floor Wang | topdown_tileset | 1 | — | L |
| Deco | Border trees | map_object | 3 | — | L |
| Deco | Bushes / rocks / stump | map_object | 5 | — | L |
| Deco | Flower clumps / grass tufts | map_object | 5 | — | L |
| Deco | Fence straight/corner/gate | map_object | 3 | gate 2f | L |
| Deco | Zone signposts | map_object | 3 | — | L |
| Deco | Plaza fountain | map_object | 1 | water 4f | L |
| Farm | Crops 6 × 4 growth stages | 1_direction_object | 24 | staged | L |
| Farm | Barn / coop / silo | map_object | 3 | — | L |
| Farm | Windmill | map_object | 1 | blades 6f | L |
| Farm | Scarecrow / shipping bin / tool rack | map_object | 3 | sway·lid | L |
| Animals | Cow / sheep / chicken | character+animate | 3 | walk4 + idle2 | L |
| Animals | Feed + water trough | map_object | 2 | — | L |
| Animals | Produce icons (milk/wool/egg) | map_object | 3 | — | L |
| Animals | Horse / mount | — | (1) | — | **K** |
| Greenhouse | Exterior × 3 tiers | map_object | 3 | — | L |
| Greenhouse | Interior beds | map_object | 1 | — | L |
| Greenhouse | Glass shimmer | animate_object | 1 | 3f | L |
| Shops | Shop buildings × 5 | map_object | 5 | — | L |
| Shops | Market stalls × 2 | map_object | 2 | awning 2f | L |
| Shops | Shop signs × 5 | map_object | 5 | sway 3f | L |
| Fishing | Dock / pier | map_object | 1 | — | L |
| Fishing | Reeds / cattails / lily | map_object | 3 | sway 3f | L |
| Fishing | Fish × 3 species | map_object | 3 | jump 4f | L |
| Fishing | Bobber / bucket | map_object | 2 | ripple 4f | L |
| Mining | Ore nodes × 4 (copper/iron/gold/gem) | map_object | 4 | gem glint 3f | L |
| Mining | Boulders / rubble / beams | map_object | 3 | — | L |
| Mining | Mine cart + tracks | map_object | 2 | roll 4f | L |
| Mining | Dungeon gate | map_object | 1 | portal 4f | L |
| Mining | Gate torches | map_object | 1 | flame 3f | L |
| PvE | Monsters × 3 (slime/bat/blob) | character+animate | 3 | walk4+atk4+hurt2+die4 | L |
| PvE | Dead trees / bones / war banner | map_object | 4 | banner 3f | L |
| PvP | Arena walls × 2 tiers | map_object | 2 | — | L |
| PvP | Entrance gate / stands / scoreboard | map_object | 3 | gate 2f | L |
| PvP | Arena torches | map_object | 1 | flame 3f | L |
| Castle | Home/castle exteriors × 5 tiers | map_object | 5 | — | L |
| Castle | Banners / flags × 2 | map_object | 2 | wave 4f | L |
| Castle | Torches / door | map_object | 2 | flame·open | L |
| Castle | Interior tilesets × 2 (cottage + grand) | topdown_tileset | 2 | — | L |
| Castle | Placeable furniture set | map_object | 14 | fireplace 3f | L |
| UI | Upgrade + shop popup frames | ui_asset | 2 | — | L |
| UI | Button set | ui_asset | 1 | — | L |
| UI | Emote bubbles (town-hall expressions) | map_object | 6 | — | L |
| UI | NPC portraits × 8 (with moods, later) | portrait_character | 8 | mood variants | L |
| UI | Diamond currency icon | — | (1) | — | **K** |
| FX | All effects (spark/dust/splash/poof/…) | — | (—) | one-shots | **K** |
| Character | Main hero avatar | — | (—) | all | **K** |

**Totals — LashiraBloom to generate: ≈ 161 distinct assets.**
Kingdom-sourced (whitelist later): main character, all effect animations, mount, diamond icon.

Generation-cost note: the ~15 animal/monster **character** sheets are multi-frame
(highest cost); the ~120 `map_object`/`tiles`/`ui` assets are cheap/fast. All fit
inside the 1,824-generation balance with room to spare, generated in the §8 batches.

---

---

## 18. Forestry + mining action = the PLAYER ATTACK animation (no new char art)

Gathering reuses the hero's **attack animation** (owned by Kingdom), so the main
character is never touched:

- **Forestry:** trees are choppable. Chop = player attack swing (Kingdom) + wood-chip
  FX (Kingdom). Tree has HP → falls → **stump** → regrows on a timestamp. Yields 🪵.
- **Mining:** mine rock/ore = same attack swing + dust FX (Kingdom). Yields 🪨 / 🥇.

**New art this adds is tiny:** a tree **stump**, a **wood-log pile**, and 3 **material
icons** (🪵/🪨/🥇). The swings + impact FX are all Kingdom-whitelisted. Node depletion
is timestamp-derived; the material→stockpile grant is **server-adjudicated** (can't
forge quantities).

### Upgrade costs (with materials — supersedes §14's diamond-only figures)

```
FARM       Lv2→3 :  🪵40  🪨20              💎250     (leader only)
GREENHOUSE Lv1→2 :  🪵30  🪨30  🥇5         💎400     (leader only)
ARENA WALL T1→2  :  🪨200 🥇20              💎1500    (leader only)
CASTLE  Home→Castle: 🪵500 🪨400 🥇100      💎5000    (leader only)
                    ↑ also DEEPENS the castle-dungeon (§19)
```

---

## 19. Castle interior = a DUNGEON (schema) — unifies §7C + §7.8

The castle interior **is a dungeon**. Entering the castle door → the dungeon Room.
Higher castle tier → deeper dungeon (more floors/rooms), so upgrading the castle is
both a home upgrade AND a dungeon expansion. `home`/cleared rooms are decoratable
(leader-only); `combat` rooms are PvE (`@arganta/combat`); a `boss` sits at the
bottom. This merges "castle interior + furniture" and "dungeon system" into one
schema.

```sql
dungeon      (id, circle_id, castle_tier, floors, seed, state)
dungeon_floor(dungeon_id, floor_no, layout_seed, cleared, boss_kind)
dungeon_room (floor_id, x, y, kind ∈ home|combat|treasure|rest|boss, cleared)
dungeon_spawn(room_id, monster_kind, count)             -- PvE, shared combat rules
dungeon_loot (room_id, roll_seed, drops_json)           -- SERVER-rolled (never client)
dungeon_decor(room_id, item_id, x, y, rot, by_leader)   -- leader-placed furniture
```
- **Instancing:** per-circle party run; loot server-rolled; access gated by wall tier
  (§14) and/or rings.
- **Castle tier → `floors`/room count** — the material sink pays off in dungeon depth.

---

## 20. Actor sizing (consistent) vs building stylization (just "make sense")

**Actors share one perspective + pixel density** so they sit together believably —
same 3/4 top-down angle, same foot-shadow baseline:

| Actor | Target sprite px (TILE=48) | Relative to player |
|---|---|---|
| **Player** (Kingdom) | ~32×44 | 1.0 (reference) |
| Cow | ~48×40 | bulky, same scale |
| Sheep | ~40×36 | slightly smaller |
| Chicken | ~22×24 | ~half height |

**Buildings are NOT to scale** — stylized "hero-sized" per genre convention (a house
towers over a person; that's normal in Stardew-likes). Just readable + sensible:

| Building | Footprint |
|---|---|
| Shack → Cottage | 2×2 – 3×3 |
| Farmhouse → Manor | 4×3 – 6×4 |
| **Castle** | 8×8 |
| Shops / barn / coop | 3×3 / 3×2 |
| Greenhouse (grows w/ tier) | 2×2 → 4×4 |

Rule: **actors consistent; buildings stylized-bigger, make-sense-not-proportional.**

---

## 21. Permissions (circle roles)

| Action | Leader / Owner | Member |
|---|---|---|
| Play all mechanics (farm/fish/mine/chop/fight) | ✅ | ✅ |
| Gather → shared material stockpile | ✅ | ✅ |
| **Upgrade** farm/greenhouse/castle/wall | ✅ | ❌ |
| **Decorate** castle-dungeon (place/move furniture) | ✅ | ❌ |

Enforced server-side by a `circle_role` check on the upgrade + decor RPCs.

---

## 22. Deltas to earlier sections (this revision)

- **Mechanics matrix (§10):** +**Forestry** (chop→wood, attack anim); **Dungeon(8)**
  now = the **castle interior** (§19); **Economy(19)** = Diamonds **+ 3 materials**,
  leader-gated.
- **Master table (§17):** +**stump**, +**wood-log pile**, +**3 material icons**
  (🪵/🪨/🥇) → **≈ 165 Lashira assets**. Mining/forestry **action animation =
  Kingdom (attack)**, so no new player frames.
- **Upgrade popups (§14):** costs now include materials (§18); all leader-only.

---

---

## 23. Finalized MVP decisions (owner-confirmed 2026-07-07)

1. **Scope: ALL 21 mechanics present but shallow** in the single map — the point is to
   validate performance + scalability across *everything* at once (the stated goal).
   Each mechanic deepens post-MVP. → prioritise the §6 culling/LOD work early.
2. **Timing: MINUTES.** Crops ripe in ≤5 min (kept hydrated); trees + ore respawn in
   minutes. A young tester plants/gathers/harvests in one sitting.
3. **Kid economy: LEARNING-GATED.** Kids earn 💎 **only by learning** the 6 Worlds;
   playing gives **materials + mastery**, not diamonds. Adults mint 💎 by play (capped).
   This reconciles the diamond-only currency with "learning is the gate."
   - **Resolves the son-won't-spend problem:** kids play freely — gathering shared
     materials, fighting, farming, earning mastery — with **zero 💎 drain**. The
     leader funds upgrades; learning mints the 💎. Playing never costs the kid their
     learning currency.
4. **Dungeon: CIRCLE CO-OP, GENTLE.** Party with circle members; on defeat you exit
   and **keep loot gathered so far**; no harsh penalty. Social + kid-safe.

**Economy (FINALIZED):**
- 🪵🪨🥇 **Materials** = **shared circle stockpile** — anyone gathers/fills it (kids
  included, by playing).
- 💎 **Diamonds** = **individual wallet**. Earned: adults by play (capped), kids by
  **learning only**.
- **Structure upgrades** (farm/greenhouse/castle/wall) = **leader-only**; the 💎
  portion comes from the **leader's own wallet**, the material portion from the
  **shared stockpile**.
- **Cosmetics** = individual (own 💎).
- **Tools = TIERED** (blacksmith sells pickaxe/axe upgrades for materials + 💎):
  Tier-1 = stone + soft wood; **Tier-2 required for gold/gems + hard wood.** Gives
  the blacksmith purpose + a gathering-progression ladder.
- **Seeds/feed** = low cost; recommend free-starter / leader-stocked so a
  learning-gated kid is never blocked (minor — confirm at build).
- **PvP = EVERYONE, gentle** — kids may duel; friendly season ladder; **never mints
  💎** (learning wall stays intact).

### Finalized-round deltas
- **Mechanics matrix (§10):** PvP(10) → **everyone, gentle, no 💎 stakes**;
  Mining(7)/Forestry now **tool-tier gated** for gold/gems + hard wood.
- **Master table (§17):** tool tiers = blacksmith stock (already listed); no new art
  beyond §22's stump + log + 3 material icons. Total stays **≈ 165**.

---

*End. Concept + manifest only — nothing built, no generation fired yet.*
