# Arganta repository archaeology — executive summary

Evidence cut: 2026-07-18 (Asia/Qatar). Repositories: `aldythsukapradja/kinetik` and `aldythsukapradja/ArgantaLab`.

## Evidence rules

- **FACT** means the statement is directly supported by a commit, a file at that commit, a branch/ref, or a versioned repository document.
- **INFERENCE** means the statement connects facts but is not stated by the evidence itself.
- A repository document is evidence that the document existed and made a claim. It is not automatically proof that the claimed event happened on the date written inside the document.
- Founder context supplied in the brief was not used as historical proof.

## Scope audited

| Repository | Audited refs | Unique commits | Recorded span | Tags | Release evidence |
|---|---:|---:|---|---:|---|
| `kinetik` | `main` | 33 | 2026-06-12 to 2026-06-15 | 0 | GitHub API reports 0 releases |
| `ArgantaLab` | `main`, `gh-pages`, eight `claude/*` feature refs, `lashira-art-library` | 685 across all refs; 669 reachable from `main` | 2026-06-19 to 2026-07-18 | 0 | GitHub API reports 0 releases |

The audit covered chronological and graph logs, authors, root commits, branches, tags, GitHub release listings, rename/delete history, per-feature path logs, selected diffs, package manifests, Supabase migrations, deployment files, environment-template names, READMEs, current architecture, and visual assets. The public GitHub API returned zero tags and zero releases for both repositories on the evidence-cut date. Dependency-only updates were excluded from the milestone timelines.

### Commit authorship as recorded by Git

| Repository/ref set | Recorded author identity | Unique commits attributed |
|---|---|---:|
| Kinetik `--all` | `Aldyth SUKAPRADJA` | 33 |
| ArgantaLab `--all` | `Aldyth SUKAPRADJA` | 547 |
| ArgantaLab `--all` | `Claude` | 133 |
| ArgantaLab `--all` | `aldythsukapradja` | 5 |

These are Git author fields, not a reliable measure of who conceived, directed, reviewed, tested, or deployed each change. The creator-credit narrative needs founder confirmation.

## The reconstructed story

### FACT — the public Kinetik history starts somewhere unexpected

