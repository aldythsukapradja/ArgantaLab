---
title: Arganta Core — Concept & Build Plan (MOC)
date: 2026-07-15
category: Architecture
status: concept — NOT built
tags: [arganta-core, chat, agentic, cloudflare, supabase, digital-twin, moc]
---

# Arganta Core — the digital twin brain

## TL;DR (plain language)

**Build your own ChatGPT.** One chat window — Arganta Core — where the founder
types and gets things back: images, websites, full apps, voice, charts, and
later video/music. The difference from ChatGPT: it runs on infrastructure the
founder already pays for (Cloudflare free tier + Supabase Pro), it remembers
the company (Vault, threads, ledger), it shows the TRUE provider/cost of every
answer, it can consult the C-Level agents, and eventually it works while the
founder sleeps.

**What "give me everything" means, capability by capability:**

| Ask for… | Today | Fully chat-native after |
|---|---|---|
| Image | ✅ real (Cloudflare FLUX, $0) | C3 |
| Voice / speech | ✅ real (Aura-1, $0) | C3 |
| Chart / analytics | ✅ real live data | C3 |
| Website | ✅ instant deterministic engine | C3 (basic) · B2 (AI-revised, templated) |
| App (tracker, dashboard, CRM…) | 🟡 templates exist, generation is copy-paste-external | B1–B3 |
| Publish to a real URL | 🟡 Circle catalog only | B5 (`build.arganta.app`) |
| Remember past chats + Vault | ✅ storage live (pgvector) | C5 (auto-recall) |
| Music | 🟡 synth only — no free music-gen model exists anywhere | paid tier (on hold) |
| Video | 🟡 canvas/deterministic only — no free video-gen model exists | paid tier (on hold) |
| Work while you sleep | ❌ | C7 |

The chat window itself (the Face) arrives at C4b — before that, capabilities
are verified through code, not conversation.

A first-party chat surface — ChatGPT/Claude-grade UX but under founder control —
that fronts everything already built: the four-tier router, the Media Center
engines, the 7-region cortex (WS3), the 7-layer reactor (WS2), the C-Level
offices, the Vault, and the truthful ledger. One conversation that can *make
things* (image, voice, website, deck, chart), *remember* (threads + vector
memory), *delegate* (offices), and eventually *act on its own* (heartbeat).

**Agent name:** Arganta Core. **Avatar:** the reactor orb (reuse `CoreSlot`,
states mapped to the cinema contract: idle → listening → thinking → speaking).

## Mental model — six organs

| Organ | Role | What exists today | Gap to close |
|---|---|---|---|
| **Brain** | reasoning + routing | `@arganta/ai` four-tier router, escalation, validators, benchmarks — live | no multi-turn tool loop |
| **Memory** | recall + persistence | `agent_runs`, `media_asset`, core_thread/message + pgvector (C2 ✅), Vault notes (localStorage) | RAG wiring (C5) |
| **Hands** | making + acting | Media Center engines, mediaGateway (image/TTS/embed live), analytics RPCs, **and the [[Single-File-Builder]] (B1–B5) — apps + websites: create/revise/validate/version/publish, Core's strongest hand** | not exposed as callable tools |
| **Face** | conversation surface | none — everything is button-driven | the whole chat UI |
| **Heartbeat** | autonomy | pg_cron + pg_net installed, idle | no missions, no service-role path |
| **Conscience** | governance + truth | dataClass gates, operator gate, provenance chips, cost ledger | extend to tool-permission policy |

The design rule carried over from everything this session: **every assistant
message carries truthful provenance** (tier · model · cost · saved-or-not), and
tools degrade honestly down the tiers — Arganta Core never fakes a capability.

## Honest audit (2026-07-15)

### Works (verified live this session or earlier)
- Truthful gateway pattern (`llm-proxy`, `media-proxy`) — real provider/model/cost, never a generic label
- Tier escalation incl. hard-failure fallthrough (fixed + tested this session)
- Cloudflare Sponsored tier: text (Llama 3.3), image (FLUX), TTS (Aura-1) — all live, $0
- Persistence-first: bytes → `media-artifacts` bucket, `run_id` ↔ `media_asset` lineage, accept/reject metric
- Model Rack observability: timestamps, metadata, artifact popup, quota endpoint (scope pending)
- Governance: confidential data provably never leaves Tier 0
- WS-8 self-improving benchmarks from real session usage

