// model-qc.ts — the static model QC gate, in the order a geoscientist runs it.
//
// This is the review a static model gets before it is handed to a reservoir engineer:
// input data first, then geometry, then the properties built on that geometry, then
// the fluid description, and only then the question "is it ready".
//
// ── WHY CONSISTENCY IS ITS OWN SECTION ──────────────────────────────────────
//
// Every individual check can pass while the model is still wrong, because the errors
// that survive a review are the ones that live BETWEEN disciplines. A petrophysicist
// defines net rock with a cutoff; a modeller defines it with a facies code; both are
// defensible, and if the volume calculation uses one while the property model uses the
// other, the pore volume is counted twice with nobody's check failing. That class of
// error has no owner, so it gets its own section here and the checks in it compare one
// discipline's number against another's.
//
// ── STATUS VOCABULARY ───────────────────────────────────────────────────────
//
//   pass    — measured, and within what the check expects
//   flag    — measured, outside expectation, and the model is still usable
//   fail    — measured, and the model cannot go forward until it is fixed
//   absent  — the artifact does not exist; NOT the same as failing a test
//   n/a     — the check cannot apply to this model, with the reason
//
// `absent` and `n/a` are deliberately not `pass`. A QC sheet whose green ticks include
// tests that never ran is the specific failure this file exists to prevent.
//
// Pure — no DOM, no IndexedDB, no `import.meta`.

import { standingBo, sm3ToScf, gasGravity, cToF, oilApi } from './fluid-model.ts';

export type QcStatus = 'pass' | 'flag' | 'fail' | 'absent' | 'n/a';

export type QcSection =
  | 'data' | 'geometry' | 'facies' | 'petrophysics'
  | 'permeability' | 'pvt' | 'saturation' | 'consistency';

export const SECTION_TITLE: Record<QcSection, string> = {
  data: 'A · Input data and distribution',
  geometry: 'B · Grid geometry',
  facies: 'C · Facies model',
  petrophysics: 'D · Petrophysical properties',
  permeability: 'E · Permeability',
  pvt: 'F · Fluid description (PVT)',
  saturation: 'G · Saturation-height function',
  consistency: 'H · Cross-discipline consistency',
};

export interface QcItem {
  id: string;
  section: QcSection;
  label: string;
  status: QcStatus;
  /** what was measured */
  finding: string;
  /** what the check expected, when there is a stateable expectation */
  expected?: string;
  /** what breaks downstream if it is left */
  consequence?: string;
  /** what to do about it */
  action?: string;
}

export interface ModelQcInput {
  data: {
    wellsTotal: number;
    wellsWithLogs: number;
    wellsWithSurvey: number;
    wellsUpscaled: number;
    producers: number; producersUpscaled: number;
    injectors: number; injectorsUpscaled: number;
    /** distinct declared depth units across the log set */
    depthUnits: Array<[string, number]>;
    logSamples: number;
    /** samples per curve family actually present */
    curveCoverage: Array<{ family: string; wells: number }>;
    /** fraction of the model's active columns within 1 cell of an upscaled cell */
    conditionedColumnFraction: number;
    crs?: string | null;
    /**
     * Depth-datum reconciliation: the survey's own TVD against the delivery's picked
     * TVDSS at the same measured depth. `kbApplied` records whether the rig-floor
     * elevation was subtracted at all.
     */
    datum?: { n: number; meanAbsErrM: number; worstWell?: string; worstErrM?: number; kbApplied: boolean };
  };
  geometry: {
    nx: number; ny: number; nz: number;
    cells: number; activeCells: number; liveCells: number;
    negativeCells: number; zeroCells: number;
    pinchCells: number; highAspectCells: number;
    stackingDefects: number; orderDefects: number;
    bodies: number;
    repairedColumns: number;
    repairAddedFraction: number;
    unfaulted: boolean;
  };
  facies: {
    count: number;
    conditioningCells: number;
    conditioningSandFraction: number;
    realisationSandFraction: number;
    unconditionedLayers: number;
    simulatedLayers: number;
    totalLayers: number;
    simNodes: number;
    modelNx: number;
  };
  petrophysics: {
    logPhiMean: number;
    /** porosity of the NET rock only — what a petrophysicist quotes */
    netPhiMean: number;
    upscaledPhiMean: number;
    simulatedPhiMean: number;
    phiMin: number; phiMax: number;
    /** net fraction of the reservoir interval, from the cutoffs */
    netFraction: number;
    /** the NTG the volume calculation actually uses */
    ntgUsed: number;
    /** how NTG was derived */
    ntgSource: 'net-cutoff' | 'binary-facies' | 'constant';
    publishedPhi?: number;
    publishedNtg?: number;
    /** did the interpretation use the delivery's OWN Archie constants, or textbook ones? */
    archieSource?: 'published' | 'default';
    archie?: { a: number; m: number; n: number; rw: number };
    archieProvenance?: string;
  };
  permeability: {
    fitted: boolean;
    geoMeanMd: number;
    arithMeanMd: number;
    maxMd: number;
    cappedCells: number;
    simulatedCells: number;
    ceilingMd: number;
    kvkh: number;
    kvkhSource: 'measured' | 'assumed';
    upscaleAverage: string;
    hasPermZ: boolean;
  };
  pvt: {
    bo?: number; rs?: number; pb?: number; pi?: number; tempC?: number;
    datumTvdss?: number;
    oilDensityKgM3?: number; gasDensityKgM3?: number; waterDensityKgM3?: number;
    rockCf?: number; rockPrefBara?: number;
    source?: string;
  };
  saturation: {
    /** is there a 3D Sw property at all? */
    modelled: boolean;
    /** a saturation-height function exists — published, fitted, or analogue */
    shfPresent: boolean;
    /** where it came from, and whether the STATIC model actually consumes it. An SHF
     *  that exists in the fluids module but is not wired into the grid is a different
     *  finding from one that does not exist: the first is a wiring gap, the second is
     *  missing science, and calling both "absent" hides work that is already done. */
    shfSource?: string;
    shfWiredToGrid?: boolean;
    /** relative-permeability / capillary-pressure description */
    scalPresent?: boolean;
    scalSource?: string;
    /** the value the volume calculation applies where there is no property */
    constantUsed?: number;
    /** Sw measured in net rock from the logs */
    netSwMean?: number;
    logSwMean?: number;
    swCutoff?: number;
    contactTvdss?: number;
    crestTvdss?: number;
    publishedSw?: number;
  };
  volumes?: {
    stoiipMMSm3: number;
    officialMMSm3?: number;
    gridVsMapRelDiff?: number;
  };
}

