# Circle AI — one free LLM runtime for the Video Director *and* the C-suite agents

**Status:** design/mapping (Opus, 2026-07-11). Implementation is pattern-following → Sonnet.
**Thesis:** build **one** provider-agnostic LLM adapter, tiered by task difficulty, and let
**both** consumers share it — the Video Builder's *Director chat* and Circle HQ's *C-level
agents*. Free-first: WebLLM (local, from Supabase) as the floor, free API tiers
(Gemini/Groq) for real reasoning, paid only if you ever want the best.

---

## 0. Why this is cheap and safe (the key insight)

Neither consumer asks the LLM to *know* things or *render* things — the heavy lifting is
already deterministic:

- **Video:** the engine renders; the synth voices; Supabase supplies media. The LLM only
  writes a **storyboard JSON**. Small task → small model is fine.
- **Agents:** `agentSense` (live SQL) + `agentCompute` (arithmetic) + `agentMatch`
  (thresholds) already produce **real facts**. The LLM only turns facts → prose/decisions.
  This is textbook grounding — it's why a modest free model is safe here.

So "free" is achievable because we never spend the model on the hard part.

---

## 1. The runtime: `@arganta/ai` (new shared package)

Sibling of `@arganta/audio` / `@arganta/video`. Client-agnostic, one OpenAI-compatible
surface over every provider.

```
packages/ai/src/
  adapter.js     // Provider interface + 3 impls (see §2). chat / chatJSON / chatTools, streaming.
  router.js      // task → tier → {provider, model}. Config-driven; operator can override.
  schemas.js     // the two data contracts: STORYBOARD_SCHEMA, AGENT_TOOL result shapes.
  webllm.js      // WebLLM engine wrapper + Supabase model_list (see §5).
  index.js
```

**Public API (what both consumers call):**
```js
const ai = createLLM(appConfig)                       // built once in apps/hq/src/lib/ai.ts
await ai.chatJSON({ task:'storyboard', schema, messages })   // → validated object
await ai.chatTools({ task:'orchestrate', tools, messages })  // → {text, toolCalls[]}
ai.chatStream({ task:'brief', messages }, onToken)           // → streamed prose
```

---

## 2. Providers (three impls behind one interface)

| impl | reaches | key? | use |
|---|---|---|---|
| **webllm** | in-browser Llama/Qwen/Phi via WebGPU, weights from **your Supabase bucket** | none | Tier 0 — free/local/offline/private |
| **openai-compat** | Gemini (OpenAI-compat endpoint), Groq, OpenRouter, Ollama | yes | Tier 1/2 — via the proxy below |
| **edge-proxy** | calls `supabase/functions/llm-proxy` which holds the key as a *secret* | server-side | how the browser reaches Tier 1 **without exposing the key** |

> **Security note:** a free API key shipped in client JS is world-readable. WebLLM needs no
> key (safe by default). For the cloud tiers, the browser talks to **`llm-proxy`** (operator-
> gated Edge Function, key in `supabase secrets`) — never the provider directly.

---

## 3. Tiering / routing (`router.js`)

```
task class                     → tier → default provider/model
────────────────────────────────────────────────────────────
storyboard, copy, classify,    → 0    → webllm  (Qwen2.5-1.5B, from Supabase)
tag, extract, offline-anything
reason, brief, orchestrate,    → 1    → edge-proxy → Gemini 2.0 Flash (free) | Groq Llama-70B
tool-calling, C-suite analysis
"best judgement" (opt-in)      → 2    → edge-proxy → Claude / GPT (paid)
```

**Maps onto the roster's existing tags** (no new taxonomy needed):

| `data/agents.ts` `model` | meaning today | → runtime |
|---|---|---|
| `det` | pure SQL + arithmetic | **stays deterministic — no LLM** (Sense/Compute/Match) |
| `haiku` | classify / sense | Tier 0 (webllm small) or Groq-small |
| `sonnet` | reason / debate | Tier 1 (Gemini/Groq free) → Tier 2 if opted in |

The operator sets, per tier, which provider to use — in a small Settings panel. Default is
all-free (webllm + Gemini free).

---

## 4. Where it plugs in — two seams, both already exist

### 4a. Video Director chat (the endgame front door)
```
prompt ──ai.chatJSON({task:'storyboard', schema:STORYBOARD_SCHEMA})──► storyboard
      { format, palette, fx, scenes:[{text,anim,dur}], voiceScript, sfx:[{cue,at}], visualTerms:[] }
          │  map → project (bgLayer + textLayers + format/fx)          [packages/video/src/director.js]
          │  renderVoice(voiceScript) → voice+captions+wave            [already built]
          │  importStock(visualTerms) → real footage from Supabase     [already built]
          ▼
     lands in the SAME project → timeline + inspector = manual edit    [already built]
```
"Editable manually as option" is free — the AI output *is* a normal project.
Format → storyboard length: short/reel 2–4 scenes · short-video 4–8 · long = fuller script.

