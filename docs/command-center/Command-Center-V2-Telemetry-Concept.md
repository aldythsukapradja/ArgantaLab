# Command Center v2 — LLM Telemetry & Workload Intelligence (CONCEPT)

**Author:** Fable (research + concept, 2026-07-18) · **Status:** CONCEPT — no build yet · **Builds on:** Command-Center-Strategy.md (v1 shipped: liveness cockpit, all 6 tiles live)
**Founder ask:** the cockpit is "very empty" — add real technical depth: LLM usage + quotas (Sponsored tier, Claude Code, Codex), which model is used where, ComfyUI work stats, spend. Researched against how top AI companies instrument this.

---

## 1. What the research says (distilled from industry practice)

Five patterns recur across the LLM-observability industry (Langfuse, Helicone, LiteLLM, Datadog SPOG literature) and the internal dashboards of AI-heavy companies:

**P1 — The gateway is the meter.** Companies that know their LLM usage don't scrape N provider dashboards; they route every call through one gateway (LiteLLM proxy, Helicone, Cloudflare AI Gateway) and read usage from *their own* ledger — per key, per project, per model, with budgets and rate limits attached at that same choke point. Observability is a *side effect of routing*, not a separate system.

**P2 — Tokens are the new cloud bill (FinOps lens).** Mature dashboards show: spend per model, per feature, per day; cost per *outcome* (per post generated, per mission completed) — not just raw tokens. Budgets have windows (daily/monthly) that reset independently.

**P3 — Golden signals, adapted to LLMs.** The SRE four (latency, traffic, errors, saturation) map to: p50/p95 generation latency · requests+tokens per window · refusal/error rate · **quota-window fill %** (saturation = how close to the 5-hour/daily cap). Single pane of glass, drill-down on click, alerts only on saturation.

**P4 — Provenance discipline.** Good dashboards never present an estimate as a measurement. Subscription quotas (Claude Max, ChatGPT plans) are deliberately opaque — the honest pattern (ccusage, Codex `/status`) is *client-side estimation clearly labeled as such*.

**P5 — Don't buy the enterprise platform reflex.** Full tracing platforms exist for teams running millions of calls with PII concerns and sampling budgets. A single-operator company needs the *shape* (ledger, quotas, model map) not the product. Verdict: sample the pattern, skip Langfuse/LangSmith.

## 2. The Arganta translation — one sentence

**You already own the gateway:** `@arganta/ai` (four-tier router: Sovereign/Sponsored/Economy/Frontier) has `ledger.js`, `tiers.js`, `governance.js` shipped as contracts. Command Center v2 = *wire the cockpit to that ledger and the three local truth sources, instead of inventing a new telemetry system.* P1 applied: routing is the meter.

## 3. Data-source truth table (verified locally, 2026-07-18)

| Number the founder wants | Source | Nature | Verified |
|---|---|---|---|
| Claude Code tokens/model/day/project | `~/.claude/projects/**/*.jsonl` (ccusage pattern) — **153 files present** | **estimate** (client-side; pools with Claude.ai usage) | ✅ files exist |
| Claude Code 5h-window / weekly fill % | same JSONL, rolling-window math (Claude-Code-Usage-Monitor pattern) | **estimate** — no official quota API | ✅ feasible |
| Per-mission $ cost | `mission` table `cost_usd` (bridge already writes it) | **measured** (SDK-reported) | ✅ live |
| Codex window fill % | `codex /status` (CLI reports remaining %); `~/.codex/sessions` — **64 files** | **estimate/CLI-reported** | ✅ dirs exist |
| Sponsored tier (Workers AI) usage vs quota | **Cloudflare GraphQL Analytics API** — neurons/day vs the **10,000 free neurons/day** quota, resets 00:00 UTC | **measured + real quota** — the ONE authoritative quota we have | ✅ documented |
| ComfyUI work done (jobs, timings, top workflows) | `GET /history` (per-run node timings), `GET /queue`, `GET /system_stats` (VRAM/device) | **measured, local** | ✅ live, responds |
| Media assets produced | `media_asset` table (persistence-first pipeline) + Pixel vault ingest | **measured** | ✅ exists |
| Which model runs where (the map) | `@arganta/ai` `tiers.js` + `registry.js` (static truth) + `ledger.js` (live counts once impl lands) | **declared + measured** | ✅ code present |
| fal.ai / ElevenLabs spend | no clean API; dashboard links | **link-only** | — |
| Vercel/Supabase/CF infra | v1 status worker (already live) | measured | ✅ shipped |

**Key honesty findings:** (a) Claude and Codex subscription quotas have **no official API** — everything is estimation from local logs + CLI status; badge it `est`. (b) The **only real quota bar** you can draw today is Workers AI neurons (10k/day, GraphQL-queryable) — which happens to be your Sponsored tier. (c) ComfyUI is fully measurable locally — jobs, VRAM, per-workflow timing — via three endpoints the bridge can proxy.