export interface ModelQcReport {
  items: QcItem[];
  bySection: Array<{ section: QcSection; title: string; items: QcItem[] }>;
  counts: Record<QcStatus, number>;
  /** the model cannot be handed over while this is false */
  readyForSimulation: boolean;
  verdict: string;
}

const pct = (v: number, d = 1) => (Number.isFinite(v) ? `${(v * 100).toFixed(d)}%` : '—');
const f = (v: number | undefined, d = 3) => (Number.isFinite(v as number) ? (v as number).toFixed(d) : '—');
const N = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—');

/**
 * Standing's Bo, wrapped onto the units this QC receives.
 *
 * The correlation itself lives in `fluid-model.ts` and is NOT reimplemented here — a
 * second copy is a second thing to keep right. What this wrapper adds is the unit
 * discipline the check depends on: Rs arrives in Sm³/Sm³ and Standing wants scf/stb,
 * and skipping that conversion reads Bo ≈ 1.16 instead of ≈ 1.54, inventing a 27%
 * PVT fault in a perfectly sound deck.
 *
 * Used ONLY as a consistency check on a delivered deck, never as a substitute for it:
 * a departure is a question to ask, not a defect to declare.
 */
export function standingBoFromSi(rsSm3Sm3: number, oilDensityKgM3: number, gasDensityKgM3: number, tempC: number): number {
  return standingBo(sm3ToScf(rsSm3Sm3), gasGravity(gasDensityKgM3), oilDensityKgM3 / 999.0, cToF(tempC));
}

/** API gravity from a standard-condition oil density. */
export const apiGravity = (kgM3: number) => oilApi(kgM3);

