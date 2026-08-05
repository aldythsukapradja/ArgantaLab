# Exploration Canvas — Visual & Interaction Contract

**Status:** contract only, no build. **Date:** 2026-08-04.
**Third of three:** `EXPLORATION-CANVAS-CONCEPT.md` (why) → `EXPLORATION-CANVAS-SPEC.md` (what) →
**this** (how it looks, how it behaves, how it reads as one story).

---

## 1. The left rail — verdict: **DROP IT in Exploration**

> **Revised 2026-08-04 (second pass).** An earlier draft of this section said "keep the column and
> employ it as a Scope & Pin rail." That was wrong, and re-deriving it produced the opposite answer.
> Three facts settled it: (1) the 9-dot study thread I wanted to put in the rail **duplicates the
> ribbon's 9 buttons**; (2) `StudyTree.tsx` — the original left rail — is **already dead code, not
> imported by anything**, so the ribbon replaced it deliberately and `wsb-drawer` is its ghost;
> (3) filters belong in **one row above the charts**, horizontal, which is also the mobile-native
> shape. See §1.3 for the item-by-item disposition.

### What is actually there today

`ExplorationShell` calls `<WorkflowRibbon groups={…} active={…} onSelect={…} label="…" />`
— **with no `drawer` prop.** `WorkflowRibbon` still renders `<div className="wsb-drawer">{drawer}</div>`,
and the CSS reserves it:

```css
.wsb-layout { grid-template-columns: 180px minmax(0,1fr); }
.wsb-drawer { grid-area: 2/1/3/2; border-right: 1px solid var(--line); }
```

**So Exploration ships a permanently blank 180-pixel column** with a border on it. The component
comment says why — Field Development passes its Petrel Input tree there, and the column is held open
so the canvas doesn't jump width between verticals.

That reasoning is sound for *consistency* and indefensible for *this vertical* — 180px of empty
chrome next to charts that need every pixel is the worst of both.

### 1.1 Dead code found while checking

| File | Lines | Imported by | Status |
|---|---|---|---|
| `exploration/StudyTree.tsx` | 30 | **nothing** | dead — the original `.exs-tree` left rail, replaced by `WorkflowRibbon` |
| `exploration/SuiteCanvas.tsx` | 24 | **nothing** | dead — replaced by `WidgetBlueprintViewer`. (`fielddev/SuiteCanvas.tsx` is a different, live file) |
| `.wsb-drawer` | — | rendered, always empty in Exploration | the 180px ghost of `StudyTree` |

The left rail was already removed from this vertical on purpose. What remains is the reserved
column, not a decision to have one.

### 1.2 Verdict

**Drop the rail in the Exploration workspace. Keep the `drawer` API for Field Development.**

One CSS change: the layout column becomes conditional on whether a vertical actually passes a
drawer. The "canvas must not jump width between verticals" argument does not survive costing —
it pays 180px of dead space permanently to avoid a one-time layout shift on a navigation nobody
performs rapidly.

Note that Exploration **does** keep a rail where a rail is right: `.exs-body` / `.exs-tree` (238px)
in Knowledge/dossier mode, which navigates 17k entities. A navigator earns a rail; a chart canvas
does not.

### 1.3 Where each proposed rail item goes instead

| Item | New home | Why it's better there |
|---|---|---|
| Scope state (`WORLD`/`DOSSIER`/`COMPARE`) | **Control row**, left segment | It's a readout of the pin count — belongs beside the pins, not stacked above them |
| Pins 0–4 | **Control row**, centre | 4 compact chips (swatch + short name + ✕) ≈ 440px, fits from 1100px up; wraps to a second line below that |
| Facets (6 groups) | **Control row**, right — collapses to a `Filters (2)` popover under 1100px | The dataviz interaction rule is explicit: filters go in one row above the charts |
| Evidence key | **Per-chart legend** + one compact key in the control row | Legends are per-chart anyway; a duplicated global key was never the mechanism |
| Study thread (9 dots) | **The ribbon already is this** | Nine dots beside nine buttons is the same nav twice |

**Net:** the canvas gains 180px at every breakpoint, the control row costs ~34px once, and mobile
gets a horizontal scroll-snap chip row instead of a bottom-sheet component that would have had to
be built from scratch.

### While we're here — a real bug in the current responsive CSS

```css
@media(max-width:900px){ .wsb-widget:nth-child(3){display:none} }
@media(max-width:720px){ .wsb-widget:nth-child(n+2){display:none} }
```

**On a phone, 2 of every 3 widgets silently disappear.** No indication, no way to reach them. That
is not responsive design, it's amputation — and it contradicts the canvas contract already
established in Fieldcraft (*fit by densifying and paginating, never by hiding*). §5 replaces it.

---

## 2. Palette — computed, not chosen

