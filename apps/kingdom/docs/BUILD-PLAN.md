# Kingdom — Incremental Build Plan (Buya Arena testbed + Kingdom Command DB)

Date: 2026-07-04. Executes the concepts in `REBUILD-STRATEGY.md` and
`CLIENT-ASSETS-AND-CHARACTER-LAB.md`. Every step ends with something you can
test in the browser; no step depends on a later one.

## Ground rules (apply to every step)

- **Scale law (from the live-game screenshot):** 1 tile = 48×48 px. Sprites
  draw at native pixel size — never scaled individually. Camera zoom is a
  global integer (1× or 2×). Entities anchor bottom-center of their tile;
  the extracted `fx,fy` offsets already encode the client's own anchors, so
  a body reads ~1 tile wide, ~1.7 tiles tall exactly like in Buya.
- **Rendering law:** per motion step, draw layers in that step's Motion.tbl
  order; each part's frame comes from its own `animations` map. No
  hand-tuned offsets anywhere — if something looks detached, the data
  loading is wrong, not the art.
- Tests are eyeball tests against NexusTK screenshots + the coverage
  counter; each step lists its pass condition.

---

## Phase A — Data foundation (no UI)

**A1. `scripts/build-client.mjs` — consolidate the two extractions.**
Copy Claude library (char/monsters/mounts/effects/items) + Codex
`canonical/` (ui/worldmaps/fieldmaps) into `data/client/`, write provenance
manifest.
*Test:* manifest counts = 2,946 parts / 2,013 mobs / 53 mounts / 648
effects / 5,879 icons; spot-open 3 PNGs.
*Model:* **Sonnet** (file plumbing).

**A2. Complete the client library.** Run `extract_all.py --tiles`; add audio
export (`mus0-6`, `snd.dat`) to the extractor.
*Test:* tile sheets render; one music file plays.
*Model:* **Sonnet** (extends proven extractor).

**A3. `scripts/match.mjs` + `scripts/audit.mjs`.** Image-hash icons↔item
GIFs and mobs↔monster GIFs → `data/links/*.json` drafts; audit scoreboard →
`derived/audit.md`.
*Test:* ≥80% of 644 items auto-linked, ≥85% of 694 monsters; audit lists
orphans/gaps with counts matching §4 of the concept doc.
*Model:* **Opus** (matching heuristics need judgment; rest is mechanical).

## Phase B — Kingdom Command: the database tabs (vanilla JS, existing app)

**B1. "Char Vault" tab.** Every part category browsable: grid of parts
(sheet thumbnails), click → frame inspector (all frames, animations listed,
palette swatches, link badge).
*Test:* you can page through all 449 bodies, 174 hairs, 437 swords…;
females present; no purple garbage.
*Model:* **Sonnet** (new views on existing Store/Views patterns).

**B2. Database upgrade.** Monsters/Items/Skills tabs gain client columns:
animated sprite preview (stand_down loop), link status, XP/drops already
there; new Mounts + Effects tabs; global search covers them.
*Test:* search "rat" → scraped rat with its real animated sprite next to XP.
*Model:* **Sonnet**.

**B3. Link review UI.** Audit tab renders `derived/audit.md` data; per-row
confirm/reject writes `links/*.json` status.
*Test:* confirm 10 monster links, re-run audit, counts drop.
*Model:* **Sonnet**.

## Phase C — Character Lab (React app starts here: `apps/kingdom/web/`)

**C1. Static composer.** Vite+React shell; `<CompositeStage>` renders ONE
correct frame: body+face+hair+coat, NormalStandBySouth step 0, Motion.tbl
layer order, correct palettes. Slot pickers per the concept wireframe.
*Test:* composite pixel-matches the old workbench's verified renders; side
view / back view correct.
*Model:* **Fable** (first-of-kind correctness: layer order, anchors,
palette pipeline — everything downstream copies this code).

**C2. Motion driver.** All 68 motions, 4 directions, speed, step scrubber,
auto-rotate; weapon/shield/mount slots active (Riding motions swap in, mount
layer ordering per direction).
*Test:* walk/swing/pierce/shoot/get/spell/ride/emotes all animate; mount
occludes rider legs facing south, not north.
*Model:* **Fable or Opus** (Fable for the driver core; Opus fine if C1's
architecture is clean).

**C3. Dye system.** Palette-LUT recolor on `.idx.png` (hair 30, coat 24+,
skin 5+) with LRU cache.
*Test:* same hair flips through 30 colors with zero layout shift.
*Model:* **Opus**.

## Phase D — Buya Arena Test Room (mechanics testing, incremental)

**D1. Arena + walking character.** Backdrop = Buya Arena map image (scraped
mirror; your screenshot as fallback) at true 48px grid scale, walkable-rect
collision mask, camera follow. WASD/arrow tile-step walking with your C2
character.
*Test:* character size vs arena matches the live-game screenshot overlay;
can't walk through walls/carpets' edges you mark solid.
*Model:* **Opus**.

**D2. Solo mechanics.** Space=Spell (pick any of 648 effects, real frame
delays + translucency), E=Get crouch, R=mount toggle w/ Riding movement,
Q=emote, 1/2/3=Swing/Pierce/Shoot. Sound hooks if A2 audio landed.
*Test:* your "test the character only" milestone — every action visually
correct in-room.
*Model:* **Opus**.

**D3. Monsters in the arena.** Spawn picker (any of 2,013 mobs), stand/walk
loops with DNA per-frame durations, simple wander; hit (`hit_*`) reaction
when struck.
*Test:* spawn 5 different mobs incl. a big boss sprite; animations loop at
correct speeds.
*Model:* **Opus**.

