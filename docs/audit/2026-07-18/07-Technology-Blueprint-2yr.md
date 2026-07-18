---
date: 2026-07-18
tags: [arganta, audit, architecture, blueprint]
title: Technology Blueprint — Today's Baseline → 24 Months
---

# Technology Blueprint (2026-07 → 2028-07)

Grounded in a code-level dive, not aspiration. Battle-tested in [[08-Blueprint-Battle-Test]]. Serves the wedge strategy of [[06-Wayforward-90-Days]].

## Part 1 — Baseline: what the technology actually is today

**Stack:** React + Vite + Zustand SPAs · Supabase (Postgres + RLS + Auth + Storage + Deno edge functions) · Cloudflare Workers (AI + content worker) · local ComfyUI (sovereign media) · 11 shared packages · Vercel deploys.

**Verified strengths (keep, these are the spine):**
1. **`arganta-chat-brain` is the crown jewel.** Structural security wall: parent-JWT-only, kids hard-denied, explicit tool allowlist (`get_week`, `get_today`, `get_kid_reports`, `add_event`, `publish_post`…), no service role, RLS as the real boundary, sovereign→sponsored→honest-failure provider ladder. This is *exactly* the right architecture for a family AI product and most competitors don't have it. The declared-but-unbuilt allowlist entries are literally the wedge's assistant roadmap.
2. **RLS-first data model.** Family/circle isolation enforced in Postgres, not app code. Correct and rare.
3. **Tiered AI routing** (@arganta/ai: task→tier→provider, cost classes 0–3, config-driven). Right abstraction for the next 2 years of model churn — models are config, not code.
4. **Sovereign-first media** (ComfyUI local, cloud fallback). Cost moat + privacy story.

**Verified liabilities (the future-proofing debt):**
- **D1 — Schema anarchy:** 80+ ad-hoc `migration_*.sql` files, only 2 timestamped/ordered. No reproducible database. Cannot spin up staging, cannot onboard a hire, cannot trust prod = repo.
- **D2 — Silent-mock failure mode:** router "always returns SOMETHING (falls back to mock)" — the exact bug class that hid Stage-1-never-fired for months. Honest failure must beat fake success everywhere users are real.
- **D3 — No environments:** one Supabase project is prod+dev+lab (second project idle). No staging, no CI, no tests on customer apps, no error telemetry from real users.
- **D4 — SPA-only clients:** no offline, no push notifications, no home-screen presence. A family calendar that dies without signal is not a family calendar.
- **D5 — Memory is a concept, not a system:** "family memory" exists as scattered tables + a vault; no unified memory store with provenance, consent flags, and retrieval.

## Part 2 — Target architecture ("the Arganta Spine")

One diagram, five layers, everything in the repo either maps onto it or is frozen:

```
CLIENTS      Arganta PWA (family) · HQ (founder cockpit) · Kids surfaces
             — installable, offline-first cache, push —
API WALL     arganta-chat-brain (family door) · hq proxies (founder door)
             — the ONLY doors; tool allowlists; JWT+RLS —
INTELLIGENCE @arganta/ai router (models-as-config) · media-core ladder
             — swap models freely for 2 yrs without app changes —
MEMORY       Family Memory Store (new, the moat): facts + events + moments
             + kid-progress, each row: {source, consent, family_id, embedding}
DATA/INFRA   Supabase (ordered migrations, prod+staging) · CF Workers · Storage
```

Design rules (the "future-proof" part):
- **R1 — Model-agnostic by contract:** no app code names a model; only the router config does. LLMs will change 4× in 24 months; Arganta shouldn't notice.
- **R2 — Every AI answer is grounded via tools, not context-stuffing:** the allowlist pattern generalizes — assistant capability = adding a data-only tool behind the wall. Cheap, auditable, safe.
- **R3 — Memory with consent bits is the schema, not a feature:** every memory row carries `consented_by`, `visibility(kid|parents|family)`, `source`. This makes the privacy philosophy *queryable* — and is the un-copyable asset by 2028.
- **R4 — Honest degradation everywhere** (chat-brain style), mock only behind an explicit dev flag.
- **R5 — One database truth:** timestamped migration chain, `db reset` reproduces everything; the 80 legacy files get squashed into `000_baseline.sql` once and archived.

## Part 3 — 24-month phased plan

**Phase 0 (months 0–2) — Foundation debt.** Squash migrations→baseline; wake the idle Supabase project as **staging**; minimal CI (typecheck+build+db-lint on PR); Sentry (or Supabase logs drain) on kinetik/landing; kill silent-mock in prod paths. *Exit: a stranger-ready, reproducible platform.*
**Phase 1 (months 2–6) — Wedge on the Spine.** Implement the declared chat-brain tools (get_week/get_today/add_event/get_kid_reports) on caller-JWT; ship Family Memory Store v1 (plain tables + consent bits, no vectors yet); PWA-ify kinetik (manifest, service worker, Web Push); onboarding + export/delete. *Exit: [[06-Wayforward-90-Days]] launch runs on this.*
**Phase 2 (months 6–12) — Memory becomes intelligence.** pgvector embeddings over the memory store; proactive digests (cron → push: Sunday reset, "one year ago"); voice in/out on mobile (the "ask Arganta" moment is spoken in a kitchen, not typed); kid-progress pipeline from KinQuest engine → `get_kid_dashboard`. *Exit: the 5 signature moments of [[04-Emotional-Brand-Audit]] all fire automatically.*
**Phase 3 (months 12–18) — Scale & platform.** Native wrapper (Capacitor — reuses the entire React codebase) for app-store presence; multi-region readiness + Indonesian/bilingual assistant; integration doors (school calendars/ICS, WhatsApp ingest — Ollie-style meeting families where they are); SOC2-lite/COPPA posture docs. *Exit: 1,000-family capable.*
**Phase 4 (months 18–24) — The moat compounds.** Family knowledge graph over memory (relations, traditions, milestones); agentic routines behind the wall (assistant *does*: books, reminds, prepares — always parent-approved, reusing the approval-gate pattern already built for Arganta Bridge); Kids Workspace GA on the heroes/combat engines. *Exit: "family OS" defensibility of [[05-Unicorn-Path]] Stage 2–3.*

## Part 4 — Explicit repo correlation (nothing wasted, everything placed)

| Existing asset | Blueprint fate |
|---|---|
| arganta-chat-brain | **Becomes the product's core** (Phase 1) |
| @arganta/ai, media-core | Intelligence layer as-is (R1) |
| Kinetik calendar/moments/circles | Client + data layer of the wedge |
| KinQuest/heroes/combat engines | Dormant until Phase 4 Kids Workspace |
| Post Studio + Buffer pipeline | Growth tooling (unchanged, one brand) |
| Usage tracker + hq_engagement | Repointed at real-family telemetry (Phase 0–1) |
| Agent OS/Bridge approval-gate | Pattern reused for Phase 4 agentic routines |
| Vault, Reactor, studios, games | Frozen per [[06-Wayforward-90-Days]] |

Stress-test of every bet: [[08-Blueprint-Battle-Test]].
