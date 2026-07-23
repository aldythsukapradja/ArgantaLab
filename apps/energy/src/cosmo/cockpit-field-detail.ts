// cockpit-field-detail.ts — Stream E: lazy per-field dossier detail. Kept out of
// cockpit-points/polygons (render-critical payload, handoff §13 perf budget) and fetched once
// as a separate map, keyed by OSDU field id. Data is real GOGET MainData + dated reserves/
// production observations, borrowed via the Stream A identity-resolution alias when a
// regulator/ANP field isn't itself a GOGET record. `null` always means "Not reported" — a
// genuine reported 0 is preserved as 0 by the build script, never coalesced away.
const base = import.meta.env.BASE_URL || '/';

export interface ObservationRow {
  product: string;
  year: number | null;
  classification: string | null;
  value: number | null;
  unit: string | null;
  valueConverted: number | null;
  unitConverted: string | null;
}

export interface FieldDetail {
  fuelType: string | null;
  onshoreOffshore: string | null;
  productionType: string | null;
  status: string | null;
  statusDetail: string | null;
  discoveryYear: string | number | null;
  fidYear: string | number | null;
  productionStartYear: string | number | null;
  operator: string | null;
  owners: string | null;
  parents: string | null;
  block: string | null;
  basin: string | null;
  accuracy: string | null;
  reserves: ObservationRow[];
  production: ObservationRow[];
  enrichedFrom: string | null;
}

let detailPromise: Promise<Record<string, FieldDetail>> | null = null;

function loadAll(): Promise<Record<string, FieldDetail>> {
  if (!detailPromise) {
    detailPromise = fetch(`${base}osdu/cockpit-field-detail.json`)
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({}));
  }
  return detailPromise;
}

/** Look up one field's dossier detail. Returns null if the field has no GOGET-sourced
 *  attributes at all (own or via identity alias) — the caller shows "Not reported" throughout. */
export async function loadFieldDetail(fieldId: string): Promise<FieldDetail | null> {
  const all = await loadAll();
  return all[fieldId] ?? null;
}
