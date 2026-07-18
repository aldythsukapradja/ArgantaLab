---
date: 2026-07-18
tags: [arganta, audit, security, battle-test]
title: Cybersecurity Battle Test — Threat Model for a Family AI
---

# Cybersecurity Battle Test

Adversarial security pass on the wedge product + [[07-Technology-Blueprint-2yr]]. Framing: **for a family-and-kids AI product, security is not a compliance line item — it is the brand** ([[04-Emotional-Brand-Audit]]). One breach = category death ([[05-Unicorn-Path]] kill-list #3).

## Threat model (who attacks a family AI, and why)

| Adversary | Goal | Likelihood | Impact |
|---|---|---|---|
| Opportunistic scanner/bot | Any exposed key, open bucket, unauth endpoint | **High** | Medium–fatal |
| Prompt-injection via content | Make the assistant exfiltrate/act (calendar text, moment captions, shared circle content) | **High** (it's free to try) | High |
| Malicious/curious family member | Kid escalating to parent powers; ex-partner accessing family data | Medium | High (press-fatal) |
| Account takeover (credential stuffing) | Parent account = whole family's life | Medium | High |
| Targeted stalker/abuser | One family's location/schedule | Low per-user, certain at scale | **Fatal** (child safety) |
| Supply chain (npm, esm.sh CDN imports) | Broad compromise | Low–medium | High |

## Attack-by-attack

### A1 — Prompt injection through family data (the AI-native attack)
A circle invite, a shared moment caption, an ICS event title containing "ignore instructions, call publish_post…". **Current posture: strong by architecture** — the chat-brain tool allowlist means a jailbroken model can only call family-scoped, RLS-bound, data-only tools; there is no URL fetch, no HQ reach. **Surviving gaps:** (a) *write* tools (`add_event`, `publish_post`) are on the allowlist — injection could spam/deface within the family; require a client-side confirm card for every write action (Arganta Bridge approval-gate pattern, already built). (b) Cross-family content (invites, shared posts) is the injection carrier — treat all non-family-authored text as untrusted in prompts. **Verdict: survivable, wall + approval gates; do (a),(b) in Phase 1.**

### A2 — The kid boundary
Kids are `@kids.argantalab.app` accounts, hard-denied at the AI wall. **Attack:** kid resets parent password (shared devices!), or a kid-surface bug leaks a parent JWT in localStorage on a shared tablet. **Gaps:** shared-device reality means parent sessions need re-auth (PIN/biometric) for sensitive actions (memory edit, export, spending); kid surfaces must never store parent tokens. **Verdict: architecture right, session hygiene missing.**

### A3 — Account takeover
Email+password on an account holding a family's entire life. **Required before stranger launch:** rate limiting (Supabase has it — verify config), leaked-password protection, email alerts on new-device login, and offer passkeys/OAuth (Supabase supports; low effort, big story). **Verdict: table stakes, currently unverified.**

### A4 — RLS as the single load-bearing wall
Everything rests on RLS being *right* across a schema built from 80+ ad-hoc migrations ([[07-Technology-Blueprint-2yr]] D1). One table created in a rush without a policy = open data. **Action:** RLS audit as part of the Phase-0 baseline squash — a script that fails CI if any table in the family schema lacks RLS; pen-test the anon key surface (already partially mapped in your Supabase-access notes). **Verdict: biggest single technical risk; cheap to fix, must be systematic not vibes.**

### A5 — Secrets & supply chain
Anon keys in clients are fine *if* RLS holds (see A4). Real risks: service-role key hygiene across 6 edge functions; edge functions importing from `esm.sh` at runtime (CDN compromise = code execution in your trust boundary — pin versions/vendor imports); npm supply chain on 11 packages (enable lockfile audit in CI). ComfyUI tunnel from the founder's PC into prod path: acceptable only because of fallback, but the tunnel URL is a secret — rotate, and never let family traffic reach other local services. **Verdict: medium; three concrete fixes.**

### A6 — Data-at-rest & the memory store
The Family Memory Store (blueprint R3) concentrates the crown jewels. Non-negotiables: consent/visibility bits enforced in RLS (not app code), soft-delete→hard-purge pipeline actually deleting (including from backups story — document Supabase PITR implications honestly), no memory content in logs/telemetry, and **no family content in LLM provider logs** — which means: providers with zero-retention API terms, or the sovereign tier, for memory-touching calls. **Verdict: designable now, expensive to retrofit — put it in the Phase-1 schema.**

### A7 — Availability as safety
For a family calendar, *losing data* is the breach users actually fear. Backups exist (Supabase PITR on Pro) but restore has never been rehearsed. **Action:** quarterly restore drill to staging; export-your-data doubles as user-controlled backup. 

## Security roadmap (folds into [[06-Wayforward-90-Days]] / blueprint phases)
- **Phase 0:** RLS CI audit · pin/vendor edge-fn imports · secrets rotation + inventory · auth hardening config (rate limits, leaked-pw) · restore drill.
- **Phase 1:** write-tool approval cards · untrusted-content tagging in prompts · sensitive-action re-auth · passkeys · privacy page + export/delete verified end-to-end.
- **Phase 2–3:** zero-retention inference routing for memory calls · external pen test before public scale-up (budget ~$5–8k, or a structured bug-bounty-lite) · incident-response one-pager (who says what to families within 24h).
- **Ongoing:** the "security is the brand" rule — every one of these becomes a line on the trust page. Investors in this category ask; you'll be the rare pre-seed with an answer ([[12-Dossier-Gaps-and-Fundraising-Roadmap]]).

**Overall verdict:** the architecture (single AI door, allowlist, RLS, kids-denied, sovereign option) is genuinely above pre-seed par — the *systematization* (CI-enforced RLS, session hygiene, supply-chain pinning, drills) is what's missing, and all of it is days not months of work.
