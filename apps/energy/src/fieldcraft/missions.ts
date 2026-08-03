import type { Mission } from './types';

/**
 * Guided app missions — the eight labs the course promises.
 *
 * A mission is the seam between Fieldcraft and the real lifecycle workspaces:
 * it pins a data scope, walks an ordered set of steps, and captures a piece of
 * learner evidence at each one. The workspace itself is unmodified; the mission
 * rides alongside it as a HUD, so every vertical becomes a laboratory without
 * any of them having to know Fieldcraft exists.
 */
export const MISSIONS: Mission[] = [
  {
    id: 'm-d1-evidence', dayId: 'discover', dayNumber: 1, workspace: 'exploration',
    title: 'Build the evidence pack',
    brief: 'Assemble a traceable evidence pack for the opportunity, and label every number by the kind of truth it carries.',
    scope: 'Volve · Viking Graben · Hugin Formation',
    output: 'Evidence pack · truth-class matrix',
    steps: [
      { id: 's1', title: 'Locate the source records', detail: 'Work through the data and knowledge views until you can say where the field’s headline numbers actually came from.', evidence: 'Name three source records and the origin of each.' },
      { id: 's2', title: 'Classify by truth class', detail: 'Tag each number as measured, reported, interpreted, derived, forecast or scenario. The class travels with the number.', evidence: 'Give one number per truth class, with its classification.' },
      { id: 's3', title: 'Find the conflict', detail: 'Two sources will not agree. Record both values and work out what actually differs — method, cutoff or depth reference.', evidence: 'State the conflicting pair and your explanation for the difference.' },
      { id: 's4', title: 'Name the material gap', detail: 'A gap is a finding. Decide which absence most limits the decision rather than listing everything missing.', evidence: 'Name the single material gap and why it constrains the gate.' },
    ],
  },
  {
    id: 'm-d1-screen', dayId: 'discover', dayNumber: 1, workspace: 'exploration',
    title: 'Screen the opportunity',
    brief: 'Run the prepared risk and volumetric case, keeping chance of success and volume range on separate axes.',
    scope: 'Volve · prospect-level screening case',
    output: 'Exploration Gate Card',
    steps: [
      { id: 's1', title: 'Inspect the chance factors', detail: 'Review the petroleum-system elements and find which one dominates the combined chance.', evidence: 'Name the dominant risk element and its chance factor.' },
      { id: 's2', title: 'Read the volume range', detail: 'Record P90, P50 and P10, and confirm what the range is conditional on.', evidence: 'The three volumes, and the condition the range assumes.' },
      { id: 's3', title: 'Separate chance from range', detail: 'State the risked mean and show that it is not a point on the volume curve.', evidence: 'The risked mean and the arithmetic behind it.' },
      { id: 's4', title: 'Record the gate call', detail: 'Progress, Study or Stop — with three evidence references, one gap and the next best action.', evidence: 'Your call, plus the evidence, gap and action that support it.' },
    ],
  },
  {
    id: 'm-d2-qc', dayId: 'describe-design', dayNumber: 2, workspace: 'field-development',
    title: 'QC the field case',
    brief: 'Approve the inputs before trusting the output, then reproduce the base-case volume from them.',
    scope: 'Volve · static model · base case',
    output: 'Approved input set',
    steps: [
      { id: 's1', title: 'Check the depth references', detail: 'Confirm markers, contacts and targets are all stated on the same vertical datum before comparing anything.', evidence: 'The datum in use, and any value you found stated against a different one.' },
      { id: 's2', title: 'Review the petrophysical cutoffs', detail: 'Find the porosity and shale-volume cutoffs and establish what evidence justifies them.', evidence: 'The cutoffs in force and the justification recorded for them.' },
      { id: 's3', title: 'Verify the contact', detail: 'Trace the fluid contact back to the evidence it rests on and note the alternatives that survive.', evidence: 'The contact depth, its evidence line, and one credible alternative.' },
      { id: 's4', title: 'Reproduce the base case', detail: 'Walk the volumetric lineage from gross rock volume through to a stock-tank number.', evidence: 'Each input in the chain and the volume you reproduced.' },
    ],
  },
  {
    id: 'm-d2-compare', dayId: 'describe-design', dayNumber: 2, workspace: 'field-development',
    title: 'Compare development cases',
    brief: 'Test two prepared cases, find the driver that actually separates them, and decide what to do next.',
    scope: 'Volve · development case A vs case B',
    output: 'Development Case Card',
    steps: [
      { id: 's1', title: 'Run case A', detail: 'Record its volume, forecast and the assumptions it depends on.', evidence: 'Case A result and its two most load-bearing assumptions.' },
      { id: 's2', title: 'Run case B', detail: 'Record the same, then isolate exactly which inputs differ from case A.', evidence: 'Case B result and the specific inputs that differ.' },
      { id: 's3', title: 'Rank the drivers', detail: 'Identify which uncertainty moves the outcome most, not which has the widest raw range.', evidence: 'The dominant driver and the evidence that it dominates.' },
      { id: 's4', title: 'State the decision', detail: 'Select, Rework or Reject — and name the one study most likely to change your answer.', evidence: 'Your call and the single highest-value study behind it.' },
    ],
  },
  {
    id: 'm-d3-plan', dayId: 'deliver', dayNumber: 3, workspace: 'well-delivery',
    title: 'Review the well plan',
    brief: 'Test whether a candidate well is technically ready, from basis of design through to offset evidence.',
    scope: 'Volve · candidate producer · full well plan',
    output: 'Well plan review note',
    steps: [
      { id: 's1', title: 'Read the basis of design', detail: 'Check the objective states its data acquisition and acceptance criteria, not just an intent.', evidence: 'The objective as written, and whether it is testable.' },
      { id: 's2', title: 'Check target against uncertainty', detail: 'Compare the quoted landing point with the mapped target uncertainty envelope.', evidence: 'The target, its envelope, and any false precision you found.' },
      { id: 's3', title: 'Inspect the trajectory', detail: 'Look at dogleg severity and clearance, and confirm every depth carries its reference.', evidence: 'Peak DLS, the clearance position, and the depth references used.' },
      { id: 's4', title: 'Test offset relevance', detail: 'For each analogue cited, decide whether similarity is argued or merely assumed from proximity.', evidence: 'One offset used, and your judgement on whether it transfers.' },
    ],
  },
  {
    id: 'm-d3-slot', dayId: 'deliver', dayNumber: 3, workspace: 'well-delivery',
    title: 'Protect the slot',
    brief: 'A sound well can still be undeliverable. Find the sequence conflict and resolve it in a controlled way.',
    scope: 'Volve · rig sequence · current campaign',
    output: 'Well Gate Card',
    steps: [
      { id: 's1', title: 'Find the conflict', detail: 'Work the schedule until you can name where two commitments compete for the same capacity.', evidence: 'The conflicting activities and the window they collide in.' },
      { id: 's2', title: 'Identify the dependency', detail: 'Establish what the well is actually waiting on — readiness, long-lead items or rig capability.', evidence: 'The binding dependency and the date it clears.' },
      { id: 's3', title: 'Resolve it deliberately', detail: 'Propose a change and state what it displaces. Nothing moves for free.', evidence: 'Your proposed resolution and the milestone it costs.' },
      { id: 's4', title: 'Record the gate call', detail: 'Approve, Condition or Hold — a condition needs a verifiable criterion, an owner and a date.', evidence: 'Your call, and if a condition, its criterion, owner and date.' },
    ],
  },
  {
    id: 'm-d4-diagnose', dayId: 'operate', dayNumber: 4, workspace: 'reservoir-management',
    title: 'Diagnose the exception',
    brief: 'Turn a performance exception into a defensible diagnosis, and know what would discriminate between the candidates.',
    scope: 'Volve · producing well · performance exception',
    output: 'Diagnosis note',
    steps: [
      { id: 's1', title: 'Validate the signal', detail: 'Before treating it as reservoir behaviour, rule out allocation, metering and uptime artefacts.', evidence: 'The signal, and the checks that establish it is real.' },
      { id: 's2', title: 'Compare the cohort', detail: 'Plot the same measure across peer wells to separate a well-specific fault from a segment-scale process.', evidence: 'What the peer comparison shows and what it rules out.' },
      { id: 's3', title: 'List competing mechanisms', detail: 'Observation is not mechanism. Keep every explanation that the evidence still permits.', evidence: 'At least two mechanisms still live, and why each survives.' },
      { id: 's4', title: 'Name the discriminator', detail: 'Choose the one measurement that would separate them, and say what each outcome would mean.', evidence: 'The discriminating measurement and how you would read it.' },
    ],
  },
  {
    id: 'm-d4-action', dayId: 'operate', dayNumber: 4, workspace: 'reservoir-management',
    title: 'Screen the action',
    brief: 'Compare a base case against an intervention, and define how you will know whether it worked.',
    scope: 'Volve · base case vs intervention case',
    output: 'Reservoir Action Card',
    steps: [
      { id: 's1', title: 'Preserve the baseline', detail: 'Establish and record the do-nothing forecast before modelling any intervention.', evidence: 'The baseline forecast and the assumptions it holds.' },
      { id: 's2', title: 'Run the intervention case', detail: 'Model the candidate action and record the uplift it predicts.', evidence: 'The intervention modelled and its predicted uplift.' },
      { id: 's3', title: 'Define the success measure', detail: 'State the expected response, the verification window and who owns the check.', evidence: 'Expected response, window and named owner.' },
      { id: 's4', title: 'Record the action call', detail: 'Act, Acquire Data or Monitor — requesting data is a good answer when evidence cannot yet discriminate.', evidence: 'Your call, with the reasoning that supports it.' },
    ],
  },
];

export function missionsForDay(dayId: string): Mission[] {
  return MISSIONS.filter((m) => m.dayId === dayId);
}

export function missionById(id: string): Mission | undefined {
  return MISSIONS.find((m) => m.id === id);
}
