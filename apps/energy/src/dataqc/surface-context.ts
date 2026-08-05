// surface-context.ts — link a digitized SURFACE (from the deep bundle or a client
// upload) back to the SAME stratigraphic model the Exploration tab's Basin Dossier
// reads: which rock unit is this, how old, what depositional environment, and what
// role does it play in the petroleum system (source/reservoir/seal/overburden) —
// KbSpine.stratigraphy + the real, evidence-derived psElement rows (element_role,
// effectiveness, confidence), not a re-derived or guessed classification.
//
// Matching is by NAME, not id — surfaces don't carry a stratigraphy foreign key. A
// picked/mapped horizon is conventionally named "<Unit> Top" or "<Unit> Base"
// ("Hugin Fm Top"), so this strips that generic suffix and matches case-insensitively
// against stratigraphy.unit_name. A surface with no match (the seafloor is not a rock
// unit) says so honestly rather than snapping to the nearest row.
import type { KbContext } from './masterkb.ts';

export interface SurfaceContext {
  unitName: string;
  isTop: boolean; isBase: boolean;
  ageTopMa?: number; ageBaseMa?: number;
  group?: string; environment?: string;
  /** coarse role from the stratigraphy sheet */
  stratRole?: string; roleNote?: string;
  /** the real, evidence-derived petroleum-system reading for this unit, when a psModel
   *  scoped to this field's province actually times it — richer than stratRole alone */
  psElement?: { role: string; effectiveness?: string; confidence?: string };
  cycleTitle?: string;
}

/** "Hugin Fm Top" → { base: "Hugin Fm", isTop: true }. Names with neither suffix
 *  ("BCU", the seafloor) pass through unchanged. */
export function stripEdgeSuffix(name: string): { base: string; isTop: boolean; isBase: boolean } {
  const m = name.trim().match(/^(.*)\s+(Top|Base)$/i);
  if (!m) return { base: name.trim(), isTop: false, isBase: false };
  return { base: m[1].trim(), isTop: /^top$/i.test(m[2]), isBase: /^base$/i.test(m[2]) };
}

/** Comparison key: case- and punctuation-insensitive. The two naming conventions in
 *  play are the mapped-surface style ("Hugin Fm Top") and the FORMATION-PICK style
 *  from the raw .dat ("Hugin Fm. VOLVE Top", "NORDLAND GP. Top", "Heather Fm. Sand
 *  VOLVE Top") — periods, casing and field/member qualifiers differ, the unit does not. */
const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export function surfaceContextFor(surfaceName: string | null | undefined, ctx: KbContext | null): SurfaceContext | null {
  if (!ctx || !surfaceName) return null;
  const { base, isTop, isBase } = stripEdgeSuffix(surfaceName);
  const k = key(base);
  // Exact key match first; otherwise the longest KB unit whose key PREFIXES this one,
  // which is what folds a field/member qualifier back onto its formation
  // ("huginfmvolve" → "huginfm", "heatherfmsandvolve" → "heatherfm") without ever
  // matching a different formation. Longest-wins prevents a short unit name from
  // capturing a longer unrelated one.
  let strat = ctx.stratigraphy.find((s) => key(s.unit_name) === k);
  if (!strat) {
    let bestLen = 0;
    for (const s of ctx.stratigraphy) {
      const sk = key(s.unit_name);
      if (sk.length > 2 && k.startsWith(sk) && sk.length > bestLen) { strat = s; bestLen = sk.length; }
    }
  }
  if (!strat) return null; // honest: not every surface is a named rock unit (e.g. the seafloor)

  // Prefer whichever matched psElement row actually carries a basin-cycle link (the
  // assessment-unit-scoped model is richer than the basin-wide catalog placeholder);
  // both are real evidence-derived rows, this just picks the more specific one.
  const hits = ctx.psElements.filter((e) => key(e.unit_name) === key(strat.unit_name));
  const best = hits.find((e) => e.basin_cycle_id) ?? hits[0];
  const cycle = best?.basin_cycle_id ? ctx.basinCycles.find((c) => c.cycle_id === best.basin_cycle_id) : undefined;

  return {
    unitName: strat.unit_name, isTop, isBase,
    ageTopMa: strat.age_top_ma, ageBaseMa: strat.age_base_ma,
    group: strat.group, environment: strat.environment,
    stratRole: strat.ps_role, roleNote: strat.role_note,
    psElement: best ? { role: best.element_role, effectiveness: best.effectiveness, confidence: best.confidence } : undefined,
    cycleTitle: cycle?.title,
  };
}
