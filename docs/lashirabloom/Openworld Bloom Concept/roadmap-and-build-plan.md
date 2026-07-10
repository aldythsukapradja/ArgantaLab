# LashiraBloom Roadmap + Build Plan

Status: planning/build roadmap, no implementation in this document. Created 2026-07-10.

Companions:

- [`architecture-spine-and-world-builder-design.md`](./architecture-spine-and-world-builder-design.md)
- [`openworld-stronghold-command-architecture.md`](./openworld-stronghold-command-architecture.md)
- [`resource-economy-command-center-plan.md`](./resource-economy-command-center-plan.md)
- [`portal-hotspot-plan.md`](./portal-hotspot-plan.md)
- [`parallel-game-realm-matrix.md`](./parallel-game-realm-matrix.md)
- [`retention-pillar-research.md`](./retention-pillar-research.md)
- [`shared-game-shell-component-strategy.md`](./shared-game-shell-component-strategy.md)

## 1. Build thesis

Do not build a world map first.

Build the Kingdom as the launch hub:

1. Wire every portal hotspot on the current basemap.
2. Add a reusable realm-launch shell.
3. Generate realm basemaps at the same canvas size as the current basemap.
4. Make one scalable playable realm first.
5. Add every future realm through the same registry, reward contract, and HQ controls.

Current basemap dimensions:

```text
1394 x 1128 px
```

All generated realm basemaps should use this exact output size unless the engine changes.

Visual hub plan:

- [`portal-hotspots-pillar-map.png`](./portal-hotspots-pillar-map.png)

## 2. Today's target

The realistic "today" foundation should be:

| Target | Definition of done |
|---|---|
| All hotspots wired | Every planned portal has a stable ID, tile rect, return spawn, launch modal, and placeholder realm route |
| Shared shell locked | Top-left character/resources, top-right settings, bottom-left location, bottom-right controller all use shared components |
| Realm registry started | Realms exist as data rows/config, not one-off hardcoded buttons |
| Reward contracts started | Each realm declares adult/kid reward rules; kids blocked from Character XP and Diamonds |
| Basemap prompts ready | Every realm has a generation prompt with exact `1394x1128` dimension |
| One working scalable game | Tower Defense MVP recommended first; Cooking Rush next or parallel if time allows |
| HQ plan aligned | World Builder controls portals, realms, stronghold, rewards, events, analytics |

Important distinction:

- `Wired hotspot` means the player can open a portal modal and enter either a playable MVP or a "coming soon" realm shell.
- `Playable realm` means the actual game loop works.

This keeps the hub scalable without pretending every full game can be finished in one pass.

## 2b. Today's to-do list

Start from art/map foundation, then wire the player-facing shell:

| Order | Task | Output |
|---|---|---|
| 1 | Approve the five pillar names and hotspot locations | Final portal naming table |
| 2 | Generate or approve the five pillar basemap prompts | Basemap prompt set ready for image generation |
| 3 | Create placeholder basemap files/folders for each pillar | `public/farm-art/realms/<realm_id>/basemap.png` convention |
| 4 | Add `portal-hotspots-pillar-map.png` as visual reference | Operator can see where each portal/resource zone is |
| 5 | Create portal registry data | `portal_id`, hotspot rect, return spawn, status, realm link |
| 6 | Create realm registry data | five pillars + resource zones as config |
| 7 | Lock shared four-corner shell component contract | Same HUD architecture for all realms |
| 8 | Wire all portal hotspots to one reusable launch modal | Character can wander the current basemap and open each portal |
| 9 | Add coming-soon realm shell | Every portal can route somewhere even before the game is built |
| 10 | Add dev overlay toggle | Shows portal rectangles and IDs on the playable map |
| 11 | Verify player movement still works on top of the current basemap | Main foundation acceptance test |
| 12 | Start first playable MVP: Bloomwall Pass | Tower-defense/adventure runtime begins |
| 13 | Start second playable MVP: Hearthrush Kitchen | Cooking runtime begins after portal shell works |

## 3. Roadmap phases

### Phase 0 — Foundation

| Work | Notes |
|---|---|
| Portal data registry | Move portal definitions into a single data file/registry |
| Realm data registry | Define each game mode: id, name, status, runtime, rewards, multiplayer |
| Launch modal | One reusable modal for every portal |
| Return spawn | Store and restore the player near the portal after a realm exits |
| Placeholder realm shell | Coming-soon screen with realm art, reward preview, and status |
| Compliance guard | Kids cannot receive Character XP or Diamonds from game actions |

### Phase 1 — Basemap + portal wiring

| Work | Notes |
|---|---|
| Generate basemaps | Use prompts in section 7 |
| Add basemap manifest | Realm ID -> image file -> collision/hotspot notes |
| Wire all portal hotspots | Castle, South Gate, Market/Kitchen, Dungeon, Fountain, Arena, Dock, Greenhouse, Outpost |
| Add dev overlay | Show portal rectangles and realm IDs |
| Add launch modals | Confirm before leaving the Kingdom |

### Phase 2 — First playable pillar: Bloomwall Pass

