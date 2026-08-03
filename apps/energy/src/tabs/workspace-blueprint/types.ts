export type WidgetDisposition = 'reuse' | 'adapt' | 'new' | 'client-gated';

export interface WidgetBlueprint {
  title: string;
  purpose: string;
  dataSource: string;
  visual: string;
  library: string;
  component: string;
  disposition: WidgetDisposition;
  legacyReference: string;
}

export interface WorkflowTab {
  id: string;
  name: string;
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
  question: string;
  tabs: WorkflowTab[];
}

export const flattenWorkflow = (groups: WorkflowGroup[]) => groups.flatMap((group) => group.tabs);

export const widget = (
  title: string, purpose: string, dataSource: string, visual: string, library: string,
  component: string, disposition: WidgetDisposition, legacyReference: string,
): WidgetBlueprint => ({ title, purpose, dataSource, visual, library, component, disposition, legacyReference });
