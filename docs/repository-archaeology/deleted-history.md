# Deleted History and Abandoned Paths

This file records product ideas that were removed, renamed, superseded, or left on an unmerged branch. A deletion is not automatically a failure: several deletions are evidence of deliberate simplification.

## Evidence rules

- **FACT** means Git records the file operation, name, or documented design.
- **INFERENCE** means the reason is interpreted from adjacent commits and file changes.
- “Absent” means absent from the current `main` branch, not necessarily erased from every remote branch.

## Deletion accounting

The raw audit used `git log --all --diff-filter=D --name-status` plus rename inspection across both repositories.

- **Kinetik:** zero outright deletions and one `R100` rename.
- **ArgantaLab:** 1,005 unique deleted non-lock pathnames across all audited refs. Of those, 919 are under `apps/lashira`, dominated by art-library relocation, generated/raw asset replacement, and successive game prototypes. The remaining paths include 38 under `apps/hq`, nine under `apps/landing`, five each under `apps/web` and `apps/kinetik`, two under `apps/kingdom`, the root/static and `concept/` removals, a workflow, and generated `gh-pages` assets.

This chapter enumerates every distinct **product idea or UI family** represented by those deletions. It summarizes bulk asset moves as a group instead of treating hundreds of replaced sprites as hundreds of product pivots. Git remains the lossless file-level ledger.

## Kinetik: the product before the product

### The World Cup predictor was overwritten

- **Date:** 2026-06-12
- **Commits:** `fbe65ef` → `5f77dd3`
- **FACT:** The repository began with `index.html` titled “RMO World Cup · World Cup 2026 Forecast Arena.” Two commits later, that file was replaced by the Kinetik family-and-friends shell. The predictor is absent from current `main`.
- **INFERENCE:** The public repository was repurposed rather than created specifically for Kinetik. Git does not say whether the two products were related or whether this was simply a convenient repository.
- **Story value:** The first surviving commit contradicts a clean, linear origin story.

### Ask stopped being a primary tab

- **Date:** 2026-06-12
- **Commit:** `7d17369`
- **Files:** `index.html`
- **FACT:** The navigation changed from `Today / Calendar / Ask / Apps / Me` to `Today / Calendar / Moments / Apps / Me`; Ask moved to a docked orb.
- **INFERENCE:** Conversational assistance became a cross-product control instead of a destination, while Moments won the scarce navigation slot.

### The dedicated Week view was removed

- **Date:** 2026-06-13
- **Commit:** `7b0bf2d`
- **Files:** `index.html`
- **FACT:** The redundant Week view was removed while multi-person calendar filtering and recurring-event deletion were added.
- **INFERENCE:** Calendar complexity was being consolidated around fewer, stronger views.

### Padel was renamed, not rebuilt

- **Date:** 2026-06-14
- **Commit:** `7075a30`
- **Git operation:** `App_PadelAmericano.html` → `App_SportPadel.html`
- **FACT:** Git records a rename.
- **INFERENCE:** The new name widened the app from one competition format to a reusable sport category.

## ArgantaLab: hard resets and replacements

### The static prototype was deleted after the React migration

- **Date:** 2026-06-20
- **Commits:** `6a4e798`, `4c20ac9`
- **Deleted:** root `index.html`, `sw.js`, Strike Zone HTML builds, and the original handoff file.
- **Replacement:** `apps/web/` React application.
- **FACT:** Git shows a 31-file React migration followed by removal of the root prototype assets.
- **INFERENCE:** This was the first architecture reset: the prototype had served its purpose and was intentionally prevented from becoming a second product surface.

### Login was built and then removed for guest-first entry

- **Date:** 2026-06-20
- **Commits:** `0cd980e`, `4055682`
- **Deleted:** `apps/web/src/pages/Login.tsx`
- **Added/reworked:** `AuthWall` and guest-first routing.
- **FACT:** Supabase login was introduced, then the dedicated Login page was deleted shortly afterward.
- **INFERENCE:** Reducing time-to-play temporarily mattered more than making identity the first screen. Later cloud-circle work brought authentication back in a different form.

### Studio became Game Wizard

- **Date:** 2026-06-20
- **Commit:** `02e5452`
- **Deleted:** `apps/web/src/pages/Studio.tsx`
- **Added:** Wizard, game generation, My Games, and generation data modules.
- **FACT:** The generic Studio page was removed in the same commit that introduced the guided Game Wizard.
- **INFERENCE:** “Creation” was narrowed into a child-friendly sequence with a concrete output: a playable game.

### The concept archive was deliberately erased

