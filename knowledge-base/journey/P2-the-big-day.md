---
type: journey-phase
phase: P2
dates: 2026-06-23
status: frozen
tags: [arganta, journey, P2]
---

# P2 · The Big Day

> [!abstract]
> One calendar day, **84 commits** (the repo's all-time peak) and a **design doc burst** of ~10 specs: KinetikCircle was rebuilt clean and rebranded, the Circle Game/App SDK spine landed as a skeleton — and half a dozen architectures the docs "locked" that same morning were quietly superseded before the day ended.

## Shipped

From [[00-MASTER-KB]] §9:

- **KinetikCircle clean rebuild + rebrand** — the whole app re-cut on the shared spine (not a fork)
- **Instagram-style Me** profile surface · **activity rings** · **calendar Board/Month** views
- **Circle Game SDK spine** — `circleAppSDK.ts` (the localStorage mock) + `circleAppPrompt.ts` (starter LLM prompt) + `appTemplates.ts` (9 hardcoded templates), all in `apps/hq`
- **Game Builder + App Builder** — the builder surfaces themselves
- **Kid PIN login** — the real auth path that superseded P1's device-side player switcher
- **318 content items** for ArgantaLabs

## Tried & abandoned / superseded

> [!warning] The Big Day is the repo's densest doc-vs-code divergence
> ~10 specs were written *and marked "locked / spec is locked / ready to build"* on 2026-06-23. The code shipped a **skeleton of the spine** and then walked away from almost every specific architecture those docs froze. This is the origin case of the [[declare-when-you-supersede|lock-late]] pattern.

| Tried (doc) | What was "locked" | Fate → replaced by |
|---|---|---|
| `CONCEPT_APP_BUILDER` | Three layers: templates + prompt assistant + **smart manifest** (auto-derive metrics/agents, "confirm don't author") | **Layer 3 has zero code.** Templates + prompt shipped; the auto-inference — the concept's signature promise — was never built |
| `ARCHITECTURE_APP_BUILDER_MODULAR_SCALABLE` + `README_APP_BUILDER_DESIGN` | Standalone `AppBuilder.tsx` tree, `parseSDK.ts`, `app_record` / `hq_app_html` / `hq_app_template` tables | Superseded mid-build → **one config-driven `BuilderShell`** shared with the Game Builder; app HTML stored **inline on `hq_app`** |
| `SPEC_CIRCLE_APP_SDK` | The "real mode" half: Supabase auth, `app_record` table, RLS, realtime, edge-function agents | Never implemented. The **mock shipped verbatim**; apps run only against `localStorage` — the production backend (the whole point) stayed spec |
| `DESIGN_APP_BUILDER_UI_UX` | Named components `TemplateCarousel` / `InferencePanel` / `ManifestPanel` + auto-inference badges | Folded into generic shared `Catalogue/Studio/Analytics` pages; the **inference-badge UX — the doc's differentiator vs GameBuilder — never shipped** |
| `DESIGN_BUILDERS_KINETIKCIRCLE_INTEGRATION` | Live-member preview injection + per-circle publishing consumed by KinetikCircle | Builder plumbing landed (`listUserCircles`, `hq_app.visibility` + `circle_ids`); **consumption side never wired — Kinetik doesn't read `hq_app`**, so circle targeting has no runtime effect |
| `APP_INVENTORY_MAPPING` | 9-app scope catalogue | Became **9 template stubs, not 9 shipped apps** — scope catalogue outran delivery |
| `BUILD_PLAN_MOBILE_VISUALS` | Line-numbered refactor of `GameBuilder.tsx` (CatalogView/FeaturedStrip/GameCard) + new `ResponsiveContainer.tsx`, `Skeleton.tsx`, `getThumbnailUrl` | **None exist.** The game builder was rewritten as a thin `BuilderShell` wrapper — the surface was replaced, not incrementally optimized |
| `CINEMATIC_FILM_CONCEPT` | A standalone `/film` route with an act-machine (ignite / birthPlanet / flash, human-constellation reveal) | **Never greenlit.** No route, no code — the cinematic energy went into the live-data investor deck (`PitchDeck` / `GeneralDeck`) instead |

> [!success] What actually held from the burst
> `STARTER_PROMPT_CIRCLE_APP_SDK` shipped **verbatim** into `circleAppPrompt.ts` and is still the live starter prompt. The SDK mock matches `SPEC_CIRCLE_APP_SDK` almost exactly. The convergence that stuck was the *shared* `BuilderShell` — reuse won even as the bespoke plans lost. `docs/README.md` (written late) is the honest coda: it catalogues the sprawl and flags that **nothing marks which doc still wins**.

## Decisions made here

From [[00-MASTER-KB]] §13 — both foundational decisions are dated **2026-06-23**:

| Decision | Rationale | Holds? |
|---|---|---|
| KinetikCircle uses existing `circles`, **not** `kinetik_circles` | One identity model | ✅ |
| Supabase = single source of truth; **kill placeholder UI** | No fake data | ✅ |

> [!note] These two are the day's real product
> The 84 commits and the doc burst are noise next to these two lines. Refusing a `kinetik_circles` table is *the* moment "the spine is the company" ([[00-MASTER-KB]] §0) became policy — and it's why the rebranded Kinetik is a skin, not a fork. → [[reuse-the-spine-dont-rebuild|one identity model]]

## What it taught

- **The novel promise is the first thing cut.** Across every App Builder doc, the *skeleton* shipped (templates, mock SDK, starter prompt) and the *differentiator* died — smart-manifest auto-inference, the inference badges, the "confirm don't author" flow. When a build compresses, the load-bearing-but-hard idea is exactly what gets dropped, and the docs still read "locked." → [[declare-when-you-supersede|lock late]]
- **A publish path with no consumer is inert.** The builder gained `visibility` + `circle_ids` and a publish action, but KinetikCircle never learned to *read* `hq_app`. Half a pipe is zero pipe: circle-scoped publishing has no runtime effect to this day. Proof-of-done is a consumer, not a column.
- **Line-numbered plans against a monolith are a bet the file survives.** `BUILD_PLAN_MOBILE_VISUALS` targeted specific lines of `GameBuilder.tsx`; the file was rewritten into a shared shell and the plan aged out in hours. This is [[reuse-the-spine-dont-rebuild|rewrite-over-refactor]] biting the same day it was written — a repo that rebuilds invalidates precise plans faster than it executes them.
- **Config-driven reuse beat bespoke trees — and that was the *right* abandonment.** Collapsing two parallel builders (App + Game) into one `BuilderShell` with data-as-templates is the one supersession that made the codebase smaller and stronger. Not every dead-end is a loss; the "locked" per-builder architecture *deserved* to be walked away from.
- **The aspirational surface gets eaten by the pragmatic one.** The emotional `/film` vision lost to the live-data pitch deck. When one artifact must ship, the measurable/investor-facing one wins over the aspirational one — every time, this day included.

## Links

- Neighbors · [[P1-labs-core]] → **P2** → [[P3-circles-economy]]
- Master · [[00-MASTER-KB]] §9 (timeline) · §11 (debt) · §13 (decision log)
- Cluster arcs · **app-builder-sdk** · **misc-root** (both dated 2026-06-23)
- Products seeded here · [[KinetikCircle]] (rebuild/rebrand · kid PIN · Me · rings · calendar) · [[Circle HQ]] (`BuilderShell` · `hq_app` · SDK spine) · [[Arganta]] (pitch deck absorbed the film concept)
