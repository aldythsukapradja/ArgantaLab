# Kingdom — Client Asset Consolidation + Character Lab (concept, no build)

Date: 2026-07-03. Companion to `REBUILD-STRATEGY.md` (§2 data model, §4 audits).

---

## 1. Two extractions, one verdict

| | **Claude extraction** (`Baginda's App\Nexus\app\assets\extracted`, 683 MB) | **Codex extraction** (`RPG\Prototype\assets\nexustk-client\pixel-art`, 525 MB) |
|---|---|---|
| Colors | Canonical (DSC/DNA/TBL palette per part/mob/icon) | `canonical/` correct; `needs-mapping/` (489 MB) rendered with probe palettes — **self-flagged as not canonical** |
| Segmentation | Per item/part/mob/effect (2,946 parts, 2,013 mobs, 53 mounts, 648 effects) | Whole archive = one sheet (mon0.dat → one 4083×685 PNG) |
| Animations | Full (motion-keyed frames per part, DNA anims, effect delays) | None (frame rects only) |
| Re-dye support | Yes (`.idx.png` index sheets + palettes.json) | No (flattened RGBA) |
| UI kit / login art | ✗ not extracted | ✅ `canonical/ui/` — bint0-2 (buttons, bars, gauges, fonts, boat), baram, baramst, mnm |
| World & field maps | ✗ not extracted | ✅ `canonical/maps/` — wm (5 world maps), misc FIELD1-18 |
| Misc skill-effect singles (CHREFX etc.) | partially (MAGEFX wired long ago) | ✅ `canonical/skill-effects/misc` |
| Tiles | format solved, run pending (`--tiles`) | `needs-mapping/maps` (51 sheets, probe colors) — superseded |
| Item icons | ✅ 5,879 shelf-packed + per-icon palette | 1 sheet, needs-mapping — superseded |

**Combine rule (no re-extraction needed):**

- **KEEP from Codex:** `canonical/` only (36 MB). It covers exactly the three
  things the Claude extractor skipped — UI kit, world/field map art, misc
  effect singles — and its `*.frames.json` (frame rects + EPF offsets) is a
  compatible metadata shape.
- **SUPERSEDE:** everything in `needs-mapping/` (489 MB). Wrong colors,
  no segmentation, no animation — every archive in it already exists in
  canonical per-part form in the Claude library. Do not copy; leave in place
  or delete later.
- **STILL MISSING from both:** tiles (run `extract_all.py --tiles`), audio
  (`mus0-6.dat`, `snd.dat` — small extractor addition), `head0/1.dat`
  pre-composed heads (optional, character-creation preview art only).

---

## 2. Consolidated layout under `apps/kingdom/`

All binary assets stay local-only (existing `data/.gitignore` policy: IP
rules, repo size). Tracked in git: schemas, links, overrides, scripts, docs.

```
apps/kingdom/data/
  core/                 scrape snapshot (exists, ignored)
  client/               NEW — client library (ignored, ~750 MB)
    char/<category>/    part_NNNN.png + .idx.png + parts.json + palettes.json   ← copy from Claude extraction
    monsters/  mounts/  effects/  items/                                        ← copy from Claude extraction
    tiles/              ← after --tiles run
    ui/  worldmaps/  fieldmaps/                                                 ← copy from Codex canonical/
    audio/              ← future
    manifest.json       motions + layers + haircol + provenance of every folder
  links/                NEW — tracked join tables (monster-links, item-links,
                        skill-links, part-item-links; curated, small)
  overrides/            hand tuning (exists, tracked)
  derived/              build output the app loads (ignored, regenerated)
scripts/
  build-client.mjs      NEW — copies/refreshes data/client from the two sources,
                        normalizes Codex frames.json into the parts.json shape,
                        stamps provenance (source, extractor, date, colorStatus)
  match.mjs             NEW — image-hash auto-linking (items, monsters)
  audit.mjs             NEW — orphans/gaps/conflicts report → derived/audit.{md,json}
```

Provenance rule: every folder in `data/client/` carries `source:
"claude-extractor" | "codex-canonical"` in the manifest, so a future
re-extraction can replace one slice without touching the other.

## 3. Unified schema (the shapes `derived/` is built from)

