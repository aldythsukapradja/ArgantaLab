# V1a Polish — Real WebGL 3D + Full Interactivity + Premium (LOCKED)
2026-07-22 · Founder directive: "visual and interactivity is the key — premium wow effect. No normal SVG render. This is the standard operating system." See memory `arganta-energy-visual-sop`.

## Mandate (applies to every fielddev viewer)
Every visualization must be **interactive, polished, premium**. NO static SVG for data (SVG only for chrome/icons/badges). Real WebGL where 3D is claimed. High-DPI canvas everywhere. Smooth, reduced-motion-safe transitions. Both themes. No layout collisions.

## Deps (match the monorepo hq versions)
`three@^0.160.1  @react-three/fiber@^8.18.0  @react-three/drei@^9.122.0` in apps/energy. Also `@types/three`. The 3D scene is code-split (lazy import inside the Map 3D view) so the base bundle stays lean.

## 1 · Map 3D — REAL WebGL (replace the isometric fake)
When the Map "3D" toggle is active, mount a real react-three-fiber `<Canvas>` (lazy-loaded):
- **Surface mesh** from the active grid (`wb/surface-*.json`, nx×ny, 50 m cells): a `BufferGeometry` PlaneGeometry deformed by z (TVDSS), null cells left as holes/NaN (skip triangles). Depth-colored by the same token colormap as 2D; smooth vertex normals for lighting.
- **Vertical exaggeration** slider (×1–×20), live.
- **Multiple surfaces** stackable (Hugin Top/Base/BCU) with per-surface opacity; wells as real 3D tubes/lines from trajectories (dispEw/dispNs/tvd), colored by role, with billboarded labels (drei `<Html>` or `<Billboard>`); planned wells dashed/scenario.
- **OrbitControls** (drei) — orbit, pan, zoom-to-cursor, damping; a "reset view" + "top view" button. Subtle directional + ambient light; hemisphere for realism. Optional wireframe toggle.
- Hover a cell → readout (x,y,z, surface). Grid/graticule floor optional.
- Label it "3D · WebGL" (it IS real 3D now — the honest label changes from "isometric projection").
- Theme-aware background (transparent → shows app bg); reduced-motion disables auto-rotate only (controls still work).
- Keep the 2D structural map exactly as-is (it's good) — only the 3D branch changes.

## 2 · Interactive Structural X-Section (currently ZERO interactivity)
The bottom X-section pane must become fully interactive (high-DPI canvas):
- **Zoom** (wheel, zoom-to-cursor on the distance axis + depth axis), **pan** (drag), **fit** (dblclick).
- **Hover readout**: crosshair showing distance-along-section, TVD, and the sampled surface depths + which fluid zone (gas/oil/water).
- **Draggable section endpoints** live-update the section (the endpoints live on the Map; dragging them OR dragging directly on the section re-samples). Add draggable **flattening datum** (flatten on a chosen surface).
- Real fluid fills (gas/oil/water) between top/base clipped by contacts, hung real wells within tolerance with pick ties, vertical exaggeration slider.
- Smooth redraw; both themes; premium (subtle gradients for fills, crisp hairlines, legible labels).

## 3 · Interactive Correlation (currently only chip-reorder)
Upgrade the correlation canvas to fully interactive:
- **Synchronized depth zoom/pan** across all wells (wheel + drag), **hover crosshair** with per-well curve readouts at the correlation depth.
- **Drag-to-reorder wells directly on the panel** (not only chips), **per-well depth-shift by dragging**, live flatten-on-marker with animated transition.
- Correlation lines between picks animate on flatten; hover a surface highlights its line across all wells.
- Premium: smooth, high-DPI, token colors, both themes.

## 4 · Fix Analytics overlap + make premium
Bug: the Crossplot drawer (380px, in-flow) and the Inspector (`aside`, in-flow 296px) collide when both open (crossplot renders over the inspector).
- Fix layout so they NEVER overlap: when Analytics opens, it takes a dedicated right region; the Inspector and Analytics are mutually exclusive OR stack cleanly (e.g. Analytics replaces the Inspector, or Analytics is a bottom dock). Simplest robust: **Analytics = a bottom dock** under the tracks (full width, resizable) OR a proper modal/overlay with backdrop — pick one, ensure zero overlap at all widths + mobile.
- Crossplot itself must be premium-interactive (it already lasso/box-selects → keep; add: axis-curve pickers styled, density hexbin toggle at high N, GR color ramp legend, hover point readout, clear selection button). High-DPI canvas.
- The 3D crossplot (three-axis) should also be real WebGL r3f (small point cloud, orbit) rather than an orthographic canvas projection — reuse the r3f setup.

## 5 · Cross-cutting premium bar
- All canvases devicePixelRatio-scaled (crisp on retina). Smooth 60fps interactions (rAF-gated redraws, no thrash). Transitions eased + reduced-motion-safe. Token colors only, verified light+dark. Every value keeps its dataNature badge. No console errors on fresh load (restart dev server to clear stale HMR/StatusBar buffer before judging).

## Acceptance (browser-verify, screenshot each)
1. Map 3D is REAL WebGL: orbit/pan/zoom works, surface mesh lit + depth-colored, vertical-exag slider live, wells in 3D, "reset/top" view. (Not isometric.)
2. X-section: wheel-zoom + drag-pan + hover crosshair readout + draggable endpoint live-update all work.
3. Correlation: synchronized zoom/pan + hover crosshair + drag-reorder + flatten animate all work.
4. Analytics: crossplot no longer overlaps the inspector at any width incl. mobile; lasso-select highlights interval; 3D crossplot orbits.
5. tsc clean, build green, both themes, zero console errors (fresh load), high-DPI crisp.
6. Append apps/energy/knowledge/99 Archaeology/2026-07-22-V1a-polish.md.

## Constraints
Don't touch locked files (contracts/, schema-meta, knowledge types/links, scripts/, data-energy/, public/wb/). Don't break the 2D Map/Logs tracks/Knowledge/Data/Cosmonaut. Lazy-load three (code-split). No LLM.
