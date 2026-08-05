// The simulated agentic study run.
//
// This is a SIMULATION, and it says so on screen. It walks the nine stages in
// workflow order, emitting the same step sequence a real agent would emit —
// resolve scope → read the named files → join → derive → emit a typed artifact —
// and it produces the real record counts audited from disk, so the shape of the
// run is honest even though no engine has executed yet.
//
// Two reasons to build it now rather than after the charts:
//   1. It proves the artifact graph. Every stage declares what it consumed, so the
//      lineage claim in the concept doc becomes something you can watch happen.
//   2. It is the seam. When the deterministic engines land, each `steps` array is
//      replaced by a real call and `finding` by that engine's output. Nothing else
//      in the shell changes.
//
// Determinism matters: no Date.now(), no Math.random(). The same scope produces
// the same run every time, which is what makes it replayable and testable.
import type { Provenance } from '../../viz/palette';

export interface RunStep {
  label: string;
  detail: string;
  /** Dwell in ms. Longer for the steps that would genuinely cost something. */
  ms: number;
}

export interface StagePlan {
  stageId: string;
  artifact: string;
  provenance: Provenance;
  n: number;
  /** Stage ids consumed. This is the study DAG, declared rather than implied. */
  inputs: string[];
  steps: RunStep[];
  /** Deterministic, templated. `{scope}` is the only substitution. */
  finding: (scope: string) => string;
}

const s = (label: string, detail: string, ms = 520): RunStep => ({ label, detail, ms });

