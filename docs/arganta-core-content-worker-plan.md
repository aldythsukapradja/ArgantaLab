# Arganta Core Content Engine — Cloudflare Worker Workplan

**Goal.** Make the Content Builder (Post Studio) and Video Builder genuinely powered by a
Cloudflare Worker: the in-surface "Copilot"/"Director" chat becomes **Arganta Core**, and it
generates real content — copy (headline/body/caption/hashtags) **and static background
images** — via Cloudflare Workers AI, with full context of the post being designed.
Output is Instagram-ready (exact 1080×1350 / 1080×1080 / 1080×1920 render, safe zones,
per-platform caption limits) and can be published as a **Moment in KinetikCircle**.

**Scope now:** generated static images + text only. No generated video/audio yet — the
Video Builder keeps its deterministic engine for motion; Arganta Core supplies script,
copy, and generated still layers/posters.

---

## Architecture (one paragraph)

A new Worker `workers/arganta-core-content` (same shape as `workers/build-artifact-runtime`)
exposes `POST /v1/generate` with two kinds: `copy` (Workers AI text model → strict JSON
matching `POST_SCHEMA` / video script schema, given full doc context) and `image`
(Workers AI image model, e.g. flux-1-schnell / SDXL, returns PNG bytes at requested
aspect). CORS-gated to HQ origins, bearer token as a Worker secret. HQ gets a thin client
`apps/hq/src/lib/argantaCoreClient.ts`; Post Studio's `runCopilot` and Video Builder's
Director route worker-first, falling back to the existing `ai.chatJSON` → local draft chain
(nothing ever hard-fails offline). Publishing to Kinetik reuses the existing
`kinetik_post_moment` RPC + `moments` bucket from HQ (same Supabase project): render slide
PNGs → upload to `moments/{circle}/{uuid}/i.png` → RPC. Every generation logs through
`logAgentRun` so the Model Rack/ledger stays truthful.

---

## Opus batches (design + hard integration)

