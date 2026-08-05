// well-review.ts — the derivation layer behind the Well Review Register (the expandable
// well cards in the Surveillance Dossier). Pure TS: no React, no DOM, no imports, so it
// is node-testable (scripts/test-well-review.mjs).
//
// One card per producer, carrying EVERYTHING inline: latest rate, the move on the prior
// month, the year-on-year decline, remaining reserves (with its error), the pattern's
// VRR, water cut, TD, a peer benchmark, a ranked root cause and a written
// observation → insight → action. Expanding a card only adds history charts; it never
// reveals a number that should have been on the face of the card.
//
// Grounding rules enforced here, not in the view:
//   · NO per-well recovery factor — Volve carries only a FIELD in-place volume, so a
//     per-well RF would be invented. We report share-of-field + peer percentile instead.
//   · VRR is a PATTERN property; it always travels with the pattern's name.
//   · a remaining volume always travels with the blind-test error that produced it.
//   · implausible geometry is FLAGGED and the well drops out of the ranking.

export type WaterMechanism = 'coning' | 'channeling' | 'multilayer' | 'undetermined';
export type Tone = 'good' | 'warn' | 'bad' | 'unknown';

/** A Volve producer bottoms near 3,000 m; anything shallower than this cannot be one. */
export const MIN_PLAUSIBLE_TD_M = 1000;

export interface WellReviewInput {
  well: string; role: string;
  ym: string[];
  oilRate: number[]; waterRate: number[]; gasRate: number[];
  wct: number[]; wor: number[];
  uptime: Array<number | null>; bhp: Array<number | null>;
  cumOilMM: number;
  tdMd: number | null; tdTvd: number | null;
  /** field cumulative oil, for share-of-field */
  fieldCumMM: number;
  /** the pattern this producer sits in (VRR is a pattern property, never a well's) */
  patternName: string | null; patternVrr: number | null; patternInjectors: string[];
  /** screening water mechanism from engine/surveillance chanWor */
  mechanism: WaterMechanism; mechanismSlope: number;
  /** DCA outputs from engine/review — remaining volume AND the blind-test error */
  remainingMMstb: number | null; declineMapePct: number | null;
}

export interface RootCause { cause: string; confidence: number; evidence: string[]; remedy: string }

export interface WellReview {
  well: string; role: string;
  latestRate: number | null; latestYm: string | null;
  deltaPrev: number | null; deltaPrevPct: number | null;
  yoyDeclinePct: number | null;
  /** decline over the stabilized window, with the abandonment ramp-down removed */
  decline: StabilizedDecline;
  /** false when the wellbore is on the books as a producer but carries no series at all */
  hasSeries: boolean;
  cumOilMM: number; shareOfFieldPct: number | null;
  /** 1 = biggest cumulative producer in the field; drives the card's rank bar */
  cumRank: number; cumShareOfMax: number;
  remainingMMstb: number | null; remainingMapePct: number | null; remainingTrust: Tone;
  wct: number | null; worTrendPct: number; uptime: number | null;
  tdMd: number | null; tdTvd: number | null;
  patternName: string | null; patternVrr: number | null; patternInjectors: string[];
  mechanism: WaterMechanism;
  health: number; benchPercentile: number | null;
  rootCauses: RootCause[];
  observation: string; insight: string; action: string;
  flags: string[]; rankable: boolean; tone: Tone;
}

const lastLive = (rate: number[]) => { for (let i = rate.length - 1; i >= 0; i--) if (rate[i] > 0) return i; return -1; };
const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0);
const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const r1 = (v: number) => Math.round(v * 10) / 10;

/** OLS slope of ln(y) over the trailing n positive points, annualised to a percent. */
export function annualTrendPct(series: number[], n = 12, periodsPerYear = 12): number {
  const xs: number[] = [], ys: number[] = [];
  for (let i = Math.max(0, series.length - n); i < series.length; i++) if (series[i] > 0) { xs.push(xs.length); ys.push(Math.log(series[i])); }
  if (xs.length < 2) return 0;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const slope = sxx > 1e-12 ? sxy / sxx : 0;
  return (Math.exp(slope * periodsPerYear) - 1) * 100;
}

/** Year-on-year change: mean of the last 12 producing months vs the 12 before them.
 *  Negative = decline. Null when there is not a full prior year to compare against. */
export function yoyChangePct(rate: number[], li: number): number | null {
  if (li < 0) return null;
  const recent = rate.slice(Math.max(0, li - 11), li + 1).filter((v) => v > 0);
  const prior = rate.slice(Math.max(0, li - 23), Math.max(0, li - 11)).filter((v) => v > 0);
  if (recent.length < 3 || prior.length < 3) return null;
  const a = mean(prior);
  return a > 0 ? ((mean(recent) - a) / a) * 100 : null;
}

