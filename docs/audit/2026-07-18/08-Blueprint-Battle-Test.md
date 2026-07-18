---
date: 2026-07-18
tags: [arganta, audit, architecture, battle-test]
title: Blueprint Battle Test — Stress-Testing Every Bet
---

# Blueprint Battle Test

Adversarial pass over [[07-Technology-Blueprint-2yr]]: for each bet, the strongest attack I can mount, and whether the blueprint survives.

## Attack 1 — "Supabase won't scale / vendor lock-in"
**Attack:** entire company on one BaaS vendor; RLS-heavy design is hard to migrate; at 1M families you outgrow it.
**Verdict: survives.** At the 24-month horizon the ceiling is ~10⁴–10⁵ families — comfortably inside Postgres-on-Supabase. RLS is *Postgres*, not Supabase — the exit path (self-hosted PG + PostgREST or a thin API) preserves the whole schema. The real lock-in risks are Auth and edge functions; mitigation is already in the blueprint's shape: all family access goes through **one door** (chat-brain), so a future API layer replaces one file, not fifty call sites. **Amendment:** keep edge functions thin (routing/auth only, logic in shared packages) so they're portable. Deferring a microservices/K8s conversation until >10⁵ families is correct, not naive.

## Attack 2 — "By 2028, OS-level AI assistants (Apple/Google/OpenAI) do family scheduling natively — your assistant layer is commoditized"
**Attack:** the strongest one. Siri/Gemini with calendar+memory could eat the logistics wedge.
**Verdict: survives only because of the memory+kids layers.** This is why R3 (consented family memory as schema) and Phase 4 (knowledge graph) are load-bearing, not nice-to-have: platform assistants will have *a user's* context, not *a family's* consented shared context, and none will run your kids' learning loop. The blueprint's answer to commoditization is to make the assistant the *interface* and the memory graph the *product*. **Amendment:** treat platform assistants as channels, not rivals — Phase 3 should expose family data *to* them (ICS feeds now; MCP-style/App-Intents surface later) so "works with Siri" becomes a feature.

## Attack 3 — "Model churn breaks you / free-tier providers vanish"
**Attack:** the router leans on free tiers (Workers AI, WebLLM, local ComfyUI); free tiers are historically temporary; models deprecate quarterly.
**Verdict: survives by design** — R1 (models-as-config) is precisely the hedge, and the sovereign tier (local inference) is the floor that can't be revoked. Two real amendments: **(a)** budget a real paid tier into unit economics now (~$0.10–0.30/family/month of inference at wedge usage — fits inside $4.99 with margin); **(b)** kill D2 first — a vanished free tier must degrade *loudly*, never to mock (the Stage-1-never-fired lesson, and llm-proxy's current state, prove this is your #1 operational failure mode, self-inflicted twice already).

## Attack 4 — "PWA-first is wrong; families live in app stores"
**Attack:** discovery, push reliability (iOS Web Push is second-class), kids' devices — all favor native.
**Verdict: partially lands.** PWA-first for Phase 1 is right (one founder, one codebase, instant iteration, no review cycle for pilot families). But the blueprint's Phase 3 Capacitor wrapper should be **pulled forward to Phase 2** if pilot data shows notification delivery failing on iOS — the Sunday-reset and remembered-detail moments *are* notifications; if they don't arrive, the emotional product doesn't exist. Decision gate added: measure push delivery in the 10-family pilot; iOS delivery <90% ⇒ Capacitor immediately.

## Attack 5 — "Solo founder can't operate this surface even after the freeze"
**Attack:** even the spine (PWA + edge fns + workers + ComfyUI + staging + CI) is a lot for one person 2 years straight.
**Verdict: survives with discipline.** The blueprint already deletes ~60% of operated surface via the freeze. Remaining ops burden is genuinely small (Supabase+Vercel+CF are managed; ComfyUI is optional-with-fallback by design). The honest residual risk is not capacity but *drift* — the [[03-Gap-Analysis]] G3 pattern re-entering through "Phase 4 knowledge graph" style shiny work early. Mitigation is the phase-gating itself: each phase has an exit criterion tied to users, not code. **Amendment:** Phase 4 items may not start before 300 active families — write that number down.

## Attack 6 — "Family AI + kids = regulatory landmine (COPPA/GDPR-K/AI acts)"
**Attack:** child-directed AI features draw scrutiny; one incident is fatal ([[05-Unicorn-Path]] kill-list #3).
**Verdict: survives — architecture is unusually well-positioned, execution must catch up.** Kids-hard-denied at the wall, parent-only AI access, consent bits in the memory schema, no-training pledge, sovereign inference option: this is a *better* compliance story than most incumbents. Gaps to close in Phase 1 (already listed): verifiable parental consent at signup, working export/delete, retention policy, and a plain-language privacy page. The privacy posture should be marketed, not just implemented.

## Attack 7 — "The blueprint under-uses the repo's actual superpower (media/content machine)"
**Attack:** blueprint freezes the studios, but the content fabric is the only live distribution asset.
**Verdict: correct as written** — the studios are frozen *as products*, kept *as the launch content machine* (explicit in the correlation table). No amendment; just guard against the machine drifting back into five-brand output.

## Surviving blueprint — net amendments applied
1. Paid inference tier priced into unit economics from day one.
2. Loud-failure policy replaces silent-mock in all prod paths (Phase 0, non-negotiable).
3. Capacitor pulled to Phase 2 if iOS push <90% in pilot.
4. Platform assistants treated as channels (ICS now, intents later).
5. Phase 4 hard-gated behind 300 active families.
6. Edge functions stay thin/portable.

**Overall:** the blueprint holds. Its riskiest dependency is not a technology — it is the same founder-focus risk every note in this audit converges on. The architecture is ready for two years of model churn, platform-assistant pressure, and scale to 10⁵ families; the plan fails only if the freeze list does.

Index: [[00-Arganta-Audit-Executive-Summary]]
