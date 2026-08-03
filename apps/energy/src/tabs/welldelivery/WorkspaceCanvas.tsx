import { CircleDashed, Database, FileOutput, Route } from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import type { WellRow } from '../../wb/types';
import type { MaturationStage } from './registry';

export function WorkspaceCanvas({ stage, selection, well }: { stage: MaturationStage; selection: SearchEntry; well: WellRow | null }) {
  return <section className="wds-workspace-canvas">
    <header><div><span>{stage.phase} · maturation workspace</span><h2>{stage.name}</h2><p>{stage.blurb}</p></div><stage.icon size={22} /></header>
    <div className="wds-workspace-body">
      <div className="wds-workspace-empty"><Route size={24} /><b>{selection.name} · {well?.name ?? 'no reference well'}</b><span>The new evidence-native engine will be lifted into this stage. The complete original delivery workflow remains available under Legacy (v1).</span></div>
      <div className="wds-workspace-inputs">
        <div><Database size={13} /><span>Inputs</span><b>{well ? `Well header · TD · ${well.has.traj ? 'trajectory' : 'no trajectory'}` : 'Awaiting linked well evidence'}</b></div>
        <div><CircleDashed size={13} /><span>Decision state</span><b>Untouched</b></div>
        <div><FileOutput size={13} /><span>Produces</span><b>{stage.output}</b></div>
      </div>
    </div>
  </section>;
}
