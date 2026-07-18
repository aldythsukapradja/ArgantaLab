# Top 30 Documentary Chapters

## Editorial status

This is an evidence-backed chapter slate, not the final 30-day content calendar. The full scripts under `docs/content/` and `episodes/` should be created only after the founder answers the blocking questions.

Each chapter separates the recorded event from the proposed lesson:

- **FACT** is supported by Git or a named repository file.
- **Proposed founder lesson** is an editorial interpretation requiring founder confirmation.
- Every historical screen should be reconstructed from the cited commit and captioned with its hash and date.

## 01 — The repository that started as something else

- **Historical date:** 2026-06-12
- **Hook:** “The first Kinetik commit was not Kinetik.”
- **Supporting commits:** Kinetik `fbe65ef` (RMO World Cup forecast arena), `cbd8f3c` (Event Poll), `5f77dd3` (Kinetik shell import).
- **FACT:** In one repository day, `index.html` changed from a World Cup predictor to a private family-and-friends product with Today, Calendar, Ask, Apps, and Me.
- **UI/visual evidence:** Render the three `index.html` revisions side by side; zoom into the titles and navigation labels.
- **Proposed founder lesson:** Product history is often messier than the founding myth; preserve the mess.
- **Technical lesson:** Reusing a repository preserves ancestry but can make product provenance ambiguous.
- **Instagram carousel:** 1) surprising first screen; 2) first hash/date; 3) Event Poll interlude; 4) Kinetik shell; 5) unresolved question: pivot or repo reuse?
- **Reel outline:** Cold open on the World Cup title → rapid Git diff → reveal the Kinetik navigation → ask the founder for the missing motive.
- **YouTube outline:** Inspect the root commit → reconstruct all three screens → explain what Git proves → separate four possible explanations → founder response.

## 02 — Calendar as the source of truth

- **Historical date:** 2026-06-12
- **Hook:** “Before the brand settled, the data model already had an opinion.”
- **Supporting commits:** Kinetik `5f77dd3`, `6f11cb1`.
- **FACT:** The imported Kinetik shell calls Calendar the source of truth, includes Board and Week views, previews Ask actions before applying them, and models circles and people without `familyId`/`memberId` terminology.
- **UI/visual evidence:** Calendar Board/Week, Ask preview, and the `circleId`/`personId` code fragment.
- **Proposed founder lesson:** A product can find its durable primitive before it finds its durable name.
- **Technical lesson:** Preview-before-apply and a central event model make automation safer.
- **Instagram carousel:** Calendar claim → Board/Week → Ask preview → circle identity schema → what survived later.
- **Reel outline:** Show “source of truth” in code → tap through the calendar → animate Ask proposing, not silently mutating → close on the later shared spine.
- **YouTube outline:** Original information architecture → adapter design → identity vocabulary → survival into KinetikCircle → limits of the evidence.

## 03 — Moments took Ask’s seat

- **Historical date:** 2026-06-12
- **Hook:** “One navigation change revealed a product pivot.”
- **Supporting commits:** Kinetik `7d17369`, followed by `cf21f97`.
- **FACT:** Navigation changed from `Today / Calendar / Ask / Apps / Me` to `Today / Calendar / Moments / Apps / Me`; Ask became a docked orb. The next day, Moments gained real media, stories, a feed, and creation.
- **UI/visual evidence:** Before/after navigation capture, assistant orb, Moments preview, then the real-media feed.
- **Proposed founder lesson:** Scarce navigation space exposes true priorities.
- **Technical lesson:** A cross-cutting assistant belongs in the shell; a media domain needs a full destination and data flow.
- **Instagram carousel:** old nav → winning nav slot → orb → real Moments → later recurrence in ArgantaLab.
- **Reel outline:** Highlight Ask → swipe it out → reveal Moments → show the orb still present → connect to later media work.
- **YouTube outline:** Navigation diff → product implications → Moments implementation → later monorepo recurrence → founder motivation.

## 04 — When Moments became real media

