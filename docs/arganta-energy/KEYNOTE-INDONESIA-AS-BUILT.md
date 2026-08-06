# Indonesia's Geological Legacy — as built

**For:** Herman Darman — exploration geologist, editor of *An Outline of the
Geology of Indonesia*, ~20 yrs Shell, advisor to Pertamina.
**Status:** built and running. Nine scenes, dark throughout.
**Open at:** Settings → Presentation, or `/#keynote`.

**This file describes the code.** The four planning docs beside it
(`-CONCEPT`, `-SPINE`, `-BUILD`, `-FINAL`, `-REVAMP-PLAN`) describe a v3
narrative that was **rejected** in favour of the original v1.0 handoff scenario;
they are kept as history and must not be read as a spec.

---

## What changed from the plan

| | Planned | Built | Why |
|---|---|---|---|
| Scenes | 10 | **9** | Slides 4 (*The Hidden Risk*) and 5 (*Sovereign Knowledge*) were two halves of one thought. Split across a click, the resolution arrived as a new topic instead of an answer. |
| Theme | dark → light turn at scene 5 | **dark throughout** | The light half was never as good, and the turn is now carried by the merged scene's two acts. |
| Narrative | v3 "Where it begins / Two basins, one career / The link that does not exist" | **the v1.0 handoff scenario** | Explicitly requested. |

---

## The nine scenes

| # | id | Scene · Emotion | Punchline | Reused from ArgantaEnergy | Motion |
|---|---|---|---|---|---|
| 1 | `vision` | **A Vision** · wonder | *A Vision for Indonesia's Geological Legacy — Proof of Concept based on the USGS World Petroleum Assessment* | `CockpitMap` (Esri satellite, MapLibre v5 globe) · `EventsChartView` + `TectonoStratChart` on click | 5.2 s descent from orbit, west→east basin ignition, field pulse, `SplitText` masked lines |
| 2 | `why-here` | **Why I Am Here** · credibility | *Nearly the entire upstream lifecycle.* | — | `DrawSVG` trajectory, staged dots, `power3` chip momentum |
| 3 | `why-indonesia` | **Why Indonesia Is Different** · national pride | *We should measure it—not merely claim it.* | `CockpitMap` (left veil) | four dimensions settle, then the sentence lands alone |
| 4 | `turn` | **The Break, and the Answer** · urgency → inspiration | *Our geology is connected. Our knowledge often is not — and a nation should own the understanding of its resources.* | `ParticleField` (three.js + UnrealBloom) | **two acts in one frame** — see below |
| 5 | `language` | **Our Common Geological Language** · clarity | *Build one framework.* | `DepthRail` (nine glowing planes) | one continuous 11 s camera dolly |
| 6 | `implementation` | **One Possible Implementation** · confidence | *Technology is not the vision. It makes the vision usable.* | **the live app in an iframe** | device swap; 1∶3 copy/demo split, iframe at 75 % zoom |
| 7 | `stages` | **Three Stages** · momentum | *It grows in stages.* | — | cards arrive as three places (`rotateX` parallax), accent rules wipe out |
| 8 | `beyond` | **Beyond One Person** · collaboration | *An Indonesian Geological Legacy Initiative?* | `EcosystemForce` (live `d3-force`) | never cools — `alphaMin` 0.008 |
| 9 | `ask` | **The Ask** · reflection | *They should inherit the way Indonesia understands its geology.* | `CockpitMap` idle | three questions, long holds, no logo after the fade |

### Scene 4, the turn — the only scene with an internal arc

Both acts occupy the **same grid cell**, so the frame never jumps.

1. **Act I** · particles `connected` → *"Our geology is connected."* holds alone
2. a red **tear** draws outward from the centre; particles switch to `breaking`
3. *"Our knowledge often is not."* lands on the far side of the break, then **2.4 s of silence**
4. **the turn** · Act I recedes upward into blur — still true, no longer the subject
5. **Act II** · particles `reforming`, cyan → gold; the answer rises in Act I's place
6. the four ownership lines, then the flag unfurls along the floor

The particle field is the through-line. The recovery must visibly be the
recovery **of the thing that broke** — which is precisely what two separate
slides could not do.

