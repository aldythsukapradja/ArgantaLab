---
title: Media Core and Provider Router
date: 20260713
category: Build
owner_llm: Sonnet
status: Ready
priority: P0
tags:
  - arganta
  - workstream
  - media-core-and-provider-router
---

# Media Core and Provider Router

## Summary

Implement provider-agnostic media orchestration for image, video, voice, music, sound effects, avatar, and transformations.

This workstream is independently executable against shared contracts and mocks.

## Core Principle

> One owner, one bounded context, one public interface, one complete handoff.

## Sole Owner

**Sonnet**

No second implementation model is assigned.

## Why This Exists

Implement provider-agnostic media orchestration for image, video, voice, music, sound effects, avatar, and transformations.

## Owned Repository Paths

  - `packages/media-core`
  - `packages/media-providers`
  - `supabase/functions/media-submit`
  - `supabase/functions/media-callback`

Changes outside these paths require an integration proposal or ADR.

## Dependencies

  - Shared Contract Standard
  - Asset Registry contract
  - Security and Cost policy

Dependencies are contract-level only. Use mocks until implementations are merged.

## Scope

  - Provider adapter interface
  - Capability registry
  - Cost estimation
  - Maturity-aware routing
  - Fallback
  - Retries
  - Job persistence
  - Webhook normalization
  - Mock provider
  - First real provider adapter

## Out of Scope

- Replacing GitHub, Supabase, or Vercel
- Implementing another workstream's internals
- Importing another workstream's private modules
- Adding provider secrets to browser code
- Unversioned breaking schema changes
- Direct social publishing unless explicitly approved in a later phase

## Required Outputs

  - Media Core package
  - Provider registry
  - Mock adapter
  - At least one real low-cost adapter
  - Job state machine
  - Webhook handler
  - Cost ledger integration
  - Contract and integration tests

## Public Interface Rules

- Depend only on shared contracts
- Provide mocks
- Document every public API
- Keep internal implementation private
- Emit normalized errors
- Preserve actor identity and correlation IDs
- Preserve offline or preview behavior where relevant

## GitHub Strategy

- One feature branch
- One Git worktree
- One PR into `feat/marketing-production-fabric`
- Handoff file under `docs/handoffs`
- CI must run type-check, tests, and build
- Any contract change must be called out in the PR

## Supabase Strategy

- Supabase owns durable job, attempt, event, and cost records.
- Provider callbacks write through server-side routes.
- Realtime publishes normalized job progress.

## Vercel Strategy

- Vercel handles validation and lightweight submission only.
- Long work remains asynchronous.

## Cost and Maturation Strategy

- Route by maturity, budget, provider health, quality, and rights.
- Record estimate confidence and actual cost.

## Implementation Steps

### 1. Audit

Produce:

- Current-state architecture
- Reusable code map
- Gaps
- Proposed file tree
- Public interfaces
- Persistence impact
- Security impact
- Cost impact

Do not edit before the audit is complete.

### 2. Plan

Document:

- Package boundaries
- State ownership
- APIs
- Mocks
- Migrations
- Feature flags
- Tests
- Rollback
- Integration points

### 3. Scaffold

Create:

- Entry points
- Types
- Adapters
- Fixtures
- Tests
- README
- Feature flag
- Handoff template

### 4. Complete One Vertical Path

Implement a full end-to-end happy path before secondary features.

### 5. Add Failure Handling

Add:

- Validation
- Idempotency
- Retries
- Timeouts
- Cancellation where relevant
- Error normalization
- Audit logging
- Cleanup

### 6. Add Security and Governance

Verify:

- RLS
- Secret boundaries
- Actor identity
- Cost policy
- Approval policy
- Rights policy
- Publication policy

### 7. Add Tests

Minimum:

- Unit tests
- Contract tests
- Integration test
- Smoke test
- Offline/mock test
- Migration tests where applicable

### 8. Self-Review

Run a strict staff-engineer review and fix all high and medium issues.

### 9. Create Handoff

Create:

```text
docs/handoffs/MediaCoreandProviderRouter.md
```

Include:

- Summary
- Files changed
- Public APIs
- Environment variables
- Migrations
- RLS
- Storage
- Vercel routes
- Feature flags
- Tests
- Demo
- Limitations
- Integration
- Rollback

## Specific Risks

  - Provider-native types leak into public API
  - Callback replay duplicates assets
  - Price estimate becomes stale
  - Retry creates duplicate provider jobs
  - Provider outage blocks all jobs

## Required Battle Tests

  - Mock job completes end to end
  - Callback replay is idempotent
  - Fallback provider is selected
  - Budget policy blocks premium route
  - Actual cost differs safely from estimate
  - Browser contains no provider secret

## Acceptance Criteria

- Builds and type-checks
- Tests pass
- Runs against mocks
- Public contracts are respected
- No hidden coupling
- No browser secrets
- Feature flag exists
- Rollback is documented
- Handoff is complete
- Existing stack remains unchanged

## Definition of Done

The workstream can be reviewed and merged without unfinished internal code from another workstream.

## Fable Checkpoint

Fable is not required for implementation. Ask Fable only later to review quality-scoring criteria if visual routing becomes important.

## Claude Code Launch Prompt

```text
You are the sole Sonnet owner of Media Core and Provider Router.

Read this note and the Shared Contract Standard.
Audit only the relevant Arganta repository paths.
Preserve GitHub, Supabase, and Vercel.
Work only inside the owned paths.
Use mocks for unfinished dependencies.
Implement one complete vertical path before secondary features.
Add tests, migrations, documentation, feature flags, rollback, and a handoff note.
Do not stop for minor ambiguity.
```
