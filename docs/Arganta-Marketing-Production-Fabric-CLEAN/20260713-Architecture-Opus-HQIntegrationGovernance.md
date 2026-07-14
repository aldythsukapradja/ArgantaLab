---
title: HQ Integration and Governance
date: 20260713
category: Architecture
owner_llm: Opus
status: Ready
priority: P3
tags:
  - arganta
  - workstream
  - hq-integration-and-governance
---

# HQ Integration and Governance

## Summary

Integrate all creative workstreams into HQ with approvals, maturity, costs, provider health, auditability, and operational control.

This workstream is independently executable against shared contracts and mocks.

## Core Principle

> One owner, one bounded context, one public interface, one complete handoff.

## Sole Owner

**Opus**

No second implementation model is assigned.

## Why This Exists

Integrate all creative workstreams into HQ with approvals, maturity, costs, provider health, auditability, and operational control.

## Owned Repository Paths

  - `apps/hq/src/surfaces/marketing`
  - `apps/hq/src/surfaces/approvals`
  - `apps/hq/src/surfaces/treasury`
  - `apps/hq/src/shell`

Changes outside these paths require an integration proposal or ADR.

## Dependencies

  - All public contracts
  - All workstream handoffs

Dependencies are contract-level only. Use mocks until implementations are merged.

## Scope

  - HQ navigation integration
  - Universal job tray
  - Shared asset picker
  - Approval queue
  - Maturity controls
  - Provider operations
  - Cost dashboard
  - Publication readiness
  - Audit trail
  - Offline and mock indicators

## Out of Scope

- Replacing GitHub, Supabase, or Vercel
- Implementing another workstream's internals
- Importing another workstream's private modules
- Adding provider secrets to browser code
- Unversioned breaking schema changes
- Direct social publishing unless explicitly approved in a later phase

## Required Outputs

  - Integration map
  - Governance state model
  - Approval flow
  - Provider health dashboard
  - Cost and usage dashboard
  - Feature-flag rollout plan
  - Operational playbook

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
docs/handoffs/HQIntegrationandGovernance.md
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

  - HQ becomes tightly coupled to provider APIs
  - Offline data appears live
  - Agents gain publication rights
  - Approvals are bypassed
  - Navigation overloads the current shell

## Required Battle Tests

  - Offline mode clearly labels mock data
  - Agent cannot publish autonomously
  - Premium job enters approval queue
  - Unknown-rights asset blocks publication
  - Provider outage is visible
  - Feature flag rollback hides new surfaces

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

Ask Fable after HQ integration is functional to review workflow clarity and creative usability. Fable does not change governance logic.

## Claude Code Launch Prompt

```text
You are the sole Opus owner of HQ Integration and Governance.

Read this note and the Shared Contract Standard.
Audit only the relevant Arganta repository paths.
Preserve GitHub, Supabase, and Vercel.
Work only inside the owned paths.
Use mocks for unfinished dependencies.
Implement one complete vertical path before secondary features.
Add tests, migrations, documentation, feature flags, rollback, and a handoff note.
Do not stop for minor ambiguity.
```
