// surveillance-dossier.ts — the derivation layer behind the Reservoir Management
// Knowledge Bank (the Surveillance Dossier). Pure TS: no React, no DOM, no imports —
// so it runs in a worker and is node-testable (scripts/test-surveillance-dossier.mjs).
//
// The third sibling in the dossier family:
//   Exploration  → "is this basin worth my money, what must I still find out?"   (chance)
//   Field Dev    → "can this field be developed, how has it performed?"          (record)
//   Reservoir Mgmt → "IS THIS RESERVOIR BEING DRAINED EFFICIENTLY — what is it
//                     doing now, why, and what must I act on next?"              (behaviour)
//
// Grounding rules, enforced HERE and not in the view:
//   · a month with no gauge reading is null and stays null — never interpolated
//   · trailing shut-in months are excluded from "latest" reads (a shut field is not 0 bopd)
//   · recovery is quoted against a MODEL OOIP and labelled as such — never a booked reserve
//   · a mechanism call is a SCREENING classification; low-evidence returns 'undetermined'
//   · every gap is a finding, not an error state

export type Tone = 'good' | 'warn' | 'bad' | 'unknown';
export type WaterMechanism = 'coning' | 'channeling' | 'multilayer' | 'undetermined';

/** Everything the dossier needs, already in field units. The view computes the
 *  truth-locked pieces (Chan's mechanism, VRR) with engine/surveillance.ts and passes
 *  them in, so this module never duplicates that maths. */
export interface SurveillanceInput {
  ym: string[];
  oilRate: number[];        // bopd, monthly mean
  waterRate: number[];      // bwpd
  gasRate: number[];        // Mscf/d produced gas
  injRate: number[];        // bwpd injected
  wct: number[];            // %
  vrrCum: number[];         // running cumulative VRR
  vrrFinal: number;
  bhp: Array<number | null>;// psi, flowing monthly mean
  cumOilMM: number;         // MMSTB
  cumWinjMM: number;        // MMbbl
  ooipMMstb: number | null; // model OOIP, when a study exists
  remainingMMstb: number | null; // DCA remaining, when derivable
  mechanism: WaterMechanism;
  mechanismSlope: number;
  wells: WellRow[];
}
export interface WellRow {
  well: string; role: string;
  cumOilMM: number; wct: number; uptime: number | null; health: number;
  worTrendPct: number; oilTrendPct: number;
}

/** Index of the last month that actually produced — trailing zeros are shut-in, not zero rate. */
export function lastLive(oilRate: number[]): number {
  for (let i = oilRate.length - 1; i >= 0; i--) if (oilRate[i] > 0) return i;
  return -1;
}

// ── 1. depletion stage ─────────────────────────────────────────────────────────
export type Stage = 'start-up' | 'plateau' | 'decline' | 'tail' | 'ceased' | 'unknown';
export const STAGE_LABEL: Record<Stage, string> = {
  'start-up': 'Start-up / ramp', plateau: 'Plateau', decline: 'Decline',
  tail: 'Tail production', ceased: 'Ceased production', unknown: 'Not recorded',
};
export const STAGE_PROGRESS: Record<Stage, number> = {
  unknown: 0, 'start-up': 0.15, plateau: 0.4, decline: 0.72, tail: 0.9, ceased: 1,
};

export interface Depletion {
  stage: Stage; tone: Tone;
  peakRate: number | null; peakYm: string | null;
  latestRate: number | null; latestYm: string | null;
  fractionOfPeak: number | null;
  producingMonths: number;
  shutIn: boolean;
  detail: string;
}

/** A stage call needs a trend. Below this many producing periods the shape of the
 *  curve is not established and any verdict would be invented — a one-point annual
 *  catalogue row must never read as "start-up". */
export const MIN_PERIODS_FOR_STAGE = 3;

