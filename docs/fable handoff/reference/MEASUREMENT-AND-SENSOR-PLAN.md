# MEASUREMENT & SENSOR PLAN
### Before/after metrics for the digital-twin handoff + a full sensor map for ArgantaLab & KinetikCircle
### Pulled live from Circle HQ on July 7, 2026 — every number below carries its real provenance badge.

---

## 0. THE RULE THIS DOCUMENT FOLLOWS

Your own graph already enforces it: **never present a simulated or placeholder number as if
it were live.** This plan follows the same discipline — where I don't have a real baseline,
I say so instead of inventing one. That's also the point of the sensor map: right now some
of your "metrics" are actually guesses wearing a metric's clothes.

---

## 1. BEFORE / AFTER — THE HANDOFF, MEASURED

This is the scorecard for the Layer 0–4 plan from the last session. Each layer gets a
concrete, checkable metric — not a vibe.

| Layer | Metric | BEFORE (today, real) | AFTER (target) |
|---|---|---|---|
| **L0 — Context readable** | # of dev/context connectors live (GitHub, Supabase) | 0 of 2 wired | 2 of 2 wired |
| **L0 — Context readable** | Obsidian vault has a synced `_index.md` per stage | Not confirmed built | Exists, checked monthly |
| **L1 — Memory unified** | Graph nodes with a linked wiki article (cross-reference) | 0% (no convention doc yet) | Convention doc exists; track % over time |
| **L2 — Skills laddered** | Skills that own a blind/amber node | 0 of 13 skills touch the 12 confirmed blind nodes | `instrumentation-wiring` + `effort-scorer` added; blind nodes owned |
| **L3 — Orchestration** | % of requests routed through a scoring step before running | 0% (doesn't exist yet) | Tracked from first implementation; no target until baseline exists |
| **L4 — Connectors (media)** | Marketing/media connectors wired (Higgsfield, Firecrawl) | 0 of 2 | 2 of 2 |
| **Overall graph** | Instrumentation coverage (`coverage.pct`) | **78%** (59/76 nodes, live) | 95%+ — re-pull `ceo_brief` to check |
| **Overall graph** | Weakest lever | Efficiency · activation (amber) | Re-check after activation-funnel-modeler ships |
| **Money** | CAC/payer | **$75** (⚠️ simulated, not measured) | Same number tracked as **live** once activation funnel is instrumented — don't chase a lower number until the current one is real |
| **Money** | Conversion rate | **2%** (⚠️ simulated) | Same — first goal is provenance upgrade (simulated → live), *then* a real target |
| **Money** | Infra cost/active | **$0.08** (⚠️ simulated) | Live-tracked once Vercel/infra metrics wire through |

**Honest note on the money row:** you don't yet have a real CAC or conversion number —
you have a modeled one. The first "improvement" isn't a lower number, it's an **honest**
number. Chasing a lower simulated figure is chasing a guess. Fix that before setting a
target you can't actually verify.

---

## 2. THE SENSOR MAP — TIER 1: WIRE THESE FIRST (currently blind, zero data)

These are real nodes in your graph, confirmed by name — not invented. Each is a concrete
event to instrument in the ArgantaLab/KinetikCircle codebase.

| Node id | App/section | Sensor to wire | What it tells you | Ladders to |
|---|---|---|---|---|
| `sig.dead_end_quit` | ArgantaLab (learning flow) | Fire when a session ends on a screen with no next action available | Where kids get stuck with nowhere to go | `lever.efficiency` |
| `sig.build_abandoned` | Build Wizard/Lab | Fire when a build is started but not published within N minutes/sessions | Where the creative flow loses kids | `lever.depth` |
| `sig.broken_share_link` | Build Pitch / sharing | Fire on a share-link click that 404s or fails to load | Silent breakage in your k-factor rail | `lever.breadth` |
| `sig.calendar_open_no_add` | KinetikCircle → Calendar | Fire when Calendar opens but no event is added in-session | Whether the parent hook is actually sticking or just being glanced at | `lever.efficiency` |
| `sig.ugc_flagged` | Any UGC surface (Build/Fame/Moments) | Fire on content moderation flag | Trust/safety exposure — Legal owns this | `ns.w2f` (Legal) |
| `arganta.home` (Play Home) | ArgantaLab home tab | View + dwell-time event | Whether Home is a hub or a pass-through | `lever.efficiency` |
| `ship.discover` | Discover tab | View + install-attributed event | Real acquisition-from-in-app signal | `lever.breadth` |
| `land.home` | Landing page | Waitlist-joined event | Top-of-funnel conversion, currently totally blind | `lever.breadth` |
| `land.products` | Landing → Products | Product-view event | Which product actually gets attention pre-signup | `lever.breadth` |
| `land.pitch` | Landing → Pitch/decks | Deck-view event | Investor/partner funnel visibility | `lever.breadth` |
| `sig.deck_no_waitlist` | Landing (derived signal) | Deck viewed but no waitlist join in same session | Whether your pitch is converting interest into leads | `ns.w2f` |

**This is the literal to-do list for the `instrumentation-wiring` skill** — 11 confirmed
events, all currently returning zero data. Note: Legal and Treasury each have additional
blind nodes not named in the pull above — run `office_report(legal)` and
`office_report(treasury)` before finalizing the wiring plan so nothing's missed.

---

## 3. SENSOR MAP — TIER 2: PARTIAL SIGNAL, NEEDS TIGHTENING (amber → live)

These already emit *some* data — the job here is closing the gap to fully live, not
building from zero.

| Area | Nodes (partial/amber) | What "tightening" looks like |
|---|---|---|
| **ArgantaLab core** | `arganta.kinworld`, `learn.hub`, `stage.kinetiklock`, `stage.expansion` | Confirm event fires on every path, not just the happy path |
| **Build pipeline** | `build.wizard`, `build.lab`, `build.pitch` | Track the *funnel* between them (started → published → shared), not just each in isolation |
| **Ship surfaces** | `ship.library`, `ship.gamestore` | Attribute plays to source (organic vs. shared vs. discover) |
| **You / family** | `you.profile`, `you.pulse` | These are engagement proxies — confirm they correlate with real retention, not just opens |
| **Growth** | `lever.breadth` (k-factor), `sig.invite_never_accepted` | This is a FIX, not an INSTRUMENT — data exists, something in the invite flow itself needs fixing |
| **Infra** | `arch.vercel`, `arch.sdk` | Edge health and SDK event completeness — these gate how trustworthy everything above is |

---

## 4. SENSOR MAP — TIER 3: ALREADY LIVE (protect, don't break)

For completeness — these are working and RETAIN-flagged in the graph. Don't touch them
while wiring Tier 1/2; regressions here would cost you more than the new signals gain:

`lever.depth`, `lever.frequency`, `stage.learn`, `stage.parentlock`, all six Learn subtabs
(NumberDash, WordQuest, WonderLab, LogicLand, WorldTrail, LifeQuest), Journey map, Drill,
Item player, Quests, Fame/leaderboards, and the whole KinetikCircle core (Today, Calendar,
Moments, mini-apps, Circles/Connections/Friends).

---

## 5. HOW THIS FEEDS THE WORKFLOW LOOP (the point of sensors, not just the list)

A sensor with no consumer is just a log file. The loop that makes it useful:

1. **Event fires** in the app → written to Supabase.
2. **Circle HQ ingests it** → updates the relevant node's provenance (placeholder → partial
   → live) and health.
3. **Office report reflects it** → next `office_report`/`ceo_brief` pull shows the real
   number, not a guess.
4. **A verdict opens** if the number is bad (FIX/POLISH/INSTRUMENT) — this is already how
   your graph works, you're just feeding it real data instead of leaving it blind.
5. **A skill acts on the verdict** — e.g. `activation-funnel-modeler` runs once
   `calendar_open_no_add` and `dead_end_quit` are live, because now there's real data to
   model instead of a simulated CAC.

This is the actual "sensor → improve workflow" mechanism you asked for. It's not a
dashboard you read — it's a loop that already has three of its four steps built (Circle HQ,
office reports, verdicts). **The only missing piece is step 1: the events themselves aren't
firing yet.** That's Tier 1 above.

---

## 6. ONE SCORECARD NUMBER TO TRACK OVER TIME

If you want a single number to watch week over week: **`coverage.pct` from `ceo_brief`.**
It's already computed, already honest (live/partial/simulated/placeholder breakdown), and
it will move directly as you wire Tier 1 and tighten Tier 2. Today it's 78%. Re-pull it
after each wiring batch — that's your before/after in one number, and everything in this
document is what moves it.
