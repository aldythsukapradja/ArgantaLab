# Concept — Pinch Zoom · Arena-Entry Fix · Circle Portal Markers

Status: **BUILT + verified (2026-07-11).** All three shipped into
`apps/lashira/web` (see "Build result" at the bottom). Created 2026-07-11. Covers three requests as ONE
coherent change to the openworld hub (`apps/lashira/web/src/game/FarmRoom.jsx` +
`world-map-registry.js` + `farm-map.js`). Extends `CONCEPT-portal-markers-and-openworld-builder.md`
PART 1 — that doc proposed the circular marker; this doc adds the mechanic grounding,
the exact arena bug root-cause, and the pinch-zoom design, and shows how #2 and #3 are
the *same fix*.

---

## 0. How the hub actually works today (mechanics learned)

The openworld hub is a single 60×48-tile canvas (`FarmRoom.jsx`, `TILE=48`,
`WORLD=2880×2304`). It renders the Kingdom basemap + castle + farm field + harvest
nodes + shops, and the player wanders it with a **floating joystick** (press-drag
anywhere = move, quick tap = interact, long-press = tile fan).

Key facts that drive this concept:

- **Camera** (`draw()`, FarmRoom.jsx ~1884): follows the player, centered, scaled by
  `g.zoom` (clamped 0.1–4). `g.cam = {camX, camY, z}` is recomputed every frame and is
  the single source for every screen↔world mapping.
- **Zoom is a Settings slider only.** `const [zoom, setZoom]` (FarmRoom.jsx:278) —
  `0.5` on mobile (≤760px), `1` on desktop. No wheel, **no pinch**. RealmRoom has its
  own `camZoomMul` slider (RealmRoom.jsx:133). Neither reacts to touch gestures.
- **Input is single-pointer.** `onPointerDown/Move/Up` track exactly one pointer via a
  single `ptr` object (FarmRoom.jsx:2340–2377). A second finger *overwrites* `ptr` —
  there is no two-finger path at all today.
- **Interaction dispatch** — `onTapInteract()` (FarmRoom.jsx:2248) runs its checks in a
  fixed order. This order is the whole ballgame for bug #2:
  1. **Dock 🎣 beacon** — screen-space circle hit-test, `goFishing()` (2254–2258)
  2. `if (g.combat.on) { doStrike(); return; }` — **arena tap = sword swing** (2275)
  3. `hotspotAt(tx,ty)` — the rect registry (realms, shops, castle, dock…) (2276)
  4. field tile / animal fallbacks
- **`hotspotAt`** (farm-map.js:162) is a first-match scan over `HOTSPOTS`, which is
  `[...WORLD_PORTALS (kind:'realm'), castle, shops, market, dungeon, dock, pvprank]`.
  A realm tap → `setPortalPrompt(...)` → `PortalModal` (locked unless in circle scope).
- **The fishing beacon is the good pattern.** It's an always-on glossy circular badge
  drawn in **screen space** (FarmRoom.jsx:2058–2087) so it stays crisp at any zoom, and
  its tap is hit-tested at the **very top** of `onTapInteract`, *before* the combat
  early-return. That top-priority, screen-space, teleport-on-tap model is exactly what
  the portals should adopt.

---

## 1. Request #2 — "Arena: can't click to enter" (ROOT CAUSE)

**It is not a missing handler — it's a geometry + ordering collision.**

- The `emberring_arena` portal hotspot is `x47–48, y37–39` (`world-map-registry.js:66`).
- The **legacy on-map combat band** `ARENA = {x0:17, y0:33, x1:57, y1:45}`
  (`farm-map.js:29`) geometrically **contains** those portal tiles.
- `stepBattle` sets `g.combat.on = inArena(player.tile)` every frame
  (FarmRoom.jsx:1602/1608) — true whenever the player stands *anywhere* in that large
  band, including all the tiles you must stand on to reach/tap the Emberring portal.
- So by the time you're close enough to tap the portal, `combat.on` is already `true`,
  and `onTapInteract` hits the **`doStrike(); return;`** branch (2275) *before* it ever
  calls `hotspotAt` (2276). Every tap becomes a sword swing. **The portal prompt can
  never open.** That is the bug, exactly.

Secondary aggravators (worth fixing in the same pass):
- The portal is a tiny `2×3` rect requiring an exact-tile tap, co-located with the
  `pvprank` hotspot (`x48, y34–35`) — easy to mis-hit even outside combat.
- The `lashira_keep` portal rect (`x27–32, y21–26`) is **identical to the castle rect**
  — same overlap class (BT-1 shadowing) the portal-markers doc already flagged.

### The fix (and why it's the same as #3)
Give the 5 portals the **fishing-beacon treatment**: a screen-space circular badge with
its hit-test at the **top** of `onTapInteract`, *above* the combat early-return. Then
tapping the Emberring badge opens the portal prompt even while you're standing in the
combat band — the swing branch no longer eats it. **Request #3 fixes request #2 for
free.** No change to the combat band, no new state machine.

