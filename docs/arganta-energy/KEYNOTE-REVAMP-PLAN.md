# Keynote Revamp — from "typographic deck" to cinematic

> **SUPERSEDED — history only.** The deck that shipped is nine scenes on the
> v1.0 handoff scenario, dark throughout. See
> [KEYNOTE-INDONESIA-AS-BUILT.md](./KEYNOTE-INDONESIA-AS-BUILT.md). Do not read
> this file as a spec.

**Status:** plan only, no build. **Verdict on v1:** you are right. It is a
well-behaved slide deck, not a film. Fixable, and cheaper than it looks —
almost everything needed is already installed and already built.

---

## 0. One correction first, because it would be costly

> *"if there is white and red, put white above, so it represents Indonesian flag"*

The Indonesian flag is **RED above WHITE** — *Sang Saka Merah-Putih*, red-white.
White above red is Poland.

Presenting an inverted national flag to Pertamina's advisor, in a deck about
Indonesian sovereignty, is the kind of detail that undoes the whole room. **I will
build red-over-white** unless you tell me otherwise — say the word if you meant
something else by it.

---

## 1. The single biggest find: the fancy globe already exists

`cosmo/CockpitMap.tsx` (375 lines) already does **everything** you asked for:

| You asked for | Already in CockpitMap |
|---|---|
| Satellite map, not polygons | `theme: 'satellite'` → **Esri World Imagery**, no API key |
| A proper fancy globe | `mode: '3d'` → **MapLibre v5 globe projection** (a real sphere — it replaced an older three.js globe) |
| Field locations | `osdu-clusters` + point layers, 7,787 fields |
| Glowing | `focus-field-glow`, `focus-field-ring`, `focus-field-dot` layers exist |
| Click to open basins | `onSelect` + `focusPolygonId` |
| Camera fly-in | `focus` prop drives `flyTo` |

**So slide 1 stops being a CSS gradient and becomes the real thing:** satellite
globe seen from space, camera descending into the archipelago, provinces igniting
as glowing overlays, thousands of real field points, and **still clickable** — you
can stop mid-keynote, tap Kutei, and open its dossier without leaving the deck.

That is a genuinely better opening than anything I would have hand-built, and it
costs a prop, not a rewrite.

---

## 2. No new libraries needed — the premium toolkit is already paid for

You asked for anime.js. **I recommend against it**, not to be difficult but
because we already have a superset, and two animation engines fighting over the
same elements is a real source of jank. Here is what is already in
`node_modules` and unused:

| Installed, unused | What it fixes |
|---|---|
| **GSAP SplitText** | ⟵ **this is the answer to "the text is boring."** Per-character and per-line reveals, masked line rises, staggered word entrances |
| **GSAP ScrambleTextPlugin** | Numbers and labels that decode into place |
| **GSAP DrawSVGPlugin** | Proper line-drawing (the trajectory, the chain) |
| **GSAP MorphSVGPlugin** | Shape-to-shape morphs between scenes |
| **GSAP Physics2DPlugin** | Slide 4's archive drifting with real momentum, not tweened randomness |
| **three.js UnrealBloomPass** + `EffectComposer`, `SMAAPass`, `OutputPass` | **True volumetric glow.** This is what "cinematic" actually means optically |
| **deck.gl 9** | Glow/arc/particle layers composited onto the MapLibre globe |

If you still want anime.js after seeing SplitText + bloom, I will add it — but I
would rather spend the effort on the bloom pipeline.

---

## 3. Slide-by-slide revamp

### 1 · A Vision — *from CSS gradient to a real satellite globe*
- **`<CockpitMap mode="3d" theme="satellite" />`** as the entire background.
- Camera: starts at zoom ~1.4 (whole Earth, terminator visible), GSAP-driven
  `flyTo` over ~7 s into the Indonesia bbox with `curve`/`speed` tuned for mass.
- Province polygons ignite **west → east** with a real glow layer, not a CSS shadow.
- Field points fade up **after** the polygons — thousands of them, so the
  archipelago visibly *populates*.
- **Title held back until the camera settles**, then SplitText: each word rises
  through a mask, 90 ms apart. No fade-in-from-nothing.
- **Stays interactive** — the deck can be paused and the map explored.
- *Text cut:* the three-line subtitle becomes **one line**.

### 2 · Why I Am Here — *from label grid to a drawn descent*
- Trajectory drawn with **DrawSVG**, not a dash-offset hack.
- Seven stages arrive **as the line reaches them**, not as a pre-laid grid.
- Proof-point chips fly in with **Physics2D** and settle.
- *Text cut:* stage names only. The lede goes to presenter notes.

