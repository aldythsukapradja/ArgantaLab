# Indonesia's Geological Legacy — Final Deck (v3, 10 scenes)

> **SUPERSEDED — history only.** The deck that shipped is nine scenes on the
> v1.0 handoff scenario, dark throughout. See
> [KEYNOTE-INDONESIA-AS-BUILT.md](./KEYNOTE-INDONESIA-AS-BUILT.md). Do not read
> this file as a spec.

**For:** Herman Darman — exploration geologist, editor of *An Outline of the
Geology of Indonesia*, ~20 yrs Shell, advisor to Pertamina.
**Runtime:** ~19 min of deck in a 45-min meeting. Built to be interrupted.
**Status:** plan final, no build. GSAP approved.
**Supersedes:** `KEYNOTE-INDONESIA-BUILD.md` v2, `-SPINE.md` v1.2, `-CONCEPT.md`.

---

## 1. The complete table

| # | Scene · Emotion · Time | **Punchline** | Reused from ArgantaEnergy | New work | GSAP | Verified data | Wave |
|---|---|---|---|---|---|---|---|
| **1** | **Where it begins**<br>Wonder · 1:30 | *"Everything we know about Indonesia's subsurface began as someone's reasoning."* | `CockpitMap` (375) — fly to IDN bbox | Starfield, title layer | `CustomEase` descent; staggered basin ignition | 13 province polygons, bbox 95.1–146.5 E / −11.0–9.0 | W2 |
| **2** | **Two basins, one career**<br>Recognition · 1:30 | *"Handil, Tunu, Peciko, Sisi-Nubi, Bekapai. Then Seng, Segat, Bentu. Two basins, fifteen hundred kilometres apart — and I kept seeing the same play."* | `CockpitMap` (Kutei **and** Central Sumatra lit) · `TrajectoryViewer` | Two-basin field ledger | `TextPlugin` reveal in discovery order | Kutei: Badak 1972 → Konta 2025, 20 fields · C. Sumatra: Seng/Segat, Bentu 1981 | W2 |
| **3** | **The link that does not exist**<br>**Unease · 2:30** ← *the hinge* | *"This is not a missing cell. It is a missing shape."* | **`GenerationTimingChart` ×2** (Kutei + C. Sumatra, real `psEvent`) | Blank-field overlay; the link that fails to draw | **`Flip`** — two charts converge, link fails | **Play records: 0** · Kutei `source_rock`: BLANK · *biogenic* in 5/211 narratives · Bekapai absent · IPA12-G-087/104 | **W1** |
| **4** | **The measurement**<br>Urgency · 2:00 | *"Zero of forty-six. Not one basin cycle in Indonesia has a source we can cite."* | Corpus figures | Counter typography | Numeric tween + `snap`, sequential holds | 46,105 MMBOE · 126 yrs (1899–2025) · **0/46** cycles sourced · 2/13 basins classified · **79 vs 445 vs 1,096** | **W1** |
| **5** | **The book problem**<br>Ache · 1:30 | *"The synthesis exists. It just cannot be computed."* | — | Book object, silence | Slow fade, 4 s hold | — (staged, reverent) | **W1** |
| **6** | **Sovereign knowledge**<br>Inspiration · 1:30 | *"A nation should not only own its resources. It should own the understanding of them."* | — | Link reconnection | **Theme tween** dark → light as narrative | — (staged) | W2 |
| **7** | **Regional to production**<br>**Clarity + Confidence · 3:00** ← *the showpiece* | *"Basin to barrel, one unbroken chain — and every step of it already runs."* | **`CockpitMap` → `BasinCharts` (662) → `GenerationTimingChart` → `LogViewer` (574) → `Structure3D` (295) → `ProductionViewer` (287) + `VrrPanel` (118)** | `ViewerFrame` + descent choreography **only** | `Flip` + `MotionPath` across six scales | Real Volve LAS, surfaces, OWC, production/injection | W2 |
| **8** | **Three stages**<br>Momentum · 2:00 | *"Not a system to be delivered. A capability that compounds."* | Gap figures from #4 | 3 colour worlds, 12-month deliverables | Timeline scrub blue → gold → white | DISCOVER 79-field gap · UNIFY 0/46 gap · LEGACY succession | **W1** |
| **9** | **Beyond one person**<br>Collaboration · 1:30 | *"The framework doesn't care who owns it. It only stops working if one person does."* | **`KnowledgeView` (339)** — the real graph | Institution ring + **one empty node** | `d3-force` pulse; dashed march | IAGI · Pertamina · SKK Migas · ITB/UGM/Trisakti | W2 |
| **10** | **The ask**<br>Reflection · 2:00 | *"Future generations should inherit more than data. They should inherit the way Indonesia understands its geology."* | `CockpitMap` idle rotation | 3 questions, final line | Holds; fade to black, **no logo** | — | **W1** |

