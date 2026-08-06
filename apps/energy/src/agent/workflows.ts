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


// ── AI-assisted mode ─────────────────────────────────────────────────────────
//
// The deterministic chain is fixed: same subject, same steps, same order, and
// no model is consulted. That is what makes it auditable, and it is the right
// default for anything you will defend in a meeting.
//
// Assisted mode makes the chain a PROPOSAL. Every deviation is derived from the
// capability probes -- the same measured flags a single answer is gated on --
// never from the model's opinion about what is interesting. So the plan is
// explainable before it runs, which is the only reason it is safe to let it
// change.
//
// What it may do: drop a step whose data is absent, and append a step this
// subject supports that the fixed chain did not think to ask for. What it may
// NOT do: invent a step, reorder the geological logic, or silently skip
// something that WOULD have worked.

import type { GazIndexed } from './types.ts';
import { CAPABILITIES } from './capabilities.ts';

export interface PlannedStep {
  step: WorkflowStep;
  /** 'run' | 'drop' | 'add' — and why, in the reader's terms. */
  action: 'run' | 'drop' | 'add';
  reason: string;
}

/** Build the assisted plan for one subject, from probes alone. */
export function planFor(workflow: Workflow, node: GazIndexed): PlannedStep[] {
  const probe = (id: string) => {
    const c = CAPABILITY_BY_ID.get(id);
    if (!c || !c.kinds.includes(node.kind)) return false;
    try { return c.probe(node); } catch { return false; }
  };

  const planned: PlannedStep[] = workflow.steps.map((step) => (
    probe(step.capabilityId)
      ? { step, action: 'run' as const, reason: 'data is on file' }
      : {
        step,
        action: 'drop' as const,
        // Named precisely: the step is not "unavailable", its probe measured
        // the absence. The user can check that claim against the card.
        reason: `${CAPABILITY_BY_ID.get(step.capabilityId)?.label ?? step.capabilityId} has no data for ${node.name}`,
      }
  ));

  // Additions: capabilities this subject genuinely supports that the fixed
  // chain omits. Ordered by the registry's own weight so the suggestion is
  // stable rather than incidental.
  const already = new Set(workflow.steps.map((s) => s.capabilityId));
  const extras = CAPABILITIES
    .filter((c) => !already.has(c.id) && c.kinds.includes(node.kind))
    .filter((c) => { try { return c.probe(node); } catch { return false; } })
    .sort((a, b) => (b.weight ?? 0) - (a.weight ?? 0))
    .slice(0, 2)
    .map((c) => ({
      step: { capabilityId: c.id, title: c.label, why: 'Not in the fixed chain, but this subject supports it.' },
      action: 'add' as const,
      reason: `${node.name} carries data for ${c.label}`,
    }));

  return [...planned, ...extras];
}

/** One line describing how the plan differs from the fixed chain. Empty when
 *  it does not — an assisted run that changed nothing should say so. */
export function planSummary(plan: PlannedStep[]): string {
  const dropped = plan.filter((p) => p.action === 'drop').length;
  const added = plan.filter((p) => p.action === 'add').length;
  if (!dropped && !added) return '';
  const parts = [];
  if (dropped) parts.push(`${dropped} step${dropped === 1 ? '' : 's'} dropped for missing data`);
  if (added) parts.push(`${added} added that this subject supports`);
  return parts.join(', ');
}
