# Builder v2 — "Forge" (App Builder + Game Builder as Lovable/Base44 clones)

Status: **SHIPPED end-to-end 2026-07-16** (BR-0, GB-1…GB-7). Built + verified in
the browser. Plan below kept as the record; §7 logs what changed during the build.

## Verified (offline HQ, Stage-0 path)

| Check | Result |
|---|---|
| Page scrolls (either axis) | **No** — panes are 614px, scroll internally |
| Stage-0 game generation | valid, 7 KB, **5 ms**, 0 errors, 0 warnings |
| Game is playable | Play→state transition, score 0→7 over 32s, keyboard moves player to 26.8%, 3 lives, restart resets |
| CircleGame SDK | injected + present in the frame |
| app / website / 4 game genres | all generate, all validate |
| Block insertion | 13 app blocks offered; insert grew live canvas 18→41 DOM nodes, markup + styles |
| `create_game` via Core tool path | genre auto-classified, honest Stage-0 note returned |
| Tablet (768) | no overflow; inspector defaults closed |
| Tests | builder 45/45, worker 7/7; `tsc --noEmit` clean; prod build ✓ |

**Stage-1 (AI) verified on the live server (5178) with the proxy response stubbed:**
`stage 1`, provider `edgeProxy`, model `llama-3.3-70b-versatile`, cost $0.00021,
validation ok, markdown fences stripped, model content present. A model returning a
non-game correctly keeps the playable Stage-0 floor; a real game is accepted; the
website path is unaffected.

**Stage-1 against a real upstream is still unproven — the founder's `llm-proxy`
Supabase edge function returns a non-2xx status** (undeployed, or no server-side
key). The adapter falls back to `mock`, `generateViaAi` detects the silent mock and
honestly downgrades. Deploy the function (and set its key) and Stage-1 fires with no
code change.

Also unverifiable: rAF animation — the Browser pane reports `document.hidden:true`,
throttling rAF to 0 in **every** tab. The game loop was instead verified by stepping
the real loop with a shimmed rAF pump.

## Requires a migration before games persist

`supabase/migration_artifact_game_kind.sql` — **run this in the Supabase SQL
editor**. Until then `create_game` generates and previews fine but cannot save:
`hq_artifact.kind` has a check constraint that rejects `'game'`.

## 0. Vision

Rebuild the HQ **App Builder** and **Game Builder** from scratch as chat-driven,
Lovable/Base44-style builders. Both generate a **single self-contained HTML file**
(the frozen artifact contract). One shared shell, config-driven per kind — the
same discipline BuilderShell already proved, but for the new paradigm:

- **App Builder** = kinds `application` + `website` (the Website Builder lives
  inside it as a mode toggle — `builder-core/generate.ts` already supports both).
- **Game Builder** = kind `game` (new generation path to build).
- **Arganta Core is the caller**: chat can `create_*` an artifact and hand it off;
  the builder surface is where manual iteration happens ("Open in Builder").
- **Single non-scrollable page**: the whole surface is a fixed viewport grid
  (chat rail · preview canvas · inspector), panes scroll internally only.
- Everything existing (BuilderShell wizard: Catalogue/Studio/Analytics) moves
  behind a **Legacy** tab, untouched — same pattern as Music/Content Builder.

## 1. Reuse map (what exists → where it's used in v2)

| Existing asset | Location | Reuse in v2 |
|---|---|---|
| Builder tool specs (9, frozen) | `packages/builder/src/tools.js` | As-is. Add ONE spec: `create_game`. |
| `validateHtml` gate | `packages/builder/src/validate.js` | As-is; add `kind:'game'` rules (canvas/loop present, no external src). |
| Prompt builder | `packages/builder/src/prompts.js` | Extend with game prompt contract (reuse `STARTER_PROMPT` + `PROMPT_CATEGORIES` genre hints from `apps/hq/src/data/starterPrompt.ts`). |
| Portable block registry (~20 blocks) | `packages/builder/src/registry.js` + `docs/arganta-core/blocks/` | As-is for app/website hints (`selectComponents`); wire `COMPONENT_REGISTRY` in `generate.ts` (currently `[]` — one-line fix, BR-0). |
| Stage-0/Stage-1 generation + revise | `apps/hq/src/builder-core/generate.ts` | As-is for app/website. Add `generateGame()` + `gameShell.ts` Stage-0 (deterministic playable stub: canvas, loop, score, CircleGame SDK). |
| Persistence + versions + publish | `apps/hq/src/builder-core/persist.ts` | As-is for all three kinds (add `kind:'game'` to the union + publish route). |
| Core tool wiring | `apps/hq/src/lib/core/tools.ts` EXECUTORS | As-is; register `create_game` executor. |
| Deterministic website engine | `apps/hq/src/surfaces/studios/engines.ts` `makeWebsite/makeBrand` | Already the website Stage-0 floor. Untouched. |
| Brand kits | `packages/brand` + `apply_brand` tool | Inspector "Brand" panel calls the same executor. |
| Device preview iframe | `apps/hq/src/surfaces/builders/shared/DeviceCanvas.tsx` | Port (sandboxed iframe, desktop/tablet/phone, Circle SDK bridge injection) into the new shell. |
| Catalogue/Studio/Analytics pages | `apps/hq/src/surfaces/builders/*` | Frozen → rendered under the Legacy tab. Zero edits. |
| Publish targets | `live.publishGame` / `live.saveApp` (Kinetik catalogue) + `publishArtifact` (build.arganta.app) | Both offered at Ship step: "Publish to ArgantaLab/Kinetik" and "Publish to the web". |
| Core artifact card | `apps/hq/src/surfaces/core/ArtifactCard.tsx` | Add "Open in Builder" action → deep-link seam. |

