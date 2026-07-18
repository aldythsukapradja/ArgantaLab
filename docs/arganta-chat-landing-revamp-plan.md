# Arganta Chat — Landing Revamp: Strategy & Execution Plan

**Date:** 2026-07-18 · **Status:** FABLE PHASE COMPLETE — audited + F1–F5 delivered in `docs/arganta-chat/` (00-Plan-Audit, F1-Design-Language [FROZEN], F2-Component-Registry, F3-Question-Map, F4-Copy-Voice, F5-About-Migration, hearth-mock.html). Opus build not started; read 00-Plan-Audit.md first — it corrects O2/O3/O6 (copy-and-prune port, new `arganta_chat_*` tables + kid-deny RLS, kill the command tab, family chart registry replaces the HQ 24).
**Source brief:** founder request + `Arganta-LLM-Hierarchy-and-Execution-Strategy.md` (Obsidian)
**Owner doc for build:** this file. Workstreams are grouped **by LLM** (Fable vs Opus) for an end-to-end run.

---

## 1 · Vision

`apps/landing` stops being a camera-flight company deck and becomes **Arganta Chat** — an
external, independent, family-facing chatbot app. *"ChatGPT for family."*

- **Primary users:** mother and father. Zero technical vocabulary anywhere in the UI.
- **Kids are locked out.** Parent-only access gate.
- **Conversation is the primary interface; existing components are the response language**
  (LLM Hierarchy doc). Answers render as familiar Arganta cards/charts, not walls of text.
- The **current landing content is not deleted** — it moves under an **About** area as pills:
  `Company Profile · About · Products · Pitch` (the existing decks/tabs, re-used as-is).

### Alignment with the LLM Hierarchy doc

| Tier | Role | This app |
|---|---|---|
| Tier 0 Router | intent → tool/component | `@arganta/ai` four-tier router (already shipped: costClass 0–3) |
| Tier 1 Everyday | calendar, reports, stories | default chat brain (Sovereign / cheapest capable) |
| Tier 2 Premium | deep reasoning | escalation only, never default |
| Media | ComfyUI / media-core | behind approval, never inline-blocking |
| Operator | Claude Code / Codex | **NOT in this app.** The HQ tri-brain toggle does not ship here. |

---

## 2 · What we re-use (audit)

| Asset | Where | Re-use |
|---|---|---|
| Chat surface (ChatGPT-grade) | `apps/hq/src/surfaces/core/` — ThreadsRail, Conversation, Composer, Message, Markdown, StarterMenu, blocks/chart registry (24 charts), PreviewPane | **The engine of the whole app.** Already built to mount standalone (`ARGANTA_CORE_PROP_KEYS` embed contract, `resolveMountMode`). Strip HQ-isms: BrainToggle, BridgeConsole, CoreInspector, CortexPanel. |
| Four-tier router | `packages/ai` | Tier 0/1/2 routing, governance, ledger — wire as the only brain seam |
| Brand registry + marks | `packages/brand` (mark.js, registry.js, voice.js) + Brand Studio replicas | Exact logos/icons/palette/voice — marks are deterministic data, render straight from registry. **No new logo work.** |
| Kinetik login | `apps/kinetik/src/pages/Login.tsx` + auth CSS | Clone the parent card (Google OAuth, gradient/glow shell). **Delete the Kids tab entirely.** |
| Supabase auth | `apps/landing/src/lib/auth.ts`, `supabase.ts` | Session plumbing exists; replace "operator gate" with "parent gate" |
| Landing decks | `decks/GeneralDeck`, `EditorialDeck`, `PitchDeck`, `appscreens` tabs | Become the About pills, lazy-loaded, untouched internally |
| Usage tracker | `packages/usage` | Beats into `app_usage_beats` like the other 5 apps |

## 3 · Access gate (parents only, kids blocked)

- Kinetik parent login card, verbatim styling: logo mark → wordmark (Arganta, not KinetikCircle) → "Continue with Google".
- **No Kids tab, no PIN path.** Additionally hard-block at the seam: any session whose email ends
  in `@kids.argantalab.app` (the synthetic kid domain) is signed out with a friendly
  "This app is for parents — ask Mom or Dad" screen. Belt and suspenders: UI removal + runtime check + RLS policy on the app's tables (`email not like '%@kids.argantalab.app'`).
