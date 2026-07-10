# HANDOFF (→ Sonnet) — Openworld Builder v2: pixel-agent Inspector + Prompt Starter + premium Layers

Status: concept + build handoff, **no build yet**. Created 2026-07-10. **Absorbs and supersedes** `PLAN-inspector-fields-and-prompt-starter.md` for implementation — build from THIS doc.

Target file: `apps/hq/src/surfaces/world/OpenworldBuilder.tsx` (+ `openworld-builder.css`). The zoom/pan canvas, 6 map tabs, tools, manifest loading (`openworld-manifest.json`), and export-DSL are already built and working — everything below is **additive** and must not regress them.

---

## 1. The mental-model shift (read first)

The Openworld Builder is not just a coordinate editor. It is an **art-generation authoring tool**: every element you place is a *"generate this asset, at this tile, in this style, with this animation"* instruction that a **pixel agent** (the PixelLab MCP) can execute directly. The Inspector's job is to capture *just enough* for that — with **smart defaults per element kind**, so the operator rarely types more than a name + one intent sentence.

Two outputs from the same placed data:
- **Layout prompt** (what's already there): coordinates + zones + collision → the map wiring.
- **Pixel manifest** (new): per-element generation tasks → hand to PixelLab.

---

## 2. Direct answer: "what does the operator type manually?"

**Principle: pick from selectors (pre-filled by kind), type only Name + Intent (+ occasionally a prompt).** Everything else defaults.

| Element | Auto (from kind) | Selector (pre-filled, changeable) | Free text (optional) |
|---|---|---|---|
| **Sprite** (décor) | class=map-object, dirs=1 | **Sprite type** (catalog, §5), **Animation** (per-type default) | name, intent, prompt-override |
| **Marker → Portal** | class=map-object, anim=idle-glow, ~2×2 | Animation (glow/none) | name, intent |
| **Marker → Station** | class=map-object, anim=state-toggle | **Station subtype** (pantry/stove/serve/prep/sink/oven), States | name, intent |
| **Marker → Pad/District** | class=map-object, anim=none | (asset on/off — some are logical) | name, intent |
| **Marker → Core/Objective** | class=map-object, anim=idle-glow | Animation | name, intent |
| **Marker → Spawn** | class=none (logical, no art) | — | name, intent |
| **Marker → NPC** *(new)* | class=character, dirs=8, view=low-top-down | **Actions** (idle/walk/+talk/farm), body (humanoid/quadruped+template) | name, role desc, prompt |
| **Zone** | — | **Zone role** (label / terrain / trigger); if terrain: **Terrain type** | label, intent |
| **Boundary region** *(new model)* | class=none | Mode (block/clear) | name, intent ("why blocked") |
| **Building / Placement / Harvest** (Kingdom, already-art) | class=map-object, status=has-art | Regenerate? · harvest States=[ready,depleted] | intent (e.g. "make castle fancier") |

So in practice the operator: **clicks to place → optionally picks a type/animation from a dropdown → writes one intent line.** Nothing is required; a quick placeholder can stay bare.

---

## 3. Data model additions (types to add near the top of OpenworldBuilder.tsx)

```ts
// Free-text annotation — every placeable thing can carry these.
type Annotated = { name?: string; desc?: string; intent?: string }

// What a pixel agent needs to GENERATE this element's art. All optional +
// defaulted from `kind` (see §4); the operator only overrides what matters.
type AssetSpec = {
  gen: 'map-object' | 'character' | 'tileset' | 'tile' | 'ui' | 'none'
  kind?: string                 // 'prop' | 'building' | 'station' | 'portal' | 'harvest' | 'npc' | 'terrain' ...
  dirs?: 1 | 4 | 8              // 1 for flat props, 8 for characters/directional
  anim?: {
    type: 'none' | 'idle-loop' | 'state-toggle' | 'walk' | 'one-shot'
    loop?: string               // 'sway' | 'flicker' | 'flow' | 'wave' | 'pulse' | 'steam'
    states?: string[]           // ['ready','depleted'] | ['off','cooking'] | ['closed','open']
    actions?: string[]          // characters: ['idle','walk','talk','harvest']
  }
  view?: 'low top-down' | 'high top-down' | 'side'  // default per gen (§6)
  prompt?: string               // the visual generation prompt (seeded from style+scene)
  status: 'has-art' | 'needs-art' | 'placeholder'
}

// Extend the existing Obj + Zone with these:
type Obj  = { /* existing: id, kind, x, y, w?, h?, hitR?, icon?, color? */ } & Annotated & { asset?: AssetSpec }
type Zone = { /* existing: id, x, y, w, h, c, l */ } & Annotated & {
  role?: 'label' | 'terrain' | 'trigger'
  asset?: AssetSpec             // present when role==='terrain'
}
```

**Boundary is the one real refactor.** Today: `collision: Record<mapId, Set<string>>` — anonymous tiles, nothing to name. Change to **one named region per brush stroke**:

```ts
type BoundaryRegion = Annotated & { id: string; tiles: string[] /* "x,y" keys */; mode: 'block' | 'clear' }
// collision.current: Record<mapId, BoundaryRegion[]>
```
A stroke = pointerdown→pointerup while painting = one `BoundaryRegion`. Render/hit-test = union of all regions' tiles (unchanged behaviour). New: each stroke is a **selectable, nameable object** — it appears in the Objects list ("north wall", "counter edge"), is individually editable/deletable, and exports with its own name/intent. This makes boundary consistent with markers/zones (everything you place is describable).

---

## 4. Type-aware Inspector forms (the core UX)

The Inspector already switches on the selected thing. Extend each branch. Common top section (all types): **Name** input · **Intent** textarea (2 lines) · existing tile/size/color. Then, for art-bearing types, an **Asset** section whose fields depend on `asset.gen`/`kind`, pre-filled from this default table:

| kind | gen | dirs | anim default | states/actions | view |
|---|---|---|---|---|---|
| portal | map-object | 1 | idle-loop · pulse | (opt: dormant/active) | high top-down |
| station:stove | map-object | 1 | state-toggle | [off, cooking] | high top-down |
| station:pantry | map-object | 1 | state-toggle | [stocked, empty] | high top-down |
| station:serve | map-object | 1 | state-toggle | [empty, plated] | high top-down |
| pad / district | map-object | 1 | none | — | high top-down |
| core / objective | map-object | 1 | idle-loop · pulse | — | high top-down |
| spawn | none | — | — | — | — |
| npc | character | 8 | walk | [idle, walk] | low top-down |
| harvest:ore | map-object | 1 | state-toggle | [ready, depleted] | high top-down |
| harvest:tree | map-object | 1 | state-toggle | [ready, stump] | high top-down |
| building | map-object | 1 | none (opt door one-shot) | — | high top-down |
| sprite:* | map-object | 1 | per §5 catalog | — | high top-down |
| zone:terrain | tileset | — | flow if water | — | high top-down |

The **Animation** selector shows only the valid options for that gen (a character can't have `state-toggle`; a prop can't have `walk`). When `anim.type==='state-toggle'`, show an editable **States chip list** (pre-filled). When `character`, show an **Actions chip list**.

---

## 5. Sprite catalog + per-type animation (answers "selector of what type of sprites, what animation")

Replace today's 8-emoji `SPRITE_PAL` with a real catalog. Each entry carries its default animation, so picking a sprite type auto-sets a sensible animation the operator can keep or clear:

| Sprite type | icon | default anim | notes for pixel agent |
|---|---|---|---|
| Tree | 🌳 | idle-loop · sway (optional) | leafy canopy, gentle wind sway |
| Bush | 🌿 | none | |
| Flower bed | 🌸 | none | |
| Lamp post | 💡 | idle-loop · flicker | warm light flicker |
| Lantern | 🏮 | idle-loop · flicker | |
| Bench | 🪑 | none | |
| Rock / Boulder | 🪨 | none | |
| Fence | 🚧 | none | tileable segment |
| Crate | 📦 | none | |
| Barrel | 🛢 | none | |
| Signpost | 🪧 | none | |
| Banner / Flag | 🚩 | idle-loop · wave | cloth wave |
| Fountain | ⛲ | idle-loop · flow | water flow |
| Well | 🪣 | none | |
| Cart / Stall | 🛒 | none | market stall |
| Statue | 🗿 | none | |
| **Custom / NEEDS_ART** | ❓ | none | free prompt, flags a generation task |

The sprite tool's Inspector = **type selector grid** (this catalog) → sets `icon`, `asset.kind='prop'`, `asset.anim` default → operator can flip animation off or write a custom prompt.

---

## 6. Pixel-agent handoff — element.asset → PixelLab tool (grounded in the real MCP)

Mapping (LashiraBloom is a `low top-down` 3/4 farm RPG; game renders 48px/tile, so **PixelLab px = tiles × 48**, capped at 400):

| asset.gen + anim | PixelLab tool(s) | key params the export must emit |
|---|---|---|
| map-object · none | `create_map_object` | description(=prompt), width/height (=tiles×48), view, style-match via basemap crop |
| map-object · idle-loop | `create_map_object` → `animate_object` (mode v3) | + animation_description (=loop, e.g. "gentle water flow"), dirs=1 |
| map-object · state-toggle | `create_map_object` → `create_object_state` ×N | + edit_description per state (e.g. "lit with fire glow and steam") |
| character · walk | `create_character` (view low top-down, 8-dir) → `animate_character` | description, size (px), actions |
| tileset (terrain) | `create_topdown_tileset` | lower_description / upper_description / transition |

New **PIXEL ASSETS** block appended to the export (only elements with `status!=='has-art'`, or all when a "include existing" toggle is on):

```
PIXEL ASSETS · map=hearthrush_kitchen · 2 need art  (px = tiles×48, view=high top-down, style-match to hearthrush-kitchen.png)
1. stove  @ tile[29,30]  size 4x4 (192x192px)
   tool: create_map_object → create_object_state
   states: off | cooking("lit iron cooktop, warm fire glow, rising steam")
   prompt: "cozy pixel tavern stove, stone hearth base, iron cooktop, <STYLE>"
   intent: "Cook a grabbed ingredient into a dish — step 2 of the serve loop"
2. serve_window  @ tile[34,30]  size 4x4 ...
```
`<STYLE>` = the Prompt Starter's style anchor (§7), injected once. This block is directly runnable by a pixel agent — each line names the exact tool + params.

---

## 7. Prompt Starter (the editable BRIEF header)

An editable panel above the export ("Prompt Starter ✎"), prepended to every export. Composed of grounded defaults (never a blank box), reusing text this project already wrote:

1. **Project line** (fixed): *"LashiraBloom — cozy Stardew-inspired top-down farming RPG, kid-safe."*
2. **Style anchor** (verbatim from `roadmap-and-build-plan.md §7`): *"Cozy-cute fantasy pixel art, same style as the LashiraBloom kingdom hub, bright saturated but soft palette, top-down 3/4 RPG perspective, painterly pixel detail, lush nature borders, warm paths, clean navigable spaces, kid-safe, no UI baked into art."*
3. **Grid convention** (fixed): *"60×48 tiles. [0,0]=top-left. x→right, y→down. Coordinates are TILE units; game renders 48px/tile."*
4. **Per-map Scene** (editable, defaulted): Kingdom from `MAP-full-element-inventory.md`'s visual description; the 5 realms from their original `roadmap-and-build-plan.md §7.1–7.5` Scene paragraphs (already accurate — surface them, don't rewrite).
5. **Read-me line** (fixed): *"Each row is one authored element; `intent=` is the instruction, the rest is positional/visual data."*

