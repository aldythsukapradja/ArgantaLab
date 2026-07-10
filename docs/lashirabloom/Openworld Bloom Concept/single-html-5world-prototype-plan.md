# Single HTML 5-World Prototype Plan

Status: planning only. No build yet.

## 1. New direction

This prototype is a fully contained single HTML page.

No Supabase adapter.
No external runtime imports.
No Vite/React dependency.
No asset loading from sibling files at runtime.

The final deliverable should be one HTML file with embedded CSS, JavaScript, and selected pixel art assets as data URLs.

## 2. Asset scan result

Primary usable pixel art source:

`apps/lashira/web/public/farm-art/`

Useful folders/files found:

| Asset group | Source | Use |
|---|---|---|
| HQ basemaps | `basemap.png`, `basemap_v4.png`, `basemap_v5.png`, `basemap_v6.png` | Hub background candidate |
| World maps | `Worldmap/*.png` | Five realm backgrounds |
| Buildings/props | `lib/*.png` | Keep upgrades, shops, towers, props |
| Crops | `lib/crop_*.png`, `crop_*.png` | Farm/Keep economy visuals |
| Animals | `lib/cow.png`, `lib/sheep.png`, `lib/chicken.png` | Keep/pasture visuals |
| Creatures | `creatures/*` and `lib/mob_*.png` | Defense/arena enemies |
| Towers | `towers/bramble`, `towers/frostbud`, `towers/sentry`, `towers/sunspire` | Bloomwall tower defense |
| Ores/resources | `lib/ore_*.png`, `icon_wood.png`, `icon_stone.png`, `icon_gold.png` | Shared resource UI |
| Kitchen-ish props | `lib/market_stall.png`, `lib/produce_stall.png`, `lib/furn_*.png`, crops | Hearthrush stations |
| Festival props | `lib/fountain.png`, `flowers.png`, `lily_pad.png`, `signpost.png` | Fountain Festival scene |
| UI icons | `produce/*.svg`, `packages/combat/src/icons/svg/*.svg` | Buttons and resource badges |

Secondary source:

`apps/kingdom/data/assets/game-images/`

This folder contains a very large GIF catalog of character equipment and armor. It is useful as a future source, but not recommended for the first single HTML prototype because embedding many GIFs will bloat the file. For the first pass, use a compact canvas-drawn placeholder hero or extract one tiny hero/creature sprite set only.

Reference-only source:

`packages/combat/src/icons/svg/`

These SVGs are good for button icons, but for a fully contained HTML they should be copied inline as SVG strings or simplified into canvas/icon text.

## 3. Asset extraction rule

Before building the HTML, create a small curated asset manifest. Do not embed the whole repo.

Target asset budget:

| Type | Count | Notes |
|---|---:|---|
| Basemap/HQ | 1 | Use current best HQ basemap |
| Realm backgrounds | 5 | One per world |
| Player sprite | 1 compact set | Procedural or 4-direction simple extracted sprite |
| Towers | 4-8 | Two levels each if available |
| Mobs | 4-6 | Prefer compact `lib/mob_*.png` first |
| Crops/resources | 8-12 | Crops, wood, ore, bloom/diamond symbol |
| Kitchen props | 6-10 | Counters/stoves/tables can be drawn if no clean sprites |
| Festival props | 6-10 | Fountain, flowers, booth-like props |
| UI icons | 10-20 | Inline SVG or canvas symbols |

Extraction output should be a generated JavaScript object inside the HTML:

```js
const ASSETS = {
  maps: {
    hq: "data:image/png;base64,...",
    lashiraKeep: "data:image/png;base64,..."
  },
  sprites: {
    towerSentry1: "data:image/png;base64,..."
  }
};
```

## 4. Single app architecture

One HTML file:

```text
lashira-5worlds-prototype.html
  <style> shared HUD and layout </style>
  <canvas id="game"></canvas>
  <script>
    ASSETS
    WORLD_REGISTRY
    GAME_STATE
    shared renderer
    shared input/controller
    five world modules
  </script>
```

No localStorage dependency for core behavior. It can use in-memory state only. Optional localStorage save can be added later, but the prototype should run without it.

## 5. Shared shell

The single HTML should preserve the Lashira four-corner system:

| Corner | Component | Prototype content |
|---|---|---|
| Top left | Character info | Name, HP, MP, Wood, Ore, Bloom, Diamonds |
| Top right | Settings/menu | Reset, sound, debug, world select |
| Bottom left | Location info | Current world, objective, short hint |
| Bottom right | Controller | Same shell, actions change by world |

## 6. Five worlds and prototype loops

### 6.1 Lashira Keep

Analog: Township, Clash of Clans, Last War base layer.

Prototype loop:

1. Walk around Keep map.
2. Select building.
3. Spend Wood/Ore/Bloom to upgrade.
4. Upgrades unlock bonuses in other worlds.

First buildings:

- Command Hall
- Kitchen
- Bloomwall Yard
- Festival Plaza
- Arena Ring

### 6.2 Bloomwall Pass

Analog: Kingdom Rush, Last War lane battle.

Prototype loop:

1. Start wave.
2. Place towers on fixed pads.
3. Enemies walk a path.
4. Towers auto-fire.
5. Survive 5 waves.

Use assets:

- `towers/sentry`
- `towers/bramble`
- `towers/frostbud`
- `towers/sunspire`
- `lib/mob_badger.png`
- `lib/mob_boar.png`
- `lib/tiger_boss.png`

### 6.3 Hearthrush Kitchen

Analog: Cooking Fever, Dinner Dash, Overcooked.

Prototype loop:

1. Customer order appears.
2. Tap prep station.
3. Tap cook station.
4. Tap serve station.
5. Earn Bloom and happiness before patience runs out.

Use assets:

- `hearthrush-kitchen.png`
- `lib/produce_stall.png`
- crop icons
- furniture props if needed

### 6.4 Fountain Festival

Analog: Royal Match, casual event board, Township events.

Prototype loop:

1. 7x7 board.
2. Swap adjacent tiles.
3. Match 3+ symbols.
4. Complete simple objective.
5. Earn festival tokens/Bloom.

Use assets:

- `fountain-festival.png`
- crops/flowers/resource icons as tiles
- `lib/fountain.png` if overlay needed

### 6.5 Emberring Arena

Analog: Brawl Stars, casual arena duel.

Prototype loop:

1. Move in arena.
2. Collect sparks or fight simple bots.
3. Use one attack and one skill.
4. 60-90 second round.
5. Score only, no power advantage.

Use assets:

- `emberring-arena.png`
- `lib/mob_fox.png`, `lib/mob_badger.png`, or simple bot sprites
- combat SVG icons

## 7. World registry

The single HTML should define every world in a data table:

```js
const WORLD_REGISTRY = {
  hq: {
    name: "Lashira HQ",
    map: ASSETS.maps.hq,
    spawn: { x: 30, y: 25 },
    portals: [...]
  },
  bloomwall: {
    name: "Bloomwall Pass",
    map: ASSETS.maps.bloomwall,
    module: "towerDefense"
  }
};
```

Adding a sixth world later should be a registry change plus one module, not a rewrite.

## 8. State model

Because this is fully contained, state is in memory:

```js
const state = {
  worldId: "hq",
  player: { x, y, hp, mp, facing },
  resources: { wood, ore, bloom, diamonds },
  keep: { buildings: {} },
  bloomwall: { towers: [], wave: 0 },
  kitchen: { orders: [] },
  festival: { board: [] },
  arena: { score: 0 }
};
```

Diamonds remain cosmetic-only even in prototype.

## 9. Build sequence

1. Generate asset manifest from selected repo assets.
2. Build single HTML shell and canvas renderer.
3. Render HQ map and player movement.
4. Add portal transfer between HQ and five maps.
5. Add shared four-corner HUD.
6. Add bottom-right controller shell.
7. Add Lashira Keep click/upgrade prototype.
8. Add Bloomwall Pass tower defense prototype.
9. Add Hearthrush Kitchen service prototype.
10. Add Fountain Festival match board prototype.
11. Add Emberring Arena bot/score prototype.
12. Add debug panel: world jump, asset count, FPS, reset state.

## 10. Key implementation constraint

Do not use Supabase, React, Vite, package imports, or external files at runtime.

Everything needed to run the prototype must live inside one HTML file.
