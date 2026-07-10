# Simplified Portal Markers + Openworld Builder (HQ)

Status: concept, **no build yet**. Created 2026-07-10, revised same day (HQ adoption + real draw tools). Three connected parts:
1. Re-map the 5 hotspots as **single circular markers**, placed on the real basemap landmarks.
2. **Openworld Builder** adopted as a native **Circle HQ** surface — same visual system as Character Forge / Battle Builder, not a standalone tool.
3. A real **draw toolset** — boundary/collision brush, zone-label regions, sprite stamping — not just drag-a-pin.

Companion ground truth: `INDEX.md`, `portal-hotspot-plan.md`. Supersedes the rectangle+glow hotspot visual from the Codex pass.

---

## PART 1 — Simplified portal markers

### 1.1 The problem with today's model
Today each portal is a **tile rectangle** (`hqHotspot: {x0,y0,x1,y1}`) drawn as a pulsing rectangle glow (`drawWorldPortalGlows`). That is: (a) visually heavy, (b) hard to place precisely, (c) prone to shadowing other hotspots (the BT-1 castle/market bug), and (d) not what you want — you want **one clean circular pin**, like the reference badge.

### 1.2 The new model — one marker, one coordinate
```
portal = {
  id, name, icon, color,
  tile:   [x, y],   // ONE center coordinate (authoring unit) — replaces the rect
  hitR:   1.5,      // tap radius in tiles (circle, not rectangle)
  hqReturn: [x, y], spawn: [x, y],   // unchanged
}
```
`hqHotspot` (the rect) is derived for back-compat; you never author it directly.

### 1.3 The marker visual
A glossy circular badge (~1.4 tiles across) in the portal's color, icon centred, soft shadow + idle bob, name-pill on approach. Replaces `drawWorldPortalGlows` with one `drawPortalMarker(ctx, portal, now)` call per portal.

### 1.4 Correct placement on the CURRENT basemap
Read directly off `public/farm-art/basemap.png` (60×48 tile grid):

| Portal | Real landmark on the art | Center tile | Confidence |
|---|---|---|---|
| `lashira_keep` | Domed silver estate, top-right — the grandest building | `[52, 7]` | ✅ strong |
| `fountain_festival` | The round teal fountain, center-left | `[15, 28]` | ✅ exact |
| `emberring_arena` | Circular stone mandala arena, bottom-right | `[48, 40]` | ✅ exact |
| `bloomwall_pass` | Wooden gate at the north edge of the forest grove, bottom-center | `[30, 33]` | 🟡 good |
| `hearthrush_kitchen` | **No kitchen/market building exists on the current art** | `[30, 16]` *(temp)* | 🔴 art gap |

**The kitchen is the one real problem** — recommend generating a market/kitchen building rather than repurposing an existing hut; it anchors the farm→food→cooking loop visually. The Builder (Part 3) is exactly where you'd flag this and export a PixelLab prompt for it.

### 1.5 What changes (when we build)
- `world-map-registry.js`: each portal gains `tile` + `hitR`; `hqHotspot` derived.
- `farm-map.js`: portal hit-test by circle (`dist ≤ hitR`) instead of rect.
- `FarmRoom.jsx`: `drawWorldPortalGlows` → `drawPortalMarker` (one badge each).
- Launch modal, per-circle lock, RealmRoom: unchanged.

---

## PART 2 — Openworld Builder, adopted as a real Circle HQ surface

### 2.1 Why "adopted," not "a widget bolted on"
HQ already has an established visual grammar for exactly this kind of authoring tool — Character Forge and Battle Builder's Monster Lab. Openworld Builder should **look and feel like a sibling of those**, not an imported gadget:

| HQ convention (from Forge / Battle Builder) | Openworld Builder reuses it as |
|---|---|
| `.forge` / `.battleforge` full-bleed surface (`position:absolute;inset:0`), own theme-aware chrome layered on HQ tokens | `.worldforge` — same pattern, own namespace |
| `.forge-top` header: gradient mark + title/kicker + a right-aligned info chip | World Builder header: world-icon mark, "Openworld Builder / LASHIRABLOOM", a chip showing active map + rev |
| `.forge-tabs` chunky tab cards (icon token `.tn` + label + sub + trailing `.tnum`) | The **6 map tabs** (Kingdom + 5 realms), one card per map, `.tn` = map's accent-colored swatch, `sub` = short role ("hub · launcher", "cooking · service"), `tnum` = tile size |
| `.forge-work` / `.bf-work` 3-column workbench: `250px` roster → flexible stage → `330px` settings | **Left** tool rail + layers/objects list · **Center** the zoomable map canvas · **Right** inspector + export prompt |
| HQ tokens: `--acc` indigo, `--mag` accent pink, `--bg/--tx/--bd` scale, `--r-lg/xl` radii, `--shadow-sm/md` | Used directly — no new palette invented |
| Rail placement: Build group, alongside Game/App/Learn/Agent/Content/Battle Builder, Character Forge | New `SurfaceId: 'world'`, label **"Openworld Builder"**, `full` width like `battle`/`character` |

This means: when we eventually build it, it's `apps/hq/src/surfaces/world/WorldBuilder.tsx` + `world.css` (namespaced `.wf-*`, mirroring `battle.css`'s `.bf-*` so the two builders' CSS never collide in the shared bundle — the same lesson already learned building Battle Builder).

