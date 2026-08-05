// field-record.ts — resolve ONE field's development record from the best real source
// available, and report exactly which source each fact came from.
//
// WHY THIS EXISTS. The Field Development header bar rendered Volve's status, discovery
// year and operator as hard-coded string literals:
//     reported(detail?.status ?? (isVolve ? 'Shut down' : null))
//     reported(detail?.discoveryYear ?? (isVolve ? 1993 : null))
// …because `loadFieldDetail(volveId)` returns null — GOGET carries no record for Volve.
// Every one of those facts was already sitting in REAL data we ship: the Sodir regulator
// record in public/nsr/nsr-fields.json. The hard-coding was never necessary. This module
// removes it by resolving through an explicit authority ladder instead, which also works
// for the other ~7,500 North Sea fields that GOGET misses.
//
// AUTHORITY LADDER (first hit wins, per field):
//   1. GOGET / OSDU  — cockpit-field-detail.json (the world catalogue)
//   2. Regulator     — nsr-fields.json (Sodir NO / NSTA UK), authoritative for its sector
//   3. Deep bundle   — public/wb/*.json, the raw-derived Volve well bundle
// Nothing is ever invented: a fact absent from all three stays null and is raised as a gap.
import type { DossierDetail, DossierObservation } from './asset-dossier';

// optional-chained: Vite always defines import.meta.env, but plain Node (the
// golden-master test harness) does not — this keeps readBundle() node-testable
// against the real fixtures without needing a Vite runtime.
const base = import.meta.env?.BASE_URL || '/';

/** Sm³ → stock-tank barrels. */
export const BBL_PER_SM3 = 6.2898107;

export type Authority = 'GOGET' | 'Sodir' | 'NSTA' | 'Volve bundle' | 'none';

/** Which source each resolved fact actually came from — rendered as provenance chips. */
export interface RecordProvenance {
  status: Authority; discoveryYear: Authority; operator: Authority;
  productionStartYear: Authority; production: Authority; reserves: Authority;
}

/** What the deep bundle holds for this field — the "data availability" matrix. */
export interface BundleAvailability {
  wells: number; withLogs: number; withTraj: number; withProduction: number; withPicks: number;
  explorationWells: number; surfaces: number; surfacePoints: number;
  /** Wellbore role split, read from the bundle's own well master. The raw vocabulary
   *  is granular ("oil-producer", "water-injector", "appraisal", "observation"…) — this
   *  collapses it to what a development read needs: flowing producers, flowing
   *  injectors, wells that by TYPE never flow (appraisal/exploration/observation —
   *  a real, known role, not a gap), and `roleUnknown` for a genuinely blank role.
   *  `producers + injectors + nonFlowing + roleUnknown` always equals `wells` — every
   *  wellbore lands in exactly one bucket, by construction, not by assuming the count. */
  producers: number; injectors: number; nonFlowing: number; roleUnknown: number;
  productionMonths: number; firstMonth: string | null; lastMonth: string | null;
  contacts: Array<{ kind: string; tvdss: number; dataNature: string; prov: string }>;
  pvt: Record<string, unknown> | null;
  /** in-place estimates, each WITH its method — never collapsed to one number */
  volumes: Array<{ label: string; mmSm3: number; basis: string }>;
  cumOilMMSm3: number | null;
  crs: string | null; datum: string | null;
  provenance: Record<string, string> | null;
  sourceFiles: string[];
}

export interface ResolvedRecord {
  detail: DossierDetail | null;
  provenance: RecordProvenance;
  authorities: Authority[];
  bundle: BundleAvailability | null;
  discoveryWellbore: string | null;
  licence: string | null;
  npdid: number | null;
}

