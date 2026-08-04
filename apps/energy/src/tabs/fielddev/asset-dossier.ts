// asset-dossier.ts — the derivation layer behind the Field Development Knowledge Bank
// (the Asset Dossier). Pure TS: no React, no DOM, no cross-imports — so it runs in a
// worker and is node-testable (scripts/test-asset-dossier.mjs).
//
// Everything here turns the REAL GOGET/OSDU field record (cockpit-field-detail.json)
// into the handful of statements the screen makes. The grounding rules from the concept
// doc are enforced here, not in the view:
//   · a missing date is `null` and stays null — never interpolated, never dropped
//   · "not reported" is never coalesced to 0; totals exclude it and the gap ledger counts it
//   · reserves are FILED reserves (GOGET), never STOIIP — the label says so
//
// Units: GOGET converts liquids to million bbl and gas to million m³. We express
// everything as MMBOE using the standard 5,800 scf/boe and 35.315 scf/Sm³, i.e.
// 1 million m³ gas = 35.315e6 scf = 6,089 boe = 0.006089 MMBOE. Constants are inlined
// (not imported from engine/volumetrics) to keep this module dependency-free.

const SCF_PER_SM3 = 35.314666;
const SCF_PER_BOE = 5800;
/** million m³ gas → MMBOE */
export const MMM3_GAS_TO_MMBOE = (SCF_PER_SM3 * 1e6) / SCF_PER_BOE / 1e6;

// ── the shape of the record we read (mirrors cosmo/cockpit-field-detail.ts) ─────
export interface DossierObservation {
  product: string; year: number | null; classification: string | null;
  value: number | null; unit: string | null;
  valueConverted: number | null; unitConverted: string | null;
}
export interface DossierDetail {
  fuelType: string | null; onshoreOffshore: string | null; productionType: string | null;
  status: string | null; statusDetail: string | null;
  discoveryYear: string | number | null; fidYear: string | number | null;
  productionStartYear: string | number | null;
  operator: string | null; owners: string | null; block: string | null; basin: string | null;
  reserves: DossierObservation[]; production: DossierObservation[];
}

export type Tone = 'good' | 'warn' | 'bad' | 'unknown';

/** GOGET writes years as strings, blanks, and occasionally junk. One honest parse. */
export function asYear(v: unknown): number | null {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).trim().slice(0, 4));
  return Number.isFinite(n) && n > 1850 && n < 2100 ? Math.round(n) : null;
}

// ── 1. lifecycle ───────────────────────────────────────────────────────────────
export type MilestoneId = 'discovered' | 'sanctioned' | 'onstream' | 'status';
export interface Milestone { id: MilestoneId; label: string; year: number | null; note: string }

/** PRMS-flavoured maturity stage, read from the record — never guessed. */
export type Stage = 'discovered' | 'appraisal' | 'sanctioned' | 'producing' | 'late-life' | 'ceased' | 'unknown';
export const STAGE_LABEL: Record<Stage, string> = {
  discovered: 'Discovered', appraisal: 'Appraisal / undeveloped', sanctioned: 'Sanctioned',
  producing: 'On production', 'late-life': 'Late life', ceased: 'Ceased production', unknown: 'Not recorded',
};
/** Where each stage sits on the 0–1 lifecycle bar. */
export const STAGE_PROGRESS: Record<Stage, number> = {
  unknown: 0, discovered: 0.12, appraisal: 0.3, sanctioned: 0.5, producing: 0.75, 'late-life': 0.9, ceased: 1,
};

export interface Lifecycle {
  milestones: Milestone[];
  stage: Stage;
  tone: Tone;
  /** years discovery → FID, and FID → first production. null when either date is missing. */
  appraisalYears: number | null;
  developmentYears: number | null;
  /** discovery → first production, the number the industry actually quotes */
  cycleTimeYears: number | null;
  producingYears: number | null;
  detail: string;
}

const STATUS_STAGE: Array<[RegExp, Stage]> = [
  [/(ceas|abandon|decommission|shut.?down|plugged)/i, 'ceased'],
  [/(produc|operat|on.?stream|flowing)/i, 'producing'],
  [/(approv|sanction|under development|development|construct|fid)/i, 'sanctioned'],
  [/(appraisal|undeveloped|discovery|discovered|not developed|stranded)/i, 'appraisal'],
];