Validated with the dataviz validator against **this app's real surfaces** (`--panel` light `#ffffff`,
dark `#0f172a`), not the skill's defaults. Every hue below is already a token in `cosmo-system.css`.

### 2.1 Categorical — adjacent-pair forms (bars, stacked bars, lines, columns, ribbons)

| Slot | Role in this workspace | Light | Dark |
|---|---|---|---|
| 1 | primary series / pinned basin A | `#2563eb` (`--blue`) | `#3b82f6` |
| 2 | pinned basin B | `#f59e0b` (`--amber`) | `#d97706` |
| 3 | pinned basin C | `#0FB5A6` (`--teal`) | `#0d9488` |
| 4 | pinned basin D | `#ef4444` (`--red`) | `#e04a4a` |
| 5 | overflow | `#7c3aed` (`--purple`) | `#8b5cf6` |
| 6 | overflow | `#10b981` (`--green`) | `#059669` |

```
LIGHT  ✅ all pass — worst adjacent CVD ΔE 12.9 (#ef4444↔#0FB5A6, deutan)
              worst adjacent normal ΔE 25.2 · WARN contrast: amber 2.15, teal 2.57, green 2.54
DARK   ✅ all pass — worst adjacent CVD ΔE 11.4 · worst normal ΔE 24.3 · all ≥3:1 contrast
```

The slot **order** is the CVD-safety mechanism. The first ordering tried (blue, amber, teal,
purple, red, green) put green next to red at ΔE 8.1 — barely over the floor. Moving red to slot 4
lifted the worst adjacent pair to 12.9. **Do not re-order these for aesthetics.**

**The light-mode contrast WARN is not dismissable:** amber, teal and green sit below 3:1 on white,
so every chart using them ships **visible direct labels or the table view** (the relief rule). In
practice that's already our house style — see §3.

### 2.2 All-pairs forms — **hard cap of 3 hues**

Scatter, bubble, choropleth, the CRS matrix, the analogue arc map, small multiples: every pair is
visible simultaneously, so the adjacent pairlist doesn't protect us.

**Validated all-pairs set (both modes): slots 1–3 only** — blue, amber, teal.
Light worst pair CVD ΔE 14.4 / normal 25.2. Dark worst pair CVD ΔE 12.5 / normal 19.1.

Adding a 4th hue breaks it, and I tested the obvious candidates rather than assuming:

| 4th candidate | Result |
|---|---|
| red `#e04a4a` | ❌ dark: red↔amber normal ΔE **11.4** (below the 15 floor) |
| purple `#7c3aed` | ❌ both modes: purple↔blue deutan ΔE **0.4** light / **1.3** dark — indistinguishable |
| magenta `#db2777` | ❌ dark: magenta↔teal deutan ΔE **3.8** |

**Consequence — two design rules fall out of this, and they're better designs anyway:**

- **PS element roles (4 classes)** → source `blue` · reservoir `amber` · seal `teal` ·
  **overburden `--ink3` neutral gray**. Semantically right: overburden is the one role that isn't a
  play element, so it should recede. 3 hues + neutral, all-pairs clean.
- **Geodynamics (5+ classes: rift, sag, pre-rift, inversion, passive-margin, foreland)** →
  do **not** give each a hue. Group into 3 super-classes — **extensional** (blue) /
  **contractional** (amber) / **quiescent** (teal) — and carry the sub-class as **hatch angle**
  (0° / 45° / 90°). Colour answers "what kind of basin", texture answers "which stage", and it
  survives greyscale printing, which a 6-hue fill never would.

Beyond 3, fold to "Other" or facet into small multiples. **Never generate a hue.**

### 2.3 Sequential (magnitude)

Single hue, light→dark. **Blue** is the default ramp: province `boeMean` choropleth, the
depositional count heatmap, field-density surfaces.
Second concurrent sequential context takes **amber** as its own one-hue ramp — never a rainbow, and
never blue and amber in the same ramp.

### 2.4 Diverging (polarity)

**Blue ↔ red**, neutral gray midpoint (light `--line`, dark `--line2`). Used for exactly two things:
delta-vs-peer-median in the scorecard, and predicted-minus-observed in the calibration plot.
Both are genuinely signed. Nothing else gets a diverging ramp.

### 2.5 Status — reserved, never a series

`good #0ca30c` · `warning #fab219` · `serious #ec835a` · `critical #d03b3b`.
Used only for artifact state (settled / draft / stale / superseded) and completion grade.
**Always with icon + label** — warning and serious are sub-3:1 on white by design.

### 2.6 Provenance — a texture channel, not a hue channel

The provenance grade must never compete with the series colour, because a chart can be
*blue and recalled at the same time*.

| Grade | Encoding |
|---|---|
| `SOURCED` | solid fill |
| `DERIVED` | solid fill + hairline dashed top edge |
| `RECALLED` | **45° hatch over the fill** |
| `USER` | 135° hatch + 1px dashed outline |

