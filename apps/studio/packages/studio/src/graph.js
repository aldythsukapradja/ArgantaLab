"use client";

// ─── ArgantaStudio knowledge graph adapter ───────────────────────────────────
//
// Turns the run/character/post ledger into a {nodes, edges} graph:
//
//     character ──generates──▶ generation ──published──▶ post
//
// Node shape mirrors the vault graph's generic EngineNode contract
// ({id, title, kind, color, deg, x, y}) so this can later be handed to the
// apps/hq PixiJS + d3-force engine with ZERO changes to this builder — the
// engine is domain-agnostic; only this adapter knows about studio entities.
//
// Layout is DETERMINISTIC (no force sim / worker): characters are hubs on an
// outer ring, their generations orbit each hub, posts sit just beyond their
// generation. Same input → same layout, cheap, no CPU spin — the deterministic-
// first ethos applied to layout.

export const KIND_COLOR = {
  character: '#22d3ee',
  generation: '#a855f7',
  post: '#e5ff33',
};

const TAU = Math.PI * 2;

/**
 * Build the studio knowledge graph.
 * @param {object[]} runs        studio_runs (generations)
 * @param {object[]} characters  characters (souls)
 * @param {object[]} posts       studio_posts (may be empty until C6)
 * @param {object}   opts        { width, height }
 * @returns {{nodes: object[], edges: object[]}}
 */
export function buildStudioGraph(runs = [], characters = [], posts = [], opts = {}) {
  const width = opts.width || 900;
  const height = opts.height || 600;
  const cx = width / 2;
  const cy = height / 2;

  const nodes = [];
  const edges = [];
  const byId = new Map();

  const add = (n) => { nodes.push(n); byId.set(n.id, n); return n; };

  // Characters that actually exist, plus a synthetic "Unassigned" hub for
  // generations with no character — so nothing floats context-free.
  const charList = [...characters];
  const hasOrphans = runs.some((r) => !r.character_id);
  if (hasOrphans) {
    charList.push({ id: '__unassigned__', name: 'Unassigned', synthetic: true });
  }

  const hubCount = Math.max(1, charList.length);
  const hubRadius = Math.min(width, height) * 0.30;

  charList.forEach((c, i) => {
    const a = (i / hubCount) * TAU - Math.PI / 2;
    const hx = cx + Math.cos(a) * (charList.length > 1 ? hubRadius : 0);
    const hy = cy + Math.sin(a) * (charList.length > 1 ? hubRadius : 0);
    add({
      id: c.id,
      title: c.name,
      kind: 'character',
      color: c.synthetic ? '#64748b' : KIND_COLOR.character,
      deg: 0,
      x: hx, y: hy,
      r: c.synthetic ? 14 : 20,
      synthetic: !!c.synthetic,
      trigger_token: c.trigger_token,
    });

    // Generations for this character orbit the hub.
    const gens = runs.filter((r) => (r.character_id || '__unassigned__') === c.id);
    const orbit = 78 + Math.min(60, gens.length * 3);
    gens.forEach((g, j) => {
      const ga = (j / Math.max(1, gens.length)) * TAU + a;
      const gx = hx + Math.cos(ga) * orbit;
      const gy = hy + Math.sin(ga) * orbit;
      const gnode = add({
        id: g.id,
        title: g.prompt || 'generation',
        kind: 'generation',
        color: g.status === 'failed' ? '#ef4444' : KIND_COLOR.generation,
        deg: 1,
        x: gx, y: gy,
        r: 8,
        status: g.status,
        asset_url: g.asset_url || null,
        provider: g.provider,
      });
      edges.push({ source: c.id, target: g.id, kind: 'generates' });

      // Posts derived from this generation sit just beyond it.
      const gposts = posts.filter((p) => p.run_id === g.id);
      gposts.forEach((p, k) => {
        const pa = ga + (k - (gposts.length - 1) / 2) * 0.25;
        add({
          id: p.id,
          title: `${p.platform || 'post'}${p.format ? ' · ' + p.format : ''}`,
          kind: 'post',
          color: KIND_COLOR.post,
          deg: 2,
          x: gx + Math.cos(pa) * 42,
          y: gy + Math.sin(pa) * 42,
          r: 6,
          platform: p.platform,
          status: p.status,
        });
        edges.push({ source: g.id, target: p.id, kind: 'published' });
      });
    });
  });

  // Degree for sizing/emphasis.
  for (const e of edges) {
    const s = byId.get(e.source); const t = byId.get(e.target);
    if (s) s.deg++; if (t) t.deg++;
  }

  return { nodes, edges };
}

/** Summary counts for the graph header. */
export function graphStats(nodes) {
  const by = { character: 0, generation: 0, post: 0 };
  for (const n of nodes) if (by[n.kind] != null) by[n.kind]++;
  return by;
}
