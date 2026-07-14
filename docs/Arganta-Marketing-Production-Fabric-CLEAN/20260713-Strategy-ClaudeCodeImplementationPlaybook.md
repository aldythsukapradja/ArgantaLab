---
title: Claude Code Implementation Playbook
date: 20260713
category: Strategy
status: Ready
tags:
  - claude-code
  - git-worktrees
  - implementation
  - handoff
---

# Claude Code Implementation Playbook

## Summary

Use Claude Code as a coordinated engineering organization, not as one long conversation.

Each workstream receives:

- One model owner
- One branch
- One Git worktree
- One workstream note
- Shared public contracts
- Owned repository paths
- Mock dependencies
- Acceptance criteria
- A handoff requirement

## Core Principle

> One workstream, one owner, one branch, one handoff.

## Step 1 — Add This Folder to ArgantaLab

Recommended destination:

```text
docs/marketing-production-fabric/
```

Commit the planning package separately:

```bash
git checkout main
git pull
git checkout -b docs/marketing-production-fabric
git add docs/marketing-production-fabric
git commit -m "docs: add marketing production fabric source of truth"
git push -u origin docs/marketing-production-fabric
```

Merge this documentation branch first.

## Step 2 — Create the Program Integration Branch

```bash
git checkout main
git pull
git checkout -b feat/marketing-production-fabric
git push -u origin feat/marketing-production-fabric
```

All workstream pull requests target this branch until the program is stable.

## Step 3 — Implement Shared Contracts First

Create:

```bash
git checkout feat/marketing-production-fabric
git checkout -b feat/marketing-contracts
```

Give Claude Code:

- `20260713-Architecture-Opus-SharedContractStandard.md`
- Existing relevant type packages
- Current root package and workspace configuration

Launch prompt:

```text
You are the sole owner of the Arganta Marketing Fabric shared contracts.

Implement versioned TypeScript and Zod contracts for:
- CreativeDocument
- MediaAsset
- MediaJob
- SceneDefinition
- RenderRequest
- BrandProfile
- CampaignDefinition
- ApprovalRecord
- CommonError

Rules:
- preserve GitHub, Supabase, and Vercel
- do not implement domain services
- keep provider-specific types out of public contracts
- add fixtures and contract tests
- document compatibility and migration rules
- verify the existing workspace topology before editing package configuration
- create a handoff note
```

## Step 4 — Create Git Worktrees

```bash
mkdir -p ../arganta-worktrees
```

Example:

```bash
git worktree add ../arganta-worktrees/creative-document   -b feat/creative-document feat/marketing-production-fabric

git worktree add ../arganta-worktrees/asset-registry   -b feat/asset-registry feat/marketing-production-fabric

git worktree add ../arganta-worktrees/media-core   -b feat/media-core feat/marketing-production-fabric

git worktree add ../arganta-worktrees/scene-system   -b feat/scene-system feat/marketing-production-fabric

git worktree add ../arganta-worktrees/render-engine   -b feat/render-engine feat/marketing-production-fabric

git worktree add ../arganta-worktrees/website-builder   -b feat/website-builder feat/marketing-production-fabric
```

Open a separate Claude Code session inside each worktree.

## Step 5 — Start Parallel Workstreams

Recommended first parallel wave:

| Workstream | Model |
|---|---|
| Shared Contract Standard | Opus |
| Creative Document Core | Opus |
| Asset Registry and Provenance | Opus |
| Brand and Template System | Opus |
| Security, Cost, and Observability | Opus |
| Media Core and Provider Router | Sonnet |
| 3D Scene System | Sonnet |
| Render and Export Engine | Sonnet |
| Website Builder | Sonnet |

Other workstreams can start against mocks.

## Step 6 — Limit Claude Code Context

Do not load the whole monorepo.

Provide:

- One workstream note
- The relevant shared contracts
- The exact owned paths
- Only the existing files needed for integration

Ask Claude Code to summarize large files before changing them.

## Step 7 — Standard Workstream Launch Prompt

```text
You are the sole owner of this workstream.

Read:
- this workstream note
- the shared contract standard
- the relevant existing Arganta repository paths

Rules:
- preserve GitHub, Supabase, and Vercel
- work only inside the owned paths
- use mocks for unfinished dependencies
- depend only on shared contracts and documented adapters
- do not call external providers from UI components
- preserve offline development where relevant
- include tests, migrations, documentation, and a handoff note
- do not stop for minor ambiguity
- complete one vertical happy path before adding secondary features
```

