# ArgantaEnergy — Cockpit Design Handoff (for ChatGPT)

*Paste this whole file into ChatGPT. It is self-contained — ChatGPT cannot see the codebase,
so everything needed to design the cockpit is here: the story, the real data, the design
tokens, the reusable parts, the constraints, and the ask. Goal: a **wow**, single-screen
command cockpit that is the face of the app.*

---

## 0. Your role & the deliverable

You are the design lead for **ArgantaEnergy**, an operator-grade petroleum intelligence app.
Design the **Cockpit** — the landing surface, the face of the product. It must produce an
immediate *wow* while staying truthful and operational (this is a serious engineering tool,
not a toy).

**Produce:** a single self-contained **HTML file** (inline CSS + vanilla JS, no external
CDNs/fonts — inline everything; use `<canvas>`/WebGL or SVG for graphics) that renders a
**non-scrolling, one-viewport** cockpit. Dark theme is the primary identity; also support a
light theme via a toggle. Respect `prefers-reduced-motion`. Use the real numbers in §5.
Then give a short rationale of your design decisions. Aim for the polish of a Palantir / SpaceX
mission-control screen crossed with Apple Fitness clarity.

---

## 1. The product in one paragraph

ArgantaEnergy is a **"central brain of world petroleum."** It spans the full upstream
lifecycle — Exploration → Field Development → Well Delivery → Reservoir Management → Drilling
Sequence — over a standardized world catalogue of petroleum data. It is **evidence-native and
truth-locked**: every number traces to a real source. The **Volve field** (a real, now shut-in
Norwegian North Sea oil field with a fully open dataset) is the live proof that the whole system
works end-to-end on a real asset. The thesis of the cockpit: *a brain that reasons about all
world petroleum, proven on one real field.*

---

## 2. The cockpit's job

- **Face of the app** — first thing users see; sets the tone.
- **Wow, but operational** — glanceable status of the entire operation in one screen.
- **Non-scroll** — fills one viewport exactly; nothing scrolls (panels may scroll internally only if unavoidable).
- **A living surface** — subtle ambient motion (rotating globe, breathing rings, pulsing status), never busy or gimmicky.
- **A launchpad** — clicking a region/field/lifecycle drills deeper into the app.

---

## 3. The narrative (the spine of the design): World → Proof

The cockpit should let the eye travel from the whole planet down to one real well — this is the
core wow moment and the product's thesis made visual:

```
World → Region (Europe) → Basin (North Sea Graben) → Petroleum System (Kimmeridgian Shales)
      → Assessment Unit (Viking Graben) → Play (Middle Jurassic Hugin)
      → FIELD: Volve → Reservoir (Hugin Fm) → Well 15/9-F-12
```

Every step is real data (USGS world assessment + Norwegian regulator + Equinor's open Volve
set). The signature interaction: a 3D globe of world petroleum provinces that, on selecting the
North Sea, **flies down and the sea surface peels away to reveal the subsurface structure with
the real wells** — planet to pay-zone in one continuous move.

> **Satellite reality-check (important, keep it honest):** Volve is *offshore* (58.44°N, 1.89°E)
> — literal satellite imagery there is just open grey sea. So do **not** promise photographic
> satellite. The truthful wow is: a stylized 3D globe/North-Sea locator → sea-surface peel →
> **real subsurface structure-map surface + well trajectories** underneath. That uses data we
> actually have and looks far better than empty ocean.

---

## 4. Suggested composition (a strong starting point — you may elevate it)

A non-scroll layout, roughly:

- **Ambient hero (dominant, left/center):** the 3D world-petroleum globe → drill-to-Volve
  subsurface. Provinces shaded by undiscovered resource (choropleth). Slow auto-rotation.
- **Vital rings (right rail, top) — Apple-Activity style, context-aware:** at world level they
  show *world endowment* (e.g. discovered vs undiscovered, oil/gas/NGL split); when drilled into
  Volve they become *field vitals* (production vs plan, voidage/VRR, uptime) with a center health score.
