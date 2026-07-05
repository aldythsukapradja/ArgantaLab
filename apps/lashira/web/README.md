# LashiraBloom (playable farm slice)

A Stardew-inspired farming loop for ArgantaLab — React + PixiJS + nipplejs, wired
to the shared Supabase project for identity, with localStorage save so it runs on
first click even before any migration.

## Play

From the repo root, double-click **`PlayLashiraBloom.bat`** (Windows). It installs
dependencies on first run, then starts the dev server and opens your browser.

Or manually:
```
cd apps/lashira/web
npm install
npm run dev
```

## Controls

- **Move:** WASD / arrow keys, or drag anywhere in the bottom-left of the screen
  (nipplejs virtual joystick, touch or mouse).
- **Tools:** keys `1` Till · `2` Plant · `3` Water, or tap the toolbar.
- **Use tool / harvest:** `Space` (or `E`), or the **Use ⤵** button.
- **Sleep (advance the day):** the **😴 Sleep** button.
- **Panels:** Shop · Barn · Kin · Home (bottom-left buttons).

## The loop

1. **Till** field tiles (hoe), **Plant** a seed, **Water** it.
2. **Sleep** to pass the day — watered crops grow one stage.
3. Repeat watering + sleeping until a crop is ripe, then **Use** on it to harvest.
4. **Sell** produce in the Shop for 🌸 Bloom; buy more seeds.
5. **Feed** animals in the Barn → collect milk/eggs/wool next morning.
6. **Assign Kins** (Harvest Sprites) to auto-water or auto-harvest each morning.

## The ArgantaLab rule

- 🌸 **Bloom** = earned by playing, spent in-game (per-circle purse later).
- 💎 **Diamonds** = cosmetics only; earned by learning (shown read-only).
- **Level → power:** higher level = faster movement + more energy. Adults gain XP
  by playing; kids gain XP only by learning the 6 Worlds (already enforced in
  `apps/kingdom/supabase/002_*.sql`).

## Status / next

- **This slice:** single-player farm, localStorage save, placeholder pixel art
  drawn in code (`src/game/sprites.js`).
- **Cloud save (optional):** run `supabase/001_lashira_core.sql` in the ArgantaLab
  project, then wire farm reads/writes to it.
- **Later:** PixelLab art, the other maps (Town/City/Mining/Dungeon), quests,
  combat — see `docs/lashirabloom/buildplan.md`.
