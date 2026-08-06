# Indonesia's Geological Legacy — Build Plan (v2, 10 scenes)

> **SUPERSEDED — history only.** The deck that shipped is nine scenes on the
> v1.0 handoff scenario, dark throughout. See
> [KEYNOTE-INDONESIA-AS-BUILT.md](./KEYNOTE-INDONESIA-AS-BUILT.md). Do not read
> this file as a spec.

**Status:** plan only, no build. **Spine:** `KEYNOTE-INDONESIA-SPINE.md` v1.2, compressed 14 → 10.
**Root:** `apps/energy/src/keynote/`
**Principle:** *reuse, don't rebuild.* It looks real because it **is** real — the
same components the app runs on, driven by the keynote timeline.

---

## 1. What can be reused — verified, with sizes and props

Every one of these already exists, is prop-driven, and can be mounted inside a
scene without modification.

| Component | File | Lines | Props | Keynote use |
|---|---|---|---|---|
| **Cockpit map** | `cosmo/CockpitMap.tsx` | 375 | `dark, mode, theme, focus, onSelect, onMapReady, overlay, highlight, focusPolygonId` | Globe → Indonesia → basin. `focus` + `focusPolygonId` **already give the keynote camera control** |
| **PS events chart** | `tabs/exploration/charts/GroupSystem.tsx` → `GenerationTimingChart` | — | `{ scope }` | Magoon–Dow chart for the Kutei system, real `psEvent` data |
| **Basin charts** | `tabs/exploration/BasinCharts.tsx` | 662 | — | Creaming curve, basin plates, chart library |
| **Log viewer** | `dataqc/viewers/LogViewer.tsx` | 574 | `{ log, picks }` | Real Volve LAS traces + formation picks (`videx-wellog`) |
| **3D structure** | `tabs/fielddev/Structure3D.tsx` | 295 | `{ surfaces, wells, paths, contactDepth, contactLabel, zScale }` | The Volve 3D model — surfaces, well paths, OWC |
| **Production viewer** | `dataqc/viewers/ProductionViewer.tsx` | 287 | `{ prod }` | Oil/gas/water rates through time |
| **VRR panel** | `tabs/reservoir/chart/VrrPanel.tsx` | 118 | `{ months, v, height }` | Voidage replacement — production vs injection |
| **Injection / VRR tab** | `tabs/reservoir/InjectionVrr.tsx` | 75 | — | Surveillance framing |
| **Knowledge graph** | `cosmo/KnowledgeView.tsx` | 339 | *(none — full surface)* | The real graph as the "shared framework" |
| **Trajectory viewer** | `dataqc/viewers/TrajectoryViewer.tsx` | — | — | Well path for scene 2 |

**~2,700 lines of viewer code already written.** The keynote's job is to
*sequence* them, not to reimplement them.

**Two integration notes.** `CockpitMap` is MapLibre + deck.gl, so it is a DOM
layer, **not** part of the three.js stage — the two never share a canvas, they
cross-fade. And `KnowledgeView` takes no props; scene 9 either embeds it whole or
gets a small `scope` prop added (~10 lines).

---

## 2. The ten scenes