(If we ever want a pure-minimal hotfix instead: hoist a realm-portal check above the
combat branch in `onTapInteract`. But the badge approach is strictly better and is what
#3 asks for anyway — recommend doing them together.)

---

## 2. Request #3 — all hotspots become circular logo badges "like the fishing thing"

### 2.1 Marker model (per portal / landmark)
Extend the registry so each marker carries one center coordinate + a tap radius + an
icon, mirroring `CONCEPT-portal-markers-and-openworld-builder.md` §1.2:

```
portal = {
  id, name, color,
  icon: '⚔️',        // NEW — emoji/logo shown in the badge (portal-specific)
  tile: [x, y],      // NEW — ONE center coordinate (badge anchor + hit center)
  hitR: 1.4,         // NEW — tap radius in tiles (circle, not rect)
  hqReturn, spawn,   // unchanged
}
// hqHotspot rect kept as DERIVED (back-compat for zoneOf/markers), never authored.
```

Icons (proposed): 🏰 Keep · 🛡 Bloomwall · 🍽 Kitchen · 🎡 Festival · ⚔️ Arena.
Resource zones keep their existing glyphs (🎣 dock stays as-is — it's the reference).

### 2.2 The badge visual — one shared `drawPortalMarker(ctx, portal, now)`
Replaces `drawWorldPortalGlows` (the pulsing **rectangle** glow, FarmRoom.jsx:1852).
Drawn in **screen space** (project `tile` through `g.cam`, like the dock beacon) so it
stays a crisp ~40px badge at any zoom:
- Glossy radial-gradient disc in `portal.color`, soft drop shadow, centered icon.
- Idle **bob** + an expanding **ring pulse** (reuse the dock beacon's exact recipe).
- **Name-pill on approach** — fades in when the player is within ~4 tiles (so the map
  isn't cluttered when far; the color+icon carries it at distance).
- One `drawPortalMarker` call per entry in a unified `MAP_MARKERS` list, so the 5
  portals **and** the shops/market/dungeon/dock all render through the same function —
  this is the "make *all* the hotspots look like fishing" part. (Dock stays its own
  existing draw or folds into the same list — cosmetic, same look either way.)

### 2.3 The tap — screen-space, top-priority
In `onTapInteract`, right where the dock check lives (before the combat return), loop
the markers and hit-test each as a **circle in screen space**:
```
for (const m of MAP_MARKERS) {
  const sx = (m.tile[0]*TILE - camX) * z, sy = (m.tile[1]*TILE - camY) * z - lift;
  if (Math.hypot((clientX-rect.left)-sx, (clientY-rect.top)-sy) <= m.hitPx) {
    dispatch(m); return;   // realm → setPortalPrompt(...); shop → setPanel; etc.
  }
}
```
`hitPx` is a fixed screen radius (~26px) so the target is finger-friendly at every zoom
— not a world-tile rect that shrinks when you zoom out. Realm dispatch reuses the
**existing** `setPortalPrompt({portal, locked, tile, facing})` → `PortalModal` flow
unchanged (locked unless in circle scope). No teleport-on-tap for portals (keep the
confirm modal per IMPL §BT-2); the dock keeps its fast-travel teleport.

### 2.4 Files touched (when we build)
- `world-map-registry.js` — add `icon/tile/hitR`; derive `hqHotspot`.
- `farm-map.js` — `hotspotAt` stays for back-compat (field/zone dispatch); the badge
  tap is the new primary path for landmarks. Build the unified `MAP_MARKERS` list here.
- `FarmRoom.jsx` — `drawWorldPortalGlows` → `drawPortalMarker` loop; add the screen-space
  marker hit-test block above the combat return; fold the dock into the shared look.
- **Placement accuracy note:** the portal-markers doc found the current `hqHotspot`
  coords don't sit on the real basemap landmarks (e.g. Keep art is top-right `[52,7]`,
  not `[27,21]`). Re-anchoring markers to the real art is a *separate* pass — flag it,
  don't silently move gameplay spawns. For THIS change, badge-on-current-coords already
  fixes clickability; landmark re-anchoring can follow.

---

## 3. Request #1 — pinch-to-zoom (+ desktop wheel)

### 3.1 Why it's not trivial today
The input layer is single-pointer (`ptr`). To pinch we must track **two** pointers and
suspend the joystick while two fingers are down.

### 3.2 Design
Convert the pointer handlers to a small **`pointers` Map** (`pointerId → {x,y}`):
- **1 pointer down** → today's behavior exactly (joystick / tap / long-press).
- **2 pointers down** → enter **pinch mode**: cancel the joystick (`g.stick = null`),
  cancel any long-press timer, and mark the gesture non-tap. Record the initial finger
  distance `d0` and the current `zoom0`.
- **On move (2 down)** → `setZoom(clamp(zoom0 * dist/d0, ZMIN, ZMAX))`. Clamp to a game
  range, e.g. **0.5–3** (tighter than the raw 0.1–4 draw clamp — 0.1 shows the whole
  world tiny, 4 is a face full of pixels; 0.5–3 is the usable band).
- **Back to <2 pointers** → leave pinch mode; the remaining finger does *not* suddenly
  jerk the joystick (require a fresh press to re-arm movement).
- **Desktop/trackpad** → add a `wheel` listener: `ctrl/⌘+wheel` (native pinch on
  trackpads) or plain wheel → same `setZoom` clamp. Cheap, no extra state.

### 3.3 Zoom-around-player vs zoom-to-cursor
The hub camera is **player-centered**, so the simplest correct behavior is
**scale-around-the-player** — just change `zoom`, the existing camera keeps the player
centered, no cursor math. Zoom-to-cursor (anchor under the pinch midpoint) is a nicety
that only matters for a free-pan camera; the Builder canvas wants it, the *game* doesn't.
Recommend shipping scale-around-player for the game; revisit if we add free-pan.

### 3.4 Persistence & reduced-motion
- Optionally persist the last pinch zoom to `localStorage` (like `lashira_speed`), or
  keep it session-only (matches today's slider, which isn't persisted). Recommend
  **session-only** to avoid someone getting stuck at an accidental extreme on next load;
  the Settings slider remains the durable control.
- The Settings zoom slider stays and stays in sync (both call `setZoom`) — pinch is an
  additional input to the same state, not a replacement.

### 3.5 Files touched
- `FarmRoom.jsx` — rework `onPointerDown/Move/Up` to the `pointers` Map + pinch branch;
  add the `wheel` listener; both feed the existing `setZoom`. Same treatment in
  `RealmRoom.jsx` (its own `camZoomMul`) so realms pinch too.

---

## 4. Recommended build order (when you say go)
1. **Circle markers + tap-priority** (#3) — this *also* fixes the arena (#2) as a side
   effect. Biggest visible win, lowest risk (draw + one hit-test block).
2. **Pinch/wheel zoom** (#1) — isolated to the input layer; do FarmRoom first, then
   mirror into RealmRoom.
3. *(Later, optional)* Re-anchor markers to the real basemap landmarks (needs the
   Openworld Builder or a careful manual pass; keep spawns intact).

Each is independently shippable and independently verifiable in the hq/lashira preview.
No schema, no migration, no combat-balance change.

---

## Build result (2026-07-11)
All three built into `apps/lashira/web`; `npm run build` clean (187 modules).

- **Circle markers (#3)** — `world-map-registry.js`: each portal gained `icon` +
  `marker` (center). `farm-map.js`: new exported `MAP_MARKERS` (13 badges = 5 realms +
  5 shops + market + dungeon + pvprank; excludes ore/tree/castle/dock by design).
  `FarmRoom.jsx`: `drawWorldPortalGlows` (rect glow) **replaced** by `drawMapMarkers`
  (screen-space glossy disc + colored ring + bob + name-pill on approach, the fishing
  look). Dock 🎣 beacon kept as-is (reference).
- **Arena fix (#2)** — `FarmRoom.jsx onTapInteract`: a screen-space marker hit-test
  (fixed 22px radius) added **above** the `if (g.combat.on) doStrike()` branch. Tapping
  the Emberring badge now opens the portal prompt even while standing in the combat band.
- **Pinch/wheel zoom (#1)** — `FarmRoom.jsx` + `RealmRoom.jsx`: pointer handlers reworked
  to a `pointers` Map; two fingers = pinch (scale zoom by finger-distance ratio, clamp
  0.45–3× in the hub / 0.6–2× multiplier in realms), joystick suspended during pinch;
  `wheel` (+ trackpad ctrl+wheel) zooms on desktop. Session-only; Settings slider stays synced.

### Dev-mode coordinate inspector (added 2026-07-11)
`FarmRoom.jsx`: while operator **dev mode** is on, tapping any tile now records it
(`onTapInteract` hoists a `g.cursorTile` capture above the marker/panel dispatch), and
the dev overlay draws a pill above that tile showing `x N, y N` plus what's on it
(hotspot/portal name, else the zone label) and outlines the exact tile. Purpose: place
markers/hotspots/zones by reading real coordinates straight off the map. Operator-gated
(same `g.devOverlay` flag as the numbered-badge overlay); invisible to normal players.
Verified the descriptor's data path live (hotspotAt/zoneOf): (48,38)→"Emberring Arena",
(10,18)→"seed", (30,16)→"market", (48,18)→"dungeon", (2,2)→"🌿 Meadow".

**Verified** (via the Vite dev server, since this game's rAF canvas is frozen in the
headless preview — a known limitation): imported the real bundle and confirmed
`MAP_MARKERS` = 13 with correct kinds/icons/coords; replayed the exact `onTapInteract`
hit-test geometry against the real data — arena tap resolves to `emberring_arena`, an
off-badge tap resolves to null, and all 13 markers resolve to themselves (zero
shadowing). Visual badge look + live pinch gesture need the user's eyes on a real
browser/device (headless preview can't drive the animation loop).
