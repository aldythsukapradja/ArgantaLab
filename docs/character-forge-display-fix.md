# Character Forge — Display Bug Fix Plan

**Date:** 2026-07-18 · **Status:** diagnosed, fix planned, not yet applied

## Symptom (founder screenshot)

Character Lab renders broken: the stage column collapses to ~0 width, the pickers column
overlaps the users column, the stage's absolutely-positioned overlays (WASD hint, Ride pill,
Stand/Walk/… action row, speed/zoom sliders, Emote/Reset) pile up in a vertical strip over
the left panel, and the right two-thirds of the surface is empty.

## Root cause — global CSS class collision (confirmed in code)

Vite bundles every imported CSS file globally. Two surfaces define the same class names:

| Class | Character Forge (`surfaces/character/forge.css`) | Builder Forge (`surfaces/forge/forge.css`, shipped with Builder v2) |
|---|---|---|
| `.forge` | `position:absolute; inset:0; flex column` | `height:100%; flex column; background:var(--builder-grad)` |
| `.forge-body` | plain block, `flex:1; overflow:auto` | **`display:grid; grid-template-columns:minmax(280px,340px) 1fr auto; overflow:hidden`** |
| `.forge-title` | block with sub-label | flex row (scoped under `.forge-head`, but reverse-collides) |

The killer is `.forge-body`: Builder Forge's grid rule wins (later in the bundle), so
Character Forge's body becomes a 3-track grid. Its single child `.forge-work` (itself a grid
`250px minmax(0,1fr) 330px`) is placed into the first ~340px track; the `1fr` stage track
resolves toward 0 and the content overflows at min-content width (~580px) — exactly the
screenshot. `overflow:hidden` also replaces the intended scroll. This is the **same disease**
already annotated inside forge.css for SkillForge (".forge and .battleforge use inset:0…")
— third occurrence of the un-namespaced-CSS pattern.

## Fix plan

1. **Namespace Character Forge's shell classes** (rename in `character/forge.css` +
   `CharacterForge.tsx` only — 5 classes, ~20 usages):
   `.forge → .charforge`, `.forge-top → .cf-top`, `.forge-tabs → .cf-tabs`,
   `.forge-tab → .cf-tab`, `.forge-body → .cf-body`, `.forge-title/.forge-mark/.forge-inv →
   .cf-title/.cf-mark/.cf-inv`. Inner `.f-*`/`.fcol` names are currently unique — leave them,
   but grep-verify against all other `*.css` first.
2. **Do not touch Builder Forge** — it's newer, larger, and its names are used by ForgeShell,
   ChatRail, Inspector, StarterGallery.
3. **Regression sweep for the pattern:** grep every surface CSS for duplicate top-level
   class names across files (`.forge`, `.battleforge`, `.f-*`, `.pbx*`, `.sf-*`); log any
   further collisions in this doc. Cheap insurance: agree the convention *every new surface
   prefixes its classes with a unique 2–4 letter slug* (post.css already does this right
   with `.pbx-*`).
4. **Verify:** hq dev server → Character Forge: 3 columns render (users 250px · stage fluid ·
   pickers 330px), stage canvas animates, overlays anchor to the canvas corners; then check
   Builder Forge (Game/App) still renders its rail·canvas·inspector grid; `tsc && vite build`
   clean.

Effort: ~30 minutes including verification. Zero data risk (CSS + class strings only).