- **Historical date:** 2026-06-13 to 2026-06-14
- **Hook:** “A social feed is not a mockup once uploads, carousels, and reactions arrive.”
- **Supporting commits:** Kinetik `cf21f97`, `173aada`, `60dcfa1`.
- **FACT:** Moments progressed from real-media feed/stories/create to multi-photo carousels and reactions, then server-backed reactions and uploads.
- **UI/visual evidence:** Reconstruct a story, carousel, reaction action, and the associated storage/server code paths.
- **Proposed founder lesson:** The hard part of a warm family feature is unglamorous data plumbing.
- **Technical lesson:** Media UI crosses a threshold when persistence, upload behavior, and reaction consistency become server concerns.
- **Instagram carousel:** mockup threshold → real media → carousel → reactions → server backing.
- **Reel outline:** Start on polished feed → pull back to upload/reaction code → show the three commits → end with “the interface was the small part.”
- **YouTube outline:** Feature chronology → media data lifecycle → offline/fallback behavior → privacy questions → later Moments/Broadcast evolution.

## 05 — The family app became an app platform

- **Historical date:** 2026-06-13 to 2026-06-15
- **Hook:** “Kinetik stopped being one app when it learned to discover other apps.”
- **Supporting commits:** Kinetik `7dcaf5d`, `2e646bf`, `eec5651`, `5ed855f`.
- **FACT:** Circle Chat and a manifest-driven `AppRegistry` arrived, followed by games, an embedded fallback catalog, `apps.json`, and 24 `App_*` files.
- **UI/visual evidence:** Apps tab, catalog manifest, Circle Chat, three early games, and a contact sheet of the final 24 app files.
- **Proposed founder lesson:** Platform ambition often begins as a registry and a naming convention.
- **Technical lesson:** A manifest decouples shell navigation from individual app implementation; a fallback keeps the catalog usable when the network is unavailable.
- **Instagram carousel:** one shell → registry → first games → fallback → 24-app catalog.
- **Reel outline:** Count app files on screen → reveal the registry → launch one mini-app → explain the platform seed.
- **YouTube outline:** Registry architecture → app-file evolution → resilience fallback → what did and did not migrate to the monorepo.

## 06 — The first ArgantaLab was disposable

- **Historical date:** 2026-06-19 to 2026-06-20
- **Hook:** “ArgantaLab’s first architecture lasted about a day.”
- **Supporting commits:** ArgantaLab `34385b3`, `6a4e798`, `4c20ac9`.
- **FACT:** The repository began with static Strike Zone-era HTML, service-worker, and handoff files; a 31-file React migration followed, then the root prototype was deleted.
- **UI/visual evidence:** Static root at `34385b3`, first React build at `6a4e798`, and deletion diff at `4c20ac9`.
- **Proposed founder lesson:** A prototype can be successful precisely because it is safe to delete.
- **Technical lesson:** Removing the superseded entry point prevents two architectures from becoming competing sources of truth.
- **Instagram carousel:** static genesis → React tree → deletion diff → surviving ideas → one-day architecture reset.
- **Reel outline:** Show old files → time-lapse React tree appearing → red deletion diff → current descendant.
- **YouTube outline:** Reconstruct static build → examine migration → explain cleanup → compare with later prototype-deletion pattern.

## 07 — Authentication entered, exited, and returned differently

- **Historical date:** 2026-06-20 to 2026-06-22
- **Hook:** “The login page survived only briefly, but identity became foundational.”
- **Supporting commits:** `0cd980e`, `4055682`, `0dfc499`, `4333628`, `5ba1158`.
- **FACT:** Supabase Login was added, then deleted for guest-first/AuthWall. Later commits introduced player switching, a parent passcode, and cloud auth/circles.
- **UI/visual evidence:** Login page → guest entry → player switcher → parent gate → cloud-circle signup.
- **Proposed founder lesson:** Removing friction is not the same as abandoning identity; it can clarify where identity belongs.
- **Technical lesson:** Authentication, household roles, player sessions, and parental authorization are separate layers.
- **Instagram carousel:** login → delete → guest → parent gate → cloud circles.
- **Reel outline:** Delete the Login screen on beat → reveal identity returning as roles and circles → close on the schema.
- **YouTube outline:** Auth chronology → UX tradeoff → role model → cloud migration → founder rationale still needed.

## 08 — A lesson path became cinematic worlds

- **Historical date:** 2026-06-20
- **Hook:** “The learning platform expanded from eight lessons to a universe in a handful of commits.”
- **Supporting commits:** `f2c00fd`, `8765ff9`.
- **FACT:** Web Quest gained eight lessons and a 3D world map; Space and Neural worlds plus Prompt Forge followed.
- **UI/visual evidence:** Lesson path, 3D map, Space, Neural, and Prompt Forge captures from their exact commits.
- **Proposed founder lesson:** A strong learning sequence can become a world metaphor, but spectacle must remain tied to progression.
- **Technical lesson:** Shared world navigation and lesson state let multiple themed experiences reuse one learning substrate.
- **Instagram carousel:** lesson list → 3D map → Space → Neural → Prompt Forge.
- **Reel outline:** Scroll lessons → zoom into map → jump between worlds → end on the shared state layer.
- **YouTube outline:** Web Quest baseline → cinematic expansion → architecture behind reuse → evidence of later six-world system.