export function auditModel(a: ModelQcInput): QcItem[] {
  const items: QcItem[] = [];
  const add = (i: QcItem) => items.push(i);

  // ══ A · INPUT DATA ═══════════════════════════════════════════════════════
  add({
    id: 'data.wells', section: 'data', label: 'Well coverage',
    status: a.data.wellsUpscaled >= 8 ? 'pass' : a.data.wellsUpscaled >= 3 ? 'flag' : 'fail',
    finding: `${a.data.wellsUpscaled} of ${a.data.wellsTotal} bores blocked into the grid; ${a.data.wellsWithLogs} carry logs, ${a.data.wellsWithSurvey} carry a survey`,
    expected: 'every logged bore with a survey should reach the grid',
    consequence: a.data.wellsUpscaled >= 8 ? undefined : 'a property model conditioned on a handful of bores is an extrapolation everywhere else',
  });

  add({
    id: 'data.flowing', section: 'data', label: 'Flowing wells conditioned',
    status: (a.data.producersUpscaled === a.data.producers && a.data.injectorsUpscaled === a.data.injectors) ? 'pass' : 'fail',
    finding: `${a.data.producersUpscaled}/${a.data.producers} producers · ${a.data.injectorsUpscaled}/${a.data.injectors} injectors`,
    expected: 'all of them — these are the cells the history match moves fluid through',
    consequence: 'a flowing well that never conditioned a cell means the rock around a perforation was invented rather than measured',
  });

  // Mixed depth units are the single most expensive defect this delivery carries: 19
  // of 24 logs are not in metres, and reading `md` raw put them 1000× too deep.
  add({
    id: 'data.units', section: 'data', label: 'Depth-unit consistency',
    status: a.data.depthUnits.length <= 1 ? 'pass' : 'flag',
    finding: a.data.depthUnits.length <= 1
      ? `all logs in ${a.data.depthUnits[0]?.[0] ?? 'm'}`
      : `${a.data.depthUnits.length} different declared units: ${a.data.depthUnits.map(([u, n]) => `${u}×${n}`).join(' · ')}`,
    expected: 'one unit, or every reader converting per log',
    consequence: a.data.depthUnits.length <= 1 ? undefined : 'any consumer reading md raw places those bores three orders of magnitude out of position; the conversion must be per-log, never global',
    action: a.data.depthUnits.length <= 1 ? undefined : 'convert via depthToMetres(log.depth_unit) at every read site',
  });

  add({
    id: 'data.curves', section: 'data', label: 'Curve coverage',
    status: a.data.curveCoverage.some((c) => c.family === 'RHOB' && c.wells > 0) ? 'pass' : 'fail',
    finding: a.data.curveCoverage.map((c) => `${c.family} ${c.wells}`).join(' · ') || 'none',
    expected: 'GR + RHOB at minimum; RT for saturation',
    consequence: 'without a porosity curve there is no interpretation to upscale',
  });

  add({
    id: 'data.samples', section: 'data', label: 'Log sample count',
    status: a.data.logSamples > 10000 ? 'pass' : 'flag',
    finding: `${N(a.data.logSamples)} interpreted samples`,
  });

  // Areal conditioning is the honest measure of how much of the model is data and how
  // much is simulation. On a field drilled into the crest it is always small, and
  // saying so is the difference between a model and a claim.
  add({
    id: 'data.spatial', section: 'data', label: 'Areal conditioning density',
    status: a.data.conditionedColumnFraction >= 0.05 ? 'pass' : 'flag',
    finding: `${pct(a.data.conditionedColumnFraction, 2)} of active columns contain or adjoin an upscaled cell`,
    expected: 'no threshold is meaningful — this is context for every property map',
    consequence: 'the remainder is geostatistical extrapolation from crestal wells into flank rock nobody logged',
  });

  // ══ THE CHECK THAT WOULD HAVE CAUGHT THE BIGGEST ERROR IN THIS MODEL ══
  //
  // A directional survey reports TVD below the DRILLING DATUM — the kelly bushing.
  // Horizon grids, fluid contacts and formation picks are all TVD SUB-SEA. The two
  // differ by the rig-floor elevation, and using one for the other moves every log
  // sample in every well by exactly that amount.
  //
  // On Volve it was a flat 54.9 m, and because it was flat NOTHING looked wrong: the
  // structure tied, the petrophysics was right, every well was displaced identically.
  // What it did was drop F-14's entire Hugin through the bottom of the gridded zone —
  // 1,049 samples silently reported as "no layer" — leaving the Heather above it to
  // condition the model at φ 0.019 instead of the Hugin's 0.234. Net-to-gross read
  // 0.329 against a true 0.773 and the STOIIP came out at a quarter of the published
  // figure. A single subtraction, and no individual check failing.
  if (a.data.datum) {
    const d = a.data.datum;
    const bad = d.meanAbsErrM > 5;
    add({
      id: 'data.datum', section: 'data', label: 'Depth datum (TVD vs TVDSS)',
      status: !d.kbApplied ? 'fail' : bad ? 'fail' : 'pass',
      finding: !d.kbApplied
        ? 'the rig-floor elevation is NOT subtracted — survey TVD is being used as TVDSS'
        : `survey TVDSS agrees with the picked TVDSS to ${d.meanAbsErrM.toFixed(2)} m over ${N(d.n)} picks` +
          (d.worstWell ? ` (worst ${d.worstWell} ${d.worstErrM?.toFixed(0)} m)` : ''),
      expected: 'TVDSS = survey TVD − kelly-bushing elevation, agreeing with the delivery’s own picks to a metre or two',
      consequence: (!d.kbApplied || bad)
        ? 'every log sample is displaced vertically by the rig-floor height, so the blocking puts each well’s reservoir in the wrong zone — uniformly, which is why nothing else fails'
        : undefined,
      action: (!d.kbApplied || bad) ? 'subtract index.wells[].kb from every survey station before using tvd as tvdss' : undefined,
    });
  }

  add({
    id: 'data.crs', section: 'data', label: 'Coordinate reference system',
    status: a.data.crs ? 'pass' : 'absent',
    finding: a.data.crs ? String(a.data.crs) : 'no CRS declared in the delivery index',
    consequence: a.data.crs ? undefined : 'wells, surfaces and the grid cannot be proven to share a frame',
  });

  // ══ B · GEOMETRY ═════════════════════════════════════════════════════════
  const g = a.geometry;
  add({
    id: 'geom.size', section: 'geometry', label: 'Grid dimensions',
    status: 'pass',
    finding: `${g.nx} × ${g.ny} × ${g.nz} = ${N(g.cells)} cells · ${N(g.activeCells)} active (${pct(g.activeCells / g.cells)}) · ${N(g.liveCells)} with positive thickness`,
  });

  add({
    id: 'geom.negative', section: 'geometry', label: 'Negative-volume cells',
    status: g.negativeCells === 0 ? 'pass' : 'fail',
    finding: g.negativeCells === 0 ? 'none' : `${N(g.negativeCells)} cells have their base above their top`,
    expected: 'zero — always',
    consequence: g.negativeCells === 0 ? undefined : 'negative pore volume; the simulator rejects the deck or initialises with negative fluid in place',
  });

  add({
    id: 'geom.zero', section: 'geometry', label: 'Zero-thickness cells',
    status: g.zeroCells === 0 ? 'pass' : 'fail',
    finding: g.zeroCells === 0 ? 'none' : `${N(g.zeroCells)} degenerate cells`,
    consequence: g.zeroCells === 0 ? undefined : 'transmissibility divides by the cell thickness',
  });

  add({
    id: 'geom.pinch', section: 'geometry', label: 'Pinch-outs and aspect ratio',
    status: (g.pinchCells + g.highAspectCells) === 0 ? 'pass' : 'flag',
    finding: `${N(g.pinchCells)} cells below the thickness floor · ${N(g.highAspectCells)} beyond 100:1 areal-to-vertical`,
    consequence: (g.pinchCells + g.highAspectCells) === 0 ? undefined : 'thin and high-aspect cells shrink the stable timestep and make the pressure solve ill-conditioned',
  });

  add({
    id: 'geom.stacking', section: 'geometry', label: 'Zone stacking and order',
    status: (g.stackingDefects + g.orderDefects) === 0 ? 'pass' : 'fail',
    finding: (g.stackingDefects + g.orderDefects) === 0
      ? 'consecutive zones share their surface, and every zone lies below the one above'
      : `${N(g.stackingDefects)} overlap/gap column-pairs · ${N(g.orderDefects)} inverted`,
    consequence: (g.stackingDefects + g.orderDefects) === 0 ? undefined : 'an overlap counts rock twice, a gap loses it, and an inversion connects k-direction cells in the wrong order',
  });

  add({
    id: 'geom.bodies', section: 'geometry', label: 'Areal connectivity',
    status: g.bodies <= 1 ? 'pass' : 'flag',
    finding: g.bodies <= 1 ? 'one connected body' : `${g.bodies} disconnected bodies`,
    consequence: g.bodies <= 1 ? undefined : 'an isolated body cannot be reached by any well; its volume will report as a permanent shortfall',
  });

  // A repair is a legitimate operation that INVENTS ROCK. It must appear on the QC
  // sheet next to the volume, not be absorbed into it.
  add({
    id: 'geom.repair', section: 'geometry', label: 'Structural repair applied',
    status: g.repairedColumns === 0 ? 'pass' : g.repairAddedFraction > 0.02 ? 'flag' : 'pass',
    finding: g.repairedColumns === 0
      ? 'none needed'
      : `${N(g.repairedColumns)} columns rebuilt from the zone isochore, adding ${pct(g.repairAddedFraction, 2)} of the repaired zones' bulk volume`,
    expected: 'the base moves, never the top; added volume under ~2%',
    consequence: g.repairedColumns === 0 ? undefined : 'the added rock is a modelling decision, not a measurement — it belongs in the uncertainty on the STOIIP',
  });

  add({
    id: 'geom.faults', section: 'geometry', label: 'Faults',
    status: g.unfaulted ? 'flag' : 'pass',
    finding: g.unfaulted ? 'UNFAULTED vertical-pillar grid — no fault planes, no closure polygon' : 'faulted grid',
    consequence: g.unfaulted ? 'the model fills every column whose top is above the contact across the whole mapped area, rather than a fault-bounded trap; this is the dominant control on GRV' : undefined,
  });

  // ══ C · FACIES ═══════════════════════════════════════════════════════════
  const fa = a.facies;
  const sandDrift = fa.realisationSandFraction - fa.conditioningSandFraction;
  add({
    id: 'facies.count', section: 'facies', label: 'Facies scheme',
    status: fa.count >= 2 ? 'pass' : 'fail',
    finding: `${fa.count} facies (sand / shale)`,
    expected: 'a scheme rich enough to carry the flow units the history match will need',
    consequence: fa.count > 2 ? undefined : 'a two-facies scheme cannot express a cemented streak or a baffle, so every barrier the match needs will have to come from permeability multipliers instead',
  });

  add({
    id: 'facies.conditioning', section: 'facies', label: 'Conditioning data',
    status: fa.conditioningCells >= 100 ? 'pass' : fa.conditioningCells >= 30 ? 'flag' : 'fail',
    finding: `${N(fa.conditioningCells)} upscaled cells condition the indicator simulation`,
    consequence: fa.conditioningCells >= 100 ? undefined : 'too few data to constrain an indicator variogram; the realisation is close to unconditional',
  });

  add({
    id: 'facies.proportion', section: 'facies', label: 'Proportion reproduction',
    status: Math.abs(sandDrift) <= 0.05 ? 'pass' : 'flag',
    finding: `conditioning ${pct(fa.conditioningSandFraction)} sand → realisation ${pct(fa.realisationSandFraction)} (drift ${sandDrift >= 0 ? '+' : ''}${pct(sandDrift)})`,
    expected: 'within ±5% — SIS targets the conditioning proportion',
    consequence: Math.abs(sandDrift) <= 0.05 ? undefined : 'the wells are not areally representative of the volume being filled',
  });

  add({
    id: 'facies.resolution', section: 'facies', label: 'Simulation resolution',
    status: fa.simNodes >= fa.modelNx ? 'pass' : 'flag',
    finding: `simulated on ${fa.simNodes} × ${fa.simNodes} nodes, upsampled to ${fa.modelNx} areal cells`,
    expected: 'the simulation grid should approach the model grid',
    consequence: fa.simNodes >= fa.modelNx ? undefined : 'the property field carries only the coarse grid\'s spatial detail; small-scale heterogeneity a history match may need is not there to find',
  });

  add({
    id: 'facies.coverage', section: 'facies', label: 'Layers with a realisation',
    status: fa.simulatedLayers > 0 ? 'pass' : 'fail',
    finding: `${fa.simulatedLayers} of ${fa.totalLayers} layers modelled${fa.unconditionedLayers ? `; ${fa.unconditionedLayers} borrowed conditioning from the whole model` : ''}`,
    expected: 'the reservoir interval — modelling the overburden is wasted work and pollutes every statistic',
  });

  // ══ D · PETROPHYSICS ═════════════════════════════════════════════════════
  const pp = a.petrophysics;
  add({
    id: 'petro.range', section: 'petrophysics', label: 'Porosity within physical range',
    status: pp.phiMin >= 0 && pp.phiMax <= 0.45 ? 'pass' : 'flag',
    finding: `φ spans ${f(pp.phiMin)} – ${f(pp.phiMax)}`,
    expected: '0 to ~0.40 for a clastic reservoir',
    consequence: pp.phiMax <= 0.45 ? undefined : 'a porosity beyond the physical packing limit is an unresolved null or a bad matrix density, not rock',
  });

  const blockBias = pp.upscaledPhiMean - pp.logPhiMean;
  const simBias = pp.simulatedPhiMean - pp.upscaledPhiMean;
  add({
    id: 'petro.chain', section: 'petrophysics', label: 'Porosity through the chain',
    status: Math.abs(simBias) / Math.max(1e-6, pp.upscaledPhiMean) <= 0.15 ? 'pass' : 'flag',
    finding: `log ${f(pp.logPhiMean)} → upscaled ${f(pp.upscaledPhiMean)} (${blockBias >= 0 ? '+' : ''}${f(blockBias)}) → simulated ${f(pp.simulatedPhiMean)} (${simBias >= 0 ? '+' : ''}${f(simBias)})`,
    expected: 'SGS reproduces the conditioning histogram, so the last step should be small',
    consequence: 'a drift means the conditioning set and the simulated volume describe different rock',
  });

  // THE check a petrophysicist looks for first. Net porosity is what is quoted in
  // every report; gross porosity is what an unweighted block average produces, and
  // the two differ by the shale fraction.
  const netGap = pp.netPhiMean - pp.upscaledPhiMean;
  add({
    id: 'petro.net', section: 'petrophysics', label: 'Net vs gross porosity',
    status: Math.abs(netGap) <= 0.02 ? 'pass' : 'flag',
    finding: `net-rock φ ${f(pp.netPhiMean)} vs blocked φ ${f(pp.upscaledPhiMean)} — a gap of ${f(netGap)}`,
    expected: 'the model should carry NET porosity alongside a net-to-gross, not a gross average',
    consequence: Math.abs(netGap) <= 0.02 ? undefined : 'the blocked average mixes net sand with shale; used together with a net-to-gross it counts the shale reduction twice',
    action: Math.abs(netGap) <= 0.02 ? undefined : 'block porosity net-weighted and carry the net fraction as its own property',
  });

  // Archie's constants are multiplicative and compound: a, m, n and Rw each move the
  // saturation, so a textbook set applied to a field that published its own is not a
  // small approximation. Volve's evaluation fits m against permeability and measures
  // the brine directly, and the defaults put the median Sw at 1.000 — water everywhere.
  if (pp.archieSource) {
    add({
      id: 'petro.archie', section: 'petrophysics', label: 'Archie constants',
      status: pp.archieSource === 'published' ? 'pass' : 'fail',
      finding: pp.archie
        ? `a ${f(pp.archie.a, 2)} · m ${f(pp.archie.m, 3)} · n ${f(pp.archie.n, 2)} · Rw ${f(pp.archie.rw, 4)} Ω·m — ${pp.archieSource === 'published' ? `from the delivery${pp.archieProvenance ? ` (${pp.archieProvenance})` : ''}` : 'TEXTBOOK DEFAULTS'}`
        : String(pp.archieSource),
      expected: "the delivery's own evaluation where it publishes one, with Rw converted to formation temperature",
      consequence: pp.archieSource === 'published' ? undefined
        : "a generic sandstone's constants produce a saturation for a generic sandstone; every net-pay cutoff downstream then throws away the wrong rock",
      action: pp.archieSource === 'published' ? undefined : 'resolvePublishedArchie(DEFAULT_PARAMS, index.shf.archie, reservoirTempC)',
    });
  }

  if (Number.isFinite(pp.publishedPhi as number)) {
    const r = pp.netPhiMean / (pp.publishedPhi as number);
    add({
      id: 'petro.published', section: 'petrophysics', label: 'Porosity vs published',
      status: r > 0.85 && r < 1.15 ? 'pass' : 'flag',
      finding: `net-rock φ ${f(pp.netPhiMean)} vs published ${f(pp.publishedPhi)} = ${r.toFixed(2)}×`,
      expected: 'the comparison must be net against net',
      consequence: 'comparing a gross model average against a published net figure will always look like a 2× error that is not there',
    });
  }

  // ══ E · PERMEABILITY ═════════════════════════════════════════════════════
  const pm = a.permeability;
  add({
    id: 'perm.transform', section: 'permeability', label: 'φ–k transform',
    status: pm.fitted ? 'pass' : 'flag',
    finding: pm.fitted ? 'fitted to measured permeability' : 'ANALOGUE coefficients — no core or permeability curve in the delivery to fit against',
    consequence: pm.fitted ? undefined : 'permeability is the most uncertain input to a history match, and here it rests on an assumed relationship',
  });

  const cappedFrac = pm.simulatedCells > 0 ? pm.cappedCells / pm.simulatedCells : 0;
  add({
    id: 'perm.range', section: 'permeability', label: 'Permeability within physical range',
    status: cappedFrac === 0 ? 'pass' : cappedFrac < 0.02 ? 'flag' : 'fail',
    finding: cappedFrac === 0
      ? `none capped; max ${N(pm.maxMd)} mD`
      : `${N(pm.cappedCells)} cells (${pct(cappedFrac, 2)} of those simulated) hit the ${N(pm.ceilingMd)} mD ceiling`,
    expected: 'a log-linear transform is unbounded; it must only be evaluated over the porosity range it was calibrated on',
    consequence: cappedFrac === 0 ? undefined : 'a capped value is an admission, not a measurement',
  });

  // Permeability is log-distributed. Quoting its arithmetic mean describes no cell in
  // the model, and the ratio between the two averages is the fastest way to show it.
  const meanRatio = pm.geoMeanMd > 0 ? pm.arithMeanMd / pm.geoMeanMd : NaN;
  add({
    id: 'perm.average', section: 'permeability', label: 'Averaging convention',
    status: 'pass',
    finding: `geometric ${f(pm.geoMeanMd, 1)} mD vs arithmetic ${f(pm.arithMeanMd, 1)} mD — a factor of ${f(meanRatio, 0)}; upscaling used the ${pm.upscaleAverage} average`,
    expected: 'k is not additive — quote the geometric mean, and state which average the upscaling used',
    consequence: 'reporting the arithmetic mean of a log-distributed property describes no cell that exists',
  });

  add({
    id: 'perm.kv', section: 'permeability', label: 'Vertical permeability',
    status: !pm.hasPermZ ? 'fail' : pm.kvkhSource === 'measured' ? 'pass' : 'flag',
    finding: !pm.hasPermZ ? 'no PERMZ produced' : `kv/kh = ${f(pm.kvkh, 2)}, ${pm.kvkhSource}, uniform across every facies and layer`,
    expected: 'kv/kh from core or a vertical interference test, and varying by facies',
    consequence: !pm.hasPermZ
      ? 'without kv the simulator cannot compute vertical flow at all — coning, gravity segregation and layer communication are unmodellable'
      : 'a single assumed ratio is one of the first parameters a history match will move, so it should be declared as a tuning handle rather than a property',
  });

  // ══ F · PVT ══════════════════════════════════════════════════════════════
  const v = a.pvt;
  const havePvt = Number.isFinite(v.bo as number) && Number.isFinite(v.rs as number);
  add({
    id: 'pvt.present', section: 'pvt', label: 'PVT present',
    status: havePvt ? 'pass' : 'absent',
    finding: havePvt
      ? `Bo ${f(v.bo, 2)} · Rs ${f(v.rs, 0)} Sm³/Sm³ · Pb ${f(v.pb, 0)} · Pi ${f(v.pi, 0)} bara · T ${f(v.tempC, 0)} °C`
      : 'no PVT in the delivery',
    consequence: havePvt ? undefined : 'no initialisation is possible without a fluid description',
  });
  if (v.source) {
    add({
      id: 'pvt.source', section: 'pvt', label: 'PVT provenance',
      status: 'pass', finding: v.source,
      expected: 'a named source — a deck, a report or a lab study',
    });
  }

  if (Number.isFinite(v.pb as number) && Number.isFinite(v.pi as number)) {
    const under = (v.pi as number) > (v.pb as number);
    add({
      id: 'pvt.saturation', section: 'pvt', label: 'Saturation state',
      status: 'pass',
      finding: under
        ? `UNDERSATURATED — Pi ${f(v.pi, 0)} is ${f((v.pi as number) - (v.pb as number), 0)} bar above Pb ${f(v.pb, 0)}`
        : `SATURATED or gas-capped — Pi ${f(v.pi, 0)} is at or below Pb ${f(v.pb, 0)}`,
      expected: 'consistent with whether the model declares a gas cap',
      consequence: under
        ? 'no free gas at initialisation; a GOC in the structural model would contradict this'
        : 'free gas at initialisation — the model must carry a GOC and a gas saturation',
    });
  }

  // Bo against Standing. A consistency question, not a verdict — real oils depart from
  // the correlation, and the check exists to catch a Bo that belongs to a different
  // fluid or a units error, not to overrule a laboratory.
  if (havePvt && Number.isFinite(v.oilDensityKgM3 as number) && Number.isFinite(v.gasDensityKgM3 as number) && Number.isFinite(v.tempC as number)) {
    const bStanding = standingBoFromSi(v.rs as number, v.oilDensityKgM3 as number, v.gasDensityKgM3 as number, v.tempC as number);
    const ratio = (v.bo as number) / bStanding;
    const api = apiGravity(v.oilDensityKgM3 as number);
    add({
      id: 'pvt.correlation', section: 'pvt', label: 'Bo vs Standing correlation',
      status: ratio > 0.88 && ratio < 1.12 ? 'pass' : 'flag',
      finding: `deck Bo ${f(v.bo, 2)} vs Standing ${f(bStanding, 2)} at Rs ${f(v.rs, 0)} Sm³/Sm³ (${N((v.rs as number) * 5.6146)} scf/stb), ${f(api, 1)}°API, ${f(v.tempC, 0)} °C = ${ratio.toFixed(2)}×`,
      expected: 'within roughly ±12% — the deck value should be BELOW the saturated correlation if the oil is undersaturated at datum',
      consequence: ratio > 0.88 && ratio < 1.12 ? undefined : 'a Bo that does not sit near its own Rs, gravity and temperature usually means a units error or a fluid from a different sample',
    });
  }

  add({
    id: 'pvt.densities', section: 'pvt', label: 'Surface densities',
    status: Number.isFinite(v.oilDensityKgM3 as number) && Number.isFinite(v.waterDensityKgM3 as number) ? 'pass' : 'absent',
    finding: Number.isFinite(v.oilDensityKgM3 as number)
      ? `oil ${f(v.oilDensityKgM3, 0)} (${f(apiGravity(v.oilDensityKgM3 as number), 1)}°API) · water ${f(v.waterDensityKgM3, 0)} · gas ${f(v.gasDensityKgM3, 3)} kg/m³`
      : 'not declared',
    consequence: 'densities set the fluid gradients, so they set where the model places the contact under equilibration',
  });

  add({
    id: 'pvt.rock', section: 'pvt', label: 'Rock compressibility',
    status: Number.isFinite(v.rockCf as number) ? 'pass' : 'absent',
    finding: Number.isFinite(v.rockCf as number)
      ? `cf ${(v.rockCf as number).toExponential(1)} /bar at ${f(v.rockPrefBara, 0)} bara`
      : 'no rock compressibility',
    consequence: Number.isFinite(v.rockCf as number) ? undefined : 'an undersaturated reservoir above bubble point depletes almost entirely on rock and fluid compressibility — without cf the early pressure history cannot match',
  });

  // ══ G · SATURATION-HEIGHT ════════════════════════════════════════════════
  const s = a.saturation;
  // An SHF that EXISTS but is not read by the static model is a wiring gap, not
  // missing science. Reporting it as simply "absent" would hide work already done and
  // send someone to rebuild it.
  add({
    id: 'sat.shf', section: 'saturation', label: 'Saturation-height function',
    status: !s.shfPresent ? 'absent' : s.shfWiredToGrid ? 'pass' : 'flag',
    finding: !s.shfPresent
      ? 'no saturation-height function anywhere in the project'
      : s.shfWiredToGrid
        ? `SHF defined and consumed by the grid — ${s.shfSource ?? 'source not stated'}`
        : `SHF EXISTS BUT IS NOT WIRED TO THE STATIC GRID — ${s.shfSource ?? 'source not stated'}`,
    expected: 'Sw as a function of height above the free-water level and rock quality, read by the property model',
    // `shfWiredToGrid` only means anything once an SHF exists — consulting it first
    // let a model with NO function at all report no consequence, because the stale
    // "wired" flag silenced it.
    consequence: !s.shfPresent
      ? 'without an SHF the model has no transition zone and no way to make saturation depend on permeability, so free-water level and initial oil in place are decoupled from rock quality'
      : s.shfWiredToGrid ? undefined
        : 'the science is done and the grid ignores it; the volume calculation still has no transition zone even though the curve to build one is available',
    action: !s.shfPresent
      ? 'fit a J-function to the log-derived Sw against height above contact, per facies'
      : s.shfWiredToGrid ? undefined
        : 'call the existing swAtHeight() per cell using height above the free-water level and the cell permeability',
  });

  add({
    id: 'sat.scal', section: 'saturation', label: 'Relative permeability / SCAL',
    status: s.scalPresent ? 'pass' : 'absent',
    finding: s.scalPresent
      ? `kr and Pc description available — ${s.scalSource ?? 'source not stated'}`
      : 'no SCAL description',
    expected: 'kr curves and a capillary-pressure curve the simulator can read as SWOF',
    consequence: s.scalPresent ? undefined : 'no two-phase flow without kr',
  });

  add({
    id: 'sat.property', section: 'saturation', label: '3D water saturation',
    status: s.modelled ? 'pass' : 'fail',
    finding: s.modelled
      ? 'Sw carried as a 3D property'
      : `NOT MODELLED — the volume calculation applies a constant Sw = ${f(s.constantUsed, 3)} to every cell above the contact`,
    expected: 'Sw simulated or computed per cell',
    consequence: s.modelled ? undefined : 'a constant Sw makes the crest and the cell immediately above the contact identical; there is no transition zone and the STOIIP carries an error no history match can absorb cleanly',
  });

  if (Number.isFinite(s.netSwMean as number) && Number.isFinite(s.constantUsed as number)) {
    const d = (s.constantUsed as number) - (s.netSwMean as number);
    add({
      id: 'sat.vs-logs', section: 'saturation', label: 'Constant Sw vs log-derived',
      status: Math.abs(d) <= 0.05 ? 'pass' : 'flag',
      finding: `constant ${f(s.constantUsed)} vs net-rock log Sw ${f(s.netSwMean)} (Δ ${d >= 0 ? '+' : ''}${f(d)})`,
      expected: 'the constant, if used at all, should at least equal the net-rock average it stands in for',
      consequence: 'the conditioning data for a real Sw model already exists — it is simply not used',
    });
  }

  if (Number.isFinite(s.contactTvdss as number) && Number.isFinite(s.crestTvdss as number)) {
    const column = (s.contactTvdss as number) - (s.crestTvdss as number);
    add({
      id: 'sat.column', section: 'saturation', label: 'Hydrocarbon column',
      status: column > 0 ? 'pass' : 'fail',
      finding: `crest ${f(s.crestTvdss, 0)} m, contact ${f(s.contactTvdss, 0)} m → ${f(column, 0)} m column`,
      expected: 'a positive column, and one an SHF would resolve into a transition zone',
      consequence: column > 0 ? undefined : 'the contact lies above the crest — there is no accumulation',
    });
  }

  // ══ H · CROSS-DISCIPLINE CONSISTENCY ═════════════════════════════════════
  //
  // The errors that survive a review live here.
  add({
    id: 'cons.ntg', section: 'consistency', label: 'Net-to-gross definition',
    status: pp.ntgSource === 'net-cutoff' ? 'pass' : 'fail',
    finding: pp.ntgSource === 'net-cutoff'
      ? `NTG ${f(pp.ntgUsed)} from the petrophysical cutoffs`
      : `the volume calculation uses NTG ${f(pp.ntgUsed)} from ${pp.ntgSource === 'binary-facies' ? 'the BINARY FACIES CODE' : 'a constant'}, while the petrophysics measures a net fraction of ${f(pp.netFraction)}`,
    expected: 'one definition of net rock, shared by the petrophysicist and the modeller',
    consequence: pp.ntgSource === 'net-cutoff' ? undefined : 'two disciplines are using different definitions of the same quantity; the facies code marks sand, the cutoff marks PAY, and they are not interchangeable',
    action: pp.ntgSource === 'net-cutoff' ? undefined : 'model the net fraction as its own property and drop the facies-as-NTG shortcut',
  });

  add({
    id: 'cons.sw', section: 'consistency', label: 'Saturation source',
    status: s.modelled ? 'pass' : 'fail',
    finding: s.modelled
      ? 'the volume calculation reads the same Sw the property model built'
      : `the property model builds φ and facies in 3D but the volume calculation supplies its own constant Sw = ${f(s.constantUsed, 3)}`,
    expected: 'every term in the volume equation comes from the model',
    consequence: s.modelled ? undefined : 'a volume computed from a mixture of modelled and assumed terms cannot be attributed when it disagrees with the field',
  });

  if (Number.isFinite(v.datumTvdss as number) && Number.isFinite(s.contactTvdss as number)) {
    const d = Math.abs((v.datumTvdss as number) - (s.contactTvdss as number));
    add({
      id: 'cons.datum', section: 'consistency', label: 'PVT datum vs fluid contact',
      status: d <= 100 ? 'pass' : 'flag',
      finding: `PVT datum ${f(v.datumTvdss, 0)} m vs contact ${f(s.contactTvdss, 0)} m — ${f(d, 0)} m apart`,
      expected: 'the datum should sit within the reservoir interval it describes',
      consequence: d <= 100 ? undefined : 'Bo and Rs quoted at a datum far from the contact will not describe the fluid where the model initialises it',
    });
  }

  add({
    id: 'cons.permavg', section: 'consistency', label: 'Permeability average vs reported mean',
    status: 'pass',
    finding: `upscaling used the ${pm.upscaleAverage} average; the report quotes the geometric mean`,
    expected: 'the average used to build the property and the average used to describe it should be stated together',
  });

  if (a.volumes && Number.isFinite(a.volumes.gridVsMapRelDiff as number)) {
    const d = a.volumes.gridVsMapRelDiff as number;
    add({
      id: 'cons.volume', section: 'consistency', label: 'Grid vs map volume',
      status: Math.abs(d) <= 0.10 ? 'pass' : 'flag',
      finding: `${pct(Math.abs(d))} between the cell-by-cell summation and the averaged form`,
      expected: 'within 10% — a larger gap means the averages do not represent the cells',
    });
  }

  if (a.volumes && Number.isFinite(a.volumes.officialMMSm3 as number)) {
    const r = a.volumes.stoiipMMSm3 / (a.volumes.officialMMSm3 as number);
    add({
      id: 'cons.published', section: 'consistency', label: 'STOIIP vs published',
      status: r > 0.7 && r < 1.4 ? 'pass' : 'flag',
      finding: `${f(a.volumes.stoiipMMSm3, 2)} vs published ${f(a.volumes.officialMMSm3, 2)} MMSm³ = ${r.toFixed(2)}×`,
      expected: 'the comparison is only meaningful against the accumulation the published figure accounts for',
      consequence: 'a model that does not reproduce the known in-place volume will not history-match without absorbing that error into its parameters',
    });
  }

  return items;
}

