---
title: Render and Export Engine
date: 20260713
category: Build
owner_llm: Sonnet
status: Ready
priority: P1
tags:
  - arganta
  - workstream
  - render-and-export-engine
---

# Render and Export Engine

## Summary

Implement browser preview, Remotion rendering, FFmpeg composition, Sharp transformations, multi-format presets, progress, retries, and asset registration.

This workstream is independently executable against shared contracts and mocks.

## Core Principle

> One owner, one bounded context, one public interface, one complete handoff.

## Sole Owner

**Sonnet**

No second implementation model is assigned.

## Why This Exists

Implement browser preview, Remotion rendering, FFmpeg composition, Sharp transformations, multi-format presets, progress, retries, and asset registration.

## Owned Repository Paths

  - `packages/render-core`
  - `packages/render-remotion`
  - `packages/render-browser`
  - `packages/render-ffmpeg`
  - `supabase/functions/render-submit`

Changes outside these paths require an integration proposal or ADR.

## Dependencies

  - Creative Document contract
  - Asset contract
  - Scene contract
  - Media Job contract

Dependencies are contract-level only. Use mocks until implementations are merged.

## Scope

  - Render request validation
  - Browser preview
  - Asynchronous render jobs
  - Remotion compositions
  - FFmpeg assembly
  - Sharp derivatives
  - Audio mixing
  - Subtitles
  - Format presets
  - Progress and retry
  - Final asset registration

## Out of Scope

- Replacing GitHub, Supabase, or Vercel
- Implementing another workstream's internals
- Importing another workstream's private modules
- Adding provider secrets to browser code
- Unversioned breaking schema changes
- Direct social publishing unless explicitly approved in a later phase

## Required Outputs

  - Render packages
  - 16:9, 9:16, 1:1, and 4:5 presets
  - Thumbnail export
  - Proxy generation
  - Job pipeline
  - Progress events
  - Retry and cancellation
  - Render manifest
  - Visual regression fixtures

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

- Persist render jobs, progress, attempts, and results.
- Store final masters, proxies, and thumbnails separately.
- Use lifecycle and retention policies.

## Vercel Strategy

- Vercel only submits, reads status, and serves previews.
- Heavy render work must be external or separately hosted.

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
docs/handoffs/RenderandExportEngine.md
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

  - Long render executes inside Vercel request
  - Browser closure loses render
  - Audio and video timing drift
  - Same document renders differently across environments
  - Large assets exhaust storage

## Required Battle Tests

  - Render survives browser closure
  - Failed render retries safely
  - Duplicate submission is idempotent
  - 16:9 and 9:16 preserve core message
  - Render manifest records versions and checksums
  - Large input is rejected or proxied
  - Final asset appears in registry

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

Ask Fable only after first deterministic launch video and vertical adaptation exist, to review pacing and output polish.

## Claude Code Launch Prompt

```text
You are the sole Sonnet owner of Render and Export Engine.

Read this note and the Shared Contract Standard.
Audit only the relevant Arganta repository paths.
Preserve GitHub, Supabase, and Vercel.
Work only inside the owned paths.
Use mocks for unfinished dependencies.
Implement one complete vertical path before secondary features.
Add tests, migrations, documentation, feature flags, rollback, and a handoff note.
Do not stop for minor ambiguity.
```
