---
type: journey-phase
phase: P4
dates: 2026-06-27 → 2026-07-01
status: frozen
tags: [arganta, journey, P4]
---

# P4 · Landing & KinQuest

> [!abstract]
> 44 commits that gave the ecosystem a **front door and a phone**: `arganta.app` grew from a company profile into a cinematic live-data investor deck, the web apps got wrapped in a native Capacitor shell (**one build, three targets — no fork**), and ArgantaLabs gained **KinQuest** + rank/pitch. The one aspirational surface that died here — a standalone Three.js "vision film" — was quietly eaten by the pragmatic deck.

## Shipped

From [[00-MASTER-KB]] §9:

- **`arganta.app` company profile → cinematic deck** — the [[Arganta]] umbrella site (`apps/landing`: Hub · PitchDeck · AppShell · decks · stage · three) went from a profile page to a **live-data investor deck** driven by real ecosystem numbers
- **Capacitor native** — the existing Vite `dist/` builds wrapped in a WebView shell for **Android + iOS**, plugins web-shimmed so `initNative()` is a no-op in the browser; splash, themed status bar, Android back-to-home, safe-area insets all wired (`apps/web/MOBILE.md`)
- **KinQuest** — quest surface in [[ArgantaLabs]] (`apps/web/src/pages/KinQuest.tsx` + `web/data/kinquest`)
- **rank + pitch** — the `rank` lib and PitchBuilder/PitchDeck surface

## Tried & abandoned / superseded

> [!warning] The pragmatic surface eats the aspirational one
> The landing work is where a beautiful idea lost to a useful one.

| Tried (doc) | What was proposed | Fate → replaced by |
|---|---|---|
| `CINEMATIC_FILM_CONCEPT` | A **separate emotional "vision film"** — a standalone `/film` route with an act-machine (ignite / birthPlanet / flash, a human-constellation reveal), explicitly framed as *a different thing* from the pitch decks | **Never greenlit.** No `/film` route, no act-machine in code. The cinematic energy went into the **live-data investor deck** (`PitchDeck` / `GeneralDeck`) instead — the doc itself self-declared "Concept locked, no build yet (2026-06-23)" and that lock never opened |

> [!note] Not re-litigated here
> The `GameBuilder` mobile-visuals refactor (`BUILD_PLAN_MOBILE_VISUALS`) and the whole App Builder architecture divergence are [[P2-the-big-day|P2]] casualties, not P4 — see that note.

## Decisions made here

> [!info] Nothing lands in the formal [[00-MASTER-KB]] §13 log for Jun 27–Jul 1
> The `2026-06-23` batch belongs to [[P2-the-big-day|P2]]; the `2026-07-01` "27 agents → six offices" call is HQ Command work ([[P5-hq-command|P5]]) dated at the boundary. The real P4 decisions were made **in the build, not the log**:
>
> - **Wrap, don't fork.** One React/Vite build runs on web, Android and iOS — no parallel native codebase; Supabase talks over the network unchanged.
> - **Pragmatic deck over vision film.** The investor surface should show *real numbers*, not staged cinematics — so the `/film` branch was dropped for a live-data deck.

## What it taught

- **Wrap, don't fork.** The Capacitor bet — web-shim the plugins so the native bridge is a no-op in-browser — meant *zero* forked code and Supabase working unchanged over the localhost origin. This is the same "one build, N targets" instinct the [[00-MASTER-KB]] praises across the repo. → [[reuse-the-spine-dont-rebuild|wrap dont fork]]
- **The pragmatic surface eats the aspirational one.** When a team ships under real constraints, the useful artifact (a live-data deck) consumes the beautiful one (a standalone vision film). The aspirational branch doesn't get killed in a meeting — it just never gets its route. → [[the-shipped-ia-is-the-real-decision|pragmatic eats aspirational]]
- **A front door for a house with no visitors.** P4 built the site, the app-store shell, the pitch — the entire *distribution surface* — for an ecosystem with **0 external users** ([[00-MASTER-KB]] §11 debt **D1**). Native packaging is real but the store-launch last mile (native Google OAuth, icons) stayed open; a wrapped app on a simulator is not an app a stranger installed.

## Links

- [[Arganta]] · [[ArgantaLabs]] · [[KinetikCircle]]
- [[00-MASTER-KB]] §9 (timeline) · §10 (status board) · §11 (D1)
- Prev: [[P3-circles-economy]] · Next: [[P5-hq-command]]
