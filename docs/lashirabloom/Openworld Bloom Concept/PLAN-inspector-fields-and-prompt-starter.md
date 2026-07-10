# Plan — Richer Inspector Fields + Prompt Starter

Status: plan, **no build yet**. Created 2026-07-10. Extends the now-working Openworld Builder (`apps/hq/src/surfaces/world/OpenworldBuilder.tsx`).

## 0. The ask, restated precisely
Right now every placed thing (marker/zone/boundary/sprite) only carries *positional* data (tile, size, color, icon) into the export prompt. You want each one to also carry **why it's there** — name, description, intent — so the exported prompt is self-explanatory to whoever reads it (me, in a fresh session, with zero prior context). And you want a **prompt starter**: a header block that explains the map, the art style, the grid, before the per-object data even starts.

## 1. Research — reusing what this project already established, not inventing new conventions

I checked how this project already writes art/generation prompts, so the new "Prompt Starter" matches house style instead of introducing a third format:

- **`roadmap-and-build-plan.md` §7** already has a **global style anchor** (reused verbatim below) and a **global negative prompt**, plus a **per-realm "Scene" paragraph** for each of the 5 realms (written when their basemaps were generated). These are exactly the right seed text for each map's default brief.
- **The export DSL** (`PORTALS` / `ZONES` / `COLLISION` / `OBJECTS` / `SPRITES` blocks, space-separated `key=value` rows) is already a working, parseable grammar — the fix here is to **extend rows with more keys**, not replace the grammar.
- **`MAP-full-element-inventory.md`** is the ground-truth reference for what's real vs. placeholder — the Prompt Starter's per-map "Scene" text should stay consistent with it (e.g., Bloomwall Pass's brief should mention the real pre-drawn tower pads and cave, not contradict the inventory doc).

Net finding: **no new format needed** — extend the existing DSL rows with `name=`/`desc=`/`intent=`, and prepend one new `BRIEF` block, reusing the project's existing style-anchor language.

## 2. Data model additions

Every placeable thing gains three optional fields (all free text, all optional — nothing is required to keep placing objects fast):

```ts
type Annotated = {
  name?: string          // human display name, defaults to the id/slug
  desc?: string          // what this IS, visually/thematically (1-2 sentences)
  intent?: string        // what you want to happen here / why it exists (the important one)
}
```

Applied to:
- **`Obj`** (markers: portals, stations, pads, districts, cores, spawns) — gets `name`/`desc`/`intent`.
- **`Zone`** — already has `l` (label); add `desc`/`intent`. (`l` stays the short display label; `name` isn't duplicated.)
- **Sprites** — same `Obj` shape already covers these; `intent` doubles as "why this décor is here" (e.g. "marks the return-to-Kingdom path").
- **Boundary/Collision — the one real model change.** Today it's a flat `Set<string>` of blocked tiles with zero metadata — there's nothing to attach a name to. Upgrade: each brush **stroke** (pointerdown → pointerup while painting) becomes one **named boundary region**:
  ```ts
  type BoundaryRegion = Annotated & { id: string; tiles: string[] /* "x,y" keys from that stroke */; mode: 'block' | 'clear' }
  ```
  Collision storage becomes `Record<mapId, BoundaryRegion[]>` instead of `Record<mapId, Set<string>>`. The render/hit-test logic (union of all regions' tiles) is unchanged; what's new is each stroke is now a **selectable, nameable thing** — it shows up in the Objects list ("north wall", "counter edge"), is editable/deletable individually, and exports with its own `name=`/`intent=`. This is the same "everything you place is a describable object" model markers/zones already have — boundary was the odd one out.

## 3. Inspector UI additions

For whichever thing is selected (object, zone, or now a boundary region), the Inspector gets three new fields under the existing tile/color fields:

| Field | Widget | Notes |
|---|---|---|
| Name | short text input | Prefilled with the id/slug; editable |
| Description | 2-line textarea | "What is this?" — optional, kept short |
| Intent | 2-line textarea | "What do you want here?" — the field that matters most for the export prompt |

Nothing here blocks the fast placement flow — placing a marker/zone/stroke still takes one click/drag exactly as now. These fields are filled in **after**, only when you want the prompt to carry more meaning (a quick placeholder marker can stay nameless; a real "this needs a kitchen counter with 3 prep slots" note goes here).

## 4. The Prompt Starter (new)

A **Project Brief** block, editable per map, prepended to every export. Composed of:

1. **Fixed project line** (same for all 6 maps): *"LashiraBloom — a cozy Stardew-inspired top-down farming RPG, kid-safe."*
2. **Global style anchor** (verbatim from `roadmap-and-build-plan.md`, reused, not rewritten):
   > *"Cozy-cute fantasy pixel art basemap, same style as LashiraBloom kingdom hub, bright saturated but soft palette, top-down 3/4 RPG farm-game perspective, readable tile-like layout, painterly pixel detail, lush nature borders, warm paths, clean navigable spaces, kid-safe, no UI."*
3. **Grid + coordinate convention** (fixed, factual): *"60×48 tiles. [0,0] is the top-left tile; x increases right, y increases down. This editor draws at 22px/tile; the game renders at 48px/tile — coordinates are tile units, not pixels, in both."*
4. **Per-map Scene** — one paragraph, **editable**, defaulted from real sources:
   - Kingdom: a factual description grounded in what's actually on `basemap.png` (farm plot, garden/greenhouse, mine, fountain plaza, pens, martial-south arena band) — pulled from the already-written visual analysis in `MAP-full-element-inventory.md`, not re-invented.
   - The 5 realms: default to their **original generation-brief Scene text** from `roadmap-and-build-plan.md` §7.1–7.5 (Bloomwall's winding-road-to-core description, Kitchen's pantry/stove/serve layout, etc.) — already accurate, already written, just surfaced here instead of buried in a different doc.
5. **A short "how to read this" instruction line** for whoever gets handed the prompt: *"Each row below is one authored element. `intent=` says what the operator wants — treat it as the instruction; the rest is positional/visual data."*

This whole block is **editable in the UI** (a small expandable panel above the export, "Prompt Starter ✎") so you can tweak wording per map, but it always starts from the grounded defaults above rather than a blank box.

## 5. Updated DSL shape (example)

```
LASHIRA OPENWORLD MAP BRIEF
Project: LashiraBloom — cozy Stardew-inspired top-down farming RPG, kid-safe.
Style: Cozy-cute fantasy pixel art, bright saturated but soft palette, top-down 3/4 RPG
  perspective, painterly pixel detail, clean navigable spaces, no UI baked into art.
Grid: 60x48 tiles. [0,0]=top-left. x→right, y→down. Coordinates are TILE units.
Map: hearthrush_kitchen · Hearthrush Kitchen · cooking / service
Scene: A warm tavern-market kitchen connected to a small serving hall — pantry along
  the left wall, stove/oven row top-center, two prep tables mid-room, serving hall +
  dining tables on the right, separated by a partition wall.
Read: each row below is one authored element; intent= is the instruction, the rest is
  positional/visual data.

OBJECTS
  pantry             tile=[24,30] kind=station icon=🧺 name="Pantry" desc="Ingredient shelves and crates" intent="Grab raw ingredients here — first step of the serve loop"
  stove               tile=[29,30] kind=station icon=🔥 intent="Cook a grabbed ingredient into a dish"
ZONES
  new_zone            rect=[3,14..16,27] color=#5fa06a label="Serving Hall" intent="Dining area — should read as separate from the kitchen work zone, maybe a floor-texture change"
COLLISION
  wall_north          tiles=14 mode=block name="North wall" intent="Blocks the kitchen's back counter run — matches the art's stone wall"
```

Only fields that are actually filled in get printed (no empty `name=""` clutter) — same discipline the current export already has for `note=`.

## 6. Sequencing (small, in order)

1. Extend `Obj`/`Zone` types with `name?/desc?/intent?`; add the 3 Inspector fields for objects + zones (smallest change, immediately useful).
2. Boundary model change: `Set<string>` → `BoundaryRegion[]` per stroke; wire it into the Objects list + Inspector + export (the one real refactor here).
3. Prompt Starter panel: static defaults per map (Kingdom from the inventory doc, 5 realms from the roadmap doc's Scene text), editable textarea, prepended to the DSL export.
4. Update `dsl` export builder to print the new fields + the BRIEF header.

Nothing here changes the canvas, tools, zoom/pan, or manifest loading that's already working — purely additive to the data model, Inspector, and export string.
