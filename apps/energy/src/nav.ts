// Config-driven nav — nav is DATA, not markup (the reusable Cosmo pattern).
import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid, Database, Network, BookOpen, Wrench, Circle, Layers,
  Bot, GraduationCap, ShieldCheck, Gauge, Boxes, Radar,
} from 'lucide-react';

export type DomainId =
  | 'foundation' | 'data' | 'schema' | 'knowledge' | 'workbench' | 'wells'
  | 'surfaces' | 'agents' | 'training' | 'audit';

export interface DomainDef {
  id: DomainId;
  label: string;
  icon: LucideIcon;
  accent: string;          // css var name
  status: 'live' | 'stub';
  phase: string;           // e.g. 'P2' or 'P3+'
  blurb: string;
}

// Domain tab bar + activity rail both render from this single array.
export const DOMAINS: DomainDef[] = [
  { id: 'foundation', label: 'Foundation', icon: LayoutGrid, accent: 'teal', status: 'live', phase: 'P2', blurb: 'Field overview, live data metrics, relational schema.' },
  { id: 'data', label: 'Data', icon: Database, accent: 'amber', status: 'live', phase: 'P2', blurb: 'Inventory & provenance ledger — mirrored / selected / excluded.' },
  { id: 'schema', label: 'Schema', icon: Network, accent: 'blue', status: 'live', phase: 'M1', blurb: 'Semantic model — star schema, FK ledger, orphan counts (contract v1.0.0).' },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, accent: 'violet', status: 'live', phase: 'P2', blurb: 'Three-pane vault — notes, evidence packs, QC, archaeology.' },
  { id: 'workbench', label: 'Workbench', icon: Wrench, accent: 'blue', status: 'stub', phase: 'P3+', blurb: 'Mini-Petrel: map, logs, cross-section, trajectory, production.' },
  { id: 'wells', label: 'Wells', icon: Circle, accent: 'blue', status: 'stub', phase: 'P3+', blurb: 'Cross-domain coverage matrix + identity notes.' },
  { id: 'surfaces', label: 'Surfaces', icon: Layers, accent: 'orange', status: 'stub', phase: 'P3+', blurb: 'Marker → datum/CRS → interpolation → derived surface.' },
  { id: 'agents', label: 'Agents', icon: Bot, accent: 'teal', status: 'stub', phase: 'P4', blurb: 'Four-tier router rack, truthful run envelope, approval gate.' },
  { id: 'training', label: 'Training', icon: GraduationCap, accent: 'rose', status: 'stub', phase: 'P5', blurb: 'Curriculum generator from brain + workbench.' },
  { id: 'audit', label: 'Audit', icon: ShieldCheck, accent: 'orange', status: 'stub', phase: 'P6', blurb: 'Checks, provenance timeline, issues.' },
];

// Locked "sibling apps" switcher slot (future Arganta products).
export const SIBLING_APPS = [
  { id: 'energy', label: 'ArgantaEnergy', icon: Gauge, locked: false },
  { id: 'hq', label: 'Circle HQ', icon: Boxes, locked: true },
  { id: 'radar', label: 'Market Radar', icon: Radar, locked: true },
];