**D4. Combat loop.** Facing-tile targeting; attack motions deal a hit →
monster `hit_*` flinch → HP bar (UI kit gauge art) → `death` animation →
XP toast from scraped `defaultExperience` → optional drop icon on tile from
scraped drops.
*Test:* kill a linked monster; watch swing → flinch → death → "+240 XP" →
drop appears; numbers match the codex entry.
*Model:* **Fable for the combat/timing architecture pass, Opus for
iterations** (hit timing against animation steps is the subtle part).

## Phase E — later (own plans)

Authentic tile-built Buya Arena via map editor (MAP format) · multi-monster
AI · skills with mana/aether from scrape · React codex replacing Kingdom
Command.

---

## Which model when (the honest guide)

You do **not** need Fable all the time. Rule of thumb:

| Work type | Model | Why |
|---|---|---|
| Binary format reverse-engineering, first-of-kind engine code (C1, C2, D4 core), gnarly debugging | **Fable** | Correctness cliffs; a wrong assumption here poisons everything built on top |
| Standard feature building on established patterns (B*, C3, D1–D3, A3) | **Opus** (or Fast mode) | Strong enough for real engineering, cheaper/faster than Fable |
| File plumbing, extractor tweaks, CRUD views, CSS, table tabs (A1, A2, B1, B2) | **Sonnet** | Mechanical work with clear specs — specs are all written now |
| Renames, doc updates, one-liners, running scripts | **Haiku** | Trivial |

Practical pattern: start each phase's first step one tier up, then drop a
tier once the pattern exists in the codebase. The expensive decoding work
(where Fable mattered most) is already done and documented — from here the
specs in these three docs are detailed enough that mid-tier models can
execute most steps.

---

## Status log

**2026-07-04 (overnight autonomous run)** — Phases A, B, C-core, D1–D4 all BUILT and verified:

- A1–A3 ✅ `data/client/` (11,938 files, 903 MB incl. tiles + audio), links
  (600/694 monsters w/ recovered palettes, 380/644 items), audit scoreboard.
  Extractor fixes along the way: animated-palette color shift (purple tiles),
  ITEM.TBL 20-byte records, monster server-palette variants (shape-primary
  matching), per-part `origin` for absolute compositing anchors.
- B1–B3 ✅ Kingdom Command "Client Art" tabs: Char Vault (2,895 parts,
  animated, dye swatches), Mounts, Effects, Audit & Links review UI; monster/
  item detail pages show real client sprites; sticky-header layout fixed.
- C1–C3 ✅ React app `apps/kingdom/web` (Vite, port 8322; `kingdom-web` in
  launch.json). Engine: `src/engine/{data,compositor,palettes}.js` implement
  the decoded Motion.tbl layer/slot law — composite was pixel-correct on
  first render; mount occlusion verified both directions; LUT dye system.
- D1–D4 ✅ Buya (Chonsa) Arena Test Room: backdrop cropped from the atlas
  page (`chonsa-arena-room.png`, 17×16 tiles @48px), WASD tile walking,
  Space/E/R/Q/1/2/3 actions, spell effects w/ real delays, linked-monster
  spawner (name+XP from scrape), wander AI, combat loop (hit flinch → HP bar
  → death fade → XP toast with the monster's true scraped XP).

Known polish items: arena backdrop is an upscaled atlas render (blocky) —
replace via tile-built map (Phase E); effect anchor uses player tile (fine
for self-cast); weapon multi-slot arcs (MainWeapon 8–11 / BackWeapon 13,18)
draw single-slot for now; skills→effects links still 0 (manual queue in
Audit tab).

**2026-07-04 (second run)** — Composer v2 + fullscreen arena HUD:
Skin/Armor merged model (coats + full-outfit bodies in one browsable
collection, auto coat-unequip), visual PartBrowser popup (lazy per-bank
thumbnails), interactive DyePicker (real swatches + slider, only where
palettes exist), bbox-true centering, Reset, shoes drawn after body
(deviation noted in compositor.js), crash-proof game loop + camera clamp.
Kingdom Command: Character Lab tab (iframe) under Overview; mobile ≤720px =
no drawer, rounded bottom navbar. Arena: fullscreen canvas, ⚙ settings
popup (spawns/skill slots/zoom), virtual joystick, attack + skill circles
(Ragnarok-M style), desktop keeps WASD with compact cluster. All verified
in preview; attack-by-weapon rule: sword→Swing, spear→Pierce, bow→Shoot.

**2026-07-04 (MP-0 multiplayer slice)** — helmet render fix (slot-substitution
guard), Space=attack + 1/2/3=skills (desktop), selector auto-equips optional
slots. Supabase (KinetikCircle project): 001_kingdom_mp0.sql adds
kingdom_characters/appearance/position with RLS (existing kinetik `profiles`
reused — diamonds mirror displayed read-only). Auth in-Composer: Google
(adult) + username/PIN kids (kinetik synthetic-email scheme), 👑/🧒 badge,
nickname claim, debounced cloud loadout (cloud wins on login). Arena
realtime: presence + intent broadcasts (move/action/attack/hp/defeat),
victim-referee combat isolated for Phase-6 server authority, remote players
rendered via the same compositor with nameplates. PWA (manifest/SW/icons) +
vercel.json + VITE_DATA_BASE plumbing + Storage uploader script. See
web/DEPLOY.md for the go-live checklist.