## 09 — Diamonds made progress portable

- **Historical date:** 2026-06-20
- **Hook:** “Virtual currency appeared at the same moment progress moved to the cloud.”
- **Supporting commit:** `5defdd0`.
- **FACT:** The commit introduced Supabase profiles, cloud progress, Diamonds, and editable names, plus `supabase/schema.sql`.
- **UI/visual evidence:** Profile editor, progress state, Diamond balance, and the corresponding schema.
- **Proposed founder lesson:** Currency is most credible when it is attached to identity and earned progress, not only decoration.
- **Technical lesson:** Profile, progression, and wallet-like data require clear ownership and persistence boundaries.
- **Instagram carousel:** local progress problem → cloud profile → Diamonds → schema → later canonical wallet.
- **Reel outline:** Diamond animation → cut to schema → trace it forward to the shared wallet spine.
- **YouTube outline:** Feature diff → data model → synchronization risks → later wallet authority → no claims about real economy usage.

## 10 — Studio was deleted for a Wizard

- **Historical date:** 2026-06-20
- **Hook:** “The first creator pivot began with deleting a generic page.”
- **Supporting commit:** `02e5452`.
- **FACT:** `Studio.tsx` was deleted as Game Wizard, generation logic, My Games, and generation data were added.
- **UI/visual evidence:** Deleted Studio source/diff, Wizard steps, generated game, My Games library.
- **Proposed founder lesson:** A broad creative promise becomes usable when the next decision is obvious.
- **Technical lesson:** A guided state machine can turn open-ended generation into reproducible structured input and stored output.
- **Instagram carousel:** deleted Studio → Wizard steps → generation → My Games → creator-platform seed.
- **Reel outline:** Red deletion line → click through Wizard → game appears → save to My Games.
- **YouTube outline:** Why generic Studio was insufficient → Wizard model → storage/output → lineage into Studio v2 and Forge.

## 11 — Discover completed the creation loop

- **Historical date:** 2026-06-20
- **Hook:** “A builder becomes a platform when creation can be played and discovered.”
- **Supporting commits:** `6a6973a`, `bc27845`.
- **FACT:** Builder Lab added pro-code/device preview/prompt-building capabilities; Discover, My GameStore, PlayPage, Avatar, and Fame followed.
- **UI/visual evidence:** Builder/device frame → Discover cards → PlayPage → My GameStore → Avatar/Fame.
- **Proposed founder lesson:** Creation needs an audience loop, even when that audience is not yet proven to exist.
- **Technical lesson:** Build, catalog, play, profile, and reputation are separate product domains that need explicit contracts.
- **Instagram carousel:** build → preview → publish surface → play → identity/reputation.
- **Reel outline:** Type/build → device preview → card lands in Discover → play → return to creator shelf.
- **YouTube outline:** Creator loop diagram → commit evidence → architecture boundaries → distinguish product capability from user adoption.

## 12 — Six worlds arrived; their prototypes disappeared

- **Historical date:** 2026-06-21
- **Hook:** “The six-world vision survived because its duplicate prototypes did not.”
- **Supporting commits:** `7cb10f2`, `4a7a0ec`.
- **FACT:** NumberDash, WordQuest, WonderLab, LogicLand, WorldTrail, and LifeQuest were added with integrated React modules and concept HTML; the next commit deleted the `concept/` tree while the app implementation remained.
- **UI/visual evidence:** Six-world hub montage, one standalone concept, deletion diff, surviving React route.
- **Proposed founder lesson:** Keep the product; remove the parallel artifact once it stops teaching you.
- **Technical lesson:** Duplicate prototypes become dangerous when they can drift from the integrated runtime.
- **Instagram carousel:** six names → world hub → concept HTML → deletion → integrated system.
- **Reel outline:** Rapid six-world reveal → trash animation on concept folder → show routes still working.
- **YouTube outline:** World taxonomy → concept generator → integrated implementation → why deletion strengthened traceability.

## 13 — Buddy, Quests, and the parent layer

