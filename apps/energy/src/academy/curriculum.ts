// academy/curriculum.ts — the whole course model, as data.
//
// The mental model this encodes, in one sentence:
//
//   Volve is one asset. Each stage of its life asks one question, and you earn
//   the right to answer it by running the same five-beat loop.
//
// Three tiers exist. They differ ONLY in (a) how many stages they cover and
// (b) how long each stage gets — never in shape. That is deliberate: a tier is
// a re-pack of the same authored units, so growing 1-day → 3-day → 5-day adds
// content without editing what already exists.
//
// Nothing here is wired to a workspace yet. This is the concept shell: the
// structure made visible and clickable so it can be argued with before it is
// built.

export type TierId = 'd1' | 'd3' | 'd5';
export type StageId =
  | 'exploration' | 'field-development' | 'well-delivery'
  | 'drilling' | 'reservoir-management';
export type BeatId = 'brief' | 'drill' | 'do' | 'defend' | 'amplify';

/** What a card links straight into. Kind drives the chip's icon and routing. */
export type MaterialKind = 'deck' | 'knowledge' | 'workspace' | 'agent';

export interface Material {
  kind: MaterialKind;
  label: string;
}

/** Per-tier text. A missing key means the stage/beat is absent from that tier. */
type ByTier<T> = Partial<Record<TierId, T>>;

export interface Tier {
  id: TierId;
  chip: string;
  name: string;
  promise: string;
  /** What this tier adds that the one before it did not. */
  adds: string;
  stages: StageId[];
  /** Authoring cost, in the units that actually get built. */
  build: { slides: number; questions: number; missions: number; traps: number; rubrics: number; scripts: number };
}

export interface Stage {
  id: StageId;
  verb: string;
  name: string;
  /** The one question the stage exists to answer. */
  question: string;
  /** The call the learner must make, and defend. */
  decision: string;
  /** What they hand to the next stage. The relay baton. */
  handover: string;
  color: string;
  /** Nav id of the real workspace this stage runs in — the lab. */
  workspace: string;
  /** How long the stage gets, per tier. */
  load: ByTier<string>;
  /** The three or four things they actually do, in order. */
  steps: string[];
  /** Deliberately broken/ambiguous data planted for them to catch. */
  traps: string[];
  /** The card's shortcut row — deck, dossier, workspace, and this stage's agent. */
  materials: Material[];
  /**
   * What the agent does in THIS stage. The agent is no longer a separate stage
   * at the end of the chain: every lifecycle gets its own, sitting on the card
   * beside the material it has to reproduce.
   */
  agent: { name: string; does: string; acts: string[] };
}

/** The four acts of the agent showcase, run per lifecycle. */
const AGENT_ACTS = [
  'ACT 1 · The race — the agent runs this stage live, narrating each step',
  'ACT 2 · The receipts — every claim traced back to its source record',
  'ACT 3 · The audit — score the agent’s pack against your own. Blind agreement scores zero.',
  'ACT 4 · The handoff — ask it something nobody prepared',
];

export interface Beat {
  id: BeatId;
  n: number;
  name: string;
  line: string;
  what: string;
  /** How this beat is scheduled, per tier. */
  load: Record<TierId, string>;
}

export interface Currency {
  id: string;
  glyph: string;
  name: string;
  earned: string;
  measures: string;
  /** Tiers where this currency is scored rather than merely shown. */
  live: TierId[];
}

/* ── Tiers ──────────────────────────────────────────────────────────────── */

export const TIERS: Tier[] = [
  {
    id: 'd1', chip: '1 DAY', name: 'The Asset Story',
    promise: 'See an entire asset life in a day — and watch an agent do it again in minutes.',
    adds: 'Every stage hands off. Nothing stands alone.',
    stages: ['exploration', 'field-development', 'reservoir-management'],
    build: { slides: 8, questions: 8, missions: 3, traps: 3, rubrics: 1, scripts: 1 },
  },
  {
    id: 'd3', chip: '3 DAYS', name: 'The Deep Vertical',
    promise: 'Same three workspaces, a full day each — own the method, not just the answer.',
    adds: 'The relay penalty: your day inherits yesterday’s quality.',
    stages: ['exploration', 'field-development', 'reservoir-management'],
    build: { slides: 24, questions: 24, missions: 3, traps: 9, rubrics: 3, scripts: 3 },
  },
  {
    id: 'd5', chip: '5 DAYS', name: 'Plan Meets Steel',
    promise: 'The full lifecycle — the subsurface plan now has to survive a rig.',
    adds: 'Well Delivery and Drilling: where the plan gets contradicted.',
    stages: ['exploration', 'field-development', 'well-delivery', 'drilling', 'reservoir-management'],
    build: { slides: 40, questions: 40, missions: 5, traps: 15, rubrics: 5, scripts: 5 },
  },
];