export function buildDepletion(i: SurveillanceInput): Depletion {
  const li = lastLive(i.oilRate);
  if (li < 0) {
    return { stage: 'unknown', tone: 'unknown', peakRate: null, peakYm: null, latestRate: null,
      latestYm: null, fractionOfPeak: null, producingMonths: 0, shutIn: false,
      detail: 'no producing month on record' };
  }
  let pk = 0;
  for (let k = 0; k <= li; k++) if (i.oilRate[k] > i.oilRate[pk]) pk = k;
  const peakRate = i.oilRate[pk], latestRate = i.oilRate[li];
  const frac = peakRate > 0 ? latestRate / peakRate : null;
  const shutIn = li < i.oilRate.length - 1;
  const producingMonths = i.oilRate.slice(0, li + 1).filter((v) => v > 0).length;

  // too few periods to read a trend → say so, never guess a stage
  if (producingMonths < MIN_PERIODS_FOR_STAGE && !shutIn) {
    return { stage: 'unknown', tone: 'unknown', peakRate, peakYm: i.ym[pk] ?? null,
      latestRate, latestYm: i.ym[li] ?? null, fractionOfPeak: frac, producingMonths, shutIn: false,
      detail: `only ${producingMonths} reported period${producingMonths === 1 ? '' : 's'} — too little history to read a depletion stage` };
  }

  let stage: Stage;
  if (shutIn) stage = 'ceased';
  else if (li - pk <= 2 && li < producingMonths * 0.35) stage = 'start-up';
  else if (frac != null && frac >= 0.8) stage = 'plateau';
  else if (frac != null && frac >= 0.25) stage = 'decline';
  else stage = 'tail';

  const tone: Tone = stage === 'plateau' ? 'good' : stage === 'decline' ? 'warn'
    : stage === 'ceased' || stage === 'tail' ? 'bad' : 'unknown';
  const detail = stage === 'ceased'
    ? `shut in after ${i.ym[li]}`
    : frac != null ? `${Math.round(frac * 100)}% of peak rate (${i.ym[pk]})` : 'rate history only';

  return { stage, tone, peakRate, peakYm: i.ym[pk] ?? null, latestRate, latestYm: i.ym[li] ?? null,
    fractionOfPeak: frac, producingMonths, shutIn, detail };
}

// ── 2. pressure support / sweep verdict ────────────────────────────────────────
export type SupportClass = 'balanced' | 'under-injected' | 'over-injected' | 'depletion' | 'unknown';
export const SUPPORT_LABEL: Record<SupportClass, string> = {
  balanced: 'Balanced voidage', 'under-injected': 'Under-injected',
  'over-injected': 'Over-injected', depletion: 'Natural depletion', unknown: 'Not derivable',
};
export interface Support {
  klass: SupportClass; tone: Tone; vrr: number | null;
  scheme: string; injectors: number;
  bhpFirst: number | null; bhpLast: number | null; bhpDrawdown: number | null;
  detail: string;
}
export function buildSupport(i: SurveillanceInput): Support {
  const injectors = i.wells.filter((w) => /inject/i.test(w.role)).length;
  const hasInj = i.cumWinjMM > 0;
  const vrr = hasInj && Number.isFinite(i.vrrFinal) ? i.vrrFinal : null;
  const gauges = i.bhp.filter((v): v is number => v != null && Number.isFinite(v));
  const bhpFirst = gauges.length ? gauges[0] : null;
  const bhpLast = gauges.length ? gauges[gauges.length - 1] : null;
  const bhpDrawdown = bhpFirst != null && bhpLast != null ? bhpFirst - bhpLast : null;

  let klass: SupportClass = 'unknown';
  if (!hasInj) klass = 'depletion';
  else if (vrr == null) klass = 'unknown';
  else if (vrr >= 0.9 && vrr <= 1.15) klass = 'balanced';
  else if (vrr < 0.9) klass = 'under-injected';
  else klass = 'over-injected';

  const tone: Tone = klass === 'balanced' ? 'good'
    : klass === 'under-injected' || klass === 'over-injected' ? 'warn'
      : klass === 'depletion' ? 'warn' : 'unknown';

  const detail = klass === 'depletion' ? 'no injection on record — reservoir on natural drive'
    : vrr != null ? `VRR ${vrr.toFixed(2)} · ${injectors} injector${injectors === 1 ? '' : 's'}`
      : 'injection present but voidage not derivable';

  return { klass, tone, vrr, scheme: hasInj ? 'Waterflood' : 'Depletion', injectors,
    bhpFirst, bhpLast, bhpDrawdown, detail };
}

// ── 3. displacement / water mechanism (RM's classification card) ───────────────
export interface Displacement {
  mechanism: WaterMechanism; slope: number; tone: Tone;
  breakthroughYm: string | null; breakthroughMonth: number | null;
  currentWct: number | null; label: string; action: string;
}
export const MECHANISM_LABEL: Record<WaterMechanism, string> = {
  coning: 'Bottom-water coning', channeling: 'Channelling / high-perm streak',
  multilayer: 'Multilayer channelling', undetermined: 'Not classified',
};
const MECHANISM_ACTION: Record<WaterMechanism, string> = {
  coning: 'Rate control or downdip re-perforation; WOR plateaus so the cone is drawdown-driven.',
  channeling: 'Conformance / shut-off candidate — WOR climbs on a unit slope with injection.',
  multilayer: 'Selective isolation candidate — stepwise WOR indicates several thief layers.',
  undetermined: 'Insufficient watered-up history to classify the water path.',
};
export function buildDisplacement(i: SurveillanceInput): Displacement {
  const li = lastLive(i.oilRate);
  let btIdx: number | null = null;
  for (let k = 0; k <= (li < 0 ? i.wct.length - 1 : li); k++) {
    if (i.wct[k] >= 50) { btIdx = k; break; }
  }
  const currentWct = li >= 0 ? i.wct[li] ?? null : null;
  const tone: Tone = i.mechanism === 'undetermined' ? 'unknown'
    : i.mechanism === 'coning' ? 'warn' : 'bad';
  return {
    mechanism: i.mechanism, slope: i.mechanismSlope, tone,
    breakthroughYm: btIdx != null ? i.ym[btIdx] ?? null : null,
    breakthroughMonth: btIdx,
    currentWct,
    label: MECHANISM_LABEL[i.mechanism],
    action: MECHANISM_ACTION[i.mechanism],
  };
}

