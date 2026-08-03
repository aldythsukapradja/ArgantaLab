import type { LucideIcon } from 'lucide-react';
import { Crosshair, DraftingCompass, Layers3, Route, ShieldCheck, Stamp } from 'lucide-react';

export interface MaturationStage {
  id: string;
  name: string;
  phase: string;
  blurb: string;
  output: string;
  icon: LucideIcon;
}

export const MATURATION_STAGES: MaturationStage[] = [
  { id: 'intent', name: 'Well intent', phase: 'Assess', blurb: 'Frame the field opportunity, well objective and measurable success criteria.', output: 'Statement of requirements', icon: Crosshair },
  { id: 'analogs', name: 'Offset & analog basis', phase: 'Assess', blurb: 'Query field wells for architecture, performance, hazards and lessons.', output: 'Offset-well basis', icon: Layers3 },
  { id: 'concept', name: 'Concept select', phase: 'Select', blurb: 'Select the well type, target, trajectory family and completion concept.', output: 'Selected well concept', icon: DraftingCompass },
  { id: 'trajectory', name: 'Trajectory & architecture', phase: 'Define', blurb: 'Mature TD, landing point, hole sections, casing seats and design envelope.', output: 'Basis of design', icon: Route },
  { id: 'assurance', name: 'Assurance', phase: 'Define', blurb: 'Close hazards, barriers, anti-collision, pore pressure and operability.', output: 'Safe-to-drill assurance', icon: ShieldCheck },
  { id: 'sanction', name: 'Sanction package', phase: 'Sanction', blurb: 'Consolidate cost, schedule, risk and readiness into the investment case.', output: 'Well proposal', icon: Stamp },
];