**Emotional arc:** Wonder → Recognition → **Unease** → Urgency → **Ache** →
Inspiration → **Clarity + Confidence** → Momentum → Collaboration → Reflection.
*All ten of the original brief's beats survive; three are sharpened.*

---

## 2. Scene 3 — the hinge, in full

Two real `GenerationTimingChart`s, side by side. He describes the shared play:
**Tunu (swamp gas) and Seng/Segat (onshore biogenic gas)** — 1,500 km apart,
different basins, same shallow biogenic gas play, same drilling hazard. He
published it in 2012 (IPA12-G-087, IPA12-G-104) and it is in his CV in his own
words. A link tries to draw between the two charts — and **fails.**

| Asked of the corpus | Kutei (3817) | Central Sumatra (3808) |
|---|---|---|
| Petroleum system | Oligocene-Miocene Composite | Brown Shale-Sihapas |
| `source_rock_formation` | **(BLANK)** | Eocene–lower Oligocene Brown Shale *(the thermogenic **oil** system — not the gas he developed)* |
| Mentions *biogenic* | no | no |
| Mentions *shallow gas* | no | no |
| **Play records, entire corpus** | **0** | **0** |

> *"I published this in 2012. Both fields are in the database. And the database
> cannot hold the sentence I just said — there is no Play, so there is nowhere
> for the link to live."*
>
> *"This is not a missing cell. It is a missing shape."*

**The exit line — the fourteen-year arc:**

```
2011–12  Bentu & Korinci Baru PSCs · Seng, Segat — biogenic shallow gas
   ↓     IPA12-G-087 · IPA12-G-104
         Pertamina Hulu Mahakam · Tunu — same play, same hazard
   ↓
2025     GasShield — applied-ML surveillance · EAGE
```

> *"I carried that link in my head for fourteen years and it became GasShield.*
> *How many links are in this room's heads right now, with nowhere to go?"*

That hands the question to him, and bridges directly into scene 8.

**Open decision:** end scene 3 at *"nowhere for the link to live"*, **or** go one
step further and show the `Play` entity added with Seng/Segat ↔ Tunu as its first
two records — *"…and here is what it looks like once the schema can hold it."*
Stronger close, more build. The ATLAS spine already has a `Play` tab with 1 row
and the Exploration spec flags this as gap **G4**, so the work is real but small.

---

## 3. Scene 7 — the descent, six scales, no cuts

| Step | Scale | Component | On screen |
|---|---|---|---|
| 1 | Regional | `CockpitMap` | 13 Indonesian basins → Kutei alone |
| 2 | Basin | `BasinCharts` | Creaming curve, 1972 → 2025, still climbing |
| 3 | System | `GenerationTimingChart` | Source · reservoir · seal · trap · critical moment |
| 4 | Well | `LogViewer` | Real LAS traces + formation picks |
| 5 | Reservoir | `Structure3D` | Volve 3D — surfaces, well paths, OWC |
| 6 | Production | `ProductionViewer` + `VrrPanel` | Rates through time; voidage replacement |

> *"And none of this is a mockup. It is the same code, on the same records, that
> ran before I walked in here."*

**Say the Volve substitution out loud at step 5.** Volve stands in for the deep
end because the Indonesian equivalent is not open — which is the same coverage
gap scene 4 measured, demonstrated rather than asserted. Owning it converts a
weakness into the argument.

---

## 4. Reuse inventory — verified components

