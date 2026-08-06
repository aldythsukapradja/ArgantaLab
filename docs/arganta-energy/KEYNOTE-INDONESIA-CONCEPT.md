# Indonesia's Geological Legacy — Keynote Concept

> **SUPERSEDED — history only.** The deck that shipped is nine scenes on the
> v1.0 handoff scenario, dark throughout. See
> [KEYNOTE-INDONESIA-AS-BUILT.md](./KEYNOTE-INDONESIA-AS-BUILT.md). Do not read
> this file as a spec.

**Status:** concept only, no build. **Date:** 2026-08-05.
**Source brief:** the v1.0 handoff (10 slides, Wonder → Reflection).
**Surface:** a dedicated fullscreen route in ArgantaEnergy, launched from Settings.

---

## 0. The one decision that changes this deck

The brief's own punchline is **"We should measure it — not merely claim it."**

I checked whether we can honour that literally. We can, and the result is more
interesting than the scripted version:

| What Indonesia has in our corpus | Value |
|---|---|
| USGS provinces | **13** |
| Basins · petroleum systems · assessment units | **13 · 13 · 25** |
| Undiscovered resource (USGS mean) | **12,415 MMBBL oil + 202,143 BCF gas = 46,105 MMBOE** |
| Discovery record | **1899 → 2025, a 126-year span** |
| Fields in OSDU | **79** (51 with a volume, 61 dated, **38 creaming-ready**) |
| Province polygons for the camera flight | **13 of 13 present** (lon 95.1–146.5, lat −11.0–9.0) |
| Basin cycles | 46 |
| **Basin cycles that are SOURCED** | **0 of 46 — every one is `literature-recalled`** |
| Basins with a classified tectonic setting | **2 of 13** |

**Slide 4 stops being a metaphor.** The brief illustrates "our knowledge is not
connected" with documents drifting apart. We don't need the metaphor — we can put
the measurement on screen: Indonesia has 46,105 MMBOE of assessed undiscovered
resource, 126 years of discovery, and **not one basin cycle we can cite a source
for**. The reasoning behind the discoveries genuinely is missing from the open
record, and we can prove it in one number.

And the comparison that lands hardest, from the same table across all 179
provinces:

> Alberta Basin: **1,096** catalogued fields. North Sea Graben: **445**.
> Indonesia, all thirteen basins together: **79**.

Not because Indonesia has fewer fields — because the *open, machine-readable
record* of them is thinner. That is the urgency, measured rather than asserted,
and it is the strongest slide in the deck.

**Recommendation: every number on screen comes from a live read of the corpus,
with its source and `n` in the presenter notes.** A keynote that says "measure it"
and then shows decorative numbers is the one thing this audience will catch.

---

## 1. Where it lives

**Settings is a modal** (`cosmo/CosmoSettings.tsx`, 113 lines, `open/onClose/dark/setDark`).
A cinematic fullscreen keynote cannot live inside it.

**The split:**
- **Settings gains a launcher**, not the deck: a "Presentation" section with one
  row — *Indonesia's Geological Legacy · 10 scenes · ~12 min* — and two actions,
  **Present** and **Export standalone**.
- **The deck is its own surface**, mounted outside the Cosmo shell chrome so it
  owns the entire viewport: no rail, no ribbon, no scope bar. Entering hides the
  app; ESC returns to it.

**Route/state:** a `keynote` entry in the nav registry marked `zone: 'command'`,
but hidden from the rail — reachable only from Settings and by deep link
(`?keynote=indonesia`) so it can be opened cold in a meeting room without
clicking through the app first.

---

## 2. Tech decisions the brief leaves open

### 2.1 GSAP is not installed — and I recommend adding it

`three@0.160`, `@react-three/fiber@8`, `@react-three/drei@9`, and the full `d3`
module set are already dependencies. **GSAP is not.**

The brief names GSAP as the timeline engine, and a 10-scene master timeline with
`enter()` / `idle()` / `exit()` per scene, scrubbing, and presenter-mode seeking
is precisely what it exists for. Hand-rolling that on `requestAnimationFrame` is
a week of work and a source of exactly the abrupt transitions the brief forbids.

