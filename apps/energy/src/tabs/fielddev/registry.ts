// registry.ts — fielddev viewer manifests. V1a = Map/Logs/Correlation live;
// the remaining 7 render honest phase-labelled placeholders listing the planned
// mechanics from V1-SPEC §4.
export type ViewerStatus = 'live' | 'v1b' | 'v1c';

export interface ViewerManifest {
  id: string;
  name: string;
  status: ViewerStatus;
  phase: string;
  blurb: string;
  planned: string[];  // planned mechanics (from the spec)
}

export const VIEWERS: Record<string, ViewerManifest> = {
  map: {
    id: 'map', name: 'Map', status: 'live', phase: 'V1a',
    blurb: 'Structural map workspace — 2D/3D, layers, contours, closures, drawing tools, well designer, cross-section.',
    planned: [],
  },
  logs: {
    id: 'logs', name: 'Logs', status: 'live', phase: 'V1a',
    blurb: 'Petrel-grade multi-track log viewer with an analytics crossplot drawer.',
    planned: [],
  },
  correlation: {
    id: 'correlation', name: 'Correlation', status: 'live', phase: 'V1a',
    blurb: 'Multi-well correlation panel with datum flattening and pick-line ties.',
    planned: [],
  },
  petrophysics: {
    id: 'petrophysics', name: 'Petrophysics', status: 'live', phase: 'V1b',
    blurb: 'Interpreted (LFP) vs Archie-recompute dual mode over the log tracks.',
    planned: [
      'Interpreted PHIE/SWE/VSH (Equinor LFP, default) vs Archie recompute (derived)',
      'Live param sliders: Rw (LFP_RW default), a/m/n, ρma/ρfl, φsh, cutoffs',
      'Zone-average table per Hugin interval (picks-bounded): NTG · PHIE · Sw',
      'Results feed the Property tab',
    ],
  },
  structural: {
    id: 'structural', name: 'Structural', status: 'live', phase: 'V1b',
    blurb: 'Surface QC and well-tie residuals.',
    planned: [
      'Grid statistics per horizon',
      'Well-tie mistie table: pick TVDSS vs grid sample at well x/y (honest residuals)',
      'Contact editing (scenario) and closure-derivation view',
    ],
  },
  property: {
    id: 'property', name: 'Property', status: 'live', phase: 'V1b',
    blurb: 'Property maps from per-well zone averages.',
    planned: [
      'Per-well zone averages posted on the map',
      'IDW / kriging-lite interpolated PHIE · NTG · Sw property maps',
      'HCPV map = engine.grv cellwise × property grids',
    ],
  },
  volumetrics: {
    id: 'volumetrics', name: 'Volumetrics', status: 'live', phase: 'V1c',
    blurb: 'STOIIP / GIIP with validation against published ≈22 MMSm³ [PEER].',
    planned: [
      'Scope selector: closure · custom polygon · well-drainage circle',
      'Deterministic (field-avg) vs property (grids) mode',
      'STOIIP / GIIP cards + validation banner vs published ≈22 MMSm³',
      'Per-well recoverable = drainage × recovery factor',
    ],
  },
  uncertainty: {
    id: 'uncertainty', name: 'Uncertainty', status: 'live', phase: 'V1c',
    blurb: 'Seeded Monte Carlo over the volumetric inputs.',
    planned: [
      'PERT / triangular sliders per input',
      '10k seeded realizations (mulberry32)',
      'Histogram + CDF with P90 / P50 / P10 flags (oil convention)',
      'Tornado sensitivity (Pearson r per input)',
    ],
  },
  forecast: {
    id: 'forecast', name: 'Forecast', status: 'live', phase: 'V1c',
    blurb: 'Arps decline over the real monthly production history.',
    planned: [
      'Real monthly history + Arps fit overlay to economic limit',
      'Per-well and field EUR; RF sanity note vs published',
      'Material-balance tank check (F-12, STOIP ≈ 19.6 MMSm³ target)',
    ],
  },
  economics: {
    id: 'economics', name: 'Economics', status: 'live', phase: 'V1c',
    blurb: 'NPV / payback tied to the forecast output.',
    planned: [
      'Price / opex / capex / discount inputs',
      'NPV, payback, cashflow chart (mid-year discounting)',
      'Tied to Forecast output',
    ],
  },
};
