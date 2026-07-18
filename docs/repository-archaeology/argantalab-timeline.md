# ArgantaLab timeline

Repository: `aldythsukapradja/ArgantaLab`. Evidence span: 2026-06-19 to 2026-07-18. There are 669 commits reachable from `main` and 685 unique commits across all audited refs.

Each commit link is the complete changed-file record. The “key files” column lists the product-bearing paths rather than package locks or generated build output.

## Phase A — standalone games become a cloud learning platform

| Date | Commit and message | Key files changed | Feature and why it mattered | Current? |
|---|---|---|---|---|
| 2026-06-19 | [`34385b3`](https://github.com/aldythsukapradja/ArgantaLab/commit/34385b3a003fd6f0c8359c2218cb72d674dac542) — `initial build` | `index.html`, three `AppGame_Strike_Zone_*` HTML games, `sw.js`, handoff doc | Static HTML game collection and service-worker shell; establishes the starting product form | No; root HTML and games deleted in `4c20ac9` |
| 2026-06-20 | [`6a4e798`](https://github.com/aldythsukapradja/ArgantaLab/commit/6a4e79863992cec0d20103e0611bc89ab578b99a) — React migration | `apps/web/src/App.tsx`, pages, layout, data/store, Vite config, workflow; 31 files | Creates the React/Vite application and ports the monolith into shared state and pages | Yes, evolved |
| 2026-06-20 | [`4c20ac9`](https://github.com/aldythsukapradja/ArgantaLab/commit/4c20ac90c3f4f5eedf2bd67b5239cf95a39be6c7) — `move to react` | Deletes root `index.html`, `sw.js`, four `AppGame_*` files, handoff | Explicitly removes the old static product after migration | No; deletion persists |
| 2026-06-20 | [`0cd980e`](https://github.com/aldythsukapradja/ArgantaLab/commit/0cd980ef9178e2ae375f1a2833464715124d3710) — Supabase auth + Vercel | `apps/web/src/lib/supabase.ts`, `Login.tsx`, `.env.example`, `vercel.json` | Adds cloud identity and a deploy target | Yes; login page itself later deleted |
| 2026-06-20 | [`4055682`](https://github.com/aldythsukapradja/ArgantaLab/commit/4055682a33fafa504873e243d8df6d4e068fd5dd) — guest-first auth | `AuthWall.tsx`; deletes `Login.tsx`; updates `App.tsx`, Learn, store | Moves the gate from app entry to gated actions | Yes; pattern evolved |
| 2026-06-20 | [`f2c00fd`](https://github.com/aldythsukapradja/ArgantaLab/commit/f2c00fd24fa7dec17f43e4f4dcf6878ed0be80b7) — Web Quest world | cinematic city/player/map, data, Learn | Adds eight lessons and a 3D world-map learning experience | Yes |
| 2026-06-20 | [`8765ff9`](https://github.com/aldythsukapradja/ArgantaLab/commit/8765ff9ec98c88427949baa0d947c0ee430405d7) — Space + Neural + Prompt Forge | cinematic Space/Neural, `PromptForge.tsx`, `worlds.ts`, prompt data | Expands learning into Web/Space/Neural cinematic worlds and teaches prompting | Yes, alongside later six-world system |
| 2026-06-20 | [`5defdd0`](https://github.com/aldythsukapradja/ArgantaLab/commit/5defdd018014cfa3bab2a2a399999801170f8656) — cloud progress + Diamonds | `profile.ts`, store/App, `supabase/schema.sql` | Adds profiles, cloud progress, editable learner name, and virtual currency | Yes, superseded by a stronger wallet spine |
| 2026-06-20 | [`02e5452`](https://github.com/aldythsukapradja/ArgantaLab/commit/02e54528b5723372d7a87416c6fc62143c64a751) — Game Wizard | `Wizard.tsx`, `wizard.ts`, `gameGen.ts`, `myGames.ts`; deletes `Studio.tsx` | Kids can generate real playable HTML games without code | Yes, evolved into Studio v2/Forge |
| 2026-06-20 | [`6a6973a`](https://github.com/aldythsukapradja/ArgantaLab/commit/6a6973a5359a5df5a2893fbe991dff689d47b39e) — Builder Lab | `BuilderLab.tsx`, `DeviceFrame.tsx`, `promptBuilder.ts` | Adds a pro-code creation path and device preview | Yes |
| 2026-06-20 | [`5defdd0`](https://github.com/aldythsukapradja/ArgantaLab/commit/5defdd018014cfa3bab2a2a399999801170f8656) and [`4bb0a25`](https://github.com/aldythsukapradja/ArgantaLab/commit/4bb0a2512ec8bfa817c21529a2fec6451f865680) | profile/store/schema, cloud game sync paths | Cloud state grows from progress to unlocks and saved games | Yes |
| 2026-06-20 | [`bc27845`](https://github.com/aldythsukapradja/ArgantaLab/commit/bc278453c851f969f94c12d3ce0bd132628b7f2a) — Ship tab | `Discover.tsx`, `MyGameStore.tsx`, `PlayPage.tsx`, `Avatar.tsx`, `Fame.tsx`, games cloud/schema | Creation gains discovery, personal storefront, and public play pages | Yes |
| 2026-06-21 | [`7cb10f2`](https://github.com/aldythsukapradja/ArgantaLab/commit/7cb10f2fa45d94b890a4c588925aa6d40c71e919) — six learning worlds | `learn.ts`, `WorldHub.tsx`, `World.tsx`, `LearnHub.tsx`, six `concept/App_*` prototypes, schema | Introduces NumberDash, WordQuest, WonderLab, LogicLand, WorldTrail, and LifeQuest as the six-world learning system | Core six-world system remains; concept prototypes deleted next commit |
| 2026-06-21 | [`c4bf1fc`](https://github.com/aldythsukapradja/ArgantaLab/commit/c4bf1fcb7f5ee4564482ee0d2854c9c4f7034dd7) — Buddy + PlayHome + streak | `Buddy.tsx`, `PlayHome.tsx`, `streak.ts` | Gives the learner a character, daily home, and retention loop | Yes |
| 2026-06-21 | [`a8b463e`](https://github.com/aldythsukapradja/ArgantaLab/commit/a8b463e3bbec30fe5d0b2a593ae419c917ee1e3c) — learn sync, costumes, Quests | Buddy, badge/cinematic, `learnCloud.ts`, `quests.ts`, schema | Joins learning progress, cosmetics, and quest rewards | Yes |
| 2026-06-21 | [`99ca81f`](https://github.com/aldythsukapradja/ArgantaLab/commit/99ca81f571b84e7b685e1b7b311ffa7739938d3d) — Journey, Quests, Parent | `Journey.tsx`, `Quests.tsx`, `Parent.tsx` | Adds structured progression and a guardian-facing surface | Yes |
| 2026-06-22 | [`4256851`](https://github.com/aldythsukapradja/ArgantaLab/commit/42568514d6c6a1e8b6723302d7c53c3c288778ec) — outfits + pitch | cosmetics, circles, pitch data/lib/UI; 23 files | Extends creation/economy into identity customization and presentation | Yes |
| 2026-06-22 | [`0dfc499`](https://github.com/aldythsukapradja/ArgantaLab/commit/0dfc4994682e7e8945ace0a0c03985a421f64fbe) — player switcher | `PlayerSwitcher.tsx`, `player.ts`, store/profile | Supports multiple children on one device | Yes, later subordinated to cloud identity |
| 2026-06-22 | [`4333628`](https://github.com/aldythsukapradja/ArgantaLab/commit/4333628708af3c817f48117f160e0e34eb228b05) — parent gate | `parentGate.ts`, Parent/Profile/switcher | Separates guardian actions from child sessions | Yes |
| 2026-06-22 | [`5ba1158`](https://github.com/aldythsukapradja/ArgantaLab/commit/5ba11587073994ed2a5fc73f059a853176c1af8e) — cloud auth, kids, circles v2 | 78 files across `apps/web`, new `apps/kinetik`, new `apps/hq`, migrations | Converts local player/circle concepts into a cloud identity/circle platform and seeds Kinetik/HQ apps | Yes; foundational |
| 2026-06-22 | [`a6f9af9`](https://github.com/aldythsukapradja/ArgantaLab/commit/a6f9af986d262b9097547cdf6dbb08aeb10f3fa5) — HQ analytics | HQ cohort/economy/verdict components and surfaces | Adds operator views for audience, economy, growth, and insight rules | Partly; early surfaces later rebuilt/deleted |

## Phase B — the shared spine, KinetikCircle, and family/social systems

| Date | Commit and message | Key files changed | Feature and why it mattered | Current? |
|---|---|---|---|---|
| 2026-06-23 | [`7fb6e6c`](https://github.com/aldythsukapradja/ArgantaLab/commit/7fb6e6ce15b75e4548e03a71295497739e872a0a) — Kinetik clean rebuild | `apps/kinetik` data/repo/store/pages; `supabase/kinetik/01_schema.sql`, `02_seed.sql`; deletes snapshots/local cloud store | Makes Supabase the only Kinetik source of truth and removes placeholder seed architecture | Yes |
| 2026-06-23 | [`e6713c9`](https://github.com/aldythsukapradja/ArgantaLab/commit/e6713c982c6217a75deb8320176396a14b8e7bf4) — rebrand | Kinetik index, TopBar, Me, styles | Renames Kinetik to KinetikCircle and adds Gmail avatar/theme settings | Yes |
| 2026-06-23 | [`81a5ca9`](https://github.com/aldythsukapradja/ArgantaLab/commit/81a5ca99b97b78df929b2d0745d8d447aed5a3ea) — Board/Month + Quick Add | Calendar, calendar lib, UI store/styles | Makes Calendar a more complete household planning surface | Yes |
| 2026-06-23 | [`2266502`](https://github.com/aldythsukapradja/ArgantaLab/commit/226650232713279a67d1409e929d54684c6a4b87) — login + kid rings | Kinetik Login, App, Me, styles | Adds real sign-in and visible child progress inside KinetikCircle | Yes |
| 2026-06-23 | [`7adeff5`](https://github.com/aldythsukapradja/ArgantaLab/commit/7adeff508b6714ac954f08d55730db9699c748e8) — Circle Game SDK/App Builder | `circleBridge.ts`, HQ App/Game builders, web play/discover/store | Introduces the cross-app host bridge and builder schema | SDK bridge remains; original HQ builder files were later replaced |
| 2026-06-23 | [`1264f61`](https://github.com/aldythsukapradja/ArgantaLab/commit/1264f61e49d843220dec67b17b3bc7bd4655f449) — Grown-ups analytics | Parent charts/dashboard, content packs, analytics migration | Parent Dashboard becomes per-kid analytics with rewards and deeper content | Yes, evolved into Family Pulse |
| 2026-06-23 | [`e319511`](https://github.com/aldythsukapradja/ArgantaLab/commit/e319511225a662b8d0bc22e9c0f5a82681dc1987) — kid PIN + 318 items | content packs 5/6, cloud auth, auth migration, seed | Repairs the real child-auth path and substantially deepens curriculum | Yes |
| 2026-06-23 | [`952676e`](https://github.com/aldythsukapradja/ArgantaLab/commit/952676e3e99b0a4022e09109ee2873a27d5d8bbc) — canonical spine | `supabase/migration_spine.sql` | Establishes canonical identity, family, and wallet schema | Yes; foundational |
| 2026-06-23 | [`8c6f9ba`](https://github.com/aldythsukapradja/ArgantaLab/commit/8c6f9ba38dc0c948a0dd83682e46122e3e47447d) — server wallet | `wallet.ts`, circle bridge, Profile/store | Makes Diamond balance server-authoritative | Yes |
| 2026-06-23 | [`fdccc1b`](https://github.com/aldythsukapradja/ArgantaLab/commit/fdccc1bf5b9164282331c3fdb3564b241ad64c79) — Family Pulse | Parent/Profile/index | Renames the parent/social activity view to Family Pulse and adds friends/social rings | Yes, now a separate page |
| 2026-06-25 | [`e31f886`](https://github.com/aldythsukapradja/ArgantaLab/commit/e31f8868b8b2ce7c5f36cf8fda6bccfb5e79b262) — Moments + openworld | Kinetik Moments repo/page; moments migrations; web openworld modules | Brings social memories to KinetikCircle while ArgantaLab expands into world play | Yes |
| 2026-06-25 | [`d1b92b2`](https://github.com/aldythsukapradja/ArgantaLab/commit/d1b92b2a675160edf7e2fef04db0a703fc483a89) — kid rings, mounts, co-op | Kinetik Me/repo; web openworld/combat | Connects learner progression to shared world play | Yes, evolved |
| 2026-06-25 | [`58f338e`](https://github.com/aldythsukapradja/ArgantaLab/commit/58f338e45c24753e71d2db28a179c420f7f9103c) — calendar overhaul | Kinetik Calendar/repo/store; co-op/mount migrations | Adds event deletion and deepens both household planning and circle play | Yes |
| 2026-06-25 | [`ba413f2`](https://github.com/aldythsukapradja/ArgantaLab/commit/ba413f2b569db0f7a7b0c08e4fc3d53d95826736) — Agent OS | HQ agents/orb/surface; Kinetik Today | Introduces agent orchestration UI and connects it to Kinetik’s daily surface | Partly; original Agents surface later deleted/rebuilt |
| 2026-06-26 | [`c63d902`](https://github.com/aldythsukapradja/ArgantaLab/commit/c63d9025569e900a57a03b4c4a8015452eee7671) — Broadcast/Discover | HQ Broadcast engine/surface, Kinetik broadcast repo/Moments, migration | Turns Moments into a content distribution feed | Yes; HQ `Moments.tsx` was replaced by Broadcast |
| 2026-06-26 | [`26938bc`](https://github.com/aldythsukapradja/ArgantaLab/commit/26938bc74d0fc75d30fb664b6e14fdfa04fae9f8) — Kinetik mini-apps | AppShell, Kitchen, Padel, Travel, Vault, registry/repo/styles | Recreates the modular-app promise as native React in-app products | Yes |

## Phase C — umbrella, native apps, creator engine, and shared packages

| Date | Commit and message | Key files changed | Feature and why it mattered | Current? |
|---|---|---|---|---|
| 2026-06-27 | [`9af806e`](https://github.com/aldythsukapradja/ArgantaLab/commit/9af806e92fd5e9ec8a8e11664e14ddedc1311582) — Arganta landing | new `apps/landing` | Creates the Arganta umbrella/front door | Yes, heavily rebuilt |
| 2026-06-27 | [`40c1472`](https://github.com/aldythsukapradja/ArgantaLab/commit/40c1472a8b0000aee95096bfc1accbf8bfb41d97) — Capacitor | 164 Android/iOS/native wrapper files for web and Kinetik | Wraps both React products for native distribution without a separate native product | Yes |
| 2026-07-01 | [`0579386`](https://github.com/aldythsukapradja/ArgantaLab/commit/05793862673bdfd628434b1795f2731425f82b4c) — KinQuest | KinQuest components/data/lib/style + sprite sheet | Adds a flagship RPG that teaches through progression/battle | Yes |
| 2026-07-02 | [`4b3f914`](https://github.com/aldythsukapradja/ArgantaLab/commit/4b3f91435c6bc45cee56292955d5d6a831e2a457) — The Bridge | new `apps/mcp` | Gives an LLM a read-only, tool-based view into Circle HQ | Yes |
| 2026-07-03 | [`70fc13f`](https://github.com/aldythsukapradja/ArgantaLab/commit/70fc13fc85116d1dfe8d342798dc7b475f1430f3) — Arganta Studio v2 | `apps/web/src/engine/*`, 15 genre modules, Studio data/build scripts | Rebuilds the Game Wizard as a reusable generated-game engine | Yes |
| 2026-07-03 | [`5d787e6`](https://github.com/aldythsukapradja/ArgantaLab/commit/5d787e6638267209584641dcd99cec188bb89b81) — Pixel Vault | HQ pixel data/surfaces, migration/docs | Treats art as a catalogued, licensed, queryable production asset | Yes |
| 2026-07-07 | [`c72af75`](https://github.com/aldythsukapradja/ArgantaLab/commit/c72af75d355445c49e6999bfeaa6712fe8f35ca4) — shared combat | new `packages/combat`, Kingdom/Lashira imports | Makes combat logic a single package used by multiple games | Yes; expanded |
| 2026-07-08 | [`f2e2abe`](https://github.com/aldythsukapradja/ArgantaLab/commit/f2e2abe3c56d635a8a4ed0a02b4301692c397635) — knowledge vault | 32 moves/additions into `vault-hq` | Formalizes the repository’s product and decision memory | Branch-only form later superseded by `knowledge-base` on main |
| 2026-07-11 | [`95132b9`](https://github.com/aldythsukapradja/ArgantaLab/commit/95132b9419fd645dacc1ab834bdceeb986493872) — Circle AI runtime | `packages/ai`, HQ LLM/runtime, Video Director, agent tools | Moves assistants from UI placeholders toward a shared LLM runtime | Yes |

## Phase D — Arganta operating system, creator fabric, and brand system

| Date | Commit and message | Key files changed | Feature and why it mattered | Current? |
|---|---|---|---|---|
| 2026-07-14 | [`2424798`](https://github.com/aldythsukapradja/ArgantaLab/commit/242479845b35cd4f194dde9501e6ef8364e4e4ca) — Media Center | HQ Media Center/StudioShell, `packages/media-core`, docs | Unifies staged image/audio/video generation under one maturity model | Yes |
| 2026-07-15 | [`1b82eba`](https://github.com/aldythsukapradja/ArgantaLab/commit/1b82eba729c5af89f61dbfcf80c545f93d7a0bec) — Arganta Core C1 | new `packages/agent`, ADRs/concepts, HQ alias | Establishes bounded agent-loop, autonomy, delegation, tool, and thread contracts | Yes |
| 2026-07-15 | [`7902a34`](https://github.com/aldythsukapradja/ArgantaLab/commit/7902a34d0f9d0cd7dd9560b3d977d7abef3631ec) — public artifact runtime | publication migration, Cloudflare worker, builder/core UI | Gives generated single-file apps a public serving path | Yes |
| 2026-07-16 | [`a436ee4`](https://github.com/aldythsukapradja/ArgantaLab/commit/a436ee45208cf06439bd8026c5295cc09fad6aa5) — retire legacy Content Builder | deletes `broadcast/Legacy.tsx`; Post Studio + Kinetik brand migration | Removes a duplicate creator surface and attributes posts to the Kinetik Circle brand | Yes |
| 2026-07-16 | [`9535217`](https://github.com/aldythsukapradja/ArgantaLab/commit/953521725253360b7ec8b086da7e5e14b5bf2a9f) — Brand OS | `packages/brand`, ArgantaLab brand JSON/marks/prompts/reference images | Turns branding into a reusable, validated registry | Yes |
| 2026-07-16 | [`14e529d`](https://github.com/aldythsukapradja/ArgantaLab/commit/14e529d745e71200393ac84ea0b015e667099fbc) — Forge | HQ Forge, builder core, artifact kind migration, Core tools | Converges app/game creation into a chat-driven builder | Yes |
| 2026-07-16 | [`7624e11`](https://github.com/aldythsukapradja/ArgantaLab/commit/7624e1108d4ae3e17abbe2da41131224ebad694b) — Brand Studio | HQ Brand Studio/scenes; brand entries for umbrella/products | Makes the product family visible as one brand universe | Yes |
| 2026-07-17 | [`88c795b`](https://github.com/aldythsukapradja/ArgantaLab/commit/88c795b05f280e11de84d5ec9bf4188ecece2049) — AI Influencer Studio | HQ influencer surface/data/spec | Extends the creator platform into persistent virtual creators | Yes |
| 2026-07-17 | [`4ce897b`](https://github.com/aldythsukapradja/ArgantaLab/commit/4ce897bf503559290103d5206c9927e609fd16cd) — Pixel ingest contract | cloud ingest, migration, media tools | Ensures generated pixel art enters a reviewable vault | Yes |
| 2026-07-17 | [`0501e19`](https://github.com/aldythsukapradja/ArgantaLab/commit/0501e196f4ea1e3fe53f1ea0567b4cd616350d87) — sovereign audio | Audio Studio, media adapter, audio migrations/tools | Makes audio generation part of the same production fabric | Yes |
| 2026-07-18 | [`4d1980e`](https://github.com/aldythsukapradja/ArgantaLab/commit/4d1980e885a26fe2c01dbe4b4bbb347c82cd91c6) — sovereign video | video adapter/registry/media tools | Adds locally operated video generation to the fabric | Yes |

## Branches, tags, releases

- `main` is the product line; `gh-pages` contains five deployment commits from 2026-06-20 and then stops.
- Most named Claude branches are fully reachable from `main`.
- Three audited refs contain commits not reachable from current `main`: `claude/digital-brain-twin-os-omes01` (nine commits), `claude/knowledge-base-location-enkchy` (one commit), and `lashira-art-library` (one basemap commit). They are documented as branch-only evidence, not shipped-main history.
- No Git tags exist. The public GitHub API also reports zero releases on the evidence-cut date.

## README, environment-template, and deployment evolution

- `0cd980e` adds the first `apps/web/.env.example` and Vercel configuration alongside Supabase auth. Templates later appear for HQ, Kinetik, Kingdom, the Arganta Bridge, and media-generation tooling. Their variable names prove integration requirements; they do not prove credentials were configured or services were live.
- Kinetik’s rebuild (`7fb6e6c`) adds app-specific README material; Vercel SPA routing follows in `9ccb4a9`.
- The Bridge commit (`4b3f914`) adds its own README; `494fc2d` adds deployment/mobile-connection guidance.
- `869a409` creates `docs/README.md` as a repository-wide knowledge index. `3cbcdad` adds the extraction-dated knowledge-base baseline; later July 11 commits make it self-contained, method-driven, dual-rendered, and CI-enforced.
- Current first-party overview files include `apps/hq/README.md`, `apps/kinetik/README.md`, `apps/mcp/README.md`, `docs/README.md`, and `knowledge-base/README.md`. The root has `README_APP_BUILDER_DESIGN.md`, a feature design document rather than a general repository overview.
- Vercel configurations currently exist at the root and under HQ, Kinetik, Kingdom, Landing, Lashira Web, and Web. `40c1472` adds Capacitor projects for Kinetik and Web. Later public artifact/media paths add Cloudflare Worker-style deployment files.
- Configuration proves a deployment path existed; absent tags and release objects, it does not establish a public launch date.

## Current architecture snapshot

The current root is a monorepo with multiple React/Vite apps, shared `packages/*`, a large Supabase migration set, Vercel targets, Cloudflare workers, Capacitor wrappers, and MCP/media tools. The `supabase/` tree contains 104 SQL files in the audited working tip, including a 19-file numbered Kinetik sequence, the canonical spine/wallet/auth/analytics/game/media migrations, Edge Function source, and two later timestamped migrations under `supabase/migrations/`. File count does not imply all migrations were applied to a live project.

`apps/web`, `apps/kinetik`, `apps/hq`, `apps/landing`, and `apps/lashira/web` all instantiate Supabase clients from `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Current shared package directories include `agent`, `ai`, `audio`, `brand`, `builder`, `character`, `combat`, `heroes-engine`, `media-core`, `usage`, and `video`. The shared-package imports and embed bridge are direct code evidence of ecosystem convergence.