export function buildLifecycle(d: DossierDetail | null, nowYear: number): Lifecycle {
  const disc = asYear(d?.discoveryYear), fid = asYear(d?.fidYear), start = asYear(d?.productionStartYear);
  const status = d?.status ?? null;

  let stage: Stage = 'unknown';
  for (const [re, s] of STATUS_STAGE) if (status && re.test(status)) { stage = s; break; }
  // dates outrank a vague status: a field with a first-production year IS producing
  if (stage === 'unknown' || stage === 'appraisal' || stage === 'discovered') {
    if (start != null) stage = 'producing';
    else if (fid != null) stage = 'sanctioned';
    else if (disc != null && stage === 'unknown') stage = 'discovered';
  }
  // a long-producing field with no cease date reads as late life, not fresh production
  const producingYears = start != null && stage === 'producing' ? Math.max(0, nowYear - start) : null;
  if (stage === 'producing' && producingYears != null && producingYears >= 25) stage = 'late-life';

  const milestones: Milestone[] = [
    { id: 'discovered', label: 'Discovered', year: disc, note: disc ? `${disc}` : 'no discovery year filed' },
    { id: 'sanctioned', label: 'Sanctioned (FID)', year: fid, note: fid ? `${fid}` : 'no FID year filed' },
    { id: 'onstream', label: 'First production', year: start, note: start ? `${start}` : 'no start-up year filed' },
  ];

  const sub = (a: number | null, b: number | null) => (a != null && b != null && b >= a ? b - a : null);
  const appraisalYears = sub(disc, fid);
  const developmentYears = sub(fid, start);
  const cycleTimeYears = sub(disc, start);

  const tone: Tone = stage === 'producing' ? 'good' : stage === 'late-life' ? 'warn'
    : stage === 'ceased' ? 'bad' : stage === 'unknown' ? 'unknown' : 'warn';

  const detail = stage === 'unknown' ? 'no status or dates filed'
    : cycleTimeYears != null ? `${cycleTimeYears} yr discovery → first oil`
      : producingYears != null ? `producing ${producingYears} yr`
        : disc != null ? `found ${disc} · no development dates` : (status ?? 'status only');

  return { milestones, stage, tone, appraisalYears, developmentYears, cycleTimeYears, producingYears, detail };
}

// ── 2. reserves ────────────────────────────────────────────────────────────────
export interface ReserveLine { product: string; classification: string | null; year: number | null; mmboe: number | null; raw: string }
export interface ReservesSummary {
  lines: ReserveLine[];
  oilMMstb: number | null; gasMMBOE: number | null; totalMMBOE: number | null;
  /** rows the catalogue carries but which have no usable number — the honest denominator */
  unreported: number;
  latestYear: number | null;
}

const isGas = (p: string) => /gas|ngl|condensate/i.test(p);

/** One observation → MMBOE, or null when the row carries no usable converted number. */
export function observationMMBOE(r: DossierObservation): number | null {
  const u = (r.unitConverted ?? '').toLowerCase();
  const v = r.valueConverted;
  if (v == null || !Number.isFinite(v)) return null;
  if (u.includes('million bbl')) return v;                        // liquids: 1 MMbbl = 1 MMBOE
  if (u.includes('million m')) return v * MMM3_GAS_TO_MMBOE;      // gas: million m³
  return null;
}

export function buildReserves(d: DossierDetail | null): ReservesSummary {
  const rows = d?.reserves ?? [];
  const lines: ReserveLine[] = rows.map((r) => {
    const mmboe = observationMMBOE(r);
    return {
      product: r.product, classification: r.classification, year: r.year, mmboe,
      raw: r.value != null ? `${r.value.toLocaleString()} ${r.unit ?? ''}`.trim() : 'not reported',
    };
  });
  let oil = 0, gas = 0, nOil = 0, nGas = 0;
  for (const l of lines) {
    if (l.mmboe == null) continue;
    if (isGas(l.product)) { gas += l.mmboe; nGas++; } else { oil += l.mmboe; nOil++; }
  }
  const years = lines.map((l) => l.year).filter((y): y is number => y != null);
  return {
    lines,
    oilMMstb: nOil ? oil : null,
    gasMMBOE: nGas ? gas : null,
    totalMMBOE: nOil || nGas ? oil + gas : null,
    unreported: lines.filter((l) => l.mmboe == null).length,
    latestYear: years.length ? Math.max(...years) : null,
  };
}

