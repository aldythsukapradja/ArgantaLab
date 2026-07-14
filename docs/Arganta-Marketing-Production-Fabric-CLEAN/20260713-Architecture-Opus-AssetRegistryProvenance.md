---
title: Asset Registry and Provenance
date: 20260713
category: Architecture
owner_llm: Opus
status: Ready
priority: P0
tags:
  - arganta
  - workstream
  - asset-registry-and-provenance
---

# Asset Registry and Provenance

## Summary

Create one universal asset identity, lineage graph, provenance model, rights status, and approval lifecycle shared by all HQ builders.

This workstream is independently executable against shared contracts and mocks.

## Core Principle

> One owner, one bounded context, one public interface, one complete handoff.

## Sole Owner

**Opus**

No second implementation model is assigned.

## Why This Exists

Create one universal asset identity, lineage graph, provenance model, rights status, and approval lifecycle shared by all HQ builders.

## Owned Repository Paths

  - `packages/asset-registry`
  - `packages/provenance`
  - `supabase/migrations`
  - `apps/hq/src/surfaces/assets`

Changes outside these paths require an integration proposal or ADR.

## Dependencies

  - Shared Contract Standard
  - Creative Document Core contract

Dependencies are contract-level only. Use mocks until implementations are merged.

## Scope

  - Universal MediaAsset model
  - Asset relation ontology
  - Provider, model, prompt, seed, and cost provenance
  - Rights and consent status
  - Approval lifecycle
  - Checksum deduplication
  - Deletion safety
  - Search and tagging

## Out of Scope

- Replacing GitHub, Supabase, or Vercel
- Implementing another workstream's internals
- Importing another workstream's private modules
- Adding provider secrets to browser code
- Unversioned breaking schema changes
- Direct social publishing unless explicitly approved in a later phase

## Required Outputs

  - Supabase schema and migrations
  - RLS policies
  - Asset service
  - Lineage queries
  - Provenance card
  - Approval status UI
  - Deletion dependency check
  - Fixture asset graph

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

- Supabase owns metadata, lineage, approvals, and private storage paths.
- Separate master, proxy, thumbnail, and export buckets.
- Add RLS and signed URL tests.
- Record privileged actions.

## Vercel Strategy

- Use Vercel for UI, previews, and lightweight request handling.
- Do not execute long-running render or provider jobs inside a request lifecycle.
- Use feature flags for rollout.

## Cost and Maturation Strategy

- Track file size, storage class, estimated egress, generation cost, and retention class.
- Apply size limits by maturity stage.

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
docs/handoffs/AssetRegistryandProvenance.md
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

  - Duplicate assets from webhook replay
  - Unknown rights reach production
  - Large masters are served publicly
  - Deleting one asset breaks multiple outputs
  - Service role bypasses intended access

## Required Battle Tests

  - Duplicate upload deduplicates by checksum
  - Webhook replay creates one asset
  - Unknown rights block publication
  - Unauthorized user cannot read private asset
  - Deletion is blocked when asset is in use
  - Signed URL expires correctly

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

Ask Fable only to review creative metadata and presentation of asset lineage after the functional asset experience exists.

## Claude Code Launch Prompt

```text
You are the sole Opus owner of Asset Registry and Provenance.

Read this note and the Shared Contract Standard.
Audit only the relevant Arganta repository paths.
Preserve GitHub, Supabase, and Vercel.
Work only inside the owned paths.
Use mocks for unfinished dependencies.
Implement one complete vertical path before secondary features.
Add tests, migrations, documentation, feature flags, rollback, and a handoff note.
Do not stop for minor ambiguity.
```