// ── loaders (cached) ───────────────────────────────────────────────────────────
type NsrProps = {
  id: string; sector: string; name: string; operator: string | null; status: string | null;
  hcType: string | null; discoveryYear: number | null; discoveryWellbore: string | null;
  npdid: number | null; source: string; licence: string | null;
};
let nsrPromise: Promise<Map<string, NsrProps>> | null = null;
function loadNsrFields(): Promise<Map<string, NsrProps>> {
  if (!nsrPromise) {
    nsrPromise = fetch(`${base}nsr/nsr-fields.json`)
      .then((r) => (r.ok ? r.json() : { features: [] }))
      .then((j: { features?: Array<{ properties?: NsrProps }> }) => {
        const m = new Map<string, NsrProps>();
        for (const f of j.features ?? []) {
          const p = f.properties;
          if (p?.name) m.set(p.name.trim().toUpperCase(), p);
        }
        return m;
      })
      .catch(() => new Map<string, NsrProps>());
  }
  return nsrPromise;
}

type WbIndex = {
  crs?: string; datum?: string;
  wells?: Array<{ role?: string; is_exploration?: boolean; has?: Record<string, boolean> }>;
  surfaces?: Array<{ points?: number }>;
  contacts?: Array<{ kind: string; tvdss: number; dataNature: string; prov: string }>;
  pvt?: Record<string, unknown>;
  validation?: {
    stoiip?: { stoiipMMSm3?: number; method?: string; references?: Record<string, unknown> };
    cumOilMMSm3?: number;
  };
  provenance?: Record<string, string>;
};
type WbProd = { well?: string; dataNature?: string; units?: string; source_id?: string; monthly?: Array<{ ym: string; oil: number | null }> };

let wbPromise: Promise<{ index: WbIndex | null; prod: WbProd | null }> | null = null;
function loadWb() {
  if (!wbPromise) {
    const get = <T,>(p: string) => fetch(`${base}${p}`).then((r) => (r.ok ? (r.json() as Promise<T>) : null)).catch(() => null);
    wbPromise = Promise.all([get<WbIndex>('wb/index.json'), get<WbProd>('wb/prod-field.json')])
      .then(([index, prod]) => ({ index, prod }));
  }
  return wbPromise;
}