- **Historical date:** 2026-06-21
- **Hook:** “The platform stopped being only lessons and became a relationship loop.”
- **Supporting commits:** `c4bf1fc`, `a8b463e`, `99ca81f`.
- **FACT:** Buddy and streaks arrived, followed by synchronized learning, costumes, Quests, badge cinematics, Journey, and Parent UI.
- **UI/visual evidence:** Buddy state, streak, quest card, badge cinematic, Journey map, Parent surface.
- **Proposed founder lesson:** Retention mechanics feel coherent when they connect a learner, a companion, and a caregiver—not when they are isolated counters.
- **Technical lesson:** Child-facing progress and parent-facing interpretation are two projections of the same event history.
- **Instagram carousel:** Buddy → streak → quest → badge → parent view.
- **Reel outline:** Buddy reaction → complete quest → badge → pull back to the parent view.
- **YouTube outline:** Feature sequence → shared progress data → motivation versus surveillance → questions for the founder.

## 14 — From local players to cloud circles

- **Historical date:** 2026-06-22
- **Hook:** “A player switcher became the doorway to a family graph.”
- **Supporting commits:** `0dfc499`, `4333628`, `5ba1158`.
- **FACT:** Per-player sessions and parent gating preceded cloud authentication, kid signup, circles v2, and the first major monorepo presence of HQ and Kinetik.
- **UI/visual evidence:** player picker → PIN gate → circle creation/join → file-tree expansion across `apps/web`, `apps/hq`, and `apps/kinetik`.
- **Proposed founder lesson:** Multi-user products usually reveal themselves first through the awkwardness of switching identities locally.
- **Technical lesson:** A family graph needs stable principals, roles, and cloud ownership; a UI switcher alone cannot provide them.
- **Instagram carousel:** one device/many players → gate → signup → circle → three-app ecosystem.
- **Reel outline:** Switch player → lock parent area → create circle → zoom out to monorepo tree.
- **YouTube outline:** Session model → parental boundary → circles v2 → first convergence evidence → migration risks.

## 15 — The busiest day rebuilt the foundation

- **Historical date:** 2026-06-23
- **Hook:** “Eighty-four commits landed on the day the ecosystem found its spine.”
- **Supporting commits:** `7fb6e6c`, `e6713c9`, `81a5ca9`, `7adeff5`, `952676e3`, `8c6f9ba`.
- **FACT:** June 23 is the peak commit day in the collected history. It includes Kinetik’s Supabase-first rebuild, the KinetikCircle rename, calendar work, Circle SDK/App Builder work, a canonical identity/family/wallet schema, and a server-authoritative wallet.
- **UI/visual evidence:** commit-density chart, rebuilt Kinetik shell, rebrand, Calendar views, schema diagram, wallet call path.
- **Proposed founder lesson:** Velocity matters only when the work converges on durable boundaries.
- **Technical lesson:** A single source of truth, canonical identities, and authoritative mutations are the groundwork for cross-product features.
- **Instagram carousel:** 84 commits → clean rebuild → rename → shared spine → authoritative wallet.
- **Reel outline:** Commit counter races upward → pause on six pivotal hashes → animate products connecting to one spine.
- **YouTube outline:** Day timeline → inspect each foundational diff → identify parallel branch work → separate quantity from significance → founder account of the sprint.

## 16 — Kinetik became KinetikCircle

- **Historical date:** 2026-06-23
- **Hook:** “One word changed the boundary of the product.”
- **Supporting commits:** `e6713c9`, `81a5ca9`, `2266502`.
- **FACT:** The monorepo Kinetik app was renamed KinetikCircle, then gained Board/Month/Quick Add calendar work, login, and kid rings.
- **UI/visual evidence:** capture the last pre-rename header, first KinetikCircle shell, Calendar views, and kid-ring UI.
- **Proposed founder lesson:** A meaningful rename should clarify who belongs inside the product, not only refresh its logo.
- **Technical lesson:** Renames become expensive when identifiers, routes, schemas, and visible copy are coupled; Git can show which layers actually changed.
- **Instagram carousel:** old name → rename diff → calendar → kid rings → “what did Circle mean?”
- **Reel outline:** Morph Kinetik into KinetikCircle → reveal new family UI → freeze on the unanswered naming motive.
- **YouTube outline:** Trace every renamed surface → compare data vocabulary → inspect post-rename features → founder explanation.

## 17 — The app-builder idea arrived before its final form