- **Agent fleet (right rail, bottom):** 7 named AI agents as glowing status dots (active/standby).
- **Lifecycle lanes (bottom strip, full width):** 5 lifecycles, each a lane with status pill +
  its real headline KPI + a progress bar; clicking a lane enters that lifecycle.
- **Top bar:** brand, a live mission clock, sovereign-tier pill, theme toggle.
- **Proof chip somewhere prominent:** *"1 real field proving the brain · 340 assessment units · 179 provinces mapped."*

This is a proven skeleton — but you are encouraged to find a more striking composition if it
serves the wow and the narrative. Spend the boldness on the hero; keep everything around it quiet.

---

## 5. REAL DATA (design with these exact numbers — do not invent)

### The 5 lifecycles (bottom lanes) — name · status · headline KPI · accent color
| Lifecycle | Status | Headline | Accent |
|---|---|---|---|
| Exploration | BETA | POS 15% · EMV $94MM · Pmean 21.3 MMSm³ | `#22d3ee` |
| Field Development | LIVE | STOIIP 142.3 MMSm³ · NPV $969MM · 13/13 viewers | `#0FB5A6` |
| Well Delivery | BETA | 4 candidates · lead gate Sanction · AFE $12.0M | `#f59e0b` |
| Reservoir Management | LIVE | VRR 1.02 · 7 producers · EUR 18.3 MMSm³ | `#7c3aed` |
| Drilling Sequence | BETA | 2 rigs · RFSU = TD + 45 d | `#e11d74` |

### World endowment (USGS 2012 assessment — public domain)
- **9 regions · 98 countries · 179 provinces · 340 assessment units** (undiscovered oil & gas).
- Region undiscovered-oil means (MMBO): Middle East & N. Africa **111,200** · Central & South
  America **125,900** · Sub-Saharan Africa **115,300** · North America **83,400** · Former
  Soviet Union **63,800** · Asia Pacific **47,500** · Europe **9,900**.
- Volve's province — **North Sea Graben**: undiscovered oil mean **5,093 MMBO** (≈ **8,080 MMBOE**).

### Volve field (the proof — real)
- Operator **Equinor Energy AS** · discovered **1993** · produced **Feb 2008 – Sep 2016** · status **Shut down**.
- **~63 MMbbl** cumulative oil · **24 wellbores** · block **15/9** · offshore, water depth **91 m**.
- Reservoir **Hugin Fm** (Middle Jurassic sandstone) · **OWC 3200 m TVDSS** · **VRR 1.02** ·
  STOIIP 142.3 MMSm³ · φ 0.225 · recovery factor 0.54.
- Field vitals for the rings: **Production vs plan 78% · Voidage (VRR) 1.02 (balanced) · Uptime 91% · Field health 88**.

### Agent fleet (7 — name · lifecycle · state)
WellAion (Field Dev, active) · Prismo (Reservoir, active) · WellWatch (Reservoir, active) ·
WellNexus (Reservoir, active) · GeaVision (Exploration, standby) · GeaGuard (Exploration,
standby) · WellNova (Well Delivery/Drilling, standby). Agent dot color = its lifecycle accent.

### Knowledge & data status (optional tiles)
Knowledge graph ~**140 notes**, **12 entity types**. Data catalogue **573,242 rows · 9 tables**.
Standardized spine = **18 entity types** (World→…→Well across geologic, well, commercial axes).

---

## 6. Design system (honor these — it's the house style)

**Palette (semantic accents; teal is primary):**
`--teal #0FB5A6` · `--cyan #22d3ee` · `--blue #2563eb` · `--violet #7c3aed` · `--amber #f59e0b`
· `--rose #e11d74` · `--green #10b981` (good) · amber (warning) · rose (critical).

**Dark theme (primary):** bg `#070d18` · panel `#0f172a` · panel-2 `#111a2e` · line `#1e2d45` ·
ink `#e2e8f0` · ink-muted `#93a4bd` · ink-faint `#5f708c`.
**Light theme:** bg `#eef2f5` · panel `#ffffff` · line `#dce4ec` · ink `#0d1a26` · ink-muted
`#46596d`. (Darken accents a touch for AA on white: teal `#0c8f72`, etc.)

