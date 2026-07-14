---
title: Arganta Marketing Production Fabric
date: 20260713
category: Strategy
status: Ready
owner: Aldyth Sukapradja
source_of_truth: true
stack:
  - GitHub
  - Supabase
  - Vercel
tags:
  - arganta
  - marketing
  - multimedia
  - claude-code
  - architecture
---

# Arganta Marketing Production Fabric

## Summary

This folder is the clean implementation source of truth for the Arganta Marketing Production Fabric.

It defines a provider-agnostic production system for:

- Websites
- Cinematic HTML presentations
- Reusable 3D scenes
- Image and video generation
- Voice, music, and sound effects
- Instagram posts and stories
- TikTok and YouTube Shorts
- Campaign packs
- Brand-consistent templates
- HQ approvals, cost control, and provenance

The technology foundation remains:

- **GitHub** for source, versioning, pull requests, CI/CD, contracts, templates, and architecture records
- **Supabase** for authentication, Postgres, Storage, Realtime, jobs, assets, approvals, costs, and provenance
- **Vercel** for HQ deployment, previews, lightweight APIs, and MCP access

## Core Principle

> Ideation is free. Concept is free. Prototype is free to low cost. Development is paid but economical. Deployment is cheap by default. Premium cost is allowed only after evidence and approval.

## Program Model

### Opus

Owns one complete workstream when the work is primarily:

- Architecture
- Ontology
- Contracts
- Governance
- Security policy
- Cost policy
- Cross-system integration
- Maturation logic

### Sonnet

Owns one complete workstream when the work is primarily:

- TypeScript implementation
- React interfaces
- Supabase migrations
- Provider adapters
- MCP tools
- Rendering
- Tests
- Vercel integration

### Fable

Fable is never the implementation owner.

Fable is called only after a functioning creative milestone for:

- Visual hierarchy
- Cinematic pacing
- Camera and lighting
- Social-native composition
- Brand consistency
- Wow effect

The original Opus or Sonnet owner applies Fable recommendations.

## Workstream Map

| File | Owner | Outcome |
|---|---|---|
| `Architecture-Opus-SharedContractStandard` | Opus | Stable public contracts and versioning rules |
| `Architecture-Opus-CreativeDocumentCore` | Opus | Shared document model across all outputs |
| `Architecture-Opus-AssetRegistryProvenance` | Opus | Universal asset identity, lineage, rights, and approvals |
| `Architecture-Opus-BrandTemplateSystem` | Opus | Brand profiles, templates, and validation |
| `Architecture-Opus-CampaignStudio` | Opus | Campaign orchestration and deliverable matrix |
| `Architecture-Opus-HQIntegrationGovernance` | Opus | HQ approvals, budgets, maturity, and operations |
| `Architecture-Opus-SecurityCostObservability` | Opus | Cross-cutting guardrails |
| `Build-Sonnet-MediaCoreProviderRouter` | Sonnet | Provider-agnostic media jobs and routing |
| `Build-Sonnet-MCPGateway` | Sonnet | Thin MCP gateway |
| `Build-Sonnet-WebsiteBuilder` | Sonnet | Puck-based website builder |
| `Build-Sonnet-PresentationBuilder` | Sonnet | Cinematic HTML presentation builder |
| `Build-Sonnet-3DSceneSystem` | Sonnet | Reusable R3F scene system |
| `Build-Sonnet-RenderExportEngine` | Sonnet | Multi-format rendering and export |
| `Build-Sonnet-SocialStudio` | Sonnet | Instagram, TikTok, Shorts, and carousel outputs |
| `Build-Sonnet-TestingReleaseHarness` | Sonnet | Integration tests, preview validation, and release gates |

## Recommended Reading Order

1. `20260713-Strategy-ArgantaMarketingFabric-README.md`
2. `20260713-Strategy-ClaudeCodeImplementationPlaybook.md`
3. `20260713-Strategy-ParallelExecutionAndMergePlan.md`
4. `20260713-Strategy-BattleTestAndGapClosure.md`
5. `20260713-Architecture-Opus-SharedContractStandard.md`
6. The single workstream file assigned to the Claude Code session

## Parallelism Rule

Every workstream may begin in parallel only when it works against:

- Stable public contracts
- Mock adapters
- Shared fixtures
- Documented event payloads
- Explicit owned repository paths

A workstream must not wait for another workstream's internal implementation.

## Merge Rule

Start order and merge order are different.

Recommended merge order:

1. Shared contracts
2. Creative Document Core
3. Asset Registry and Provenance
4. Brand and Template System
5. Security, Cost, and Observability baseline
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

## First Vertical Slice

The first complete proof must produce:

1. One campaign brief
2. One reusable reactor scene
3. One landing page
4. One five-scene cinematic presentation
5. One 16:9 launch video
6. One 9:16 vertical video
7. One Instagram post
8. One Instagram story
9. One asset lineage graph
10. One cost and provider record
11. One approval event
12. One Vercel preview deployment

## Non-Negotiable Rules

- No direct provider calls from React UI
- No provider secrets in browser bundles
- No long-running render tied to browser lifetime
- No generated asset without provenance
- No unversioned creative document
- No premium generation without policy checks
- No cross-workstream import from private folders
- No MCP-owned durable business state
- No publication of assets with unknown rights
- No replacement of GitHub, Supabase, or Vercel without a separate approved ADR

## Repository Topology Warning

The current Arganta root declares `packages/*` as a workspace, while HQ has its own app package.

Before adding local package dependencies:

- Verify the package manager and workspace resolution
- Do not casually restructure the monorepo
- Record any workspace-layout change in an ADR
- Prefer package boundaries that work with the existing root configuration
