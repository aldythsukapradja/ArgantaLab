# LashiraBloom — Art generation + port: RESULTS (overnight run 2026-07-08)

Branch: `lashira-art-library` · Library: `apps/lashira/web/public/farm-art/lib/`
Recipe: `high top-down · medium detail · medium shading · selective outline`, cozy-cute
"Stardew + Animal Crossing" palette. Downloads: `curl -sL .../map-objects/<id>/download`.

## Result: 82 original assets generated, downloaded, committed; core set wired + build-verified.

### Castle options (pick one — currently `castle_opt1_storybook` is wired to the house slot)
- `castle_opt1_storybook` (cream stone, red roofs, cozy) ← wired default
- `castle_opt2_fairytale` (white stone, blue spires)
- `castle_opt3_royal` (purple + gold, majestic)
- `castle_opt4_whimsical` (pastel, teal roofs, Animal-Crossing cute)

### Delivered by group
- **Terrain (5 Wang tilesets):** grass↔soil, ↔path, ↔water, ↔sand, ↔rock
- **Buildings:** barn, coop, silo, windmill, greenhouse ×3 tiers, 5 shops (seed/general/
  blacksmith/animal/cosmetics), produce+market stalls, houses ×3 tiers (shack/cottage/
  farmhouse), 4 castles, well, shipping bin, scarecrow, fences (straight/gate)
- **Animals:** cow, sheep, chicken (+ troughs, ready-to-add produce icons)
- **Monsters (woodland, kid-safe):** squirrel, fox, badger, boar, deer, **tiger boss**
- **Crops (6 ripe):** turnip, potato, carrot, strawberry, corn, pumpkin
- **Mining/dungeon:** ore ×4 (copper/iron/gold/gem), boulder, mine cart, dungeon gate,
  chest, barrel, torch
- **Fishing:** dock, reeds. **Forest:** oak, pine, bush, mushroom, stump, wood-log pile
- **PvP:** arena wall, arena gate, scoreboard
- **Interior furniture:** bed, table, rug, bookshelf, fireplace, chest
- **Deco/UI:** flowers, fountain, signpost, currency icons (gold/wood/stone)

## Wired into the app (`farm-art-bundled.js`) — renders live now
house→castle_opt1, barn, coop, shop→produce_stall, well, shipping_bin, cow, sheep,
chicken, tree→oak, fence, and all 6 ripe crops. **`vite build` passes (128 modules).**
Everything else sits in `lib/` ready to wire when the new map/mechanics land.

## Follow-ups (NOT done overnight — deliberate)
- **Re-roll:** `fence_straight.png` came out near-empty (856 b) — regenerate.
- **Terrain autotiling:** the 5 Wang sets are 16-tile sheets; wiring them needs
  corner-based autotile code (part of the new-map build), so terrain is still procedural.
- **Animation:** animals/monsters are static sprites — animated walk/attack/faint sheets
  are a follow-up pass (PixelLab `animate_character`).
- **Optional extras not generated:** emote bubbles ×6, NPC portraits ×8, crop stages 0–2
  (18), animated-object frames (windmill/water/torch), dungeon floor tileset, a few props.
  The pipeline is proven — these can be generated on request.
- **Map rebuilt (DONE):** `farm-map.js` is now the 60×48 castle-center layout — castle
  dead-center, farm NW, animal pens NE, garden+greenhouse W, mining+dungeon gate +
  forest E, fishing lake SW, battleground+PvP walled south. All 82 assets baked in via
  `PLACEMENTS`. Verified in guest-mode preview; `vite build` passes.
- **Polish pass DONE (verified in preview):** lush decoration scatter (grass tufts,
  flowers, mushrooms, rocks) fills the open grass; lily pads on the lake; vertical
  fence sprite for pen side-borders; feed/water troughs in each pen; forest filled out.
  88 assets total. `vite build` passes; guest-mode preview clean (no console errors).
- **Still open (deliberately not done unsupervised):**
  - Zone ground is flat-color tinted + hero art on top — the 5 Wang terrain tilesets
    are NOT autotiled in yet (needs corner-autotile code). Reads fine with decoration.
  - New-zone GAMEPLAY (real mining/dungeon/PvP/fishing interactions) not wired — only
    the FarmVille farm loop is live. Left for a supervised build (risk of breaking the
    working farm). Layout + art are all in place for the mechanics to hook into.
  - Castle default = `castle_opt1_storybook`; swap in `farm-art-bundled.js` to preview
    opt2/3/4.

## How to preview a different castle
Edit `farm-art-bundled.js` line for `lashira.building.house` → `lib/castle_opt2_fairytale.png`
(or opt3/opt4), reload. The 4 options are all in `lib/`.