- **Date:** 2026-06-21
- **Commits:** `7cb10f2`, `4a7a0ec`
- **Deleted:** the `concept/` tree, including standalone prototypes and the generator used to produce several of them.
- **Survived:** the six-world React implementation in `apps/web`.
- **FACT:** The prototypes were committed and then deleted while the integrated product remained.
- **INFERENCE:** The repository stopped treating concept HTML as a parallel source of truth.

### Early HQ screens did not survive the command-center rebuild

- **Dates:** 2026-06-22 to 2026-06-23
- **Representative commits:** `a6f9af9`, `d05343d7`, `41641a89`
- **Deleted or superseded:** early Audience, Pulse, and scaffold-era HQ routes/components.
- **FACT:** Git records successive HQ additions and removals as the parent surface changed shape.
- **INFERENCE:** The team was searching for the correct parent abstraction—analytics dashboard, pulse view, or operating console.

The same deletion history includes early metric cards, cohort/economy/insight components, contracts, mock/seed data, `CommandBar`, `Economy`, `Features`, and placeholder surfaces removed in `d05343d7`; `Audience.tsx` and `Pulse.tsx` were removed in `41641a89`.

### Kinetik’s local scaffold was purged for a Supabase source of truth

- **Date:** 2026-06-23
- **Commit:** `7fb6e6c`
- **Deleted/superseded:** placeholder seeds, snapshots, and local cloud-store patterns in the early Kinetik app.
- **Added:** a clean Kinetik app structure plus Supabase schema and seed files.
- **FACT:** The commit explicitly rebuilds Kinetik around Supabase as the single source of truth.
- **INFERENCE:** This is a more consequential reset than the later name change: data authority, not branding, was the real boundary.

### The first game-builder implementation was thrown away

- **Dates:** 2026-06-23
- **Commits:** `7adeff5`, `456b12e7`
- **Deleted/superseded:** original `AppBuilder`, `Builder`, and `GameBuilder` implementations.
- **Survived:** Circle bridge/runtime concepts and later Forge/Studio creator systems.
- **FACT:** The initial builder files were added and then removed or replaced in later commits.
- **INFERENCE:** The creator-platform ambition survived, but its first UI and contract did not.

The associated `gameWizard.ts` data layer was also deleted on parallel builder lines (`7adeff50`, `a235bd1a`) before the from-scratch builder split in `456b12e7`.

### HQ Moments became Broadcast

- **Date:** 2026-06-26
- **Commit:** `c63d902`
- **Deleted:** HQ `Moments.tsx`
- **Added:** `Broadcast`/Discover-style feed.
- **FACT:** The parent-facing Moments route was removed as Broadcast entered.
- **INFERENCE:** The same media primitive was reframed from a family album into an ecosystem publishing surface.

### Agent OS UI was later removed from HQ

- **Dates:** introduced 2026-06-25, removed later
- **Commits:** `ba413f2`, `7e32365a`
- **Deleted/superseded:** HQ Agents surface and associated UI pieces.
- **Survived elsewhere:** later shared agent/runtime packages and Forge assistant flows.
- **FACT:** The HQ-specific agent interface is absent from current `main`; agent infrastructure later reappears in packages.
- **INFERENCE:** The abstraction moved down the stack—from a visible HQ feature to platform infrastructure.

### Landing-page experiments were repeatedly pared back

- **Dates:** 2026-06-27 onward
- **Representative commits:** `9af806e`, `9a57517f`, `c40d3394`
- **Deleted/superseded:** early 3D landing components, Nexus, Hub, OnePager, and related visual experiments.
- **FACT:** These files appear and disappear in Git while the landing app remains.
- **INFERENCE:** The umbrella story was less stable than the product code it was meant to explain.

The deleted set includes `ArgantaBoxScene`, `ProductCaptures`, `ThreeCanvas`, a prior icon/global stylesheet/portfolio module, `GemsBackground`, Web’s `Nexus.tsx`, and later `Hub.tsx`/`OnePagerDeck.tsx`.

### Music Builder became Legacy; a different Legacy surface was deleted

- **Dates:** 2026-07-12 and 2026-07-16
- **Commits:** `a7dda621`, `a436ee4`
- **Rename/reframe:** Git records `apps/hq/src/surfaces/music/MusicBuilder.tsx` → `apps/hq/src/surfaces/music/Legacy.tsx` in `a7dda621`. The renamed music file still exists on current `main`.
- **Separate deletion:** `a436ee4` deletes `apps/hq/src/surfaces/broadcast/Legacy.tsx` while retiring the legacy Content Builder and reworking Post Studio attribution.
- **FACT:** These are two different `Legacy.tsx` paths and must not be joined into one deletion story.
- **INFERENCE:** “Legacy” was used as a migration label in more than one creator domain, but only the broadcast version was removed in the audited history.

