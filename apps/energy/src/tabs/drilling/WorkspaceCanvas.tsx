import { CalendarClock, CircleDashed, Database, FileOutput } from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import type { DrillingSchedule } from './legacy/schedule-model';
import type { DrillingStage } from './registry';

export function WorkspaceCanvas({ stage, selection, schedule }: { stage: DrillingStage; selection: SearchEntry; schedule: DrillingSchedule | null }) {
  return <section className="drs-workspace-canvas"><header><div><span>{stage.phase} · drilling workspace</span><h2>{stage.name}</h2><p>{stage.blurb}</p></div><stage.icon size={22} /></header><div className="drs-workspace-body"><div className="drs-workspace-empty"><CalendarClock size={25} /><b>{selection.name} · {stage.name}</b><span>The evidence-native workspace is staged here. The complete rig-by-time scheduler, dashboards, milestones and revision history remain available under Legacy (v1).</span></div><aside className="drs-workspace-inputs"><div><Database size={13} /><span>Inputs</span><b>{schedule ? `${schedule.wells.length} wells · ${schedule.rigs.length} rig lanes · ${schedule.meta.proposals} approved proposals` : 'Awaiting linked drilling bundle'}</b></div><div><CircleDashed size={13} /><span>Decision state</span><b>Untouched</b></div><div><FileOutput size={13} /><span>Produces</span><b>{stage.output}</b></div></aside></div></section>;
}
