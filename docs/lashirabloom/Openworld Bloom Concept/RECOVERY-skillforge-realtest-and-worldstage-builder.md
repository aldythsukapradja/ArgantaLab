# Recovery Plan — Skill Forge (real skill test) + World Stage (= Openworld Builder)

Status: recovery plan, **no build yet** — decisions locked, ready to build. Created 2026-07-10.

## Locked decisions (2026-07-10)
1. **Skill Forge scene** → **one shared real-duel arena** (caster faces target on a single base-map ground), not two side-by-side panels.
2. **World Stage surface** → **renamed to "Openworld Builder"** (`SurfaceId` stays `'world'`, label + content change).

## 0. What I got wrong (owning it)

I built **World Stage** as a *character-animation preview* on the real map (Skill 1 swings, Skills 2/3 cast). That put the right feature in the wrong home. Correcting the two surfaces:

| Surface | What it's actually FOR | My mistake |
|---|---|---|
| **Skill Forge** (Character Forge tab) | Testing the character's skill **animation for real** — the caster performs the skill, and the effect (self-heal / target-damage) is simulated on a **base-map** backdrop. | I never touched it. The caster is still a static pose (see §1) — the real "make it come alive" work belongs *here*, not in a new surface. |
| **World Stage** (new Build surface) | The **Openworld Builder widget** — map *all* the components (buildings, zones, hotspots, portals, harvest nodes, sprites) + interactions, on a zoom/pan canvas, exporting a prompt. This is the widget concept from `CONCEPT-portal-markers-and-openworld-builder.md`. | I built a character-preview here instead of the builder. Wrong content entirely. |

**What survives (not wasted):**
- Part A (the *game* fix: `doSkill` → `playCast` casts Spell; realm modules call `api.playMotion`) was correct and stays.
- The map PNGs I copied into `apps/hq/public/farm-art/` are needed by the **real** World Stage builder — keep them.
- The surface wiring (`SurfaceId: 'world'`, Rail/Shell/MobileNav/CommandPalette entries) stays — only the label + the component it renders change.
- The `attackMotionBase`/`castMotionBase` motion-resolution logic moves into Skill Forge's caster.

---

## 1. Skill Forge — make the skill test REAL

### 1.1 Current state (grounded in `apps/hq/src/surfaces/character/SkillForge.tsx`)
- **Caster** = the operator's real hero via `CompositeStage`, but with a **hardcoded static motion**: `slot.kind === 'heal' ? 'SpellSouth' : 'NormalStandBySouth'`. So damage skills show the hero *idle* (hence the "idle — not this skill's target" caption in your screenshot) and heal shows a *looping* SpellSouth. It never actually *performs* the selected skill.
- **Target** = a real monster (`MonsterStage`, boar + 2 flanks for Multi) just standing, with the fx (`EffectLivePreview`) floating statically over it. No hit reaction, no damage popup.
- Background is the transparent CompositeStage checker — not a "base map".
- No trigger — nothing plays on demand.

### 1.2 Target design — a real cast, on a base-map backdrop
Turn the two static viewers into one **base-map mini-arena** that plays the skill on demand.

1. **Base-map backdrop.** Replace the checker with a real ground (a crop of `basemap.png`, e.g. the arena/plaza band, or a dedicated arena tile). Caster stands left, target(s) right — "simulated at the base map", per your words. (Decision flagged in §1.4: one shared arena scene vs. keeping the two side-by-side panels each on a base-map backdrop. Recommend the shared scene — it reads as a real duel.)

2. **A "▶ Cast" trigger** (button, + optional auto-repeat toggle). Pressing it runs the full sequence once, then settles back to idle. This is the "test" the surface was missing.

3. **Caster performs the real skill motion** — your exact contract:
   | Skill | Motion | Body |
   |---|---|---|
   | Skill 1 · Single | `Swing{dir}` (→ Attack/Pierce/Shoot fallback) | sword / weapon strike |
   | Skill 2 · Multi | `Spell{dir}` | spell cast |
   | Skill 3 · Heal | `Spell{dir}` | spell cast |
   Play **once** then return to `WeaponStandBy{dir}` idle — mirrors the game's `oneShot`. Uses the same `attackMotionBase`/`castMotionBase` resolution the game + RealmRoom use (single source of truth), with graceful fallback if a hero lacks Spell frames.

4. **Effect fires on the impact frame** (not always-on). Reuse `EffectLivePreview` with the selected `fx`, triggered mid-cast so it reads as *caused by* the swing/cast.

5. **Reaction — the "for self / for target" simulation:**
   - **Damage (Skill 1 single / Skill 2 multi):** the target monster **flashes + shakes**, a floating **damage number** (`tierDamage`, already computed) rises and fades. Multi → all shown targets react.
   - **Heal (Skill 3):** the caster gets a **green flash** + floating **+heal number** (`tierDamage`) — the self-target case.

