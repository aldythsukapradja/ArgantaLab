// agents.ts — the five ArgantaEnergy lifecycle agents, as a single shared source of truth.
// Consumed by the Cockpit's map-side quick-launch strip and by the Intelligence → Agents
// directory page, so both stay in sync instead of drifting copies of the same five entries.
import type { LucideIcon } from 'lucide-react';
import { Compass, Layers3, Wrench, Waves, Drill } from 'lucide-react';

export type AgentDef = {
  id: string;
  name: string;
  short: string;
  icon: LucideIcon;
  color: string;
  state: string;
  proof: string;
  generic: string;
};

export const AGENTS: AgentDef[] = [
  {
    id: 'exploration', name: 'Exploration', short: 'EXP', icon: Compass, color: '#2dd4bf', state: 'BETA',
    proof: 'On Volve, analogue evidence and remaining trap risk are already connected to source.',
    generic: 'Screen basins, plays and prospects with risk, analogue and evidence context already connected.',
  },
  {
    id: 'field-development', name: 'Field Development', short: 'FD', icon: Layers3, color: '#38bdf8', state: 'LIVE',
    proof: 'On Volve, fault-block connectivity supports the preferred concept with traceable confidence.',
    generic: 'Move from static model and volumes to concepts, wells and economics without breaking lineage.',
  },
  {
    id: 'reservoir-management', name: 'Reservoir Management', short: 'RM', icon: Waves, color: '#a78bfa', state: 'LIVE',
    proof: 'On Volve, the agent detects the water-cut deviation and frames the next intervention.',
    generic: 'Unify surveillance, forecasting and opportunities around the asset’s live performance.',
  },
  {
    id: 'well-delivery', name: 'Well Delivery', short: 'WD', icon: Wrench, color: '#fbbf24', state: 'BETA',
    proof: 'On Volve, the proposed well clears the depth envelope while the casing window stays stable.',
    generic: 'Turn approved well intent into trajectory, drilling, completion and readiness decisions.',
  },
  {
    id: 'drilling-sequence', name: 'Drilling', short: 'DRL', icon: Drill, color: '#fb7185', state: 'BETA',
    proof: 'On Volve, the recommended sequence protects rig continuity and first-oil logic.',
    generic: 'Sequence mature well stock against rig capacity, constraints, milestones and value.',
  },
];