## 2. Benchmark — each tab vs Base44 & Lovable

Scope note: both references generate multi-file React apps with hosted backends;
our contract is a governed single-file HTML artifact. The clone target is the
**experience loop** (prompt → live app → chat iterations → versions → publish URL),
not their stack.

### App Builder (incl. Website mode)

| Capability | Lovable | Base44 | Builder v1 (legacy) | Builder v2 target |
|---|---|---|---|---|
| Prompt → working app | ✅ | ✅ | ❌ manual copy/paste | ✅ `create_application` / `create_website` (built) |
| Chat iteration ("make the header blue") | ✅ | ✅ | ❌ | ✅ `revise_artifact` (built) via chat rail |
| Live preview w/ device frames | ✅ | ✅ | ✅ DeviceCanvas | ✅ ported, auto-refresh per version |
| Version history / restore | ✅ | ✅ | ❌ | ✅ `save_version`/`restore_version` (built) — needs UI |
| Templates / starters | ✅ | ✅ | ✅ APP_TEMPLATES | ✅ starter gallery on empty state |
| Element-select edit ("edit this") | ✅ (visual edits) | partial | ❌ | ✅ P2: iframe click→selector→scoped revise instruction |
| Built-in DB/auth | ✅ Supabase | ✅ built-in | CircleApp SDK | CircleApp SDK (save/me/ready) — our moat, keep |
| Publish to URL | ✅ | ✅ | ❌ (catalogue only) | ✅ `publish_artifact` → build.arganta.app (built) |
| Code view/edit | ✅ | ✅ | paste-only textarea | ✅ read/edit code pane (manual mode) |
| Component/block library | internal | internal | ❌ | ✅ 20 portable blocks + `insert_component` (built) |
| Brand theming | ❌ | ❌ | ❌ | ✅ `apply_brand` + Brand OS — differentiator |
| Website mode | ✅ (same flow) | ✅ | separate deterministic engine only | ✅ mode toggle, same shell |

### Game Builder