// ── bundle → availability matrix + real annual production ──────────────────────
// Pure — no fetch inside. Exported so it is node-testable the same way
// asset-dossier.ts is, against the real public/wb/index.json fixture.
export function readBundle(index: WbIndex | null, prod: WbProd | null): BundleAvailability | null {
  if (!index) return null;
  const wells = index.wells ?? [];
  const has = (k: string) => wells.filter((w) => w.has?.[k]).length;
  const monthly = (prod?.monthly ?? []).filter((m) => m && m.ym);
  const nonZero = monthly.filter((m) => (m.oil ?? 0) > 0);
  // Role is read from the well master, never inferred from production presence — a
  // shut-in producer still has a role. Matched by substring, not an exact-string
  // allowlist: the raw vocabulary is granular ("oil-producer", "water-injector") and
  // a future field may spell it differently again ("OIL_PRODUCER"); `roleUnknown` is
  // computed by SUBTRACTION so every well lands somewhere even if none of the
  // patterns match — the invariant (producers+injectors+nonFlowing+roleUnknown ===
  // wells) holds by construction, not by hoping the classification is exhaustive.
  const role = (w: { role?: string }) => (w.role ?? '').toLowerCase();
  // `oil-produc` specifically: a PRODUCTION well whose content is water is a shallow
  // water-SUPPLY well feeding the injectors, not a hydrocarbon producer. Counting it
  // here would inflate the producer count by 50% on Volve.
  const producers = wells.filter((w) => /oil[-_ ]?produc/.test(role(w))).length;
  const injectors = wells.filter((w) => /inject/.test(role(w))).length;
  // wells that exist but do not produce hydrocarbons: the ones drilled to LEARN
  // (appraisal/exploration/observation) plus the water-supply wells that serve the
  // waterflood. All have a real, known role — none of them is a gap.
  const nonFlowing = wells.filter((w) => /appraisal|explor|observ|water[-_ ]?suppl/.test(role(w))).length;
  const roleUnknown = wells.length - producers - injectors - nonFlowing;

  const stoiip = index.validation?.stoiip;
  const refs = (stoiip?.references ?? {}) as Record<string, unknown>;
  const volumes: BundleAvailability['volumes'] = [];
  // Every in-place figure carries its METHOD. The gross-screening result is driven by
  // the active interpreted contact and must never be shown as field-accounting truth.
  // All estimates are therefore listed side by side and explicitly labelled.
  if (typeof stoiip?.stoiipMMSm3 === 'number') {
    volumes.push({ label: 'STOIIP — gross screening', mmSm3: stoiip.stoiipMMSm3, basis: stoiip.method ?? 'screening' });
  }
  if (typeof refs.volumetricAnalogue_MMSm3 === 'number') {
    volumes.push({ label: 'Volumetric analogue', mmSm3: refs.volumetricAnalogue_MMSm3 as number, basis: 'analogue volumetric estimate' });
  }
  if (typeof refs.dynamicModel_MMSm3 === 'number') {
    volumes.push({ label: 'Dynamic model', mmSm3: refs.dynamicModel_MMSm3 as number, basis: 'history-matched simulation model' });
  }
  if (typeof refs.mbal_F12_MMSm3 === 'number') {
    volumes.push({ label: 'Material balance (F-12)', mmSm3: refs.mbal_F12_MMSm3 as number, basis: 'MBAL on well F-12' });
  }

  const sourceFiles: string[] = [];
  if (prod?.source_id) sourceFiles.push(prod.source_id);
  const pvtSrc = index.pvt?.source;
  if (typeof pvtSrc === 'string') sourceFiles.push(pvtSrc);

  return {
    wells: wells.length,
    withLogs: has('logs'), withTraj: has('traj'), withProduction: has('production'), withPicks: has('picks'),
    explorationWells: wells.filter((w) => w.is_exploration).length,
    producers, injectors, nonFlowing, roleUnknown,
    surfaces: (index.surfaces ?? []).length,
    surfacePoints: (index.surfaces ?? []).reduce((s, x) => s + (x.points ?? 0), 0),
    productionMonths: monthly.length,
    firstMonth: nonZero[0]?.ym ?? null,
    lastMonth: nonZero[nonZero.length - 1]?.ym ?? null,
    contacts: index.contacts ?? [],
    pvt: index.pvt ?? null,
    volumes,
    cumOilMMSm3: index.validation?.cumOilMMSm3 ?? null,
    crs: index.crs ?? null, datum: index.datum ?? null,
    provenance: index.provenance ?? null,
    sourceFiles,
  };
}

/** Real monthly oil → annual MMBOE observations, in the catalogue's own row shape. */
function annualFromMonthly(prod: WbProd | null): DossierObservation[] {
  const monthly = prod?.monthly ?? [];
  if (!monthly.length) return [];
  const byYear = new Map<number, number>();
  for (const m of monthly) {
    const y = Number(String(m.ym).slice(0, 4));
    const oil = m.oil ?? 0;
    if (!Number.isFinite(y) || oil <= 0) continue;
    byYear.set(y, (byYear.get(y) ?? 0) + oil);   // Sm³
  }
  return [...byYear.entries()].sort((a, b) => a[0] - b[0]).map(([year, sm3]) => ({
    product: 'Oil', year, classification: 'Produced',
    value: sm3, unit: 'Sm3',
    // asset-dossier converts "million bbl" 1:1 to MMBOE
    valueConverted: (sm3 * BBL_PER_SM3) / 1e6, unitConverted: 'million bbl',
  }));
}

