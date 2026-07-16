# Arganta Core → Buffer → Instagram — Integration Plan

**Goal.** Publish content from **Claude Code → HQ → Buffer → Instagram**. HQ already
renders carousel slides to public Supabase URLs and can generate them with Arganta Core;
this plan adds a "Send to Buffer" path so a finished post lands in your Buffer queue (and
from there to Instagram).

## What Buffer's API actually is (verified 2026-07)
- **GraphQL**, single endpoint `POST https://api.buffer.com`, `Authorization: Bearer <token>`.
- Create a post:
  ```graphql
  mutation { createPost(input: {
    text: "caption + #hashtags"
    channelId: "<instagram channel id>"
    schedulingType: automatic
    mode: addToQueue           # queue for review; other modes publish/schedule
    assets: [{ image: { url: "https://…public…/slide-1.png" } }, …]
  }) { ... on PostActionSuccess { post { id } } ... on MutationError { message } } }
  ```
- **Carousel** = multiple `assets`. Instagram cap via any 3rd-party API is **10 images**,
  **images only** (no mixed media), and all cropped to the **first image's aspect ratio** —
  our 4:5 export is already uniform, so that's fine.
- Media must be a **publicly reachable URL**. HQ already uploads rendered PNGs to the public
  `video-assets` bucket (that's how Export/Publish-to-Moment work) — reuse it verbatim.

## Hard constraints / risks (read before building)
1. **Instagram must be a Business/Creator account connected to Buffer** for true
   auto-publish. Personal IG accounts only get "reminder" notifications, not API publish.
2. The **Buffer token is server-side only** — it must NEVER be a `VITE_` var (those ship in
   the browser bundle) or land in git. It lives as a Worker **secret**, exactly like CORE_TOKEN.
3. Publishing to a real social account is an outward-facing action → **default to
   `addToQueue`** (lands in Buffer for a human to review/approve), with an explicit opt-in
   for publish-now. Never auto-fire to IG without a confirm.
4. Buffer plan limits (channels, queued posts) and API rate limits apply.

## Architecture
Reuse the **existing deployed Worker** `workers/arganta-core-content` (it already has CORS =
any-localhost + hq.arganta.app, bearer auth via CORE_TOKEN, and a deploy pipeline). Add two
routes and one new secret — no second worker to manage:
- `GET  /v1/buffer/channels`  → lists connected channels (id, service, name) so HQ can show
  a picker and find the Instagram channel id.
- `POST /v1/buffer/publish`   → body `{ channelId, text, imageUrls[], mode }` → calls Buffer's
  GraphQL `createPost`, returns `{ ok, postId }` or a real error.
- New secret **`BUFFER_TOKEN`** (`wrangler secret put BUFFER_TOKEN`), separate from CORE_TOKEN.

Flow end-to-end:
```
Claude Code ──content_draft──▶ HQ Drafts inbox ──edit──▶ Post Studio
      │                                                      │
      │                                   render slides → video-assets bucket (public URLs)
      │                                                      │
      └──(optional MCP buffer_publish, phase 2)              ▼
                                          HQ ──/v1/buffer/publish──▶ Worker ──GraphQL──▶ Buffer
                                                                                          │
                                                                                    Instagram (queue→publish)
```

## Opus batches

| # | Batch | Deliverable | Done-when |
|---|-------|-------------|-----------|
| ✅ BF1 | Worker Buffer proxy | `workers/arganta-core-content/buffer.js` (pure GraphQL builders + validation, 8 tests) + `/v1/buffer/channels` (GET) and `/v1/buffer/publish` (POST) in src/index.js; `BUFFER_TOKEN` secret set + deployed. **Verified live**: channels returns the real **argantalab** IG **Business** channel | ✅ `curl …/v1/buffer/channels` returns argantalab (publish route built + unit-tested, not fired) |
| ✅ BF2 | HQ Buffer client + Post Studio "Send to Buffer" | `apps/hq/src/lib/bufferClient.ts` (listBufferChannels, publishToBuffer; worker-first, ledger row domain `social`). Post Studio: gradient "Send to Buffer" button + channel picker + **Queue/Next slot/Now** toggle (real ShareMode enums), renders ≤10 slides → **public** video-assets bucket → Buffer, Instagram-gradient success modal w/ "Open Buffer" link | ✅ button + modal render (verified offline); channels endpoint live-verified. First real publish is the founder's (external write) |

## Sonnet batches

| # | Batch | Deliverable | Done-when |
|---|-------|-------------|-----------|
| ✅ BF3 | Video Builder "Send to Buffer" | Added `createPostMutation`/`parsePublishBody` video-asset path in `buffer.js` (mutually exclusive w/ imageUrls, MP4-only guard client-side), `publishVideoToBuffer()` in `bufferClient.ts`, full picker/mode-toggle/success+error modals in VideoBuilder mirroring Post Studio. `saveRender`'s public URL now retained on `lastRender` for Buffer. | ✅ Button renders, disabled until export; gradient modals verified. 26/26 worker tests |
| ✅ BF4 | Claude Code → Buffer | `buffer_channels` + `buffer_publish` MCP tools (`tools.ts`/`core.ts`). **Hard safety**: `McpBufferMode` type only allows `addToQueue`\|`shareNext` — `shareNow` isn't reachable from Claude Code at the type level, not just a default. Sends per-slide `imageUrl`s (raw generated images — documented limitation: no HQ canvas composition headless) | ✅ `buffer_channels` live-tested via MCP, returns real argantalab channel. `buffer_publish` NOT fired (real write — founder's call) |
| ✅ BF5 | Status, ledger, deploy, docs | Buffer calls already log via `logAgentRun(runRecord({domain:'social',...}))` in both clients — Model Rack's feed is domain-agnostic so these show up with no extra code. MCP README updated (tools table, safety/limitation notes, flow diagram). Worker deployed with video-asset support | Model Rack shows real `buffer:*` task rows once a real publish runs |

### Founder prerequisites (only you can do)
1. In Buffer, connect the target **Instagram Business/Creator** account and confirm it's
   eligible for direct publishing (not reminder-only).
2. `cd workers/arganta-core-content && wrangler secret put BUFFER_TOKEN` (paste the Buffer
   API token — kept server-side, never committed).
3. `wrangler deploy`.
4. (For Claude→Buffer automation, BF4) give the MCP the same worker URL it already uses.

### Suggested order
BF1 → BF2 (you get Claude→HQ→Buffer→IG for carousels end-to-end here) → BF3 → BF4 → BF5.

## Open questions to confirm during BF1 (against the live token)
- Exact `channels` query field names + the Instagram channel's `service` value.
- The exact `mode` enum value that means "publish immediately" vs "add to queue" vs "schedule".
- Whether IG carousel via this API wants N `assets` in one `createPost` (expected) or a
  different grouping — will verify with a real 2-image test post to the queue.
