---
title: Tech Evolution — what entered the stack, when, and why
type: journey-evolution
status: living
date: 2026-07-11
tags: [arganta, journey, tech, dependencies, evolution]
cssclasses: [wide-tables]
---

# 🧪 Tech Evolution — the stack, over time

> [!abstract] What this is
> The evolution of the **toolchain** ([[L0-toolchain]]) mapped onto the [[00-arc|build journey]]: which library/runtime entered the stack in which phase, *why*, and whether it later **changed or drifted**. Pairs the "what we use" (L0) with the "why we started, and what we swapped."

> [!warning] Provenance
> The local clone holds git history only from **2026-07-08** onward. Adoption *timing* before that is **`#inferred`** from the phase narrative ([[00-arc]]) + doc dates + version fingerprints — not git-verified. Facts read straight from `package.json` are **`#known`**. Treat the phase column as approximate; treat the "current version" column as exact.

## Timeline — what entered the stack

| Phase | Entered the stack | Why | Current state |
|---|---|---|---|
| [[P0-genesis\|P0]] | **React + Vite + Supabase** | The core bet: SPA + one backend-as-truth. Guest-first auth. | 🟢 held — the whole company still runs on it #known |
| [[P0-genesis\|P0]] | **Static HTML → React** migration | Early games were static HTML, folded into React | 🔵 superseded — HTML prototypes archived #inferred |
| [[P1-labs-core\|P1]] | **zustand** (state) | Lightweight store for Labs surfaces | 🟢 held — used in web/hq/kinetik #known |
| [[P2-the-big-day\|P2]] | **Circle Game SDK** (in-house) | The spine — templates-as-data + one builder shell | 🟢 held; SDK "real mode" still a mock (atlas) #known |
| [[P3-circles-economy\|P3]] | **PWA** tooling | Installable before native | 🔵 later joined by Capacitor #inferred |
| [[P4-landing-kinquest\|P4]] | **Capacitor** (native iOS/Android) | Ship ArgantaLabs + KinetikCircle to stores | 🟡 **drifted** — `web@6.x` vs `kinetik@8.x` #known |
| [[P4-landing-kinquest\|P4]] | **three.js + GSAP + lenis** (landing) | Cinematic marketing site | 🟡 three.js drifted to 3 versions #known |
| [[P5-hq-command\|P5]] | **@react-three/fiber + drei** (hq) | 3D ReactorOrb / graph visuals | 🟢 held (hq only) #known |
| [[P5-hq-command\|P5]] | **@xyflow/react + d3 + topojson + recharts** (hq) | Command graph + reports + world map | 🟢 held — hq's charting stack #known |
| [[P5-hq-command\|P5]] | **@modelcontextprotocol/sdk + express + zod + tsx** (mcp) | The Bridge — an MCP seat on Render | 🟢 held; live on Render #known |
| [[P6-lashirabloom\|P6]] | **Kingdom canvas-2D compositor** (copied) | Reuse the engine to ship farm+combat fast | 🔴 **copied, not extracted** → debt D3 #known |
| [[P6-lashirabloom\|P6]] | **@arganta/{combat,audio,character,heroes-engine}** | Extract shared game logic into packages | 🟢 held — the moat (§6) #known |
| [[P6-lashirabloom\|P6]] | **@nivo/\*** (web charts) | Charts inside ArgantaLabs | 🟡 parallel to hq's recharts/d3 #known |

## The evolution stories worth remembering

> [!note] React 18 → 19, on one app only
> Everything is React `18.3.1` — **except `landing` at `19.1.0`** (and Vite 6 alongside it). The newest app pulled the newest majors; the rest didn't follow. Classic drift: the upgrade happened where it was cheapest, never propagated. #known

> [!note] Capacitor 6 vs 8 — two majors, two apps
> `web` shipped native on Capacitor 6; `kinetik` later adopted Capacitor 8. A shared native-plugin change now has to straddle two majors. #known

> [!note] Two charting stacks for one job
> `web` standardized on **@nivo**; `hq` on **recharts + d3 + @xyflow**. Both render dashboards. Neither was consolidated — the same fork-instead-of-standardize pattern the [[reuse-the-spine-dont-rebuild|spine lesson]] warns about. #known

> [!note] The copy that's still a copy
> P6 copied Kingdom's `src/engine/{compositor,data,palettes}.js` into LashiraBloom wholesale to ship fast. It was never extracted into a package — so it's duplicated code feeding the 3× asset dup (debt D2/D3). "Copy now, extract later" is still pending. #known

## What's stable vs what drifted

- **Stable spine (held since P0):** React · Vite · Supabase · zustand · TypeScript. The core bet was right and never needed replacing. #known
- **Drifted (needs alignment):** three.js (3 versions) · Capacitor (6 vs 8) · React (18 vs 19) · Vite (5 vs 6) · supabase-js (2.45 vs 2.110) · charting (nivo vs recharts). #known
- **Superseded:** static-HTML prototypes → React (P0); PWA-first → Capacitor native (P4). #inferred

## Wayforward
1. Alignment is [[L0-toolchain|L0]]'s job — pin a baseline set on the wedge, align others when touched.
2. When git history is available (full clone), replace the `#inferred` phase timings with commit-verified dates.

## Links
[[L0-toolchain]] · [[00-arc|The Journey]] · [[reuse-the-spine-dont-rebuild]] · [[dont-add-a-dependency-before-scale-demands-it]] · [[00-MASTER-KB#4 · Deployment]]