One `<pattern>` def, reused. This is the single most important visual decision in the product: with
626 of 630 basin cycles recalled, the hatch is what keeps the Framework column honest — and it stays
honest in greyscale, in print, and under `forced-colors`.

---

## 3. Mark specs — the house style

Applied to all 27 widgets so the tabs read as one system.

| Element | Spec |
|---|---|
| Bars | 4px rounded on the data-end only, square at the baseline; 2px surface-colour gap between adjacent bars and between stacked segments |
| Lines | 2px, no smoothing on time series (a monotone spline on a discovery curve invents discoveries that didn't happen) |
| Points | ≥8px diameter; 2px surface ring where marks overlap — mandatory on the field-point map and the ranking bubble |
| Area | ≤15% fill under a 2px line, never a solid |
| Grid | hairline `--line2`, horizontal only; no vertical grid except on the geologic time axis where periods *are* the structure |
| Axis | `--ink3`, 1px; baseline is the only emphasised rule |
| Labels | selective direct labels — first, last, min, max, and the pinned basin. **Never a number on every mark** |
| Text | always `--ink`/`--ink2`/`--ink3`. **Text never wears the series colour** — a swatch beside it carries identity |
| Numerals | `tabular-nums` in tables and axis ticks; proportional in hero figures |
| Empty | never a blank panel — the degrade ladder message (§6) with the `n` that caused it |

**No dual axes. Ever.** Endowment and field count are two charts or one indexed chart, never two
y-scales. This is the discipline's most common chart crime and the fastest way to look amateur.

**Legend rule:** ≥2 series always gets a legend; ≤4 series also gets direct labels. One series gets
no legend box — the title names it.

---

## 4. Interaction — premium means *responsive to the cursor*, not decorated

Per the visual SOP already on file for this app (interactive over static, real geometry over
pictures), every widget is interactive by default. Six behaviours, consistent across all 27:

1. **Hover.** Crosshair + tooltip on line/area; per-mark tooltip on bar/point/cell. Hit targets
   larger than the mark (≥24px effective). Tooltip carries value, unit, **`n`**, and provenance chip
   — the same four fields everywhere, so users learn one tooltip.
2. **Brush → cross-filter siblings** *within the tab only.* Never across tabs; cross-tab state you
   can't see is state you can't audit.
3. **Click → pin.** Any basin mark on any chart, in any tab, pins that basin. One gesture, nine
   tabs. This is what makes the rail feel like a rail and not a filter panel.
4. **Facet chips dim to 12% opacity**, they do not remove. You keep the denominator on screen —
   "this basin's post-2010 discoveries are all in the bottom decile" is only visible if the other
   deciles are still there. *Exception:* the choropleth filters destructively, because a
   half-transparent polygon reads as missing data.
5. **Scrub, where time is the story.** Creaming curve, discovery cadence, and the PS events chart
   share **one time scrubber** when they're on screen together.
6. **Table view toggle** on every chart. Mandated by the light-mode contrast WARN, and it's also
   the export path and the screen-reader path. One toggle, one component, 27 charts.

**Motion:** 180ms ease-out on state change; enter transitions only on first paint, never on
re-filter (re-animating on every facet click is nausea, not polish).
`@media(prefers-reduced-motion:reduce)` kills all of it — the file already respects this, keep it.

**Deck.gl/WebGL specifically:** the map is the one place where real GPU rendering earns its keep —
7,787 points with picking at 60fps. But it gets a `<canvas>` fallback message if WebGL is
unavailable, and it must not be the only way to reach any number on screen.

---

## 5. Responsive — the canvas fits by re-composing, never by hiding

**Replaces** the current `display:none` rules entirely. The contract: **every widget is reachable at
every breakpoint.**

| Breakpoint | Ribbon | Control row | Canvas | Chart heights |
|---|---|---|---|---|
| **≥1440px** | full row, 9 buttons | one line: scope · 4 pins · 6 facet groups | **hero 2fr + support column 1fr** (support stacks 2 charts vertically) | hero ≥420px, support ≥200px |
| **1100–1440px** | full row | one line: scope · pins · `Filters (n)` popover | hero 3fr + support 2fr | hero ≥360px |
| **900–1100px** | full row, labels shrink | one line, pins truncate to swatch + 6 chars | hero full width, 2 support side-by-side beneath | hero ≥320px, support ≥220px |
| **600–900px** | horizontal scroll-snap chips | scroll-snap chip row, sticky | single column, all 3 stacked, page scrolls | each ≥260px |
| **<600px** | scroll-snap chips + step counter `4/9` | scroll-snap chip row, sticky | single column, **scroll-snap between widgets**, sticky finding line | each ≥240px, full-bleed |

**Mobile-specific rules:**
- Charts re-compose, they don't shrink: a 179-row ranked bar becomes a **top-10 + "show all"**;
  the 5-factor CRS matrix becomes **one factor at a time with a factor swipe**; the map drops the
  choropleth legend into the bottom sheet.
- Touch targets ≥44px. Tooltip becomes tap-to-pin-tooltip (tap elsewhere dismisses) — hover doesn't
  exist.
- The table view toggle is *more* prominent on mobile, not less. A dense chart on a phone plus an
  easy table is a better product than a chart that pretends to fit.
- Horizontal scroll is allowed **inside a chart container** (`overflow-x:auto`) and **never on the
  page body**.

**The hard rule:** if a widget cannot fit, it **paginates or summarises** — it never sets
`display:none`. A user must be able to find every one of the 27 widgets on a phone.

---

## 6. Storytelling — how the 9 tabs read as one narrative

A workspace with 27 good charts and no thread is a dashboard. The thread is three cheap mechanisms:

### 6.1 The finding line

**One generated sentence at the top of every canvas**, for the current scope. Deterministic from the
data — templated, thresholded, never an LLM at runtime — and it carries its own provenance chip.

> **Atlas** — *"North Sea Graben ranks 3rd of 179 by discovered endowment (445 fields, 145 with a
> dated volume) but sits at the 41st percentile for median field size — a mature, many-small-fields
> province."* `DERIVED · n=145`
>
> **Charge Timing** — *"Trap formation predates peak generation in 1 of 1 modelled systems; the
> critical moment falls in the Late Cretaceous."* `SOURCED · n=1`
>
> **Volumetrics** — *"3,861 discovered fields worldwide give a median of 48.7 MMBOE; this basin's
> median is 21.4 — the remaining tail is small-field."* `SOURCED · n=145`

