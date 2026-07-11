---
type: lesson
status: living
tags: [arganta, lesson]
---

# Don't add a dependency or a table before scale demands it — activate what exists first

> [!quote] The principle
> Reach for the existing table, the existing write path, the ~30 lines of inline code, and the shared build before you add a library, a migration, or a fork. Restraint now is a swap-path you document, not a debt you inherit.

## Evidence
- `apps/hq/src/vault/KNOWLEDGE_GRAPH_REVIEW.md` — custom canvas-2D + custom force sim chosen over Sigma.js/G6/Cytoscape/React-Flow, proven at 96fps/1k nodes with a *documented swap-to-sigma path past 2.5k*. Zero-dep discipline plus an honest weakness list.
- `docs/lashirabloom/music-builder-viz-buildplan.md` — inline ~30-line FFT instead of a dependency; Canvas+WebAudio for animated viz, D3/SVG only where analytical charts needed it. "Premium audio look at $0/no-assets/CSP-safe."
- `apps/hq/COMMAND_AUDIT_TRAIL.md` — "activate the existing `hq_event`, don't build `product_event`"; "27 agents reconcile under 6 offices, kill the tier taxonomy." Reuse over rebuild, and reduce surface.
- `apps/kingdom/docs/HANDOFF-CURRENT-STATE-2026-07-04.md` — skill slots persisted with **zero new tables** by nesting `spec.skills` inside the already-debounced `appearance_json.spec` — reusing an existing write path instead of adding a migration.
- `apps/web/MOBILE.md` + `apps/kinetik/CAPACITOR.md` — "wrap, don't fork": one React/Vite build runs web + Android + iOS, plugins web-shimmed to a no-op. No parallel native codebase.
- `docs/music-forge-generative-buildplan.md` — generation-by-construction over CC0 asset files, specifically to preserve the CSP-clean, zero-asset guarantee. The architecture constraint drove the creative choice.

## The pattern
The winning calls repeatedly favored the minimal substrate: reuse a table, nest into an existing debounced write, inline the algorithm, wrap the web build. Each avoided a migration, a fork, or a dependency that would have to be maintained forever — and where a library *might* be needed at scale, the swap path was documented rather than pre-built.

## Watch for
- The mirror-image failure: when you *don't* reuse, you get 5 lockfiles (D7), 3× asset duplication (D3), and a 939 MB `.git` (D2). The copied Kingdom engine in Lashira ("extract later") is the tax on skipping this.
- A big-design-up-front schema that ships at a fraction of its table count (`mmorpg-supabase-schema.md` → ~15% built; the grand ledger tables scoped down to a progression slice in `002`). If the tables aren't needed yet, don't spec dozens.
- A dependency added "to be safe" with no stress test proving it's needed and no documented threshold for when it would be.
