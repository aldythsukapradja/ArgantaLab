import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Database, History } from 'lucide-react';
import { loadSearchIndex, type SearchEntry } from '../../cosmo/cockpit-search';
import { loadIndex } from '../../wb/load';
import type { WellRow } from '../../wb/types';
import { HeaderPlaceholder } from './internal/HeaderPlaceholder';
import { ModeDossierBar, WellScopeBar, type WellDeliveryMode } from './HeaderBars';
import { WellKnowledgeBank } from './KnowledgeBank';
import { WELLDELIVERY_WORKFLOWS } from './workflow';
import { flattenWorkflow } from '../workspace-blueprint/types';
import { WorkflowTree } from '../workspace-blueprint/WorkflowTree';
import { WidgetBlueprintViewer } from '../workspace-blueprint/WidgetBlueprintViewer';
import { loadCandidates } from './legacy/wdData';
import type { WdCandidate } from './legacy/types';
import './well-delivery-suite.css';

const LegacyWorkspace = lazy(async () => ({ default: (await import('./legacy/WellDeliveryWorkspace')).WellDeliveryWorkspace }));

const localWellName = (entry: SearchEntry) => entry.name.replace(/^15\/9-/, '');

export function WellDeliveryShell() {
  const [view, setView] = useState<'suite' | 'legacy'>('suite');
  const [mode, setMode] = useState<WellDeliveryMode>('knowledge');
  const [selection, setSelection] = useState<SearchEntry | null>(null);
  const [wells, setWells] = useState<WellRow[]>([]);
  const [wellName, setWellName] = useState('F-12');
  const [candidates, setCandidates] = useState<WdCandidate[]>([]);
  const workflowTabs = flattenWorkflow(WELLDELIVERY_WORKFLOWS);
  const [stageId, setStageId] = useState(workflowTabs[0].id);
  const [legacyTab, setLegacyTab] = useState('proposal');

  useEffect(() => {
    loadSearchIndex().then((search) => {
      setSelection((current) => current ?? search.find((entry) => entry.type === 'field' && entry.name.toUpperCase() === 'VOLVE') ?? search.find((entry) => entry.type === 'field') ?? null);
    }).catch(() => { /* catalogue gate remains visible */ });
    loadIndex().then((index) => {
      setWells(index.wells);
      if (!index.wells.some((well) => well.name === 'F-12')) setWellName(index.wells[0]?.name ?? '');
    }).catch(() => setWells([]));
    loadCandidates().then(setCandidates).catch(() => setCandidates([]));
  }, []);

  const selectedWell = useMemo(() => wells.find((well) => well.name === wellName) ?? null, [wellName, wells]);
  const activeWell = selection && (selection.name.toUpperCase() === 'VOLVE' || selection.source === 'Volve') ? selectedWell : null;
  const onSelectScope = (entry: SearchEntry) => {
    setSelection(entry);
    if (entry.type === 'wellbore' && entry.source === 'Volve') {
      const match = wells.find((well) => well.name === localWellName(entry));
      if (match) setWellName(match.name);
    }
  };

  if (!selection) return <HeaderPlaceholder icon={Database} title="Resolving field and well knowledge…" detail="Loading the OSDU-grounded field/well catalogue and the Volve design bundle." />;

  if (view === 'legacy') return <div className="wds-shell">
    <div className="wds-bar">
      <button className="wds-back-btn" onClick={() => setView('suite')}><ArrowLeft size={13} /> Back to Suite</button>
      <span className="wds-crumb"><span>Legacy (v1)</span><span className="sep">/</span><b>Original delivery workbench</b></span>
      <span className="wds-spacer" /><span className="wds-legacy-note"><History size={12} /> Proposal → Basis → Clearance → Steering → Debrief → Handover</span>
    </div>
    <Suspense fallback={<HeaderPlaceholder icon={History} title="Opening Legacy…" detail="Loading the preserved delivery workbench." />}>
      <LegacyWorkspace tab={legacyTab} setTab={setLegacyTab} />
    </Suspense>
  </div>;

  const stage = workflowTabs.find((candidate) => candidate.id === stageId) ?? workflowTabs[0];
  const workflow = WELLDELIVERY_WORKFLOWS.find((candidate) => candidate.tabs.some((tab) => tab.id === stage.id)) ?? WELLDELIVERY_WORKFLOWS[0];
  return <div className="wds-shell">
    <WellScopeBar selection={selection} onSelect={onSelectScope} onOpenLegacy={() => setView('legacy')} />
    <ModeDossierBar selection={selection} well={activeWell} mode={mode} onChange={setMode} />
    {mode === 'knowledge'
      ? <WellKnowledgeBank selection={selection} wells={wells} well={activeWell} onSelectWell={setWellName} candidates={candidates} />
      : <div className="wsb-layout"><WorkflowTree groups={WELLDELIVERY_WORKFLOWS} active={stage.id} onSelect={setStageId} label="Well Delivery" /><WidgetBlueprintViewer group={workflow} tab={stage} scope={selection.name} /></div>}
  </div>;
}