| Work | Notes |
|---|---|
| `bloomwall_pass` runtime | One defense/adventure map, 10 waves, 4 tower types |
| Hero participation | Player can use one skill or basic attack during waves |
| Rewards | Bloom, Stone, Ore, Tower Blueprints, score |
| Kid rules | Kids get resources/score only, no Character XP/Diamonds |
| Scaling seam | Waves/towers/enemies/rewards come from tuning data |

Why first:

- Directly serves the stronghold fantasy.
- Uses current combat/monster art.
- Creates a useful sink/source loop.
- Easy to expand by adding maps/waves/towers.

### Phase 3 — Second playable pillar: Hearthrush Kitchen

| Work | Notes |
|---|---|
| `hearthrush_kitchen` runtime | Dinner Dash / Overcooked-like kitchen service |
| Stations | Prep, cook, plate/serve |
| Orders | Customers request simple recipes |
| Rewards | Meals, Bloom, Cooking mastery, city happiness/service progress |
| Consumes | Food ingredients, recipe tickets if needed |
| Scaling seam | Recipes, timers, stations, customers, rewards from tuning data |

Why second:

- Makes Food active, not just a stored resource.
- Supports Simple City happiness and service loops.
- Kid-safe and family-friendly.
- Strong retention because recipes/events/restaurant skins scale well.

### Phase 4 — Circle HQ World Builder

| Work | Notes |
|---|---|
| World Builder shell | New Build rail surface |
| Overview | Live realms, warnings, economy health |
| Portals | Hotspot editor and portal status |
| Realms | Registry and lifecycle controls |
| Rewards | Reward contract matrix and kid/adult validation |
| Analytics | Entries, completion, retention, resource output, skin conversion |

### Phase 5 — Stronghold / City Builder

| Work | Notes |
|---|---|
| District model | Farm, Market, Kitchen, Academy, Defense, Workshop, Housing, Garden |
| City stats | Population, happiness, safety, culture, knowledge, prosperity |
| Upgrade costs | Wood, Stone, Food, Bloom, Blueprints |
| Skin slots | City theme, building skins, road skins, banners |

### Phase 6 — Expand realm portfolio

| Realm | Build after |
|---|---|
| Dungeon Gate | After Tower Defense combat proves stable |
| Fishing Run | Low-complexity cozy loop |
| Garden Puzzle | Good event/casual retention |
| PvP Arena | After live multiplayer polish |
| Outpost Builder | After city/tower systems stabilize |
| Warline Camp | After formation/combat tuning exists |
| Rival Yard | Last among the core modes because real-time PvP/shooter is highest risk |

## 4. Hotspot build list

| Portal ID | Game | Hotspot | First runtime |
|---|---|---|---|
| `lashira_keep` | Lashira Keep | Castle `x27-32, y21-26` | Placeholder first, city/stronghold later |
| `bloomwall_pass` | Bloomwall Pass | South Gate `x28-31, y32-33` | Playable MVP first |
| `hearthrush_kitchen` | Hearthrush Kitchen | Market `x29-30, y16-17` | Playable second |
| `fountain_festival` | Fountain Festival | Fountain `x14-16, y26-29` | Placeholder first, event/puzzle later |
| `emberring_arena` | Emberring Arena | Arena center `x47-48, y37-39` | Existing PvP route / placeholder shell |

## 5. Character/art builder requirement

Do not create a separate character builder for every game.

Use one Character Forge plus realm-specific slots:

| System | Purpose |
|---|---|
| Character Forge | One shared avatar, path/class, equipped skin set |
| Realm skin slots | Tower skin, kitchen outfit, weapon skin, city worker outfit, PvP frame |
| Pixel Vault | Shared art catalog, sprite sheets, basemaps, effects, icons |
| Realm Art Packs | Per-game art bundles: towers, kitchen props, dungeon props, customers, enemies |
| XP/HP/MP Curves | Controlled centrally, not per game |
| Realm Tuning | Each game controls local difficulty/rewards, not global character power |

Circle HQ should manage:

- character looks
- realm-specific cosmetics
- monster/customer/tower sprites
- basemap files
- reward contracts
- XP policies
- HP/MP curves
- realm tuning

## 6. Consistency rules

| Area | Rule |
|---|---|
| Basemap size | Every realm basemap starts at `1394x1128` |
| Style | Same cozy top-down Lashira pixel style |
| UI | No UI/text/labels baked into basemaps |
| Characters | No player/NPC characters baked into basemaps unless explicitly decorative/statue |
| Collision | Basemap art is visual; collision/hotspots live in data |
| Resources | Reuse Bloom, Wood, Stone, Food, Ore, Relics, Blueprints, Tokens |
| Diamonds | Skins only |
| Kids | No gameplay XP/Diamonds |
| Scaling | Add maps/waves/recipes/levels through data, not custom code branches |

## 7. Basemap generation prompts

Use these for image generation or art-direction handoff. All prompts require exact output size:

```text
1394 x 1128 px
```

Global negative prompt for every basemap:

```text
No UI, no labels, no text, no numbers, no character sprites, no player avatar, no red outlines, no selection boxes, no watermark, no logo, no speech bubbles, no isometric camera, no dark horror tone, no photorealism.
```

