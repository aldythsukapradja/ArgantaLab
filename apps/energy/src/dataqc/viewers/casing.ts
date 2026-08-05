// viewers/casing.ts — the shared casing vocabulary for the operations-geology views.
//
// Pure TS (no JSX, no DOM) so it is node-testable, and so the trajectory viewer, the
// drilling log and the well schematic all speak the SAME language — a 9 5/8" shoe must
// read identically wherever it appears, or the three views stop looking like one
// document about one wellbore.

/** A hole section derived from a step-down in the mud log's measured bit diameter.
 *  `bitSizeIn` and the depths are MEASURED. `casingIn` is the CONVENTIONAL string for
 *  that hole size — carried with `casingBasis` saying so, never passed off as data. */
export interface HoleSection {
  bitSizeIn: number;
  topMd: number;
  baseMd: number;
  casingIn?: number | null;
  casingPointMd?: number | null;
  casingBasis?: string | null;
}

/** Standard North Sea hole → casing programme. Kept here so the build and the three
 *  viewers cannot drift apart on what a 12¼" hole is normally cased with. */
export const CASING_FOR_HOLE: Record<number, number> = {
  36: 30, 26: 20, 17.5: 13.375, 12.25: 9.625, 8.5: 7,
};

const FRAC: Record<string, string> = {
  '0.125': '1/8', '0.25': '1/4', '0.375': '3/8',
  '0.5': '1/2', '0.625': '5/8', '0.75': '3/4', '0.875': '7/8',
};

/** 13.375 → "13 3/8". Casing and bit sizes are quoted in fractions on every schematic,
 *  mud report and casing tally in the industry; a decimal reads as a typo. */
export function fmtIn(v: number): string {
  const whole = Math.floor(v);
  const frac = +(v - whole).toFixed(3);
  if (frac === 0) return String(whole);
  return `${whole} ${FRAC[String(frac)] ?? frac}`;
}

/** The section a given measured depth falls inside, or null when it is below TD. */
export function sectionAt(sections: HoleSection[], md: number): HoleSection | null {
  return sections.find((s) => md >= s.topMd && md <= s.baseMd) ?? null;
}

/** Label for a section as it appears on a schematic annotation. The final section has
 *  no casing below it, so it is named as open hole rather than given a phantom shoe. */
export function sectionLabel(s: HoleSection, isFinal: boolean): string {
  if (isFinal) return `${fmtIn(s.bitSizeIn)}" open hole`;
  return s.casingIn
    ? `${fmtIn(s.casingIn)}" csg @ ${s.baseMd.toFixed(0)}`
    : `${fmtIn(s.bitSizeIn)}" hole @ ${s.baseMd.toFixed(0)}`;
}
