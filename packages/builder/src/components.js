// ─────────────────────────────────────────────────────────────────────────
// B1 · Portable component contract  (Opus, contract-freeze)
// The shape every portable block (B4a, Fable) must satisfy, and the pure
// selection logic the kernel uses to pick relevant blocks for a brief (so the
// generation context stays bounded — the whole point of component-assembly,
// per Single-File-Builder.md). The registry ARRAY itself is filled in B4;
// this freezes its item shape + the selector so B4a can build against it now.
// ─────────────────────────────────────────────────────────────────────────

export const COMPONENT_CATEGORIES = Object.freeze([
  'navigation', 'hero', 'layout', 'form', 'table', 'chart', 'metric', 'timeline', 'gallery', 'footer', 'pricing',
]);
export const isComponentCategory = (c) => COMPONENT_CATEGORIES.includes(c);

/**
 * @typedef {Object} PortableComponent  a standalone HTML/CSS(/JS) block that is
 *   valid inside a sandboxed iframe with no external deps beyond the approved
 *   allowlist. Themes via a small `--brand-*` variable contract (NOT the HQ
 *   theme tokens — these live in founder-generated artifacts). B4a produces
 *   ~15-20 of these; B4b's registry indexes them.
 * @property {string} id
 * @property {string} name
 * @property {string} category    one of COMPONENT_CATEGORIES
 * @property {('application'|'website')[]} suitableFor
 * @property {string} description
 * @property {string[]} tags
 * @property {string} html
 * @property {string} css
 * @property {string} [javascript]
 */

/** True iff a block has every required field, its category is known, and it
 * declares at least one mode it suits. Used by a B4 test to gate the library. */
export function isValidComponent(c) {
  return !!c && typeof c.id === 'string' && typeof c.name === 'string'
    && isComponentCategory(c.category)
    && Array.isArray(c.suitableFor) && c.suitableFor.length > 0
    && c.suitableFor.every((m) => m === 'application' || m === 'website')
    && typeof c.html === 'string' && typeof c.css === 'string';
}

/**
 * Select the components relevant to a brief, bounded to `max` (default 6) so
 * the generation context never balloons. Scores by tag/name/category keyword
 * hits in the brief, filtered to the artifact's mode. Deterministic, pure.
 * @param {PortableComponent[]} registry
 * @param {{brief:string, kind:'application'|'website', max?:number}} o
 * @returns {PortableComponent[]}
 */
export function selectComponents(registry, o) {
  const s = String(o.brief || '').toLowerCase();
  const max = o.max ?? 6;
  const scored = registry
    .filter((c) => c.suitableFor.includes(o.kind))
    .map((c) => {
      const terms = [c.name, c.category, ...(c.tags || [])].map((t) => String(t).toLowerCase());
      const score = terms.reduce((n, t) => n + (t && s.includes(t) ? 1 : 0), 0);
      return { c, score };
    })
    .sort((a, b) => b.score - a.score);
  // always include a nav + footer scaffold for a website even if unscored —
  // a page without them reads as broken; the model can still omit if it must.
  const picked = scored.filter((x) => x.score > 0).slice(0, max).map((x) => x.c);
  return picked;
}
