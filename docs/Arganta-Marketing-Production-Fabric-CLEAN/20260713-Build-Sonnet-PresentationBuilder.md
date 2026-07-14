---
title: Presentation Builder
date: 20260713
category: Build
owner_llm: Sonnet
status: Ready
priority: P2
tags:
  - arganta
  - workstream
  - presentation-builder
---

# Presentation Builder

## Summary

Implement a cinematic, scene-based HTML presentation builder with narration, 3D embedding, touch navigation, and render handoff.

This workstream is independently executable against shared contracts and mocks.

## Core Principle

> One owner, one bounded context, one public interface, one complete handoff.

## Sole Owner

**Sonnet**

No second implementation model is assigned.

## Why This Exists

Implement a cinematic, scene-based HTML presentation builder with narration, 3D embedding, touch navigation, and render handoff.

## Owned Repository Paths

  - `packages/presentation-core`
  - `packages/presentation-player`
  - `packages/presentation-templates`
  - `apps/hq/src/surfaces/presentation`

Changes outside these paths require an integration proposal or ADR.

## Dependencies

  - Creative Document contract
  - Scene contract
  - Render contract
  - Brand contract

Dependencies are contract-level only. Use mocks until implementations are merged.

## Scope

  - Scene editor
  - Presentation player
  - Keyboard and touch controls
  - Cinematic transitions
  - Narration references
  - 3D scene embedding
  - HTML export
  - Render request handoff
  - PDF-compatible fallback

## Out of Scope

- Replacing GitHub, Supabase, or Vercel
- Implementing another workstream's internals
- Importing another workstream's private modules
- Adding provider secrets to browser code
- Unversioned breaking schema changes
- Direct social publishing unless explicitly approved in a later phase

## Required Outputs

  - Presentation Studio
  - Player
  - Five starter templates
  - Mobile navigation
  - Scene transition library
  - HTML export
  - Render adapter
  - Accessibility checks

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
docs/handoffs/PresentationBuilder.md
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

  - Navigation fails in embedded preview
  - Transitions depend on one browser
  - 3D scenes cause mobile instability
  - HTML and video output diverge

## Required Battle Tests

  - Keyboard, click, and touch navigation work
  - Embedded preview receives controls
  - Low-tier device uses poster fallback
  - HTML and render manifest use same timing
  - Presentation resumes from saved scene
  - Reduced-motion mode works

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

Ask Fable after the first complete five-scene presentation. Fable reviews narrative pacing, transitions, typography, and executive polish.

## Claude Code Launch Prompt

```text
You are the sole Sonnet owner of Presentation Builder.

Read this note and the Shared Contract Standard.
Audit only the relevant Arganta repository paths.
Preserve GitHub, Supabase, and Vercel.
Work only inside the owned paths.
Use mocks for unfinished dependencies.
Implement one complete vertical path before secondary features.
Add tests, migrations, documentation, feature flags, rollback, and a handoff note.
Do not stop for minor ambiguity.
```
