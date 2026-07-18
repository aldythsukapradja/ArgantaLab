# F2 · Component & Reuse Registry (the porting map)

**Purpose:** the LLM-hierarchy doc's "shared component registry", made concrete. Two parts:
(1) what Opus copies from where and what each HQ import becomes; (2) the response-component
manifest the router selects from. Rule: **chat implements answers with these components
before inventing new ones.**

## ⚠ Audit correction (supersedes the plan's wording)

The HQ chart registry's 24 entries are **founder analytics** (ARR, retention, agent runs) —
never shown to parents. What we reuse is the **mechanism**: the terms→`pickChart()` matcher,
the no-fallthrough rule (ambiguous → picker card, never a wrong chart — the C5-B1 lesson),
the derived-starter guarantee (a starter ships only if it resolves to its own component),
and the five recharts renderers (area/bar/line/pie/heatmap). The **entries** are replaced by
the family set below, with vocabulary from F3.

## 1 · Porting map (copy-and-prune into `apps/landing/src/chat/`)

| Source (apps/hq/src/surfaces/core) | Action | HQ import → replacement |
|---|---|---|
| `Conversation.tsx`, `Message.tsx`, `Markdown.tsx`, `Composer.tsx`, `blocks.ts` | **COPY** | `../../lib/core` → new `chat/lib/core.ts` (Supabase CRUD on `arganta_chat_*` tables); `data/agents` OFFICE_META → delete (no offices); `lib/modelPreference` → delete (no picker); `lib/ai` intelligenceRegistry → thin wrapper over `@arganta/ai` `selectModel()` |
| `ThreadsRail.tsx` | **REWRITE as `Drawer.tsx`** (F1 §3.3 is much smaller) | drop `builder-core/persist`, `mediaAssets`, artifact strip; keep recency grouping + auto-title + delete/undo logic |
| `ArtifactCard.tsx` chart path + picker card | **COPY** | `lib/core/chartRegistry` → new `chat/familyCharts.ts` |
| `StarterMenu.tsx` + `promptStarters.ts` | **PATTERN ONLY** → `HearthCards.tsx` | derive starter cards from the family registry exactly as `pillFor()` does — the resolves-to-itself guarantee is the crown jewel, keep it |
| `useCoreStatus.ts` | **DROP** (quota gauges are operator UI) | keep only a boolean `online` probe |
| `ArgantaMark.tsx` | **REPLACE** with `@arganta/brand` mark.js render (breathing per F1 §2.4) |
| BrainToggle, BridgeConsole, CoreInspector, CortexPanel, ModelPicker, PreviewPane, CoreHelp, ProviderLogo, Claude/OpenAI marks | **DELETE** — operator/HQ-only |
| `core.css` | **DO NOT PORT.** New stylesheet from F1 tokens; the HQ skin is a dark cockpit |

Also copied wholesale: `apps/kinetik` Login card + auth CSS (parent tab only, ember recolor);
landing `decks/*`, `PitchDeck`, `appscreens` About content (mounted by F5); landing mic seam
for dictation; `packages/usage` beat hook.

## 2 · Response-component manifest (what the router can answer WITH)

Every component: one plain sentence above, refine chips below (F1 §3.2). `props` are the
contract Opus builds to; data fetchers live beside the component, badged by provenance.

| id | renders | data | notes |
|---|---|---|---|
| `answer.text` | short prose (Markdown.tsx subset) | — | default; ≤3 sentences doctrine |
| `week.strip` | horizontal 7-day calendar strip, events as ember dots + labels | `kinetik_events`, `kinetik_routines` | THE flagship card; tap a day → refine |
| `day.agenda` | single-day vertical agenda | same | "what's today/tomorrow" |
| `kid.progress` | ring + streak flame + 1-line trend | cloud rings (`todayWorldXp`), `item_attempts` | activity = item_attempts, NEVER diamond_ledger |
| `kid.compare` | small-multiple rings per kid | same | multi-kid households |
| `chart.family` | recharts area/bar/line/pie/heatmap | per F3 entry | family registry, picker on ambiguity |
| `budget.pulse` | spend vs budget bar + top categories | `kinetik_vault_budget/expense/sub` | money = calm tone, no red |
| `meals.week` | 7 meal tiles + grocery status | `kinetik_meal_plan`, `kinetik_recipe`, grocery tables | tap tile → recipe card |
| `recipe.card` | ingredients + steps | `kinetik_recipe` | |
| `trip.card` | trip header + next activities + spend | `kinetik_trip*` | |
| `moment.card` | photo moment tile(s) | `kinetik_moments` | read-only at launch |
| `story.card` | title + story text, Fraunces, read-aloud button | Tier-1 generation | bedtime staple; read-aloud = existing TTS seam |
| `picker.card` | "did you mean…" 2–4 options | — | the anti-guess card, verbatim from HQ |
| `error.card` | honest sentence + retry chip | — | F4 §6 strings |

**Family chart registry starter set** (replaces the 24): `busiest-day` (bar, events/day),
`practice-week` (area, item_attempts/day), `streaks` (bar per kid), `spend-by-category`
(pie, vault), `activity-mix` (pie, worlds practiced), `showing-up` (heatmap hour×day —
reuse punchcard renderer). Vocabulary per entry comes from F3's question phrasings.

**Not in scope at launch:** write actions (creating events, buying), media generation cards
(approval-gated later per hierarchy doc), padel components (data exists — v1.1 candidate).
