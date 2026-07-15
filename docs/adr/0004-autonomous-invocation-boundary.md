---
title: "ADR 0004 — Autonomous Invocation & Service-Role Boundary"
date: 2026-07-15
status: accepted (contract) · unimplemented (C7)
owner: Opus
tags: [adr, security, agentic, autonomy, cloudflare, supabase, arganta-core]
---

# ADR 0004 — Autonomous Invocation & Service-Role Boundary

## Status
Accepted as the C1 contract for Arganta Core. The pure logic ships now
(`@arganta/agent/autonomy.js`: `isAuthorizedInvocation`, `autonomyGate`). The
wiring (Edge Function second auth mode + pg_cron missions) is C7 — deliberately
NOT built until this boundary is agreed.

## Context
Every gateway today (`supabase/functions/llm-proxy`, `media-proxy`) is gated on
`hq_is_operator()` — it reads the **signed-in founder's JWT** and refuses anyone
else. That is correct for the browser. But the digital-twin goal needs Arganta
Core to act **while the browser is closed** — a nightly CAPO rollup, a neuron-
quota watch, a morning-brief thread. A `pg_cron` job has **no user JWT**, so as
built it cannot legally call any gateway. This is the single blocker to autonomy
(HQ audit, 2026-07-15).

## Decision
Introduce a **second, narrow authorization mode** — not a weaker one.

1. **Two auth modes** (`AUTH_MODES`):
   - `operator-jwt` — the browser path, unchanged. Requires a real operator JWT.
   - `internal-agent-secret` — a server-side shared secret (`INTERNAL_AGENT_SECRET`,
     a Supabase secret) carried by the pg_net/cron path in a header the gateway
     checks. **This secret NEVER ships to the browser** and is never a client env
     var — if it can reach client JS, this ADR is violated.

2. **The internal path is autonomy-bounded, not unbounded.**
   `isAuthorizedInvocation` requires the internal secret **AND** an autonomy
   level ≥ `SCHEDULED`. An on-demand call may not use the headless path even
   with the secret — on-demand always means a human is present, so it uses the
   operator JWT. This prevents the internal secret from becoming a universal
   backdoor.

3. **Every autonomous tool call passes `autonomyGate` first.** On top of the
   existing data-class governance (ADR-0003) and budget guard, a headless
   mission may run **only `autonomySafe` tools** — read-only, cheap, non-
   publishing. Anything that spends money you don't control, publishes, or
   should be eyeballed is withheld for a human (`needsApproval`), unless a
   specific standing `granted` autopilot is set for that one tool.

4. **Restricted/confidential data never rides the external path**, autonomous or
   not — inherited unchanged from ADR-0003 (`mustStayLocal`). A confidential
   `analyze` runs at Tier 0 on-device; it does not become an external call just
   because a cron job asked.

## Alternatives considered
- **A dedicated "agent" auth user** (real Supabase user, sign in server-side,
  use its JWT). More Supabase-native, but requires storing that user's
  credentials somewhere and rotating them; the shared secret in Supabase Vault
  is simpler and the autonomy-level clamp gives equivalent containment. Revisit
  if multi-tenant agents ever need distinct identities.
- **Move all autonomous work INTO the Edge Function** triggered directly by
  pg_cron→pg_net, with no separate secret. Viable, but couples every mission to
  a function deploy and loses the clean "the DB decided to act" trigger model.
  The internal-secret path keeps missions as data (a `mission` row) that the
  loop executes.
- **Do nothing / stay browser-only.** Rejected — it makes the digital-twin goal
  impossible; the system could never act on its own.

## Consequences
- The gateways gain one new branch: accept `internal-agent-secret` when the
  operator JWT is absent, then hand off to the same routing/governance. Small,
  auditable surface.
- Autonomy is **provably contained**: the pure predicates are unit-tested
  (`autonomy.test.js`), so "a nightly job can't publish or overspend" is a
  test, not a hope.
- Secrets posture must harden first: `INTERNAL_AGENT_SECRET` and the Cloudflare
  token belong in **Supabase Vault** (installed, unused) before this path goes
  live — a leaked internal secret is worse than a leaked read-only token.
- Nothing changes for today's browser flows; this is purely additive.

## Related
- ADR-0003 (data-class governance) — inherited, unchanged.
- `docs/arganta-core/Arganta-Core-Concept.md` — C1 contracts, C7 heartbeat.
- `@arganta/agent/autonomy.js` — the implementing pure logic.
