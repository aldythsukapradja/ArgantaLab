# LashiraBloom — Art generation + port progress (autonomous run)

Branch: `lashira-art-library`. Lib folder: `apps/lashira/web/public/farm-art/lib/`.
Recipe (all map_objects): `high top-down · medium detail · medium shading · selective
outline`, prompt suffix `", cute top-down farm game, bright warm saturated palette,
clean readable, Stardew meets Animal Crossing"`. Asset list = manifest §11.

Download: `curl -sL https://api.pixellab.ai/mcp/map-objects/<id>/download -o lib/<name>.png`
(tilesets: `.../tilesets/<id>/image`). No auth header needed.

Wire: add slot→`lib/<name>.png` to `farm-art-bundled.js` BUNDLED map.

## DONE (saved to lib/)
- [x] terrain_grass_soil (tileset), castle_v0, dungeon_gate, barn, market_stall,
  ore_gold, tree_oak, flowers, cow, tiger_boss  ← the 10 approved samples

## IN FLIGHT
- Castle options v1–v4: 8b7ed149 (storybook), e39bfa18 (fairytale), acacb139 (royal), 81f6f910 (whimsical)

## QUEUE (fire ~4/cycle, rate-limited)
**Terrain (tileset):** grass_path, grass_water, grass_sand, stone_cave, forest_floor · grass_variants(tiles_pro)
**Deco:** tree_pine, tree_bush, bush_a, bush_b, rock_a, rock_b, stump, fern, tuft_a, tuft_b, mushroom_a, mushroom_b, fence_straight, fence_corner, fence_gate, signpost_a, signpost_b, signpost_c, fountain, woodlog_pile, choppable_tree
**Farm:** crops 6×4 (turnip/potato/carrot/strawberry/corn/pumpkin × stage0-3)=24, coop, silo, windmill, scarecrow, shipping_bin, tool_rack
**Animals:** sheep, chicken, trough_feed, trough_water, icon_milk, icon_wool, icon_egg
**Greenhouse:** greenhouse_t1, greenhouse_t2, greenhouse_t3, greenhouse_beds
**Shops:** seed_shop, general_store, blacksmith, animal_shop, cosmetics_bank, sign_seed, sign_general, sign_smith, sign_animal, sign_bank
**Fishing:** dock, reeds, cattails, lily, fish_a, fish_b, fish_c, bobber, bucket
**Mining:** ore_copper, ore_iron, ore_gem, boulder_a, boulder_b, support_beam, mine_cart, cart_tracks, gate_torch
**Dungeon:** dungeon_floor(tileset), dungeon_chest, dungeon_crate, dungeon_barrel, dungeon_torch
**Monsters:** squirrel, fox, badger, boar, deer
**PvP:** arena_wall_t1, arena_wall_t2, arena_gate, arena_stands, scoreboard, arena_torch
**Castle:** (pick from v1–v4) + house_t1_shack, house_t2_cottage, house_t3_farmhouse, house_t4_manor, banner_a, banner_b, castle_torch, castle_door, interior_floor(tileset), interior_grand(tileset), furniture×14 (rug, table, chair, bed, bookshelf, chest, trophy, wall_banner, plant, lamp, fireplace, counter, barrel, painting)
**UI:** popup_frame, shop_frame, button_set, emote×6 (happy/sad/love/wave/sleep/star), currency_gold, currency_wood, currency_stone

## WIRING (after art lands)
1. Extend `farm-art-bundled.js` BUNDLED: house→best castle, coop, animals(sheep/chicken), tree, crops stage3, shop→market_stall, etc.
2. Save all to lib/ + this manifest.
3. Commit per batch. Build-check (`npx vite build`) before finishing.
4. Leave notes on the new-map/mechanics build (NOT attempted overnight — too large to do unsupervised safely).

## LOG
- 20:45 branch + lib created; 10 samples saved; 4 castle options firing.
