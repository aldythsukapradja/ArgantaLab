---
type: lesson
status: living
tags: [arganta, lesson]
---

# Reuse the spine, don't rebuild — one engine, many configs; wrap, don't fork

> [!quote] The principle
> The compounding asset is the shared substrate, not any front-end. Every time a surface was built by *reusing* the spine — one identity model, one combat package, one builder shell, one character source — the repo got stronger. Every time something was copied or forked instead of extracted, it became debt.

## Evidence
- **`@arganta/combat` canonical** (§13, 2026-07-07): "Skill effects come from the hero's Kingdom character (single source)." Kingdom, LashiraBloom and HQ all consume it. The master KB calls the `packages/*` layer *the moat* (§6).
- **One identity model** (§13, 2026-06-23): KinetikCircle uses the existing `circles` table, not `kinetik_circles`. `circleId`/`personId`/`appId` locked repo-wide — never `familyId`/`memberId`.
- **One BuilderShell, two builders** (app-builder cluster): the App Builder's bespoke architecture (`AppBuilder.tsx`, `parseSDK.ts`, separate tables) was abandoned mid-build for a config-driven shell shared with the Game Builder (`Kind='game'|'app'`). Far more reuse than the doc "locked."
- **Kingdom engine, copied into LashiraBloom** (P6): `src/engine/{compositor,data,palettes}.js` copied *wholesale* from `apps/kingdom` — the convergence bet (reuse the canvas-2D compositor over a fresh engine) held and let farm+combat ship in days.

## The pattern
Ask "what already exists that I can wrap or configure?" before "what should I build?". A new table, a new component tree, a new engine each fork the surface area you have to keep in sync. One engine + many configs collapses that surface — and the spine accrues value from every front-end mounted on it.

## Watch for
- **Copy-now-extract-later is debt.** The Kingdom→Lashira engine copy shipped fast but is now duplicated code (and 3× duplicated *assets* — debt D2/D3). A copy you never extract is a fork you didn't admit to.
- **The moat with no users is still zero.** A beautiful shared spine doesn't move [[distribution-not-features|the one number]]. Reuse is how you build *efficiently*, not a reason the building matters.
- Forking "just this once" under deadline — it never gets un-forked without a deliberate extraction pass.

## Related
[[database-is-the-only-source-of-truth]] · [[dont-add-a-dependency-before-scale-demands-it]] · [[00-arc]]
