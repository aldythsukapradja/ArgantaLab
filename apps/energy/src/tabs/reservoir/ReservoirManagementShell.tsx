import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowLeft, Globe2, History } from 'lucide-react';
import { loadSearchIndex, type SearchEntry } from '../../cosmo/cockpit-search';
import { ReservoirContextBar, ReservoirScopeBar, type ReservoirMode } from './HeaderBars';
import { SurveillanceDossierView } from './SurveillanceDossier';
import { ReservoirWorkspace } from './Workspace';
import { RM_TAB_ORDER, RM_VIEWERS } from './registry';
import './reservoir-suite.css';
import { useViewMode } from '../../cosmo/use-view-mode';
import { useScopeEntry } from '../../cosmo/use-scope-entry';

const LegacyReservoirMgmt = lazy(async () => ({ default: (await import('./ReservoirMgmt')).ReservoirMgmt }));
const LegacyReservoirExplorer = lazy(async () => ({ default: (await import('./ReservoirExplorer')).ReservoirExplorer }));

export function ReservoirManagementShell() {
  const [view, setView] = useState<'suite' | 'legacy'>('suite');
  const [mode, setMode] = useState<ReservoirMode>('knowledge');
  // a Fieldcraft card shortcut can ask for the dossier or the workspace directly
  useViewMode('reservoir-management', setMode);
  const [legacyTab, setLegacyTab] = useState<string>('overview');
  const [field, setField] = useState<SearchEntry | null>(null);
  useScopeEntry(['field'], setField);
  useEffect(() => { void loadSearchIndex().then((index) => setField((current) => current ?? index.find((entry) => entry.type === 'field' && entry.name.toUpperCase() === 'VOLVE') ?? null)); }, []);

  if (view === 'legacy') return (
    <div className="rms-shell">
      <div className="rms-bar"><button className="rms-back" onClick={() => setView('suite')}><ArrowLeft size={13} /> Back to Suite</button><span className="rms-legacy-crumb">Legacy (v1) / <b>{RM_VIEWERS[legacyTab].label}</b></span><span className="rms-spacer" /><span className="rms-legacy-note"><History size={12} /> Original truth-locked Volve workbench</span></div>
      <div className="tabs">{RM_TAB_ORDER.map((id) => <div key={id} className={`tab${legacyTab === id ? ' on' : ''}`} onClick={() => setLegacyTab(id)}>{RM_VIEWERS[id].label}</div>)}</div>
      <div className="fd-body"><Suspense fallback={<div className="fd-explorer" />}><LegacyReservoirExplorer /></Suspense><div className="fd-canvas"><div className="fd-view"><Suspense fallback={<div className="rms-loading">Loading legacy workbench…</div>}><LegacyReservoirMgmt subtab={legacyTab} /></Suspense></div></div></div>
    </div>
  );

  if (!field) return <div className="rms-shell rms-gate"><Globe2 size={22} /><b>Loading the world field catalogue…</b><span>Reservoir Management opens at field level.</span></div>;
  return (
    <div className="rms-shell">
      <ReservoirScopeBar field={field} onSelectField={setField} onOpenLegacy={() => setView('legacy')}>
        <ReservoirContextBar field={field} mode={mode} onChange={setMode} />
      </ReservoirScopeBar>
      {mode === 'knowledge' ? <SurveillanceDossierView field={field} /> : <ReservoirWorkspace scope={field.name} />}
    </div>
  );
}