// ── 4. recovery efficiency + class benchmark ───────────────────────────────────
export interface Efficiency {
  recoveredMMstb: number; ooipMMstb: number | null; recoveryPct: number | null;
  remainingMMstb: number | null;
  bandLow: number; bandMid: number; bandHigh: number; className: string; n: number;
  basis: 'class-prior' | 'none'; note: string; tone: Tone;
}
/** Literature RF bands by displacement class — a class prior, never a named peer. */
export const RF_BANDS: Array<{ match: RegExp; name: string; low: number; mid: number; high: number; n: number }> = [
  { match: /waterflood/i, name: 'Waterflood · sandstone', low: 0.30, mid: 0.42, high: 0.55, n: 3 },
  { match: /depletion/i, name: 'Solution-gas / depletion', low: 0.05, mid: 0.18, high: 0.30, n: 2 },
];
export function buildEfficiency(i: SurveillanceInput, support: Support): Efficiency {
  const hit = RF_BANDS.find((b) => b.match.test(support.scheme));
  const recoveryPct = i.ooipMMstb && i.ooipMMstb > 0 ? i.cumOilMM / i.ooipMMstb : null;
  const tone: Tone = recoveryPct == null ? 'unknown'
    : hit && recoveryPct >= hit.mid ? 'good'
      : hit && recoveryPct >= hit.low ? 'warn' : 'bad';
  return {
    recoveredMMstb: i.cumOilMM, ooipMMstb: i.ooipMMstb, recoveryPct,
    remainingMMstb: i.remainingMMstb,
    bandLow: hit?.low ?? 0.05, bandMid: hit?.mid ?? 0.3, bandHigh: hit?.high ?? 0.55,
    className: hit?.name ?? 'No displacement class', n: hit?.n ?? 0,
    basis: hit ? 'class-prior' : 'none',
    note: hit
      ? `literature class band for ${hit.name.toLowerCase()} — a class prior, not a named peer field`
      : 'no displacement class on record — the shown band is the full literature spread',
    tone,
  };
}

// ── 5. surveillance events (the signature timeline's pips) ─────────────────────
export type EventId = 'first-oil' | 'first-injection' | 'peak' | 'breakthrough' | 'last-live';
export interface SurvEvent { id: EventId; label: string; index: number; ym: string; note: string }

export function buildEvents(i: SurveillanceInput, dep: Depletion, disp: Displacement): SurvEvent[] {
  const out: SurvEvent[] = [];
  const firstOil = i.oilRate.findIndex((v) => v > 0);
  if (firstOil >= 0) out.push({ id: 'first-oil', label: 'First oil', index: firstOil, ym: i.ym[firstOil], note: 'first producing month on record' });
  const firstInj = i.injRate.findIndex((v) => v > 0);
  if (firstInj >= 0) out.push({ id: 'first-injection', label: 'Injection start', index: firstInj, ym: i.ym[firstInj], note: 'pressure support begins' });
  if (dep.peakYm) {
    const pk = i.ym.indexOf(dep.peakYm);
    if (pk >= 0) out.push({ id: 'peak', label: 'Peak rate', index: pk, ym: dep.peakYm, note: `${Math.round(dep.peakRate ?? 0).toLocaleString()} bopd` });
  }
  if (disp.breakthroughMonth != null) {
    out.push({ id: 'breakthrough', label: 'Water breakthrough', index: disp.breakthroughMonth, ym: disp.breakthroughYm ?? '', note: 'water cut crosses 50%' });
  }
  const li = lastLive(i.oilRate);
  if (li >= 0 && dep.shutIn) out.push({ id: 'last-live', label: 'Last production', index: li, ym: i.ym[li], note: 'field shut in after this month' });
  return out.sort((a, b) => a.index - b.index);
}

