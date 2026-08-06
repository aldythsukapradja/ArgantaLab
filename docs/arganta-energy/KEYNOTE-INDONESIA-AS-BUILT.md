# Indonesia's Geological Legacy — as built

**For:** Herman Darman — exploration geologist, editor of *An Outline of the
Geology of Indonesia*, ~20 yrs Shell, advisor to Pertamina.
**Status:** built and running. Seven scenes, black throughout.
**Open at:** Settings → Presentation, or `/#keynote`.

**This file describes the code.** The four planning docs beside it
(`-CONCEPT`, `-SPINE`, `-BUILD`, `-FINAL`, `-REVAMP-PLAN`) describe a v3
narrative that was **rejected** in favour of the original v1.0 handoff scenario;
they are kept as history and must not be read as a spec.

---

## What changed from the plan

| | Planned | Built | Why |
|---|---|---|---|
| Scenes | 10 | **7** | Two merges and two deletions, each because the slide was already said elsewhere. |
| Theme | dark → light turn at scene 5 | **black throughout** | The light half was never as good, and true black — not near-black — is what stops a projector showing a grey wash. |
| Backdrop | per-scene | **one persistent sky** | A backdrop that remounts per slide flashes on every advance. |
| Narrative | v3 "Where it begins / Two basins, one career" | **the v1.0 handoff scenario, then the GeoHackathon** | Explicitly requested; the mission became the spine. |

**Cut, and why:**

- *The Hidden Risk* + *Sovereign Knowledge* → merged, then **rebuilt entirely** as *The Descent, and the Idea*. The break-then-repair beat was ugly, and "a nation should own the understanding of its resources" reads as a demand to a man who has spent a career building exactly that.
- *Why Indonesia Is Different* → **deleted**. Its thesis line, *"We should measure it — not merely claim it,"* survives as the closing beat of The Mission.
- *Our Common Geological Language* → **deleted**. The Descent already walks Basin → Play → Field → Well → Core; the Plate→Well chain was the same idea with a worse vehicle.

---

## The seven scenes

| # | id | Scene · Emotion | Punchline | Reused from ArgantaEnergy | Motion |
|---|---|---|---|---|---|
| 1 | `vision` | **A Vision** · wonder | *A Vision for Indonesia's Geological Legacy — Proof of Concept based on the USGS World Petroleum Assessment* | `CockpitMap` (Esri satellite, MapLibre v5 globe) · `EventsChartView` + `TectonoStratChart` on click | 5.2 s descent from orbit, west→east basin ignition, field pulse |
| 2 | `why-here` | **Why I Am Here** · credibility | *Nearly the entire upstream lifecycle.* | — | ten stages on a 2006→2026+ axis, real reversed logos, axis draws left to right |
| 3 | `mission` | **The Mission** · purpose | *Unify Indonesian petroleum knowledge — then hand it on.* | — | TRAIN / EXPLORE / PUBLISH arrive as three places; the thesis lands alone |
| 4 | `descent` | **The Descent, and the Idea** · wonder → inspiration | *Every scale is the same question, asked closer.* | `DepthRail` · **`BasinLens`** — the real Kutei polygon and its real fields | two acts in one frame |
| 5 | `platform` | **The Platform** · confidence | *The training material, the knowledge base, the submissions — all of it lives here.* | **the live app in an iframe** | 1∶3 copy/demo split, iframe at 75 % zoom |
| 6 | `legacy` | **What It Leaves Behind** · collaboration | *Three things Indonesia keeps.* | `EcosystemForce` (live `d3-force`) | never cools — `alphaMin` 0.008 |
| 7 | `ask` | **The Ask** · reflection | *They should inherit the way Indonesia understands its geology.* | `CockpitMap` idle | three questions, long holds, no logo after the fade |

### Scene 3 — the mission

**TRAIN** (*foundations · basin thinking · AI as an instrument* → a shared
curriculum), **EXPLORE** (*choose a basin · interrogate it · defend it* → an
original interpretation), **PUBLISH** (*present · peer review · record* → a
citable contribution).

Footer: **GeoHackathon — one cohort, a basin each, one publication.**
Closing beat: *We should measure it — not merely claim it.*