// ── stabilized decline ─────────────────────────────────────────────────────────
// A field's final year is an ABANDONMENT ramp-down, not reservoir behaviour: wells are
// shut in one by one and the rate collapses far faster than the reservoir is declining.
// Quoting that as "the decline rate" is wrong — Volve's headline −51% YoY is the 2016
// cessation, not depletion. So we detect the terminal collapse, exclude it, and fit the
// decline over the STABILIZED window, reporting both numbers separately.
export interface StabilizedDecline {
  annualPct: number | null;      // decline over the stabilized window, %/yr (negative = declining)
  fromYm: string | null; toYm: string | null; months: number;
  excludedMonths: number;        // terminal months dropped as abandonment
  terminalAnnualPct: number | null; // how steep the abandonment ramp actually was
  basis: string;
}
/** Steepness multiple over the established month-on-month decline that marks a month as
 *  part of the terminal ramp-down rather than normal depletion. */
export const TERMINAL_STEEPNESS = 2.5;
export const MIN_STABLE_MONTHS = 6;

export function stabilizedDecline(oilRate: number[], ym: string[]): StabilizedDecline {
  const none: StabilizedDecline = { annualPct: null, fromYm: null, toYm: null, months: 0, excludedMonths: 0, terminalAnnualPct: null, basis: 'no producing history' };
  const li = lastLive(oilRate);
  if (li < 0) return none;
  let pk = 0;
  for (let k = 0; k <= li; k++) if (oilRate[k] > oilRate[pk]) pk = k;
  if (li - pk < MIN_STABLE_MONTHS) return { ...none, basis: 'too little post-peak history to fit a decline' };

  // month-on-month log decline over the post-peak segment
  const d: Array<{ i: number; v: number }> = [];
  for (let i = pk + 1; i <= li; i++) if (oilRate[i] > 0 && oilRate[i - 1] > 0) d.push({ i, v: Math.log(oilRate[i - 1] / oilRate[i]) });
  if (d.length < MIN_STABLE_MONTHS) return { ...none, basis: 'too few positive months to fit a decline' };
  const sorted = [...d].map((x) => x.v).sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const threshold = Math.max(0.05, Math.abs(med) * TERMINAL_STEEPNESS);

  // walk back from the end while months are anomalously steep — that is the ramp-down
  let cut = li;
  for (let k = d.length - 1; k >= 0; k--) {
    if (d[k].v > threshold) cut = d[k].i - 1; else break;
  }
  const excluded = li - cut;
  const stableEnd = excluded > 0 ? cut : li;
  const months = stableEnd - pk + 1;
  if (months < MIN_STABLE_MONTHS) {
    return { ...none, excludedMonths: excluded, basis: 'stabilized window too short after removing the terminal ramp-down' };
  }

  // log-linear fit over the stabilized window
  const xs: number[] = [], ys: number[] = [];
  for (let i = pk; i <= stableEnd; i++) if (oilRate[i] > 0) { xs.push(xs.length); ys.push(Math.log(oilRate[i])); }
  if (xs.length < 2) return { ...none, basis: 'insufficient points in the stabilized window' };
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const slope = sxx > 1e-12 ? sxy / sxx : 0;
  const annualPct = (Math.exp(slope * 12) - 1) * 100;

  // and how steep the excluded terminal stretch was, so it is reported not hidden
  let terminalAnnualPct: number | null = null;
  if (excluded > 0 && oilRate[stableEnd] > 0 && oilRate[li] > 0) {
    const mo = Math.max(1, li - stableEnd);
    terminalAnnualPct = (Math.exp(Math.log(oilRate[li] / oilRate[stableEnd]) / mo * 12) - 1) * 100;
  }
  return {
    annualPct, fromYm: ym[pk] ?? null, toYm: ym[stableEnd] ?? null, months,
    excludedMonths: excluded, terminalAnnualPct,
    basis: excluded > 0
      ? `fitted ${ym[pk]}→${ym[stableEnd]}; final ${excluded} month${excluded === 1 ? '' : 's'} excluded as abandonment ramp-down`
      : `fitted ${ym[pk]}→${ym[stableEnd]}; no terminal ramp-down detected`,
  };
}

export function wellHealthScore(wct: number, uptime: number | null, declinePct: number): number {
  const s = 0.45 * (1 - clamp01(wct / 100)) + 0.35 * clamp01(uptime ?? 1) + 0.20 * (1 - clamp01(Math.max(0, -declinePct) / 100));
  return Math.round(clamp01(s) * 1000) / 10;
}

