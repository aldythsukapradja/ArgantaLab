// Project unit system — DISPLAY-layer converter. Data is stored metric-native
// (Sm³, Sm³/d, m, bar, °C, as sourced); this converts + labels for display only.
// The truth never changes; the selector only reformats. Default = FIELD (bopd).
import { create } from 'zustand';

export type UnitSystem = 'field' | 'metric';

// Sm³-native → target factors
const SM3_TO_BBL = 6.2898;     // stock-tank m³ → barrels (oil/liquid)
const SM3_TO_SCF = 35.3147;    // m³ → standard cubic feet (gas)
const M_TO_FT = 3.28084;
const BAR_TO_PSI = 14.5038;

function initial(): UnitSystem {
  try { const s = localStorage.getItem('ae_units'); if (s === 'field' || s === 'metric') return s; } catch { /* ignore */ }
  return 'field'; // founder default: field units (bopd)
}

interface UnitState { system: UnitSystem; setSystem: (s: UnitSystem) => void; toggle: () => void }
export const useUnits = create<UnitState>((set) => ({
  system: initial(),
  setSystem: (system) => { try { localStorage.setItem('ae_units', system); } catch { /* ignore */ } set({ system }); },
  toggle: () => set((st) => { const system: UnitSystem = st.system === 'field' ? 'metric' : 'field'; try { localStorage.setItem('ae_units', system); } catch { /* ignore */ } return { system }; }),
}));

// ── formatting helpers (all take Sm³-native inputs) ──────────────────────────
export interface Q { value: number; unit: string; text: string } // {converted value, unit label, "12,345 bopd"}
const fmtNum = (v: number, d = 0) => (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString('en-US') : v.toFixed(d));

/** Liquid/oil RATE: Sm³/d in → bopd (field) or Sm³/d (metric). */
export function oilRate(sm3PerDay: number, sys: UnitSystem): Q {
  if (sys === 'field') { const v = sm3PerDay * SM3_TO_BBL; return { value: v, unit: 'bopd', text: `${fmtNum(v)} bopd` }; }
  return { value: sm3PerDay, unit: 'Sm³/d', text: `${fmtNum(sm3PerDay)} Sm³/d` };
}
/** Water/liquid rate (bwpd / Sm³/d). */
export function liquidRate(sm3PerDay: number, sys: UnitSystem): Q {
  if (sys === 'field') { const v = sm3PerDay * SM3_TO_BBL; return { value: v, unit: 'bpd', text: `${fmtNum(v)} bpd` }; }
  return { value: sm3PerDay, unit: 'Sm³/d', text: `${fmtNum(sm3PerDay)} Sm³/d` };
}
/** Gas RATE: Sm³/d → Mscf/d (field) or Sm³/d (metric). */
export function gasRate(sm3PerDay: number, sys: UnitSystem): Q {
  if (sys === 'field') { const v = sm3PerDay * SM3_TO_SCF / 1000; return { value: v, unit: 'Mscf/d', text: `${fmtNum(v)} Mscf/d` }; }
  return { value: sm3PerDay, unit: 'Sm³/d', text: `${fmtNum(sm3PerDay)} Sm³/d` };
}
/** Oil VOLUME (STOIIP, cumulative): Sm³ → MMbbl (field) or MMSm³ (metric). */
export function oilVol(sm3: number, sys: UnitSystem): Q {
  if (sys === 'field') { const v = sm3 * SM3_TO_BBL / 1e6; return { value: v, unit: 'MMbbl', text: `${v.toFixed(1)} MMbbl` }; }
  const v = sm3 / 1e6; return { value: v, unit: 'MMSm³', text: `${v.toFixed(1)} MMSm³` };
}
/** Gas VOLUME (GIIP): Sm³ → Bscf (field) or BSm³ (metric). */
export function gasVol(sm3: number, sys: UnitSystem): Q {
  if (sys === 'field') { const v = sm3 * SM3_TO_SCF / 1e9; return { value: v, unit: 'Bscf', text: `${v.toFixed(1)} Bscf` }; }
  const v = sm3 / 1e9; return { value: v, unit: 'BSm³', text: `${v.toFixed(1)} BSm³` };
}
/** DEPTH / length: m → ft (field) or m (metric). */
export function depth(m: number, sys: UnitSystem): Q {
  if (sys === 'field') { const v = m * M_TO_FT; return { value: v, unit: 'ft', text: `${fmtNum(v)} ft` }; }
  return { value: m, unit: 'm', text: `${fmtNum(m)} m` };
}
/** PRESSURE: bar → psi (field) or bar (metric). */
export function pressure(bar: number, sys: UnitSystem): Q {
  if (sys === 'field') { const v = bar * BAR_TO_PSI; return { value: v, unit: 'psi', text: `${fmtNum(v)} psi` }; }
  return { value: bar, unit: 'bar', text: `${fmtNum(bar)} bar` };
}
/** TEMPERATURE: °C → °F (field) or °C (metric). */
export function temp(c: number, sys: UnitSystem): Q {
  if (sys === 'field') { const v = c * 9 / 5 + 32; return { value: v, unit: '°F', text: `${Math.round(v)} °F` }; }
  return { value: c, unit: '°C', text: `${Math.round(c)} °C` };
}

// convenience: system label for chips
export const systemLabel = (s: UnitSystem) => (s === 'field' ? 'FIELD (bopd)' : 'METRIC (Sm³)');
