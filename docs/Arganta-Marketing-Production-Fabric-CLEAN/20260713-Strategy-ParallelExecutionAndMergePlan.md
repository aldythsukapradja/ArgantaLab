---
title: Parallel Execution and Merge Plan
date: 20260713
category: Strategy
status: Ready
tags:
  - parallel
  - branches
  - integration
  - merge
---

# Parallel Execution and Merge Plan

## Summary

All workstreams may begin in parallel if they depend only on stable contracts, mocks, and fixtures.

Parallel start does not mean parallel merge.

## Core Principle

> Start independently. Integrate deliberately.

## Independence Test

A workstream is independent when:

- It builds using mocks
- Its tests do not require another feature branch
- Its public interface is documented
- Its owned paths are explicit
- It does not import another workstream's private modules
- It can produce a complete handoff artifact

## Parallel Start Groups

### Group A — Foundation

- Shared Contract Standard — Opus
- Creative Document Core — Opus
- Asset Registry and Provenance — Opus
- Brand and Template System — Opus
- Security, Cost, and Observability — Opus
- Media Core and Provider Router — Sonnet

### Group B — Creative Runtime

- 3D Scene System — Sonnet
- Render and Export Engine — Sonnet
- Website Builder — Sonnet

### Group C — Output Studios

- Presentation Builder — Sonnet
- Social Studio — Sonnet
- MCP Gateway — Sonnet

### Group D — Orchestration

- Campaign Studio — Opus
- HQ Integration and Governance — Opus
- Testing and Release Harness — Sonnet

## Integration Gates

### Gate 1 — Contract Freeze

Required before replacing mocks with real package imports.

Must stabilize:

- IDs
- Version fields
- Error envelope
- Event envelope
- Approval status
- Maturity stage
- Asset references
- Job status

### Gate 2 — Persistence Freeze

Must stabilize:

- Supabase table ownership
- RLS responsibilities
- Storage bucket names
- Realtime event payloads
- Service-role boundaries
- Retention policy

### Gate 3 — Asset and Job Integration

Must prove:

- Media job creates a provider run
- Provider result creates a registered asset
- Provenance is complete
- Cost is recorded
- Realtime status reaches HQ
- Retry does not duplicate assets

### Gate 4 — Creative Runtime Integration

Must prove:

- Website, presentation, scene, render, and social tools consume the same IDs
- One creative document can render to more than one format
- Brand profile applies consistently
- Missing dependencies use graceful fallback

### Gate 5 — Governance Integration

Must prove:

- Maturity stage limits cost
- Premium jobs can require approval
- Unknown rights block publication
- Agent actions are attributable
- Audit events are queryable

## Merge Order

1. Shared Contract Standard
2. Creative Document Core
3. Asset Registry and Provenance
4. Brand and Template System
5. Security, Cost, and Observability
6. Media Core and Provider Router
7. MCP Gateway
8. 3D Scene System
9. Render and Export Engine
10. Website Builder
11. Presentation Builder
12. Social Studio
13. Campaign Studio
14. HQ Integration and Governance
15. Testing and Release Harness final gate

## Conflict Resolution

When two branches change the same public contract:

1. Stop merging
2. Open an ADR
3. Prefer additive compatibility
4. Add migration support
5. Update fixtures
6. Rebase affected branches
7. Re-run contract tests

## Branch Naming

```text
feat/marketing-contracts
feat/creative-document
feat/asset-registry
feat/brand-system
feat/security-cost-observability
feat/media-core
feat/mcp-gateway
feat/scene-system
feat/render-engine
feat/website-builder
feat/presentation-builder
feat/social-studio
feat/campaign-studio
feat/hq-marketing-governance
feat/marketing-release-harness
```

## Merge Readiness Checklist

- Public contracts unchanged or versioned
- Tests pass
- RLS reviewed
- Feature flag exists
- Offline/mock path works
- Handoff is complete
- Rollback is documented
- No browser secrets
- Cost impact is documented
- Vercel preview is available
