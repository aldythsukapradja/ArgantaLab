# Portfolio v2 — "Mission Control" · Concept & Build Plan

> Status: **CONCEPT — approved build has not started.**
> One page, no scroll, edge-to-edge, every number live from Supabase.
> Companion visual mockup: see the "Portfolio v2 mockup" artifact from the concept session.

---

## 0 · Why the current page is boring (honest diagnosis)

1. **It's a report, not a cockpit.** Everything is stacked vertically in a centered
   1180px column — you scroll and read, nothing competes for attention, nothing says
   "the company is alive RIGHT NOW".
2. **Inconsistent density.** KinetikCircle/ArgantaLab show 8 stats, LashiraBloom 4;
   the scorecard is 6 tiles; nothing lines up.
3. **The most differentiated data we own — measured time-on-page — is invisible**
   (the migration hasn't been run, so the whole section collapses into a setup hint).
4. **No "so what".** Numbers without benchmarks, trends, or the one insight a
   founder/investor should walk away with.

## 0.5 · BLOCKER: run the migration (30 seconds)

`app_usage_beats` does **not exist** in the live DB (verified: REST probe → 404).
All five apps are already deployed with the tracker and are trying to write beats.
**Run `supabase/migration_hq_engagement.sql` in the Supabase SQL editor** — data
starts flowing within a minute, retroactively nothing is lost except time.
The v2 build below extends that file with a v3 migration; the base one must exist first.

---

## 1 · Deep research — how the best teams actually run this dashboard

Frameworks distilled from a16z's growth-metrics guides and Amplitude's North Star
playbook (sources at the bottom):

| Practice | Who preaches it | What it means for us |
|---|---|---|
| **One North Star + 3–5 input metrics** | Amplitude | The hero number (weekly engaged accounts) must be surrounded by the inputs the team can move: activation, time-in-app, lessons/day, invites. Not 20 numbers — 1 + 5. |
| **DAU/MAU + L-histogram ("power user curve")** | a16z / Facebook growth | The single most credible consumer-engagement chart: histogram of "days active out of last 14/28". Shows whether we're building a habit or a toy. We can compute it TODAY from `hq_activity()`. |
| **Retention curves D1 / D7 / D30, by cohort** | a16z | "Do people come back?" expressed as a flattening curve, not a single %. We have `hq_retention` cohorts; v2 adds the D1/D7/D30 curve read. |
| **Cohorted, not blended** | everyone | Blended averages hide decay. Keep the cohort triangle in Growth; Portfolio shows the headline curve. |
| **Output vs input dashboards** | Amplitude | Portfolio = outputs (the investor read). Growth = inputs (the operator read). Keep the split, make them consistent. |
| **Time = attention = the moat metric** | consumer social playbooks | Nobody else can measure cross-app family attention; our beats table is the differentiator. It deserves the center of the page. |

**Kids-data guardrail (COPPA-aligned, even at family scale):** for `role='kid'`
profiles we collect **no precise location, no device fingerprint, no ad IDs**.
Coarse signals only (timezone-derived region, device class), first-party, and the
guardian owns the account. Gender/birthday already live in `profiles`, entered by
the parent — we aggregate them (age bands, split), never show a kid row with
location. Guest devices get a random local id, no cross-site anything.

---

## 2 · Sensor audit — what we capture vs what v2 adds

**Already live (in `@arganta/usage` tracker + existing tables):**

| Sensor | Where | Status |
|---|---|---|
| Screen time per app | app_usage_beats.secs | ✅ shipping (needs migration run) |
| Which page/tab/scene | app_usage_beats.page | ✅ shipping — per-app page keys incl. lashira farm/realm |
| Who (auth user / guest device) | user_id / client_id | ✅ shipping |
| Session boundaries | session_id | ✅ shipping |
| Hour-of-week rhythm | local_hour / local_dow | ✅ shipping |
| Learning actions mix | diamond_ledger kinds | ✅ live |
| Social actions | kinetik_post / reactions / calendar | ✅ live |
| Gender + birthday (age) | profiles (parent-entered) | ✅ in DB, not yet surfaced |
| Role split (kid/parent/operator) | profiles.role | ✅ in DB |

**v2 tracker upgrade (additive columns, one ALTER):**

| New sensor | Column | How | Why |
|---|---|---|---|
| Coarse location | `tz` (IANA timezone) | `Intl.DateTimeFormat().resolvedOptions().timeZone` | WorldMap region split without IP/GPS — kid-safe |
| Language | `locale` | `navigator.language` | localization priority |
| Device class | `device` ('mobile'\|'tablet'\|'desktop') | UA + viewport heuristic | where to invest UX |
| Viewport | `vw` | window.innerWidth bucket | responsive QA priorities |
| Clicks / interactions | `clicks` int | count pointerdown per flush window | intensity, not just presence; "which page gets clicked vs stared at" |
| Entry page | first beat of session flagged `entry` | session-local flag | acquisition landing analysis |
| Referrer (landing only) | `ref` | document.referrer host | where visitors come from |

Explicitly **not** collected: GPS/IP geolocation, ad identifiers, contact data,
cross-app third-party IDs. (FTC COPPA guidance: suppress location + demographic
identifiers for children; aggregate, first-party analytics are the compliant path.)

**Retention path sensors (the "way to retention"):** entry page → activation event
(first ledger earn / first post / first farm action) → return next day. All three
already derivable: beats(entry) × hq_activity × D1. v3 RPC stitches them into one
funnel per app.

---

## 3 · The one-page Portfolio — "Mission Control"

### Hard requirements
- **No scroll at ≥1280×800.** Below 1280px wide it gracefully stacks and scrolls
  (physics: a phone cannot show 30 numbers at once).
- **Edge-to-edge**: Portfolio joins the `full` surfaces (like Vault/Architecture) —
  no 1180px center column.
- **Every number live**, refreshed on an interval (see §5), previous frame kept at
  reduced opacity during refetch — no skeletons, no jumps.
- **One filter row scopes everything**: 7d / 14d / 30d.

### Layout (CSS grid, 12 cols × 6 rows, 100dvh minus topbar)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ R1 · NORTH-STAR STRIP (h≈92px, cols 1-12)                                    │
│  [Weekly engaged: 5  ▼44% WoW] [input chips: activation·time/kid·lessons·   │
│   invites·D1] ——— 8-week AreaTrend ——— [7d|14d|30d] [● live · updated 12s]  │
├──────────────┬──────────────────────────────────────┬────────────────────────┤
│ R2-R4 LEFT   │ R2-R4 CENTER (cols 4-9)              │ R2-R4 RIGHT (10-12)    │
│ (cols 1-3)   │  ATTENTION — the moat                │  WHO & WHEN            │
│ THE FUNNEL   │  StackedCols: daily minutes by app   │  DonutD3 share of time │
│ 6 AARRR      │  (tab: Attention | Mint vs burn)     │  PunchCard (mini)      │
│ pillar rows  │  ──────────────────────────────      │  Audience strip:       │
│ as Gauge     │  POWER USER CURVE (L14 histogram)    │  kids/parents · age    │
│ bars w/      │  + Retention D1·D7·D30 curve         │  bands · device split  │
│ benchmark    │  side by side                        │  WorldMap (tz regions) │
│ ticks        │                                      │                        │
├──────────────┴──────────────────────────────────────┴────────────────────────┤
│ R5-R6 · APP FLEET (cols 1-12, 5 equal cards, h≈240px)                        │
│ [KinetikCircle][ArgantaLab][LashiraBloom][Circle HQ][Landing]                │
│  each: mark + status + 24h sparkline + EXACTLY 8 KPIs (4×2 micro-grid)      │
│  + one-line auto-insight ("moments up 3× after cup week")                    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### The consistent 8 — one KPI contract, tailored per app
Same grid shape everywhere (2 acquisition · 3 engagement · 2 retention · 1 money),
so your eye compares apps column-by-column:

| Slot | KinetikCircle | ArgantaLab | LashiraBloom | Circle HQ | Landing |
|---|---|---|---|---|---|
| A1 people | Members | Learners | Players | Operators | Visitors |
| A2 groups/new | Circles | New·7d | Circle farms | Surfaces used | New visitors |
| E1 core action | Posts·7d | Lessons/day | Farm actions | Builds/publishes | Deck views |
| E2 second action | Reactions | Accuracy·30d | Realm visits | Vault notes | Embed opens |
| E3 time | Time·range | Time·range | Time·range | Time·range | Time·range |
| R1 habit | Calendar/day | Stickiness | Sessions/player | Days active | Return visits |
| R2 comeback | Flywheel % | D1 return | Session length | — streak | Bounce % |
| M money | Rev/family | Rev/family | XP→learn rate | Cost of ops (—) | Waitlist/CTA |

(every cell = live source already in DB or in beats; none invented)

### Chart reuse map (nothing new invented, everything already in the repo)

| Panel | Component (existing) |
|---|---|
| North-star strip trend | `d3/AreaTrend` |
| Funnel pillar bars + benchmark tick | `rcharts/Gauge` (or HBars w/ target line) |
| Daily attention stack | `d3/StackedCols` |
| Mint vs burn tab | `d3/AreaTrend` (dual series) |
| Share-of-time | `d3/DonutD3` |
| Rhythm | `d3/PunchCard` |
| Power-user curve | `d3/HBars` vertical variant (tiny add to chartkit) |
| Retention curve | `d3/AreaTrend` (3 points/cohort) or `CohortHeat` mini |
| Geo split | `surfaces/WorldMap` (extract to component, feed tz-regions) |
| App-card sparkline | `d3/AreaTrend` (bare, 40px, no axes) |
| Audience split | `d3/DonutD3` small / stacked strip from `chartkit` |

---

## 4 · Growth page v2 — the detailed breakdown, for EVERY app

1. **App scope switcher** in the header: `All · ArgantaLab · KinetikCircle ·
   LashiraBloom · HQ · Landing` (slot-colored chips; color follows the app
   everywhere).
2. **"What users actually do — per app"** (replaces "What kids actually do"):
   - ArgantaLab → diamond_ledger activity mix (existing donut)
   - KinetikCircle → action mix: posts · reactions · calendar adds · broadcast
     views (new `hq_kinetik_mix` RPC over existing tables)
   - LashiraBloom → scene-time mix from beats pages: farm-circle · farm-personal ·
     visits · realm:* · onboarding
   - HQ → surface-time mix (which builders you actually use)
   - Landing → section-time mix + referrers
   - "All" → normalized: share of total TIME by app (beats), with per-app top action
3. **LashiraBloom snapshot strip** on Overview (mirror of KinetikSnapshot):
   players · time · sessions · top realm · farm actions · circle farms.
4. **Retention & Acquisition tabs get an honest scope note**: learn-engine metrics
   are ArgantaLab-only today; beats-based "any-app active" is shown alongside as
   *Ecosystem WAU*. Recommendation: keep the North Star learning-based (it's the
   mission), add ecosystem-WAU as a secondary line on the same chart.
5. Unicorn scorecard gains **Power-user curve** + **D7** tiles (a16z set complete).

---

## 5 · Live-updates architecture

- **Interval refetch** every 45s while the tab is visible (respects prompt-cache
  of the operator's attention: pause on hidden tab). All panels re-render against
  the same slice; previous frame kept at 55% opacity during flight.
- **Live tick**: a small `● live · updated Ns ago` indicator in the north-star
  strip; each successful refetch resets it.
- **One round trip**: new `hq_portfolio_pulse(p_days)` RPC bundles everything the
  page needs (engagement + funnel + fleet + audience + geo + power curve) into one
  jsonb so the no-scroll page paints in a single flight. Growth keeps its
  per-tab RPCs.
- Realtime channels are overkill at current scale; revisit when beats > 1M rows.

## 6 · New SQL (one file: `migration_hq_engagement_v3.sql`)

1. `ALTER TABLE app_usage_beats ADD COLUMN IF NOT EXISTS tz text, locale text,
   device text, vw smallint, clicks smallint, entry boolean, ref text` (+ checks).
2. `hq_portfolio_pulse(p_days)` — the one-flight bundle (§5).
3. `hq_power_curve(p_days)` — days-active histogram from `hq_activity()` ∪ beats.
4. `hq_retention_curve()` — D1/D7/D30 for the last 4 weekly cohorts.
5. `hq_audience()` — age bands, gender split, role split, device split (aggregates only).
6. `hq_geo()` — tz → region counts (server-side tz→country map for common zones).
7. `hq_kinetik_mix()` / lashira & landing mixes derive from beats pages — no new RPC.

## 7 · Build plan (phased, each phase shippable)

| Phase | Scope | Touches |
|---|---|---|
| **P0** | *(user)* run `migration_hq_engagement.sql`; verify beats arrive | Supabase |
| **P1** | Tracker v2 sensors (tz/locale/device/vw/clicks/entry/ref) + v3 migration file + `hq_portfolio_pulse` | packages/usage, supabase |
| **P2** | Portfolio Mission Control: full-surface grid, north-star strip, funnel rail, attention center, who&when rail | apps/hq Portfolio.tsx (rewrite), theme.css grid classes, Shell `full` list |
| **P3** | App fleet strip w/ 8-KPI contract + sparklines + auto-insights | Portfolio + `hq_app_pulse` part of bundle |
| **P4** | Power-user curve + retention curve + audience + WorldMap panels | d3 kit (+VCols variant), WorldMap extraction |
| **P5** | Growth v2: app scope switcher, per-app action mix, LashiraBloom strip, ecosystem-WAU overlay | Growth.tsx, growth.ts, small RPCs |
| **P6** | Polish: refetch keep-frame, live tick, responsive stack <1280px, dark-mode QA, chart-harness update | — |

Estimate: P1–P3 one long session, P4–P6 a second. Every phase leaves main deployable.

## 8 · Open decisions (defaults chosen, veto anytime)

1. **North Star stays learning-based** with ecosystem-WAU as secondary line (not
   replacing it). *Default: yes.*
2. **HQ + Landing get fleet cards** (5 cards) — you asked "tailored by apps"; the
   operator cockpit and the funnel-top ARE apps of the company. *Default: include.*
3. **No-scroll breakpoint at 1280px**; below it the grid stacks. *Default: yes.*
4. **Kid privacy defaults** as §2 (no precise geo ever for kid roles). *Default: locked.*

### Sources
- a16z — 16 Startup Metrics: https://a16z.com/16-startup-metrics/
- a16z — Guide to Growth Metrics: https://a16z.com/growth/guide-growth-metrics/
- a16z — The Power User Curve: https://a16z.com/the-power-user-curve-the-best-way-to-understand-your-most-engaged-users/
- a16z — Benchmarking social apps: https://a16z.com/do-you-have-lightning-in-a-bottle-how-to-benchmark-your-social-app/
- Amplitude — North Star Playbook: https://amplitude.com/books/north-star/about-north-star-framework
- FTC — COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- SuperAwesome — analytics for kids' apps: https://www.superawesome.com/a-guide-to-setting-up-google-analytics-for-kids-apps-and-sites/