// ── the resolver ───────────────────────────────────────────────────────────────
export async function resolveFieldRecord(
  field: { id: string; name: string; parent: string; source: string },
  gogetDetail: DossierDetail | null,
): Promise<ResolvedRecord> {
  const isVolve = field.name.trim().toUpperCase() === 'VOLVE';
  const [nsr, wb] = await Promise.all([loadNsrFields(), isVolve ? loadWb() : Promise.resolve({ index: null, prod: null })]);
  const reg = nsr.get(field.name.trim().toUpperCase()) ?? null;
  const regAuthority: Authority = reg ? (reg.source === 'Sodir' ? 'Sodir' : 'NSTA') : 'none';
  const bundle = readBundle(wb.index, wb.prod);

  const prov: RecordProvenance = {
    status: 'none', discoveryYear: 'none', operator: 'none',
    productionStartYear: 'none', production: 'none', reserves: 'none',
  };

  const pick = <T,>(k: keyof RecordProvenance, g: T | null | undefined, r: T | null | undefined): T | null => {
    if (g != null && g !== ('' as unknown as T)) { prov[k] = 'GOGET'; return g; }
    if (r != null && r !== ('' as unknown as T)) { prov[k] = regAuthority; return r; }
    return null;
  };

  const status = pick('status', gogetDetail?.status, reg?.status);
  const discoveryYear = pick('discoveryYear', gogetDetail?.discoveryYear, reg?.discoveryYear);
  const operator = pick('operator', gogetDetail?.operator, reg?.operator);

  // production: GOGET rows if any, else the bundle's REAL monthly series rolled to years
  let production = gogetDetail?.production ?? [];
  if (production.length) prov.production = 'GOGET';
  else {
    const fromBundle = annualFromMonthly(wb.prod);
    if (fromBundle.length) { production = fromBundle; prov.production = 'Volve bundle'; }
  }

  // first production = first year the field actually flowed (never guessed)
  let productionStartYear = gogetDetail?.productionStartYear ?? null;
  if (productionStartYear != null) prov.productionStartYear = 'GOGET';
  else if (bundle?.firstMonth) {
    productionStartYear = Number(bundle.firstMonth.slice(0, 4));
    prov.productionStartYear = 'Volve bundle';
  }

  // reserves: GOGET filings if present. Otherwise, for a shut-down field, cumulative
  // production IS the ultimate recovery — booked as an EUR row, labelled as such.
  let reserves = gogetDetail?.reserves ?? [];
  if (reserves.length) prov.reserves = 'GOGET';
  else if (bundle?.cumOilMMSm3 != null && /shut|ceas|abandon/i.test(status ?? '')) {
    reserves = [{
      product: 'Oil', year: bundle.lastMonth ? Number(bundle.lastMonth.slice(0, 4)) : null,
      classification: 'Ultimate recovery (produced)',
      value: bundle.cumOilMMSm3, unit: 'MMSm3',
      valueConverted: bundle.cumOilMMSm3 * BBL_PER_SM3, unitConverted: 'million bbl',
    }];
    prov.reserves = 'Volve bundle';
  }

  const detail: DossierDetail | null = (gogetDetail || reg || bundle)
    ? {
      fuelType: gogetDetail?.fuelType ?? (reg?.hcType ? titleCase(reg.hcType) : null),
      onshoreOffshore: gogetDetail?.onshoreOffshore ?? (reg ? 'Offshore' : null),
      productionType: gogetDetail?.productionType ?? null,
      status, statusDetail: gogetDetail?.statusDetail ?? null,
      discoveryYear,
      fidYear: gogetDetail?.fidYear ?? null,       // no source carries FID — stays a real gap
      productionStartYear,
      operator,
      owners: gogetDetail?.owners ?? null,
      block: gogetDetail?.block ?? null,
      basin: gogetDetail?.basin ?? null,
      reserves, production,
    }
    : null;

  const authorities: Authority[] = [];
  if (gogetDetail) authorities.push('GOGET');
  if (reg) authorities.push(regAuthority);
  if (bundle) authorities.push('Volve bundle');

  return {
    detail, provenance: prov, authorities, bundle,
    discoveryWellbore: reg?.discoveryWellbore ?? null,
    licence: reg?.licence ?? null,
    npdid: reg?.npdid ?? null,
  };
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
