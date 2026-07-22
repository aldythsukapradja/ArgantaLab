// registry.ts — the 9 Reservoir-Management sub-tabs (COSMO authority order), with
// status + one-line blurb. Mirrors tabs/fielddev/registry.ts. The tab strip in
// CosmoShell (RM_TABS) and this manifest must stay in sync by id.
export interface RMViewer { id: string; label: string; blurb: string; status: 'live' | 'wip' }

export const RM_VIEWERS: Record<string, RMViewer> = {
  overview: { id: 'overview', label: 'Overview', status: 'live', blurb: 'Field/reservoir health, exceptions, actions & gains, forecast confidence.' },
  surveillance: { id: 'surveillance', label: 'Surveillance', status: 'live', blurb: 'Acquisition status, pressure/PLT/4D coverage, exceptions, data gaps.' },
  production: { id: 'production', label: 'Production', status: 'live', blurb: 'Oil/water/gas, WCT/GOR, uptime/deferment, baseline variance — the 9-panel diagnostic grid.' },
  injection: { id: 'injection', label: 'Injection & VRR', status: 'live', blurb: 'Injection rate, VRR, allocation and balance by pattern.' },
  pressure: { id: 'pressure', label: 'Pressure', status: 'live', blurb: 'BHP/THP evolution, depletion, connectivity and dynamic limits.' },
  welltests: { id: 'welltests', label: 'Well Tests', status: 'live', blurb: 'Latest test vs history, KPI deviations, risk-based priority and validation.' },
  patterns: { id: 'patterns', label: 'Patterns', status: 'live', blurb: 'Pattern health, producer/injector roles, connectivity and water diagnosis.' },
  forecast: { id: 'forecast', label: 'Forecast', status: 'live', blurb: 'DCA/RoFo, potential hierarchy and uncertainty.' },
  opportunities: { id: 'opportunities', label: 'Opportunities', status: 'live', blurb: 'Screen, mature and rank rig-based and rigless opportunities.' },
};

export const RM_TAB_ORDER = ['overview', 'surveillance', 'production', 'injection', 'pressure', 'welltests', 'patterns', 'forecast', 'opportunities'] as const;
