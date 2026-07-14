// kind + requested maturity → concrete adapter. Cloned from @arganta/ai's
// task→tier→provider router: honor the request, walk DOWN to the nearest
// cheaper available stage, never hard-fail (fall back to mock).
//
// Walking down (not up) encodes the core principle: prefer the cheapest capable
// provider. A caller asking for stage 2 that only has stage 0 gets stage 0 for
// free — it never silently escalates to something more expensive.

import { MEDIA_KINDS, MATURITY } from './contracts.js';

/**
 * @param {ReturnType<import('./registry.js').createRegistry>} registry
 * @param {string} kind
 * @param {number} requestedStage
 * @returns {{ adapter:object, stage:number, downgraded:boolean }}
 */
export function route(registry, kind, requestedStage = MATURITY.DETERMINISTIC) {
  if (!MEDIA_KINDS.includes(kind)) {
    return { adapter: registry.mock, stage: 0, downgraded: true, reason: `unknown kind "${kind}"` };
  }
  const want = Math.max(0, Math.min(MATURITY.PREMIUM, requestedStage | 0));

  // exact, then walk down to the nearest cheaper available stage
  for (let s = want; s >= 0; s--) {
    const adapter = registry.get(kind, s);
    if (adapter) return { adapter, stage: s, downgraded: s !== want };
  }
  // nothing at/below requested — take the lowest available stage for this kind
  const stages = registry.stagesFor(kind);
  if (stages.length) {
    const s = stages[0];
    return { adapter: registry.get(kind, s), stage: s, downgraded: true };
  }
  return { adapter: registry.mock, stage: 0, downgraded: true, reason: `no adapter for "${kind}"` };
}
