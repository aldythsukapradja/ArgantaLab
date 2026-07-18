# G1 · Grounding Audit — every pixel traced to a real row

**Date:** 2026-07-18 · **Trigger:** founder mandate — *"my focus is only calendar, argantalab,
and posting, all grounded on real data and components from Kinetik/ArgantaLab."*
**Result:** every sample/fabricated branch is DELETED from the app, not hidden.

## 1 · How ChatGPT/Claude actually stay grounded (research)

The pattern behind both products' personal-data features is consistent, and it is NOT
"ask the model and hope":

1. **Retrieval before generation.** Personal answers are RAG-shaped: the system fetches the
   user's real rows first, then the model (or template) only *phrases* what was fetched.
   The model never originates a number ([Claude docs on reducing hallucinations](https://platform.claude.com/docs/en/test-and-evaluate/strengthen-guardrails/reduce-hallucinations)).
2. **Permission to say "I don't know."** Anthropic's own guardrail guidance: explicitly allow
   the assistant to decline; grounding in quotes/citations from the retrieved context.
3. **Tools over context-stuffing.** Both ecosystems moved to connectors (MCP, ChatGPT
   connectors) that query the source live rather than pasting data into prompts — stale
   pasted context is where the "lost in the middle" hallucinations come from
   ([memory comparison](https://www.memorylake.ai/en/blogs/ai-memory-compared-2026), [Claude features](https://suprmind.ai/hub/claude/features/)).
4. **Memory is synthesized, provenance kept.** 2026 memory systems (ChatGPT Dreaming, Claude
   Chat Memory) summarize real conversations on a schedule; they don't invent biography
   ([LumiChats overview](https://lumichats.com/blog/chatgpt-memory-vs-claude-memory-vs-gemini-personal-intelligence-2026-which-ai-actually-knows-you)).

**Arganta Chat's translation:** the brain is a Tier-0 *router to fetchers*, not a text
generator. Every answer = fetch real rows → render a real component → phrase a lead sentence
from the fetched values. Empty fetch → honest empty sentence. Failed fetch → "couldn't reach
your data." Nothing else exists. This is the same law HQ already enforces with provenance
badges — never present simulated as measured.

## 2 · The audit — where every answer's data comes from now

| Surface | Data source (real) | Status |
|---|---|---|
| Week / Today / Busiest | `kinetik_events` + `kinetik_routines`, circle-scoped, Mon–Sun window | ✅ grounded (busiest now computed from the real week, was sample) |
| Calendar component | **KinetikCircle cal2 board, ported**: dow/date headers, today = gradient disc + glow ring, energy-colored event chips (`ENERGY` palette + `energyOf()` copied verbatim from `apps/kinetik/src/data/energy.ts`), routines desaturated | ✅ Kinetik-faithful |
| Kids reports | `circle_members` → `child_profiles` → `kid_dashboard` RPC (same server truth as ArgantaLab Grown-ups page); streak/accuracy/active-days derived identically to `parentDash.ts` | ✅ grounded |
| **Pulse card (Hearth)** | was HARD-CODED — the worst violation in the app. Now composed live from today's real events + real top streak; renders nothing when there's nothing true to say | ✅ fixed |
| Story/post composer | real streak ≥2 → streak post; else real week count → week post; **else `null`** and the chat says "nothing real to share — I never invent a win" | ✅ grounded |
| Greeting name | Google profile via session | ✅ |
| Circle selector | `circles` table (RLS-scoped) + All-circles fan-out | ✅ |
| Budget / meals / trips / bedtime story / write-actions | **REMOVED** (cards deleted, intents answer honestly "not connected yet") | 🗑 per founder |
| Free-text LLM floor | not wired (would be ungroundable today) → honest can't-catch reply | ⏸ deliberate |

Deleted in this pass: `sampleWeek()`, `SAMPLE_KIDS`, all sample answer branches, the sample
story fallback, budget/dinner/story/trip starter cards, the dead budget/chart/story renderers
and their CSS. The word "sample" no longer appears in a parent-visible path (the dev-only
offline circle list remains, dev builds only).

## 3 · Bugs fixed in this pass

- **Not scrollable:** the landing's global stylesheet pins the page for the camera-flight
  decks, so the chat had no scroll context. `.ac-root` is now its own scroll container
  (`height:100dvh; overflow-y:auto`); the sticky composer sticks to it.
- **"No Instagram channel connected yet" was hiding the real error.** `getChannels()`
  swallowed every failure into the same message. Now: worker/edge-function errors surface
  verbatim in the card (e.g. "ARGANTA_CORE_URL not configured", "Worker 401"), and
  supabase-js's generic "non-2xx" is unwrapped to the function's actual error body.
  → Founder: re-run **Share this week** and read the message under the button; it now names
  the real cause. Likely candidates: secret name typo, worker token mismatch, or Buffer
  genuinely listing no channel for the token.

## 4 · Answering "did you miss a lot, or is this the next step?"

Honestly: the sample layer was scaffolding I chose so the whole UX was demoable before the
fetchers existed — but it violated the grounding law this project inherits from HQ, and the
Pulse being hard-coded was a real miss, not a plan. This audit removes the entire class:
there is now no code path that can show a parent an invented number.

## 5 · Still open (the honest list)

1. **Publish end-to-end unverified** — blocked on whatever the now-surfaced channel error says.
2. **Thread persistence** — tables exist (migration run); chat still in-memory, wiring is next.
3. **Kid deep-cut** — mastery grid / gaps (parentDash has it all server-side already).
4. **LLM free-text floor** — only with retrieval attached, per §1; never before.
