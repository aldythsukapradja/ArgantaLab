// fielddev/horizon-order.ts — put mapped surfaces in stratigraphic order, oldest first.
//
// Surfaces arrive in whatever order the asset store lists them, which is neither
// stratigraphic nor stable. A horizon selector that reads BCU, Hugin Base, Hugin
// Top, Shetland Top, Ty Top is alphabetical, and reading it as a section is wrong:
// it puts the Base Cretaceous Unconformity beneath the Middle Jurassic reservoir.
//
// TWO bases, and which one was used is reported, never hidden:
//   • AGE — the stratigraphy sheet's age_base_ma for the matched rock unit. This is
//     a published fact and it is the real answer.
//   • DEPTH — mean grid depth, deeper = older. A proxy, and only valid for a
//     layer-cake: it is wrong across a thrust, an overturned limb, or a surface
//     that is not a stratigraphic boundary at all. Used only where age is missing,
//     and the caller is told.
// Mixing the two in one sort would be worse than either, so age-known surfaces are
// ordered among themselves and depth-only surfaces are placed by depth relative to
// them — see below.

export interface OrderableHorizon {
  id: string;
  name: string;
  /** age of the horizon in Ma, when the stratigraphy sheet carries the unit.
   *  For a "Top" this is the unit's top age; for a "Base", its base age. */
  ageMa?: number | null;
  /** mean of the grid's own zmin/zmax, in metres below datum. Positive down. */
  meanDepth?: number | null;
}

export type OrderBasis = 'age' | 'depth' | 'none';

export interface OrderedHorizon<T extends OrderableHorizon> {
  item: T;
  basis: OrderBasis;
}

/**
 * Oldest → youngest.
 *
 * Sorts on a single comparable key so the result is a total order: age when the
 * unit is dated (older = larger Ma), otherwise depth (older = deeper). Because the
 * two scales are not interchangeable, comparison BETWEEN a dated and an undated
 * surface falls back to depth, which both always have. A surface with neither is
 * pushed to the end rather than dropped — it is still a real ingested horizon, it
 * just cannot be placed.
 */
export function orderHorizons<T extends OrderableHorizon>(items: T[]): Array<OrderedHorizon<T>> {
  const basisOf = (h: T): OrderBasis => (Number.isFinite(h.ageMa) ? 'age'
    : Number.isFinite(h.meanDepth) ? 'depth' : 'none');

  const rank = (a: T, b: T): number => {
    const aAge = Number.isFinite(a.ageMa), bAge = Number.isFinite(b.ageMa);
    // both dated: age decides, and it is the real answer
    if (aAge && bAge) return (b.ageMa as number) - (a.ageMa as number);
    const aD = Number.isFinite(a.meanDepth), bD = Number.isFinite(b.meanDepth);
    // otherwise depth, which is the only scale both sides share
    if (aD && bD) return (b.meanDepth as number) - (a.meanDepth as number);
    if (aD !== bD) return aD ? -1 : 1;      // placeable before unplaceable
    return a.name.localeCompare(b.name);    // neither: stable, and alphabetical is honest
  };

  return items.slice().sort(rank).map((item) => ({ item, basis: basisOf(item) }));
}

/** One-line note for the UI: says which basis actually carried the order, so a
 *  depth-proxy ordering is never presented as if it were dated stratigraphy. */
export function orderNote(ordered: Array<OrderedHorizon<OrderableHorizon>>): string {
  const n = ordered.length;
  const aged = ordered.filter((o) => o.basis === 'age').length;
  const depth = ordered.filter((o) => o.basis === 'depth').length;
  if (!n) return '';
  if (aged === n) return 'oldest → youngest, by published unit age';
  if (aged === 0) return `oldest → youngest, by grid depth — no unit ages matched (${depth}/${n})`;
  return `oldest → youngest — ${aged}/${n} by published age, the rest by grid depth`;
}