// ── 6. well watchlist — the ranked strip (RM's "tectonostratigraphy") ──────────
export interface Watch { well: string; role: string; health: number; wct: number; worTrendPct: number; flag: string | null }
export function buildWatchlist(i: SurveillanceInput): Watch[] {
  return i.wells
    .map((w) => {
      let flag: string | null = null;
      if (w.wct >= 90) flag = 'Water cut ≥ 90%';
      else if (w.worTrendPct > 30) flag = 'WOR rising fast';
      else if (w.uptime != null && w.uptime < 0.5) flag = 'Low uptime';
      else if (w.oilTrendPct < -40) flag = 'Steep oil decline';
      return { well: w.well, role: w.role, health: w.health, wct: w.wct, worTrendPct: w.worTrendPct, flag };
    })
    .sort((a, b) => a.health - b.health);
}

// ── 7. surveillance ledger — the gap list IS the work programme ────────────────
export interface Gap { what: string; why: string; severity: 'act' | 'watch' | 'gap' }
export function buildLedger(i: SurveillanceInput, dep: Depletion, sup: Support, disp: Displacement, watch: Watch[]): Gap[] {
  const g: Gap[] = [];
  if (!i.ym.length) { g.push({ what: 'Production history', why: 'no monthly surveillance series — nothing can be diagnosed', severity: 'gap' }); return g; }

  if (sup.klass === 'under-injected') g.push({ what: 'Voidage deficit', why: `VRR ${sup.vrr?.toFixed(2)} — injection is not replacing produced voidage; expect pressure decline`, severity: 'act' });
  if (sup.klass === 'over-injected') g.push({ what: 'Voidage surplus', why: `VRR ${sup.vrr?.toFixed(2)} — injecting above withdrawal; check fracture/thief risk and injector allocation`, severity: 'act' });
  if (disp.mechanism === 'channeling' || disp.mechanism === 'multilayer') {
    g.push({ what: `Water path: ${MECHANISM_LABEL[disp.mechanism].toLowerCase()}`, why: disp.action, severity: 'act' });
  }
  const critical = watch.filter((w) => w.flag);
  for (const w of critical.slice(0, 4)) g.push({ what: `${w.well} — ${w.flag}`, why: `health ${w.health.toFixed(0)} · water cut ${w.wct.toFixed(0)}%`, severity: 'watch' });

  if (dep.stage === 'unknown' && dep.producingMonths > 0 && dep.producingMonths < MIN_PERIODS_FOR_STAGE) {
    g.push({ what: 'Production history too short', why: `only ${dep.producingMonths} reported period${dep.producingMonths === 1 ? '' : 's'} — a depletion stage cannot be read from this record`, severity: 'gap' });
  }
  if (!i.bhp.some((v) => v != null)) g.push({ what: 'Downhole pressure', why: 'no flowing BHP gauge on record — depletion and connectivity cannot be read', severity: 'gap' });
  if (i.ooipMMstb == null) g.push({ what: 'In-place volume', why: 'no model OOIP — recovery efficiency cannot be benchmarked', severity: 'gap' });
  if (disp.mechanism === 'undetermined') g.push({ what: 'Displacement mechanism', why: 'insufficient watered-up history for a Chan diagnosis', severity: 'gap' });
  if (dep.stage === 'ceased') g.push({ what: 'Field shut in', why: `no production after ${dep.latestYm} — remaining potential needs a re-entry case`, severity: 'watch' });
  return g;
}

// ── 8. the whole dossier, assembled ────────────────────────────────────────────
export interface SurveillanceDossier {
  depletion: Depletion; support: Support; displacement: Displacement;
  efficiency: Efficiency; events: SurvEvent[]; watchlist: Watch[]; ledger: Gap[];
}
export function buildSurveillanceDossier(i: SurveillanceInput): SurveillanceDossier {
  const depletion = buildDepletion(i);
  const support = buildSupport(i);
  const displacement = buildDisplacement(i);
  const efficiency = buildEfficiency(i, support);
  const watchlist = buildWatchlist(i);
  return {
    depletion, support, displacement, efficiency,
    events: buildEvents(i, depletion, displacement),
    watchlist,
    ledger: buildLedger(i, depletion, support, displacement, watchlist),
  };
}

// ── formatting helpers shared by the view ──────────────────────────────────────
export const fmtNum = (v: number | null | undefined, d = 1) =>
  v == null || !Number.isFinite(v) ? '—' : v >= 100 ? Math.round(v).toLocaleString() : v.toFixed(d);
export const fmtPct = (v: number | null | undefined) =>
  v == null || !Number.isFinite(v) ? '—' : `${Math.round(v * 100)}%`;
