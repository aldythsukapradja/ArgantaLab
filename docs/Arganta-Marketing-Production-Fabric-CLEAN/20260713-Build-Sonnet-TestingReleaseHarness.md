---
title: Testing and Release Harness
date: 20260713
category: Build
owner_llm: Sonnet
status: Ready
priority: P0
tags:
  - arganta
  - workstream
  - testing-and-release-harness
---

# Testing and Release Harness

## Summary

Create the cross-workstream contract tests, integration fixtures, visual regression, RLS tests, preview checks, feature flags, and release gates.

This workstream is independently executable against shared contracts and mocks.

## Core Principle

> One owner, one bounded context, one public interface, one complete handoff.

## Sole Owner

**Sonnet**

No second implementation model is assigned.

## Why This Exists

Create the cross-workstream contract tests, integration fixtures, visual regression, RLS tests, preview checks, feature flags, and release gates.

## Owned Repository Paths

  - `packages/marketing-testkit`
  - `tests/marketing-fabric`
  - `.github/workflows`
  - `apps/hq/src/lib/featureFlags`

Changes outside these paths require an integration proposal or ADR.

## Dependencies

  - All shared contracts

Dependencies are contract-level only. Use mocks until implementations are merged.

## Scope

  - Contract test harness
  - Mock providers
  - Fixture documents
  - RLS tests
  - Webhook replay tests
  - Visual regression
  - Vercel preview smoke tests
  - Offline mode tests
  - Feature flags
  - Release checklist

## Out of Scope

- Replacing GitHub, Supabase, or Vercel
- Implementing another workstream's internals
- Importing another workstream's private modules
- Adding provider secrets to browser code
- Unversioned breaking schema changes
- Direct social publishing unless explicitly approved in a later phase

## Required Outputs

  - Testkit package
  - CI workflow
  - Preview test script
  - Battle-test suite
  - Fixture campaign
  - Fixture assets
  - Release gate report
  - Rollback verification

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

- Use Supabase for durable state only where this workstream owns the schema.
- Define RLS explicitly.
- Never expose service-role credentials to browser code.
- Add migration and rollback notes.

## Vercel Strategy

- Use Vercel for UI, previews, and lightweight request handling.
- Do not execute long-running render or provider jobs inside a request lifecycle.
- Use feature flags for rollout.

## Cost and Maturation Strategy

- Respect maturity stage.
- Free or deterministic defaults for ideation and concept.
- Cheap providers for prototype.
- Premium actions require policy approval.
- Record estimated and actual cost where applicable.

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
docs/handoffs/TestingandReleaseHarness.md
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

  - Tests depend on paid providers
  - Visual snapshots are unstable
  - RLS is not covered
  - Preview deployment succeeds but product flow fails
  - Feature flags cannot roll back schema changes

## Required Battle Tests

  - Full mock vertical slice passes
  - Unauthorized RLS tests fail correctly
  - Webhook replay passes
  - Visual snapshots are deterministic
  - Vercel preview smoke test passes
  - Offline mode passes
  - Feature flag rollback hides all new surfaces

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

Fable is not required. Fable screenshots may be used as visual review references, but engineering tests remain owned by Sonnet.

## Claude Code Launch Prompt

```text
You are the sole Sonnet owner of Testing and Release Harness.

Read this note and the Shared Contract Standard.
Audit only the relevant Arganta repository paths.
Preserve GitHub, Supabase, and Vercel.
Work only inside the owned paths.
Use mocks for unfinished dependencies.
Implement one complete vertical path before secondary features.
Add tests, migrations, documentation, feature flags, rollback, and a handoff note.
Do not stop for minor ambiguity.
```