One entity table per kind; ids are stable strings. Client-side shapes are
already emitted by the extractor; this just names them.

```jsonc
// data/client — already exists (extractor output), normative shape:
Part      { id, category, palette_id, frame_index, frame_count,
            sheet, idx_sheet, cell_w, cell_h, cols,
            frames: [{x,y,fx,fy,w,h}|null],
            animations: { "<MotionName>": [{frame,flag,aux}] } }
Mob/Mount { id, palette_id, sheet, idx_sheet, frames,
            chunk_count, animations: { death|stand_*|walk_*|hit_*|attack_*
                                       : [{frame,duration,transparency}] } }
Effect    { id, sheet, frames, animation: [{frame,delay,phase,palette_id,alpha?}] }
Icon      { x,y,w,h, palette_id }                    // items/items.json
Motion    { id, name, steps: [{tag, layers:[layerId]}] }   // manifest.json
Layer     { layer_id, name, slots }                        // manifest.json

// data/links — the only join surface (tracked):
MonsterLink { monsterId, mobId, paletteId?, method, score, status }
ItemLink    { itemId, iconIndex, paletteId?, equipRef?  // e.g. "coat:12"
            , method, score, status }
SkillLink   { skillId, effectId, iconIndex?, method, status }
PartTag     { partRef, tags:[ "female"|"clothed"|"npc-only"|... ], notes }

// data/derived (build output = what React/Kingdom Command load):
Monster = core.monster ⊕ links.monster → client.mob ⊕ overrides
Item    = core.item    ⊕ links.item    → client.icon/part ⊕ overrides
Skill   = core.skill   ⊕ links.skill   → client.effect ⊕ overrides
Map     = core.map (graph/images) ⊕ future tileMap
```

## 4. Audit spec — "what's missing" as a permanent report

`audit.mjs` runs after every build; output is a scoreboard, not prose:

| Check | Expected finding |
|---|---|
| Scraped monster without mobId link | ≈0 after matching (each is a bug or post-2016 content) |
| Client mob without monster (orphan pool) | ~1,300 — browsable "casting pool" in the Lab |
| Scraped monster without XP / drops | 50 / 115 (known) |
| Item without icon link · icon without item | targets: 0 · ~5,200 orphan icons |
| Equippable item without part link (can't be worn) | drives PartTag curation |
| Skill without effect link / without icon | most of 227 initially — manual queue |
| Part with empty animation for a motion its category should have | extractor sanity |
| Dye-base icon whose true palette was recovered via GIF match | fixes "purple shirts"; report count |
| Maps without images (37), tracked requirement gaps (22) | carried from core |
| Stats missing everywhere: monster HP/dmg, item combat stats | by design → overrides queue, XP-anchored |

Every audit row links to the entity in Kingdom Command so a human can fix or
accept it. The report is the to-do list for the overrides layer.

---

## 5. Character Lab (the tester) — concept

Purpose: test **every** extracted pixel with real animations. One screen,
two modes: **Composer** (assemble) and **Test Room** (walk it around).

### 5.1 Slot groups (user-facing grouping)

| Group | Slots underneath | Source counts |
|---|---|---|
| **Body** | body (449, incl. female), shoes (53), skin dye (Body.pal slots) | client |
| **Head** | face (39), hair (174) + hair color (30 good), helmet (152), facedec (57), hairdec (516) | client |
| **Coat** | coat (430) + coat dye (245 slots), mantle (163), neck (38) | client |
| **Weapon** | sword 437 / spear 126 / bow 138 / fan 22, shield (56), arrow (6) | client |
| **Effects** | spell effect overlay (648, with real timing), emotion bubble (39) | client |
| **Mount** | 53 ridings; auto-switches motion set to Riding* | client |

Each slot: ◀ ▶ stepper + searchable grid popup + dye swatch row where the
category has palettes + "none". Every option shows its link badge:
`named` (linked to a scraped item), `orphan`, `suspect` (audit flag) — so
testing doubles as curation.

### 5.2 Animation controls

- **Action bar** (motion groups from Motion.tbl): Stand · Walk · WeaponWalk ·
  Swing · Pierce · Shoot(bow) · Get · Spell · Ride · Bow · Kiss ·
  Emote ▾ (Victory, Smile, Cry, Blush, Wink, Yawn, Sleep, Surprise, Angry,
  Merong, Kongi, Pish, Dance, Cold, HandToMouth)
- **Direction**: S · N · E · W + auto-rotate; **Speed**: 0.25×–2×; **Step
  scrubber** to freeze any step of a motion.
- Renderer follows the client spec exactly: per step, draw slots in that
  motion-step's **layer order** (Motion.tbl), each layer's frame from its
  part's chunk for that motion; mount = Riding layer (60); dye = palette LUT
  on the `.idx` sheet.

### 5.3 Wireframe

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ KINGDOM · Character Lab            [Composer] [Test Room]   [Save loadout ▾] │
├──────────────────────────────┬───────────────────────────────────────────────┤
│                              │ BODY   ◀ body 12 (female) ▶  skin ●●●●●       │
│      ┌────────────────┐      │ HEAD   face ◀0▶ hair ◀37▶ col ●●●●● helm ◀—▶  │
│      │   animated     │      │ COAT   ◀ coat 204 ▶ dye ●●●●●  mantle ◀—▶     │
│      │   composite    │      │ WEAPON ◀ sword 88 ▶ shield ◀—▶                │
│      │   (2× zoom)    │      │ MOUNT  ◀ black horse ▶            [none]      │
│      └────────────────┘      │ FX     spell ◀ efx 212 ▾▶  emote ◀ ♥ ▾▶       │
│  ACTION [Stand][Walk][Swing] │───────────────────────────────────────────────│
│   [Pierce][Shoot][Get][Spell]│ frame readout: step 2/4                       │
│   [Ride][Emote ▾]            │  body f.63 · hair f.7 · coat f.63 · fx f.4    │
│  DIR [S][N][E][W] ⟳auto      │ layer order: 57 50 58 … (from Motion.tbl)     │
│  SPEED ▁▂▃  STEP ◀ ▶ ⏸       │ link badges: coat204 = "Sky armor" ✓ linked   │
├──────────────────────────────┴───────────────────────────────────────────────┤
│ strip: all steps of current motion ▦▦▦▦ · [Random outfit] [Orphans only ☐]   │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Test Room** = small tile stage (authentic 48×48 grid): arrows/WASD walk
(NormalWalk or Riding), Space=Spell + chosen effect on self, E=Get crouch,
R=mount toggle, Q=emote loop, number keys = weapon motions (Swing/Pierce/
Shoot). Optionally spawn one monster from the codex to watch its
stand/walk/attack loop next to the character (uses the same Mob schema).

### 5.4 Loadouts & test coverage

- Loadout = small JSON (slot→partRef+dye) saved to localStorage +
  export/import; "Share" copies a permalink hash.
- **Coverage counter** (the tester's real job): tracks which parts have been
  seen animated (per motion) at least once; "next untested" button walks the
  library systematically. Audit report consumes this — a part is `verified`
  once eyeballed in idle+walk+one action.

### 5.5 Tech notes (for when build starts — still concept)

- React + canvas (or PixiJS, proven in KinWorld). One `<CompositeStage>`
  component: inputs = loadout + motion + direction + tick; pure function of
  the schemas in §3 — no engine state in React tree.
- Palette dyeing: build 256×1 LUT textures from `palettes.json`; draw
  `.idx.png` through LUT (WebGL) or precompute tinted canvas per (part, dye)
  on demand with an LRU cache (canvas 2D fallback).
- Data loading: everything through `derived/` (one fetch of a category
  index, sheets lazy-loaded per selection).
- The Lab is Phase P2 of REBUILD-STRATEGY §7 but can ship against
  `data/client/` alone (links optional — badges just show `orphan`).

---

## 6. Execution order when "build" is approved

1. `build-client.mjs` — copy Claude library + Codex `canonical/` into
   `data/client/`, write provenance manifest. (Pure file plumbing.)
2. `extract_all.py --tiles` + audio addition → complete `data/client/`.
3. `match.mjs` (items first, then monsters) → `data/links/*.json` drafts.
4. `audit.mjs` → first scoreboard; review in Kingdom Command.
5. Character Lab (Composer → Test Room → coverage counter).
