---
title: "ADR 0005 — Builder Artifact Model & Publish Safety"
date: 2026-07-15
status: accepted (contract) · unimplemented (B3/B5)
owner: Opus
tags: [adr, builder, artifacts, security, publishing, arganta-core]
---

# ADR 0005 — Builder Artifact Model & Publish Safety

## Status
Accepted as the B1 contract for the Single-File Builder. The pure contracts
ship now (`@arganta/builder`). Storage (B3 migration) and the public runtime
(B5) build against this; the runtime's live security sign-off is a separate B5
gate, same discipline as ADR-0004 gated C7.

## Context
The Builder (docs/arganta-core/Single-File-Builder.md) lets the founder create
single-file apps/websites from a conversation, then version and **publish them
to the public internet** (`build.arganta.app`). Two decisions are expensive to
unwind once B2/B3/C4b build on them, so they're frozen here.

## Decision 1 — a new founder-scoped store, NOT an extension of hq_app
The existing `hq_app` table (schema.sql) is Circle-distribution-shaped:
`product`, `circle_types`, `metrics`, `economy_hooks`, `agent_surfaces`,
ratings, featured — and crucially **no versioning, no website kind, no
validation lineage**. Founder artifacts need the opposite defaults: private-
first, immutably versioned, validation- and run-lineaged, app OR website.

So: two new tables (`@arganta/builder/schema.js` freezes the columns; B3 writes
`migration_hq_artifacts.sql`):
- `hq_artifact` — current state (kind, current_html, current_version, status,
  visibility, template_id, brand_kit_id), operator-gated like agent_runs/
  media_asset.
- `artifact_version` — immutable history (html, instruction, component_ids,
  provider, model, cost_usd, validation jsonb, **run_id → agent_runs**), so
  every version traces to the exact generation that produced it.

`SingleFileArtifact` (types.js) is the ONE logical shape; `hq_artifact` is its
founder storage; the Circle catalog (`hq_app`) is an **optional later
distribution target** — "export to Circle" COPIES an artifact into `hq_app`
(B5+), it is not a shared table. This keeps kid-tuned Circle RLS and rating/
plays semantics out of founder tooling, and vice versa.

## Decision 2 — publishing is the only outside-world action, and it is gated
`publish_artifact` (tools.js) is the sole builder tool with `sideEffect: true,
autonomySafe: false`. Everything else (create/revise/validate/save/restore/
insert/apply) produces or mutates a private draft and is autonomy-safe.
Consequences, enforced by existing machinery:
- `autonomyGate` (ADR-0004) already refuses a `sideEffect && !autonomySafe`
  tool to any headless mission without an explicit grant — so a scheduled
  agent can *draft* a site but can never *publish* one to the internet on its
  own. This is a test, not a hope (`@arganta/agent` autonomy.test.js shape).
- Publish MUST require a passing `validateHtml()` (validate.js) — the
  deterministic structural/security gate. The public runtime (B5) re-runs this
  **server-side** before serving; a client-side pass is never trusted.

## The validation gate (validate.js) — why it's B1, not B5
An artifact is accepted because deterministic checks pass, never because the
model claims completeness. The security checks (no secrets, no eval/new
Function, no parent/top-window access, no auto-redirect, approved external
hosts only, size ceiling) are the contract that makes founder-generated HTML
safe to serve publicly. Freezing them in B1 means B2's generation prompt
(prompts.js `CONTRACT_RULES`) can promise exactly what B5's runtime enforces —
one rule-set, stated once, checked deterministically.

## Alternatives considered
- **Extend hq_app with version columns.** Rejected — drags Circle/kid semantics
  into founder tooling and gives founder drafts public-catalog RLS by default.
- **Sanitize/sandbox at serve time only (no generation-time validation).**
  Rejected — defence in depth: catch unsafe output at generation AND at serve;
  and the founder should see *why* an artifact failed before publishing, not
  discover it silently stripped in production.
- **Allow autonomous publish with a budget cap.** Rejected — publishing to the
  open internet is categorically different from spending; it's a
  human-in-the-loop action regardless of cost.

## Consequences
- B3 writes `migration_hq_artifacts.sql` to satisfy `ARTIFACT_COLUMNS` /
  `VERSION_COLUMNS` exactly (a schema.test.js asserts the mappers match).
- B5's public runtime is a new attack surface; its go-live needs an explicit
  Opus security review (sandbox iframe + CSP + this validator server-side),
  same gate posture as ADR-0004's C7 secrets prerequisite.
- Nothing here is built yet beyond the pure contracts + tests.

## Related
- ADR-0004 (autonomous invocation) — the autonomy machinery publish reuses.
- `docs/arganta-core/Single-File-Builder.md` — B1–B5 plan.
- `@arganta/builder` — the implementing pure contracts + tests.