The order is the argument: you cannot ask a student to interrogate a basin
before you have taught them how, and an interpretation nobody reads is not a
contribution.

### Scene 4 — the descent

Nine seconds of silence through five real scales — **Basin** (Kutei 3817) →
**Play** → **Field** (Tunu) → **Well** → **Core** — with a circular lens at
centre frame holding the actual Kutei province polygon from
`world/provinces.geojson` and its actual GOGET field points, zooming as depth
grows. Stroke width divides by the zoom so the outline stays a hairline instead
of thickening into a slab.

Then Act I lifts into blur and Act II rises in the same grid cell: *an
understanding, once shared, cannot be taken back.*

### Scene 7 — the ask

Three printed questions — *is a first cohort worth running? which basin should
they be given? IAGI, IPA — where should they present it?* The fourth is spoken,
never printed: **would you sit on the panel that reads what they produce?** An
ask on the wall reads as a demand; an ask made out loud is a courtesy.

---

## The sky

One `Cosmos` canvas behind all seven scenes, mounted outside the keyed stage.
Three variants, cycled live with **`G`**:

- **`terrain`** *(default)* — ridged fractal contour lines running to a horizon
  at ~46 % frame height, drifting toward the viewer, warm on the crests and cold
  in the troughs, fog dissolving the far edge.
- **`nebula`** — dust sheets weighted into the lower frame.
- **`deepfield`** — sparse stars only.

The galaxy spiral that preceded these was removed for a structural reason, not a
taste one: **a backdrop with a hot centre will always fight a centred headline.**
On the wall its core cut straight through *"Nearly the entire upstream
lifecycle."* Every variant now obeys one rule — the upper half of the frame stays
quiet, because that is where every scene puts its type. The terrain even carries
a valley down the centre so the middle of frame is the lowest part of the range.

## Logos

The six marks on scene 2 are **reversed variants**, generated by lifting only
the ink that failed a 4.5∶1 contrast floor against the black ground, in HLS so
hue and saturation survive. Measured before the change: North Oil Company failed
across 25 % of its ink (1.28∶1), Pertamina across 49 % (1.19∶1). Transparency
alone made them *worse*. Recolouring a trademark is not ours to do, so dark navy
became light navy and dark green light green — a brand's own dark-background
treatment. The untouched on-white masters sit beside each file as `*-light.png`.

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
| `keynote/scenes.tsx` | the seven scenes and their `enter`/`idle`/`exit` |
| `keynote/timeline.ts` | `CINEMA`/`SETTLE` eases, `riseLines` (masked `SplitText`), `hold` |
| `keynote/KeynoteMap.tsx` | space sky, archipelago glow, field pulse, camera |
| `keynote/basin-dossier.ts` | province code → Knowledge Bank chart inputs |
| `keynote/Stage3D.tsx` | `ParticleField`, `DepthRail` (three.js + UnrealBloom) |
| `keynote/visuals.tsx` | `Starfield`, `EcosystemForce` |
| `keynote/Cosmos.tsx` | the persistent sky — terrain / nebula / deepfield, cycled with `G` |
| `keynote/BasinLens.tsx` | the descent’s porthole onto the real Kutei polygon |
| `keynote/DemoFrame.tsx` | device frame, live iframe / recorded loop |
| `keynote/keynote.css` | type scale, palette, all scene furniture |
| `cosmo/Boundary.tsx` | keeps one failing overlay from white-screening the deck |

Reduced motion is a **designed** mode, not a degradation: the story reads end to
end, it just cuts instead of easing.

---

## Known gaps

1. **No recorded loops.** `public/keynote/demo-desktop.gif` and `-mobile.gif` do
   not exist, so scene 5's Loop toggle falls back to Live. That fallback exists
   for a room with bad wifi — which is the likely room.
2. **Satellite imagery needs a network.** Esri tiles cannot be bundled, so a
   fully offline run loses the basemap on scenes 1 and 7.
3. **Recalled provenance** on every Indonesian basin cycle (above). A strength
   when stated, a liability if it is discovered rather than disclosed.