Where the data is thin the finding line says so and **that is the finding**:
*"Only 2 dated discoveries — insufficient for a creaming curve; showing the 8-basin analogue cohort
instead."*

### 6.2 The study thread

The 9 rail dots are the narrative arc, and each carries its artifact's state:

```
Where?         Can it work?        What do we drill?
①──②──③   →   ④──⑤──⑥      →    ⑦──⑧──⑨
Atlas          Strat               Register
Framework      Charge Timing       Volumetrics
Analogs        Play/CRS            Ranking
```

Each tab's output is a named input to the next — Analogs' priors feed Volumetrics; Charge Timing's
overlap test *is* Play/CRS's timing factor; CRS × Volumetrics = Ranking. Hovering a dot shows what
it produced and what consumed it. That's the lineage claim made visible instead of asserted in a
footer.

### 6.3 Story mode

One button: **"Tell the story"**. Walks the 9 tabs in order for the pinned scope, 6 seconds each,
finding line spoken as a caption, chart entering with its transition. Ends on the drill/drop record.

It's a presentation generator you get almost free — the finding lines already exist, the charts
already exist, the order is already the workflow. And it's the demo that sells the product in
90 seconds without anyone touching a control.

---

## 7. Definition of "polished" — the ship checklist

A widget is done when **all** of these are true. Anything less is a draft.

- [ ] Uses only validated palette slots; all-pairs forms capped at 3 hues + neutral
- [ ] Provenance rendered as **texture**, chip visible, `n` printed
- [ ] Hover tooltip with the standard 4 fields (value · unit · n · provenance)
- [ ] Legend for ≥2 series; direct labels for ≤4; no number on every mark
- [ ] Table view toggle present and correct
- [ ] Degrade ladder implemented — no blank panel is reachable
- [ ] Renders at 375px wide without hiding anything or scrolling the body
- [ ] Light **and** dark validated against the real surfaces (`#ffffff` / `#0f172a`)
- [ ] `prefers-reduced-motion` honoured
- [ ] Finding line generated deterministically for that widget's data
- [ ] Screenshotted and **looked at** — the validator checks colour, not label collisions

---

## 8. What changes in code (still no build)

Additive to the §6 list in the spec sheet:

1. `WorkflowRibbon` — Exploration starts passing `drawer={<ExplorationScopeRail/>}`; the empty
   column becomes the rail. Add the collapse state to `zustand`.
2. Delete both `display:none` responsive blocks in `workspace-blueprint.css`; replace with the §5
   grid ladder.
3. New `viz/` module in `apps/energy/src`: `palette.ts` (the validated slots, both modes),
   `patterns.tsx` (the 4 provenance `<pattern>` defs), `Tooltip.tsx`, `TableView.tsx`,
   `FindingLine.tsx`, `DegradeGate.tsx`. Six files that all 27 widgets share — this is what makes
   nine tabs look like one product rather than nine.
4. `.wsb-widget-grid` becomes the hero+support ladder rather than `repeat(3, 1fr)` with
   `overflow:hidden`.