6. **Everything else unchanged.** Path/tier/resist/benchmark/publish all stay — this is purely bringing the existing viewer to life. The numbers driving the popup (`tierDamage`, `pathMul`, resist) are already computed in the file.

### 1.3 The one shared-package seam
`CompositeStage` (`packages/heroes-engine`) currently only **loops** a motion (`playing` on/off) — there's no "play once then stop/callback". Two clean options:
- **A (preferred):** add an optional `oneShot?: boolean` + `onComplete?: () => void` to `CompositeStage` — when set, it plays the motion through `stepCount` frames once and calls back. Small, additive, benefits Character Lab too.
- **B (no package change):** drive it from Skill Forge via the existing `onStep(stepIndex, n)` callback — when `stepIndex === n-1`, flip the parent's motion state back to idle. Slightly hackier but zero shared-package risk.

Recommend **A** — it's the honest primitive and other surfaces will want it.

### 1.4 Open decisions for you
- **One shared arena scene** (caster faces target, one base-map ground) **vs. two panels** each on a base-map backdrop. (Recommend shared scene.)
- **Projectile travel** for ranged (bolt flies caster→target) vs. effect-at-target only. (Recommend effect-at-target first; projectile later.)
- Which **base-map crop** is the arena backdrop (the martial-south sand band at `y33–45` is the natural "arena" ground).

---

## 2. World Stage → Openworld Builder

### 2.1 The move
**Gut** the current `apps/hq/src/surfaces/world/WorldStage.tsx` character-preview and rebuild it as the **Openworld Builder** — a React/TS port of the interactive mockup (`scratchpad/openworld-builder.html`) into the real surface, wired to real assets. Rename the surface label `World Stage` → **`Openworld Builder`** (matches the mockup and your screenshot); keep `SurfaceId: 'world'` and the Map icon.

### 2.2 What it contains (from the mockup, now real)
- **6 map tabs** — Kingdom + 5 realms — using the **real PNGs** already in `apps/hq/public/farm-art/` (basemap + Worldmap/*).
- **Google-Maps canvas** — wheel/pinch zoom (zoom-to-cursor), drag-pan, 60×48 grid overlay, live `[x,y]` tile readout.
- **Tools** — Select/Pan · Marker · Zone (drag a labelled region) · Boundary (collision brush, 1/3/5) · Sprite (stamp, incl. `NEEDS_ART`) · Measure.
- **Layers** — Base / Grid / Zones / Boundary / Portals+Objects / Sprites — show/hide/lock.
- **Objects list + Inspector** — edit a selected object's tile/label/color/hitR.
- **Export prompt** — the coordinate-first, diff-friendly DSL you paste back to me.

### 2.3 The key upgrade over the mockup — "map ALL the components"
The mockup seeded each map with a handful of demo objects. The real builder must **start populated with every real element**, so it's a true 1:1 authoring mirror. Source that from a **shared `openworld-manifest.json`**:
- Generate it from the **same source** the `MAP-full-element-inventory.md` generator already reads (`farm-map.js` buildings/zones/placements/hotspots/harvest-nodes, `world-map-registry.js` portals, `realms/*` station/pad/district coords) — extend `apps/lashira/web/scripts/gen-map-inventory.mjs` to also emit JSON, or add a sibling `gen-openworld-manifest.mjs`.
- Ship that JSON where HQ can import it (a small shared location or copied into `apps/hq/public/`), and the builder **loads objects from it** instead of demo stubs.
- Editing in the builder → **Export prompt** (a diff) → I apply back to code, and/or the game reads the manifest directly. This is the scalable spine the concept doc already described (builder + game read one manifest, no drift).

### 2.4 Why it can't be an Artifact (already learned)
claude.ai Artifacts are network-sandboxed — they can't fetch the real basemap PNGs or a 60×48-tile manifest. The builder needs real assets, so it lives as a real HQ surface (same reason Character Forge / Battle Builder are real surfaces, not mockups).

---

## 3. Sequencing (when you say build)

| # | Step | Size | Why this order |
|---|---|---|---|
| 1 | **Skill Forge real test** — base-map backdrop + Cast trigger + caster one-shot (Swing/Spell) + target/self reaction + fx-on-impact | Medium | Self-contained, high value, uses data already in the file; the `CompositeStage` one-shot seam (§1.3) is the only shared-package touch |
| 2 | **`openworld-manifest.json` generation** — extend the inventory generator to emit JSON | Small | Data seam the real builder needs; independent of UI |
| 3 | **World Stage → Openworld Builder** — port the mockup to the real surface, seed objects from the manifest | Large | Biggest piece; depends on step 2 for real data |

## 4. Net effect
- Character skill animation testing goes where it belongs (**Skill Forge**) and becomes a *real* cast-and-react sim on a base map — matching your "the skill test needs to be real" ask.
- **World Stage** becomes the **Openworld Builder** you actually asked for — every component mapped, editable, exportable.
- Nothing built yet — this is the plan for your review.
