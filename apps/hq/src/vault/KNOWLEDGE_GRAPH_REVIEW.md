# Knowledge Graph Self-Review

The Vault's Knowledge Graph (`src/vault/components/GraphView.tsx` + `src/vault/graph.ts`),
battle-tested 2026-07-06 against the "Obsidian-Inspired Knowledge Graph" brief.

## Library Chosen

**None — custom canvas-2D renderer + custom force simulation.**

Why:

1. **The data layer already existed.** The Vault holds real notes with real
   wikilinks, backlinks, tags, pillars, and types. The graph is a projection of
   that live store, not a mock dataset — the brief's `KnowledgeNode`/`KnowledgeEdge`
   model maps onto `GraphNode`/`GraphEdge`/`SuggestedEdge` in `types.ts`/`graph.ts`,
   which are renderer-agnostic.
2. **Canvas 2D covers the measured scale.** Sigma.js earns its WebGL complexity
   in the 5k–100k node range. Measured numbers below show canvas 2D holds 96 fps
   at 1,000 nodes, which clears the brief's 1k bar with headroom.
3. **Zero dependencies = zero risk on this repo.** apps/hq has a lean dependency
   set; keeping it that way was worth more than sigma's ceiling today.
4. **Swappability is preserved.** Rendering is one `draw()` function reading
   `{nodes, edges, suggested}` + a sim of `{x,y,r}` per node. Dropping in
   `@react-sigma/core` later means replacing GraphView's canvas block, not the
   data model, filters, inspector, or store.

## Alternatives Considered

- **Sigma.js + Graphology** — the right call past ~2k real notes. Rejected for
  now: adds 3 deps + a graphology data model that duplicates the vault store.
  This is the designated upgrade path (the data shapes were designed to feed it).
- **AntV G6** — fastest path to fancy built-ins, but heavy (~500kB+), opinionated
  theming that would fight the HQ token system, and most of its value
  (minimap, combos) isn't needed yet.
- **Cytoscape.js** — strongest algorithms, most academic feel; wrong aesthetic
  for an executive cockpit, and styling it out of "science tool" costs more than
  drawing directly.
- **React Flow / XYFlow** — wrong shape for an organic knowledge graph (it's a
  node-editor). Its role in the brief (Canvas Mode) is already served by the
  Vault's existing pointer-event canvas board.
- **3d-force-graph / Three.js** — "Galaxy mode" remains a future wow-layer;
  not a daily driver.

## What Works Well

- Hover neighborhood highlighting (non-neighbors fade to 5–15%, touched edges
  tint accent), click → inspector, double-click → local graph, drag nodes,
  smooth wheel-zoom-at-cursor, pan, fit-to-screen, animated camera jumps.
- Local graph with 1/2/3-hop depth slider (BFS over the filtered graph).
- Search with dropdown + camera tween to the hit.
- Filters: pillar chips, note type, tag, orphans; toggles: labels, links,
  suggested connections.
- **Suggested connections** — dotted accent edges from shared-tag similarity and
  unlinked mentions, each with a human-readable `reason`. This is the agent
  contract (`SuggestedEdge {source, target, weight, reason}`): a future
  ResearchAgent feeds the same pipe and the UI already distinguishes
  dotted-suggested from solid-confirmed.
- Inspector answers the brief's "operating layer" test: what is it (summary,
  type, status, pillar, tags), how it connects (backlinks/outgoing counts,
  connected chips, suggestions with reasons), what next (Open note, Local
  graph, To canvas — all real, no placeholder buttons).
- Theme: follows the Circle HQ shell theme by default (light and dark verified
  live), starfield + glow read premium in both.

## Weaknesses (honest)

- Repulsion is O(n²) with strided sampling above 700 nodes — layouts above ~2k
  get jittery convergence and 30 fps territory. Barnes-Hut or sigma is the fix.
- Labels: truncation at 26 chars, no collision avoidance — dense clusters
  overlap labels until you zoom.
- Edge weight is binary; link frequency between two notes isn't reflected in
  thickness yet.
- No mobile bottom-sheet inspector; the desktop inspector overlay is usable on
  tablet, cramped on phones.
- Hover hit-test is a linear scan (fine ≤5k; a quadtree is the tidy fix).
- Communities (Louvain-style clustering) not implemented — pillar coloring
  stands in for it and reads well at this scale.

## Performance Notes (measured, 144 Hz display, mid laptop)

| Scale (`?vaultStress=N`) | avg frame | max frame | effective fps |
| --- | --- | --- | --- |
| 23 real notes / ~60 edges | <2 ms | — | 144 (vsync) |
| 250 nodes / ~620 edges | 6.9 ms | 7.2 ms | 144 (vsync) |
| 1,000 nodes / ~2,500 edges | 10.5 ms | 14 ms | ~96 |
| 2,500 nodes / ~6,200 edges | 29.7 ms | 41.8 ms | ~34 |

Search + select under 1,000-node load: ~27 ms overhead; inspector opens
instantly. Glow (shadowBlur) auto-disables above 400 nodes. **Verdict:**
believable to 1k (brief requirement met), usable to 2.5k, swap to sigma.js past
that.

## Persona Battle-Test

- **Obsidian power user** — familiar in 10 seconds: force layout, hover
  fade, local graph, orphan toggle all where expected. Wants: label-size
  slider, per-group toggle list like Obsidian's "Groups" panel.
- **Founder/CEO** — the inspector's suggestions-with-reasons and the
  pillar chips give a "what connects / what's neglected" read; orphan toggle
  surfaces dead notes. Wants: a "stale notes" lens (age-based dimming).
- **CTO** — data model is store-derived and renderer-agnostic; stress harness
  is in-repo (`?vaultStress=N`); swap path documented. Wants: quadtree +
  Barnes-Hut before the vault hits four digits.
- **Product designer** — starfield, glow, halo-labels and accent-tinted focus
  edges read premium in both themes; empty state and no-result search state
  exist. Wants: label collision handling in dense clusters (known weakness).
- **Investor** — the dotted "agent-suggested" layer is the differentiator
  demo: the graph proposes connections with reasons, not just draws them.
- **11-year-old** — dragging nodes is fun and springy; double-click zoom-focus
  is discoverable by accident; nothing destructive is reachable from the graph.
- **QA** — verified: 10/250/1k/2.5k nodes, isolated nodes (orphan toggle),
  duplicate edges (deduped in `buildBacklinks` via Set), overlong titles
  (synthetic dataset includes them; truncated at 25 chars + ellipsis), no-result
  search (explicit state), light mode (default, verified live), theme flip while
  graph open (colors re-read from CSS vars every 40 frames).

## UX Notes

Premium: focus dimming, camera tweens, glass inspector, dotted suggestion
edges, starfield parallax. Still rough: label overlap when zoomed out on dense
clusters; local-graph banner + inspector can both occupy the top strip on
narrow windows; no keyboard navigation between nodes.

## Recommended Next Iteration

1. **Real agent suggestions** — pipe `ceo_ask`/Research agent output into
   `SuggestedEdge` with confidence + accept/dismiss actions (accept writes a
   real wikilink into the note body).
2. **Barnes-Hut quadtree** for repulsion + hover hit-testing → 5k nodes at 60fps
   without changing the renderer.
3. **Label collision avoidance** (grid-based occlusion, show top-degree labels
   first) — the single biggest legibility win.
4. **Timeline lens** — color/dim nodes by `updated` age to expose neglected
   areas of the vault (the CEO persona's ask).
5. **Mobile bottom-sheet inspector** and pinch-zoom gesture support.
