---
title: Creative Document Core
date: 20260713
category: Architecture
owner_llm: Opus
status: Ready
priority: P0
tags:
  - arganta
  - workstream
  - creative-document-core
---

# Creative Document Core

## Summary

Define the shared, versioned creative document model used by websites, presentations, video, social, campaigns, and scenes.

This workstream is independently executable against shared contracts and mocks.

## Core Principle

> One owner, one bounded context, one public interface, one complete handoff.

## Sole Owner

**Opus**

No second implementation model is assigned.

## Why This Exists

Define the shared, versioned creative document model used by websites, presentations, video, social, campaigns, and scenes.

## Owned Repository Paths

  - `packages/creative-contracts`
  - `packages/creative-migrations`
  - `docs/adr/creative-document`

Changes outside these paths require an integration proposal or ADR.

## Dependencies

  - Shared Contract Standard

Dependencies are contract-level only. Use mocks until implementations are merged.

## Scope

  - CreativeDocument and CreativeNode ontology
  - Layout, style, animation, timeline, and format contracts
  - Schema versioning and migrations
  - Unknown-node fallback behavior
  - Cross-format compatibility rules
  - Fixtures and compatibility tests

## Out of Scope

- Replacing GitHub, Supabase, or Vercel
- Implementing another workstream's internals
- Importing another workstream's private modules
- Adding provider secrets to browser code
- Unversioned breaking schema changes
- Direct social publishing unless explicitly approved in a later phase

## Required Outputs

  - TypeScript and Zod package
  - JSON Schema export
  - Migration framework
  - Reference fixtures
  - Compatibility matrix
  - Architecture decision record

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

- Store documents and versions in Supabase.
- Keep schema version explicit.
- Use immutable version history for approved outputs.
- Add RLS by project and actor.

## Vercel Strategy

- Vercel previews load documents through stable APIs.
- Never make the editor runtime the only renderer.

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
docs/handoffs/CreativeDocumentCore.md
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

  - Schema becomes coupled to one editor
  - Renderer-specific fields leak into shared nodes
  - Old documents fail after upgrades
  - Different builders interpret timing differently

## Required Battle Tests

  - Old document loads in new renderer
  - Unknown node renders safe fallback
  - Same document renders website and presentation variants
  - Migration preserves asset IDs and metadata
  - Document round-trip does not lose unknown fields

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

Ask Fable only after a functional cross-format demo exists, to review whether the scene and layout semantics support strong creative output.

## Claude Code Launch Prompt

```text
You are the sole Opus owner of Creative Document Core.

Read this note and the Shared Contract Standard.
Audit only the relevant Arganta repository paths.
Preserve GitHub, Supabase, and Vercel.
Work only inside the owned paths.
Use mocks for unfinished dependencies.
Implement one complete vertical path before secondary features.
Add tests, migrations, documentation, feature flags, rollback, and a handoff note.
Do not stop for minor ambiguity.
```