### 3 · Why Indonesia Is Different — *satellite + the four dimensions as layers*
- Same globe, now tilted, rotating slowly.
- Each of the four dimensions **lights a different overlay on the real map** as it
  is named — tectonic, basins, systems, plays — so the claim is shown, not listed.
- Punchline in SplitText, one line, alone.

### 4 · The Hidden Risk — *from SVG lines to three.js with bloom*
- Archive becomes a **three.js particle field** in real depth: ~2,000 glowing
  motes with `UnrealBloomPass`, connected by lines.
- Connections **snap** and the field disperses with **Physics2D** velocities.
- Camera pulls back as it falls apart — the loss gets bigger as you watch.
- *Text cut:* two lines total.

### 5 · Sovereign Knowledge — *the slide you called boring, rebuilt*
- Kill the static SVG entirely. Replace with the **same three.js particle field
  from slide 4, re-forming** — the continuity is the point.
- Gold bloom blooms outward from centre as links heal.
- **Dark → light** stays, but now the bloom carries it.
- **Flag beat:** as the four lines land, a red band resolves above a white band
  behind the type — *red over white* — and holds for one breath.

### 6 · Common Language — *from bar chart to a descent*
- Nine steps become a **continuous camera dolly** through nine depth planes
  (three.js), Plate at the back, Well at the front.
- Each label passes the camera. One movement, no cuts — which is what your brief
  actually asked for and v1 did not deliver.

### 7 · One Possible Implementation — *the live demo*
This is the one you flagged hardest, and it becomes the strongest slide:
- **The real ArgantaEnergy, running, in a device frame.**
- **Desktop / Mobile toggle** — the frame morphs between the two, app re-flows live.
- **Per-device animated GIF option** — pre-recorded loops for when you want a
  guaranteed-clean sequence instead of a live click-through.
- Tapping the frame **enters the app for real** (Esc returns to the deck).
- *Text cut:* the eight tiles disappear — the app itself replaces them.

### 8 · Three Stages — *three worlds, one camera*
- Real parallax: each stage is a depth plane with its own colour cast
  (blue → gold → white), camera trucks sideways between them.
- Words arrive with ScrambleText.

### 9 · Beyond One Person — *from static ring to living force graph*
- **`d3-force`** simulation, actually running — nodes drift and settle, links
  breathe. Not a fixed ring pretending to be alive.
- Bloom on the central node.

### 10 · The Ask — *stillness, earned*
- Back to the satellite globe, near-still, slow rotation, Indonesia lit.
- Questions in SplitText, one line at a time, long holds.
- Final sentence, then fade. No logo.

---

## 4. What makes it read as cinematic (the actual craft)

Four things v1 lacks, all cheap:

1. **Bloom.** Nothing looks filmic without light bleed. `UnrealBloomPass` on the
   three.js scenes and a CSS `filter` fallback on DOM layers.
2. **Depth.** v1 is flat. Every scene gets at least two parallax planes moving at
   different rates — the eye reads that as space.
3. **Type that performs.** SplitText masked line-rises instead of opacity fades.
   This alone fixes most of "the text is boring."
4. **Less text.** Current slides average ~45 words. Target **under 15**. Every
   sentence that is spoken aloud comes off the screen and into presenter notes.

---

## 5. Build order

| Wave | Work | Why first |
|---|---|---|
| **R1** | CockpitMap embedded in slides 1, 3, 10 — satellite, globe, glow, fields, fly-in, still clickable | The single biggest visual jump, and it is mostly wiring |
| **R2** | SplitText + ScrambleText pass across all ten; cut every slide to <15 words | Fixes "boring text" everywhere at once |
| **R3** | three.js stage + UnrealBloom → slides 4, 5, 6 | The three slides that are currently flat SVG |
| **R4** | Slide 7 live demo: device frame, desktop/mobile morph, GIF option | Highest-value single slide |
| **R5** | d3-force ecosystem, parallax on 8, flag beat on 5 | Polish |

**R1 + R2 alone** would change your impression of the whole deck, and neither
needs a new dependency.

---

## 6. Open questions

1. **Flag orientation** — confirming red-over-white (§0).
2. **anime.js** — add it anyway, or spend that effort on bloom? My
   recommendation is bloom.
3. **Slide 7 GIFs** — do you have recordings, or should the build include a
   capture step? A live app is more impressive but riskier in a cold room; the
   GIF is the safety net, which is why you asked for both.
4. **Satellite tiles** are Esri World Imagery over the public endpoint — fine for
   a laptop with wifi, but **the standalone export cannot bundle them**. Offline
   fallback: pre-render the Indonesia extent to a static image at export time.
