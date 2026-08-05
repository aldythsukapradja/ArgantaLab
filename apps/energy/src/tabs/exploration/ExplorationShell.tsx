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
import { WorkflowRibbon } from '../workspace-blueprint/WorkflowRibbon';
import { ExplorationKnowledgeBank } from './KnowledgeBank';
import { ExplorationControlRow } from './ControlRow';
import { StudyRunBar } from './StudyRunBar';
import { WidgetCanvas } from './WidgetCanvas';
import { useStudyRun } from './use-study-run';
import type { ExplSel } from './legacy/ExplorationExplorer';
import './exploration-suite.css';
import './exploration-canvas.css';
import '../../viz/viz.css';
import { useViewMode } from '../../cosmo/use-view-mode';
import { useScopeEntry } from '../../cosmo/use-scope-entry';

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
  // a Fieldcraft card shortcut can ask for the dossier or the workspace directly
  useViewMode('exploration', setMode);
  const [scope, setScope] = useState<SearchEntry | null>(null);
  // Follow the global scope: an agent turn (or ⌘K) that lands here must arrive
  // on the basin it named, not on whatever this shell defaulted to.
  useScopeEntry(['country', 'basin', 'assessmentUnit'], setScope);
  const [legacyTab, setLegacyTab] = useState<string>('Overview');
  const [legacySel, setLegacySel] = useState<ExplSel>(null);
  // The simulated study run drives the stage selection, so a run walks the
  // workspace stage by stage. Called before any early return — it is a hook.
  useStudyRun(scope?.name ?? 'the selected basin', setStageId);

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
  const heroWidget = stage.widgets.find((w) => w.hero) ?? stage.widgets[0];
  return (
    <div className="exs-shell">
      <ExplorationScopeBar scope={scope} onSelectScope={setScope} onOpenLegacy={() => setView('legacy')}>
        <ModeDossierBar scope={scope} mode={mode} onChange={setMode} />
      </ExplorationScopeBar>
      {mode === 'knowledge' ? <ExplorationKnowledgeBank scope={scope} onScope={setScope} /> : (
        // No left drawer: this vertical passes no tree, and reserving 180px for an
        // empty column cost the canvas more than a one-time width jump ever would.
        // Field Development still gets its column via `.has-drawer`.
        <div className="wsb-layout exc-layout">
          <WorkflowRibbon groups={EXPLORATION_WORKFLOWS} active={stage.id} onSelect={setStageId} label="Exploration workflow" />
          <ExplorationControlRow provenance={heroWidget.provenance ?? 'DERIVED'} n={heroWidget.n ?? 0} />
          <StudyRunBar activeStage={stage.id} />
          <WidgetCanvas tab={stage} scope={scope.name} />
        </div>
      )}
    </div>
  );
}