// ── root-cause rules — ranked candidates with the evidence that fired them ──────
export function buildRootCauses(i: WellReviewInput, wct: number | null, worTrend: number, uptime: number | null, deltaPrevPct: number | null): RootCause[] {
  const out: RootCause[] = [];
  const vrr = i.patternVrr;
  const pat = i.patternName ? ` (pattern ${i.patternName})` : '';

  if (i.mechanism === 'channeling' && worTrend > 0) {
    out.push({ cause: 'Channelling / thief zone', confidence: vrr != null && vrr >= 1 ? 0.8 : 0.6,
      evidence: [`Chan late-time slope ${i.mechanismSlope}`, `WOR ${worTrend > 0 ? '+' : ''}${Math.round(worTrend)}%/yr`,
        vrr != null ? `pattern VRR ${vrr.toFixed(2)}${pat}` : 'no pattern VRR'],
      remedy: 'Conformance / water shut-off; review injector allocation on the supporting pattern.' });
  }
  if (i.mechanism === 'multilayer') {
    out.push({ cause: 'Multilayer channelling', confidence: 0.7,
      evidence: [`Chan slope ${i.mechanismSlope} (>1.4)`, 'stepwise WOR rise'],
      remedy: 'Selective isolation of the thief layers; production logging to place the plug.' });
  }
  if (i.mechanism === 'coning') {
    out.push({ cause: 'Bottom-water coning', confidence: 0.65,
      evidence: [`Chan slope ${i.mechanismSlope} (<0.3, WOR plateaus)`, wct != null ? `water cut ${Math.round(wct)}%` : 'no water-cut series'],
      remedy: 'Rate control or downdip re-perforation — the cone is drawdown-driven.' });
  }
  if (vrr != null && vrr < 0.9) {
    out.push({ cause: 'Voidage deficit — under-support', confidence: 0.75,
      evidence: [`pattern VRR ${vrr.toFixed(2)} < 0.9${pat}`, i.patternInjectors.length ? `injectors ${i.patternInjectors.join(', ')}` : 'no injector linked'],
      remedy: 'Raise injection on the supporting pattern; expect pressure decline until voidage is replaced.' });
  }
  if (vrr != null && vrr > 1.15) {
    out.push({ cause: 'Over-injection / fracture risk', confidence: 0.6,
      evidence: [`pattern VRR ${vrr.toFixed(2)} > 1.15${pat}`],
      remedy: 'Reduce or re-allocate injection; check for fracture-driven short-circuiting.' });
  }
  if (uptime != null && uptime < 0.8) {
    const mechanical = deltaPrevPct != null && deltaPrevPct < -15;
    out.push({ cause: 'Mechanical / deferment', confidence: mechanical ? 0.7 : 0.45,
      evidence: [`uptime ${Math.round(uptime * 100)}%`, mechanical ? `rate ${Math.round(deltaPrevPct!)}% on prior month` : 'rate step not confirmed'],
      remedy: 'Well-integrity and lift review; recover uptime before attributing loss to the reservoir.' });
  }
  if (!out.length) {
    out.push({ cause: 'Natural decline', confidence: 0.5,
      evidence: ['no water-path, voidage or uptime rule fired', `decline ${Math.round(worTrend)}%/yr WOR trend`],
      remedy: 'No intervention indicated; monitor against the decline forecast.' });
  }
  return out.sort((a, b) => b.confidence - a.confidence);
}

