# LashiraBloom

A Stardew-inspired farming RPG in the ArgantaLab universe. You farm as your **real
Kingdom Heroes character** — same canvas-2D engine, avatar compositor, controls,
and HUD as Kingdom Heroes' arena.

## Two apps, two launchers (from the repo root)

- **`PlayLashiraBloom.bat`** → the game (`apps/lashira/web`, port 5185)
- **`BloomCommand.bat`** → the admin dashboard (`apps/lashira/command`, port 5186)

Each installs deps on first run, then starts its dev server and opens the browser.

## Playing as your Heroes character

- Sign in (Google grown-up / kid PIN). The farmer is your Kingdom Heroes character,
  loaded via `kingdom_get_player_state()` and rendered by the shared compositor
  (`src/engine/`), with art fetched from the Kingdom host (`VITE_KINGDOM_DATA_BASE`).
- **You must build a hero in Kingdom Heroes first** (heroes.arganta.app). No hero →
  a gate screen (with a "play with a placeholder farmer" escape hatch).
- **Play now (guest)** or an unreachable art host → a placeholder farmer, so the
  game always runs.

## Controls

- Move: WASD / arrows, or drag the bottom-left (nipplejs). Tile-stepping, like Heroes.
- Tools: `1` Till · `2` Plant · `3` Water (or the gem buttons).
- Use / harvest: `Space` / `E` or the big **⤵** button. Sleep: the 😴 button.
- Panels: Shop · Barn · Kin · Home.

## The loop

Till → plant → water → **sleep** (watered crops grow a stage) → repeat → harvest →
sell for 🌸 Bloom. Feed barn animals → collect produce. Assign Kins (Harvest Sprites)
to auto-water/harvest each morning.

## Architecture (canvas-2D, reuses Kingdom Heroes)

- `src/engine/` — `compositor.js` / `data.js` / `palettes.js` copied from
  `apps/kingdom/web` (the DSC avatar renderer). Extract to a shared package later.
- `src/net/hero.js` — `fetchHeroState` + `loadPlayerResources` (Heroes integration).
- `src/game/FarmRoom.jsx` — canvas render loop, tile-step movement, nipplejs, camera,
  avatar draw (+ placeholder fallback). `src/game/farm-logic.js` — renderer-agnostic
  mechanics + localStorage. `src/game/farm-map.js` — procedural farm map + collision.
- `src/ui/` — Kingdom-style `Hud.jsx` (unit-frame + cluster), `CharacterGate.jsx`,
  `Panels.jsx`, `Welcome.jsx`.
- PWA: `public/manifest.webmanifest` + `public/icon.svg` (ArgantaLab gradient).

## Next
Guardian companion sprite, real farm-map art via PixelLab, cloud save
(`supabase/001_lashira_core.sql`), then Town/City/Mining/Dungeon. See
`docs/lashirabloom/buildplan.md`.
