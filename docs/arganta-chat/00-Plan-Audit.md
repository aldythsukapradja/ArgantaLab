# Arganta Chat · Plan Audit (battle test of the strategy)

**Date:** 2026-07-18 · **Verdict: plan holds, with 7 corrections.** All corrections are folded
into the Fable deliverables (F1–F5) and the Opus workstream notes below.

## Findings

**A1 · Core chat is NOT a drop-in mount — the "80% reuse" claim was optimistic.**
Verified imports: `Conversation`/`Message` pull from `apps/hq/src/lib/core` (thread CRUD),
`lib/ai` (intelligenceRegistry), `data/agents` (OFFICE_META), `lib/modelPreference`;
`ThreadsRail` pulls `builder-core/persist`, `lib/mediaAssets`, `lucide-react`; `ArtifactCard`
pulls `lib/core/chartRegistry`. The `ARGANTA_CORE_PROP_KEYS` embed contract exists
(`packages/agent/src/embed.js`) but governs props, not module coupling.
**Correction:** O3 becomes **copy-and-prune** into `apps/landing/src/chat/` (not a shared
package extraction — that would destabilize HQ mid-flight). F2 now carries the exact
porting map: what to copy, what each import is replaced with, what is deleted.
Realistic reuse: ~60% of chat code, 100% of the design lessons.

**A2 · The router is more ready than the plan assumed.** `useCoreStatus` proves live free-tier
brains today: Gemini Flash, Groq Llama 3.3/3.1-8B, Cloudflare — selected by the same
`selectModel()` the turn loop uses, with an honest `agent_runs` ledger. Tier 0/1 is real,
not aspirational. **Correction:** O3 shrinks; no new routing work, only re-pointing.
⚠ Carry-over gotcha: the llm-proxy edge function has returned non-2xx before
(`builder-stage1-never-fired`) — O3 must verify a real 200 end-to-end, not trust flags.

**A3 · The question map has real data to stand on.** Verified live tables:
`kinetik_events`, `kinetik_routines`, `kinetik_trip(+activity,expense)`, `kinetik_meal_plan`,
`kinetik_recipe`, `kinetik_grocery_(basket,run)`, `kinetik_padel_*`, `kinetik_vault_(budget,
expense,sub,doc)`, `kinetik_moments`, `kinetik_people`, plus ArgantaLab learning
(`item_attempts`, `diamond_ledger`, cloud rings). F3 maps every question to a real table.
⚠ Activity-source gotcha stands: "practice activity" = `item_attempts`; "diamonds" =
`diamond_ledger` — never interchangeable.

**A4 · Threads need their own tables.** HQ Core persists to HQ-shaped tables; a family app
must not share them (different RLS story, different lifecycle). **Correction:** O3 includes
`migration_arganta_chat.sql` — `arganta_chat_threads` / `arganta_chat_messages`, owner =
auth.uid(), plus the kid-domain deny (`auth.email() not like '%@kids.argantalab.app'`) on
every policy. Belt (no Kids UI) + suspenders (runtime signout) + floor (RLS).

**A5 · The old landing's `command` tab must not migrate.** It's the operator cockpit
(live HQ embeds behind the ◆ operator gate). A family app must never show it.
**Correction:** F5 kills it; the ◆ LoginButton pattern is retired — the parent gate replaces it.

**A6 · Arganta brand voice is founder-lane (Supabase overlay), empty in git.** `voice.js`
`voiceBlock()` works, but the Arganta BrandDoc's `voice{}` in git is `{}`. **Correction:**
F4 ships the full string catalog AND the founder-lane voice fields (persona, adjectives,
forbidden words) as a proposed overlay — founder approves it in Brand Studio, then Core
speaks with it. Until approved, F4's literals are the source of truth.

**A7 · The brand palette demanded a design decision the plan didn't make.** Arganta v2 =
Ember gradient `#DCA254→#8F6B3C`, grounds Night Loam `#15161B`/`#101116` and Starpaper
`#F2F1EC`, ink `#C4C9D4`/`#3A3D45`. Every sibling surface is dark-first (HQ, decks).
**Decision (F1):** Arganta Chat defaults **LIGHT — Starpaper ground** with auto dark.
Reasoning: parents use this at breakfast and in daylight; warm paper + ember reads
"family letterpress", instantly differentiating it from every dark cockpit in the fleet
and from ChatGPT's clinical white. Dark mode inherits Night Loam so the brand stays whole.

## Revised Opus notes (carry into the handoff)
- O3 = copy-and-prune per F2's porting map + `migration_arganta_chat.sql` + real-200 router check.
- O2 = RLS deny-kid floor is part of the same migration.
- O6 = drop `command`; redirect `#/command` → `/login`.
- Everything else in `docs/arganta-chat-landing-revamp-plan.md` §6 stands.