*Alternative if a new dependency is unwelcome:* the Web Animations API plus a
~150-line timeline shim covers keyframes and seeking but not the camera easing
choreography. My recommendation is GSAP; flag if you'd rather not.

### 2.2 One WebGL canvas, not ten

Ten scenes each mounting their own `<Canvas>` means ten GL contexts — browsers
cap at ~16 and drop the oldest. **One persistent canvas** for the whole deck,
with scenes as swappable groups and the camera as the continuity device. This is
also what makes Slide 6 possible: "one continuous camera movement" through
plate → province → basin → play → field → well is only continuous if the camera
never remounts.

### 2.3 Text is HTML, always

The brief is right and this is non-negotiable: WebGL text is unselectable,
unreadable to screen readers, and blurry at 4K. HTML layer above the canvas,
`pointer-events: none` except on controls.

### 2.4 "Single HTML" vs an in-app page — you need both

The brief says *single HTML*; the request says *a page in Settings*. These serve
different moments:

- **In-app surface** — reads the live corpus, so numbers can never go stale.
- **Standalone export** — one self-contained file with the data inlined as JSON
  and assets as data-URIs. **This is the one that gets presented.** A ministry or
  campus meeting room with no wifi, no dev server, and a borrowed laptop is the
  normal case, and it's the worst possible moment to discover a fetch failed.

Build the surface first; the export is a build step that snapshots the same
component with data frozen at export time and a visible "data as of ⟨date⟩" stamp.

---

## 3. The scenes

Every scene lists what is **real** (from the corpus) versus what is **staged**
(illustrative geometry). The distinction stays internal — but if a number is on
screen, it is real.

### 1 · A Vision for Indonesia's Geological Legacy · *Wonder*
Stars → Earth → atmosphere → camera flies to Southeast Asia → Indonesia
illuminates → subsurface layers ghost in beneath → title.
**Real:** the 13 province polygons, extruded and lit in sequence. The flight
target is their true bbox, so the camera lands where the data actually is.
**Staged:** stars, atmosphere shader, plate/arc ribbons.
*Hold on black for ~2 s before the first star. The room needs to go quiet.*

### 2 · Why I Am Here · *Credibility*
A single glowing well trajectory becomes the career path; seven stages light
along it — Regional Geology → Exploration → Operations → Well Delivery →
Development → Reservoir Management → Digital Transformation.
**Real:** the trajectory geometry can be a genuine Volve well path from
`data-energy/processed/trajectory` rather than a drawn curve — the one place a
real survey costs nothing and means something.
**Staged:** stage labels, proof-point chips (Mahakam, Sisi Nubi, Ruya, Jumelai,
Mauddud, North Oil Company).

### 3 · Why Indonesia Is Different · *National Pride*
Camera rises; four dimensions illuminate across the archipelago.
**Real, and this is the slide that must be exact:**
- 13 basins across compressional, extensional and transitional settings
- 13 petroleum systems · 25 assessment units
- 46,105 MMBOE undiscovered mean
- 126 years of continuous discovery, 1899–2025

**Honesty note:** our data cannot prove *"richest natural laboratory on Earth."*
It can prove **diversity and span**. Suggested on-screen line:

> Thirteen basins. Every major tectonic setting. A hundred and twenty-six years
> of discovery, still running.
> **We should measure it — not merely claim it.**

The claim then *is* the measurement, and nobody in the room can dispute it.

### 4 · The Hidden Risk · *Urgency* — **the strongest slide**
Archive of reports, maps, seismic, logs, notes; connections form, then break,
then drift.
**Real, and devastating:** as the fragments drift, three counters resolve —

```
46,105 MMBOE   assessed undiscovered resource
   126 years   of discovery record
     0 of 46   basin cycles with a citable source
```

Then the field-count comparison: Alberta 1,096 · North Sea 445 · **Indonesia 79**.
*The drift animation stops on that number. Let it sit.*

### 5 · Sovereign Geological Knowledge · *Inspiration*
Broken links reconnect, golden light spreads, **dark → light theme transition as
narrative**, not as a control.
**Staged.** No numbers here — this is the emotional turn, and a statistic would
break it.

