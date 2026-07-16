# C5 — Arganta Core Chat Polish: Concept + Build Plan

Status: **BUILT + verified 2026-07-16** (B1, B1b, B2, B3, B4, B7). See §6 for what
shipped, what's pending, and what was deliberately left out. Successor to C4a/C4b. Goal: close the gap between the
Arganta Core chat and Claude/ChatGPT-grade UX, and fix the C-suite analytics so the
agents answer with the RIGHT deterministic chart instead of the ARR-area fallback.

## 1. Gap audit vs Claude / ChatGPT

What we have (C4b): threads rail (`ThreadsRail.tsx`, currently swipe/sheet on mobile),
Composer, Message stream, ArtifactCard, ModelPicker, auto_recall, tool badges w/ cost,
builder-core artifacts with versions + publish.

What we're missing:

| Feature | Claude/ChatGPT reference | Us today |
| --- | --- | --- |
| Left drawer with sections | Chats / Projects / Artifacts / pinned | flat thread list, swipe-only on mobile |
| Projects (grouped threads + shared context/files) | Claude Projects | none |
| Artifact gallery | Claude artifacts list, per-artifact page | artifacts exist in builder-core but no browsable library from chat |
| Side-panel live preview ("browser") | Claude artifact pane / ChatGPT canvas | ArtifactCard renders inline only; no split pane, no URL bar, no external site |
| Image download / open full-size | hover toolbar on images | image block has no download button |
| Message actions | copy / retry / edit-and-resend / branch | none |
| Prompt starters | ChatGPT prompt chips, Claude suggestions | none |
| Rename / delete / pin thread | context menu | none |
| Search across messages | ⌘K global search | title-only filter |
| Stop generation / regenerate | stop button | none |

## 2. Concept

### 2.1 Left Drawer v2 (replaces ThreadsRail)
- Persistent collapsible drawer on desktop; slide-over sheet on mobile (keep swipe, add hamburger).
- Sections: **New chat · Search · Chats (pinned + recent) · Projects · Artifacts · Library (media)**.
- Thread row context menu: rename, pin, delete, move-to-project.
- Data: extend `core_thread` with `pinned`, `project_id`; new `core_project` table (name, emoji, system context). Offline mirror in localStorage as today.

### 2.2 Split Preview Pane ("Core Browser")
- Desktop: clicking any artifact/website/deck/game block opens a right split pane
  (55/45) with tab strip: rendered preview (sandboxed iframe, `srcdoc` or published
  URL), Code, Versions. URL bar accepts any http(s) URL → preview external
  sites/deployed apps/games (iframe; show "open in new tab" fallback when the site
  blocks framing via X-Frame-Options).
- Mobile: full-screen modal instead of split.
- This is the previewer for KinQuest/Lashira/Studio games: paste the localhost or
  Pages URL and it lives beside the chat.

### 2.3 Media blocks v2
- Image block: hover toolbar → Download (from Supabase asset bytes / data URL),
  Copy, Open full-size lightbox, "Use as reference" (sends back into composer).
- TTS block: download mp3. Every generated asset also lands in drawer → Library.

### 2.4 Artifact identity
- Every artifact gets its own page: `#/core/artifact/:id` — title, version history,
  publish state, public URL, "continue in chat" (opens a thread scoped to it).
- Drawer → Artifacts lists them (already persisted via builder-core `persist.ts`).

### 2.5 Prompt Starters popup
- Top-nav "✦ Start" button (and empty-thread state) opens a popover with category
  tabs: **Analytics · Image · Voice · Website · Deck · Offices · Brand**.