Store per-map Scene overrides in component state (and, later, persist into the manifest). Defaults live in a small `MAP_SCENE: Record<string,string>` const seeded from the two docs above.

---

## 8. Premium Layers toggle (fix the "crushed circle")

**Problem:** `.owb-layer .eye` is a 22×18 box with a 👁 emoji → reads as a squished oval. Locks use 🔒/🔓 emoji. Not premium.

**Redesign (idiomatic Figma/Photoshop layer panel, using lucide-react which HQ already depends on):**
- **Icons:** import `Eye, EyeOff, Lock, LockOpen` from `lucide-react`. No emoji.
- **Per-layer color chip** (8px rounded dot, left of the name) so layers read at a glance: base `#64748b`, grid `#94a3b8`, zones `#16a34a`, collision `#dc2626`, objects `#6366f1`, sprites `#0d9488`.
- **Visibility toggle** = a real button, 26×24, `border-radius: var(--r-sm)`:
  - visible: `background: linear-gradient(180deg, color-mix(in srgb, var(--acc) 82%, #fff), var(--acc)); color:#fff; box-shadow: inset 0 1px 0 #ffffff55, 0 2px 6px -2px var(--acc);` + `<Eye size={13}/>`
  - hidden: `background: var(--bg); border: 1px solid var(--bd2); color: var(--tx3);` + `<EyeOff size={13}/>`
  - `transition: transform .12s`; subtle scale-pop on toggle; respect `prefers-reduced-motion`.