## Step 8 — Enforce the Execution Loop

### Audit

Prompt:

```text
Audit the relevant repository paths.

Return:
1. current architecture
2. reusable code
3. gaps
4. proposed file tree
5. files to modify
6. public interfaces
7. Supabase changes
8. Vercel changes
9. security and cost risks

Do not edit yet.
```

### Plan

Prompt:

```text
Create a detailed implementation plan with:
- package structure
- public APIs
- persistence model
- migrations
- mocks
- feature flags
- failure handling
- tests
- rollback
- handoff artifacts

After the plan, begin scaffolding.
```

### Scaffold

Require:

- Package entry point
- Public types
- Mock adapters
- Test setup
- Fixtures
- README
- Feature flag
- Handoff template

### Happy Path

Complete one end-to-end flow before variants.

### Failure Handling

Require:

- Input validation
- Idempotency
- Retries
- Timeouts
- Cancellation where supported
- Webhook replay protection
- Error normalization
- Audit logs

### Tests

Minimum:

- Unit tests
- Contract tests
- Integration test
- Migration checks
- One smoke test
- Offline/mock test where relevant

### Staff-Engineer Review

```text
Review this implementation as a strict staff engineer.

Find and fix:
- contract drift
- hidden coupling
- security weaknesses
- missing Supabase RLS
- exposed secrets
- provider lock-in
- Vercel runtime risks
- Supabase Edge runtime risks
- missing idempotency
- missing retries
- missing cleanup
- missing rollback
- untested failure modes
- large-file and storage risks
```

### Handoff

Create:

```text
docs/handoffs/<workstream>.md
```

The handoff must contain:

- Summary
- Files changed
- Public APIs
- Contracts consumed
- Environment variables
- Supabase migrations
- RLS policies
- Storage buckets
- Vercel routes
- Feature flags
- Tests
- Demo steps
- Known limitations
- Integration steps
- Rollback steps
- Follow-up decisions

## Step 9 — Use Mocks to Preserve Independence

Examples:

### Website Builder

Use:

- Mock asset picker
- Fixture brand profile
- Mock scene component
- Mock preview publisher

### Presentation Builder

Use:

- Fixture scene definition
- Mock narration asset
- Mock render adapter

### MCP Gateway

Use:

- Mock Media Core
- Mock Asset Registry
- Mock Campaign service

### Social Studio

Use:

- Fixture Creative Documents
- Mock render output
- Fixture campaign metadata

### Campaign Studio

Use:

- Mock builder adapters
- Mock cost estimates
- Mock approvals

## Step 10 — Invoke Fable Only After Functionality Exists

Recommended Fable checkpoints:

- First working website template
- First working reactor scene
- First cinematic presentation
- First social content pack
- First end-to-end campaign

Fable provides ranked recommendations only.

The original owner remains accountable for implementation.

## Step 11 — Pull Request Standard

Every PR must include:

- Workstream name
- Owner model
- Scope
- Owned paths
- Contract changes
- Supabase changes
- Vercel changes
- Security impact
- Cost impact
- Screenshots or recordings
- Test evidence
- Rollback plan
- Handoff file

## Step 12 — Integration Verification

After each merge into the integration branch:

```bash
npm install
npm run type-check
npm run test
npm run build
```

Also verify:

- Supabase migrations
- RLS behavior
- Contract compatibility
- Offline mode
- Vercel preview
- HQ navigation
- Realtime job updates
- Asset lineage
- Budget and approval flow

## Step 13 — First Vertical Slice

Build:

```text
Campaign brief
→ reusable reactor scene
→ landing-page hero
→ cinematic presentation
→ 16:9 video
→ 9:16 video
→ Instagram post
→ Instagram story
→ asset lineage
→ cost record
→ approval
→ Vercel preview
```

## Step 14 — Release Strategy

Release behind feature flags.

Recommended flags:

```text
marketingFabric.enabled
marketingFabric.mediaCore
marketingFabric.sceneStudio
marketingFabric.websiteStudio
marketingFabric.presentationStudio
marketingFabric.socialStudio
marketingFabric.campaignStudio
```

Promote one feature at a time from:

```text
local
→ preview
→ internal
→ limited production
→ production
```
