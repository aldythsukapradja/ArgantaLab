// wb/types.ts — TypeScript shapes for the LOCKED wb data assets (public/wb/*).
// These mirror the build-workbench-data.mjs output exactly. Do not inline the
// data — fetch lazily via wb/load.ts.

export type WellRole = 'producer' | 'injector' | 'both' | 'none';

export interface WellRow {
  name: string;      // canonical display (e.g. "F-12")
  well: string;      // parent well group
  x: number;         // surface easting (UTM)
  y: number;         // surface northing (UTM)
  td_md: number;
  td_tvd: number;
  kb?: string;
  role: WellRole;
  is_exploration?: boolean;
  has: { logs: boolean; traj: boolean; production: boolean; picks: boolean };
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

export interface ProdMonth { ym: string; oil: number; gas: number; water: number; wi: number }
export interface ProdJson { well: string; dataNature: string; units: string; source_id: string; monthly: ProdMonth[] }