| Capability | Lovable | Base44 | Builder v1 (legacy) | Builder v2 target |
|---|---|---|---|---|
| Prompt → playable game | partial (it's app-generic) | partial | ❌ copy/paste | ✅ NEW `create_game` (Stage-0 playable stub → Stage-1 AI) |
| Genre starters | ❌ | ❌ | ✅ PROMPT_CATEGORIES | ✅ genre gallery (reuse categories; later: Arganta Studio v2 15-genre specs) |
| Chat iteration | ✅ | ✅ | ❌ | ✅ `revise_artifact` (kind-aware prompt) |
| Playtest preview | ✅ | ✅ | ✅ DeviceCanvas | ✅ + focus/keyboard capture for gameplay |
| Versions / publish URL | ✅ | ✅ | ❌ | ✅ same built spine |
| Leaderboard/save SDK | ❌ | ❌ | CircleGame SDK | ✅ CircleGame SDK asserted in validation — differentiator |
| Age classification + circle scope | ❌ | ❌ | ✅ | ✅ kept in Ship step (drives analytics) |
| Asset pipeline (sprites) | ❌ | ❌ | ❌ | P3: PixelLab MCP seam — out of v2 scope, note only |

Verdict: after v2, both tabs match the Lovable/Base44 core loop; we exceed them on
governance (validation gate, provenance, publish approval), brand kits, Circle
SDK backend, and game-specific classification. We stay behind on multi-file
projects and real code-level agents — accepted, single-file is the contract.

## 3. Surface design — one non-scrollable page

Fixed grid, `height:100%`, `minHeight:0` everywhere; only panes scroll.

```
┌──────────────────────────────────────────────────────────────┐
│ Header: name · kind pill (App|Website / Game genre) · version │
│         chip · Validate ● · Ship ▸        [Legacy] tab switch │
├───────────────┬───────────────────────────────┬──────────────┤
│ CHAT RAIL     │ CANVAS                        │ INSPECTOR    │
│ (Arganta Core │ sandboxed iframe, device      │ (collapsible)│
│ mini-loop,    │ frames, Run/reload, playtest  │ · Versions   │
│ same runtime, │ focus mode for games          │ · Blocks     │
│ builder tools │                               │ · Brand      │
│ only)         │                               │ · Code view  │
│ [composer]    │                               │ · Ship       │
└───────────────┴───────────────────────────────┴──────────────┘
```

- Empty state = starter gallery (templates/genres) + a big prompt box, Lovable-style.
- Chat rail reuses the C3/C4 Core agent loop (`lib/core`) with the tool list
  filtered to builder tools + scoped to the open artifact — NOT a second chat
  implementation.
- Ship step: validation report → choose catalogue publish (Kinetik, circle scope,
  age bands — port fields from StudioPage) and/or web publish (publish_artifact,
  explicit founder confirm).
- Legacy tab renders the untouched v1 `BuilderShell`.

## 4. Core-chat ↔ Builder seam

1. Core chat already creates artifacts via `create_application`/`create_website`
   (and `create_game` after GB-2) — persisted by `persist.ts`, so they're the
   SAME rows the builder opens.
2. `ArtifactCard` in Core gets an **Open in Builder** button →
   `setSurface('builder-app'|'builder-game')` + `setStudioId(artifactId)`.
3. Builder loads that artifact; chat rail continues iteration with full history
   of versions. Reverse link: builder header "Discuss in Core" opens a thread
   seeded with the artifact id.

## 5. Build batches (Opus handoff)

Each batch is independently shippable; verify in the browser after each.

- **BR-0 · Registry wire-up (15 min)** — `builder-core/generate.ts`: replace
  `COMPONENT_REGISTRY: any[] = []` with `PORTABLE_REGISTRY` from
  `@arganta/builder`. Blocks start hinting generation immediately.
- **GB-1 · Game contract (package)** — `@arganta/builder`: add `create_game`
  ToolSpec (same shape, sideEffect:false), game prompt in `prompts.js`
  (single-file, canvas, loop, CircleGame SDK, genre hint param), game rules in
  `validate.js`. Cross-package shape test like the existing one.
- **GB-2 · Game engine (app)** — `builder-core/gameShell.ts` deterministic
  Stage-0 playable stub + `generateGame()` in `generate.ts` (mirror
  `generateApplication`); `persist.ts` kind union + publish route; register
  executor in `lib/core/tools.ts`. Core chat can now build games.
- **GB-3 · Forge shell (UI)** — new `apps/hq/src/surfaces/forge/` :
  `ForgeShell.tsx` (config-driven, kinds app|website|game), non-scrollable grid,
  ported DeviceCanvas, empty-state starter gallery, header. v1 moves behind
  Legacy tab. Route both nav entries here.
- **GB-4 · Chat rail** — embed the Core agent loop scoped to the open artifact
  with builder tools only; streaming, block rendering of new versions into the
  canvas (auto-reload on accepted revision).
- **GB-5 · Inspector** — Versions (list/restore/diff-size), Blocks
  (insert_component picker from registry), Brand (apply_brand from Brand OS
  kits), Code view with manual edit → `save_version`.
- **GB-6 · Ship** — validation report UI, Kinetik catalogue publish (port
  StudioPage fields: category, tags, age bands, circle scope, featured) + web
  publish w/ confirm; "Live" state + URL chip.
- **GB-7 · Core seam** — ArtifactCard "Open in Builder", builder "Discuss in
  Core", starter-menu entries in Core (promptStarters.ts) for "Build me an
  app/website/game".
- **P2 (later)** — element-select edit (iframe click → CSS selector → scoped
  revise), game asset seam (PixelLab), Arganta Studio v2 15-genre spec import.

Order: BR-0 → GB-1 → GB-2 (Core is fully the caller) → GB-3..6 (surface) → GB-7.

## 7. What changed during the build (deviations + discoveries)

**Deviation — the chat rail does NOT embed the Core agent loop.** The plan said to
reuse @arganta/agent's tool-calling loop in the rail. It doesn't, deliberately:
in the Forge the intent is already known (empty canvas ⇒ build, loaded artifact ⇒
revise) and the kind is an explicit toggle, so asking a model to *pick the tool*
would add a model dependency, a failure mode, and latency to a decision that is
deterministic — and would make the builder unusable offline, where Stage-0 still
produces a real artifact. `useForge.ts` calls builder-core directly. Arganta Core
keeps the agent loop, which is the right place for it (there the intent genuinely
is ambiguous). Both paths converge on the same `hq_artifact` rows.

**Three things gated `game` out of the database/runtime** — each would have failed
a real `create_game` at INSERT rather than degrading. All fixed together in
`migration_artifact_game_kind.sql` + the worker: (1) `hq_artifact.kind` check
constraint, (2) `artifact_publication.kind` check constraint, (3) the reserved-slug
denylist (a game slugged `g` would shadow the new `/g/:slug` route, the same reason
`a`/`w` are reserved). Worker `parseRoute` now serves `/g/:slug`.

**Pre-existing bug found and fixed: Stage-1 could never fire, for anyone.**
`generate.ts` selected from `intelligenceRegistry` (built with `webllm: true`,
because it's shared with `intelligence.ask()`, whose runtime really does configure
web-llm) and then called `ai.chat` — a *different* runtime, created with
`const WEBLLM = null`, i.e. no browser tier at all. Task `copy` bands at [0,2] and
browser models are costClass 0, so the cheapest-capable rule picked an unservable
`webllm:Qwen3.5-0.8B` **every single time** → `ai.chat` silently fell through to
`mock` → `generateViaAi` caught the mock and returned null → Stage-0. Every
`create_website`/`create_application` since B2 has therefore been the deterministic
template, on machines with a live edge proxy. Fixed by selecting only from models
this caller can actually serve (`CALLABLE_REGISTRY`, excluding `execution:'browser'`)
— proven: the pick moves from `webllm:Qwen3.5-0.8B` (unservable) to
`edgeProxy:llama-3.3-70b-versatile` (`external-api`, routeAllowed). Enabling web-llm
instead was rejected: its first call downloads ~1.6GB, which lib/ai.ts explicitly
says must never happen silently.

**Design flaw found via the stubbed Stage-1 test: a non-game was accepted as a game.**
`generateGame` accepted Stage-1 on `validation.ok` (errors only), so a model
returning a page with no canvas and no loop replaced a working Stage-0 game. The
playability checks stay warn-level in the *gate* (safety, not fun), but the
*acceptance* bar is now higher: `isActuallyPlayable()` requires the three structural
checks (surface/loop/input) before Stage-1 may displace the playable floor. Touch
and restart stay advisory — a flaw you can ask the chat to fix on top of a real game,
vs. no game to fix at all.

**Pre-existing bug found and fixed: `makeBrand` was broken for ~half of all briefs.**
`engines.ts` line 30 used the *signed* shift `>> 3` on a value `hash()` returns as
an *unsigned* 32-bit int. Any brief whose hash has the high bit set went negative,
and a negative JS modulo stays negative → `FONT_PAIRS[-2]` → `undefined` → every
engine downstream died with "cannot read 'body' of undefined". 5 of 8 realistic
briefs hit it ("a snake game", "an expense tracker", "my portfolio", "a racing
game", "tower defense"). This was silently breaking Core's `make_website`/
`make_deck`/`make_brand` and the Stage-0 app shell, not just the new game path.
One-character fix (`>>>`). apps/hq has no unit-test harness, so it is covered by
in-browser verification across 10 briefs rather than a test file.

**Game pacing was tuned against a simulation, not by eye.** The first draft used
`fallSpeed 0.16/s` — an object took ~6s to cross the board and the first catch
landed 11s in, which reads as broken. Stepping the real loop with a shimmed rAF
pump showed it; retuned to `0.44` (fall ≈2.2s, first catch ≈2.8s).

**Game validation checks are warn-level, not error-level, by design.** An
unplayable game is a quality failure, not a security one; the error gate exists to
keep unsafe HTML off the public runtime, not to referee fun. Games are still held
to the identical security gate (asserted by a test).

## 6. Gotchas for Opus

- `validateHtml` is the ONLY acceptance gate — never accept model output on its
  own claim; Stage-0 is always the honest floor (existing discipline, keep it).
- `publish_artifact` is the sole sideEffect:true tool (ADR-0005) — the Ship UI
  must be an explicit human click, never fired from the chat rail autonomously.
- Non-scrollable page: root grid needs `minHeight:0` on every row/child or the
  chat rail overflows the viewport (same fix as ArgantaCore.tsx).
- Game iframe needs `allow` keyboard focus + `tabindex` handling or arrows
  scroll the host page during playtest.
- Don't touch `apps/hq/src/surfaces/builders/*` (legacy) beyond mounting it
  under the Legacy tab.
- Commits go to `main` only.
