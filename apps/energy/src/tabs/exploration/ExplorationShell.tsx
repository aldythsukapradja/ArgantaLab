// Exploration S0: new scope-driven study shell. The original Volve workbench is
// preserved under Legacy (v1) until its deterministic engines are lifted into the
// corresponding study stages with typed artifact lineage.
import { lazy, Suspense, useEffect, useState } from 'react';
import {
  Activity, ArrowLeft, Box, Compass, Crosshair, History, LayoutDashboard,
  Map as MapIcon, PenLine, Sparkles, Waves,
} from 'lucide-react';
import { loadSearchIndex, type SearchEntry } from '../../cosmo/cockpit-search';
import { ExplorationScopeBar, ModeDossierBar, type ExplorationMode } from './HeaderBars';
import { LEGACY_TAB_NAMES } from './registry';
import { EXPLORATION_WORKFLOWS } from './workflow';
import { flattenWorkflow } from '../workspace-blueprint/types';
import { WorkflowTree } from '../workspace-blueprint/WorkflowTree';
import { WidgetBlueprintViewer } from '../workspace-blueprint/WidgetBlueprintViewer';
import { ExplorationKnowledgeBank } from './KnowledgeBank';
import type { ExplSel } from './legacy/ExplorationExplorer';
import './exploration-suite.css';

const LegacyExplorer = lazy(async () => ({ default: (await import('./legacy/ExplorationExplorer')).ExplorationExplorer }));
const LegacyExploration = lazy(async () => ({ default: (await import('./legacy/Exploration')).Exploration }));

const ICONS: Record<string, typeof Compass> = {
  Overview: LayoutDashboard, Basemap: MapIcon, Seismic: Waves, Wells: Activity,
  Interpretation: PenLine, 'Plays & Prospects': Crosshair, Volumetrics: Box,
  'Risk & Uncertainty': Sparkles,
};

export function ExplorationShell() {
  const [view, setView] = useState<'suite' | 'legacy'>('suite');
  const workflowTabs = flattenWorkflow(EXPLORATION_WORKFLOWS);
  const [stageId, setStageId] = useState(workflowTabs[0].id);
  const [mode, setMode] = useState<ExplorationMode>('knowledge');
  const [scope, setScope] = useState<SearchEntry | null>(null);
  const [legacyTab, setLegacyTab] = useState<string>('Overview');
  const [legacySel, setLegacySel] = useState<ExplSel>(null);

  useEffect(() => {
    loadSearchIndex().then((index) => {
      setScope((current) => current
        ?? index.find((entry) => entry.type === 'province' && entry.name === 'North Sea Graben')
        ?? index.find((entry) => entry.type === 'assessment-unit' && entry.name === 'Viking Graben')
        ?? index.find((entry) => entry.type === 'assessment-unit')
        ?? null);
    });
  }, []);

  if (!scope) {
    return <div className="exs-shell"><div className="exs-loading"><Compass size={22} /><b>Resolving the exploration scope…</b><span>Loading the OSDU-grounded world catalogue.</span></div></div>;
  }

  if (view === 'legacy') {
    return (
      <div className="exs-shell">
        <div className="exs-bar">
          <button className="exs-back-btn" onClick={() => setView('suite')}><ArrowLeft size={13} /> Back to Suite</button>
          <span className="exs-crumb"><span>Legacy (v1)</span><span className="sep">/</span><b>{legacyTab}</b></span>
          <span className="exs-spacer" />
          <span className="exs-legacy-note"><History size={12} /> Original Volve exploration workbench · deterministic engines preserved</span>
        </div>
        <div className="tabs">
          {LEGACY_TAB_NAMES.map((name) => {
            const Icon = ICONS[name] ?? Compass;
            return <div key={name} className={'tab' + (legacyTab === name ? ' on' : '')} onClick={() => setLegacyTab(name)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon size={13} />{name}</div>;
          })}
        </div>
        <div className="fd-body">
          <Suspense fallback={<div className="fd-explorer" />}><LegacyExplorer sel={legacySel} setSel={setLegacySel} /></Suspense>
          <div className="fd-canvas"><div className="fd-view">
            <Suspense fallback={<div className="exs-loading">Loading legacy viewer…</div>}><LegacyExploration tab={legacyTab} sel={legacySel} setSel={setLegacySel} /></Suspense>
          </div></div>
        </div>
      </div>
    );
  }

  const stage = workflowTabs.find((candidate) => candidate.id === stageId) ?? workflowTabs[0];
  const workflow = EXPLORATION_WORKFLOWS.find((candidate) => candidate.tabs.some((tab) => tab.id === stage.id)) ?? EXPLORATION_WORKFLOWS[0];
  return (
    <div className="exs-shell">
      <ExplorationScopeBar scope={scope} onSelectScope={setScope} onOpenLegacy={() => setView('legacy')} />
      <ModeDossierBar scope={scope} mode={mode} onChange={setMode} />
      {mode === 'knowledge' ? <ExplorationKnowledgeBank scope={scope} /> : (
        <div className="wsb-layout">
          <WorkflowTree groups={EXPLORATION_WORKFLOWS} active={stage.id} onSelect={setStageId} label="Exploration workflow" />
          <WidgetBlueprintViewer group={workflow} tab={stage} scope={scope.name} />
        </div>
      )}
    </div>
  );
}