Global style anchor:

```text
Cozy-cute fantasy pixel art basemap, same style as LashiraBloom kingdom hub, bright saturated but soft palette, top-down 3/4 RPG farm-game perspective, readable tile-like layout, painterly pixel detail, lush nature borders, warm paths, clean navigable spaces, kid-safe, no UI. Exact canvas 1394x1128 px.
```

### 7.1 Bloomwall Pass — Defense / Adventure

```text
Create a cozy-cute fantasy pixel art basemap for LashiraBloom Bloomwall Pass, exact canvas 1394x1128 px. Same style, camera, scale, and lighting as the LashiraBloom kingdom hub basemap. Scene: a fortified south gate outside the kingdom wall that can support tower defense, lane battle, and light dungeon/adventure encounters. Include one clear winding dirt road from the upper-left forest entrance to a glowing Bloom Core near the lower-right gate, 8-12 obvious tower pads beside the path, small stone walls, banners, flowers, lamp posts, a side cave/ruin entrance for boss adventures, and friendly woodland terrain. No towers placed yet. Leave readable open areas for enemies to walk. Bright, warm, kid-safe, no UI, no text, no characters.
```

### 7.2 Hearthrush Kitchen — Cooking / Service

```text
Create a cozy pixel art restaurant kitchen basemap for LashiraBloom Hearthrush Kitchen, exact canvas 1394x1128 px. Same bright top-down 3/4 pixel style as the LashiraBloom kingdom hub. Scene: a warm tavern-market kitchen connected to a small serving hall. Layout must be readable for a Dinner Dash / Overcooked-like game: ingredient pantry on left, prep counters, cooking stoves, plating counter, serving window, 6-8 customer tables on the right, dish return area, and clear walking lanes between stations. Use warm lantern light, wood counters, colorful food crates, clean cozy medieval-farm kitchen style. No UI, no text, no characters.
```

### 7.3 Lashira Keep — Stronghold / City

```text
Create a cozy fantasy pixel art city-builder basemap for LashiraBloom, exact canvas 1394x1128 px. Same style and scale as the kingdom hub. Scene: the castle at the center with empty district plots around it, connected by soft stone roads. Include clearly separated build zones for farm district, market district, kitchen district, academy district, defense district, workshop district, housing district, and garden district. Each district should have an empty foundation pad or sign-like landmark shape but no labels or text. Bright, organized, expandable, no UI, no characters.
```

### 7.4 Fountain Festival — Events / Puzzle

```text
Create a magical seasonal festival and puzzle basemap for LashiraBloom Fountain Festival, exact canvas 1394x1128 px. Same pixel art style and scale as the kingdom hub. Scene: a central fountain plaza with a glowing portal ring, cozy garden paths, flower beds, temporary festival stalls, event booths, a clean rectangular puzzle-board plaza, trellis arch, seed crates, flower carts, banners, lanterns, and open walking paths. It should feel reusable for match/merge puzzles, seasonal events, and viral prototype modes. Bright, cheerful, no UI, no text, no characters.
```

### 7.5 Emberring Arena — Social Competition

```text
Create a colorful top-down social competition arena basemap for LashiraBloom Emberring Arena, exact canvas 1394x1128 px. Same cozy pixel style as the kingdom hub but slightly more arcade-like. Scene: a safe circular training arena with symmetrical cover blocks, bushes, low walls, lanes, spawn corners, a central objective circle, spectator banners, torchlight, and clear walking/combat lanes. It should support friendly duels, score challenges, and future 2D rival rounds. Bright toy-like props, clear sightlines, readable cover, no weapons on the ground, no violence, no UI, no text, no characters.
```

## 8. Working scalable game recommendation

First playable scalable game:

```text
Tower Defense MVP
```

Why:

- It helps the main stronghold goal immediately: defend the Kingdom.
- It reuses combat, monsters, materials, and rewards.
- It is easy to scale by adding waves, tower types, maps, bosses, and modifiers.
- It gives Circle HQ meaningful tuning controls quickly.

Second playable scalable game:

```text
Kitchen Rush MVP
```

Why:

- It makes Food useful.
- It supports city happiness.
- It is kid-safe and retention-friendly.
- It gives a different kind of gameplay from combat.

## 9. Acceptance checklist

| Area | Pass condition |
|---|---|
| Portal wiring | Every portal opens the same launch modal and either launches a realm or a coming-soon shell |
| Shared shell | Every game uses the same four corner components: character/resources, settings, location, controller |
| Basemaps | Generated images are exactly `1394x1128`, no UI/text/characters, style matches Lashira |
| Tower Defense MVP | One playable map, waves start/end, towers place, rewards summarize |
| Kitchen Rush MVP | One playable kitchen, orders spawn, stations work, meals convert Food to happiness/Bloom |
| HQ consistency | World Builder plan owns portals/realms/rewards; Character Forge owns character/skins; Battle Builder owns combat tuning |
| Kid safety | Kid gameplay never writes Character XP or Diamonds |
| Skin economy | Diamond catalog contains cosmetics only |