- **Historical date:** 2026-06-23
- **Hook:** “The creator platform’s first architecture was committed—and then largely discarded.”
- **Supporting commits:** `6cf43b9b`, `21e44795`, `7adeff50`, `456b12e7`.
- **FACT:** Circle HQ gained Game Builder and pro-code work; a Circle Game SDK spine, host bridge, schema, and App Builder followed. Several first-generation builder files were later removed or rebuilt.
- **UI/visual evidence:** builder tab, device preview, `circleBridge` contract, manifest/schema, then the deletion/replacement diff.
- **Proposed founder lesson:** Keep a useful protocol even when the interface around it fails to survive.
- **Technical lesson:** Host bridges and manifests can outlive individual builder UIs because they define interoperability rather than workflow.
- **Instagram carousel:** first builder → SDK → bridge → deletion → surviving contract.
- **Reel outline:** Show builder UI → dissolve it → leave the bridge/schema glowing → jump to later Forge.
- **YouTube outline:** Builder branch chronology → SDK anatomy → deleted UI → what survives on `main` → no claim that publishing was end-to-end shipped.

## 18 — Identity, family, and wallet became one spine

- **Historical date:** 2026-06-23
- **Hook:** “The ecosystem became credible when three databases stopped pretending to be separate worlds.”
- **Supporting commits:** `952676e3`, `8c6f9ba`, `99d8c873`.
- **FACT:** `migration_spine.sql` established canonical identity/family/wallet structures; wallet mutations became server-authoritative; HQ gained family-graph stats and a cross-app spine contract.
- **UI/visual evidence:** simplified schema diagram generated from the SQL, wallet request path, and three app logos connecting to the shared data layer.
- **Proposed founder lesson:** Convergence is a data decision before it is a brand decision.
- **Technical lesson:** Cross-app identity needs canonical keys and server-authoritative balance changes to avoid split-brain state.
- **Instagram carousel:** three silos → migration spine → family graph → wallet authority → shared ecosystem.
- **Reel outline:** Animate duplicate identities colliding → merge into canonical nodes → server validates a Diamond mutation.
- **YouTube outline:** Pre-spine models → migration walkthrough → wallet threat model → downstream consumers → uncertainty about live migration scale.

## 19 — Analytics became Family Pulse

- **Historical date:** 2026-06-23 to 2026-06-24
- **Hook:** “A dashboard changed meaning when it stopped talking like a dashboard.”
- **Supporting commits:** `1264f61`, `fdccc1bf`, `b4c9115c`, `9f8d1215`.
- **FACT:** Per-kid grown-up analytics and Diamond/content-depth views were followed by a rename and redesign to Family Pulse; later commits removed demo data and rebuilt the surface around live family information.
- **UI/visual evidence:** analytics cards before the rename, Family Pulse after it, demo-data removal diff, and live-state loading/error treatment.
- **Proposed founder lesson:** Caregiver software should interpret family life, not merely expose metrics.
- **Technical lesson:** Replacing demo data with live queries is a product milestone because empty, loading, error, and authorization states become real.
- **Instagram carousel:** analytics → rename → family cards → demo stripped → live states.
- **Reel outline:** Corporate chart language fades → Family Pulse cards appear → demo badge disappears → live query runs.
- **YouTube outline:** Before/after UI → data-source audit → naming interpretation → founder intent → privacy considerations.

## 20 — Family memories met an open world

- **Historical date:** 2026-06-25
- **Hook:** “The repository put a family memory feed and a shared world in the same product week.”
- **Supporting commits:** `e31f886`, `d1b92b2`, `58f338e`, `ba413f2`.
- **FACT:** Kinetik Moments and open-world modules arrived together; kid rings, mounts, and co-op UI/engine followed; Calendar and event deletion were overhauled; an Agent OS interface and pipeline also entered HQ.
- **UI/visual evidence:** Moments feed, open-world scene, co-op indicators, Calendar overhaul, and Agent OS orb/pipeline.
- **Proposed founder lesson:** A family operating system was being explored as both coordination software and a place to inhabit.
- **Technical lesson:** Shared identity and event state let calendar, media, co-op presence, and assistants connect—but Git alone does not prove users experienced them as one coherent flow.
- **Instagram carousel:** Moments → world → co-op → calendar → agent.
- **Reel outline:** Swipe family memory → avatar enters world → co-op signal → calendar event → assistant orb.
- **YouTube outline:** Four parallel feature lines → shared dependencies → cohesion versus scope risk → later removals → founder account.

## 21 — Moments was reframed as Broadcast