The first `kinetik` commit, [`fbe65ef`](https://github.com/aldythsukapradja/kinetik/commit/fbe65ef912289f65b13bd8c408f0ef84cce18e53), is not a family product. It adds a single `index.html` titled **“RMO World Cup · World Cup 2026 Forecast Arena.”** Fifty-nine minutes later, [`5f77dd3`](https://github.com/aldythsukapradja/kinetik/commit/5f77dd355ddb8304e63b069411205b37c936da64) replaces most of that file and imports Kinetik as a private Family + Friends circle product with Today, Calendar, Ask, Apps, Me, a Google Sheets adapter, two modular apps, PWA files, and a documented React/Firebase migration path.

This means the public repository proves a **repurposing event**, but not the earlier design evolution that produced the imported family shell.

### FACT — the first ArgantaLab week contains the core product pivots

ArgantaLab begins on 2026-06-19 with standalone HTML games. On 2026-06-20 it moves to a React/Vite app, adds Supabase authentication and Vercel deployment, changes to guest-first authentication, adds learning worlds, cloud progress and Diamonds, then adds the no-code Game Wizard, pro-code Builder Lab, Discover, My GameStore, and public game pages. On 2026-06-21–22 it adds the six-world learning system, Buddy, streaks, Quests, Journey, Parent pages, per-player sessions, a parent gate, cloud kid auth, circles v2, and the first HQ analytics surfaces.

### FACT — Kinetik becomes KinetikCircle inside ArgantaLab

The Kinetik implementation in `apps/kinetik` is introduced before the rebrand, then rebuilt on 2026-06-23 with Supabase as the only source of truth ([`7fb6e6c`](https://github.com/aldythsukapradja/ArgantaLab/commit/7fb6e6ce15b75e4548e03a71295497739e872a0a)). The same day [`e6713c9`](https://github.com/aldythsukapradja/ArgantaLab/commit/e6713c982c6217a75deb8320176396a14b8e7bf4) changes the product name to **KinetikCircle**. Calendar Board/Month, real login, kid activity rings, Moments, Broadcast/Discover, and four native mini-apps follow.

### FACT — ArgantaLab evolves from learning app to creation and ecosystem platform

The evidence forms a clear sequence:

1. Static games and a learning shell.
2. Cloud identity, progress, and Diamonds.
3. No-code and pro-code creation.
4. Discover, My GameStore, sharing, and leaderboards.
5. Buddy, Quests, Parent pages, and per-kid analytics.
6. A shared identity/circle/wallet spine.
7. KinQuest, Arganta Studio v2, Pixel Vault, shared combat, and native wrappers.
8. Circle HQ, The Bridge, shared AI/media/agent/builder/brand packages, and public artifact runtime.

### FACT — convergence is explicit in code and later repository documents

The convergence is not merely a naming claim. Current code has:

- one Supabase client pattern across `apps/web`, `apps/kinetik`, `apps/hq`, `apps/landing`, and `apps/lashira/web`;
- shared `profiles`, `circles`, membership, wallet, game, and analytics migrations;
- shared packages under `packages/*` including combat, audio, AI, agents, builder, media, brand, and usage;
- an embed/auth bridge between products;
- one Arganta landing product and one HQ/Bridge operating layer;
- brand registry entries for Arganta, ArgantaLab, KinetikCircle, Circle HQ, and LashiraBloom.

The versioned knowledge-base snapshot added on 2026-07-11 summarizes this as “one substrate” and calls KinetikCircle and ArgantaLabs “skins on the same spine.” That document is evidence of the founder/system interpretation as of July 11; the shared migrations and imports independently support the architectural part of the claim.

### INFERENCE — the two projects gradually became one vision

The strongest supported interpretation is: Kinetik supplied the household/circle shell and modular-app grammar; ArgantaLab supplied learning, creation, progression, and a creator marketplace; ArgantaLab’s monorepo then absorbed KinetikCircle and joined both to the same identity, wallet, Supabase project, builder, content, and operating system. The evidence supports convergence of implementation and product language. It does not prove user adoption, commercial success, or that the strategic vision was fully formed at the beginning.

## The strongest documentary tensions

- **A repo reborn in one hour:** World Cup predictor → family-circle shell.
- **The login wall that was removed:** full login page → guest-first gating.
- **The signature idea that did not ship:** App Builder “smart manifest” inference remained a document; templates and the shared shell shipped.
- **A producer without a consumer:** circle-scoped app publishing exists in HQ plumbing, while KinetikCircle does not read `hq_app` in the audited history.
- **The day the spine became policy:** KinetikCircle reuses `circles`; no parallel `kinetik_circles` model.
- **Rewrite as both strength and loss:** static HTML → React, old HQ scaffold → Command, bespoke builders → shared shell.
- **A cockpit before traffic:** the repository contains sophisticated analytics and provenance systems, while the July 11 snapshot explicitly records zero external users. This is a repository claim, not an independently verified metric.

## Confidence and gaps

High confidence: commit dates/hashes/messages, changed paths, deletes/renames, branch topology, tags, current file existence, and architecture imports.

Medium confidence: product meaning inferred from file names and diffs when the commit message is generic.

Founder confirmation required:

- Where is the pre-import history that led to the Kinetik shell in `5f77dd3`?
- Was the RMO World Cup commit an intentional repository seed, an accidental upload, or a deliberate product pivot?
- May the July 11 knowledge-base statements about zero external users and the family-shell wedge be used publicly?
- Which historical UI states may be re-rendered and shown publicly if they contain seeded family names or private endpoints?

See [founder-questions.md](founder-questions.md) for the full confirmation list.

## Deliverables

- [Kinetik timeline](kinetik-timeline.md)
- [ArgantaLab timeline](argantalab-timeline.md)
- [Merged timeline](merged-timeline.md)
- [Product pivots](product-pivots.md)
- [Deleted history](deleted-history.md)
- [Visual evidence](visual-evidence.md)
- [Founder questions](founder-questions.md)
- [Top 30 episode treatments](top-30-episodes.md)

No production code, dependencies, deployments, or runtime configuration were changed. `docs/content/` and `episodes/` were intentionally not created pending founder confirmation.
