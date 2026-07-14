---
title: Shared Contract Standard
date: 20260713
category: Architecture
owner_llm: Opus
status: Ready
priority: P0
tags:
  - contracts
  - schema
  - versioning
  - architecture
---

# Shared Contract Standard

## Summary

Define the only supported public dependency surface between workstreams.

## Core Principle

> Workstreams integrate through contracts, never through private implementation details.

## Mission

Create versioned TypeScript and Zod contracts for:

- CreativeDocument
- CreativeNode
- MediaAsset
- AssetRelation
- MediaJob
- ProviderAttempt
- SceneDefinition
- RenderRequest
- RenderResult
- BrandProfile
- TemplateDefinition
- CampaignDefinition
- ApprovalRecord
- CostRecord
- ActorReference
- CommonError
- DomainEvent

## Owned Repository Paths

- `packages/creative-contracts`
- `packages/asset-contracts`
- `packages/media-contracts`
- `packages/scene-contracts`
- `packages/render-contracts`
- `packages/brand-contracts`
- `packages/campaign-contracts`
- `packages/governance-contracts`
- `docs/adr`

## Required Contract Fields

Every durable entity requires:

- `id`
- `schemaVersion`
- `createdAt`
- `updatedAt`
- `createdBy`
- `projectId` where applicable
- `maturityStage` where applicable
- `status`
- `metadata` extension point

## Versioning Rules

- Additive changes are preferred
- Breaking changes increment `schemaVersion`
- Migrations must be deterministic
- Unknown fields are preserved when possible
- Unknown node types render a safe fallback
- Provider-specific values must not enter shared top-level fields

## Error Envelope

```ts
export interface DomainError {
  code: string;
  message: string;
  retryable: boolean;
  source: 'validation' | 'policy' | 'provider' | 'storage' | 'render' | 'auth' | 'internal';
  details?: Record<string, unknown>;
  correlationId: string;
}
```

## Domain Event Envelope

```ts
export interface DomainEvent<T = unknown> {
  id: string;
  type: string;
  version: number;
  actor: ActorReference;
  projectId?: string;
  occurredAt: string;
  correlationId: string;
  payload: T;
}
```

## Implementation Steps

1. Audit existing Arganta shared types
2. Verify package-manager and workspace topology
3. Create contract packages
4. Add Zod schemas
5. Export JSON Schema
6. Add fixtures
7. Add compatibility tests
8. Add migration helpers
9. Add ADR for versioning
10. Publish handoff

## Battle-Test Scenarios

- Old document loaded by new code
- New document loaded by old preview code
- Unknown node type
- Unknown metadata fields
- Provider-specific adapter metadata
- Invalid status transition
- Missing actor identity
- Duplicate domain event

## Acceptance Criteria

- All builders can compile against contracts only
- Mocks can implement every public interface
- Contract packages contain no provider SDK
- Contract tests run independently
- Clean install and build succeeds
- Breaking changes require explicit migration

## Definition of Done

All parallel workstreams can start without importing another workstream's internal implementation.

## Claude Code Handoff Prompt

```text
You are the sole Opus owner of the Shared Contract Standard.

Audit existing shared types and workspace behavior.
Design versioned TypeScript and Zod contracts.
Keep public fields provider-neutral.
Add fixtures, compatibility tests, migrations, ADRs, and a handoff.
Do not implement domain services.
```