### Broken / missing (the gaps that block "digital twin")
1. **No conversational layer at all** — no threads, no multi-turn, no chat memory. Biggest single gap.
2. **Agents are advisors, not actors** — C-Level offices have the `agentGenerate` seam but no tools, no delegation protocol, no mission runner (Agent OS v2 is spec-only).
3. **No tool-calling loop** — the router answers once; it cannot call generate_image, read the result, and continue. This is the core mechanism of an agentic chat.
4. **No autonomy** — nothing runs with the browser closed. pg_cron/pg_net sit idle. Also unsolved: llm-proxy is operator-JWT-gated, so a cron job has no way to call it (needs a service-role internal path — a real security design decision, Opus-grade).
5. **No RAG/memory** — Vault is localStorage with no search; pgvector (0.8.0) available but not installed; CF bge embeddings free but unused.
6. **Tier 0 is brittle** — WebLLM module resolution fails in some environments; escalation now covers it honestly, but Sovereign is effectively dead there.
7. **Partial persistence** — only image + TTS bytes persist; website/deck/copy outputs vanish.
8. **Model Rack polls (2s)** — Realtime exists on the project (used by coop tables) but not on `agent_runs`/`media_asset`.
9. **Secrets posture** — CF token is a plain env secret; Supabase Vault (installed!) unused. Matters more once the token gains Analytics:Read.
10. **Frontier/Economy keys unset** — deliberate (user hold), recorded not criticized.
11. **No CI** — 93 node tests exist, run only by hand; GitHub Actions free tier unused.
12. **Voice copilot is fixed-phrase** — mic exists (self-hosted MediaPipe) but not connected to any LLM; natural upgrade path into Arganta Core's composer.

## Subscription maximization (real numbers, from the founder's dashboard 2026-07-15)

| Resource | Plan | Used / quota | Verdict |
|---|---|---|---|
| Supabase Edge Function invocations | Pro | **28 / 2,000,000** | wildly underused — the agent loop should live here |
| Supabase Storage | Pro | 0.019 / 100 GB | media-artifacts can grow ~5000× before it matters |
| Supabase Realtime messages | Pro | 1.22M / 5M (mostly Kinetik coop) | room to stream agent/ledger events |
| Supabase egress | Pro | 6.69 / 250 GB | fine; revisit R2 only if artifact traffic explodes |
| Supabase compute | Pro | 137 h ($1.84) | ⚠ a SECOND project (`njnayukxdhhjjjgezzxj`, June 8) exists — if unused, pause it; each project burns dedicated compute |
| Supabase Log Drains / PITR / branching | Pro | 0 | available on Pro — enable log drain + confirm PITR add-on later |
| Cloudflare Workers AI | free | ~hundreds / 10,000 neurons/day | the Sponsored tier engine — keep pushing |
| Cloudflare Workers (compute) | free | **0 / 100,000 req/day** | untouched; future home of async orchestration |
| Cloudflare R2 | free | 0 / 10 GB | candidate artifact CDN, zero egress |
| Cloudflare domain (DNS) | free | hosting the domain | Email Routing (founder@…), Turnstile on Landing forms, Access for operator surfaces (if proxied) |
| Vercel | free | 5 apps hosted | fine as-is |
| GitHub Actions | free | 0 / 2,000 min·mo | add CI: run the 93 tests on every push |

## Embedding & mount contract (C1, frozen — `@arganta/agent/embed.js`)

Arganta Core is a **module, not a page**. It mounts four ways: its own HQ
surface (`inline`), a desktop slide-over (`panel`), embedded in another surface
(`inline`), or later on a different property entirely (`embed`).

**Founder rule, frozen:** on mobile (≤640px) the Core is ALWAYS `fullscreen`,
covering the whole viewport **including the bottom nav bar** — `resolveMountMode`
overrides any requested mode, and the stacking contract (`Z_LAYERS`) puts it
above both the app nav and the floating copilot. Analog = ChatGPT / Claude chat.
The component prop contract (`ARGANTA_CORE_PROP_KEYS`: threadId, mountMode,
embed, maxCostClass, apiBase, onArtifact, onClose) is the reuse boundary — the
moment anything embeds it, this is the API it depends on.

## Arganta Core — surface design

