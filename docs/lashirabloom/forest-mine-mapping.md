# LashiraBloom — Forest (lumber) + Mine (ore) mapping + monster names

Concept plan (no build yet). Maps zone **13 Forest** and **14 Mine** to the basemap art,
places MULTIPLE harvest nodes using `public/farm-art/lib/`, and adds monster nameplates.

## 0. What already exists (do NOT rebuild)

- **Mechanics — `farm-mechanics.js`**: `mine(node)` and `chop(node)` are complete.
  - Ore yields: `stone→2 stone`, `copper→1 stone+1 ore`, `iron→2 stone+1 ore`,
    `gold→3 ore` (needs T2 pickaxe), `gem→1 gem+1 ore` (needs T2 pickaxe).
  - Trees: soft `→2 wood`, hard `→3 wood` (needs T2 axe).
  - Respawn cooldowns: ore 90 s, tree 60 s (`nodeReady`/`nodeFrac`).
- **Bestiary — `@arganta/combat`**: every mob already has `name`
  (Squirrel, Fox, Badger, Boar, Deer, **Tiger** boss). Just not rendered.
- **Hotspot spine**: `HOTSPOTS[]` + `hotspotAt()` + `openHotspot` dispatch by `kind`
  (`ore`/`tree` already route to mine/chop). So new nodes = new rows + render.

So the work is: (a) remap ore/tree hotspots onto the basemap, add more; (b) render each
node's state art from `lib/`; (c) draw monster nameplates.

## 1. Available `lib/` art

- **Ore/mine**: `ore_copper.png`, `ore_iron.png`, `ore_gold.png`, `ore_gem.png`,
  `boulder.png`, `small_rock.png`, `mine_cart.png`.
- **Forest/lumber**: `tree_pine.png`, `tree_oak.png`, `tree_stump.png`,
  `woodlog_pile.png`, `bush.png`.

### Node state art (the nice part — each node uses TWO lib sprites)

| Node | READY (harvestable) | DEPLETED (on cooldown) |
|------|--------------------|------------------------|
| Soft tree | `tree_pine` | `tree_stump` |
| Hard tree | `tree_oak` | `tree_stump` |
| Stone node | `boulder` | `small_rock` |
| Copper/Iron | `ore_copper` / `ore_iron` | `small_rock` |
| Gold/Gem | `ore_gold` / `ore_gem` | `small_rock` |

Ready = full sprite + a soft pulsing ring (green if usable now, amber if tier-locked).
Depleted = stump/small_rock + a thin regrow arc (`nodeFrac`). Sprites are drawn per-frame
ON TOP of the basemap grove/quarry (they read as the "live" nodes; baked art = backdrop).

## 2. Forest (13) — lumber nodes  ·  grove tx37–44, ty16–31

9 choppable trees spread through the grove (soft = T1 axe, HARD = T2 axe for progression),
placed on the basemap's conifers, off the walking lanes.

| # | tile | kind | tier | yield |
|---|------|------|------|-------|
| 1 | 38,17 | pine | soft | 2 🪵 |
| 2 | 42,18 | pine | soft | 2 🪵 |
| 3 | 37,20 | pine | soft | 2 🪵 |
| 4 | 43,21 | **oak** | **hard** | 3 🪵 |
| 5 | 39,23 | pine | soft | 2 🪵 |
| 6 | 41,26 | **oak** | **hard** | 3 🪵 |
| 7 | 38,28 | pine | soft | 2 🪵 |
| 8 | 43,28 | pine | soft | 2 🪵 |
| 9 | 40,30 | pine | soft | 2 🪵 |

Decoration (non-harvest, ambience): `tree_stump` 44,25 · `woodlog_pile` 39,31 · `bush` 44,30.

## 3. Mine (14) — ore nodes  ·  quarry tx45–59, ty17–31

9 minable nodes covering every ore type; T1 (stone/copper/iron) usable from the start,
T2 (gold/gem) gated on a Tier-2 pickaxe. Anchored to the basemap's deposits (✓ = pixel-confirmed).

| # | tile | ore | tier | yield |
|---|------|-----|------|-------|
| 1 | 47,29 ✓ | **gem** | T2 | 1 🔷 + 1 🟨 (blue crystal cluster) |
| 2 | 50,24 ✓ | **gold** | T2 | 3 🟨 |
| 3 | 49,30 ✓ | copper | T1 | 1 🪨 + 1 🟨 |
| 4 | 53,22 | iron | T1 | 2 🪨 + 1 🟨 |
| 5 | 51,31 ✓ | stone | T1 | 2 🪨 (boulder) |
| 6 | 56,25 | copper | T1 | 1 🪨 + 1 🟨 |
| 7 | 57,20 | **gold** | T2 | 3 🟨 |
| 8 | 52,27 | iron | T1 | 2 🪨 + 1 🟨 |
| 9 | 55,30 | stone | T1 | 2 🪨 |

Decoration/landmarks: `mine_cart` 51,21 · cave mouths (dungeon gates) 49,18 & 54,18 ·
scattered `small_rock`. (The dungeon gate hotspot at 48,18 stays.)

## 4. Collision

Each ready node blocks its tile (walk up to it, tap the adjacent tile like a tree).
Depleted stump/small_rock still blocks (it's a physical object). Add these to the
hand-authored collision set (they're real obstacles, unlike the pruned procedural props).

## 5. Monster nameplates

Draw a small nameplate over every arena/world monster using `monsterOf(m.kind).name`:

- Species name centered above the mob (like player/kin nameplates), on a dark pill.
- Colour by tier: common mobs slate, mini-bosses (deer/boar) amber, **Tiger** gold+bold
  with a ☠/👑 prefix.
- Optional flavor: a per-instance moniker (seeded, e.g. "Nutkin the Squirrel") like the
  livestock names — nice-to-have, species name is the baseline the request asks for.
- Also show the mob's HP bar with the name (HP bar already exists in `drawMonster`).

## 6. Build order (when approved)

1. `farm-map.js`: replace the 5 old ore + 6 old tree HOTSPOTS with the 9+9 above;
   add `art`/`state` fields (ready vs depleted sprite keys); wire the new lib keys in
   `farm-art-bundled.js` (`lashira.lib.tree_pine/oak/stump`, `ore_*`, `boulder`,
   `small_rock`, `mine_cart` — most already present).
2. `FarmRoom.jsx` draw loop: render each node from `mech.nodeReady()` → ready/depleted
   sprite + ring/regrow arc (screen-independent, world space).
3. `FarmRoom.jsx` `drawMonster`: add the nameplate.
4. Collision: block ready+depleted node tiles.
5. Verify: `mine()`/`chop()` already proven; confirm each node id gathers + cools down.
