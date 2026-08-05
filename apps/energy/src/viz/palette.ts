// The Exploration canvas palette. Every value here was produced by the dataviz
// validator against THIS app's real surfaces (--panel light #ffffff, dark
// #0f172a) — not chosen by eye, and not the validator's built-in defaults.
//
//   LIGHT  worst adjacent CVD ΔE 12.9 (#ef4444↔#0FB5A6 deutan) · normal ΔE 25.2
//   DARK   worst adjacent CVD ΔE 11.4 · normal ΔE 24.3 · all slots ≥3:1 contrast
//
// The slot ORDER is the colour-blind-safety mechanism, not decoration. The first
// ordering tried (blue, amber, teal, purple, red, green) put green beside red at
// ΔE 8.1 — barely over the floor. Moving red to slot 4 lifted the worst adjacent
// pair to 12.9. Do not re-order these for taste.
export const SERIES_LIGHT = ['#2563eb', '#f59e0b', '#0FB5A6', '#ef4444', '#7c3aed', '#10b981'] as const;
export const SERIES_DARK = ['#3b82f6', '#d97706', '#0d9488', '#e04a4a', '#8b5cf6', '#059669'] as const;

// Forms where every pair is visible at once (scatter, bubble, choropleth, the CRS
// matrix, the analogue arc map, small multiples) cannot lean on the adjacent
// pairlist. Only the first THREE slots clear all-pairs in both modes:
//   light worst pair CVD ΔE 14.4 / normal 25.2 · dark CVD 12.5 / normal 19.1
// A fourth hue breaks it — tested, not assumed: red↔amber fails dark (normal 11.4),
// purple↔blue is indistinguishable under deutan (0.4 light / 1.3 dark), and
// magenta↔teal fails dark (3.8). Past three: fold to "Other" or facet.
export const ALL_PAIRS_CAP = 3;

/** Pin slot colours, in assignment order. Colour follows the basin, never its rank. */
export const pinColor = (slot: number, dark: boolean): string =>
  (dark ? SERIES_DARK : SERIES_LIGHT)[slot % SERIES_LIGHT.length];

// Petroleum-system element roles. Three hues + neutral: overburden is the one role
// that is NOT a play element, so it recedes rather than competing for a hue it
// cannot safely have.
export const ROLE_COLOR: Record<string, { light: string; dark: string }> = {
  source: { light: '#2563eb', dark: '#3b82f6' },
  reservoir: { light: '#f59e0b', dark: '#d97706' },
  seal: { light: '#0FB5A6', dark: '#0d9488' },
  overburden: { light: '#94a3b8', dark: '#64748b' },
};

// Geodynamics has 5+ classes (rift, sag, pre-rift, inversion, passive-margin,
// foreland) and lives on all-pairs forms, so it gets THREE super-class hues and
// carries its sub-class as hatch angle instead. Colour answers "what kind of
// basin", texture answers "which stage" — and it survives greyscale printing.
export const GEODYNAMIC_CLASS: Record<string, 'extensional' | 'contractional' | 'quiescent'> = {
  rift: 'extensional', 'pre-rift': 'extensional', 'syn-rift': 'extensional', extensional: 'extensional',
  inversion: 'contractional', foreland: 'contractional', compressional: 'contractional', wrench: 'contractional',
  sag: 'quiescent', 'post-rift': 'quiescent', 'passive-margin': 'quiescent', platform: 'quiescent',
};
export const GEODYNAMIC_COLOR = {
  extensional: { light: '#2563eb', dark: '#3b82f6' },
  contractional: { light: '#f59e0b', dark: '#d97706' },
  quiescent: { light: '#0FB5A6', dark: '#0d9488' },
} as const;

/** Sequential magnitude ramp — one hue, light→dark. Never a rainbow. */
export const SEQUENTIAL_BLUE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#2563eb', '#184f95'] as const;
/** A second concurrent sequential context takes amber as its own one-hue ramp. */
export const SEQUENTIAL_AMBER = ['#fef0c7', '#fcd980', '#f8bf3c', '#f59e0b', '#d97706', '#92500a'] as const;

/** Diverging — blue↔red with a neutral grey midpoint. Only for genuinely signed values. */
export const DIVERGING = { negative: '#2563eb', midpoint: '#94a3b8', positive: '#ef4444' } as const;

// Status is reserved. It never doubles as "series 4", and it always ships with an
// icon + label because warning/serious are sub-3:1 on the light surface by design.
export const STATUS = {
  good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b',
} as const;

// ── Provenance ──────────────────────────────────────────────────────────────
// A chart can be blue AND recalled at the same time, so provenance cannot share
// the hue channel with series identity. It is a TEXTURE channel. With 626 of 630
// basin cycles recalled, this hatch is what keeps the framework column honest —
// and it stays honest in greyscale, in print and under forced-colors.
export type Provenance = 'SOURCED' | 'DERIVED' | 'RECALLED' | 'USER';

export const PROVENANCE_META: Record<Provenance, { label: string; hint: string; fill: string }> = {
  SOURCED: { label: 'Sourced', hint: 'Traceable to a cited authority', fill: 'solid' },
  DERIVED: { label: 'Derived', hint: 'Deterministic function of sourced data, rule visible', fill: 'solid + dashed edge' },
  RECALLED: { label: 'Recalled', hint: 'Model inference pending source verification', fill: '45° hatch' },
  USER: { label: 'User', hint: 'Entered by the user in this session', fill: '135° hatch + dashed outline' },
};

/** A panel's grade is the WORST grade among its inputs — never the best. */
const RANK: Provenance[] = ['SOURCED', 'DERIVED', 'RECALLED', 'USER'];
export const worstProvenance = (grades: Provenance[]): Provenance =>
  grades.reduce((worst, g) => (RANK.indexOf(g) > RANK.indexOf(worst) ? g : worst), 'SOURCED' as Provenance);
