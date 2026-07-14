---
title: Battle Test and Gap Closure
date: 20260713
category: Strategy
status: Ready
tags:
  - battle-test
  - risks
  - gaps
  - resilience
---

# Battle Test and Gap Closure

## Summary

The architecture is viable on GitHub, Supabase, and Vercel, but several risks must be handled explicitly.

This note converts those risks into implementation requirements.

## Core Principle

> The control plane stays lightweight. Long-running and provider-heavy execution stays asynchronous and replaceable.

## Gap 1 — Long-Running Video and 3D Rendering

### Risk

Vercel request lifetimes and Supabase Edge Function limits are not appropriate for long renders.

### Closure

- Vercel accepts and validates requests
- Supabase stores durable jobs
- External provider or dedicated render worker executes long work
- Provider webhooks or polling update Supabase
- HQ subscribes through Realtime
- Browser closure does not terminate the job

### Required Test

Start a render, close the browser, reopen HQ, and confirm progress and result persist.

## Gap 2 — Webhook Replay and Duplicate Assets

### Risk

Providers may retry callbacks.

### Closure

- Store provider event IDs
- Enforce idempotency keys
- Use unique constraints on provider job and output
- Make asset registration transactional
- Record every attempt

### Required Test

Replay the same callback three times and confirm only one final asset exists.

## Gap 3 — Provider Price Drift

### Risk

Provider pricing changes over time.

### Closure

- Store pricing snapshots with effective dates
- Separate estimated and actual cost
- Mark stale price data
- Require approval when estimate confidence is low
- Add provider-price review workflow

## Gap 4 — Provider Lock-In

### Risk

Builders may adopt provider-native fields.

### Closure

- Public contracts remain provider-neutral
- Provider-specific parameters live under adapter-specific metadata
- UI requests capabilities, not provider endpoints
- At least one mock adapter and one fallback adapter are required

## Gap 5 — Large Video Storage and Egress

### Risk

Large assets increase Storage and delivery cost.

### Closure

- File-size limits by maturity stage
- Proxy and thumbnail generation
- Retention classes
- Lifecycle cleanup
- Signed URLs for private media
- Public derivatives separate from masters
- Checksum-based deduplication

## Gap 6 — Licensing, Likeness, Voice, and Child Safety

### Risk

Marketing assets may contain restricted content or unverified rights.

### Closure

- Commercial-use status
- Consent status
- Human likeness and voice flags
- Child-safety review status
- Stock-source attribution
- Publication gate for unknown rights
- Immutable provenance event history

## Gap 7 — Brand Drift

### Risk

Templates become inconsistent across builders.

### Closure

- One versioned BrandProfile contract
- Hard rules and soft rules
- Shared tokens
- Central template registry
- Brand validation before export
- Fable review only after functional milestones

## Gap 8 — Creative Document Schema Drift

### Risk

Website, presentation, render, and social builders create incompatible data.

### Closure

- Shared schema version
- Migrations
- Additive change policy
- Contract fixtures
- Compatibility test across all renderers
- Unknown-node fallback instead of hard crash

## Gap 9 — 3D Portability

### Risk

A 3D scene works in HQ but fails in Remotion or mobile.

### Closure

- Scene definitions are data, not component instances
- Rendering adapters translate the same scene
- Quality tiers: mobile, standard, cinematic
- Deterministic camera and timing
- Fallback poster frame
- Performance budget per scene

## Gap 10 — Puck Coupling

### Risk

Website content becomes locked to Puck internals.

### Closure

- Puck is an editor adapter
- Creative Document remains the source format
- Puck state maps to and from shared nodes
- Puck-specific metadata remains private
- Export and render do not require the editor runtime

## Gap 11 — MCP Authentication and Tool Scope

### Risk

Agents gain broad production access.

### Closure

- Authenticate every MCP request
- Propagate actor identity
- Tool-level permissions
- Read-only default
- Premium actions require policy checks
- Publication disabled for autonomous agents initially
- Rate limits by actor and tool

## Gap 12 — Supabase RLS and Service Role Misuse

### Risk

Service role bypasses user permissions.

### Closure

- Browser uses anon/authenticated client only
- Provider callbacks use tightly scoped server paths
- Service role never reaches browser code
- Explicit RLS tests
- Audit server-side privileged actions

## Gap 13 — Offline Development

### Risk

Every builder requires live Supabase or paid providers.

### Closure

- Mock adapters
- Local fixtures
- Feature flags
- Browser-local preview mode
- Clear visual indication of mock data
- Never present simulated output as live provider output

## Gap 14 — Social Publishing Scope

### Risk

Direct publishing adds platform permissions and review complexity.

### Closure

Phase 1 is export-first and manual publish.

Direct social publishing is a later workstream after:

- Stable export packs
- Platform credentials
- Compliance review
- Scheduling and failure recovery
- Revocation handling

## Gap 15 — Observability

### Risk

Failures and costs are invisible across providers.

### Closure

Track:

- Job duration
- Queue time
- Provider latency
- Success rate
- Retry count
- Actual cost
- Storage size
- Egress estimate
- Error class
- Actor
- Product
- Maturity stage

## Gap 16 — Workspace Topology

### Risk

New local packages may not resolve cleanly in HQ due to current workspace declarations.

### Closure

- Audit root package manager
- Confirm how HQ consumes `packages/*`
- Avoid monorepo restructuring in feature branches
- Add a dedicated ADR before any workspace change
- Validate clean install in CI

## Gap 17 — Rendering Reproducibility

### Risk

The same document renders differently across environments.

### Closure

- Pin package versions
- Pin fonts through approved web-safe or licensed sources
- Store render manifest
- Record scene version
- Record template version
- Record asset checksums
- Use deterministic seeds where supported
- Add snapshot and visual-regression tests

## Gap 18 — Rollback and Data Migration

### Risk

A new schema or builder release corrupts existing documents.

### Closure

- Forward-compatible migrations
- Backup before destructive migration
- Feature flags
- Dual-read period for major schema changes
- Document export before migration
- Rollback instructions in every handoff

## Release Battle Tests

The first release must pass:

1. Provider callback replay
2. Browser closure during render
3. Stale price estimate
4. Provider failure and fallback
5. Unknown-license publication block
6. RLS unauthorized read
7. RLS unauthorized write
8. Offline mock flow
9. Mobile low-quality 3D fallback
10. Unknown creative node migration
11. Duplicate upload deduplication
12. Large-file rejection
13. Feature-flag rollback
14. Vercel preview smoke test
15. Clean repository install and build
