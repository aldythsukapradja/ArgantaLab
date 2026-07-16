---
title: Brand Studio Design Spec
product: Circle HQ
type: design-spec
status: approved-pending-founder
version: 2.0
tags: [brand, brand-studio, design, spec, opus]
date: 2026-07-16
owner: Aldyth
strategy_owner: Fable
implementation_owner: Claude Code (Opus)
confidence: high
---
# Brand Studio v3 — "The Flight Through the Universe"

The execution spec for Opus. Supersedes the v1 audit-deck surface (which survives as Operator mode) and the v2 scroll-comp (form rejected, content adopted).

## 0 · The philosophy, battle-tested against the founder's own design

**What went wrong twice.** v1 was a *dashboard* — an engineer's answer. v2 was an *agency scroll-page* — borrowed form (Pentagram/base.uber editorial) that ignored the house language. Both failures share a root: designing *about* the brand instead of *inside* it.

**What the repo's design DNA actually is** (`repo-verified`, from apps/landing + HQ Landing + Reactor):

| Signature | Where it lives | What it means for Brand Studio |
|---|---|---|
| **Camera-flight lanes** — scenes positioned in space, the camera travels; products sit *in* the flight | `apps/landing/src/stage/registry.tsx` ("Each flight is a horizontal lane the camera travels along") | The brand book is a **flight**, not a scroll. Each brand = one lane of six scenes; the constellation = the hub you depart from |
| **Reveal on arrival** — rings/bars animate only when the camera lands (`useIsActive`) | `stage/scenes.tsx` LiveRing/LiveBar | Every scene stages its entrance; nothing is just *there* |
| **Jarvis cockpit chrome** — 7–9px mono micro-labels, `.13–.3em` tracking, cyan eyebrows, instrument panels, status vocabulary (`LIVE SIGNAL / AWAITING SIGNAL / CONNECTION REQUIRED`), ignition sequences | `apps/hq/src/surfaces/landing.css` (.ld-*), Landing.tsx SignalFrame | The HUD frame around the show. Registry status speaks the same vocabulary: `REGISTRY · LIVE` / `SEED` / `MARK · P0` |
| **The demo is real** — the landing deck embeds live apps (AppEmbed); HQ renders real engines (orb, reactor, postEngine) | `stage/scenes.tsx` AppEmbed · postEngine | Act V renders **actual carousels via drawSlide/drawMark live on stage** — never a CSS imitation (v2's faked phone violated this) |
| **Provenance discipline** — measured vs simulated badged everywhere | Architecture v2, CEO offices | Pending marks show dashed + `MARK · P0`; seed vs live data is chipped, never hidden |
| **Kicker + gradient-em typography** — kicker dot + label, display lines with one gradient `<em>` word, chips | `scenes.tssx` Kicker/Grad/Chips | The display type system for scene headlines |

**The v3 thesis:** *"One universe, five worlds" is the brand architecture — so the surface enacts it.* You fly the universe. Each world re-inks the cockpit in its own palette. The brand book performs itself, using the same engines that publish to Instagram. That's the world-class move no agency deck can copy — their PDFs describe; ours **executes**.

## 1 · Battle test of the v2 comp (what survives → what changes)

| v2 element | Verdict | v3 form |
|---|---|---|
| Six-act structure + order (Cover→Belief→World→Voice→Wild→Constellation) | ✅ survives | Acts become **scenes on a flight lane** |
| Real-assets-only rule (real geometry, palette, bios) | ✅ survives | Extended: *rendered* live, not transcribed into CSS |
| Per-brand re-ink of the whole page | ✅ survives (from v1) | Re-ink happens **during the flight** between worlds |
| Honest pending marks (dashed, P0) | ✅ survives | + `MARK · P0` mono chip, cockpit vocabulary |
| Scroll navigation | ❌ rejected | Camera-flight, ←/→ keys, dots; **zero page scroll** |
| Generic eyebrow chrome | ❌ rejected | Jarvis micro-label HUD (7–9px mono, tracked, cyan) |
| CSS-faked phone mockup | ❌ rejected | Live `drawSlide` canvas in a device frame |
| Static page (no motion language) | ❌ rejected | Ignition on mount · flight easing · reveal-on-arrival · slow orbit drift in the hub |
| Markdown-links list for strategy docs | ❌ rejected (founder: "totally unacceptable") | Each scene *embodies* its doc; a quiet mono footnote `SOURCE · F4 VOICE MATRIX` deep-links for the operator |
| "Kids don't need another screen. They need a workshop." | ✅ keep as ArgantaLab's Act II headline | Canonized into F1 (done — see §4) |

## 2 · Content corrections (founder's catches + re-read)

1. **`PLANNED_BRANDS` is stale** — still lists `landing` ("Name TBD") and *misses Circle HQ entirely*. The v1 rail displayed "Landing 0%" — wrong per the locked portfolio. Fix in BS-0.
2. **Display name** — registry says `KinetikCircle`; public name is **"Kinetik Circle"**. Fix `brand.json` name field (agent lane).
3. **Missing bases** — `arganta` and `circlehq` have no brand.json at all. Create minimal bases (marks null → dashed P0 on stage; palettes seeded: Arganta = Night Ink ground + Quest Gold accent `working`; Circle HQ = HQ's own cockpit cyan `#22D3EE` on `#05070C` `repo-verified` from landing.css).
4. **Taglines not in the registry** — F3 wrote them; they must be seeded founder-lane for all four public brands + Circle HQ (migration addendum, `on conflict do nothing`).
5. **siteUrls** — routing.siteUrl only exists for argantalab. Seed www/circle/bloom/hq per F1 domain rules (agent lane).

## 3 · Design tokens (the deck's own system)

- **Ground:** `#05070C` (cockpit ink — darker than any brand bg, so every brand's world reads as *lit* against it).
- **Chrome text:** `ui-monospace` 7–9px, tracking `.14–.3em`, uppercase; cyan `#22D3EE` for instrument eyebrows; `#AAB3C5` muted.
- **Display type:** system stack, weights 700/800, sizes clamp(34→86px), tracking `-.02em`, one gradient `<em>` per headline max (brand's own gradient).
- **Re-ink vars:** `--bs-accent/bg/ink/soft/plate/gradient` set from the active brand doc; 500ms ease on change.
- **Motion:** flight 800ms `cubic-bezier(.22,.9,.3,1)`; arrival reveals stagger 80ms; hub orbit drift 60s linear infinite; ignition ~1.4s once per mount. `prefers-reduced-motion`: flights become 150ms fades, orbit static.
- **Layout:** fixed viewport, `overflow:hidden` at every level. Scenes sized to the viewport; lane travel via `translate3d`.

## 4 · Step-by-step execution (Opus batches)

### BS-0 · Data corrections *(prereq, small)*
`packages/brand/src/index.js`: PLANNED_BRANDS → `[{id:'arganta',name:'Arganta',note:'Masterbrand — the external gateway'},{id:'lashirabloom',…},{id:'circlehq',name:'Circle HQ',note:'Internal founder OS'}]`; remove `landing`. `brands/kinetikcircle/brand.json`: name → `"Kinetik Circle"`, routing.siteUrl → `https://circle.arganta.app`. New minimal `brands/arganta/brand.json` + `brands/circlehq/brand.json` (§2.3 palettes, mark null, siteUrls). New `supabase/migration_brand_registry_seed2.sql`: founder-lane overlays (taglines EN+ID from F3, personas one-liner each) for arganta/kinetikcircle/lashirabloom/circlehq, `on conflict do nothing`. Tests: update brand.test.js expectations (bases count, kinetik display name). **Done when:** rail order = Arganta · ArgantaLab · Kinetik Circle · LashiraBloom · Circle HQ, no Landing anywhere.

### BS-1 · Flight engine
`apps/hq/src/surfaces/brand/flight.ts(x)` — a lane container: scenes absolutely positioned at `i * viewportW` on a horizontal lane; camera = `translate3d` with the flight easing; `useSceneActive(i)` hook (arrival detection) mirroring landing's `useIsActive`. Keyboard ←/→ + dot rail + swipe. Brand switch = vertical lane change (worlds stack vertically; constellation hub = lane 0). **Done when:** keyboard flies scene-to-scene at 60fps, zero scroll, reduced-motion fades.

### BS-2 · Cockpit chrome + ignition
HUD bar: `BRAND SYSTEM` mono label + brand breadcrumb + registry chip (`REGISTRY · LIVE|SEED`) + lane legend (agent/founder) + scene dots — all in .ld-* vocabulary (new .bs3-* classes, same grammar). Ignition on mount: ground fades in, mark strokes draw (SVG dash animation via markToSvg output), label `BRAND SYSTEM ONLINE` letter-spaced cyan, then auto-fly to the hub. **Done when:** mount sequence plays once, skippable by any key.

### BS-3 · Scenes I–IV (Cover · Belief · World · Voice)
Data via `resolveBrand` + `voiceBlock`. I: mark huge (drawMark canvas, 480px), name with gradient-em, taglines EN+ID, `PART OF ARGANTA` mono. II: Kicker + display headline (per-brand headline field, F1; ArgantaLab = "Kids don't need another screen. They need a *workshop*.") + boilerplate paragraph + promise lockup. III: palette as full-bleed color field bands (named, hex mono chips) + artDirection as the statement block. IV: persona theatre (name in display quotes, adjectives tracked line, speaks/never), pillar cards in pillar accents. Every scene: mono footnote `SOURCE · F1|F3|F4 …` → deep-links vault note. Missing data renders the honest cockpit way: `AWAITING VOICE — founder lane` (never invented copy). **Done when:** all four scenes render for all 5 brands incl. gap states.

### BS-4 · Scene V "In the Wild" — the live engines
Left: device frame around a **canvas running the real pipeline** — `makeSlide('hook'|'cta', {handle})` → `drawSlide` with `RenderEnv.brand`, auto-cycling 2 slides (3.5s), pager real. Right: IG profile composed from `presence.instagram` (avatar = drawMark 'profile' variant, real bio/link/highlights). Below: OG card via `markToSvg` composition. Caption line generated from `content.captionFormula` structure + voice CTAs, labeled `FORMULA · F5`. Footnote: `RENDERED LIVE BY POSTENGINE — THE SAME CODE THAT PUBLISHES`. **Done when:** changing a palette hex in brand.json visibly changes the on-stage post after HMR — proof it's live.

### BS-5 · Scene 0 "The Constellation" (hub)
All five marks orbiting a center lockup (`ARGANTA · GROW TOGETHER`): drawMark canvases on a slow-drift orbit (60s), pending marks dashed + `MARK · P0` chip, each node = name + role micro-label + tagline. Click a world → camera flies down into its lane (Cover). This is also the switchboard — no separate brand rail. **Done when:** hub → world → back navigation feels like one continuous space.

### BS-6 · Operator mode
Keystroke `O` (+ HUD toggle) overlays the v1 audit deck — readiness rings, platform matrix, production queue, doc list — restyled onto the cockpit ground as a translucent instrument layer. The audit is the *appendix*, one keystroke away, never the cover. **Done when:** O toggles in <100ms with state preserved; Esc returns to the show.

### BS-7 · Verify + ship
Typecheck, production build, in-browser battle test against this spec (scene-by-scene screenshot set incl. a pending-mark brand and reduced-motion), zero-scroll assertion (`scrollHeight === clientHeight` at .bs3 root), then commit and update [[Brand OS Build Plan]] + memory. **Done when:** screenshots reviewed by founder.

## 5 · Out of scope (deliberately)
Editing in the showcase (Operator mode edits come with BF-4b's drawer + `brand_update`); audio-reactive stings (BF-10 lands the marks first); ChatGPT P0 assets (the stage shows honest P0 placeholders until they arrive — that honesty *is* on-brand).

Related: [[Brand OS]] · [[Brand Handoff Battle Test]] · [[F1 — Brand Foundation & Architecture]] · [[ChatGPT Visual Production Handoff]]
