# Kinetik timeline

Repository: `aldythsukapradja/kinetik`. Evidence span: 2026-06-12 to 2026-06-15. All 33 commits are on `main`; there are no tags or other branches in the audited clone.

## Critical provenance finding

**FACT:** The first commit is an RMO World Cup predictor, not Kinetik. The family-circle product arrives as a large replacement/import in the third commit. Therefore this repository does not show the gradual invention of Calendar, Ask, or the family model; it shows their public import and four days of refinement.

## Meaningful milestones

“Current” is relative to the repository’s 2026-06-15 `main` tip.

| Date | Commit and message | Files changed | Feature/evidence | Why it mattered | Current? |
|---|---|---|---|---|---|
| 2026-06-12 14:55 +03 | [`fbe65ef`](https://github.com/aldythsukapradja/kinetik/commit/fbe65ef912289f65b13bd8c408f0ef84cce18e53) — `Create index.html` | `index.html` | RMO World Cup 2026 prediction arena with login, forecasts, agents, and a single-file PWA shell | Establishes that the repository began as a different product | No; most of `index.html` was replaced in `5f77dd3` |
| 2026-06-12 15:54 +03 | [`cbd8f3c`](https://github.com/aldythsukapradja/kinetik/commit/cbd8f3cba315a8c1a3606f898102a1f56a87c98d) — `Add files via upload` | `App_EventPoll.html` | First modular app file lands before the Kinetik shell import | First evidence of the separate-app grammar | Yes, later evolved |
| 2026-06-12 15:55 +03 | [`5f77dd3`](https://github.com/aldythsukapradja/kinetik/commit/5f77dd355ddb8304e63b069411205b37c936da64) — `Add files via upload` | `index.html`, `App_PadelAmericano.html`, `Code.gs`, `PWA_SW.js`, `README_BUILD_STANDARD.md`, `build.md`, icons and three manifests | Imports Kinetik: Family + Friends circles; Today, Calendar, Ask, Apps, Me; Calendar as source of truth; preview-before-apply Ask; DataAPI with localStorage/Google Sheets adapters; modular iframe apps; PWA | This is the repository’s actual Kinetik genesis and contains most of the family-OS concept at once | Yes, heavily refined |
| 2026-06-12 17:22 +03 | [`6f11cb1`](https://github.com/aldythsukapradja/kinetik/commit/6f11cb1a0956837bd5530b58831d9776cf2e43dd) — `Update index.html` | `index.html` | Makes a Google Apps Script URL the live adapter, adds PIN input, sheet collection mapping, built-in app catalog, and record normalization | Moves from a local demo toward an actual shared backend adapter | Yes; prototype Sheets backend remains |
| 2026-06-12 22:54 +03 | [`7d17369`](https://github.com/aldythsukapradja/kinetik/commit/7d1736904f4509b5c826c215fb8276fd7fcd8bf8) — `Update index.html` | `index.html` | Replaces the central Ask tab with a docked Ask orb; adds Moments as a main tab, a full-screen Ask UI, a Kinetik Store, and visual Moments preview | The shell changes from planner-plus-assistant to planner-plus-social memory | Yes |
| 2026-06-12 23:08 +03 | [`d5df4c2`](https://github.com/aldythsukapradja/kinetik/commit/d5df4c237c61b6c37c1a3c26105854f83343649e) — `Update index.html` | `index.html` | Adds full-screen Month calendar, inline Board add, Store product detail, circle/member cards | Calendar and Store become fuller product surfaces | Yes |
| 2026-06-13 00:24 +03 | [`7b0bf2d`](https://github.com/aldythsukapradja/kinetik/commit/7b0bf2d2cdee0aeed86f1fd65464a44cd4f78cf4) — `Update index.html` | `index.html` | Removes redundant Week view, adds multi-person calendar filtering, recurring-event delete semantics, and refines the nav/orb geometry | Clarifies Calendar’s operating model and mobile IA | Yes |
| 2026-06-13 07:41 +03 | [`cf21f97`](https://github.com/aldythsukapradja/kinetik/commit/cf21f9709a2b7a2617b33e10841ca6b18ad7b23d) — `Update index.html` | `index.html` | Replaces visual-placeholder Moments with real media feed, stories, create flow, detail/error/empty states | Moments becomes a real product pillar instead of a mock panel | Yes |
| 2026-06-13 18:56 +03 | [`7dcaf5d`](https://github.com/aldythsukapradja/kinetik/commit/7dcaf5d5d7b067e0f2eac72cece02b66b38fba7e) — `Update index.html` | `index.html` | Adds Circle Chat and a manifest-driven `AppRegistry` that parses `application/kinetik-app+json` from sibling HTML apps | The modular app idea becomes discoverable and extensible | Yes |
| 2026-06-13 23:21 +03 | [`2e646bf`](https://github.com/aldythsukapradja/kinetik/commit/2e646bf73cce23f3d3a1a10e0c2ce410da99657d) — `Add files via upload` | `App_GameCircleChess.html`, `App_GameCodeClash.html`, `App_GameEmojiParty.html` | Three circle-ready games join the app ecosystem | Kinetik Store expands beyond utility into family play | Yes |
| 2026-06-14 07:14 +03 | [`eec5651`](https://github.com/aldythsukapradja/kinetik/commit/eec5651f3f65367e3cb9f48e4d30a803482fd619) — `Update index.html` | `index.html` | Embeds a generated catalog fallback and upgrades Store discovery/detail behavior for offline, file, and hosted modes | Makes the Store resilient despite browsers being unable to enumerate local folders | Yes |
| 2026-06-14 22:36 +03 | [`173aada`](https://github.com/aldythsukapradja/kinetik/commit/173aada699a6afc8deaac8c16c926fcb977cc703) — `Update index.html` | `index.html` | Adds multi-photo Moments carousel/reactions and a more robust manifest/fallback catalog | Social memory and app distribution are both deepened | Yes |
| 2026-06-15 06:52 +03 | [`7075a30`](https://github.com/aldythsukapradja/kinetik/commit/7075a3051e70bc4cdd548cb7f0cf7815e3adcbb2) — rename | `App_PadelAmericano.html` → `App_SportPadel.html` | Renames the app to fit category-prefixed discovery conventions | First explicit taxonomy-driven file rename | Yes under new name |
| 2026-06-15 07:08 +03 | [`60dcfa1`](https://github.com/aldythsukapradja/kinetik/commit/60dcfa133918b986414dff98a416f675d6dce37a) — `Update index.html` | `index.html` | Adds server-backed Moments reactions, multi-photo upload constraints, and `apps.json` fallback discovery | Tightens the local/hosted parity of the single-file architecture | Yes |
| 2026-06-15 08:18 +03 | [`5ed855f`](https://github.com/aldythsukapradja/kinetik/commit/5ed855fc9731727bbe8b9e38d92584b8c121f2e0) — `Add files via upload` | 24 `App_*` files plus `apps.json` | Adds entertainment, games, productivity, social, sport, and learning apps | Turns a two-app shell into a broad life-app catalog | Yes; repository tip |

## Feature origin map

| Requested theme | First direct evidence in this repository | Note |
|---|---|---|
| Calendar | `5f77dd3` | Imported already framed as the source of truth |
| Family/friends circles | `5f77dd3` | Uses `circleId`, `circleType`, `personId`; explicitly rejects family-only architecture |
| AI/assistant | `5f77dd3` | “Ask” is deterministic and preview-before-apply; no external LLM integration is proven here |
| Moments | `7d17369`; real-media implementation `cf21f97` | Evolves from preview to feed/stories/create flow |
| Authentication | `5f77dd3`; live PIN/UI work `6f11cb1` | Prototype/local and Google Sheets-backed; not Supabase auth |
| Backend | `5f77dd3`, `6f11cb1`, `Code.gs` | Google Sheets/Apps Script adapter; Firebase appears only as a future migration path |
| App store | `7d17369`, manifest registry `7dcaf5d` | Separate single-file apps hosted in an iframe shell |
| Family operating system | **INFERENCE** from the combined shell | The exact phrase is not established by these 33 commits; the functions support the interpretation |
| Kinetik → KinetikCircle | Not present | The rebrand occurs later in ArgantaLab commit `e6713c9` |

## Deleted and renamed history

- The RMO World Cup implementation is overwritten rather than retained as a separate file after `5f77dd3`.
- `App_PadelAmericano.html` is renamed to `App_SportPadel.html` in `7075a30`.
- No files are deleted outright in this repository’s history.

## README and deployment evolution

- The repository never gains a conventional root `README.md` in the audited history.
- `README_BUILD_STANDARD.md` and `build.md` arrive with the Kinetik import in `5f77dd3`. They describe the single-file app contract, build conventions, and a future React/TypeScript + Firebase direction.
- That future architecture is a documented intention, not a standalone-repository milestone. The later implementation in ArgantaLab uses React/TypeScript + Supabase instead.
- PWA manifests, `PWA_SW.js`, icons, `Code.gs`, and a Google Apps Script adapter constitute the deployment/runtime evidence. Local Git and the public GitHub API both report zero tags; the API also reports zero releases.

## What the history cannot prove

- When Calendar, Ask, circles, or the family concept were originally designed before their import.
- Whether the RMO → Kinetik transition was intentional repurposing or an upload/repository mistake.
- Real users, metrics, deployment success, or production security.
- A Supabase phase or the KinetikCircle name; those belong to ArgantaLab’s later history.
