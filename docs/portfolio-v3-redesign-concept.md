# Portfolio v3 — "Glance" redesign · Concept (no build)

> Status: **CONCEPT.** Companion mockup: the "Portfolio v3 redesign" artifact.
> Supersedes the v2 "Mission Control" layout that shipped and kept reading as
> "not pixel perfect." This is a structural redesign, not a CSS nudge.

---

## 1 · The honest diagnosis — why it isn't "pixel perfect"

It's not a spacing bug. The root cause is **scope**: the Portfolio tab is doing
the Growth tab's job. Seven distinct analytical modules are forced onto one
non-scrolling screen —

1. North-star hero  2. AARRR funnel  3. Cohort retention curve  4. Attention /
time-by-app  5. Power-user histogram  6. Top-pages gap map  7. Who&when (donut +
punch + audience + region + device)

— so every one gets shrunk until it loses presence. The symptoms the screenshots
keep showing are all downstream of that one cause:

- **Flat, tiny, gray everything.** With 7 modules competing, nothing is allowed
  to be big, so there's no hierarchy — the eye has nowhere to land.
- **Charts that look broken.** The power-user histogram is 1 tall bar + 4 stubs;
  the retention curve is a 40px squiggle. These need *room and data* to be
  legible; starved, they read as bugs.
- **A cramped right rail.** "Who & when" alone stacks 4–5 sub-charts (donut,
  punch, audience, device, region) into one narrow column.
- **Dead space in the funnel panel**, because its content doesn't fill the
  height it was forced to share.
- **Inconsistent labels.** Sentence-case card titles ("Where attention goes")
  fighting ALL-CAPS section headers ("POWER-USER CURVE · DAYS ACTIVE OF 14")
  fighting cryptic data keys ("num", "parent", "farm-perso…").
- **A misleading funnel.** Bars normalized to a benchmark tick can't be compared
  to each other; "-100%" reads as catastrophe and "1143%" caps at a full bar —
  neither communicates the real number.

**The fix for "not pixel perfect" is fewer, bigger, more confident elements —
not smaller pixels.**

## 2 · The design POV

> **Portfolio is the 60-second glance: "is the ecosystem healthy and growing?"
> Growth is the drill-down. Move the deep breakdowns to Growth, and let the
> five things that answer the glance question breathe.**

Concretely, **demote to the Growth tab** (linked from Portfolio, not deleted):
power-user histogram, cohort-retention triangle, per-page gap map, full region
map, device split. These are analyst tools; they deserve a full tab, not a
40px sliver.

What **stays on Portfolio**, each now with real size:

| Zone | Question it answers | Why it earns the space |
|---|---|---|
| **1 · Pulse** | Are we growing right now? | The one number + its trend + the 5 input levers. The headline. |
| **2 · Funnel** | Is the growth machine working? | AARRR, honest magnitude vs benchmark, one status color per stage. |
| **3 · Moat** | Where does attention actually go? | Measured cross-app time — the differentiated story only we can show. Gets the most space. |
| **4 · Context** | Who, when, where? | One elegant ribbon (roles · rhythm · top region), not a crammed column. |
| **5 · Fleet** | How is each product doing? | The 5-app matrix, refined. |

## 3 · The five specific fixes

1. **Pulse = a real hero.** Big number (56px), delta with direction glyph, and
   a *large* north-star area chart (not a 46px strip). The 5 input metrics
   (activation, lessons/d, time/kid, D1, invites) become a clean stat rail
   with hairline dividers — a system, not floating chips.

2. **Funnel = bullet graphs, honest.** Each AARRR stage is a row: stage name ·
   the real value as a **big number** · a thin track showing where that value
   sits versus its benchmark tick · a status dot (green ≥ benchmark, amber
   half-way, red below/negative). The number carries the truth; the bar is just
   "healthy or not." "-100% · red dot" and "1143% · green dot" both read
   correctly. A small D1-retention sparkline sits beneath as the "do they come
   back" cue.

3. **Moat = the centerpiece.** Ranked time-by-app bars (app-colored, value at
   the tip), a share-of-time donut, and a compact top-pages list with
   **humanized labels** (map `num`→"Number practice", `farm-perso…`→"Personal
   farm", `parent`→"Parent hub"). When there's < 3 days of data it stays ranked
   bars framed as "day one" — intentional, never a broken stacked chart.

4. **Context = one ribbon, not a column.** A single slim band: **who** (a role
   split bar: kid/user/operator), **when** (a compact week-rhythm strip or a
   plain-language peak: "peaks Sun evenings"), **where** (top region only:
   "Qatar · 1.8h"), each with a quiet "full breakdown in Growth →" affordance.

5. **One design system.** A committed type scale (56 / 22 / 15 / 13 / 11 / 10),
   *one* micro-label style (tiny-caps, tracked) used everywhere, an 8px vertical
   rhythm, consistent 18px card padding and 12px gutters, tabular-nums on every
   column of figures. Color discipline: app-slot hues are the only categorical
   colors; status green/amber/red is reserved and never reused as a series;
   everything else is ink. This is the HQ / Vercel-Linear look executed with
   precision, which is what "pixel perfect" actually means.

## 4 · Layout (12-col, three bands, one screen, no scroll ≥1180px)

```
┌───────────────────────────────────────────────────────────────────────┐
│ PULSE  ─ big № + delta ─┬─────── large north-star trend ──────┬─ range │
│        5-metric input rail (activation · lessons · time · D1 · invites) │
├──────────────────┬───────────────────────────────────┬────────────────┤
│ FUNNEL           │ MOAT — where attention goes         │  (moat cont.)  │
│ AARRR bullet rows│ ranked time-by-app bars (big)       │  share donut   │
│ + status dots    │                                     │  + top pages   │
│ + D1 sparkline   │                                     │                │
├──────────────────┴───────────────────────────────────┴────────────────┤
│ CONTEXT ribbon — who (roles) · when (rhythm) · where (top region)      │
├───────────────────────────────────────────────────────────────────────┤
│ FLEET — 5 apps × 8 questions, refined matrix                           │
└───────────────────────────────────────────────────────────────────────┘
```

Fewer modules → each band breathes → the screen has a clear reading order and a
dominant element, which is what was missing.

## 5 · The one decision for you

**Do we accept moving the analyst charts (power-user curve, cohort triangle,
region map, device split, per-page gap map) off Portfolio and into Growth?**
That trade is the whole concept — it's what buys the breathing room. My strong
recommendation is yes. If you'd rather keep everything on one screen, the honest
answer is it will always be dense, and "pixel perfect" then means a
Bloomberg-terminal treatment (mono-spaced dense grid) rather than this calmer
glance — a different, also-valid direction I can mock instead.

## 6 · Build phasing (once direction is approved)

- **P1** — Type/spacing/label system + Pulse hero (biggest visual win).
- **P2** — Funnel bullet-graph rewrite (honest magnitude).
- **P3** — Moat centerpiece + humanized page labels.
- **P4** — Context ribbon; move demoted charts to Growth, add the links.
- **P5** — Fleet matrix polish; responsive + dark-mode QA.
