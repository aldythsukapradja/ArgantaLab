// Config-driven nav — nav is DATA, not markup (the reusable Cosmo pattern).
// Shell concept v2 (Command-Center OS): 4 bottom-nav zones + a center Agent orb.
// See docs/arganta-energy/SHELL-CONCEPT-V2.md for the founder-directed restructure.
import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid, Database, BookOpen, Wrench, Compass, Truck, Waves,
  Sparkles, Bot, GraduationCap, ShieldCheck, Gauge, Boxes, Radar,
} from 'lucide-react';

export type DomainId =
  | 'core'                                                     // Command Center
  | 'exploration' | 'fielddev' | 'welldelivery' | 'resmgmt'    // Verticals (O&G lifecycle)
  | 'insight' | 'reasoning' | 'knowledge' | 'data'              // Intelligence (Data is last/bottom)
  | 'foundation';                                               // Foundation (learning bank)

// zone: the 4 bottom-nav groups. The Agent (Cosmonaut orb) is a 5th "zone" in the
// bottom bar but is not a drawer group — it's a floating action that opens an overlay.
export type Zone = 'command' | 'vertical' | 'intelligence' | 'foundation';

export const ZONE_LABEL: Record<Zone, string> = {
  command: 'COMMAND CENTER', vertical: 'VERTICALS', intelligence: 'INTELLIGENCE', foundation: 'FOUNDATION',
};

export interface DomainDef {
  id: DomainId;
  label: string;
  icon: LucideIcon;
  accent: string;          // css var name
  status: 'live' | 'stub';
  phase: string;           // e.g. 'P2' or 'V1'
  zone: Zone;
  blurb: string;
}

// Domain tab bar + drawer both render from this single array, in this order.
export const DOMAINS: DomainDef[] = [
  // ── COMMAND CENTER — the ops cockpit. Core concept pending (founder TBD); placeholder for now. ──
  { id: 'core', label: 'Core', icon: LayoutGrid, accent: 'teal', status: 'stub', phase: '—', zone: 'command', blurb: 'High-level operator cockpit. Concept pending.' },

  // ── VERTICALS — domain apps, in O&G lifecycle order ──
  { id: 'exploration', label: 'Exploration', icon: Compass, accent: 'violet', status: 'stub', phase: 'V1', zone: 'vertical', blurb: 'Prospect screening, play assessment, exploration risk.' },
  { id: 'fielddev', label: 'Field Development', icon: Wrench, accent: 'blue', status: 'stub', phase: 'V1', zone: 'vertical', blurb: 'Mini-Petrel: map → logs → structural → property → volumetrics → forecast → economics.' },
  { id: 'welldelivery', label: 'Well Delivery', icon: Truck, accent: 'amber', status: 'stub', phase: 'V2+', zone: 'vertical', blurb: 'Well planning, drilling & completion delivery.' },
  { id: 'resmgmt', label: 'Reservoir Management', icon: Waves, accent: 'teal', status: 'stub', phase: 'V2+', zone: 'vertical', blurb: 'Surveillance, pattern balancing, injection/production optimization.' },

  // ── INTELLIGENCE — data-to-insight ladder (Data is the foundation, listed last) ──
  { id: 'insight', label: 'Insight', icon: Sparkles, accent: 'rose', status: 'stub', phase: '—', zone: 'intelligence', blurb: 'Dashboards, KPIs, briefings, decisions.' },
  { id: 'reasoning', label: 'Reasoning', icon: Bot, accent: 'teal', status: 'stub', phase: 'P4', zone: 'intelligence', blurb: 'Deterministic-first tier ladder, truthful run envelope, approval gate.' },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, accent: 'violet', status: 'live', phase: 'P2', zone: 'intelligence', blurb: 'Vault + knowledge graph — notes, evidence, extraction.' },
  { id: 'data', label: 'Data', icon: Database, accent: 'amber', status: 'live', phase: 'P2', zone: 'intelligence', blurb: 'Ingestion refinery — field overview, inventory, pipeline, semantic model.' },

  // ── FOUNDATION — the knowledge bank / learning library ──
  { id: 'foundation', label: 'Foundation', icon: GraduationCap, accent: 'rose', status: 'stub', phase: 'V2+', zone: 'foundation', blurb: 'Training materials, notes & reading, reference.' },
];

// ── Sub-tabs per domain (config-driven, like DOMAINS). Top bar renders these. ──
export interface SubTab { id: string; label: string }
export const SUBTABS: Record<DomainId, SubTab[]> = {
  core: [{ id: 'overview', label: 'Overview' }, { id: 'governance', label: 'Governance' }],
  exploration: [{ id: 'overview', label: 'Overview' }],
  fielddev: [
    { id: 'map', label: 'Map' },
    { id: 'logs', label: 'Logs' },
    { id: 'petrophysics', label: 'Petrophysics' },
    { id: 'correlation', label: 'Correlation' },
    { id: 'structural', label: 'Structural' },
    { id: 'property', label: 'Property' },
    { id: 'gridmodel', label: 'Grid Model' },
    { id: 'simulation', label: 'Simulation' },
    { id: 'volumetrics', label: 'Volumetrics' },
    { id: 'uncertainty', label: 'Uncertainty' },
    { id: 'forecast', label: 'Forecast' },
    { id: 'economics', label: 'Economics' },
    { id: 'review', label: 'Field Review' },
  ],
  welldelivery: [{ id: 'overview', label: 'Overview' }],
  resmgmt: [{ id: 'overview', label: 'Overview' }],
  insight: [{ id: 'overview', label: 'Overview' }],
  reasoning: [{ id: 'overview', label: 'Overview' }],
  knowledge: [
    { id: 'explorer', label: 'Explorer' },
    { id: 'graph', label: 'Graph' },
    { id: 'extraction', label: 'Extraction' },
  ],
  data: [
    { id: 'overview', label: 'Overview' },
    { id: 'inventory', label: 'Inventory' },
    { id: 'pipeline', label: 'Pipeline' },
    { id: 'model', label: 'Model' },
  ],
  foundation: [
    { id: 'training', label: 'Training' },
    { id: 'notes', label: 'Notes & Reading' },
    { id: 'reference', label: 'Reference' },
  ],
};
export const defaultSubtab = (d: DomainId): string => SUBTABS[d][0].id;

// Locked "sibling apps" switcher slot (future Arganta products).
export const SIBLING_APPS = [
  { id: 'energy', label: 'ArgantaEnergy', icon: Gauge, locked: false },
  { id: 'hq', label: 'Circle HQ', icon: Boxes, locked: true },
  { id: 'radar', label: 'Market Radar', icon: Radar, locked: true },
];

// Kept for any legacy import; governance content now lives at core/governance.
export const GOVERNANCE_ICON = ShieldCheck;
