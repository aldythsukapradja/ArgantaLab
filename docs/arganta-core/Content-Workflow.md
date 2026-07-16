# Arganta Content Workflow — the three generation paths

**Status:** conceptual design, grounded in the shipped + battle-tested pipeline (2026-07).
Everything in §1–§3 that is marked ✅ exists and was verified live; ◻ is designed here, not built.

## 0. The one architecture under all three paths

Every path is the SAME four-stage pipeline; the paths differ only in *who drives each stage*:

```
BRIEF ──▶ GENERATION ──▶ COMPOSITION ──▶ DESTINATION(S)
 (intent)   (copy+images)   (branded slides)   (Moments / Buffer→IG / …)
```

| Stage | Canonical owner | Contract (the agnostic seam) |
|---|---|---|
| Brief | human or Claude Code | plain-English string + options (`format`, `palette`, `platform`, `slideCount`) |
| Generation | **Cloudflare Worker** `arganta-core-content` | `POST /v1/generate` → `COPY_SCHEMA` JSON + image bytes. Model-agnostic: `TEXT_MODEL`/`IMAGE_MODEL` are vars — swap Llama→anything without a code change |
| Composition | **HQ Post Studio canvas** (postEngine) | `coercePost(copy)` → PostDoc → rendered slide blobs. The ONLY stage that needs a browser today |
| Destination | **publish seams** | `momentPublish.ts` (Kinetik), `/v1/buffer/publish` (Buffer→IG). Channel-agnostic: Buffer metadata keyed by `channelService`, so TikTok/LinkedIn channels connect with zero worker changes |

**Future-proofing rules (hold these invariant):**
1. Stages talk ONLY through the contracts above — never reach around them.
2. New models = env vars on the worker. New destinations = new publish seam behind the same worker. New entry points (cron, agents, another app) = new *drivers* of the same stages, never new pipelines.
3. Anything that reaches a real audience defaults to a **human review gate** (Buffer queue / HQ Drafts inbox), and Claude Code can never bypass it (`shareNow` is unreachable at the type level).

## 1. Path A — HQ solo (cheap LLM) ✅ SHIPPED

You in HQ, worker LLM does the thinking, canvas does the polish.

```
HQ Arganta Core panel ──/v1/generate──▶ copy + images ──▶ canvas (edit/drag/dbl-click)
   └─▶ Publish to Moment ✅   └─▶ Send to Buffer → IG ✅ (queue-gated)
```
Cost: ~free (Workers AI 10k neurons/day). Best for: quick posts, full visual control.

## 2. Path B — Claude Code solo ✅ SHIPPED (with a known composition gap)

You in the terminal; MCP tools drive generation + destination directly.

```
content_draft ──▶ worker ──▶ draft row + images ──▶ HQ Drafts inbox (open→canvas) ✅
buffer_publish(draftId) ──▶ Buffer queue ✅  ⚠ sends RAW generated images (no branded
                                               composition — headless, no canvas)
```
Best for: authoring while coding, batch briefs. The gap: skipping HQ = skipping Composition.

## 3. Path C — Hybrid (Claude Code → HQ LLM → Moments + Buffer) ✅ SHIPPED

Claude Code writes the *intent*; HQ executes generation AND composition AND publishes to
both destinations — with you approving once, not babysitting each step.

**Design: publish intents on the draft (no new infra — extend `content_draft`):**
```sql
alter table content_draft add column publish_to jsonb default '[]';
-- e.g. [{"dest":"moment","circleId":"..."},{"dest":"buffer","channelId":"...","mode":"addToQueue"}]
```
1. Claude Code: `content_draft("brief…", publishTo:[…])` — records intent, publishes nothing.
2. HQ Drafts inbox shows intent badges ("→ Moment · → Buffer"). You open the draft; it lands
   composed on the canvas as today.
3. ONE new button: **"Approve & publish everywhere"** — renders the *composed* slides once,
   then fans out to every intent via the existing seams (`publishMoment` + `publishToBuffer`).
4. Claude Code polls `content_status` → sees `published_to` results (post ids) written back.

Human gate preserved (you click once in HQ), composition included (canvas renders), and it's
pure orchestration of shipped parts — no new engines.

**Later (Path C fully headless, only if ever needed):** a headless composer — either
`@vercel/satori`+resvg re-implementing postEngine layouts server-side, or a scheduled
Playwright/browser-rendering worker that opens HQ and drives the same canvas. Explicitly out
of scope until intent-based publishing proves insufficient.

## 4. Battle-test log (why the contracts look like this)

Every rule above was paid for with a real failure this week:
| Failure (live) | Lesson baked into the design |
|---|---|
| `llama-3.1-8b-instruct` deprecated mid-integration | models are env vars, never hardcoded |
| SDXL-base broken server-side; Lightning returns JPEG while claiming PNG | sniff real bytes; never trust catalog metadata |
| dims must be ÷8; IG needs JPEG not PNG; ≤10 images; MP4 only | destination constraints live in the seam (worker validates), not in callers |
| CORS silently downgraded to edgeProxy (twice) | trusted-origin patterns (localhost/\*.arganta.app/\*.vercel.app), not port lists |
| `p_tags` uuid[] rejected hashtag strings → whole moment rolled back | loud error surfaces (modals), never tiny status lines |
| IG metadata `type` required; then `carousel` enum value ALSO rejected | introspect + live-test every third-party contract; schema ≠ acceptance |
| tiny model ignores "3 slides" | prompt hint + deterministic clamp in the app — belt and braces |

## 5. Build order for Path C — SHIPPED 2026-07-16 (Sonnet)
| # | Step | Size | Status |
|---|---|---|---|
| C-1 | `publish_to`/`published_to` columns + MCP `publishTo` arg on `content_draft` | S | ✅ `migration_content_drafts_publish_intents.sql` (run this in Supabase SQL editor — additive, no exec-sql RPC exists to run it for you); `content_draft` tool gained `publishTo` (zod union, `shareNow` excluded at the schema level) |
| C-2 | Drafts inbox intent badges + "Approve & publish everywhere" button (fan-out) | M | ✅ `PostStudio.tsx`: `activeDraft` tracks the open draft, intent badges in the draft list, gradient approve button (shows remaining count, "All published ✓" once done), per-destination result modal (success/fail rows, never blocks other destinations). Renders PNG→moments (private bucket) and JPEG→Buffer (public bucket) SEPARATELY per §0's invariant |
| C-3 | Write-back of results; `content_status` shows them to Claude Code | S | ✅ Free — `getDraft`/`listDrafts` already `select('*')`/now include `publish_to`/`published_to`, no new code needed beyond adding the columns to `listDrafts`' select |

All three typecheck clean (HQ + MCP), worker tests 27/27, UI verified in browser (CSS renders correctly: gradient approve button, intent badges, success/fail row styling). **Founder step required:** run `migration_content_drafts_publish_intents.sql` in the Supabase SQL editor before Path C works end-to-end.
