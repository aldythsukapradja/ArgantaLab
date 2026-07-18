---
date: 2026-07-18
tags: [arganta, audit, gaps, roadmap]
title: Remaining Success Gaps — the Final Sweep
---

# Remaining Success Gaps

Final sweep: everything a successful consumer app needs that notes 00–17 haven't yet assigned. With this, the dossier is complete. Numbered S1+ to distinguish from [[03-Gap-Analysis]] G-gaps and [[12-Dossier-Gaps-and-Fundraising-Roadmap]] D-gaps.

## Product & growth ops

- **S1 · Lifecycle/CRM system.** Nothing owns the user's journey after signup: welcome sequence, day-3 nudge, dormancy win-back, weekly digest email. Retention is manufactured here, not in features. *Fix:* Supabase auth hooks → Resend (or similar) with 5 lifecycle emails; the Sunday-reset push IS a lifecycle program — design them together (Phase 1).
- **S2 · Referral loop.** [[13-Social-Media-Strategy]] gets strangers; nothing converts a happy family into 2 more. Family products spread household→household (grandparents, co-parents, then *other families* via kid friendships + school circles). *Fix:* circle-invite flow already exists — instrument it, then add "invite another family" with a both-sides reward (extend trial, not diamonds). Phase 2.
- **S3 · Activation analytics + experiment discipline.** The usage tracker exists but nothing defines the activation funnel (signup → calendar seeded → first assistant answer → Sunday reset #1) or supports A/B. *Fix:* funnel events named per [[12-Dossier-Gaps-and-Fundraising-Roadmap]] D9; one-experiment-at-a-time doc during pilot. No new tooling — the D3 chart kit and RPCs are enough.
- **S4 · ASO / store presence.** Blueprint Phase 3 ships Capacitor but nobody owns keywords, screenshots, review prompts, rating-gate flow. *Fix:* week before store launch; ask-for-review only after a signature moment fires (quiet-pride register per doctrine voice).
- **S5 · Pricing page + paywall mechanics.** Monetization plan exists on paper; there's no actual paywall, trial logic, or family-plan checkout (Stripe/RevenueCat decision unmade — RevenueCat if store-first, Stripe if web-first; **decide with the Capacitor gate**, [[08-Blueprint-Battle-Test]] amendment 3). Fake-door price test comes first ([[06-Wayforward-90-Days]] days 31–60).
- **S6 · "Fridge mode."** [[17-Competitor-Benchmark]] finding: Skylight/Hearth prove $300 willingness-to-pay for a glanceable kitchen display. A `/board` route (old tablet, always-on Today board) is days of work on the Today-board architecture and neutralizes the hardware category's entire pitch. Phase 2, high leverage.

## Trust & operations

- **S7 · Customer support system.** Pilot families will hit bugs at dinner time. No channel, no SLA, no FAQ. *Fix:* pilot = founder WhatsApp/Telegram group (feature, not cost — it's also the research channel); public launch = in-app "message us" → shared inbox, 24h SLA, 10-article help page. The assistant answering product questions is Phase 2 free support.
- **S8 · Community.** Retention's strongest non-product lever; also where [[16-Brand-GroundTruth-and-Exemplars]]'s ID-register research happens. *Fix:* one pilot-parents group chat now; a real community space only after 300 families (gate it like Phase 4).
- **S9 · Status & incident communication.** [[09-Cybersecurity-Battle-Test]] has the IR one-pager; missing is the mundane version — status page + in-app degradation banners (chat-brain's honest-failure pattern surfaced to UI). Phase 1.
- **S10 · Content moderation & abuse.** Circles + publishing + AI generation = UGC surface. Missing: report/block, image-gen safety filter on family prompts, a written abuse policy (ToS + kid-safety wording — fold into D5 regulatory memo). Phase 1 minimal: report button + generation blocklist.

## Founder & system

- **S11 · Founder sustainability.** The plan assumes ~1 person × 24 months × 6 roles. No vacation protocol, no "app runs while founder sleeps" test (everything self-heals? cron digests fire unattended?). *Fix:* one deliberate 5-day hands-off test during pilot — it doubles as an ops audit. Also the honest trigger for hire #1 (growth, month ~6, funded by the angel round).
- **S12 · The quota constraint is a business risk, not an anecdote.** Today's session ran at 3% weekly AI quota. Engineering capacity = AI budget; it belongs in the D3 financial model as a line item (Claude Max/API budget), and build cadence should be planned around it (batch weeks) rather than suffered.
- **S13 · Doctrine-to-repo sync debt.** This audit (notes 00–18) now contradicts parts of the live canon: desire map is pre-consolidation ([[16-Brand-GroundTruth-and-Exemplars]] C2), brand registry models 5 brands, CLAUDE.md/vault don't reference the freeze. *Fix:* one "canon sync" session — update doctrineData.ts desire map, brand registry, and a FOCUS.md at repo root pointing to this audit folder, so every future AI session inherits the freeze by default. **This is the cheapest defense against kill-risk #1** ([[05-Unicorn-Path]]).

## Completeness declaration

With S1–S13, the dossier covers: vision, product, tech, security, brand (canon-reconciled), UX, social, competitors, valuation, fundraising, pivots, holding structure, logo, growth ops, support, and founder ops. **Remaining unknowns are now all empirical** — answerable only by the pilot, not by more analysis. Analysis is done; note 18 is the last note until real-user data exists.

## The complete gap ledger (one view)
- **G1–G9** strategy gaps → [[03-Gap-Analysis]]
- **D1–D10** fundraising gaps → [[12-Dossier-Gaps-and-Fundraising-Roadmap]]
- **S1–S13** success-ops gaps → this note
- All scheduled inside: [[06-Wayforward-90-Days]] + blueprint phases [[07-Technology-Blueprint-2yr]]

Index: [[00-Arganta-Audit-Executive-Summary]] — **dossier complete at 19 notes.**
