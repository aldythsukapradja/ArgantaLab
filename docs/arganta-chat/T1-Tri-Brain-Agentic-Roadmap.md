# T1 · Arganta Chat → full agentic system (tri-brain), Sovereign-first

**Date:** 2026-07-18 · **Status:** S0+S1 BUILT & DEPLOYED (Opus); S2–S7 remain · **Handoff:** Opus, named Sonnet lanes

## STATUS — S0 (wall) + S1 (Sovereign image) done 2026-07-18
- `supabase/functions/arganta-chat-brain/index.ts` DEPLOYED (`supabase functions deploy` ok). Wall verified: anonymous probe → 401 `UNAUTHORIZED_NO_AUTH_HEADER`; parent-JWT gate + kid-deny; NO service role; tool ALLOWLIST (only `generate_image` live, rest declared). HQ unreachable by construction — no vault/hq_*/office tools exist in the fn.
- S1 image pipeline wired E2E: `generate_image` → ComfyUI (`COMFYUI_URL`, workflow overridable via `COMFYUI_WORKFLOW` secret, `__PROMPT__` placeholder, submit→poll→/view) → Cloudflare Workers AI fallback (`ARGANTA_CF_ACCOUNT_ID`/`ARGANTA_CF_API_TOKEN`, flux-1-schnell) → honest null. Client `apps/landing/src/chat/brainClient.ts` (`generateImage`/`brainHealth`); StoryPublish tries Sovereign, labels source (✦ Sovereign / ✦ sponsored / Designed card), falls back to the deterministic canvas card. Both apps tsc+build clean.
- **Founder actions to SEE real generation (until then it honestly shows the canvas card):**
  1. `supabase secrets set ARGANTA_CF_ACCOUNT_ID=… ARGANTA_CF_API_TOKEN=…` (fastest path — works on the deployed app immediately; CF Workers AI free tier).
  2. Sovereign: run ComfyUI (`tools/comfyui` scripts) → expose via tunnel → `supabase secrets set COMFYUI_URL=https://<tunnel>` (+ optional `COMFYUI_WORKFLOW` = your exact graph with `__PROMPT__`).
  Then: Share this week → the post image is generated, source labeled. Next: **S2** (hybrid router).

---

**Source of truth:** the founder's original `Arganta-LLM-Hierarchy-and-Execution-Strategy.md`.

## 0 · Re-reading the original instruction (what it actually demands)

The original doc defines the customer app's brain as a **cost ladder, not a model picker**:

| Original tier | Meaning for Arganta Chat |
|---|---|
| Tier 0 Router | intent → permissions → context → tool/component selection, **free** |
| Tier 1 Everyday | calendar/FAQ/reports/story drafting on the **cheapest capable model** |
| Tier 2 Premium | complex planning only, **paid only when needed**, invisible |
| Media | ComfyUI is **canonical** — Conversation → Orchestrator → ComfyUI → Preview → Approval → Publish |
| Operator | Claude Code/Codex **never** in the customer workflow |

So the family app's **tri-brain = Sovereign (self-hosted: ComfyUI media + free-tier LLM) · Everyday (cheapest cloud LLM) · Premium (paid reasoning)** — *not* HQ's Sovereign/Claude/Codex operator toggle, which stays HQ-only. Build order in the doc: calendar ✅ → reports ✅ → story creation ✅ (deterministic) → Kinetik integration ✅ (embed) → component registry ✅ (14 components) → **LLM routing → ComfyUI → (operator excluded)**. We are exactly at the LLM-routing + ComfyUI step.

## 1 · The non-negotiable: HQ separation (the wall)

Verified in code: `llm-proxy` is hard-gated to the founder's email (`index.ts:69`) — the family
app **cannot** call it even by accident. That forces the right architecture:

**A new `arganta-chat-brain` edge function** is the ONLY door between the family app and any LLM:
- Auth: parent JWT (kid-deny, same as `arganta-publish`); **runs RLS-scoped with the user's
  token — never the service role.** The database wall (RLS on `hq_*`, vault, `agent_runs`,
  offices) is then the real boundary, not a prompt.
- Tool registry: **allowlist only** — `get_week`, `get_today`, `get_kid_reports`,
  `get_kid_dashboard`, `compose_win`, `add_event`, `add_routine`, `generate_image` (media
  orchestrator), `publish_post` (approval-gated). Nothing else exists. No `search_vault`,
  no `memory_search`, no `analyze`(HQ charts), no office tools, no URL fetch.
- Context: circle-scoped family data + public brand voice only. HQ facts are not merely
  refused by prompt — they are **unreachable by construction**.

## 2 · Roadmap (table)

