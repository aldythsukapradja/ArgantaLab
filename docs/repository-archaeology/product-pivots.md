# Product pivots

Each pivot separates direct evidence from interpretation. “Still exists” refers to the audited repository tips.

## Kinetik pivots

### 1. World Cup predictor → private circle product

**FACT:** [`fbe65ef`](https://github.com/aldythsukapradja/kinetik/commit/fbe65ef912289f65b13bd8c408f0ef84cce18e53) adds an RMO World Cup predictor in `index.html`. [`5f77dd3`](https://github.com/aldythsukapradja/kinetik/commit/5f77dd355ddb8304e63b069411205b37c936da64) replaces most of it with Kinetik and adds `Code.gs`, modular apps, PWA files, build docs, and icons.

**INFERENCE:** This is either a deliberate repository repurpose or an upload mistake. Git alone cannot choose between them.

**Still exists:** Kinetik; RMO does not.

### 2. Calendar as the operating core

**FACT:** `5f77dd3:index.html` explicitly says “Calendar is the source of truth” and ships Board/Week. `d5df4c2` adds Month and inline add; `7b0bf2d` removes redundant Week, adds multi-person filters, and clarifies routine deletion.

**Affected files:** `index.html`, `Code.gs` collections `Calendar_Routines`, `Calendar_Events`, `Calendar_Exceptions`.

**Still exists:** Yes in standalone Kinetik and later `apps/kinetik/src/pages/Calendar.tsx`.

### 3. Assistant tab → assistant orb

**FACT:** `5f77dd3` has Ask as main tab 3. [`7d17369`](https://github.com/aldythsukapradja/kinetik/commit/7d1736904f4509b5c826c215fb8276fd7fcd8bf8) makes Moments tab 3 and moves Ask to a docked orb/full-screen conversation.

**INFERENCE:** The assistant becomes ambient infrastructure rather than a destination.

**Still exists:** Yes conceptually; later ArgantaLab adds Agent OS/Circle AI/Arganta Core.

### 4. Planner → social memory

**FACT:** `7d17369` adds visual Moments preview; [`cf21f97`](https://github.com/aldythsukapradja/kinetik/commit/cf21f9709a2b7a2617b33e10841ca6b18ad7b23d) adds real media feed, stories, creation, and detail states; `173aada` adds carousels/reactions.

**Still exists:** Yes; rebuilt with Supabase in ArgantaLab `e31f886`.

### 5. Utility shell → app ecosystem

**FACT:** `5f77dd3` adds Padel/Event Poll and iframe app host. `7d17369` adds Kinetik Store. `7dcaf5d` adds manifest parsing. `2e646bf` adds three games. `5ed855f` adds 24 apps and `apps.json`.

**Still exists:** The standalone catalog exists; later ArgantaLab recreates native React mini-apps and a game/app builder ecosystem.

### 6. Local demo → Google Sheets backend

**FACT:** `5f77dd3` defines DataAPI adapters; `6f11cb1` makes a live Apps Script URL/config and collection mapping; `Code.gs` implements CRUD over Sheets.

**INFERENCE:** This is a prototype production step, not proof of safe production auth.

**Still exists:** Yes in standalone repo; Supabase replaces this path in ArgantaLab.

### 7. Generic Kinetik → KinetikCircle

**FACT:** The standalone repository never uses the new product name in its commit history. ArgantaLab commit [`e6713c9`](https://github.com/aldythsukapradja/ArgantaLab/commit/e6713c982c6217a75deb8320176396a14b8e7bf4) changes `apps/kinetik/index.html`, TopBar, Me, and styles to KinetikCircle.

**Still exists:** Yes.

### 8. Family utility → “family operating system”

**FACT:** The features supporting this phrase accumulate across Calendar, Today, Moments, Apps, people/circles, parent analytics, wallet, routines, and mini-apps. A versioned repository file added on 2026-07-11, `knowledge-base/founder/kinetikcircle.md`, explicitly calls KinetikCircle “the family operating system.”

**INFERENCE:** The phrase is a later framing of accumulated capabilities. The public standalone Git history does not show when the phrase was first conceived.

## ArgantaLab pivots

### 1. Static game collection → React learning platform

**FACT:** `34385b3` adds standalone HTML games. `6a4e798` creates `apps/web`; `4c20ac9` deletes the old root HTML/game files.

**Still exists:** React platform yes; original HTML shell no.

### 2. Full login wall → guest-first auth

**FACT:** `0cd980e` adds `Login.tsx`; `4055682` deletes it and adds `AuthWall.tsx` around gated actions.

**Still exists:** Guest-capable flow persists in evolved form.

### 3. Three technical learn tabs → six kid learning worlds

**FACT:** `6a4e798` has Web Quest, Data Lab, AI Forge. `8765ff9` makes three cinematic world scenes. [`7cb10f2`](https://github.com/aldythsukapradja/ArgantaLab/commit/7cb10f2fa45d94b890a4c588925aa6d40c71e919) adds six kid-facing worlds: NumberDash, WordQuest, WonderLab, LogicLand, WorldTrail, LifeQuest, plus `learn.ts`, WorldHub, and prototype HTML generators.

**Still exists:** Yes; concept HTML copies were deleted in `4a7a0ec`.

### 4. Learning consumption → Game Wizard creation

**FACT:** `02e5452` deletes the generic `Studio.tsx` and adds `Wizard.tsx`, generation data, game HTML generation, and saved-game storage.

**Still exists:** Yes; later rebuilt as Studio v2 and Forge.

### 5. No-code Wizard → two-level creator platform

**FACT:** `6a6973a` adds Builder Lab and device preview. `70fc13f` later adds a reusable generated-game engine with multiple genres. `14e529d` converges app/game building into chat-driven Forge.

**INFERENCE:** Creation shifts from a feature inside the learning app to a platform capability.

### 6. Private creations → Discover + My GameStore

**FACT:** `bc27845` adds `Discover.tsx`, `MyGameStore.tsx`, public play pages, game cloud state, Avatar/Fame, and schema changes.

**Still exists:** Yes.

### 7. App shell → Buddy-led daily journey

**FACT:** `c4bf1fc` adds Buddy, PlayHome, and streaks; `a8b463e` adds costumes, Quests, and badge cinematics; `99ca81f` adds Journey UI.

**Still exists:** Yes.

### 8. Child-only product → Parent Dashboard/Analytics

**FACT:** `99ca81f` adds Parent. `4333628` adds a parent gate. `1264f61` adds per-kid charts/rewards/content depth. `fdccc1b` reframes the surface as Family Pulse.

**Still exists:** Yes, evolved.

### 9. Local profiles → cloud kid identity and circles

**FACT:** `0dfc499` adds local per-player sessions; `5ba1158` adds cloud auth, kid signup, circles v2, and migrations; `e319511` repairs kid PIN/guardian sync; `952676e` establishes the canonical identity/family/wallet schema.

**Still exists:** Yes; local player switcher remains but is no longer the only identity source.

### 10. UI Diamonds → server-authoritative shared currency

**FACT:** `5defdd0` introduces Diamonds in profile/store state. `952676e` defines the wallet spine. `8c6f9ba` adds `wallet.ts` and server-authoritative operations. Later migrations and apps reuse the same economy.

**Still exists:** Yes.

### 11. Solo learning → shared world/co-op

**FACT:** `e31f886`, `d1b92b2`, and `58f338e` add openworld components, mounts, co-op UI/engine, and migrations while Kinetik surfaces child progress.

**INFERENCE:** Learning effort is becoming a resource visible in a shared family world.

**Still exists:** Yes, evolved into KinWorld/KinQuest/Lashira systems.

### 12. Product analytics → company operating cockpit

**FACT:** `a6f9af9` adds early HQ analytics. July 1–3 commits add Command graph, six offices, reports, RCA, Treasury, Actuary, Pixel Vault, and The Bridge. `1b82eba` and follow-ups add Arganta Core agent contracts/runtime.

**Still exists:** Yes; early Audience/Pulse/Agents files were rebuilt or deleted.

### 13. Single app → Arganta ecosystem

**FACT:** `5ba1158` introduces web/Kinetik/HQ together. `9af806e` creates the Arganta landing. Shared migrations and packages follow. `9535217` and `7624e11` create a common Brand OS and Brand Studio for multiple products.

**INFERENCE:** The product stops being “ArgantaLab with adjacent experiments” and becomes a multi-product Arganta system.

### 14. Game creator → general artifact/media creator

**FACT:** `2424798` adds Media Center and `packages/media-core`; `7902a34` adds public artifact runtime; `14e529d` adds app/game Forge; later commits add brand, influencer, audio, pixel, and video studios.

**Still exists:** Yes.

### 15. Generated assets in app folders → governed creative fabric

**FACT:** `5d787e6` creates Pixel Vault. `4ce897b` requires generated pixel art to enter an ingest queue. `0501e19` and `4d1980e` add sovereign audio/video adapters and persistence tooling.

**INFERENCE:** Asset generation becomes infrastructure with provenance/review rather than an ad hoc output.

## Pivots documented but not fully implemented

- App Builder smart-manifest auto-inference is specified in `CONCEPT_APP_BUILDER.md` and related docs, but no matching production inference path was found.
- Circle-scoped publishing exists in builder plumbing, but the audited KinetikCircle code does not consume `hq_app` as a runtime app catalog.
- The standalone Kinetik README describes a future React/TypeScript + Firebase migration; the actual later path is React/TypeScript + Supabase inside ArgantaLab.
- A standalone cinematic vision-film concept exists, but the repository ships cinematic landing/investor decks instead of the proposed `/film` route.
