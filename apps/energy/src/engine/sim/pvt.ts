// sim/pvt.ts (S4) — black-oil PVT (Bo/Rs/Bg + saturation state). Volve anchors:
// the field stayed UNDERSATURATED its whole life (Pi≈330 bara ≫ Pb≈213 bar), so
// no free gas evolves in-reservoir and an oil–water sim is the correct physics.
// Ported 1:1 from scripts/test-sim.mjs (26/26 truth-lock). Pure TS.

/** Volve deck-anchored PVT constants (from the fluid study; see M5 concept §5). */
export const VOLVE_PVT = {
  pb: 213,      // bubble-point pressure (bara) — 15/9-F-4 MDT
  rsb: 160,     // solution GOR at Pb (Sm³/Sm³)
  bob: 1.47,    // oil FVF at Pb (rm³/Sm³), live oil
  pi: 330,      // initial reservoir pressure (bara)
  co: 1.2e-4,   // undersaturated oil compressibility (1/bar, screening)
  T: 383,       // reservoir temperature (K, ≈110 °C)
} as const;

/** Undersaturated oil FVF above the bubble point: Bo = Bob·exp(−co·(p−pb)). */
export function boUndersat(p: number, pb: number, bob: number, co: number): number { return bob * Math.exp(-co * (p - pb)); }

/** Solution GOR: constant = Rsb above Pb (undersaturated); linear screening decline below. */
export function rs(p: number, pb: number, rsb: number): number { return p >= pb ? rsb : rsb * (p / pb); }

/** Gas FVF (real gas, metric rm³/Sm³): Bg ≈ 0.003466·Z·T/p — inversely ∝ p. */
export function bg(p: number, T: number, Z: number): number { return 0.003466 * Z * T / p; }

/** Per-cell saturation state relative to the bubble point. */
export function saturationState(p: number, pb: number): 'undersaturated' | 'saturated' { return p >= pb ? 'undersaturated' : 'saturated'; }