- **Lock** = ghost icon button, quieter, right-aligned: `<Lock size={13}/>` (red-tinted when locked) / `<LockOpen size={13}/>` (muted); fades in on row hover.
- **Row:** consistent 34px height, capitalized name, count in `font-variant-numeric: tabular-nums`; selected/active layer gets a 2px left accent stripe + faint `--bg3` tint.
- Keep the existing show/hide + lock behaviour wiring; this is purely the visual/markup layer.

(Optional nicety, note only: alt-click a layer's eye = "solo" that layer. Don't build unless time allows.)

---

## 9. Build sequence for Sonnet (phased, each independently shippable)

| # | Phase | Files | Acceptance check |
|---|---|---|---|
| 1 | **Premium Layers toggle** | OpenworldBuilder.tsx (layers render), openworld-builder.css | No emoji in layers; lucide Eye/EyeOff/Lock/LockOpen; per-layer color dot; premium active state; toggles still work |
| 2 | **Annotate objects/zones** — add `name/desc/intent` + Inspector fields | OpenworldBuilder.tsx | Selecting any object/zone shows Name + Intent inputs; editing updates state + export live |
| 3 | **Boundary → named regions** | OpenworldBuilder.tsx | Each paint stroke = one region in the Objects list; selectable/nameable/deletable; render unchanged; exports with name/intent |
| 4 | **AssetSpec + type-aware Inspector** (§3–4 defaults) | OpenworldBuilder.tsx | Selecting a station shows subtype+states; a portal shows glow anim; an NPC shows actions; all pre-filled, all overridable |
| 5 | **Sprite catalog** (§5) | OpenworldBuilder.tsx (SPRITE_PAL) | Sprite tool shows the full catalog; picking a type sets its default animation |
| 6 | **Prompt Starter BRIEF** (§7) | OpenworldBuilder.tsx (+ MAP_SCENE const) | Editable brief panel; grounded defaults per map; prepended to export |
| 7 | **PIXEL ASSETS export block** (§6) | OpenworldBuilder.tsx (dsl builder) | Export lists needs-art elements with the right PixelLab tool + px size + view + prompt |
| 8 | **Verify + regen manifest note** | — | `tsc` + `vite build` clean; `npm run map:sync` still emits a valid manifest; visual pass on Kingdom + 1 realm |

Order rationale: Phase 1 is a self-contained visual win; 2–3 are the data-model groundwork; 4–5 are the pixel-agent UX; 6–7 are the export payoff. Each phase leaves the surface working.

---

## 10. Guardrails (do not regress)
- **Additive only.** Don't touch zoom/pan (the ref-based fix), manifest fetch/normalize, tab switching, or the working DSL blocks — extend them.
- **Fast placement stays fast.** Placing a marker/zone/stroke is still one click/drag; all new fields are optional and edited *after*.
- **Style-lock, don't invent.** Reuse the existing style anchor + Scene text; don't write a new art vocabulary.
- **px = tiles × 48**, PixelLab cap 400 → clamp; note when an object exceeds it (rare, e.g. a big building — split or use a tileset).
- **No PixelLab calls from the builder.** The builder only *emits the prompt*; generation is a separate pixel-agent step (keeps the surface offline-safe and free of API cost).
- Both apps must `tsc` + `vite build` clean after every phase.
```
