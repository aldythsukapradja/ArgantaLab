---
title: L0 · Toolchain & Languages
type: layer-tracker
layer: toolchain
status: living
health: amber
maturity: functional
leverage: low
date: 2026-07-11
tags: [arganta, layer, toolchain, dependencies, languages]
cssclasses: [wide-tables]
---

# L0 · Toolchain & Languages — the build substrate

> [!abstract] Health: 🟡 functional, drifting · Leverage: 🔴 low (hygiene)
> The layer *under* the stack: the languages, runtimes, and **60 npm dependencies** across 13 `package.json` files that everything else is built with. Verified against the real manifests. It works — but it's **drifting**: the same libraries sit at different major versions across apps, which is latent debt, not capability.

## Baseline state (2026-07-11)

### Languages & runtimes
- **TypeScript** (5 `tsconfig`) + some plain JS (game engines). **Node** for the Bridge (`tsx`).
- **Build:** Vite everywhere (5 `vite.config`). **Native:** Capacitor (iOS + Android) on `web` + `kinetik`.
- **SQL** (PostgreSQL/Supabase) for the data layer — see [[maps/table-map|Table Map]].

### Dependencies by purpose (60 unique)

| Purpose | Libraries |
|---|---|
| **UI framework** | `react` · `react-dom` · `zustand` (state) · `lucide-react` · `simple-icons` |
| **Build/tooling** | `vite` · `@vitejs/plugin-react` · `typescript` · `tsx` · `vitest` · `@testing-library/react` |
| **Backend/data** | `@supabase/supabase-js` (all apps) |
| **Agentic (Bridge)** | `@modelcontextprotocol/sdk` · `express` · `zod` · `pngjs` |
| **3D / visual** | `three` · `@react-three/{fiber,drei,postprocessing}` (hq) · `pixi.js` (web) · `gsap` · `lenis` · `canvas-confetti` |
| **Charts — hq** | `recharts` · `d3-{array,color,geo,scale,shape}` · `@xyflow/react` · `topojson-client` · `world-atlas` |
| **Charts — web** | `@nivo/{bar,calendar,heatmap,line,radar,core}` |
| **Native** | `@capacitor/{core,cli,android,ios,app,keyboard,splash-screen,status-bar}` |
| **Game-specific** | `js-chess-engine` · `nipplejs` (touch joystick) |

## Maturity × Leverage
- **Maturity 🟡 functional** — modern, coherent choices; but version drift and two parallel charting stacks lower the hygiene score.
- **Leverage 🔴 low** — standardizing versions is pure hygiene; it prevents pain, it doesn't create growth. Do it opportunistically, not as a project.

> [!warning] Version drift — the real finding (verified)
> The same dependency sits at different majors across apps. Latent debt that bites on a shared upgrade:
> | Library | Drift |
> |---|---|
> | **React** | `18.3.1` everywhere **except `landing` → 19.1.0** |
> | **Capacitor** | `web → 6.x` vs **`kinetik → 8.x`** (two majors apart) |
> | **three.js** | `web 0.160` · `hq 0.169` · `landing 0.176` (three versions) |
> | **@supabase/supabase-js** | mostly `2.45` but **`web → 2.110`** |
> | **Vite** | `5.x` everywhere except **`landing → 6.x`** |
> | **Charting** | **two stacks**: `web` uses `@nivo/*`, `hq` uses `recharts + d3 + @xyflow` |

## What changed
*Baseline — the zero point. New deps / version bumps get a dated bullet here.*
- `2026-07-11` — baseline: 60 deps, drift captured (React/Capacitor/three/supabase/Vite), two charting stacks.

## Lessons
- [[dont-add-a-dependency-before-scale-demands-it]] — 60 deps for 0 users; every one is a maintenance surface.
- [[reuse-the-spine-dont-rebuild]] — two charting stacks is the same fork-instead-of-standardize pattern as the copied engine.

## Debt & risks
- **Version drift** (above) — a coordinated React/Capacitor/three upgrade will be painful until aligned.
- **D7** — 5 apps outside root `workspaces` → 5 lockfiles → drift has room to grow.
- Two charting stacks double the surface for the same job.

## Wayforward
1. **Pin a baseline set** on the wedge app first (React, Vite, Supabase, Capacitor, one chart lib); align others when touched.
2. Fold all `apps/*` into root `workspaces` (fixes D7) so one lockfile keeps versions honest.
3. Pick **one** charting stack for new work.
4. See [[tech-evolution]] for *why* each library was adopted and when it drifted.

## Links
[[00-stack]] · [[tech-evolution|Tech evolution timeline]] · [[maps/table-map|Table Map]] · [[00-MASTER-KB#4 · Deployment]] · [[L1-data]]