New HQ surface `core` (rail: top of Products group). Three panes:

- **Threads rail** — persisted conversations (`core_thread`), searchable, same drawer language as Media Center.
- **Conversation** — rich message blocks: text (streamed), image card (from mediaGateway, provenance chip + saved✓ + accept), audio row (Aura-1 clip, karaoke-highlight on play), website/deck preview card (iframe srcDoc), chart block (Analytics engine). Tool-trail lines (`→ generate_image · cloudflare-flux · 4.1s`) between request and result — the agent shows its work. Reactor orb as avatar, animated by state.
- **Cortex panel** (collapsible right rail) — live region activation (Think/Know/Do/Vault/Architecture per the cinema contract), session cost ticker, neuron mini-gauge, recalled-memory cards, delegation trail (which office was consulted).

Composer: tier pill (reuse), tool chips, mic (upgrade the existing copilot mic
from fixed-phrase to transcribe-into-composer), Enter-to-send.

## Data model sketch (C2)

- `core_thread` (id, title, created_by, created_at, updated_at)
- `core_message` (id, thread_id, role, content, tool_calls jsonb, run_id → agent_runs, created_at)
- `core_artifact` (message_id ↔ media_asset.id) — chat reuses the existing asset table, no parallel store
- `memory_chunk` (id, source `vault|thread`, ref, content, embedding vector(768)) — pgvector, embedded via CF `@cf/baai/bge-base-en-v1.5` (free, same account)
- Realtime publication + `core_message` / `agent_runs`

## Tool registry sketch (C1 contract, C3 impl)

Client-side loop v1 (reuses browser engines + existing gateways; autonomy moves
headless tools server-side later):

| Tool | Backs onto | Cost class |
|---|---|---|
| `generate_image` | mediaGateway → media-proxy → CF FLUX | 1 |
| `generate_speech` | mediaGateway → CF Aura-1 | 1 |
| `make_website` / `make_deck` / `make_brand` | deterministic engines (browser) | 0 |
| `analyze` | Analytics engine + live RPCs | 0 |
| `search_vault` | pgvector `memory_chunk` | 1 (embed) |
| `consult_office` | C-Level `agentGenerate` seam | routed |
| `check_quota` / `check_ledger` | media-proxy quota · agent_runs RPCs | 0 |

Tool-capable Sponsored providers: Gemini + Groq (tools:true in registry today).
CF Llama function-calling support to be verified before enabling (registry
currently truthfully says tools:false).

## Build plan — batches by model

