# ArgantaStudio — Master Plan (Opus Execution Handoff)

**Higgsfield-grade AI media studio + 5-platform social command center, built on the Open-Generative-AI base in `apps/studio`.**
*2026-07-21. Companion to [concept-hardening-plan.md](concept-hardening-plan.md) (12-gap audit). This doc adds: the social-publishing research, the architecture verdict, and the batch-by-batch plan Opus executes.*

---

## Part 1 — Publishing research findings (cited)

### 1.1 Buffer: what it can and cannot do (2026)

| Capability | Status | Source |
|---|---|---|
| API access | **Open, all plans incl. free** — new GraphQL API (api.buffer.com), personal API keys self-serve; classic REST API closed to new devs (grandfathered only) | Buffer support (3-0 verified) + developers.buffer.com |
| Platforms | 11: **IG, FB, TikTok, LinkedIn (Pages+Profiles), YouTube Shorts**, Threads, X, Pinterest, Bluesky, Mastodon, GBP. TikTok/YT-Shorts/Threads/Bluesky only on *new* plans | support/567 (3-0) |
| IG publishing | Direct to Business/Creator accounts; carousels max 10, **no mixed image+video** (API limit); since Dec-2023 all videos post as Reels; music/product-tags/collab need notification mode | support/657 (3-0) |
| IG Stories | The claim "stories are notification-only" was **refuted 3-0** by verifiers — treat story auto-publish as *available; confirm on our own account* before relying on it | verify pass |
| **YouTube** | **Shorts only. No full-length video publishing.** This is the hard gap for the "full YouTube video end-to-end" goal | support/567 (3-0) |
| API features | Post create/edit/schedule/delete, media, first comment, threaded posts, TikTok title; **media must be publicly-URL-hosted (no direct upload)**; publishing-only — no ads/DMs/inbox | support/859 (3-0) + blogs |
| Analytics | API exposes normalized per-post metrics + last-updated timestamp (3-0). Insights covers all 11 platforms; but no analytics for FB Stories / IG Reels (API limits, 2-1), per-post metrics stop updating after ~1 month, daily-batch (≤24h lag) | support pages |
| Rate limits | Plan-tiered: ~3,000 req/mo Free, 7,500 Essentials, 15,000 Team; third-party clients 100 req/15min. **May 25 2026 media-assets format change broke legacy integrations** — check our live bridge | support (single-checked) |
| Pricing | Per-channel: ~$5-6/ch/mo Essentials, $10-12 Team; volume discounts (11-25 ch → $3.33). 5 brands × 5 platforms = 25 channels ≈ **$85-100/mo** | multiple blogs, consistent |

### 1.2 Self-hosted alternatives

