// wb/types.ts — TypeScript shapes for the LOCKED wb data assets (public/wb/*).
// These mirror the build-workbench-data.mjs output exactly. Do not inline the
// data — fetch lazily via wb/load.ts.

export type WellRole = 'producer' | 'injector' | 'both' | 'none';

/** Production a wellbore actually delivered, as resolved by the wb build. Volve files
 *  some volumes against a shallow mother bore that cannot be the source, so the build
 *  re-attributes them to the deepest terminal bore and records BOTH the numbers and the
 *  reasoning here. `filedOn` names the bore the series is stored under. */
export interface WellMetrics {
  cumOilSm3: number; cumGasSm3: number; cumWaterSm3: number; cumInjectedSm3: number;
  firstFlow: string | null; lastFlow: string | null; months: number;
  peakOilRateSm3d: number | null; peakOilMonth: string | null;
  lastOilRateSm3d: number | null; lastOilMonth: string | null;
  lastWaterCut: number | null; shareOfFieldCumPct: number | null;
  filedOn?: string; attributionBasis?: string;
}

export interface WellRow {
  name: string;      // canonical display (e.g. "F-12")
  well: string;      // parent well group
  x: number;         // surface easting (UTM)
  y: number;         // surface northing (UTM)
  td_md: number;
  td_tvd: number;
  kb?: string;
  role: WellRole;
  purpose?: string;
  is_exploration?: boolean;
  is_terminal?: boolean;
  is_deepest?: boolean;
  drilled_from?: string | null;
  has: { logs: boolean; traj: boolean; production: boolean; picks: boolean };
  /** present when this bore is the true source of a filed production series */
  metrics?: WellMetrics;
  /** set on the bore the volumes were FILED against when they belong to another bore */
  metricsFiledElsewhere?: string;
}

export interface SurfaceInfo {
  id: string;
  name: string;
  nx: number; ny: number; cell: number;
  x0: number; y0: number;
  zmin: number; zmax: number;
  points: number;
}

export interface WbContact { kind: string; tvdss: number; dataNature: string; prov: string }

export interface WbIndex {
  version: string;
  generatedAt: string;
  crs: string;
  datum: string;
  wells: WellRow[];
  surfaces: SurfaceInfo[];
  contacts: WbContact[];
  pvt: { Bo: number; Rs: number; Pi: number; Pb: number; T: number; Bo_note?: string };
  defaults: { phi: number; ntg: number; sw: number; rhoMa: number; archie: { a: number; m: number; n: number }; bo: number; rf: number[] };
  validation?: unknown;
  provenance?: Record<string, string>;
}

export interface Curve { unit: string; values: (number | null)[] }

export interface LogsJson {
  well: string;
  run?: string;
  folder?: string;
  format?: string;
  dataNature: string;
  source_id: string;
  depth_unit?: string;
  md: number[];
  curves: Record<string, Curve>;
}

export interface TrajStation {
  i: number; md: number; tvd: number;
  incl: number; azi: number;
  dispNs: number; dispEw: number;
  type?: string;
}

export interface TrajJson {
  well: string;
  dataNature: string;
  classification?: string;
  source?: string;
  stations: TrajStation[];
}

export interface Pick {
  well: string | null;
  source_well?: string;
  surface: string;
  md: number;
  tvdss: number | null;
  source_id: string;
}

export interface PicksJson { dataNature: string; picks: Pick[] }

export interface ProdMonth {
  ym: string;
  oil: number; gas: number; water: number; wi: number;   // Sm³, summed
  bhp?: number | null;      // flowing downhole pressure, monthly mean (bara) — measured; null if no valid gauge that month
  thp?: number | null;      // flowing wellhead pressure, monthly mean (bara) — measured
  hrs?: number;             // Σ on-stream hours in the month
  uptime?: number | null;   // Σhrs / (calendar-days·24), 0..1
}
export interface ProdJson { well: string; dataNature: string; units: string; source_id: string; monthly: ProdMonth[] }

// Reservoir-Management pattern definitions (wb/patterns.json) — deterministic default,
// each injector associated with nearest producers by surface distance; user-adjustable.
export interface PatternDef { injector: string; producers: Array<{ well: string; distM: number }> }
export interface PatternsJson {
  dataNature: string; method: string;
  injectors: string[]; producers: string[]; patterns: PatternDef[];
}