| # | Scene · Emotion | **Punchline** | Reused from ArgantaEnergy | New work | GSAP | Wave |
|---|---|---|---|---|---|---|
| **1** | **Where it begins** · Wonder | *"Everything we know about Indonesia's subsurface began as someone's reasoning."* | `CockpitMap` (`overlay='full'`, fly to IDN bbox) | Starfield + title layer | `CustomEase` descent; staggered basin ignition | W2 |
| **2** | **Two basins, one career** · Recognition | *"Handil, Tunu, Peciko, Sisi-Nubi, Bekapai. Then Seng, Segat, Bentu. Two basins, fifteen hundred kilometres apart — and I kept seeing the same play."* | `CockpitMap` — Kutei **and** Central Sumatra lit together | Field ledger, both basins | `TextPlugin` reveal in year order | W2 |
| **3** | **The link that does not exist** · **Unease** ← *the hinge* | *"There is no field in the schema for what I just told you."* | **`GenerationTimingChart`** ×2 (Kutei + Central Sumatra, real `psEvent` grids) | Blank-field overlay; the un-drawable link | **`Flip`** — two charts converge, the link fails to form | **W1** |
| **4** | **The measurement** · Urgency | *"Zero of forty-six. Not one basin cycle in Indonesia has a source we can cite."* | Figures from the corpus | Counter typography | numeric tween + `snap` | **W1** |
| **5** | **The book problem** · Ache | *"The synthesis exists. It just cannot be computed."* | — | Book object, silence | slow fade, 4 s hold | **W1** |
| **6** | **Sovereign knowledge** · Inspiration | *"A nation should not only own its resources. It should own the understanding of them."* | — | Link reconnection | **theme tween** dark→light | W2 |
| **7** | **Regional to production** · **Clarity + Confidence** ← *the showpiece* | *"Basin to barrel, one unbroken chain — and every step of it already runs."* | **`CockpitMap` → `BasinCharts` → `GenerationTimingChart` → `LogViewer` → `Structure3D` → `ProductionViewer` + `VrrPanel`** | Descent choreography only | `Flip` + `MotionPath` between five real viewers | W2 |
| **8** | **Three stages** · Momentum | *"Not a system to be delivered. A capability that compounds."* | Gap figures from scene 4 | 3 colour worlds | timeline scrub | **W1** |
| **9** | **Beyond one person** · Collaboration | *"The framework doesn't care who owns it. It only stops working if one person does."* | **`KnowledgeView`** — the real graph | Institution ring + **one empty node** | `d3-force` pulse; dashed march | W2 |
| **10** | **The ask** · Reflection | *"Future generations should inherit more than data. They should inherit the way Indonesia understands its geology."* | `CockpitMap` idle rotation | 3 questions, final line | holds, fade to black, no logo | **W1** |

**Emotional arc, all beats intact:** Wonder → Recognition → **Unease** → Urgency →
**Ache** → Inspiration → **Clarity + Confidence** → Momentum → Collaboration →
Reflection.

---

## 2b. Scene 3 in detail — the analogue that cannot be recorded

**This replaces "source rock: blank" as the hinge. It is sharper, it is his own
published insight, and it indicts the *framework* rather than the data entry.**

### The insight
Tunu (Kutei, swamp gas) and Seng/Segat (Central Sumatra, onshore biogenic gas)
are 1,500 km apart in different basins with different tectonic histories — and
share a play: **shallow biogenic gas, and with it the same shallow-gas drilling
hazard.** He worked FDPs on both, and published it:

- *Integrated Reservoir Study in Bentu–Seng–Segat Fields, Central Sumatra Basin* — IPA12-G-087 (2012)
- *3D Pore Pressure Prediction Model in Bentu Block, Central Sumatra Basin* — IPA12-G-104 (2012)

His CV states it in his own words: **"Seng & Segat (onshore biogenic gas)"**,
**"Tunu (swamp gas)"**.

### What the corpus says when asked to connect them — verified

| | **Kutei (3817)** | **Central Sumatra (3808)** |
|---|---|---|
| Petroleum system | Oligocene-Miocene Composite | Brown Shale-Sihapas |
| `source_rock_formation` | **(BLANK)** | Eocene–lower Oligocene Brown Shale |
| Narrative mentions *biogenic* | **no** | **no** |
| Narrative mentions *shallow gas* | **no** | **no** |
| Assessment units | Turbidites · Deltaics · Fold & Thrust Belt | Pematang/Sihapas Siliciclastics |

- **Play records in the entire corpus: 0.**
- *biogenic* appears in **5 of 211** petroleum-system narratives worldwide.
- Central Sumatra's recorded source rock is the **thermogenic oil** system. The
  shallow biogenic gas he actually developed is **not in the record at all**.
- **Bekapai is absent from the corpus entirely** — a producing Mahakam field.

### The beat
Two `GenerationTimingChart`s side by side, both real. He describes the shared
play. A link tries to draw between them — and **fails**, because there is no
entity to attach it to.

> *"I published this in 2012. It's in my CV. Both fields are in the database.*
> *And the database cannot hold the sentence I just said — there is no Play, so
> there is nowhere for the link to live."*
>
> *"This is not a missing cell. It is a missing shape."*

**Why this is the strongest scene in the deck:** it moves the argument from
*bookkeeping* to *framework*, which is what the initiative is actually about.
Herman will immediately supply three more analogues of his own that are equally
unrepresentable — and the moment he does, the pitch is made by him rather than
to him.

---

## 3. Scene 7 in detail — the descent

This is where the reuse pays off and where the "regional → production" story
lives. **One continuous descent through five real viewers**, each holding ~12
seconds, no cuts:

| Step | Scale | Component | What he sees |
|---|---|---|---|
| 1 | **Regional** | `CockpitMap` | 13 Indonesian basins, then Kutei alone |
| 2 | **Basin** | `BasinCharts` | Creaming curve — 1972 Badak → 2025 Konta, still climbing |
| 3 | **System** | `GenerationTimingChart` | Source, reservoir, seal, trap + critical moment |
| 4 | **Well** | `LogViewer` | Real LAS traces, formation picks |
| 5 | **Reservoir** | `Structure3D` | Volve 3D — surfaces, well paths, OWC |
| 6 | **Production** | `ProductionViewer` + `VrrPanel` | Rates through time; voidage replacement |

Spoken across the descent:
> *"Regional geology to a producing barrel. Six scales, one chain, no
> re-typing between them."*
>
> *(at the last step)* *"And none of this is a mockup. It is the same code, on
> the same records, that ran before I walked in here."*

**Why it works on Herman specifically:** he has lived every one of those six
scales. A slide that shows all of them connected — and admits at step 3 that the
source rock is blank — is simultaneously the demo and the argument.

*Volve stands in for the deep end of the chain because the Indonesian equivalent
is not open. **Say that out loud** — it is the same coverage gap scene 4
measured, demonstrated rather than asserted.*

---

## 4. What compression dropped, and where it went

| v1.2 scene | Fate |
|---|---|
| 3 · What the machine knows | **Fused into scene 3** — one chart that fills, then empties. Stronger as one beat |
| 7 · Why now | **Folded into scene 4's narration** — one sentence, not a slide |
| 9 · One common language | **Became scene 7's spine** — the descent *is* the common language |
| 10 · One implementation | **Became scene 7's payoff** — showing it run beats saying it exists |
| 12 · What could go wrong | **Moved to scene 8** as the third column, and to the appendix in full |

Nothing was lost; four scenes became two stronger ones.

---

## 5. Infrastructure

| Piece | File | Wave |
|---|---|---|
| Surface + `?keynote=indonesia` deep link, ESC exits | `KeynoteSurface.tsx` | W1 |
| Settings launcher — **Present** / **Export standalone** | `cosmo/CosmoSettings.tsx` *(edit)* | W1 |
| Master timeline, scene registry `enter/idle/exit`, never auto-advances | `timeline.ts` | W1 |
| Keyboard: ← → Space Home End · O T P F A · ESC | `useKeynoteKeys.ts` | W1 |
| Truth-locked figures — one source of every number | `data.ts` | W1 |
| Viewer host — mounts app components with keynote-scale CSS | `stage/ViewerFrame.tsx` | W1 |
| Both palettes as CSS vars, WCAG AA validated | `keynote.css` | W1 |
| Reduced motion — camera moves become cuts | in `timeline.ts` | W1 |
| Presenter view — notes, timer, **source + `n` per figure** | `PresenterView.tsx` | W2 |
| Standalone export, data inlined, "data as of ⟨date⟩" | `export/build-keynote.mjs` | W3 |

**`ViewerFrame` is the one piece of real integration work**: app viewers are
built for ~350–700 px panels, not a 4K stage. It wraps a component, applies a
scale transform and a keynote type ramp, and hides in-app chrome (toolbars,
table toggles). One component, used by six scenes.

---

## 6. Dependencies

`gsap` + `Flip`, `MotionPathPlugin`, `TextPlugin`, `CustomEase` — **to add**
(confirm current commercial terms; `Flip` is the only one worth hand-rolling).
Everything else installed: `three` 0.160, `@react-three/fiber` 8, `drei` 9,
`maplibre-gl` 5, `@deck.gl/*` 9, `@equinor/videx-wellog`, full `d3` set.

**three.js is now barely needed.** `Structure3D` already owns the 3D, and
`CockpitMap` owns the globe. Only the starfield in scene 1 is new 3D — and it
could be CSS.

---

## 7. Waves

| Wave | Scenes | Result |
|---|---|---|
| **W1** | **3, 4, 5, 8, 10** + all infra + `ViewerFrame` | The argument, presentable: the blank Mahakam source rock, `0 of 46`, the book, the plan, the ask |
| **W2** | **1, 2, 6, 7, 9** | The globe, the descent, the graph — the "it's real" proof |
| **W3** | Standalone export, presenter polish, appendix | Meeting-room ready offline |

**W1 + scene 7 is the minimum that should ever be shown to him** — the argument
plus the proof it runs. Scene 7 is W2 only because the descent choreography needs
care, not because the components need building.