/* ── Stages ─────────────────────────────────────────────────────────────── */

export const STAGES: Stage[] = [
  {
    id: 'exploration', verb: 'DISCOVER', name: 'Exploration',
    question: 'Is there something here, and do we believe the evidence?',
    decision: 'Progress · Study · Stop',
    handover: 'Evidence pack + risked volume',
    color: '#22d3ee', workspace: 'exploration',
    load: { d1: '60 min', d3: 'Day 1', d5: 'Day 1' },
    steps: [
      'Open the Volve record in Cockpit — who says so, and when?',
      'Sort the evidence into measured, interpreted and assumed',
      'Read the risked volume and find where the range comes from',
      'Name the one thing that would change the answer',
    ],
    traps: [
      'A headline STOIIP quoted as fact when it is an upper bound',
      'An analogue field cited with no shared petroleum system',
      'A confident number whose source record does not exist',
    ],
    materials: [
      { kind: 'deck', label: 'Presentation' },
      { kind: 'knowledge', label: 'Basin Dossier' },
      { kind: 'workspace', label: 'Workspace' },
      { kind: 'agent', label: 'EXP Agent' },
    ],
    agent: {
      name: 'Exploration Agent',
      does: 'Assembles the evidence pack and states the remaining trap risk, with every analogue and volume traced to source.',
      acts: AGENT_ACTS,
    },
  },
  {
    id: 'field-development', verb: 'DESCRIBE', name: 'Field Development',
    question: 'What is this field, and which development case survives scrutiny?',
    decision: 'Select · Rework · Reject',
    handover: 'Development case + well targets',
    color: '#0FB5A6', workspace: 'field-development',
    load: { d1: '60 min', d3: 'Day 2', d5: 'Day 2' },
    steps: [
      'Walk logs → correlation → structure, and QC each input',
      'Run the base case and note what it is sensitive to',
      'Compare two prepared cases and isolate the value driver',
      'State the uncertainty you would pay to reduce',
    ],
    traps: [
      'A log curve with the wrong unit that still plots plausibly',
      'A contact picked below the deepest actual penetration',
      'A case comparison where the two runs used different inputs',
    ],
    materials: [
      { kind: 'deck', label: 'Presentation' },
      { kind: 'knowledge', label: 'Asset Dossier' },
      { kind: 'workspace', label: 'Workspace' },
      { kind: 'agent', label: 'FD Agent' },
    ],
    agent: {
      name: 'Field Development Agent',
      does: 'Takes the static model to concept, wells and economics without breaking lineage — and shows which fault-block connectivity its answer rests on.',
      acts: AGENT_ACTS,
    },
  },
  {
    id: 'well-delivery', verb: 'DELIVER', name: 'Well Delivery',
    question: 'Can this target actually be reached, safely and on plan?',
    decision: 'Drill · Redesign · Defer',
    handover: 'Approved well design + risk register',
    color: '#f59e0b', workspace: 'well-delivery',
    load: { d5: 'Day 3' },
    steps: [
      'Take the target from Field Development and test its reachability',
      'Check the trajectory against the casing and pressure window',
      'Find where the design is tight rather than comfortable',
      'Write the risk that the rig crew must be told about',
    ],
    traps: [
      'A trajectory that clears the target but not the anti-collision rule',
      'A mud weight window that closes in a section nobody flagged',
      'A design copied from an analogue well with a different depth datum',
    ],
    materials: [
      { kind: 'deck', label: 'Presentation' },
      { kind: 'knowledge', label: 'Well Dossier' },
      { kind: 'workspace', label: 'Workspace' },
      { kind: 'agent', label: 'WD Agent' },
    ],
    agent: {
      name: 'Well Delivery Agent',
      does: 'Turns approved well intent into trajectory, casing and completion checks, and reports whether the depth envelope and casing window actually hold.',
      acts: AGENT_ACTS,
    },
  },
  {
    id: 'drilling', verb: 'EXECUTE', name: 'Drilling',
    question: 'The rig is turning and reality disagrees — does the sequence still hold?',
    decision: 'Proceed · Resequence · Stop',
    handover: 'As-drilled well + the surprises',
    color: '#e11d74', workspace: 'drilling-sequence',
    load: { d5: 'Day 4' },
    steps: [
      'Compare planned against as-drilled on the real Volve curves',
      'Find the moment the well told you the model was wrong',
      'Resequence the remaining stock against rig availability',
      'Feed the surprise back into the subsurface case',
    ],
    traps: [
      'An ROP drop read as a bit problem when it is a formation change',
      'A sequence that is optimal on paper and impossible on the rig',
      'A depth mismatch between driller and logger measurements',
    ],
    materials: [
      { kind: 'deck', label: 'Presentation' },
      { kind: 'knowledge', label: 'Programme Dossier' },
      { kind: 'workspace', label: 'Workspace' },
      { kind: 'agent', label: 'DRL Agent' },
    ],
    agent: {
      name: 'Drilling Agent',
      does: 'Sequences the well stock against rig capacity and constraints, and shows what the recommended order costs in first-oil terms.',
      acts: AGENT_ACTS,
    },
  },
  {
    id: 'reservoir-management', verb: 'OPERATE', name: 'Reservoir Management',
    question: 'It produced. What did it tell us, and what do we do about it?',
    decision: 'Intervene · Monitor · Accept',
    handover: 'Surveillance verdict + intervention case',
    color: '#7c3aed', workspace: 'reservoir-management',
    load: { d1: '60 min', d3: 'Day 3', d5: 'Day 5' },
    steps: [
      'Put actual production against the original forecast',
      'Classify the water path — where is the water coming from?',
      'Decide whether the deviation is a model error or a field event',
      'Propose the intervention, and say what would prove it wrong',
    ],
    traps: [
      'A water-cut rise that looks like breakthrough and is a rate change',
      'A decline fitted to a period that contains a shut-in',
      'A well test whose date does not match the production record',
    ],
    materials: [
      { kind: 'deck', label: 'Presentation' },
      { kind: 'knowledge', label: 'Surveillance Dossier' },
      { kind: 'workspace', label: 'Workspace' },
      { kind: 'agent', label: 'RM Agent' },
    ],
    agent: {
      name: 'Reservoir Management Agent',
      does: 'Detects the water-cut deviation against forecast and frames the next intervention, with the surveillance record behind it.',
      acts: AGENT_ACTS,
    },
  },
];

