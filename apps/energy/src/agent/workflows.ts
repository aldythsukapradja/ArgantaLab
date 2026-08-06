// agent/workflows.ts — a workflow is a chain of CAPABILITIES, not a tour of tabs.
//
// The walkthroughs this replaces drove the app: navigate to a tab, wait,
// narrate. That is why they rotted — every UI change broke them, and by the end
// the most prominent affordance in the chat was pointing at the oldest surface
// in it.
//
// A workflow here is an ordered list of capability ids. Each step runs through
// the SAME runIntent() a typed question uses, renders the SAME card and
// artifact, and is gated on the SAME `probe`. There is nothing to navigate and
// nothing to keep in sync: if a capability changes, the workflow changes with
// it, because there is only one implementation of each step.
//
// THE HONESTY RULE SCALES UP UNCHANGED. A step whose probe fails is not hidden
// and does not abort the chain — it reports its own absence and the run
// continues. A five-step workflow that truthfully runs three is worth more than
// one that performs five.

import type { GazKind } from './types.ts';
import { CAPABILITY_BY_ID } from './capabilities.ts';

export interface WorkflowStep {
  capabilityId: string;
  /** Shown on the step header. The capability's own label is often narrower
   *  than the role it plays in a chain — "Basin figures" vs "Evidence". */
  title: string;
  /** Why this step is here, in the reader's terms. One line. */
  why: string;
}

export interface Workflow {
  id: string;
  title: string;
  /** The verb the pill shows. Deliberately a verb: "Screen a basin", not
   *  "Basin screening" — a pill that names a noun reads as a destination, and
   *  destinations are exactly what went stale. */
  pill: string;
  hint: string;
  /** Entity kinds this chain can start from. */
  kinds: GazKind[];
  steps: WorkflowStep[];
}

export const WORKFLOWS: Workflow[] = [
  {
    id: 'basin-screening',
    title: 'Basin screening',
    pill: 'Screen a basin',
    hint: 'Dossier → petroleum system → cycles → evidence',
    kinds: ['basin'],
    steps: [
      { capabilityId: 'basin.dossier', title: 'What this basin is', why: 'Size, setting and what the catalogue holds.' },
      { capabilityId: 'basin.petroleumSystems', title: 'Petroleum system', why: 'Charge, trap and timing — and which of it is modelled rather than assumed.' },
      { capabilityId: 'basin.cycles', title: 'Tectonostratigraphy', why: 'The cycles the play sits in, and whether they are cited or interpreted.' },
      { capabilityId: 'basin.fields', title: 'What has been found', why: 'Discovered fields, as the test of everything above.' },
      { capabilityId: 'basin.figures', title: 'Evidence', why: 'The public-domain figures behind the screening.' },
    ],
  },
  {
    id: 'field-development',
    title: 'Field development',
    pill: 'Develop a field',
    hint: 'Dossier → data QC → logs → trajectory',
    kinds: ['field', 'well', 'wellbore'],
    steps: [
      { capabilityId: 'field.dossier', title: 'Asset dossier', why: 'The record before the measurements — operator, status, what is on file.' },
      { capabilityId: 'field.qc', title: 'Data QC', why: 'What was actually delivered, and what is missing from it.' },
      { capabilityId: 'well.logs', title: 'Petrophysics — curves', why: 'The logs the interpretation would be built on.' },
      { capabilityId: 'well.trajectory', title: 'Well path', why: 'Where those measurements were taken, in space.' },
    ],
  },
];

export const WORKFLOW_BY_ID = new Map(WORKFLOWS.map((w) => [w.id, w]));

/** Steps whose capability actually exists in the registry.
 *
 *  A workflow naming a capability that was renamed or removed would fail at
 *  run time, one step in, having already told the user it was starting. Checked
 *  up front so the chain can be honest about its own length before it begins. */
export function resolvedSteps(workflow: Workflow): { step: WorkflowStep; known: boolean }[] {
  return workflow.steps.map((step) => ({ step, known: CAPABILITY_BY_ID.has(step.capabilityId) }));
}

/** Workflows that can start from a given entity kind. */
export const workflowsForKind = (kind: GazKind): Workflow[] =>
  WORKFLOWS.filter((w) => w.kinds.includes(kind));