| # | Batch | Deliverable | Key files | Done-when |
|---|-------|-------------|-----------|-----------|
| ✅ O1 | Worker contract + skeleton | `workers/arganta-core-content`: wrangler.toml (AI binding, secret `CORE_TOKEN`), `POST /v1/generate` routing `copy`/`image`, CORS allowlist, error envelope, cost/provenance fields (`provider/model/latencyMs`), unit tests like `router.test.js` | `workers/arganta-core-content/*` | `wrangler dev` returns valid copy JSON + a real PNG locally |
| ✅ O2 | Context protocol | Define the **context payload** each surface sends (current doc: format, palette, slides+text, platform, brand kit; video: scenes/script) and the strict output schemas (post carousel schema reusing `POST_SCHEMA`, image brief schema, video script schema). Prompt templates live in the Worker | `workers/arganta-core-content/src/prompts.js`, `docs/arganta-core/` contract note | Schema-validated round trip for both builders |
| ✅ O3 | HQ client + Arganta Core rebrand | `lib/argantaCoreClient.ts` (worker-first, honest fallback, `logAgentRun` sink); rename Copilot→**Arganta Core** in Post Studio UI (panel, icon, copy) and Video Builder Director; wire `runCopilot` → worker copy+image pipeline (generated bg image placed as slide background layer) | `apps/hq/src/lib/argantaCoreClient.ts`, `PostStudio.tsx`, `VideoBuilder.tsx` | Prompt → real generated slides w/ generated bg images in the canvas |
| ✅ O4 | Kinetik Moments publish seam | Shared publisher `apps/hq/src/lib/momentPublish.ts`: render all slides → upload to `moments` bucket → `kinetik_post_moment` (kind `photo`, carousel = multi-media); circle picker (operator's circles), audience default `circle`; confirm-before-post UI. **UI: "Publish to Moment" is the primary button next to Export; "Send to feed" (HQ Discover broadcast — a different pipeline, kept) moves to a secondary ⋯ menu** | `momentPublish.ts`, `PostStudio.tsx` | A post designed in HQ appears in Kinetik → Remember feed |
| ✅ O5 | Claude Code MCP bridge | Stdio MCP server `tools/arganta-core-mcp` (`content_draft`, `content_list`, `content_status` tools): brief from Claude Code → calls the Worker for copy JSON + images → writes a full PostDoc draft to new `content_drafts` Supabase table (migration + RLS, operator-only); images stored in the media library so the doc is canvas-ready | `tools/arganta-core-mcp/*`, `supabase/migration_content_drafts.sql` | `content_draft "5 slides about ocean animals"` from Claude Code produces a row with a valid PostDoc |
| ✅ O6 | Instagram-ready pass (was S1) | Exact-size export presets (4:5/1:1/story), safe-zone guides on all formats, caption composer enforcing `CAPTION_RULES` (limit, hashtag count, first-line hook), alt-text field, "IG-ready" checklist chip | `postEngine.ts`, `PostStudio.tsx` | Checklist all-green produces a compliant 1080×1350 PNG + caption |
| ✅ O7 | Image tooling in Arganta Core panel (was S2) | "Generate image" action inside the panel (prompt from slide context, aspect auto from format), regenerate/variant buttons, store generated PNGs to the Supabase media library (`uploadAsset`) so they persist + stay same-origin for export | `PostStudio.tsx`, `argantaCoreClient.ts` | Generated image survives reload + exports untainted |

**Opus did O1→O7 end to end. Sonnet batches below are ALSO shipped (all typecheck-clean, worker tests 15/15, spot-verified offline).**

## Sonnet batches (implementation grind)

| # | Batch | Deliverable | Key files | Done-when |
|---|-------|-------------|-----------|-----------|
| ✅ S3 | Video Builder: Arganta Core integration | Director→Arganta Core rename; `runCore` calls Arganta Core's copy endpoint, maps slides→scenes (`copyToStoryboard`), generates a background image per scene (`generateSceneImages`), falls back to the free storyboard chain honestly | `apps/hq/src/surfaces/video/VideoBuilder.tsx`, `video.css` | Prompt → scripted video with generated still backgrounds, MP4 export works |
| ✅ S4 | Video → Kinetik moment | "Publish to Moment" button + circle-picker popover next to Export; reuses `momentPublish.ts` with the last exported blob (`kind:'video'`) | `VideoBuilder.tsx` | Video moment plays in Kinetik feed |
| ✅ S5 | Ledger + rack visibility | `argantaCoreClient.ts`'s `log()` now emits a real `runRecord()` (domain `media`, task `arganta-core:copy\|image`, actualProvider/actualModel/status) so the Rack shows truthful rows, not blanks; Worker `GET /v1/quota` + `getCoreQuota()` + a Model Rack KPI tile | `argantaCoreClient.ts`, `ModelRack.tsx`, `workers/arganta-core-content/src/index.js` | Model Rack shows real worker runs + a quota tile |
| ✅ S7 | Drafts inbox in Post Studio | `contentDrafts.ts` (poll-based — no realtime channel exists elsewhere in HQ) + "Drafts" button with unread badge + popover list; `openDraft()` runs the same `coercePost` Arganta Core uses, then zips in per-slide `imageUrl`s; marks `consumed_at` | `apps/hq/src/lib/contentDrafts.ts`, `PostStudio.tsx`, `post.css` | MCP-created draft opens on canvas and is fully editable |
| ✅ S6 | Deploy + docs | `workers/arganta-core-content/README.md`: local dev, deploy steps (enable Workers AI, generate+set `CORE_TOKEN`, `wrangler deploy`, optional custom domain), HQ env vars, config reference table, curl verification | `workers/arganta-core-content/README.md` | Production HQ generates via the deployed Worker (founder still runs the actual deploy) |

### Founder prerequisites (can't be done by the model)
1. Cloudflare account: enable Workers AI, `wrangler deploy`, `wrangler secret put CORE_TOKEN`.
2. Set `VITE_ARGANTA_CORE_URL` (+ token) in HQ envs.
3. Operator account must be a member of the target Kinetik circle for moment publishing.

### Suggested order
Opus: O1 → O2 → O3 → O6 → O7 → O4 → O5.  Then Sonnet: S7 → S3 → S4 → S5 → S6.

### MCP flow (Claude Code → HQ)
1. You describe the content in Claude Code → `content_draft` tool.
2. MCP calls the Cloudflare Worker: copy JSON (POST_SCHEMA) + generated static images.
3. MCP writes a complete PostDoc draft to `content_drafts` (images already in the media library).
4. Post Studio's Drafts inbox surfaces it → open → edit anything on the canvas.
5. Export PNGs, or **Publish to Kinetik Moment** (primary button; Send-to-feed lives in the ⋯ menu).