/* ── The loop ───────────────────────────────────────────────────────────── */

export const BEATS: Beat[] = [
  {
    id: 'brief', n: 1, name: 'BRIEF', line: 'Frame it',
    what: 'Eight slides. The mental model and yesterday’s handover — never a content dump. The workspace does the teaching.',
    load: { d1: '40 min · once', d3: '45 min · daily', d5: '45 min · daily' },
  },
  {
    id: 'drill', n: 2, name: 'DRILL', line: 'Recall it',
    what: 'Eight questions, at the START of the block, not the end. Retrieval practice, not an exam. Drives the live leaderboard.',
    load: { d1: '20 min · once', d3: '20 min · daily', d5: '20 min · daily' },
  },
  {
    id: 'do', n: 3, name: 'DO', line: 'Do it',
    what: 'The real workspace on real Volve data. One mission, ordered steps, evidence captured at each. Traps planted to be caught.',
    load: { d1: '3 × 60 min legs', d3: '3 hours · one domain', d5: '3 hours · one domain' },
  },
  {
    id: 'defend', n: 4, name: 'DEFEND', line: 'Defend it',
    what: 'Three minutes to the room: the decision, the uncertainty, the next action. Scored against a rubric, not on eloquence.',
    load: { d1: '45 min · once', d3: '45 min · daily', d5: '45 min · daily' },
  },
  {
    id: 'amplify', n: 5, name: 'AMPLIFY', line: 'Amplify it',
    what: 'The Arganta agent runs the same chain. Always AFTER the hand-work — the point only lands once they know what it cost.',
    load: { d1: '60 min · finale', d3: '30 min · daily', d5: '30 min + assisted mission' },
  },
];

/* ── Scoring ────────────────────────────────────────────────────────────── */

export const CURRENCIES: Currency[] = [
  {
    id: 'points', glyph: '◆', name: 'Points',
    earned: 'Quiz answers · mission steps completed',
    measures: 'Did you do the work?',
    live: ['d1', 'd3', 'd5'],
  },
  {
    id: 'evidence', glyph: '◉', name: 'Evidence',
    earned: 'Citing a real record · catching a planted trap · naming a gap',
    measures: 'Can you tell truth from assumption?',
    live: ['d1', 'd3', 'd5'],
  },
  {
    id: 'judgement', glyph: '▲', name: 'Judgement',
    earned: 'Defence rubric: decision + uncertainty + next action',
    measures: 'Would I let you sign this?',
    live: ['d3', 'd5'],
  },
];

/* ── Lookups ────────────────────────────────────────────────────────────── */

export const tierById = (id: TierId): Tier => TIERS.find((t) => t.id === id)!;
export const stageById = (id: StageId): Stage => STAGES.find((s) => s.id === id)!;

/**
 * The stages this tier actually covers, in lifecycle order.
 *
 * Stages outside the tier are dropped rather than shown greyed out: a 1-day
 * buyer should see a complete, uncluttered story (find it → build it → run it),
 * not a course with visible holes in it. What the 5-day adds is stated in the
 * tier's own `adds` line and by switching tiers.
 */
export function stagesForTier(tier: TierId): Stage[] {
  const on = new Set(tierById(tier).stages);
  return STAGES.filter((s) => on.has(s.id));
}
