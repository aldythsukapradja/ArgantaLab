# Indonesia's Geological Legacy — as built

**For:** Herman Darman — exploration geologist, editor of *An Outline of the
Geology of Indonesia*, ~20 yrs Shell, advisor to Pertamina.
**Status:** built and running. Six scenes, black throughout.
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

## The six scenes

Per `Geological_Legacy_Pitch_Deck_Update_Handoff.md`. Read consecutively the
headlines are one story: **One Geological Legacy. Connected for the Next
Generation. → From Basin Understanding to Field Stewardship. → From the Scale of
a Nation to the Detail of a Field. → Build the Foundation. Challenge the
Interpretation. Pass It Forward. → The First Proof Is Already Working. →
Knowledge Endures When It Is Shared.**

| # | id | Scene | Answers | Built from |
|---|---|---|---|---|
| 1 | `vision` | **The Vision** | Why does this matter? | `CockpitMap` globe · Knowledge Bank charts on basin select |
| 2 | `perspective` | **The Perspective** | Why is the perspective broad enough? | 10-stage timeline + **D3 dual-mode donut** |
| 3 | `descent` | **The Descent** | What does connected knowledge look like? | `BasinLens` — d3-geo, four stops |
| 4 | `path` | **The Path Forward** | How does it become trustworthy? | FOUNDATION / VALIDATE / TRANSFER |
| 5 | `proof` | **The First Proof** | Is it technically possible? | the live app, booted dark |
| 6 | `next` | **The Next Chapter** | What happens next? | Challenge · Contribute · Carry forward |

The ending is deliberately **not** about the person who built it. *"I have taken
this as far as one person can"* put the builder at the centre of a slide whose
whole subject is collective continuity.

### Slide 2 — the only visual rebuild

One donut, two readings of the same fifteen years, behind a switchable capsule.
Side by side you could read either alone; behind one switch they are visibly the
same career measured twice.

**Technical mix** is fixed at 25 / 25 / 25 / 10 / 15. Three visual families, not
a rainbow: the three 25% segments share one blue family because together they
*are* the 75% development-geoscience story, and the eye should read them as a
block before it reads them apart.

**Environment mix is COMPUTED**, not typed — from the timeline's own months, so
it cannot drift from the dates printed beside it. Two classifications are the
presenter's call, and are isolated as single lines in `ENVIRONMENT_OF`:

- **North Oil Company** — a QatarEnergy / TotalEnergies joint venture.
  Defaulted to *national*. Flipping it to *multinational* moves the chart from
  32 / 21 / 47 to 32 / 53 / 16, so this is not a cosmetic choice.
- **Energi Mega Persada** — an Indonesian independent, neither a state operator
  nor a multinational. Defaulted to *national* as the least wrong of three.

A third judgement worth surfacing: the four-year B.Eng is counted, per the
handoff's mapping of ITB to Academic & Research. It is 21% of the total on its
own, and the donut is titled *Professional Environments* — drop it and academic
falls from 32% to about 15%.

Digital Transformation is a **band across the later stages, not a final dot**:
it did not replace the geoscience, it became a way to connect and scale it.

Geometry is `d3-shape`; motion is GSAP, already the deck's engine. Arcs are
matched by index with surplus segments collapsing to zero width, so five
segments genuinely morph into three rather than cross-fading. Hovering an arc in
environment mode dims the timeline stages that do not belong to it.

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
| `keynote/scenes.tsx` | the six scenes and their `enter`/`idle`/`exit` |
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
