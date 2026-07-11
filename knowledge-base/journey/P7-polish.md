---
type: journey-phase
phase: P7
dates: 2026-07-09 → 2026-07-11
commits: 30
status: frozen
tags: [arganta, journey, P7]
---

# P7 · Polish

> [!abstract] The one phase that didn't compound — 30 commits of realms, PvP, and cosmetics on a game with zero external players
> Jul 9–11: [[LashiraBloom]] pivoted from a single farm map into a hub-with-five-realms openworld (**arena · bloomwall · festival · keep · kitchen**), shipped circle PvP, and absorbed a week of cosmetic polish — walk cycles, boss scale, sprite wiring, cosmetics sub-tabs, Character Page, Skill Forge, sword clipping. Unusually for this repo, a ~20-doc openworld design burst dated 2026-07-10 mostly *shipped inside 24–48h*. But [[00-MASTER-KB#9 · Build Timeline — 22 days|§9]] reads the shape plainly: **P0→P6 is compounding platform work; P7 is not.** Net external-user delta for the week: **0**.

## Shipped
*(from [[00-MASTER-KB#9 · Build Timeline — 22 days|§9]] · [[00-MASTER-KB#5 · Data Model|§5 realms]])*

- **Hub → five realms** — the single castle-center farm generalized into a portal hub over **arena · bloomwall · festival · keep · kitchen**, each a realm module.
- **Shared `RealmShell`** — one four-corner shell wired to the real `@arganta/combat` **ActionCluster**; realms only supply actions (`shared-game-shell-component-strategy`, shipped as `RealmShell`).
- **`PortalModal` confirm gate** — replaced instant-teleport; per-realm `camZoom`.
- **Bloomwall tower defense** — a genuinely-built, bestiary-driven realm (`CONCEPT-bloomwall-real-tower-defense`, v1–v1.5) with ActionCluster hero kit, `SettingsSheet`, `camZoom`.
- **Circle PvP** *(2026-07-09)* — per-path fairness profile · PvP HP normalization · zone-gated combat · circle rank · hearts HUD (`pvp-concept`).
- **HQ Openworld Builder** — an operator surface + real toolset + pixel-inspector (`CONCEPT-portal-markers-and-openworld-builder` Part 2/3 · `HANDOFF-openworld-builder-v2-pixel-inspector`).
- **Unified `SettingsSheet`** — one shared settings component for the farm and all five realms (`DESIGN-unified-settings-command-sheet`).
- **Cloud save** — realm reward/save state persisted (blob-based).
- **Polish pass** — walk cycles · boss scale · sprite wiring · cosmetics sub-tabs · Character Page · Skill Forge · sword clipping.
- **Build plumbing** — `@arganta/audio` vite alias fixed (2026-07-10) so LashiraBloom's `dist` build resolves the shared audio package.

## Tried & abandoned / superseded

> [!warning] The pattern flips here: concepts mostly *shipped*, but the elegant abstractions lost to bespoke copies
> Where P5 froze a heavy stack and shipped the light one, P7's design docs mostly landed — yet every doc that proposed *consolidation* was overruled in favour of hand-built duplication.

| Proposed / locked | Fate | What shipped instead |
|---|---|---|
| **"One `RealmLoop` engine, five configs"** consolidation (`AUDIT-battle-test-and-habit-loop-consolidation`) | rejected | **Five bespoke realm modules** — the shell was shared, the loop was not |
| **Circular tile portal markers** replacing rect hotspots (`CONCEPT-portal-markers` Part 1) | not adopted | rect hotspots kept; only Part 2/3 (the HQ builder) shipped |
| **20MB single-HTML 5-world prototype** (`single-html-5world-prototype-plan`) | throwaway branch | the **React/Supabase realm system** became the product path |
| **Conceptual SQL spine** — `world_realms` · `world_portals` · `resource_ledger` · `xp_ledger` (`architecture-spine-and-world-builder-design`) | never migrated | reward state lives in a **save blob** |
| **Concurrency-safe append-ledger RPC** — flagged as the **#1 forecasted circle-coop production bug** (`IMPL-habit-loops-controllers-circle-access`) | never built | blob read-modify-write **clobber risk is live in shipped code** |
| **Stronghold / city endgame + Economy/World/Portfolio cockpits** (`openworld-stronghold-command-architecture` · `roadmap-and-build-plan` P5–P6) | unbuilt | only the "add a World Builder surface" recommendation landed |
| **`PLAN-inspector-fields-and-prompt-starter`** | superseded same-day | folded into the **v2 pixel-inspector handoff** |
| **Server-adjudicated authority** (RPC referee + append ledgers) (`mmorpg-architecture`, realm generalization) | deferred | PvP/farm stayed **victim/host-authoritative** — value-minting still client-trusted within circles |

> [!bug] A shortcut that authored its own regression
> `HANDOFF-Claude-Code` item #6 deliberately inserted portals **first** in `HOTSPOTS[]` so transfers win rect overlaps — which is exactly the **castle/market shadowing** regression the `AUDIT` then had to fix (with the `PortalModal` gate + shared shell). "Make transfer win" in one session became a next-session bug.

## Decisions made here
*(from [[00-MASTER-KB#13 · Decision Log|§13]])*

> [!note] Nothing landed in the formal §13 log — the P7 decisions were made in code
> The last dated row in §13 is **2026-07-08 · Gold → 🌸 Bloom** (a P6 decision). No P7 decision reached the table. The calls that shaped this phase happened between commits:
> - **Reject one-engine-five-configs; build five bespoke realm modules** — reuse the *shell* (chrome), not the *loop* (content).
> - **Confirm-gate portals over instant-teleport** (`PortalModal`), after the AUDIT caught the teleport + dual-HUD regressions.
> - **Economy stays blob-saved** — the append-ledger RPC was specced and declined, deferring the circle-coop clobber risk rather than designing it out.

## What it taught

> [!failure] Polish is not progress — the "removed" column has never been non-zero
> P0→P6 built a compounding platform; **P7 spent 30 commits polishing it for nobody.** [[00-MASTER-KB#12 · Milestone Tracker|§12]]'s weekly log is blunt: *surfaces added — Skill Forge, Character Page, cosmetics, mounts; external users — 0; net user delta — 0.* The diagnosis isn't in what was built, it's in the one cell that stays zero. The fix for [[00-MASTER-KB#11 · Debt Register|D1]] is distribution, not features — one app, one channel, ten strangers. → [[distribution-not-features|polish is not progress]] · [[distribution-not-features|distribution not features]]

- **Share the shell, not the loop.** The "polish the shell once, every realm inherits" bet (`shared-game-shell-component-strategy`) proved correct and became the multiplier the AUDIT predicted — `RealmShell` + one `SettingsSheet` + one ActionCluster across five realms. But the *content* abstraction ("one loop engine, five skins") was rejected for five hand-built modules. Reuse converges on chrome; content resists being config. → [[reuse-the-spine-dont-rebuild|one engine many configs]] · [[reuse-the-spine-dont-rebuild|shared shell multiplier]]

- **Offscreen renders validate logic, not on-screen scale.** `CONCEPT-bloomwall`'s §17 admits "verified in-browser" overclaimed for visual work — three *user screenshots* caught tiny-monster and wrong-controller bugs already marked done, and the same realm was re-spec'd ~6 times in one day (v1→v1.5). The headless preview proves the loop runs; it can't tell you the monsters render at the wrong size. → **headless preview lies for visual work** · [[declare-when-you-supersede|lock late]]

- **Fairness by simulation is a direction, not truth.** The PvP saga was the phase's scar tissue: five rounds of same-day debugging of *"attacker shows Hit but victim stays full,"* root-caused to resizing + refilling HP on **every PvP↔battleground zone crossing** (plus a faint-heal-to-full) — found only by reading Kingdom Heroes' proven **flat-HP receiver** as the reference. A per-path fairness profile points you the right way; only real duels tell you if it's fair. → **fairness needs real duels** · [[reuse-the-spine-dont-rebuild|reuse over rebuild]]

- **Naming a risk is not fixing a risk.** `IMPL-habit-loops` named blob read-modify-write clobber as the #1 circle-coop production bug and specified the append-ledger RPC to design it out — that RPC was never built, so the exact flagged risk ships live. A concept doc's foresight is worthless until it's a migration. → [[write-the-audit-first|name a risk isnt fix it]]

- **Concepts shipping fast is not the same as the plan converging.** Almost every "CONCEPT, no build" doc landed in 24–48h — but the speed produced *overlapping* monster-authoring UIs (Bestiary + Monster Lab from two independent "redesign from scratch" docs) and same-day supersessions (`PLAN-inspector` absorbed hours after it was written). Fast execution over churning design gives you shipped redundancy, not a converged answer. → [[declare-when-you-supersede|design churn ships redundancy]]

## Links

- Neighbors · [[P6-lashirabloom]] → **P7** *(final phase)*
- Master · [[00-MASTER-KB#9 · Build Timeline — 22 days|§9 timeline]] · [[00-MASTER-KB#13 · Decision Log|§13 decisions]] · [[00-MASTER-KB#11 · Debt Register|§11 debt]] (D1, D8) · [[00-MASTER-KB#12 · Milestone Tracker|§12 weekly log]]
- Product built here · [[LashiraBloom]] (hub · five realms · PvP · Character Page · Skill Forge · cosmetics)
- Shipped as specced · `pvp-concept` · `shared-game-shell-component-strategy` (→ `RealmShell`) · `DESIGN-unified-settings-command-sheet` · `CONCEPT-bloomwall-real-tower-defense` · `HANDOFF-openworld-builder-v2-pixel-inspector`
- Partial / not-adopted · `CONCEPT-portal-markers` (Part 1 dropped) · `IMPL-habit-loops` (append-ledger unbuilt) · `architecture-spine-and-world-builder-design` (SQL spine unmigrated) · `roadmap-and-build-plan` (P5–P6 unbuilt)
- Superseded / throwaway · `AUDIT-battle-test-and-habit-loop-consolidation` (one-engine idea rejected) · `single-html-5world-prototype-plan` (20MB branch) · `PLAN-inspector-fields-and-prompt-starter` (absorbed same-day)
- War stories · `HANDOFF-Claude-Code` (#6 portal-ordering shortcut → regression) · `pvp-concept` (5-round HP-refill debugging log)
