// Config-driven nav — nav is DATA, not markup (the reusable Cosmo pattern).
import type { LucideIcon } from 'lucide-react';
import {
  LayoutGrid, Database, Network, BookOpen, Wrench, Circle, Layers,
  Bot, GraduationCap, ShieldCheck, Gauge, Boxes, Radar,
} from 'lucide-react';

export type DomainId =
  | 'foundation' | 'data' | 'schema' | 'knowledge' | 'workbench' | 'wells'
  | 'surfaces' | 'agents' | 'training' | 'audit';

// zone: the MOTHERSHIP is the platform OS (data+knowledge+agents+governance);
// VERTICALS are domain apps that launch from it (Workbench = Field Development, …).
export type Zone = 'platform' | 'vertical';

export interface DomainDef {
  id: DomainId;
  label: string;
  icon: LucideIcon;
  accent: string;          // css var name
  status: 'live' | 'stub';
  phase: string;           // e.g. 'P2' or 'P3+'
  zone: Zone;
  blurb: string;
}

// Domain tab bar + activity rail both render from this single array.
export const DOMAINS: DomainDef[] = [
  // ── MOTHERSHIP — ArgantaEnergy Core (CDF / Lumi / ADME equivalent) ──
  { id: 'foundation', label: 'Core', icon: LayoutGrid, accent: 'teal', status: 'live', phase: 'P2', zone: 'platform', blurb: 'Field overview, live data metrics, relational schema.' },
  { id: 'data', label: 'Data', icon: Database, accent: 'amber', status: 'live', phase: 'P2', zone: 'platform', blurb: 'Ingestion refinery — mirror ledger, decode stages, provenance.' },
  { id: 'schema', label: 'Schema', icon: Network, accent: 'blue', status: 'live', phase: 'M1', zone: 'platform', blurb: 'Semantic model — star schema, FK ledger, orphan counts (contract v1.0.0).' },
  { id: 'knowledge', label: 'Knowledge', icon: BookOpen, accent: 'violet', status: 'live', phase: 'P2', zone: 'platform', blurb: 'Vault + knowledge graph — notes, evidence, QC, archaeology.' },
  { id: 'agents', label: 'Agents', icon: Bot, accent: 'teal', status: 'stub', phase: 'P4', zone: 'platform', blurb: 'Deterministic-first tier ladder, truthful run envelope, approval gate.' },
  { id: 'audit', label: 'Governance', icon: ShieldCheck, accent: 'orange', status: 'stub', phase: 'P6', zone: 'platform', blurb: 'Evidence lineage, checks, contradiction flags, portability.' },
  // ── VERTICALS — domain apps inside the mothership ──
  { id: 'workbench', label: 'Field Development', icon: Wrench, accent: 'blue', status: 'stub', phase: 'V1', zone: 'vertical', blurb: 'Mini-Petrel: map → logs → structural → property → volumetrics → forecast → economics.' },
  { id: 'wells', label: 'Wells', icon: Circle, accent: 'blue', status: 'stub', phase: 'V1', zone: 'vertical', blurb: 'Cross-domain coverage matrix + identity notes.' },
  { id: 'surfaces', label: 'Surfaces', icon: Layers, accent: 'orange', status: 'stub', phase: 'V1', zone: 'vertical', blurb: 'Marker → datum/CRS → interpolation → derived surface.' },
  { id: 'training', label: 'Training', icon: GraduationCap, accent: 'rose', status: 'stub', phase: 'V2+', zone: 'vertical', blurb: 'Curriculum generator from brain + workbench.' },
];

// Locked "sibling apps" switcher slot (future Arganta products).
export const SIBLING_APPS = [
  { id: 'energy', label: 'ArgantaEnergy', icon: Gauge, locked: false },
  { id: 'hq', label: 'Circle HQ', icon: Boxes, locked: true },
  { id: 'radar', label: 'Market Radar', icon: Radar, locked: true },
];