| # | Batch | Delivers | Model | Why this model |
|---|---|---|---|---|
| C1 | Foundation contracts | ✅ **SHIPPED** — `@arganta/agent` (thread schema, unified tool registry, pure agentic loop, delegation protocol, autonomy+invocation guardrails, embed/mount contract) + ADR-0004 · 30/30 tests | **Opus** | irreversible interfaces + security posture |
| C2 | Substrate | ✅ **SHIPPED** — `migration_arganta_core.sql` (core_thread/core_message/memory_chunk+pgvector, live-verified), `embed` kind in media-proxy (CF bge-base-en-v1.5, 768-dim, verified real embed+store+cosine-search round trip), Realtime added to agent_runs/media_asset/core_message. Vault-ify secrets deferred to C7 (ADR-0004 prerequisite) | **Sonnet** | pattern-matches five existing migrations |
| C3 | Tool loop | ✅ **SHIPPED, live-verified** — `lib/core/{runtime,tools,thread,index}.ts` wires the C1 loop to real models + real tools (image/speech/website/deck/brand/analyze/search_vault/consult_office/quota/ledger). Found + fixed 2 real bugs live: llm-proxy's `needsTools` filter could be bypassed by an exact-model request (Claude would silently hallucinate fake tool calls instead of erroring — a real truthfulness violation); Core's chat defaulted to `dataClass:'internal'`, which governance correctly blocked from the free tier. **Known limitation, not a bug:** Cloudflare's free Llama (the only tools-capable Sponsored provider actually configured — Gemini/Groq keys were never set) is slow (15-40s/call) and unreliable at stopping a tool loop even with explicit prompting — added `GEMINI_API_KEY`/`GROQ_API_KEY` as the recommended fix (they outrank Cloudflare in registry priority) | **Sonnet** (Opus reviews the loop-termination/budget logic) | mechanical once C1 fixes the contract |
| C4a | Design language | ✅ **SPEC SHIPPED** — [[C4a-Design-Language]] (orb state machine incl. blocked/thinking-long, message choreography, artifact card, microcopy, mobile fullscreen, motion tokens) + Sonnet workflow at `.claude/commands/build-core-chat.md`. Surface placement decided: rail **Command** group | **Fable** | creative/aesthetic judgment |
| C4b | Chat UI build | ✅ **SHIPPED, live-verified** — new `core` HQ surface (`apps/hq/src/surfaces/core/`): threads rail, real conversation loop (tool trails, provenance footer, honest fallback text), `CoreOrb` (real `CoreSlot` for the hero empty-state, a lightweight token-driven visual for the 32px per-message avatar — `Core2D`'s cockpit scene doesn't fit that small), `ArtifactCard` for all six block kinds, full composer (tier pill, mic dictation, stop/send, session cost), frozen microcopy + starter chips, mobile fullscreen (375×812-verified) and a 420px panel slide-over, all three ARGANTA_CORE_PROP_KEYS mount modes working. 9/9 steps, each committed + browser-verified. Found + fixed 2 real bugs live in `lib/core`: `sendMessage` was discarding the loop's own provider/model info (no per-message provenance without it) and `appendMessage` had a silent data-loss bug — any reply whose model call never reached `logAgentRun` (no-model-reachable, or a new client-side abort) tripped a `core_message.run_id` FK constraint and vanished on reload; fixed generally, not just for the new code. Karaoke audio playback and the cortex panel's region/recall content are deferred — cortex ships toggle+cost+activity only per spec, no empty placeholders for C5/C6 content | **Sonnet** | large but well-specified UI work |
| C5 | Memory/RAG | embed Vault + threads, `search_vault` tool, auto-recall injection w/ dataClass gates | **Sonnet** | wiring + tests |
| C6 | Delegation | offices as callable sub-agents over `agentGenerate`, delegation-trail UI | Opus (protocol) → **Sonnet** (impl) | protocol is judgment, impl is wiring |
| C7 | Heartbeat | pg_cron missions: nightly CAPO rollup, quota watch, morning-brief thread | **Sonnet** after C1's security decision | blocked on service-role design |
| C8 | Battle-test | E2E scenario suite: golden conversations incl. the Builder proving slice (landing page + expense tracker), cost/quota assertions, persistence checks | **Sonnet** | this session proved the verify loop |
| C9 | Maximization quick wins | GitHub Actions CI, pause idle Supabase project, Analytics:Read scope (#8), enable log drain | **Sonnet** + founder actions | independent of everything, do anytime |

### B-batches — the Single-File Builder (see [[Single-File-Builder]])

| # | Batch | Delivers | Model | Why this model |
|---|---|---|---|---|
| B1 | Builder kernel contracts | ✅ **SHIPPED** — `@arganta/builder` (types+classifier · hq_artifact/artifact_version schema+row-mapping · deterministic validation gate · builder tool specs · generalized generation prompt · portable-component shape+selector) + ADR-0005 · 84/84 tests. Decisions: NEW founder-scoped store not an hq_app extension; `publish_artifact` = sideEffect/not-autonomy-safe (the only outside-world tool); validation gate frozen so generation promises exactly what B5 enforces | **Opus** | extends C1's frozen registry + a publish-governance call |
| B2 | Generation tools | ✅ **SHIPPED, live-verified** — `apps/hq/src/builder-core/{appShell,generate}.ts`: Stage-0 deterministic floor (real CRUD app shell + existing `makeWebsite`) → Stage-1 AI via `task:'copy'`, gated by B1's `validateHtml()`, honest fallback (never fabricates success). `create_website`/`create_application` wired as real executors in `lib/core/tools.ts` (`WIRED_BUILDER_SPECS` auto-merges into Core's offered tools). `revise_artifact`+ the rest stay unwired until B3's artifact persistence exists. Found a pre-existing B1 quality-gate false-positive (`no-todo` regex matches the HTML `placeholder=` attribute, not just filler text — warn-only, doesn't block) | **Sonnet** | tiered-generation pattern proven 3× this session |
| B3 | Validation + versions | ✅ **SHIPPED, live-verified** — `migration_hq_artifacts.sql` (hq_artifact + artifact_version, run_id lineage, 6 operator-gated RPCs) + `apps/hq/src/builder-core/persist.ts`. `create_website`/`create_application` now persist a draft + v1; `revise_artifact`/`validate_artifact`/`save_version`/`restore_version` wired as real executors (`WIRED_BUILDER_SPECS` grew 2→6). Also fixed the B2-found `no-todo`/`placeholder=` false-positive in `validate.js`. Live-verified full loop (create→validate→revise→save→restore) + confirmed at the SQL layer | **Sonnet** | pattern-matches C2's migration exactly |
| B4 | Portable components | ✅ **SHIPPED, live-verified** — B4a design ([[B4a-Block-Design]], Fable) + B4b completion (Sonnet): all 20 blocks in `docs/arganta-core/blocks/` (the spec table has 20 rows, not 19 — corrected the doc's own count), `preview.html` harness (kit switcher, 375/1280 toggle, filled/empty toggle), `catalogue.md`, and `packages/builder/src/registry.js` (generated by `scripts/build-registry.js`, `npm run blocks:build`) exporting `PORTABLE_REGISTRY`. 9 new registry tests (36/36 builder package total): every block passes `isValidComponent`, ids/categories match spec exactly, no external hosts/eval/parent-access, all 20 assembled into one document pass `validate.js` with zero errors, `selectComponents` sanity checks. Live-verified in-browser: responsive collapse (nav-sidebar/nav-bottom), keyboard (nav-top hamburger+Esc, form-modal focus-trap+Esc+backdrop, kanban scroll-snap, chart segment focus), empty↔filled toggling, both kits. Found + fixed 3 real bugs during verification: an iframe `onload`-before-`srcdoc` race in the harness; chart blocks' JSON data-seam must be filled in the raw HTML string before first parse (their self-wiring IIFE reads it once, same as real B2 output) not via later DOM mutation; and a literal `</script>` substring inside a JS string inside an inline `<script>` tag silently truncated the whole harness script (classic HTML-tokenizer gotcha — fixed via `<\/script>`) | **Fable** (block design ✅) → **Sonnet** (completion + registry ✅) | blocks are aesthetic judgment; registry is wiring |
| B5 | Preview + publishing | 🟡 **CONTRACT FROZEN — [[../adr/0006-public-artifact-runtime]]** (Opus). Decisions: runtime is a **Cloudflare Worker** at `build.arganta.app/*` (isolates the public surface from the Supabase data plane, reuses `validate.js` as-is); a separate **`artifact_publication`** table (additive — leaves the frozen `hq_artifact` schema untouched) pins a published version independent of the draft's `current_version`; the CSP the Worker sets on every serve **is** `validate.js`'s `APPROVED_HOSTS` allowlist (`connect-src 'none'` + `img-src 'self' data:` close exfiltration); the Worker reads one live-only RPC and **re-runs `validateHtml` server-side** before serving. Sonnet builds the Worker + `migration_artifact_publications.sql` + `publish_artifact`/unpublish executors + UI; Opus does the final go-live review | **Opus contract ✅** → **Sonnet** (impl) → **Opus** (go-live) | public internet surface = new attack surface |

Sequencing: C1 ✅ → C2 ✅ → C3 ✅ → B1 ✅ → B2 ✅ → B3 ✅ → C4b ✅ → B4 ✅ → **B5 (next)**
→ C5 → C6 → C7. C8 after C3 and again after B5/C7. C9 parallel anytime.

**Founder action recommended before B1:** set `GEMINI_API_KEY` (free,
aistudio.google.com/apikey) as a Supabase secret. C3's live test proved the
loop mechanics work correctly, but the only tools-capable Sponsored provider
actually configured is Cloudflare's free Llama, which is slow and unreliable
at ending a tool loop — Gemini outranks it in registry priority and is
known-reliable at function-calling, so this alone should fix both without any
more code changes.

## See also
- [[Single-File-Builder]] — the app/website Builder kernel (B1–B5), Core's strongest hand
- [[../media-center/Persistence-and-Provider-Strategy]] — provider order + persistence-first (holds)
- [[../media-center/Compute-Substrate]] — the media substrate Arganta Core's hands call
- [[../agent-os-v2-grand-design]] — the office/mission layer C6/C7 grow into
- ADRs 0001/0003 — tier routing + data-classification governance (unchanged, inherited)