/**
 * Group, count and rule.
 *
 * The rule is deliberately strict: a `fail` OR a missing artifact both stop the
 * handover. A model can be internally consistent and still not be a simulation deck.
 */
export function summariseModelQc(items: QcItem[]): ModelQcReport {
  const counts: Record<QcStatus, number> = { pass: 0, flag: 0, fail: 0, absent: 0, 'n/a': 0 };
  for (const i of items) counts[i.status]++;

  const order: QcSection[] = ['data', 'geometry', 'facies', 'petrophysics', 'permeability', 'pvt', 'saturation', 'consistency'];
  const bySection = order
    .map((section) => ({ section, title: SECTION_TITLE[section], items: items.filter((i) => i.section === section) }))
    .filter((s) => s.items.length > 0);

  const ready = counts.fail === 0 && counts.absent === 0;
  const verdict = counts.fail > 0
    ? `NOT READY — ${counts.fail} check${counts.fail === 1 ? '' : 's'} failed. The model cannot be initialised until they are fixed.`
    : counts.absent > 0
      ? `CONDITIONAL — nothing measured is wrong, but ${counts.absent} required artifact${counts.absent === 1 ? ' is' : 's are'} not produced at all.`
      : counts.flag > 0
        ? `READY WITH ${counts.flag} FLAG${counts.flag === 1 ? '' : 'S'} — usable for simulation provided each flag is carried into the history-match plan.`
        : 'READY — every check passed.';

  return { items, bySection, counts, readyForSimulation: ready, verdict };
}