**Type:** Inter (or system-ui) for UI; JetBrains Mono (or ui-monospace) for numbers, labels,
codes — use `font-variant-numeric: tabular-nums` wherever digits align. Uppercase mono
micro-labels with letter-spacing for the control-room feel.

**Shape & depth:** rounded panels (12–18px), 1px hairline borders in `--line`, soft shadows,
generous internal padding. Cards float on the dark ground.

**Motion:** ambient and slow — a 12–14s aurora drift on the hero, gentle globe rotation, rings
that animate in on load (stroke-dashoffset), a breathing status core. Kill all of it under
`prefers-reduced-motion`.

---

## 7. Reusable building blocks (these already exist in the app — design to fit them)

- **3D structure surface + well tubes** — a WebGL heightmap of the reservoir top surface,
  depth-colored, with real well trajectories as 3D tubes and orbit controls. This is the
  drill-down hero's payload. (You can mock it with a canvas heightmap.)
- **Apple activity rings** — concentric SVG rings encoding percent via `stroke-dasharray`,
  animated, with a center value. Reuse for the vital rings.
- **Aurora hero panel** — a rounded hero with a slow-drifting multi-radial-gradient "aurora"
  background (teal/blue/violet), animated 12s.
- **Animated canvas orb** — a self-contained `requestAnimationFrame` orb (teal/blue bloom, conic
  ring, orbiting agent dots, molten core) used as the AI-agent presence ("Arganta"). Good for a
  glanceable "brain is alive" element.
- **DPR-capped canvas hook + token-driven theming** — all canvas colors read CSS variables so
  they re-theme instantly. Follow that: never hardcode colors in canvas; read the tokens.

---

## 8. Hard constraints (must respect)

1. **Non-scroll**, one viewport. No horizontal body scroll ever.
2. **Both themes** real (dark primary). `prefers-reduced-motion` respected.
3. **Self-contained**: inline CSS/JS, no external fonts/CDNs, embed any assets as data URIs.
   Graphics via Canvas/WebGL/SVG, not long hand-authored path data.
4. **Truthful**: use the real numbers in §5. No fabricated satellite photos of open sea. Every
   figure is traceable — the design should *feel* evidence-native (small provenance ticks, mono
   source labels) without clutter.
5. **Sovereign / offline**: no live external map tiles or APIs (the app runs on-prem). The globe
   is procedural/data-driven, not Mapbox/Google tiles.
6. **Brand**: it's **ArgantaEnergy**; the AI agent presence is **Arganta**. (Do not use any other
   product or operator branding.)
7. **Accessibility**: legible contrast in both themes, visible keyboard focus, semantic color
   (good/warn/critical) kept separate from the teal accent.

---

## 9. What "wow" means here (be opinionated)

- **One signature moment** — the planet-to-pay-zone drill. Make it cinematic but fast.
- **Depth, not decoration** — the wow comes from real 3D structure + real data density read at a
  glance, not from gradients-for-gradients' sake.
- **Calm power** — mission-control restraint: dark ground, precise mono numerics, a few glowing
  focal points (globe, rings, orb). Every pixel intentional.
- **The proof line lands** — a viewer should immediately grasp "this reasons about the whole
  world, and here's a real field proving it."
- Avoid the generic AI-dashboard look (purple-gradient hero on white, emoji section markers,
  everything centered, rounded-lg everywhere). This is an instrument, not a landing page.

---

## 10. The ask (deliverable checklist)

Produce a single self-contained HTML cockpit that:
- [ ] Fills one viewport, non-scroll, dark + light themes, reduced-motion safe.
- [ ] Has the drill-narrative hero (globe → Volve subsurface; canvas/WebGL/SVG mock is fine).
- [ ] Context-aware Apple-style vital rings + a field-health score.
- [ ] The 5 lifecycle lanes with the real KPIs and accent colors (§5).
- [ ] The 7-agent fleet with states.
- [ ] The proof chip and a live mission clock.
- [ ] Uses the palette, type, and motion language of §6; reads as an instrument (§9).
- [ ] A short written rationale of the key design decisions and the one risk you took.

Then stop and present it; we'll iterate before it's implemented in the real app.