- Each tab = 4–6 pill prompts, deterministic list in `promptStarters.ts`, each pill
  pre-fills the composer (doesn't auto-send). Analytics pills map 1:1 to the real
  chart registry (§3) so every pill is guaranteed to produce a distinct chart.

### 2.6 Message actions
- Copy, Regenerate (re-run last user turn), Edit-and-resend, Stop generation
  (AbortController through the agent loop). Branching deferred.

## 3. Analytics fix — deterministic chart registry (the "wrong chart" bug)

Problem: `analyze()` in `apps/hq/src/surfaces/studios/analytics.ts` has ~5 keyword
branches and falls through to the ARR-vs-families area chart for almost anything
("analytics of my arganta stacks" → fallback). And it never touches live data.

Fix — **Chart Registry + Office routing**:
1. New `apps/hq/src/lib/core/chartRegistry.ts`: each entry = { id, office, title,
   chart type, match terms, provenance badge, `fetch(): Promise<points>` }.
   ~15–20 charts across offices:
   - **Treasury/CFO**: ARR by scenario, ARR vs families, cost ledger over time (real
     `agent_runs` cost), neuron quota burn.
   - **Operations/COO**: app usage beats per app/day (hq_engagement RPC), active
     kids, drill attempts, diamonds minted (real Supabase).
   - **Technology/CTO**: agent runs by provider/tier, error rate, latency.
   - **Portfolio**: featured games by genre, XP per world, rank ladder distribution.
2. `analyze(question)` v2: score registry entries by term overlap; ambiguous →
   return a "chart picker" block (grid of matching chart cards, click renders one)
   instead of guessing wrong. NO silent fallback to ARR.
3. Live data: registry fetchers hit the same Supabase RPCs Growth/Portfolio use;
   provenance badge (`measured` vs `modeled`) rendered on the chart block, matching
   the C-suite MCP's provenance rule.
4. `consult_office` grounding: extend GROUNDED_OFFICES beyond operations/treasury by
   giving each office its registry slice, so "ask the CTO" can answer with a real
   chart, not persona prose.
5. Realtime: chart block gets a refresh button + optional 30s auto-refresh while
   visible (rAF/interval paused when tab hidden — same gotcha as reactor preview).

## 4. Build batches (Opus)

Each batch is one Opus session, independently shippable, verified in-browser before
the next. Order chosen so the analytics fix (founder's top pain) lands first.

- **C5-B1 — Chart Registry + analyze() v2** (analytics fix, §3.1–3.3).
  Files: new `chartRegistry.ts`, rewrite `analytics.ts` picker, chart block
  provenance badge + refresh. Verify: 10 distinct questions → 10 correct charts,
  ambiguous question → picker block, zero wrong-fallbacks.
- **C5-B2 — Office grounding v2** (§3.4): registry slices per office, delegation
  blocks return charts. Verify via consult_office in chat.
- **C5-B3 — Drawer v2** (§2.1): sections, pin/rename/delete, projects table +
  migration, mobile sheet parity. Verify desktop + mobile.
- **C5-B4 — Split Preview Pane** (§2.2): artifact tabs + URL-bar external preview.
  Verify with a published artifact and a live app URL.
- **C5-B5 — Media blocks v2 + Library** (§2.3): image download/lightbox, tts
  download, Library section. Verify: generate image → download → file opens.
- **C5-B6 — Artifact pages + gallery** (§2.4): routes, drawer list, continue-in-chat.
- **C5-B7 — Prompt Starters + message actions** (§2.5–2.6): starters popover wired
  to registry, copy/regenerate/edit/stop.

Dependencies: B2 needs B1. B5/B6 need nothing from B3/B4 but drawer sections land in
B3, so B5/B6 after B3. B7 last (touches everything lightly).

## 6. What actually shipped (2026-07-16)

Built end-to-end in one pass rather than 7 separate Opus batches.

| Batch | State | Where |
| --- | --- | --- |
| B1 chart registry + analyze v2 | ✅ built + verified | `apps/hq/src/lib/core/chartRegistry.ts` (24 charts), `lib/core/tools.ts` |
| B1b real chart rendering | ✅ built + verified | `ArtifactCard.tsx` → `ChartCanvas` (exported from `studios/AnalyticsChart.tsx`) |
| B2 office grounding | ✅ built + verified | `tools.ts` `officeChart()` + `OFFICE_CHART_SLICE`; `ToolResult.extraBlocks` |
| B3 drawer v2 | ✅ built (Chats/Artifacts/Library live; Projects+pin/rename/delete need migration) | `ThreadsRail.tsx`, `lib/core/thread.ts`, `supabase/migration_core_projects.sql` |
| B4 preview pane | ✅ built + verified | `PreviewPane.tsx`, `previewBus.ts` |
| B5 media download | ✅ already existed pre-C5 | `ArtifactCard.tsx` download button |
| B6 artifact pages | ✅ delivered as drawer → Artifacts → pane (Preview/Code/Versions/Publish) — no separate route | `ThreadsRail.tsx` + `PreviewPane.tsx` |
| B7 prompt starters | ✅ built + verified | `StarterMenu.tsx`, `promptStarters.ts` |

### Verified behaviour
- The original failing question ("analytics of my arganta stacks") returns a **picker**, never the ARR chart.
- 10 distinct questions → 10 distinct correct charts across 5 chart types (bar/pie/heatmap/geo/area).
- Registry: 24 charts — 20 measured, 3 modeled, 1 planned; operations 9 / treasury 6 / portfolio 5 / technology 4.
- Offline, measured charts show the honest reason (naming the exact migration), never fake zeros.
- Every analytics starter pill provably resolves to its intended chart (self-verifying in `pillFor`).
- Preview pane loads a real dev server (localhost:5185) and artifact HTML via srcDoc with matching Code tab.

### Post-review fixes (same day, founder feedback)
- **Starter popover was clipping/overlapping its pills.** `.core-starters-pills` is a flex
  column with a `max-height`, so pills shrank below their own text height. Fixed with
  `flex: 0 0 auto` on `.core-starter-pill` (and the tabs row).
- **Starter popover hung 72px off the left edge on mobile** (right-anchored to a mid-topbar
  button). Below 640px it now pins to the viewport (`position: fixed; left/right: 8px`).
- **Mobile drawer had no visible way out** — you had to know to tap the backdrop. The sheet
  now shows a ✕ next to New chat; desktop keeps ‹ collapse. Verified both mounts.
- **Chats are grouped by date**: Pinned → Today → Yesterday → Previous 7 days → Previous 30
  days → month (with year once it isn't the current one). Buckets use LOCAL calendar days,
  so an 11pm-last-night chat reads "Yesterday", not "2h". `bucketFor`/`groupByDate` are
  exported from `ThreadsRail.tsx` and were verified against those edge cases.
- **Projects tab hidden** behind `SHOW_PROJECTS = false` in `ThreadsRail.tsx` until the
  migration is applied — the section code is intact, flip the flag when it runs.

### Pending / follow-ups
- **`supabase/migration_core_projects.sql` is NOT applied.** Until it runs: no Projects
  (tab hidden via `SHOW_PROJECTS`), no pin/rename/delete, and search stays title-only.
  The drawer distinguishes offline from missing-migration honestly.
- Message actions (copy / regenerate / edit-and-resend) were NOT built. Stop already existed.
- Artifact iframes use `allow-scripts allow-same-origin` over `srcDoc`, so generated artifact
  scripts run with HQ's origin privileges (localStorage incl. auth token). Pre-existing pattern,
  now on a wider surface — flagged for a deliberate decision, not silently changed.

## 5. Non-goals (this cycle)
- No LLM-generated charts (registry stays deterministic — LLM only routes).
- No thread branching/tree UI.
- No collaborative/multi-user features.
- No paid model changes; router/governance untouched.
