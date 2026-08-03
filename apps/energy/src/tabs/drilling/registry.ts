import type { LucideIcon } from 'lucide-react';
import { CalendarRange, ClipboardCheck, GitCompareArrows, ListOrdered, RadioTower, ShipWheel } from 'lucide-react';

export interface DrillingStage {
  id: string;
  name: string;
  phase: string;
  blurb: string;
  output: string;
  icon: LucideIcon;
}

export const DRILLING_STAGES: DrillingStage[] = [
  { id: 'basis', name: 'Programme basis', phase: 'Frame', blurb: 'Establish the sanctioned well set, data nature, planning horizon and campaign assumptions.', output: 'Programme basis', icon: ClipboardCheck },
  { id: 'rigs', name: 'Rig strategy', phase: 'Frame', blurb: 'Match rig capability, availability, moves and operating constraints to the well set.', output: 'Rig strategy', icon: ShipWheel },
  { id: 'sequence', name: 'Well sequence', phase: 'Plan', blurb: 'Build the rig-by-time order, campaign logic, durations and dependencies.', output: 'Integrated drilling sequence', icon: ListOrdered },
  { id: 'readiness', name: 'Readiness & milestones', phase: 'Plan', blurb: 'Align well maturity, long-lead readiness, RFD and RFSU milestones to each slot.', output: 'Readiness register', icon: CalendarRange },
  { id: 'execute', name: 'Execution window', phase: 'Execute', blurb: 'Monitor the active window, rig utilization, clashes and near-term decisions.', output: 'Execution look-ahead', icon: RadioTower },
  { id: 'revisions', name: 'Revisions & learning', phase: 'Learn', blurb: 'Compare schedule snapshots and carry post-well learning into the next sequence.', output: 'Revision and learning pack', icon: GitCompareArrows },
];