### Temporary preview and reproduction files were cleaned out

- **Representative commits:** `129dba75`, `ef55cc76`, `923ef8c8`
- **Removed:** preview-shell shortcuts, sync reproduction scripts, and `pv3-preview.html`.
- **FACT:** These were short-lived debugging or preview artifacts.
- **INFERENCE:** They are process evidence, not product failures; they show features were tested through disposable harnesses.

Other small, explicit removals include a pacing-audit test after recalibration (`9370765e`), an obsolete GitHub Pages workflow (`768be6c8`), a reactor label-texture implementation (`ac94bb04`), and an older knowledge-tour module (`56ca0df8`). These indicate cleanup or replacement, not abandoned product directions.

### Lashira prototypes and early world files were replaced

- **Representative commits:** `8f1b90ba`, `77cb2c34`, `babbfd37`
- **Deleted/superseded:** early farm/world files, `lashira-5worlds-prototype.html`, `WorldStage`, and older world CSS.
- **Survived:** the current Lashira web application and its farm-art basemap.
- **FACT:** Git records both the prototype deletions and later integrated world implementation.
- **INFERENCE:** Lashira followed the same pattern as ArgantaLab’s first learning worlds: standalone proof, integrated rebuild, prototype cleanup.

The 919 unique deleted Lashira paths also include large raw/generated/screenshot art batches that were moved, deduplicated, or replaced. Their existence proves asset-pipeline churn, but their individual deletion does not prove 919 abandoned ideas.

### Rank and world presentation components were simplified

- **Commits:** `827b69e0`, `babbfd37`
- **Deleted:** Web `RankPanel.tsx`; HQ `WorldStage.tsx` and `world.css`.
- **FACT:** The rank commit explicitly says it simplifies the rank system; the world files disappear during later world/HQ updates.
- **INFERENCE:** These are UI consolidation events. The underlying rank/world ambitions continued in other components.

### Generated deployment artifacts were replaced

- **Evidence:** the `gh-pages` ref deletes hashed CSS/JS bundles during redeploy commits; Kingdom also replaces a built `dist_site` bundle, and an older Kingdom Vercel file is removed.
- **FACT:** These paths are generated or deployment-facing artifacts.
- **INFERENCE:** They are release-mechanics evidence, not product-feature deletions, and therefore are not promoted to documentary pivots.

## Ideas documented but not proven shipped

These items must not be described as released features.

### Smart Manifest / Circle publishing

- **Evidence:** design documents and builder/runtime commits around `7adeff5` describe manifest-driven Circle apps and publishing.
- **FACT:** Runtime and bridge code exists; documentation describes a larger publishing flow.
- **Uncertainty:** Git alone does not prove the complete end-to-end publishing experience was usable by external users.

### Vision-film and narrative concepts

- **Evidence:** repository planning and brand documents.
- **FACT:** Narrative treatments exist as files.
- **Uncertainty:** Their presence does not prove a film was produced or publicly released.

### Vault HQ branch

- **Dates:** July 2026
- **Branch-only commits:** `f2e2abe` through `398689f`
- **FACT:** `origin/claude/digital-brain-twin-os-omes01` contains nine commits not merged into `main`, including a Vault HQ restructuring.
- **Current state:** branch-only and therefore not part of the canonical mainline product.
- **INFERENCE:** This is an experiment or pending line of work, not evidence of a shipped pivot.

### Circle HQ handoff branch

- **Commit:** `bde866bb`
- **Branch:** `origin/claude/knowledge-base-location-enkchy`
- **FACT:** The branch has one commit not merged into `main`, centered on Circle HQ PRD/Jarvis handoff material.
- **Current state:** branch-only.

### Hand-quality Lashira basemap branch

- **Commit:** `91721578`
- **Branch:** `origin/lashira-art-library`
- **FACT:** The branch has one unmerged basemap commit.
- **Current state:** branch-only; do not show it as the current production art without founder confirmation.

## The recurring pattern

**FACT:** Across both repositories, the repeated sequence is prototype → integrated implementation → deletion of the prototype. It occurs with Kinetik’s opening file, ArgantaLab’s static build, six-world concept HTML, the first builder, Lashira prototypes, and several HQ/landing experiments.

**INFERENCE:** The strongest founder story is not “every idea worked.” It is that product intent often survived while its first implementation was discarded.