| Component | File | Lines | Props |
|---|---|---|---|
| Cockpit map | `cosmo/CockpitMap.tsx` | 375 | `dark, mode, theme, focus, onSelect, onMapReady, overlay, highlight, focusPolygonId` |
| PS events chart | `tabs/exploration/charts/GroupSystem.tsx` | — | `{ scope }` |
| Basin charts | `tabs/exploration/BasinCharts.tsx` | 662 | — |
| Log viewer | `dataqc/viewers/LogViewer.tsx` | 574 | `{ log, picks }` |
| 3D structure | `tabs/fielddev/Structure3D.tsx` | 295 | `{ surfaces, wells, paths, contactDepth, contactLabel, zScale }` |
| Production viewer | `dataqc/viewers/ProductionViewer.tsx` | 287 | `{ prod }` |
| VRR panel | `tabs/reservoir/chart/VrrPanel.tsx` | 118 | `{ months, v, height }` |
| Knowledge graph | `cosmo/KnowledgeView.tsx` | 339 | *(none — full surface)* |
| Trajectory viewer | `dataqc/viewers/TrajectoryViewer.tsx` | — | — |

**~2,700 lines already written.** The keynote sequences them; it does not
reimplement them.

Two integration facts: `CockpitMap` is MapLibre + deck.gl — a **DOM layer, never
sharing a canvas** with three.js; they cross-fade. `KnowledgeView` takes no
props, so scene 9 embeds it whole or gains a ~10-line `scope` prop.

---

## 5. Infrastructure

| Piece | File | Wave |
|---|---|---|
| Surface, `?keynote=indonesia` deep link, ESC exits | `keynote/KeynoteSurface.tsx` | W1 |
| Settings launcher — **Present** / **Export standalone** | `cosmo/CosmoSettings.tsx` *(edit)* | W1 |
| Master timeline; `enter/idle/exit`; **never auto-advances** | `keynote/timeline.ts` | W1 |
| Keyboard ← → Space Home End · O T P F A · ESC | `keynote/useKeynoteKeys.ts` | W1 |
| Truth-locked figures — one source of every number | `keynote/data.ts` | W1 |
| **`ViewerFrame`** — scales app viewers to stage, hides in-app chrome | `keynote/stage/ViewerFrame.tsx` | W1 |
| Both palettes as CSS vars, WCAG AA validated | `keynote/keynote.css` | W1 |
| Reduced motion — camera moves become cuts | in `timeline.ts` | W1 |
| Presenter view — notes, timer, **source + `n` per figure** | `keynote/PresenterView.tsx` | W2 |
| Standalone export, data inlined, "data as of ⟨date⟩" | `keynote/export/build-keynote.mjs` | W3 |

`ViewerFrame` is the only real integration work: app viewers target 350–700 px
panels, not a 4K stage. One component, six scenes.

---

## 6. Dependencies

**Add:** `gsap` + `Flip` (scene 3 morph — highest-impact single effect),
`MotionPathPlugin` (scene 7), `TextPlugin` (scene 2), `CustomEase`.
*Confirm current commercial terms; `Flip` is the only one worth hand-rolling.*

**Installed:** `three` 0.160 · `@react-three/fiber` 8 · `drei` 9 ·
`maplibre-gl` 5 · `@deck.gl/*` 9 · `@equinor/videx-wellog` · full `d3` set.

**three.js is barely needed now** — `Structure3D` owns the 3D, `CockpitMap` owns
the globe. Only scene 1's starfield is new, and it could be CSS.

---

## 7. Waves

| Wave | Scenes | Result |
|---|---|---|
| **W1** | **3, 4, 5, 8, 10** + all infra + `ViewerFrame` | The argument, presentable in typography and real numbers |
| **W2** | **1, 2, 6, 7, 9** | Globe, descent, graph — the proof it runs |
| **W3** | Standalone export, presenter polish, appendix | Offline meeting-room ready |

**Minimum shippable to him: W1 + scene 7** — the argument plus the proof.

---

## 8. Rules that do not bend

1. **One WebGL context.** `CockpitMap` (DOM) and `Structure3D` (three.js) cross-fade; they never share a canvas.
2. **All text is HTML.** Never in WebGL.
3. **Nothing auto-advances.** He will interrupt at scene 3. `idle()` loops forever.
4. **Every figure traces to the corpus.** Presenter mode shows source + `n`. A deck that says *measure it* cannot carry decorative numbers.
5. **ArgantaEnergy appears once**, small, scene 7. The moment it reads as a product pitch, the vision dies.
6. **Career content stays Indonesia-only.** The standalone export is a distributable file; Qatar-side work carries obligations a personal CV bullet does not. Scope the boundary at authoring time, not at export.
7. **Do not claim "richest."** Unprovable, and he will test it. Thirteen basins, every major setting, 126 years — unarguable.