// ── 3. production history ──────────────────────────────────────────────────────
export interface ProductionPoint { year: number; mmboe: number }
export interface ProductionSummary {
  series: ProductionPoint[];
  cumulativeMMBOE: number | null;
  peak: ProductionPoint | null;
  latest: ProductionPoint | null;
  /** fraction of peak the latest year sits at — the decline read */
  declineFromPeak: number | null;
  firstYear: number | null; lastYear: number | null;
}

export function buildProduction(d: DossierDetail | null): ProductionSummary {
  const byYear = new Map<number, number>();
  for (const r of d?.production ?? []) {
    const v = observationMMBOE(r);
    if (v == null || r.year == null) continue;
    byYear.set(r.year, (byYear.get(r.year) ?? 0) + v);
  }
  const series = [...byYear.entries()].map(([year, mmboe]) => ({ year, mmboe })).sort((a, b) => a.year - b.year);
  if (!series.length) {
    return { series, cumulativeMMBOE: null, peak: null, latest: null, declineFromPeak: null, firstYear: null, lastYear: null };
  }
  const peak = series.reduce((a, b) => (b.mmboe > a.mmboe ? b : a));
  const latest = series[series.length - 1];
  return {
    series,
    cumulativeMMBOE: series.reduce((s, p) => s + p.mmboe, 0),
    peak, latest,
    declineFromPeak: peak.mmboe > 0 ? latest.mmboe / peak.mmboe : null,
    firstYear: series[0].year, lastYear: latest.year,
  };
}

// ── 4. remaining ───────────────────────────────────────────────────────────────
/** Booked reserves less what has been produced. Null unless BOTH are real — the
 *  difference of a number and an unknown is an unknown, not the number. */
export function remainingMMBOE(res: ReservesSummary, prod: ProductionSummary): number | null {
  if (res.totalMMBOE == null) return null;
  if (prod.cumulativeMMBOE == null) return res.totalMMBOE; // nothing produced yet on record
  return Math.max(0, res.totalMMBOE - prod.cumulativeMMBOE);
}

// ── 5. fluid / production mix ──────────────────────────────────────────────────
export interface MixSlice { key: string; value: number }
export function buildMix(res: ReservesSummary): MixSlice[] {
  const out: MixSlice[] = [];
  if (res.oilMMstb) out.push({ key: 'Liquids', value: res.oilMMstb });
  if (res.gasMMBOE) out.push({ key: 'Gas', value: res.gasMMBOE });
  return out;
}

// ── 6. reservoir & drive verdict ───────────────────────────────────────────────
export interface ReservoirVerdict {
  lithology: string | null; drive: string | null; formation: string | null;
  fluid: string | null; setting: string | null; recoveryType: string | null;
  tone: Tone; detail: string;
}
export function buildReservoirVerdict(
  d: DossierDetail | null,
  kb: { lithology?: string | null; drive?: string | null; formation?: string | null } | null,
): ReservoirVerdict {
  const lithology = kb?.lithology ?? null, drive = kb?.drive ?? null, formation = kb?.formation ?? null;
  const known = [lithology, drive, formation].filter(Boolean).length;
  return {
    lithology, drive, formation,
    fluid: d?.fuelType ?? null,
    setting: d?.onshoreOffshore ?? null,
    recoveryType: d?.productionType ?? null,
    tone: known >= 2 ? 'good' : known === 1 ? 'warn' : 'unknown',
    detail: known === 0
      ? 'no described reservoir — catalogue identity only'
      : [lithology, drive].filter(Boolean).join(' · ') || 'partial description',
  };
}

// ── 7. readiness ledger — the gap list IS the work programme ───────────────────
export interface Gap { what: string; why: string }
export function buildReadiness(
  d: DossierDetail | null, life: Lifecycle, res: ReservesSummary, prod: ProductionSummary, rv: ReservoirVerdict,
): Gap[] {
  const g: Gap[] = [];
  if (!d) { g.push({ what: 'Field record', why: 'no catalogue attributes at all — name and position only' }); return g; }
  if (life.milestones[0].year == null) g.push({ what: 'Discovery date', why: 'no discovery year filed — maturity cannot be read' });
  if (life.milestones[1].year == null) g.push({ what: 'FID date', why: 'no sanction year filed — appraisal duration is unknown' });
  if (life.milestones[2].year == null) g.push({ what: 'Start-up date', why: 'no first-production year filed — cycle time is unknown' });
  if (res.totalMMBOE == null) g.push({ what: 'Booked reserves', why: 'no reserve filing carries a convertible volume' });
  if (res.unreported > 0) g.push({ what: `${res.unreported} unconvertible reserve row${res.unreported > 1 ? 's' : ''}`, why: 'filed without a recognised unit — excluded from totals, not counted as zero' });
  if (!prod.series.length) g.push({ what: 'Production history', why: 'no dated production observations — performance cannot be read' });
  if (!rv.lithology) g.push({ what: 'Reservoir lithology', why: 'no described reservoir — analog matching falls back to the class band' });
  if (!rv.drive) g.push({ what: 'Drive mechanism', why: 'recovery factor cannot be benchmarked without a drive class' });
  if (!d.operator) g.push({ what: 'Operator', why: 'no operator on record' });
  return g;
}