| # | Phase | What ships | Proof it works ("test until it really generates") | LLM | Deps |
|---|---|---|---|---|---|
| S0 | **The Wall** — Family Data Contract + `arganta-chat-brain` skeleton | Edge fn (parent-JWT, RLS-scoped, tool allowlist doc), leak probes | As a parent: `hq_*` RPCs + vault reads all denied; "what's our ARR?" → honest refusal | **Opus** | — |
| S1 | **Sovereign stage 1: ComfyUI generates for real** | Media orchestrator seam in the brain fn: `generate_image` → ComfyUI (local, via tunnel in dev) with CF Workers AI as sponsored fallback; StoryPublish image = generated, canvas card = offline fallback (labeled) | Batch: 10 story-image prompts → ≥8 real PNGs land in `arganta-posts`, preview→approve→publish E2E once to IG | **Opus** (infra/judgment) + Sonnet (workflow JSON, batch script) | S0 |
| S2 | **Tier 0 router, hybrid** | Keyword fast-path stays (mapped intents = deterministic, free, instant); unmatched free-text → brain fn; ambiguity → picker, never guess | 216-turn map: mapped intents ≥95% component accuracy at $0; unmatched routes to S3 | Sonnet | S0 |
| S3 | **Tier 1 everyday agent** (the big step) | `runAgentLoop` (reuse `@arganta/agent`) inside the brain fn over the S0 tool registry; free models (Gemini/Groq) via `@arganta/ai` selectModel; answers = component JSON + short prose, **numbers only from tool results** | 30 free-text family questions: zero invented numbers (audit vs DB), every answer renders a real component or honest text | **Opus** (loop/tool contracts/provenance enforcement) + Sonnet (per-tool impls) | S0,S2 |
| S4 | **Tier 2 silent escalation** | Planning/long-form ("plan the birthday week") → paid model; per-circle daily budget + ledger; UI change = shimmer lasts longer, nothing else | Budget cap provably halts spend; escalation ≤10% of turns | Sonnet | S3 |
| S5 | **Family memory** (not the founder vault) | New `arganta_chat_memory` per-circle table (likes, names, routines), auto-recall into Tier 1 context; nothing personal leaves the circle scope | Recall improves answers on 10 scripted follow-ups; kid-deny + circle RLS probed | Opus (schema/policy) + Sonnet (CRUD) | S3 |
| S6 | **Agentic actions, approval-gated** | Write-tools through draft→confirm chips (calendar write asks once; IG publish keeps existing confirm); `AUTONOMY.ON_DEMAND` — the model can never fire an outward action alone | Attempt-to-bypass tests: no write lands without a human tap | Sonnet | S3 |
| S7 | **Red-team + soak** | Injection suite (hostile calendar-event titles, kid names as prompts), HQ-leak probes, kid-lockout, cost/latency budgets (p50 < 4s Tier 1) | All probes green, 1-week family soak, then flip default on | **Opus** | all |

## 3 · Battle test of this roadmap

| Risk | Verdict / counter |
|---|---|
| **HQ leakage** — same Supabase project, one anon key | The wall is RLS + user-JWT execution (S0), not prompts. Probe suite is a shipping artifact, not a one-off. Brain fn never holds the service role. |
| **ComfyUI is on the founder's machine** — a deployed family app can't reach localhost | Stage-1 honest scope: Sovereign works in dev/via tunnel (`tailscale serve`/cloudflared — same P0 pattern as Command Center); **deployed** app uses the sponsored fallback (CF Workers AI, already live in media-proxy pattern) until Sovereign has a public tunnel. Never a silent fake: offline → labeled canvas card. |
| **Prompt injection via family data** — event titles are attacker-writable text entering the LLM context | Tool results wrapped as data-only blocks; no exfiltration tools exist in the registry (no fetch, no email); outward actions human-gated (S6); S7 ships hostile-title tests. |
| **Free-tier latency/flakiness** would wreck the calm UX | Hybrid router (S2): everything already working stays deterministic and instant; the LLM only handles what's unmapped today (currently a dead end, so strictly additive). Existing "still with you" long-thinking copy covers slow turns. |
| **Cost blowup** | Tier ladder + per-circle daily budget + the honest `agent_runs`-style ledger (reuse @arganta/ai governance). Tier 2 capped at ≤10% of turns. |
| **Zero-jargon violation** | Model names never reach the UI; provenance stays internal. The brain pill/model picker of HQ is explicitly NOT ported. |
| **Refresh-token collision** (brain fn + app both hold session) | Non-issue: edge fn verifies the JWT per-request, holds nothing. |

## 4 · Handoff to Opus

Start at **S0 → S1** in one session ("the wall, then make Sovereign actually generate").
Reuse, don't rebuild: `@arganta/agent` runAgentLoop (frozen loop), `@arganta/ai`
selectModel/policy/ledger, `llm-proxy`'s provider adapters (copy the adapter code, **never**
the operator gate), `media-proxy`'s CF image path as the fallback shape,
`arganta-publish`'s JWT/kid-deny gate as the auth template, `tools/comfyui` install +
`docs/media-center/ComfyUI-Sovereign-Fabric-Plan.md` for the Sovereign workflows.
Sonnet lanes (named in the table): S2, S4, S6, batch/test scripts, per-tool CRUD impls —
hand each a written contract first; everything touching auth, the wall, the agent loop, or
red-teaming stays Opus end-to-end.

**Founder actions ahead of S1:** ComfyUI running locally (tools/comfyui scripts) + choose the
tunnel (tailscale vs cloudflared); one `supabase secrets set` batch for the brain fn's free
keys (GEMINI_API_KEY / GROQ_API_KEY — separate secrets from HQ's, so revocation is per-app).