### 2.2 The 6 tabs (data-driven, scalable)
| Tab | Map | Role / sub | Authors |
|---|---|---|---|
| Kingdom | `basemap.png` | hub · launcher | 5 portal markers, resource zones, collision, décor |
| Lashira Keep | `lashira-keep.png` | city · stronghold | district pads, collision, spawn/return |
| Bloomwall Pass | `bloomwall-pass.png` | defense · adventure | path, tower pads, core, collision |
| Hearthrush Kitchen | `hearthrush-kitchen.png` | cooking · service | stations, walk lanes, collision |
| Fountain Festival | `fountain-festival.png` | puzzle · events | board anchor, décor, collision |
| Emberring Arena | `emberring-arena.png` | social competition | spawn corners, cover, objective |

Adding realm #6 later = one more tab, generated from the same manifest — no new UI code.

### 2.3 The canvas (Google-Maps feel — unchanged from the first pass)
Wheel/pinch zoom (zoom-to-cursor, 0.25×–4×), drag-to-pan, toggleable 60×48 grid (bold every 5 tiles), live `[x,y]` cursor readout, snap-to-tile-center by default, minimap for large maps.

---

## PART 3 — The real builder toolset

This is the part that was missing from the first pass (which only supported dragging existing pins). The left tool rail gets a genuine **tool palette**, each tool emitting a specific DSL verb:

| Tool | Icon | Interaction | DSL verb it emits |
|---|---|---|---|
| **Select / Pan** | ↖ | Default. Click a marker/region to select + edit in the inspector; drag empty canvas to pan. | *(none — navigation only)* |
| **Place marker** | 📍 | Click to drop a marker; a type picker (portal / station / pad / spawn / district / objective) sets its kind before placing. | `PORTALS:` / `OBJECTS:` add |
| **Zone / label region** | ▭ | Drag out a rectangle; on release, the inspector asks for a label + color; committed as a named, tinted region. | `ZONES:` add/update |
| **Boundary / collision brush** | 🧱 | Paint mode: drag across tiles to mark them **blocked** (red) or **walkable** (green, eraser toggle); brush size 1/3/5 tiles. | `COLLISION:` add/remove (per-tile or run-length) |
| **Sprite stamp** | 🌳 | Pick a sprite from a small palette strip (tree / lamp / bench / rock / banner / fence / **+ custom / NEEDS_ART**); click a tile to stamp it; drag to nudge. | `SPRITES:` add, with `note="NEEDS_ART"` when no real asset is chosen yet |
| **Measure** | 📏 | Click two points; shows tile distance + a faint guide line. Ephemeral — never exported. | *(none — reference only)* |

### 3.1 Inspector is context-sensitive
- **Tool active, nothing selected** → shows that tool's settings (brush size, sprite palette, default zone color).
- **Object selected** → shows its fields: tile `[x,y]`, hitR, color, icon, kind-specific extras (e.g. a district's `level`, a zone's `label`+`color`).
- Every field edit re-renders the export prompt live — the inspector and the DSL panel are the same state, two views.

### 3.2 Layers panel (left rail, below tools)
Same show/hide/lock affordance as before, now mapped 1:1 to what the tools produce: **Base map · Grid · Collision · Zones · Portals/Objects · Sprites**. Locking a layer disables its tool (can't paint collision while the Collision layer is locked) — this is the safety rail that stops you from fat-fingering the wrong layer while focused on another.

### 3.3 Export prompt — extended grammar
Same coordinate-first, diff-friendly DSL as before, now with real verbs for boundary + zones + sprites:

```
LASHIRA OPENWORLD EDIT · map=kingdom · rev=8 · grid=60x48
PORTALS
  lashira_keep       tile=[52,7]  icon=🏰 color=#7c6cff hitR=1.6
  hearthrush_kitchen tile=[30,16] icon=🍽 color=#f6a42c hitR=1.5  note="art gap: needs market building"
ZONES
  sunseed_farm   rect=[7,5..26,16]   color=#7a5a34 label="Sunseed Farm"
  keep_estate    rect=[46,3..58,16]  color=#5fa06a label="Keep Estate"
COLLISION
  add   run=[0,0..59,0]     # north border
  add   run=[22,24..27,29]  # fountain base (blocked ring)
  remove tile=[24,26]        # bridge tile is walkable
SPRITES
  lamp_01   sprite=lamp        tile=[24,20]
  banner_01 sprite=NEEDS_ART   tile=[38,33] note="generate south-gate banner"
```

### 3.4 Data model (unchanged shape, now the tools write to it)
```
openworld-manifest.json
{ version, maps: {
  kingdom: { image, grid:[60,48], portals:[…], zones:[…], collision:[…], sprites:[…] },
  …one entry per realm…
}}
```
Builder = editor over this manifest; "Export Prompt" = serialized pending diff. Game's registry/collision/module coords are generated from / synced to this manifest — no drift, no hand-maintained duplicate.

---

## Build phases (later, when you say go)
1. **Mockup** (this turn) — HQ-skinned interactive canvas: tabs, 3-col workbench, all 6 tools working, live layered rendering, live DSL export.
2. **Real HQ surface wiring** — `SurfaceId:'world'`, Rail entry, `WorldBuilder.tsx` + `world.css` (`.wf-*` namespace), reusing `MonsterStage`-style patterns where applicable.
3. **Kingdom tab, real basemap** — load the real PNG, place the 5 markers + collision + zones, export, wire into the game (fixes BT-1/BT-6 for real).
4. **Realm tabs** — stations/pads/path authoring per realm.
5. **Manifest sync** — game reads the manifest directly at runtime.

## Immediate decision surfaced by the mapping
The **kitchen has no building on the basemap.** Recommend generating a market/kitchen (option A) over repurposing a hut (option B) — the Sprite/`NEEDS_ART` tool is built specifically to carry this kind of gap into a PixelLab prompt cleanly.