---

## Scene 1 is the system, not a picture of it

Three things make the title slide a live instrument:

- **Deep space, not daylight.** `map.setSky()` overrides MapLibre's pale default
  atmosphere and fades `atmosphere-blend` out on approach.
- **The archipelago is never covered by type.** The copy sits in a fixed
  bottom-34 % band and the camera is given a matching pixel `offset`. One
  constant (`TITLE_BAND`) drives both, so it holds at any viewport.
  *Not* `padding` — the globe projection throws on `padding.top`
  (`maplibre-gl-dev.js:55176`).
- **79 GOGET fields breathe.** Bright core plus an expanding sonar ring, with a
  per-point random `phase` so the archipelago twinkles rather than strobing, and
  radius scaled by √volume. The phase maths is a MapLibre expression (GPU); only
  the time term is re-baked, at 24 fps — `setPaintProperty` forces a full
  re-evaluation and 60 Hz of that during a fly is a visible stutter.

**Tapping a province** opens a right-hand rail carrying the Knowledge Bank's
*real* `EventsChartView` and `TectonoStratChart`. Both are pure and prop-driven,
so [`basin-dossier.ts`](../../apps/energy/src/keynote/basin-dossier.ts) only had
to reproduce the joins that feed them — mounting the whole Knowledge Bank would
have dragged in its scope store, figure gating and cross-section header.

All thirteen provinces return real content:

| Province | elements | events | cycles |
|---|---|---|---|
| South Sumatra (3828) | 14 | 7 | 4 |
| North / Central Sumatra (3822, 3808) | 8 | 7 | 4 |
| Northwest Java (3824) | 6 | 7 | 4 |
| Kutei (3817) | 5 | 7 | 3 |
| the remaining eight | 4 | 7 | 2–4 |

**Every Indonesian cycle is `citation_status: recalled`** — literature the model
knows but has not cited. The rail states that as a provenance chip rather than
hiding it. A deck whose thesis is *measure it, don't claim it* cannot present
recalled geology as sourced, and this audience will ask.

---

## Controls

| Key | Action |
|---|---|
| `→` `Space` / `←` | next / previous — **never auto-advances** |
| `Home` `End` | first / last |
| `O` | overview grid |
| `P` | presenter notes (punchline + stage direction) |
| `T` | theme override, for a bright room |
| `F` | fullscreen |
| `Esc` | close overview → exit fullscreen → leave the deck |

Nothing advances on a timer. He will interrupt; a deck that keeps moving while a
senior geologist is talking has already lost him.

---

## Files

| File | Role |
|---|---|
| `keynote/KeynoteSurface.tsx` | portal, keys, scene lifecycle, chrome |
| `keynote/scenes.tsx` | the nine scenes and their `enter`/`idle`/`exit` |
| `keynote/timeline.ts` | `CINEMA`/`SETTLE` eases, `riseLines` (masked `SplitText`), `hold` |
| `keynote/KeynoteMap.tsx` | space sky, archipelago glow, field pulse, camera |
| `keynote/basin-dossier.ts` | province code → Knowledge Bank chart inputs |
| `keynote/Stage3D.tsx` | `ParticleField`, `DepthRail` (three.js + UnrealBloom) |
| `keynote/visuals.tsx` | `Starfield`, `EcosystemForce` |
| `keynote/DemoFrame.tsx` | device frame, live iframe / recorded loop |
| `keynote/keynote.css` | type scale, palette, all scene furniture |
| `cosmo/Boundary.tsx` | keeps one failing overlay from white-screening the deck |

Reduced motion is a **designed** mode, not a degradation: the story reads end to
end, it just cuts instead of easing.

---

## Known gaps

1. **No recorded loops.** `public/keynote/demo-desktop.gif` and `-mobile.gif` do
   not exist, so scene 6's Loop toggle falls back to Live. That fallback exists
   for a room with bad wifi — which is the likely room.
2. **Satellite imagery needs a network.** Esri tiles cannot be bundled, so a
   fully offline run loses the basemap on scenes 1, 3 and 9.
3. **Recalled provenance** on every Indonesian basin cycle (above). A strength
   when stated, a liability if it is discovered rather than disclosed.