- **Historical date:** 2026-06-26
- **Hook:** “The same content primitive changed from memory to distribution.”
- **Supporting commits:** `c63d9025`, `34bf332a`, `cb6c6873`.
- **FACT:** HQ Moments was removed as a platform Discover/Broadcast feed entered KinetikCircle; later work added prompt-driven and bulk content tooling, and the migration file was reordered.
- **UI/visual evidence:** final HQ Moments state, deletion diff, first Broadcast feed, import/prompt controls, migration rename.
- **Proposed founder lesson:** A feature can keep its mechanics while its strategic role changes completely.
- **Technical lesson:** Feed semantics—audience, attribution, moderation, ordering—matter more than card layout.
- **Instagram carousel:** family memory → deletion → Broadcast → bulk/prompt engine → migration detail.
- **Reel outline:** Relabel the same card from Moment to Broadcast → reveal new feed controls → end on audience question.
- **YouTube outline:** Moments lineage → Broadcast architecture → database migration ordering → what Git cannot establish about distribution.

## 22 — Arganta became the umbrella, then went mobile

- **Historical date:** 2026-06-27
- **Hook:** “The umbrella brand appeared the same day two products gained native shells.”
- **Supporting commits:** `9af806e9`, `40c1472a`, `63b81911`, `55b8f8e6`, `fa85d2bd`.
- **FACT:** An Arganta landing app was added; Capacitor native projects were added for Kinetik and Web; the landing became a company/portfolio surface; the learning app’s mobile dock was aligned with KinetikCircle geometry.
- **UI/visual evidence:** first landing page, native project trees/device builds, and side-by-side mobile docks.
- **Proposed founder lesson:** An ecosystem becomes visible when products share both a story and interaction language.
- **Technical lesson:** Shared safe-area, dock geometry, and native wrappers are concrete convergence evidence; they do not by themselves prove store release.
- **Instagram carousel:** umbrella landing → portfolio → Capacitor → matching docks → deployment caveat.
- **Reel outline:** Zoom from two apps into Arganta logo → place both in phone frames → align their docks pixel-for-pixel.
- **YouTube outline:** Landing chronology → native architecture → visual-language diff → deployment evidence limits.

## 23 — KinQuest became the flagship experiment

- **Historical date:** 2026-07-01 to 2026-07-03
- **Hook:** “The six learning worlds condensed into one walkable RPG bet.”
- **Supporting commits:** `05793862`, `7e96f86e`, `67297e87`, `92db942d`.
- **FACT:** KinQuest entered as the flagship “Star by ArgantaLab” RPG, then was rebuilt as a full-screen walkable town, gained mobile movement work, and received a battle theatre, persistence, and Route 1.
- **UI/visual evidence:** initial KinQuest, sprite sheet, town rebuild, joystick, dialogue, battle theatre, Route 1.
- **Proposed founder lesson:** A flagship is not the first version; it is the idea that earns repeated rebuilding.
- **Technical lesson:** Movement, camera, dialogue, persistence, and battle loops are distinct systems that need incremental integration.
- **Instagram carousel:** flagship commit → sprite art → walkable town → mobile controls → battle/Route 1.
- **Reel outline:** Sprite sheet unfolds into a town → joystick moves character → battle starts → commit dates tick forward.
- **YouTube outline:** Initial architecture → Pokémon-style rebuild → mobile input fixes → persistence/battle → trademark-safe editorial wording.

## 24 — Circle HQ became a command center, then gained a Bridge

- **Historical date:** 2026-07-01 to 2026-07-02
- **Hook:** “The parent dashboard grew into an operating console with an LLM in the CEO seat.”
- **Supporting commits:** `86c8c79e`, `97c4fc44`, `a888d50b`, `26902a17`, `00332333`, `4b3f9143`.
- **FACT:** HQ gained Command routing, an organizational graph, six offices, Treasury, 27 reconciled agents, office cockpits, read-side SQL, reports, and The Bridge MCP server.
- **UI/visual evidence:** Command skeleton → office graph → Treasury → agent chat/report selector → Bridge architecture diagram.
- **Proposed founder lesson:** A dashboard becomes an operating system when it can explain, decide, and invoke—not only display.
- **Technical lesson:** A control plane needs read models, tool contracts, and explicit boundaries between deterministic reports and LLM interpretation.
- **Instagram carousel:** HQ dashboard → six offices → agents → reports → Bridge.
- **Reel outline:** Enter Command lobby → visit offices → ask CEO agent → trace request through Bridge.
- **YouTube outline:** Command build phases → read-side SQL → reports/verdict lifecycle → MCP architecture → security and “shipped” caveats.

