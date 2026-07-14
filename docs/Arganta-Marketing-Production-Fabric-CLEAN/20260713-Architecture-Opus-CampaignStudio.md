---
title: Campaign Studio
date: 20260713
category: Architecture
owner_llm: Opus
status: Ready
priority: P2
tags:
  - arganta
  - workstream
  - campaign-studio
---

# Campaign Studio

## Summary

Design the campaign orchestration model that converts product strategy into websites, presentations, 3D scenes, video, and social deliverables.

This workstream is independently executable against shared contracts and mocks.

## Core Principle

> One owner, one bounded context, one public interface, one complete handoff.

## Sole Owner

**Opus**

No second implementation model is assigned.

## Why This Exists

Design the campaign orchestration model that converts product strategy into websites, presentations, 3D scenes, video, and social deliverables.

## Owned Repository Paths

  - `packages/campaign-core`
  - `packages/campaign-recipes`
  - `apps/hq/src/surfaces/campaign`

Changes outside these paths require an integration proposal or ADR.

## Dependencies

  - Shared Contract Standard
  - Creative Document Core
  - Asset Registry
  - Brand System

Dependencies are contract-level only. Use mocks until implementations are merged.

## Scope

  - Campaign brief
  - Audience and objective
  - Message hierarchy
  - Master narrative
  - Deliverable matrix
  - Budget and maturity gates
  - Template and scene selection
  - Approval workflow
  - Performance feedback hooks

## Out of Scope

- Replacing GitHub, Supabase, or Vercel
- Implementing another workstream's internals
- Importing another workstream's private modules
- Adding provider secrets to browser code
- Unversioned breaking schema changes
- Direct social publishing unless explicitly approved in a later phase

## Required Outputs

  - CampaignDefinition contract
  - Workflow state machine
  - Deliverable matrix
  - Cost estimate model
  - Approval model
  - Starter campaign recipes
  - HQ campaign surface specification

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
docs/handoffs/CampaignStudio.md
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

  - Campaign becomes a monolithic workflow
  - Channel variants lose lineage
  - Costs are estimated too late
  - Publishing scope expands prematurely

## Required Battle Tests

  - Campaign can run with all builder adapters mocked
  - Every output links to master campaign
  - Budget limit blocks premium job
  - Rejected asset cannot become approved deliverable
  - Export-first flow works without social API credentials

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

Ask Fable after the first complete campaign pack. Fable reviews narrative unity, channel adaptation, launch impact, and brand consistency.

## Claude Code Launch Prompt

```text
You are the sole Opus owner of Campaign Studio.

Read this note and the Shared Contract Standard.
Audit only the relevant Arganta repository paths.
Preserve GitHub, Supabase, and Vercel.
Work only inside the owned paths.
Use mocks for unfinished dependencies.
Implement one complete vertical path before secondary features.
Add tests, migrations, documentation, feature flags, rollback, and a handoff note.
Do not stop for minor ambiguity.
```