export const STUDY_PLAN: StagePlan[] = [
  {
    stageId: 'atlas-benchmark',
    artifact: 'BasinBenchmark',
    provenance: 'SOURCED',
    n: 7787,
    inputs: [],
    steps: [
      s('Resolve scope', 'Matching the scope against the 17,302-record OSDU catalogue', 420),
      s('Read provinces', 'world/provinces.geojson — 179 assessed province polygons', 560),
      s('Read field layer', 'cockpit-points.geojson 7,787 points · reserve-towers 3,861 MMBOE', 700),
      s('Spatial join', 'Intersecting field centroids with province polygons — 5,106 matched (65.6%)', 780),
      s('Rank peer set', 'Percentile position on 6 axes against 179 provinces', 520),
      s('Emit BasinBenchmark', 'SOURCED · n=7,787 · no inference in this artifact', 400),
    ],
    finding: (scope) => `${scope} carries 445 catalogued fields, 145 of them with both a dated discovery and a reported volume — enough for a full creaming curve, which only 19 of 179 provinces can support.`,
  },
  {
    stageId: 'basin-framework',
    artifact: 'BasinFramework',
    provenance: 'RECALLED',
    n: 630,
    inputs: ['atlas-benchmark'],
    steps: [
      s('Read cycles', 'master-kb-spine.basinCycle — 630 cycles across all 179 basins', 600),
      s('Bind timescale', 'ICS 2026/06, 12 period boundaries', 380),
      s('Grade provenance', '626 of 630 cycles are literature-recalled; 4 interpreted', 700),
      s('Read completion ledger', 'basinCompletion 179 rows — completion_pct, primary_gap', 480),
      s('Emit BasinFramework', 'RECALLED · n=630 · time-scaled, NOT depth-scaled (no thickness on disk)', 420),
    ],
    finding: (scope) => `${scope} resolves to 4 tectonic cycles on the ICS axis — but 626 of the 630 cycles in the corpus are literature-recalled, so this framework is a hypothesis to verify, not a source to cite.`,
  },
  {
    stageId: 'basin-analogs',
    artifact: 'BasinAnalogSet',
    provenance: 'RECALLED',
    n: 179,
    inputs: ['basin-framework', 'atlas-benchmark'],
    steps: [
      s('Build signature', '9 axes: geodynamic sequence · setting · fill · lithology · span · role profile · timing · endowment · realisation', 720),
      s('Score 179 basins', 'Levenshtein on cycle order, Jaccard on fill and lithology, cosine on role profile', 820),
      s('Decompose similarity', 'Per-axis contribution so every match can be explained, not just ranked', 560),
      s('Pool priors', 'Field-size lognormal, discovery cadence and offshore share across the cohort', 640),
      s('Emit BasinAnalogSet', 'RECALLED · n=179 · cohort grade capped by the worst input', 400),
    ],
    finding: (scope) => `The 8 nearest analogues to ${scope} share its extensional cycle order; the match degrades on fill, which is where the pooled priors should be trusted least.`,
  },
  {
    stageId: 'strat-depositional',
    artifact: 'StratigraphicFramework',
    provenance: 'RECALLED',
    n: 1544,
    inputs: ['basin-framework'],
    steps: [
      s('Read elements', 'psElement 1,544 bars — source 457 · reservoir 591 · seal 281 · overburden 215', 680),
      s('Resolve formations', 'formation 618 canonical names, 5 aliases each on average', 520),
      s('Parse authority text', 'essential_elements_note across 211 systems — source / reservoir / traps-seals clauses', 760),
      s('Grade effectiveness', 'Most intervals are not-assessed — hatched, never rendered as a filled claim', 480),
      s('Emit StratigraphicFramework', 'RECALLED · n=1,544', 400),
    ],
    finding: (scope) => `${scope} has reservoir bars outnumbering source bars 591:457 corpus-wide — the seal record is the thinnest of the four roles and the one most likely to be the real risk.`,
  },
  {
    stageId: 'basin-model',
    artifact: 'ChargeTimingCase',
    provenance: 'SOURCED',
    n: 1484,
    inputs: ['strat-depositional', 'basin-framework'],
    steps: [
      s('Read events', 'psEvent 1,484 — a complete 7 × 212 grid, every system has all seven types', 700),
      s('Order the chart', 'Elements above, processes below, critical moment as the marker', 520),
      s('Test timing', 'Does trap formation precede peak generation? Interval-overlap per system', 780),
      s('Skip burial model', 'No thickness, heat flow or calibration point on disk — the 1D track stays user-input', 620),
      s('Emit ChargeTimingCase', 'SOURCED · n=1,484 · burial half deliberately not populated', 400),
    ],
    finding: (scope) => `Trap formation predates peak generation in ${scope}'s modelled system, so timing is not the limiting factor — the burial half of this stage remains uncalibrated and is excluded from the artifact.`,
  },
  {
    stageId: 'play-fairway',
    artifact: 'PlayFairwayAssessment',
    provenance: 'DERIVED',
    n: 212,
    inputs: ['basin-model', 'strat-depositional', 'basin-analogs'],
    steps: [
      s('Score charge', 'Source bars present × generation certainty', 520),
      s('Score reservoir and seal', 'Element counts × effectiveness, per system', 560),
      s('Score trap', 'psEvent trap-formation certainty + the parsed traps/seals clause', 620),
      s('Import timing', 'The overlap boolean from ChargeTimingCase becomes the fifth factor', 440),
      s('Calibrate', '90 provinces with ≥3 dated discoveries — predicted chance vs an outcome PROXY', 800),
      s('Emit PlayFairwayAssessment', 'DERIVED · n=212 · matrix only, no gridded fairway (AUs have no geometry)', 420),
    ],
    finding: (scope) => `Four of five common-risk factors for ${scope} score on sourced evidence; trap is the one carried by narrative text alone, and no gridded fairway is possible until assessment-unit polygons are ingested.`,
  },
  {
    stageId: 'prospect-register',
    artifact: 'OpportunitySet',
    provenance: 'SOURCED',
    n: 339,
    inputs: ['play-fairway', 'atlas-benchmark'],
    steps: [
      s('Seed from USGS', '339 assessment units as statistical opportunities, carrying undiscovered means', 700),
      s('Badge the seeds', 'USGS STATISTICAL · not a mapped prospect — never shares a series with user rows', 480),
      s('Attach chance', 'Parent system CRS row joins to each opportunity', 520),
      s('Gate maturity', 'Lead → prospect → drill/drop, auto-ticked from evidence that actually exists', 560),
      s('Emit OpportunitySet', 'SOURCED · n=339 seeds + 2 user rows', 400),
    ],
    finding: (scope) => `${scope} contributes 3 assessment units to a 339-row register — every one a statistical opportunity, none a mapped prospect, and the badge keeps that distinction unmissable.`,
  },
  {
    stageId: 'volumetrics-risk',
    artifact: 'VolumetricCase',
    provenance: 'SOURCED',
    n: 3861,
    inputs: ['prospect-register', 'basin-analogs'],
    steps: [
      s('Read field sizes', 'reserve-towers 3,861 fields with a real MMBOE value', 640),
      s('Split reserve classes', '170+ raw strings — in-place is held apart from recoverable, never pooled', 820),
      s('Fit the prior', 'Log-space lognormal over the cohort; P90/P50/P10 from the empirical CDF', 700),
      s('Note the missing spread', 'USGS gives means only — no F95/F50/F5 — so no USGS-sourced probabilistic YTF', 620),
      s('Emit VolumetricCase', 'SOURCED · n=3,861 · empirical prior, discovery-biased by construction', 420),
    ],
    finding: (scope) => `The world median discovered field is 48.7 MMBOE; ${scope} sits below it, so the remaining running room here is a small-field tail rather than another giant.`,
  },
  {
    stageId: 'portfolio-ranking',
    artifact: 'ExplorationPortfolio',
    provenance: 'DERIVED',
    n: 339,
    inputs: ['volumetrics-risk', 'play-fairway', 'prospect-register'],
    steps: [
      s('Join chance and volume', 'CRS composite × VolumetricCase P50, per opportunity', 620),
      s('Rank', 'Bubble position, quadrant split at the portfolio median', 560),
      s('Apply capital', 'Assumed unit cost — badged ASSUMPTION, no cost data exists in the corpus', 660),
      s('Compose the record', 'Scope, pins, facets and the provenance grade of every upstream artifact', 700),
      s('Emit ExplorationPortfolio', 'DERIVED · n=339 · opportunities treated as independent (no dependency data)', 420),
    ],
    finding: (scope) => `The ranking for ${scope} is decision-grade on chance and volume but not on value: every EMV number rests on an assumed unit cost, and the decision record says so in its own header.`,
  },
];

export const planFor = (stageId: string) => STUDY_PLAN.find((p) => p.stageId === stageId);

/** Total simulated duration, for the progress bar. Computed, not guessed. */
export const RUN_TOTAL_STEPS = STUDY_PLAN.reduce((total, stage) => total + stage.steps.length, 0);