## 25 — The creator stack split into engine and asset vault

- **Historical date:** 2026-07-03
- **Hook:** “Generating games required two products: a reusable engine and trustworthy art.”
- **Supporting commits:** `70fc13fc`, `5d787e66`, `43e1e715`, `3c1ba722`, `4610f23f`.
- **FACT:** Arganta Studio v2 introduced a wizard with reusable engine and genre modules. Pixel Vault added license-tiered, faceted art, then real owned/CC0 assets, private Supabase storage, and large-scale sprite slicing.
- **UI/visual evidence:** Studio v2 genre flow, engine/module tree, Pixel Vault facets/license labels, real-art lightbox, ingestion pipeline.
- **Proposed founder lesson:** Generative creation becomes more credible when reusable logic and asset provenance are first-class products.
- **Technical lesson:** Separate content generation from asset ingestion; record licensing metadata and keep private source storage distinct from published derivatives.
- **Instagram carousel:** Wizard → engine → asset problem → Pixel Vault → provenance pipeline.
- **Reel outline:** Generate a game shell → blank art slot → query Pixel Vault → licensed sprite drops in.
- **YouTube outline:** Studio v2 architecture → asset contract → storage/slicing pipeline → licensing boundaries → later Pixel Studio lineage.

## 26 — Shared combat proved the monorepo thesis

- **Historical date:** 2026-07-07 to 2026-07-08
- **Hook:** “The strongest convergence evidence is not a logo—it is the same damage calculation in two worlds.”
- **Supporting commits:** `c72af75d`, `d2e67acc`, `e015feba`, `7d4eb485`, `3e798657` through `4c9cdd8c`.
- **FACT:** `@arganta/combat` became a shared package consumed by Kingdom; Lashira farm battle mode then used the same combat substrate, with shared skills, scaling, effects, rewards, and broadcast VFX added incrementally.
- **UI/visual evidence:** dependency diagram, identical action cluster, Kingdom battle, Lashira arena, synchronized spell VFX, HP/MP scaling diff.
- **Proposed founder lesson:** A shared universe becomes real when products surrender duplicate rules to one source.
- **Technical lesson:** Shared domain packages prevent divergent balance and behavior while allowing each product to keep its own presentation.
- **Instagram carousel:** duplicate combat risk → package → Kingdom → Lashira → shared VFX/state.
- **Reel outline:** Cast the same skill in two worlds → reveal one imported package → show commit series 1/n to 16/n.
- **YouTube outline:** Package boundary → two consumers → network/state concerns → balance evolution → evidence of ecosystem convergence.

## 27 — The knowledge base became executable infrastructure

- **Historical date:** 2026-07-11
- **Hook:** “Documentation stopped being a folder and became a checked data source.”
- **Supporting commits:** `dff522ea`, `d0296f46`, `00caa673`, `ef296d49`, `39c5fd67`.
- **FACT:** HQ Vault adopted the main knowledge-base schema, rendered Obsidian callouts, auto-reseeded on content changes, moved to a single-source Markdown pipeline for Obsidian and HQ, expanded to 58 notes, and added CI enforcement/full HQ builds.
- **UI/visual evidence:** one Markdown note rendered in Obsidian-style source and HQ Vault, content-bump/reseed flow, CI check.
- **Proposed founder lesson:** Founder memory becomes organizational memory only when it is versioned, rendered, and tested.
- **Technical lesson:** Documentation can act as source data when frontmatter/schema validation and build checks prevent renderer drift.
- **Instagram carousel:** scattered notes → schema → two renderers → CI → verified knowledge substrate.
- **Reel outline:** Edit one Markdown line → both surfaces update → CI turns green.
- **YouTube outline:** Before/after knowledge flow → schema/frontmatter → reseeding → CI → distinguish repository assertions from independently verified history.

## 28 — Circle AI moved from interface to runtime

