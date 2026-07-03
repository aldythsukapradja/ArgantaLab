# Kingdom of Kin — direction & guardrails

> SUPERSEDES the earlier "Arganta Co-op — Godot Prototype" brief that used to live here.
> On 2026-07-03 the direction was confirmed: **React + PixiJS MMO, NOT Godot.** Godot was
> evaluated and explicitly rejected (see the memory note `kingdom-of-kin-concept`). Do not
> reintroduce Godot/GDScript/.tres/Supabase-Realtime-broadcast guidance from the old brief.

## What this is
**Kingdom of Kin** — a kid-safe, real-time MMORPG built ON TOP OF ArgantaLab: the maths/reading/
science a child learns is the key that unlocks a world of hunting, taming Kin, castles, and clan
play. One island, six worlds (reusing KinQuest's regions/Keepers). Full concept lives in:
- `pitch.html` — scrollable concept page
- `presentation.html` — 12-slide deck w/ hand-drawn world map + clickable game-journey simulator
- `pixel-art-pipeline.md` — the AI pixel-art (PixelLab) asset pipeline
- Memory: `kingdom-of-kin-concept` (the canonical, decision-by-decision record)

## Tech stack (confirmed 2026-07-03)
- **Client**: React + TypeScript + Vite + **PixiJS v8** (web + Capacitor mobile). Reuse the
  existing engine muscle (KinQuest/KinWorld Pixi overworlds, Joystick, Kenney tilesets, the
  `KinSprite` / `installAtlas()` swappable art seams).
- **Realtime backend**: Nakama OR Colyseus (TBD) — server-authoritative; combat is tab-target
  (no physics).
- **Source of truth**: the existing Supabase project (`bdagdxgpnlialkppjwor`) — identity,
  `profiles.diamonds`, `person_creatures` (Kins), `person_mounts`, learning rings. Economy
  writes go through RPCs (client never decides). Reuse `lib/nexus.ts` + `lib/mounts.ts`.
- **Pixel art**: **PixelLab** (MCP + REST API). Sprites generated data-driven from the content
  catalogs → texture atlas → drop into the existing art seam (zero engine change). NOTE: the
  Python SDK v1.0.5 crashes parsing responses (renamed `usage` field) — call the REST endpoint
  `{base_url}/generate-image-pixflux` directly instead.

## Conventions
- Match the surrounding web repo's style (TS, existing component/data patterns). Reuse the
  content-as-data catalogs (`kin.ts`/`mounts.ts`/`regions.ts`); never invent a parallel schema.
- Reusable templates: ONE `<Region>`, ONE `<Castle>`, ONE `<Dungeon>` — data-driven, add a
  region/dungeon as a data row + tileset, not new code.
- Keep scope honest: MVP = all 6 worlds walkable, one dungeon each, thin everything else;
  depth arrives as DATA onto the same schemas (see the base/scale plan in the pitch).