## 4. The v2 cockpit concept (zones)

Keep v1's four zones; deepen two, add two. Every number carries `live` / `est` / `link` provenance badges (v1 discipline).

1. **FLEET → BRAINS & QUOTAS.** Each brain card grows a quota strip: Claude — 5h-window fill bar + weekly bar (`est`, "resets 14:00"); Codex — window fill from `/status` (`est`); Sovereign — Workers-AI neurons bar `4,210 / 10,000 today` (**`live`**, resets 00:00 UTC) + local-model note. Click → per-day usage sparkline (from JSONL/ledger).
2. **MODEL MAP (new).** The founder's "clear mapping which LLM is used where": a compact matrix — rows = surfaces/agents (Core chat, Bridge missions, Content worker, Studios, Comfy nodes), columns = tier (Sovereign/Sponsored/Economy/Frontier), cell = model id + calls this week (from ledger; static declaration until ledger impl lands, badged accordingly). This makes routing *visible* — the four-tier doctrine as a live artifact instead of a doc.
3. **WORKLOAD (new).** ComfyUI: jobs today/this week, avg job time, VRAM now vs total, top 3 workflows by run count (from `/history`); Missions: count + total `cost_usd` this week, last 5 with per-mission cost; Media: assets produced this week by kind (image/voice/music).
4. **SPEND.** Roll-up strip: Sovereign `$0 · N runs` · Sponsored `neurons + $0` · Economy `$x.xx` · Frontier `$x.xx` (ledger + mission costs), plus month-to-date. Cost-per-outcome once (e.g. "$0.04 / post") — the FinOps lens from P2.

## 5. Architecture (concept)

- **Bridge = local telemetry agent** (it already runs on the machine with the logs): new `/telemetry` endpoint aggregating (a) JSONL scan (cached, incremental — ccusage-style parser, ~153 files), (b) `codex /status` capture, (c) ComfyUI `/history+/queue+/system_stats` proxy. Heartbeat gains a compact telemetry snapshot so *phone-with-PC-off* still shows yesterday's numbers.
- **Status worker grows one probe:** Cloudflare GraphQL Analytics (neurons/day) — needs a CF API token secret; it's the authoritative Sponsored quota.
- **Ledger stays canonical** for routed calls: cockpit reads `@arganta/ai` ledger for MODEL MAP + SPEND as the router impl lands (dependency on the Sonnet four-tier implementation; until then the map renders the declared registry, badged `declared`).
- **No new platform.** No Langfuse/LangSmith/LiteLLM deployment (P5); the ledger + three local sources cover a single-operator company.

## 6. Battle-test verdicts (self-check)

- ✅ Verified live: JSONL corpus exists (153 files), `~/.codex` exists (64 session files), ComfyUI `/queue`+`/history` respond, `@arganta/ai` ledger/tiers/registry files present, mission.cost_usd already flowing.
- ⚠️ Assumed (Opus must verify in build): JSONL schema stability across Claude Code versions (ccusage handles drift — borrow its approach); `codex /status` machine-readable output shape; CF GraphQL neurons query shape + token scope.
- ❌ Rejected ideas: deploying an observability platform (overkill, P5); presenting subscription quotas as authoritative (impossible, P4); routing Claude-Code-the-CLI *through* the gateway to meter it (the CLI is the product; meter its logs instead).
- **Risk:** JSONL parsing on OneDrive-synced paths can be slow — parse incrementally + cache in the bridge, never in the browser.

## 7. Opus handoff (when founder says build)

- **T1** Bridge `/telemetry`: ccusage-style incremental JSONL parser (per-model/day tokens + est window fill), Codex status capture, Comfy history/queue/stats proxy. *Accept: one JSON with all three blocks + `est/live` flags; <300ms warm.*
- **T2** Status worker: CF GraphQL neurons probe (secret: CF_API_TOKEN). *Accept: neurons today + quota + reset time in /status.*
- **T3** Cockpit zones: quota strips on brain cards, WORKLOAD zone, SPEND strip. *Accept: all numbers badged; PC-off degrades to heartbeat snapshot.*
- **T4** MODEL MAP zone from `@arganta/ai` registry/tiers (declared), ledger counts when available. *Accept: matrix renders; ledger dependency noted, not blocked on it.*
- **T5** (later, with four-tier impl) ledger-live counts + cost-per-outcome.

---
*Fable: the one-line thesis — you don't need more dashboards, you need your existing router's ledger made visible, plus three honest local scrapers. The only true quota bar you can draw today is the Sponsored tier; everything subscription-side is estimation and must say so.*