/** Build every producer's card, including the cohort-relative benchmark. */
export function buildWellReviews(inputs: WellReviewInput[]): WellReview[] {
  const partial = inputs.map((i) => {
    const li = lastLive(i.oilRate);
    const latestRate = li >= 0 ? i.oilRate[li] : null;
    const prev = li > 0 ? i.oilRate[li - 1] : null;
    const deltaPrev = latestRate != null && prev != null ? latestRate - prev : null;
    const deltaPrevPct = deltaPrev != null && prev ? (deltaPrev / prev) * 100 : null;
    const wct = li >= 0 ? i.wct[li] ?? null : null;
    const ups = i.uptime.filter((v): v is number => v != null);
    const uptime = ups.length ? ups[ups.length - 1] : null;
    const worTrend = annualTrendPct(i.wor);
    const yoy = yoyChangePct(i.oilRate, li);
    const decline = stabilizedDecline(i.oilRate, i.ym);
    // health uses the STABILIZED decline — scoring a well on its abandonment ramp-down
    // would condemn every well on a ceased field for something the reservoir did not do
    const health = wellHealthScore(wct ?? 0, uptime, decline.annualPct ?? yoy ?? 0);

    const hasSeries = i.ym.length > 0 && i.oilRate.some((v) => v > 0);
    const flags: string[] = [];
    // a wellbore on the books with no series cannot be scored — it is a data gap, and
    // scoring it would hand a well with zero evidence a perfect health mark
    if (!hasSeries) flags.push('no production series on record — cannot be ranked');
    if (i.tdMd != null && i.tdMd < MIN_PLAUSIBLE_TD_M) flags.push(`TD ${Math.round(i.tdMd)} m is implausible for a producer — geometry not trusted`);
    if (i.patternVrr == null) flags.push('no supporting pattern linked — VRR not available');
    if (!i.bhp.some((v) => v != null)) flags.push('no downhole gauge');

    const remainingTrust: Tone = i.declineMapePct == null ? 'unknown'
      : i.declineMapePct <= 25 ? 'good' : i.declineMapePct <= 50 ? 'warn' : 'bad';

    const rootCauses = buildRootCauses(i, wct, worTrend, uptime, deltaPrevPct);
    const shareOfFieldPct = i.fieldCumMM > 0 ? (i.cumOilMM / i.fieldCumMM) * 100 : null;

    // ── the written narrative, straight off the numbers above ──────────────────
    const observation = latestRate == null
      ? 'No producing month on record.'
      : `${Math.round(latestRate).toLocaleString()} bopd (${i.ym[li]})`
        + (deltaPrevPct != null ? `, ${deltaPrevPct >= 0 ? '+' : ''}${r1(deltaPrevPct)}% on the prior month` : '')
        + (decline.annualPct != null
          ? `. Stabilized decline ${r1(decline.annualPct)}%/yr`
            + (decline.excludedMonths > 0
              ? ` — the last ${decline.excludedMonths} month${decline.excludedMonths === 1 ? ' is' : 's are'} the abandonment ramp-down (${decline.terminalAnnualPct != null ? `${r1(decline.terminalAnnualPct)}%/yr` : 'steep'}), excluded`
              : '')
          : yoy != null ? `; ${yoy >= 0 ? '+' : ''}${r1(yoy)}% year on year` : '')
        + (wct != null ? `. Water cut ${Math.round(wct)}%` : '')
        + (uptime != null ? `, uptime ${Math.round(uptime * 100)}%` : '') + '.';
    const top = rootCauses[0];
    const insight = `${top.cause} — ${top.evidence.join('; ')}.`;
    const action = flags.some((f) => /implausible/.test(f))
      ? 'Resolve the well geometry record before sizing an intervention.'
      : top.remedy + (i.remainingMMstb != null
        ? ` Remaining ${r1(i.remainingMMstb)} MMSTB on the decline forecast${i.declineMapePct != null ? ` (±${Math.round(i.declineMapePct)}% blind-test error)` : ''}.`
        : ' Remaining volume not derivable from this history.');

    const tone: Tone = health > 66 ? 'good' : health > 40 ? 'warn' : 'bad';

    return {
      well: i.well, role: i.role,
      latestRate, latestYm: li >= 0 ? i.ym[li] ?? null : null,
      deltaPrev, deltaPrevPct, yoyDeclinePct: yoy, decline, hasSeries,
      cumOilMM: i.cumOilMM, shareOfFieldPct, cumRank: 0, cumShareOfMax: 0,
      remainingMMstb: i.remainingMMstb, remainingMapePct: i.declineMapePct, remainingTrust,
      wct, worTrendPct: worTrend, uptime,
      tdMd: i.tdMd, tdTvd: i.tdTvd,
      patternName: i.patternName, patternVrr: i.patternVrr, patternInjectors: i.patternInjectors,
      mechanism: i.mechanism,
      health, benchPercentile: null as number | null,
      rootCauses, observation, insight, action,
      flags, rankable: hasSeries && !flags.some((f) => /implausible/.test(f)), tone,
    };
  });

  // cumulative-oil ranking — the card's bar shows how much of the field's oil this well
  // actually delivered, so the biggest contributor reads as the biggest bar
  const maxCum = Math.max(...partial.map((p) => p.cumOilMM), 0);
  const byCum = [...partial].sort((a, b) => b.cumOilMM - a.cumOilMM);
  byCum.forEach((p, k) => { p.cumRank = k + 1; p.cumShareOfMax = maxCum > 0 ? p.cumOilMM / maxCum : 0; });

  // cohort benchmark — percentile of health among RANKABLE peers (peer-relative, never
  // a per-well recovery factor, which no in-place volume supports)
  const cohort = partial.filter((p) => p.rankable).map((p) => p.health).sort((a, b) => a - b);
  for (const p of partial) {
    if (!cohort.length || !p.rankable) { p.benchPercentile = null; continue; }
    const below = cohort.filter((h) => h < p.health).length;
    p.benchPercentile = Math.round((below / cohort.length) * 100);
  }
  // worst first; unrankable wells sink to the bottom rather than being hidden
  return partial.sort((a, b) => (a.rankable === b.rankable ? a.health - b.health : a.rankable ? -1 : 1));
}

export const fmt1 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : r1(v).toString());
export const fmtInt = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? '—' : Math.round(v).toLocaleString());