- **Postiz** — the serious one: ~33.6k★, AGPL-3.0, self-hosted = hosted feature-parity, active (v2.21.10 Jun-2026). Covers **all five target platforms** incl. IG feed/carousel/Reels/**Stories**, public API + Node SDK + n8n/Make/Zapier. Docker (app+Postgres+Redis). **Critical catch (verified in a practitioner writeup):** self-hosting does *not* remove platform friction — you must create your **own** OAuth developer apps per platform and pass their reviews (Meta app review, TikTok audit, LinkedIn vetting); YouTube tokens expire weekly until your Google OAuth app is production-approved. Public API covers only basic ops; rescheduling needs the internal JWT API.
- **Mixpost** — MIT (more permissive for embedding) but ~3.4k★ and last commit ~4 months old vs Postiz's daily activity. Postiz wins on maturity; Mixpost wins only on license.
- **Commercial rivals**: Hootsuite API needs paid account + separately-approved dev account, ~$199/mo floor; Sprout API = $399/user/mo; most others (Later, Metricool, SocialBee, Sendible…) have **no public API at all**. **Ayrshare** (unified posting API, 15+ platforms incl. TikTok/YouTube, from ~$60/mo) is the only interesting commercial alternative to Buffer for programmatic publishing.

### 1.3 Direct platform APIs — the friction map (why the middleman exists)

| Platform | Direct route | Friction for an indie |
|---|---|---|
| Instagram/FB (Graph) | Feed/reels/stories/carousels via container flow (`/media` → `/media_publish`); 100 posts/24h cap (50 carousels); JPEG-only images | Business account + Meta app review for scopes, ~2-4 weeks; 200 calls/user/hr |
| TikTok (Content Posting) | Direct-post + upload flows, photo carousels, PULL_FROM_URL needs domain verification | **Unaudited apps post private-only** — hard blocker until audit passes (+`video.publish` scope approval) |
| YouTube (Data v3) | Full-length uploads — the thing Buffer can't do. Default quota 10,000 units/day; upload = 1,600 units → **~6 uploads/day** (fine for a founder); quota raise = business justification | OAuth verification; production status needed to stop 7-day token expiry |
| LinkedIn (Community Mgmt API) | Pages + profile posting + page analytics | **Registered legal org required, two-tier review with narrated screen-recording demo; rejected app = start over.** Realistically closed to indies |
| Analytics | Native APIs expose the richest metrics (IG saves/reach; TikTok watch-time/completion — no demographics) | Same app-review gates as publishing |

### 1.4 Publishing architecture verdict — **staged hybrid, Buffer-first**

1. **Now (keep + extend): Buffer as the multi-platform backbone.** Already live in HQ (MCP tools, IG channel connected). Open API on all plans, one integration covers IG/FB/TikTok/LinkedIn + Shorts with zero platform-review friction, ~$85-100/mo at full 25-channel scale. Action items: migrate our bridge off the legacy REST endpoints to the **GraphQL API** and re-check the May-2026 media-assets change.
2. **Add one direct API: YouTube Data v3** for full-length videos — the only target Buffer can't hit, and the only direct API with indie-friendly access (self-serve Google Cloud project, ~6 uploads/day default is plenty). This completes "end-to-end full YouTube video."
3. **Later (sovereignty option): Postiz self-hosted** as a drop-in Buffer replacement *if/when* costs bite or Buffer's API tightens — but only worth it once we're willing to own per-platform OAuth apps and their reviews. Keep the publish seam adapter-shaped so Buffer→Postiz is a provider swap, not a rewrite. (AGPL is fine as a separate self-hosted service we call over HTTP; don't embed its code in ArgantaStudio.)
4. **Never (for now): direct TikTok/LinkedIn APIs** — audit/legal-org gates make them founder-hostile; Buffer/Postiz shield us.

**The actual differentiator** isn't the scheduler — it's the **closed loop**: generate (Soul/Cinema) → format per platform (story/post/reel/carousel/long-video masters) → publish (Buffer/YT) → pull metrics back (Buffer normalized-metrics API) → feed performance into the next generation brief. Nobody in either ecosystem (Higgsfield or Buffer) owns that whole loop; ArgantaLab already has both halves.

---

## Part 2 — Architecture audit & verdict

### 2.1 Electron vs React — resolved
Not comparable: React = UI library, Electron = desktop *wrapper* around a web app. The base repo ships two parallel apps: a Next.js/React web app (`app/` + `packages/studio`) and a Vite+Electron desktop fork (`src/` + `electron/`) whose only reason to exist is spawning local sd.cpp/Wan2GP binaries. **Verdict: web app; delete the Electron fork.** Our local inference is ComfyUI reached over HTTP — no process-spawning needed; every other ArgantaLab surface is web; Electron would mean a second build system (Vite), a duplicated component tree, and installer maintenance for zero benefit.

### 2.2 Target architecture

```
apps/studio (Next.js 15, React 19 — ArgantaStudio)
├─ Studios (from base, rebranded): Image · Video · Cinema · LipSync · Audio · Recast
├─ NEW: Publisher surface — calendar/queue across 5 brands × 5 platforms,
│        platform format masters (story/post/reel/carousel/longform),
│        per-post analytics pulled via Buffer normalized metrics
├─ packages/studio → @arganta/studio-ui (models.js catalog gains provider/costClass/formatMaster)
│
├─ Generation fabric (provider adapters, four-tier router aligned):
│    ComfyUI (Sovereign·0) → CF Workers AI (Economy·1) → fal.ai (Frontier·3) → Muapi (BYOK, optional)
├─ Publish fabric (adapter-shaped):
│    Buffer GraphQL (IG/FB/TikTok/LI/Shorts) · YouTube Data v3 (longform) · [Postiz slot]
│
├─ Persistence: Supabase — studio_runs (job ledger: params/provider/cost/status)
│    · studio_assets (metadata; bytes in R2/Supabase Storage, public URLs feed Buffer)
│    · studio_posts (post ↔ run lineage ↔ platform ↔ metrics snapshots)
│    · characters (Soul identities: seed refs + LoRA + trigger tokens)
└─ Reuse, don't rebuild: arganta-core-content worker (drafts/compose), @arganta/media-core
     (maturity-staged generate()), Content Builder/Post Studio (carousel composition),
     cameraGrammar compiler, Soul ID pipeline (SD1.5 LoRA + IP-Adapter)
```

Design rules carried from the hardening plan: bytes never in Postgres; every generation is a persisted run with cost; cheapest-capable-tier default with explicit Polish (T0→T2 ladder); one `useRunner()` hook replaces 17 copies of fire-and-poll; localStorage = offline cache only.

### 2.3 Naming
**ArgantaStudio** (final — Forge collides with Builder/Character/Skill/Pixel Forge family). Later cleanup: rename the old game-engine "Arganta Studio v2" → Game Forge.

---

## Part 3 — Opus execution plan (batches + founder gates)

*Same handoff discipline as the energy plan: Opus builds, founder signs ★ gates; no batch starts before its predecessor's gate. Each batch ends with a battle-test checklist, not "it compiles."*

**Batch A1 — Boot, slim, rebrand.** Strip empty submodule workspaces from `package.json`; delete `src/`, `electron/`, vite config, installer scripts; `next dev` clean; full ArgantaStudio rebrand (name, HQ design language, kill upstream branding/telemetry); register in ArgantaLab launch config.
**Batch A2 — Generation fabric.** Provider adapter interface; ComfyUI + CF Workers AI + fal.ai adapters (align with @arganta/media-core, don't duplicate); Muapi as optional BYOK; `models.js` schema + trim to ~20 verified-runnable models; wire Image/Video studios through it.
**Batch A3 — Runs & library.** Supabase migration (`studio_runs`, `studio_assets`, `studio_posts`, `characters`); R2/Storage upload path producing public URLs (Buffer prerequisite!); `useRunner()` hook; refresh-safe resumable polling; per-run cost written to ledger.
**★ GATE 1:** one prompt → generation on each of the 3 tiers → asset persisted with public URL → run visible with cost.

**Batch B4 — Soul characters.** `characters` entities usable from every studio; graft SD1.5 LoRA + IP-Adapter ComfyUI flow + Soul keyframe→i2v; character picker in Image/Video/Cinema.
**Batch B5 — Camera grammar + quality ladder.** Port cameraGrammar compiler into Cinema (named motions → provider payloads); T0-draft default + Polish action (fal.ai upscale/re-run); style recipes (Post Studio pattern) + per-brand kits for the 5 brands.
**★ GATE 2:** same character in an image and a video, drafted cheap then polished, using a named camera move and a brand recipe.

**Batch C6 — Publisher backbone.** Migrate arganta-bridge Buffer integration → Buffer **GraphQL** API (verify May-2026 media format change); channel registry for 5 brands × platforms; Publisher surface v1: compose from any studio output → format master (story/post/reel/carousel) → queue/schedule via Buffer; verify IG story auto-publish empirically.
**Batch C7 — YouTube longform + analytics loop.** Google Cloud project + OAuth (production status for non-expiring tokens); YouTube Data v3 resumable upload (title/desc/thumbnail from Core); quota budgeting (~6/day). Metrics ingest: Buffer normalized metrics → `studio_posts` snapshots; analytics panel per brand; performance summary fed back into generation briefs (the closed loop).
**★ GATE 3 (end-to-end):** one brief → generated asset → published to IG + TikTok + LinkedIn via Buffer + full video to YouTube → metrics visible in ArgantaStudio 48h later.

**Batch D8 — Hardening.** Battle tests (fabric adapters, runner, grammar compiler, publish adapters, 20-task checklist per surface); cost-ledger rollup to HQ (CAPO/CFO); Postiz adapter slot documented as the sovereignty escape hatch; upstream cherry-pick policy for the MIT base.

### Risks Opus must respect
1. Buffer API = publishing-only + request caps → all composition/analytics storage lives on our side; cache metrics snapshots (they stop updating after ~1 month anyway).
2. Media must be publicly-URL-hosted for Buffer → R2/Storage public-URL path is a hard A3 dependency for C6.
3. IG constraints: JPEG-only via API paths, 10-item carousels, no mixed media, all video = Reels.
4. TikTok/LinkedIn direct APIs are out of scope — never burn a batch attempting them.
5. Verification caveat: Buffer/Postiz core claims are 3-0 verified against primary docs; direct-API friction numbers (quotas, review timelines) are primary-doc-sourced but single-checked — re-verify quotas at build time.
