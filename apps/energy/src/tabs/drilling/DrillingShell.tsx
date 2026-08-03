import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft, CalendarClock, History } from 'lucide-react';
import { loadSearchIndex, type SearchEntry } from '../../cosmo/cockpit-search';
import { HeaderPlaceholder } from '../welldelivery/internal/HeaderPlaceholder';
import { DrillingScopeBar, ModeDossierBar, type DrillingMode } from './HeaderBars';
import { DrillingKnowledgeBank } from './KnowledgeBank';
import { DRILLING_WORKFLOWS } from './workflow';
import { flattenWorkflow } from '../workspace-blueprint/types';
import { WorkflowTree } from '../workspace-blueprint/WorkflowTree';
import { WidgetBlueprintViewer } from '../workspace-blueprint/WidgetBlueprintViewer';
import { buildSchedule, type DrillingSchedule } from './legacy/schedule-model';
import './drilling-suite.css';

const LegacyDrilling = lazy(async () => ({ default: (await import('./legacy/DrillingSequenceView')).DrillingSequenceView }));

export function DrillingShell() {
  const [view, setView] = useState<'suite' | 'legacy'>('suite');
  const [mode, setMode] = useState<DrillingMode>('knowledge');
  const [selection, setSelection] = useState<SearchEntry | null>(null);
  const [schedule, setSchedule] = useState<DrillingSchedule | null>(null);
  const workflowTabs = flattenWorkflow(DRILLING_WORKFLOWS);
  const [stageId, setStageId] = useState(workflowTabs[0].id);

  useEffect(() => {
    loadSearchIndex().then((index) => setSelection(index.find((entry) => entry.type === 'field' && entry.name.toUpperCase() === 'VOLVE') ?? index.find((entry) => entry.type === 'field') ?? null)).catch(() => setSelection(null));
    buildSchedule().then(setSchedule).catch(() => setSchedule(null));
  }, []);
  if (!selection) return <HeaderPlaceholder icon={CalendarClock} title="Resolving drilling programme…" detail="Loading the field/well catalogue and Volve schedule basis." />;
  if (view === 'legacy') return <div className="drs-shell"><div className="drs-bar"><button className="drs-back-btn" onClick={() => setView('suite')}><ArrowLeft size={13} /> Back to Suite</button><span className="drs-crumb"><span>Legacy (v1)</span><span className="sep">/</span><b>Original drilling sequence</b></span><span className="drs-spacer" /><span className="drs-legacy-note"><History size={12} /> Overview · Sequence · Rigs · Milestones · Revisions</span></div><Suspense fallback={<HeaderPlaceholder icon={History} title="Opening Legacy…" detail="Loading the preserved rig-by-time scheduler." />}><LegacyDrilling /></Suspense></div>;
  const linked = selection.name.toUpperCase() === 'VOLVE' || selection.source === 'Volve';
  const activeSchedule = linked ? schedule : null;
  const stage = workflowTabs.find((candidate) => candidate.id === stageId) ?? workflowTabs[0];
  const workflow = DRILLING_WORKFLOWS.find((candidate) => candidate.tabs.some((tab) => tab.id === stage.id)) ?? DRILLING_WORKFLOWS[0];
  return <div className="drs-shell"><DrillingScopeBar selection={selection} onSelect={setSelection} onOpenLegacy={() => setView('legacy')} /><ModeDossierBar selection={selection} schedule={activeSchedule} mode={mode} onChange={setMode} />{mode === 'knowledge' ? <DrillingKnowledgeBank selection={selection} schedule={activeSchedule} /> : <div className="wsb-layout"><WorkflowTree groups={DRILLING_WORKFLOWS} active={stage.id} onSelect={setStageId} label="Drilling" /><WidgetBlueprintViewer group={workflow} tab={stage} scope={selection.name} /></div>}</div>;
}