- Gate wraps the whole app: unauthenticated visitors see **Login + the About pills only**
  (About is public — it's the company page); Chat requires a parent session.

---

## 4 · Interface battle test

Three candidates were pressure-tested against the research findings (sources in §7):
non-technical users grok a **single search-style box** instinctively; the #1 chatbot failure is
**capability opacity** (users don't know what to ask); parents are **mobile, multitasking**;
answers should mix chat with **structured cards users can tap**; thread sidebars are
power-user furniture.

**Candidate A — "ChatGPT clone":** persistent left sidebar of threads, dense model/tool chrome.
✗ Fails the mom/dad test: the sidebar is meaningless on day 1, chrome reads technical, weak on mobile.

**Candidate B — "Claude minimal":** centered greeting, one composer, near-zero chrome, warm serif.
✓ Calmest, most trustworthy. ✗ Alone it fails capability transparency — a blank box gives a parent
nothing to start with, and family answers (calendar, kid progress) want rich cards, not prose.

**Candidate C — "Family dashboard hybrid":** home screen of cards (Today, Kids, Photos) with chat as one tab.
✓ Transparent. ✗ It's another app to learn; dashboards drift stale; contradicts "conversation is the primary interface."

### ✅ Winner: **B+C hybrid — "Warm Concierge"**

Claude's calm centered layout as the skeleton, with Candidate C's cards **inside the conversation**, not around it:

1. **Home = greeting + composer + 4–6 tappable starter cards** ("What's on our calendar this week?",
   "How is Baginda doing in math?", "Make a bedtime story", "Plan the weekend"). Cards ARE the
   capability transparency — parents learn by tapping, never by prompting. (StarterMenu already exists; it gets promoted from a menu to the home stage.)
2. **Answers render as Arganta components** — the existing 24-chart registry, calendar cards,
   kid-progress rings — with a short plain sentence above each. Tap-to-refine chips under answers ("this week → this month").
3. **No visible sidebar.** History lives behind one "Chats" button (drawer). Recency-grouped, auto-titled.
4. **No model pickers, no tier names, no tokens, no "AI" jargon.** Router escalation is invisible; a soft shimmer = thinking. One honest error pattern: "I couldn't do that — try…" with a retry chip.
5. **Mobile-first:** docked composer, thumb-reach starter cards, voice input button (multitasking parents), ≥17px type, generous tap targets. Desktop is the same layout centered at ~768px — one design, two widths.
6. **Branding:** exact `@arganta/brand` marks/palette/voice everywhere; warmth comes from the brand gradient glows already in the Kinetik auth shell.

**Why this wins:** it keeps the only pattern non-technical users universally trust (one box, one
answer), fixes that pattern's known blank-page failure with tappable cards, and turns our real
moat — the component registry — into the response language, which neither ChatGPT nor Claude can
do for *this family's* data. It is also the cheapest to build: ~80% is re-mounting Core chat.

---

## 5 · Information architecture

```
Arganta Chat (apps/landing, revamped)
├─ / ................. Chat home (gated) — greeting, starter cards, composer
├─ /chats ............ History drawer (gated)
├─ /about ............ Public. Pill bar:
│    [Company Profile] → GeneralDeck (camera-flight)
│    [About]          → appscreens 'about' tab content
│    [Products]       → appscreens 'products' + EditorialDeck launch
│    [Pitch]          → PitchDeck
└─ /login ............ Parent gate (Kinetik card, no kids)
```

---

## 6 · Execution plan — end-to-end, grouped by LLM

### 🟦 FABLE workstreams (design, specs, registries, audits — run first)

**F1 · Design spec freeze** — Write `docs/arganta-chat/Design-Language.md`: Warm Concierge tokens
(type scale, spacing, brand-gradient usage, card anatomy, shimmer/thinking states, error pattern,
mobile rules). Mirrors how C4a froze design before C4b built. Includes the About pill bar and login card specs.

**F2 · Component & reuse registry** — The LLM-doc's "shared component registry": audit
`surfaces/core/blocks.ts` + chart registry + Kinetik/landing cards; emit a manifest of
response components (id, props, when the router picks it). Mark HQ-only components excluded.

**F3 · Question map (50–100)** — Natural parent questions → intent → tier → component. This is
the router's ground truth AND the starter-card copy source. Include the LLM-doc calculations:
streaks, favourites, weaknesses, busiest day, free time — specify each formula against the
real Supabase schema (watch the `item_attempts` vs `diamond_ledger` activity-source gotcha).

**F4 · Copy & voice pass** — Every string in the app in `@arganta/brand` voice.js register:
greeting variants, starter cards, empty states, errors, the kids-blocked screen. Zero jargon rule enforced here.

**F5 · About migration map** — Exact inventory of what from today's landing survives into which
pill, what dies, and the redirect table for old hash routes (`#/pitch` → `/about?pill=pitch`).

### 🟧 OPUS workstreams (build — after F1/F2 freeze; F3–F5 can land in parallel)

**O1 · Shell swap** — New `App.tsx` router (chat home / about / login), strip the old tab shell,
keep decks lazy. Theme from `@arganta/brand` tokens.

**O2 · Parent gate** — Port Kinetik Login (parent tab only), kid-domain hard block + friendly
screen, session plumbing, RLS migration for the app's tables. Public About, gated Chat.

**O3 · Chat core mount** — Mount Core chat components standalone per the embed contract; delete
BrainToggle/Bridge/Inspector/Cortex; wire `@arganta/ai` router as the single brain
(Tier 0 route → Tier 1 answer → invisible Tier 2 escalation). Threads persist to Supabase
(re-use `migration_core_projects.sql` shape — check it's been run).

**O4 · Warm Concierge home** — Greeting + starter cards from F3, StarterMenu promoted to home
stage, tap-to-refine chips, shimmer states per F1. Voice input via the existing mic seam
(landing already has the self-hosted MediaPipe/mic work — reuse, fixed-phrase → dictation).

**O5 · Response components** — Wire the F2 registry: charts, calendar card, kid-progress rings,
story card. Media requests route to media-core behind an approve step, per the hierarchy doc.

**O6 · About pills** — F5 migration: pill bar, deck mounts, redirects, public SEO/meta as the
company page.

**O7 · Mobile + polish + battle test** — 375px pass, docked composer/keyboard safe-area, tap
targets, then a scripted battle test: run the 50–100 question map end-to-end, log
component-selection accuracy and tier cost, fix the top failures.

**O8 · Ship** — usage beats, deploy path, old-landing redirects live.

**Dependencies:** F1+F2 → O1–O4 · F3 → O4/O5/O7 · F5 → O6 · O2 gates O3.
**Not in scope:** ComfyUI direct wiring (orchestrator seam only), Claude Code/Codex operator layer, kids experience of any kind.

---

## 7 · Research sources

- [Setproduct — Designing AI chat interfaces](https://www.setproduct.com/blog/ai-chat-interface-ui-design)
- [IntuitionLabs — Conversational AI UI comparison](https://intuitionlabs.ai/articles/conversational-ai-ui-comparison-2025)
- [AI Design Patterns — Conversational UI](https://www.aiuxdesign.guide/patterns/conversational-ui)
- [Mind the Product — Nine UX best practices for AI chatbots](https://www.mindtheproduct.com/deep-dive-ux-best-practices-for-ai-chatbots/)
- [Fuselab — Chatbot UI design patterns 2026](https://fuselabcreative.com/chatbot-interface-design-guide/)
- [Lollypop — Chatbot UI/UX best practices](https://lollypop.design/blog/2025/january/chatbot-ui-ux-design-best-practices-examples/)
- [ParallelHQ — UX principles for user trust](https://www.parallelhq.com/blog/ux-ai-chatbots)
- [Lazarev — 33 chatbot UI examples](https://www.lazarev.agency/articles/chatbot-ui-examples)
