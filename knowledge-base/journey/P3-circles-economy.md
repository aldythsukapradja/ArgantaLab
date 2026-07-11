---
type: journey-phase
phase: P3
dates: 2026-06-24 → 2026-06-26
commits: 52
status: frozen
tags: [arganta, journey, P3]
---

# P3 · Circles & economy

> [!abstract] The circle became a place, and the wallet learned to move between people
> Three days, 52 commits: the Big Day's SDK spine got its consumers — Family Pulse, Moments, mounts, co-op, Broadcast/Discover, four native Kinetik mini-apps — and the circle turned from an identity row into a social + economic surface. It's also where several of the previous day's "locked" App Builder specs were quietly overturned mid-build.

## Shipped
*(from [[00-MASTER-KB#9 · Build Timeline — 22 days|§9]])*

- **Circle admin RPCs** — the circle stopped being a passive grouping and grew management verbs (roles, membership, admin).
- **Family Pulse** — the first per-circle activity read; the ancestor of HQ's later Command dashboards.
- **Diamond give / take** — the wallet became *social*: diamonds move between people inside a circle, not just earn→spend against a shop.
- **Retention cohorts** — cohort measurement wired *before* there was anyone to retain ([[00-MASTER-KB#11 · Debt Register|D1]]).
- **Moments** — feed / stories / reels / albums / milestones; the "Remember" pillar that anchors KinetikCircle's social half.
- **Daily rings** · **mounts** — rings as a daily retention primitive; mounts as the next cosmetic-economy slot after Buddy outfits.
- **Co-op engine** — shared-state play, the seam the later KinFarm circle-save mounts onto.
- **Broadcast / Discover** — the (still content-thin) discovery surfaces.
- **Kinetik mini-apps** — the four native in-app apps.
- **PWA** — installable web shell, ahead of the P4 Capacitor native wrap.

## Tried & abandoned / superseded

> [!warning] P3 is where the Big Day's ink dried and cracked
> The [[2026-06-23]] doc burst "locked" a bespoke App Builder architecture. Building its consumers in P3 is what exposed how much of it was wrong — the SDK *skeleton* shipped, the *plan around it* did not.

| Locked on the Big Day | Fate in P3 | Replaced by |
|---|---|---|
| **`AppBuilder.tsx`** + own component tree + `parseSDK` inference (`ARCHITECTURE_APP_BUILDER_MODULAR_SCALABLE`, `DESIGN_APP_BUILDER_UI_UX`) | superseded mid-build | one **config-driven `BuilderShell`** shared with the Game Builder; app HTML stored inline on `hq_app` |
| **`app_record` / `hq_app_html` / `hq_app_template`** tables | never created | inline HTML on `hq_app` (+ `visibility` / `circle_ids` columns) |
| **Smart manifest** — auto-derived metrics/agents, the "confirm don't author" promise (`CONCEPT_APP_BUILDER`) | **zero code** | nothing — the cluster's signature idea was dropped silently |
| **Production SDK half** — Supabase auth, `app_record`, RLS, realtime, edge-function agents (`SPEC_CIRCLE_APP_SDK`, "*this spec is locked*") | never built | the localStorage **mock** (`circleAppSDK.ts`) shipped verbatim; the backend stayed a spec |
| **9-app CircleApp catalogue** (`APP_INVENTORY_MAPPING`) | not built as apps | **9 template stubs** in `appTemplates.ts` |
| **Publish → live in KinetikCircle** loop (`DESIGN_BUILDERS_KINETIKCIRCLE_INTEGRATION`) | half-wired | builder gained `listUserCircles` + `circle_ids`; **Kinetik never reads `hq_app`** — circle targeting has no runtime effect |
| **5-tab IA** Today/Calendar/Moments/**Learn/Circle** (`KINETIKCIRCLE-DESIGN-HANDOFF`) | overruled by the shell | shipped nav **Today/Calendar/Moments/Apps/Me**; Learn stayed in ArgantaLab, Apps/Me kept as their own tabs |

> [!success] What *did* land 1:1
> Not everything from the burst drifted. The **four native mini-apps** (Travel / Padel / Kitchen / Vault, `KINETIKCIRCLE-APPS-PLAN`) shipped exactly as specced, tables and all — a rare plan-equals-code case. `STARTER_PROMPT_CIRCLE_APP_SDK` shipped **verbatim** into the live template system. And `KINFARM-CIRCLE-SHARED-SAVE-HANDOFF` was implemented to the letter (`circle_game_saves` + `save/load_circle_game_state` RPCs + `circleBridge` routing on `?circle=`).

## Decisions made here

> [!note] Nothing new logged — P3 is where the Big Day's decisions got *tested*
> [[00-MASTER-KB#13 · Decision Log|§13]] stamps **no decision on Jun 24–26**. But the two entries dated the day before were *enforced* here:
> - **`KinetikCircle uses existing circles, not kinetik_circles`** — the KinFarm shared-save (`circle_game_saves`, not a per-app circle table) and circle give/take both ride the one shared `circles` spine. First real load on the "one identity model" call. ✅ still holds.
> - **`Supabase = single source of truth; kill placeholder UI`** — Family Pulse and retention cohorts read real tables, not mock state.
>
> The *un-logged* decision of P3 is the one nobody wrote down: swapping the bespoke `AppBuilder.tsx` for a shared `BuilderShell`. It was made in code, mid-build, and reversed a spec the docs called "locked" — the pattern [[00-MASTER-KB#13 · Decision Log|§13]] never captures because it happens between commits, not in a table.

## What it taught

> [!tip] The wall between "producer built" and "consumer wired" is where the phase's honesty lives
> P3's builder can publish a circle-scoped app; **KinetikCircle can't render one.** The plumbing landed (`hq_app.circle_ids`, `listUserCircles`), the consumption side didn't — so circle targeting compiles, badges as done, and has zero runtime effect. A producer with no consumer is a log file. → [[build-both-sides-of-the-wire|build the consumer not just the producer]]

- **A spec that says "locked" is a plan you haven't stress-tested yet.** `SPEC_CIRCLE_APP_SDK` and `ARCHITECTURE_APP_BUILDER` both declared themselves final on the Big Day; both were overturned within days of anyone building against them. The mock shipped, the "locked" production backend never did. Lock late — freeze a design only once a consumer has pushed on it. → [[declare-when-you-supersede|lock late]]
- **Rewrite-over-refactor beat a parallel tree — this time it paid.** Collapsing `AppBuilder.tsx` into one `BuilderShell` shared with the Game Builder is the same rewrite reflex that ages line-numbered plans out elsewhere — but here it bought real reuse: one shell, not two builders. The instinct is right when it *removes* a surface; the debt comes when it just moves one. → [[reuse-the-spine-dont-rebuild|rewrite over refactor]]
- **The wallet moving between people is a bigger unlock than the wallet itself.** Diamond give/take turned a solo earn→spend loop into a circle economy — the same "make the primitive social" move that Moments made for content. Both are P3 betting that *the circle*, not the individual, is the unit that retains. Untested: [[00-MASTER-KB#11 · Debt Register|D1]] means no non-family circle ever exercised it. → [[reuse-the-spine-dont-rebuild|the circle is the unit]]
- **Cohort measurement before users is cheap insurance, not vanity.** Retention cohorts wired in P3 cost little and would have paid off the day a stranger arrived. That day never came — but the instrument being *already built* is why the gap is now measurable instead of invisible.
- **The signature idea is the first thing cut under build pressure.** The "smart manifest" auto-inference was `CONCEPT_APP_BUILDER`'s most novel promise and shipped as zero lines. When a three-layer vision meets a deadline, the two boring layers (templates, prompt) ship and the ambitious one (auto-derivation) quietly evaporates. Name the differentiator explicitly or watch it be the thing that's dropped. → [[the-shipped-ia-is-the-real-decision|the differentiator gets cut first]]

## Links

- Neighbors · [[P2-the-big-day]] → **P3** → [[P4-landing-kinquest]]
- Master · [[00-MASTER-KB#9 · Build Timeline — 22 days|§9 timeline]] · [[00-MASTER-KB#13 · Decision Log|§13 decisions]] · [[00-MASTER-KB#11 · Debt Register|§11 debt]] (D1, D8)
- Products built here · [[KinetikCircle]] (Moments · mini-apps · circle economy · IA) · [[ArgantaLabs]] (mounts · rings · Game/App Builder) · [[Circle HQ]] (Family Pulse → Command lineage)
- Superseded design cluster · `CONCEPT_APP_BUILDER` · `SPEC_CIRCLE_APP_SDK` · `ARCHITECTURE_APP_BUILDER_MODULAR_SCALABLE` · `DESIGN_APP_BUILDER_UI_UX` · `DESIGN_BUILDERS_KINETIKCIRCLE_INTEGRATION` · `KINETIKCIRCLE-DESIGN-HANDOFF`
- Shipped 1:1 · `KINETIKCIRCLE-APPS-PLAN` · `KINFARM-CIRCLE-SHARED-SAVE-HANDOFF` · `STARTER_PROMPT_CIRCLE_APP_SDK`