// ── 8. recovery benchmark (class band, NOT a peer comparison) ──────────────────
export interface Benchmark {
  /** this field's implied RF, only when both cumulative production and reserves exist */
  observedRF: number | null;
  bandLow: number; bandMid: number; bandHigh: number;
  className: string; n: number;
  basis: 'class-prior' | 'none';
  note: string;
}
/** Literature recovery-factor bands by drive class. Mirrors engine/analog.ts SEED_ANALOGS
 *  (confidence 'class'), restated here so this module stays dependency-free. */
export const RF_CLASS_BANDS: Array<{ match: RegExp; name: string; low: number; mid: number; high: number; n: number }> = [
  { match: /waterflood/i, name: 'Waterflood · sandstone', low: 0.30, mid: 0.42, high: 0.55, n: 3 },
  { match: /waterdrive|water drive/i, name: 'Water drive', low: 0.35, mid: 0.50, high: 0.75, n: 2 },
  { match: /gas.?cap/i, name: 'Gas-cap drive', low: 0.20, mid: 0.30, high: 0.40, n: 1 },
  { match: /gravity/i, name: 'Gravity drainage', low: 0.40, mid: 0.55, high: 0.80, n: 1 },
  { match: /solution.?gas/i, name: 'Solution-gas drive', low: 0.05, mid: 0.18, high: 0.30, n: 2 },
  { match: /depletion/i, name: 'Depletion · tight', low: 0.05, mid: 0.10, high: 0.18, n: 1 },
];

export function buildBenchmark(drive: string | null, res: ReservesSummary, prod: ProductionSummary): Benchmark {
  const hit = drive ? RF_CLASS_BANDS.find((b) => b.match.test(drive)) : undefined;
  // implied RF needs an in-place volume we do not hold; what we CAN state honestly is
  // the produced fraction of booked reserves — labelled as such, never called "RF".
  const observedRF = res.totalMMBOE && prod.cumulativeMMBOE != null && res.totalMMBOE > 0
    ? prod.cumulativeMMBOE / res.totalMMBOE : null;
  if (!hit) {
    return {
      observedRF, bandLow: 0.1, bandMid: 0.3, bandHigh: 0.55, className: 'No drive class', n: 0, basis: 'none',
      note: 'no drive mechanism on record — the shown band is the full literature spread, not a match',
    };
  }
  return {
    observedRF, bandLow: hit.low, bandMid: hit.mid, bandHigh: hit.high, className: hit.name, n: hit.n,
    basis: 'class-prior',
    note: `literature class band for ${hit.name.toLowerCase()} — a class prior, not a named peer field`,
  };
}

// ── 9. the whole dossier, assembled ────────────────────────────────────────────
export interface AssetDossier {
  lifecycle: Lifecycle; reserves: ReservesSummary; production: ProductionSummary;
  remaining: number | null; mix: MixSlice[]; reservoir: ReservoirVerdict;
  gaps: Gap[]; benchmark: Benchmark;
}
export function buildAssetDossier(
  d: DossierDetail | null,
  kb: { lithology?: string | null; drive?: string | null; formation?: string | null } | null,
  nowYear: number,
): AssetDossier {
  const lifecycle = buildLifecycle(d, nowYear);
  const reserves = buildReserves(d);
  const production = buildProduction(d);
  const reservoir = buildReservoirVerdict(d, kb);
  return {
    lifecycle, reserves, production,
    remaining: remainingMMBOE(reserves, production),
    mix: buildMix(reserves),
    reservoir,
    gaps: buildReadiness(d, lifecycle, reserves, production, reservoir),
    benchmark: buildBenchmark(reservoir.drive, reserves, production),
  };
}

// ── formatting helpers shared by the view ──────────────────────────────────────
export const fmtMMBOE = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(1);
export const fmtPct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : `${Math.round(v * 100)}%`;