- **Historical date:** 2026-07-11 to 2026-07-14
- **Hook:** “The assistant stopped being only an orb when it acquired a runtime and media tools.”
- **Supporting commits:** `95132b94`, `24247984`, `969f7aed`, `e1f28f2c`, `90459e7b`.
- **FACT:** A Circle AI runtime, Video Director chat, and LLM-backed C-suite agents were added. Media Center then evolved through staged generation, real outputs/analytics, prompt-first redesign, and a sovereign rack/registry layer.
- **UI/visual evidence:** assistant/runtime diagram, Video Director chat, first Media Center, output/analytics view, prompt-first redesign, provider registry.
- **Proposed founder lesson:** An AI feature matures when the interface, tool runtime, and output provenance are designed together.
- **Technical lesson:** Model calls should sit behind registries/gateways so UI workflows are not permanently coupled to one provider.
- **Instagram carousel:** orb/chat → runtime → media hub → real output → registry.
- **Reel outline:** Ask assistant for media → trace through runtime → output appears → switch provider layer without changing the surface.
- **YouTube outline:** Circle AI contracts → C-suite agents → Media Center iterations → registry architecture → avoid claims about autonomy beyond code evidence.

## 29 — Arganta Core made artifacts public safely

- **Historical date:** 2026-07-15 to 2026-07-16
- **Hook:** “The creator platform needed a constitution before it needed another screen.”
- **Supporting commits:** `1b82eba7`, `04c5e4a1`, `aae9dc84`, `4b8be823`, `7902a34d`, `f93a1f8e`, `80007371`.
- **FACT:** `@arganta/agent` established Arganta Core contracts; the substrate was wired to apps; Single-File Builder generation used it; an ADR defined a public artifact runtime and serve-time safety; the runtime was implemented; Vault memory and a content engine/Buffer integration followed.
- **UI/visual evidence:** package contracts, request flow from builder to Core, ADR excerpt, public runtime boundary, memory recall, content pipeline.
- **Proposed founder lesson:** A platform scales by making its rules explicit before adding more agent personalities.
- **Technical lesson:** Public generated artifacts require isolation, validation, and serve-time controls; memory and publishing integrations need auditable interfaces.
- **Instagram carousel:** contracts → builder → safety ADR → runtime → memory/content engine.
- **Reel outline:** Generated file approaches public URL → safety gate intercepts → runtime serves approved artifact → memory recalls context.
- **YouTube outline:** Core C1/C2 → builder integration → ADR threat model → runtime implementation → remaining deployment/security questions.

## 30 — Brand, Forge, audio, and video converged into a creator fabric

- **Historical date:** 2026-07-16 to 2026-07-18
- **Hook:** “The final chapter is not an ending; it is the moment many experiments acquired shared contracts.”
- **Supporting commits:** `95352172`, `14e529d7`, `88c795b0`, `0501e196`, `9a1689c2`, `4d1980e8`, `400a9db6`.
- **FACT:** Brand OS canonized ArgantaLab; Forge introduced chat-driven app/game builders; AI Influencer Studio added five virtual creators; Audio Studio gained a repository-described sovereign music layer; Video gained a locally verified engine; Pixel Studio became a gallery-plus-Forge builder.
- **UI/visual evidence:** Brand OS references, Forge chat flow, Influencer command deck, Audio feed/player, Video engine proof record, Pixel Forge rail.
- **Proposed founder lesson:** Repeated prototypes become an ecosystem only when identity, creation, media, and runtime share durable contracts.
- **Technical lesson:** Modality-specific studios can share orchestration and brand infrastructure while retaining different generation, storage, and verification paths.
- **Instagram carousel:** Brand OS → Forge → virtual creators → audio/video → creator fabric map.
- **Reel outline:** Flash earlier Wizard/Builder experiments → snap into Forge → branch into pixel/audio/video → end on “one commit at a time.”
- **YouTube outline:** Trace Studio-to-Forge lineage → Brand OS → media engines → shared Core/runtime → clearly mark what is repository-verified versus publicly launched.

## Series-wide editorial guardrails

- Never translate commit density into hours worked, productivity, or personal sacrifice without founder testimony.
- Never call a feature “launched” when evidence shows only code, configuration, or an unmerged branch.
- Never infer children, families, customers, revenue, or adoption from seed data or polished screens.
- Use “the repository records…” for claims derived from commit messages or internal documents.
- Label founder answers **FOUNDER RECOLLECTION** and preserve their confirmation date.
- Label recreated screens **RECONSTRUCTED FROM COMMIT**; keep current-product footage visually distinct.
- Treat AI commit attribution as a fact about Git authorship, not a complete account of who conceived, directed, reviewed, or tested the work.

## Recommended series title

**One Commit at a Time: Inside Arganta** is the most evidence-compatible title. “30 Days Inside Arganta” is viable only if the framing makes clear these are thirty documentary chapters, not a claim that the products were built in thirty days.
