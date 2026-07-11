# Animal Pen Rework — Build Spec (handoff)

**Status:** spec only, not built. Scope locked by owner 2026-07-11.
**Decisions:** (A) **collision-only now**, fence ART regen deferred. (B) **No chicken gate.**

## Context / why the art caveat matters
The visible pen fences are baked into `basemap.png`. The `drawFence()` calls in the
pen loop (`apps/lashira/web/src/game/farm-map.js` ~L339-349) run BEFORE the basemap
is painted over them (~L403), so they are invisible — that loop only produces the
`blocked` collision Set (the red dev no-walk overlay). Therefore code can move the
**collision** to exact tiles, but the **painted fences stay put** until a basemap
regen. Owner accepted this desync for now (Openworld Builder → PixelLab art job is a
separate, later task).

Animals are already rect-clamped to their pen via `moveChoice()` inHome check
(FarmRoom.jsx ~L1444-1450), so redefining `PENS` auto-contains them — the widened
gates + side passages become **player-only** access. No new animal-AI code needed.

---

## Change 1 — Pen geometry (`farm-map.js` `PENS`, ~L45-49)
Top fence y3→y5, bottom fence y16→y15 → interior becomes y6–14. X-ranges unchanged.
Auto-propagates to fence collision, `penStarts`, animal `home`, marker positions.

```js
export const PENS = {
  cow:     { x0: 35, y0: 6, x1: 40, y1: 14, gate: 'bottom' },
  sheep:   { x0: 42, y0: 6, x1: 47, y1: 14, gate: 'bottom' },
  chicken: { x0: 49, y0: 6, x1: 55, y1: 14, gate: 'bottom' },
};
```
`penStarts` (FarmRoom.jsx ~L1342) uses `p.x0+1 / p.x1-1` and interpolates y within
`p.y0+1 .. p.y1-1`, so it stays inside the new interior — no change needed.

## Change 2 — Gates + side passages (pen loop, `farm-map.js` ~L339-349)
Remove the per-pen gate skip (`gate === 'bottom' && x === mx`) so full fence collision
is drawn, THEN carve all openings explicitly AFTER the loop (same carve-after pattern
as the bridge deck / E-road fixes):

```js
const PEN_OPENINGS = [
  '36,15','37,15','38,15','39,15',   // cow bottom gate  (x36–39)
  '43,15','44,15','45,15','46,15',   // sheep bottom gate (x43–46)
  // NO chicken bottom gate (owner decision)
  '41,9',                            // cow ↔ sheep side passage
  '48,9',                            // sheep ↔ chicken side passage
];
for (const k of PEN_OPENINGS) {
  const [ox, oy] = k.split(',').map(Number);
  blocked.delete(tileKey(ox, oy));
}
```
Note: x41 fence is shared (cow right / sheep left); x48 shared (sheep right /
chicken left). Deleting `41,9` and `48,9` opens the vertical dividers at y9.

## Change 3 — Per-animal HUD indicators (FarmRoom.jsx, the `e.kind==='animal'` draw block ~L1817-1834)
Data model (`apps/lashira/web/src/data/livestock.js`): each animal =
`{ affection: 0–100, fedAt: ts|null }`; helpers `animalGoodReady(li)` /
`animalGoodFrac(li)` exist. Mutually exclusive status states:

| State | Condition | Badge above head |
|---|---|---|
| Needs feeding | `!li.fedAt` | 🌾 feed icon — **NEW**. Tap already feeds (`tapAnimal` farm-logic.js ~L838) |
| Producing | `fedAt` set, `animalGoodFrac(li) < 1` | faint product icon + **progress ring** filled by `animalGoodFrac(li)` — **NEW** |
| Ready | `animalGoodReady(li)` | product disc — **already built** (~L1817-1834), keep as-is |

Plus **heart (always shown)** next to the status badge: fill/color by `li.affection`
(starts 40, +5 per pet cap 100 — `petAnimal` farm-logic.js ~L855). Suggested:
gray `<40`, pink `40–69`, full-red `≥70`. Layout: heart top-LEFT of the over-head
slot, status badge top-RIGHT (avoid overlap). Reuse existing y-offset
`footY - (chicken?30:52)`.

`li` lookup pattern already in the block:
`e.livestockId && logicRef.current?.state?.livestock?.find(x => x.id === e.livestockId)`.

---

## Verification checklist (post-build)
- `npm run build` clean in `apps/lashira/web`.
- Live (preview, guest path): via `window.__G.current.blocked` confirm
  `36,15`..`39,15`, `43,15`..`46,15`, `41,9`, `48,9` are NOT in the set; confirm
  `50,15`..`53,15` (chicken) ARE still blocked (no gate).
- Confirm animals stay in pens: they can't reach y15 gates or x41/x48 (outside
  interior y6-14) — walk a few sim ticks and check none escape.
- Visually confirm heart + feed/progress/ready badges render per-animal and cycle
  (feed → progress ring → ready disc → collect → feed again).
- KNOWN/ACCEPTED: red no-walk overlay will not perfectly match the painted fences
  (collision moved, art not) — expected until basemap regen.

## Out of scope (later)
- `basemap.png` regen to move the painted fences/gates to match the new collision.