### 6 · Our Common Geological Language · *Clarity*
Plate → Province → Basin → Evolution → Stratigraphy → Petroleum System → Play →
Field → Well, as one unbroken camera move.
**Real:** this hierarchy is the ATLAS spine — the same entities and the same
parent links the app already runs on. Use a genuine chain end to end (e.g. Kutei
Basin → its petroleum system → its AU → a real field), so the framework on screen
is the framework in the database.

### 7 · One Possible Implementation · *Confidence*
The framework folds into a workspace. ArgantaEnergy appears **small, once, late**.
**Real:** the frames should be actual Exploration canvas captures — the basin
map, the Magoon–Dow events chart, the field-size distribution. Rendering real
screens is more convincing than a mockup, and they exist now.

### 8 · Three Stages · *Momentum*
DISCOVER (blue) → UNIFY (gold) → LEGACY (white), three worlds, one camera.
**Grounding opportunity:** tie each stage to a real gap from the audit —
Discover = the 79-field coverage gap; Unify = the 0-of-46 sourcing gap; Legacy =
the handover. The roadmap then answers measured problems rather than abstractions.

### 9 · Beyond One Person · *Collaboration*
Force-directed ecosystem around one central node, Shared Geological Framework.
**Real:** `d3-force` is installed, and the node/link model can mirror the actual
knowledge-graph shape rather than invented nodes.

### 10 · The Ask · *Reflection*
Three questions, one at a time. Indonesia glows, slow rotation, near-stillness.
Final line, then fade to black.
*No logo after the fade. The last thing on screen should be the sentence.*

---

## 4. The honesty contract

The audience is senior geoscientists. One inflated number costs the whole deck.

1. **Every on-screen figure traces to the corpus**, and presenter notes carry its
   source and `n`.
2. **Recalled ≠ sourced.** Where a number rests on `literature-recalled` records,
   the deck says so — that's slide 4's entire point, so it costs nothing.
3. **No superlatives the data can't carry.** "Richest" is unprovable; "thirteen
   basins, every major setting, 126 years" is unarguable.
4. **The export stamps its data date.** A deck presented in six months must not
   silently show stale figures.
5. **ArgantaEnergy stays small.** It appears once, on slide 7, as *one possible*
   implementation. The moment it looks like a product pitch, the vision dies.

---

## 5. Budget and accessibility

| Constraint | Target |
|---|---|
| First paint to first star | < 1.5 s |
| Frame rate | 60 fps desktop; degrade particle counts, never scene count |
| Total payload (standalone export) | < 25 MB inc. data |
| GL contexts | exactly 1 |
| Text | 100% HTML |

- **`prefers-reduced-motion`**: camera moves become cuts, particles freeze,
  the story still reads end to end. Not a degraded mode — a designed one.
- **WCAG AA in both themes.** The dark palette's `#B9C2CE` on `#050608` passes
  comfortably; the accents (`#E53935`, `#D8B15A`, `#69D6FF`) must be validated
  against both surfaces before use on text — same validator we used for the
  Exploration palette, same rule: run it, don't eyeball it.
- **Presenter mode**: second window with notes, elapsed timer, next-scene preview.
- **Keyboard only**: ← → Space Home End · O overview · T theme · P presenter ·
  F fullscreen · ESC exit.

---

## 6. Build order

1. **Shell** — surface + Settings launcher, keyboard nav, scene registry with
   `enter/idle/exit`, theme, reduced-motion, presenter mode. No 3D yet; scenes as
   typography only. *The deck should be presentable, in black and white, before
   any WebGL exists.*
2. **Data layer** — one `keynote/data.ts` that reads the corpus and returns the
   exact figures in §0. Truth-locked, so a number can never drift.
3. **Globe + camera** — scenes 1, 3, 10 on the single canvas with real polygons.
4. **Scenes 4 and 6** — the urgency counters and the hierarchy fly-through, the
   two that carry the argument.
5. **Remaining scenes**, then the standalone export.

Wave 1 alone is a presentable deck. Every wave after that is amplification, not
rescue — which is the right shape for something with a date attached.