### 4b. C-suite agents (the "more agentic" leap)
The pipeline in `data/agents.ts` keeps its deterministic spine; **only two changes**:

1. **`agentGenerate` template → real LLM.** Swap the scripted strings for
   `ai.chatStream({task:'brief', messages:[system(role), facts(computed,signals,sensed)]})`.
   Keep the current template as the **offline fallback** (when webllm/proxy unavailable) so
   it never fabricates — same honest-empty-state contract as the rest of HQ.
2. **CEO orchestrator gains real tool-calling.** Today `runScenario` is scripted. Replace with
   `ai.chatTools({task:'orchestrate', tools:AGENT_TOOLS})` where the tools ARE the things you
   already have:

```
AGENT_TOOLS (wrap existing capabilities — no new backend):
  sense_growth()      → live.growthOverview()        senseEconomy() → live.economy()
  run_scenario(id)    → scenarios[id].run()          content_matrix() → live.contentMatrix()
  monetization(assumptions) → computeScenario(...)    schema_insights() → live.schemaInsights()
  convene(agentIds, question)  → sub-agent generate over the SAME facts
```
Now the CEO agent *plans*: picks tools, reads real results, iterates, synthesises one
recommendation — genuinely agentic, still grounded in live SQL. (Optionally expose the
connected MCP office tools — `office_report`, `financial_model`, `valuation_*`, `root_cause`
— as additional tools once you want that depth.)

---

## 5. Hosting WebLLM weights in Supabase (Tier 0)

```
public bucket `models/`  ←  upload MLC-converted artifacts (params_shard_*.bin,
                             mlc-chat-config.json, tokenizer.json, *.wasm)
webllm.js appConfig.model_list = [{
  model:     "<proj>.supabase.co/storage/v1/object/public/models/Qwen2.5-1.5B-Instruct-q4f32_1-MLC/",
  model_id:  "director-local",
  model_lib: "<proj>.supabase.co/.../Qwen2.5-1.5B-Instruct-q4f32_1-ctx4k.wasm",
}]
```
Browser downloads once (~1 GB for a 1.5B), caches in Cache API → instant/offline after.
**Egress caveat:** storage is cheap; each *first* load spends ~1 GB of egress (Pro:
250 GB cached + 250 GB uncached/mo). Fine for an operator tool; browser caching makes it
one-time per user. Pick a **small** model (0.5–1.5B) to keep it light. Start on the default
HF CDN (free egress) and flip to Supabase by changing two URLs — no rewrite.

---

## 6. Data contracts (`schemas.js`)

**STORYBOARD_SCHEMA** (validated before mapping to a project):
```
{ format:enum(short|reel|square|long), palette:enum, durationSec:number,
  fx:{camera,grain,vignette,sweep,letterbox:bool},
  scenes:[{ text:string, anim:enum(cascade|cinematic|typewriter|pop|fade|slide|kinetic),
            durationSec:number, imageQuery?:string }],
  voiceScript:string, voiceId:enum, sfx:[{cue:string, atSec:number}] }
```

**AGENT tool-call result** = plain JSON `{ ok, data }` from each tool; the model reads
`data` (real numbers) and never invents them.

---

## 7. Build plan (hand to Sonnet)

- **P1 — runtime.** `packages/ai/` (adapter+router+schemas+webllm) · `apps/hq/src/lib/ai.ts`
  (build once, cloudEnabled-aware) · `supabase/functions/llm-proxy` (operator-gated,
  keys as secrets) · optional `models` bucket + upload a 1.5B. *No UI yet — unit-drive it.*
- **P2 — Video Director.** `packages/video/src/director.js` (prompt→storyboard→project) +
  a Director chat panel in `VideoBuilder.tsx` on `ai.chatJSON`. **Ships the endgame.**
- **P3 — Agent Generate.** Swap `agentGenerate` → `ai.chatStream` with the template as
  fallback. Small, high-value, low-risk (spine unchanged).
- **P4 — Agentic orchestrator.** `data/agentTools.ts` + `AgentOrb.runScenario` → real
  `ai.chatTools`. The "more agentic" leap.

Each phase is independently shippable and free by default.

---

## 8. What's free vs paid (net)

| | free | paid |
|---|---|---|
| Video Director (storyboards) | ✅ WebLLM local | — |
| C-suite prose/briefs | ✅ Gemini/Groq free tier (via proxy) | Claude/GPT if opted in |
| Agentic tool-calling | ✅ Gemini free (good tool use) | frontier for hardest calls |
| Model hosting | ✅ HF CDN (free) or your Supabase (own egress) | — |
| Determinism spine (Sense/Compute/Match) | ✅ already deterministic | — |

**One adapter, two consumers, free by default, paid only if you choose.**
