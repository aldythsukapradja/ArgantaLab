import { useState } from 'react';
import { RESERVOIR_WORKFLOWS } from './workflow';
import { flattenWorkflow } from '../workspace-blueprint/types';
import { WorkflowRibbon } from '../workspace-blueprint/WorkflowRibbon';
import { WidgetBlueprintViewer } from '../workspace-blueprint/WidgetBlueprintViewer';

export function ReservoirWorkspace({ scope }: { scope: string }) {
  const tabs = flattenWorkflow(RESERVOIR_WORKFLOWS);
  const [active, setActive] = useState(tabs[0].id);
  const tab = tabs.find((candidate) => candidate.id === active) ?? tabs[0];
  const group = RESERVOIR_WORKFLOWS.find((candidate) => candidate.tabs.some((item) => item.id === tab.id)) ?? RESERVOIR_WORKFLOWS[0];
  return <div className="wsb-layout"><WorkflowRibbon groups={RESERVOIR_WORKFLOWS} active={tab.id} onSelect={setActive} label="Reservoir Management" /><WidgetBlueprintViewer group={group} tab={tab} scope={scope} /></div>;
}
