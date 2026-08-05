import type { LucideIcon } from 'lucide-react';

export type WidgetDisposition = 'reuse' | 'adapt' | 'new' | 'client-gated';

export interface WidgetBlueprint {
  title: string;
  purpose: string;
  /** What the concept doc PLANNED to feed this widget. Kept verbatim as reference. */
  dataSource: string;
  visual: string;
  library: string;
  component: string;
  disposition: WidgetDisposition;
  legacyReference: string;
  /** The file(s) and record counts that ACTUALLY resolve, audited against disk. */
  dataSourceActual?: string;
  /** Worst grade among this widget's inputs — never the best. */
  provenance?: 'SOURCED' | 'DERIVED' | 'RECALLED' | 'USER';
  /** Records behind the chart. Printed beside the provenance chip, always. */
  n?: number;
  /** Only present when the data falls short of the blueprint. Shown on the card. */
  remark?: string;
  /** One per tab. The hero takes the large cell; the other two stack beside it. */
  hero?: boolean;
}

export interface WorkflowTab {
  id: string;
  /** Formal stage title — still what the blueprint viewer heads its page with. */
  name: string;
  /** 1–2 words for the ribbon button. Falls back to `name`. */
  short?: string;
  /** 3–5 words shown in the ribbon's caption strip. Falls back to `purpose`. */
  blurb?: string;
  icon?: LucideIcon;
  purpose: string;
  software: string;
  output: string;
  legacyStrength: string;
  legacyGap: string;
  widgets: WidgetBlueprint[];
}

export interface WorkflowGroup {
  id: string;
  name: string;
  /** 1–2 words for the ribbon's group caption. Falls back to `name`. */
  short?: string;
  question: string;
  tabs: WorkflowTab[];
}

export const flattenWorkflow = (groups: WorkflowGroup[]) => groups.flatMap((group) => group.tabs);

export type WidgetAudit = Pick<WidgetBlueprint, 'dataSourceActual' | 'provenance' | 'n' | 'remark' | 'hero'>;

export const widget = (
  title: string, purpose: string, dataSource: string, visual: string, library: string,
  component: string, disposition: WidgetDisposition, legacyReference: string,
  audit: WidgetAudit = {},
): WidgetBlueprint => ({
  title, purpose, dataSource, visual, library, component, disposition, legacyReference, ...audit,
});
