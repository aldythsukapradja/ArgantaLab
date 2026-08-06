// petro-contact.ts — putting a TVDSS contact onto an MD track, honestly.
//
// The correlation panel hangs on MEASURED depth. Contacts are published in
// TVDSS. On Volve, whose bores are deviated by hundreds of metres, drawing a
// −3120 m TVDSS oil–water contact at 3120 m MD would be wrong by a different
// amount in every well — and wrong in a way that looks completely plausible,
// which is the dangerous kind.
//
// The bridge used here is the delivery's own: a formation pick is recorded
// TWICE, once as MD and once as TVDSS. Two such picks on a bore give that
// bore's local md↔tvdss relationship without needing a KB elevation, a survey,
// or a minimum-curvature integration — all things this panel does not have.
//
// Where a bore does not carry two dual-recorded picks, the contact is NOT drawn
// on it. A contact line placed by assuming the well is vertical is a claim the
// data does not support.

export interface DualPick { md: number; tvdss?: number | null }

export interface MdTvdFit {
  /** md ≈ a + b·tvdss */
  a: number;
  b: number;
  /** how many dual-recorded picks the fit rests on */
  n: number;
  /** the TVDSS span those picks cover — the range the fit is honest inside */
  from: number;
  to: number;
}

const finite = (v: unknown): v is number => Number.isFinite(v as number);

/**
 * Least-squares md-on-tvdss from a bore's own picks.
 *
 * Null when fewer than two dual picks exist, or when they share one TVDSS — a
 * vertical-span of zero has no slope, and inventing one would place the contact
 * anywhere at all.
 *
 * NOTE the sign convention: TVDSS is negative downwards in some deliveries and
 * positive downwards in others. The fit does not care — it is regressing MD on
 * whatever the delivery calls TVDSS, so it inherits that convention rather than
 * assuming one. The caller must pass the contact in the SAME convention the
 * picks use, which is why `contactMd` takes the raw contact value.
 */
export function fitMdTvd(picks: DualPick[]): MdTvdFit | null {
  const pts = picks
    .filter((p): p is { md: number; tvdss: number } => finite(p.md) && finite(p.tvdss))
    .map((p) => [p.tvdss, p.md] as const);
  if (pts.length < 2) return null;

  let sx = 0, sy = 0;
  for (const [x, y] of pts) { sx += x; sy += y; }
  const mx = sx / pts.length, my = sy / pts.length;

  let num = 0, den = 0;
  for (const [x, y] of pts) { num += (x - mx) * (y - my); den += (x - mx) ** 2; }
  if (den <= 1e-9) return null;

  const b = num / den;
  const xs = pts.map((p) => p[0]);
  return { a: my - b * mx, b, n: pts.length, from: Math.min(...xs), to: Math.max(...xs) };
}

export interface ContactPlacement {
  md: number;
  /** true when the contact lies OUTSIDE the TVDSS span the picks cover, so the
   *  fit is being extrapolated rather than interpolated */
  extrapolated: boolean;
  n: number;
}

/**
 * Where a contact lands on this bore's MD track. Null when there is no fit.
 *
 * Extrapolation is allowed but FLAGGED, because a contact below the deepest pick
 * is the normal case — the OWC is usually deeper than every formation top — and
 * refusing it outright would draw the contact on almost no bore. Refusing to say
 * it is extrapolated would be the actual dishonesty.
 */
export function contactMd(fit: MdTvdFit | null, tvdss: number): ContactPlacement | null {
  if (!fit || !finite(tvdss)) return null;
  const md = fit.a + fit.b * tvdss;
  if (!finite(md)) return null;
  const lo = Math.min(fit.from, fit.to), hi = Math.max(fit.from, fit.to);
  // a 5 % tolerance on the span — a contact a metre past the deepest pick is not
  // meaningfully an extrapolation
  const pad = (hi - lo) * 0.05;
  return { md, extrapolated: tvdss < lo - pad || tvdss > hi + pad, n: fit.n };
}

/** The contact a panel should draw, chosen from the workspace's list. */
export function primaryContact<T extends { kind: string; tvdss: number | null }>(
  contacts: T[],
): T | null {
  // Fluid contacts only. The well master's list also carries things like a
  // reference datum, and drawing one of those as a fluid contact would be a
  // fabricated interpretation.
  const fluid = contacts.filter((c) => /owc|gwc|goc|fwl/i.test(String(c.kind)) && finite(c.tvdss));
  if (!fluid.length) return null;
  // deepest first — on a field with several, the free-water level is the one the
  // net-pay flag is actually cutting against
  return fluid.slice().sort((a, b) => Math.abs(b.tvdss as number) - Math.abs(a.tvdss as number))[0];
}
