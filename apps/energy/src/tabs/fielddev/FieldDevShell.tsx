// FieldDevShell — the Field Development Suite, rebuilt from scratch per
// FIELD-DEVELOPMENT-SUITE-CONCEPT.md. D0 (this file): the shell only — two header
// rows (navigation · case), the plan tree, the LOD canvas router, the permanent
// plan card, the evidence strip. No engine is wired yet; every number is an honest
// "awaiting" state, never a fabricated one. The old 13-tab workbench is parked,
// byte-for-byte, behind "Legacy (v1)" (hq ForgeShell pattern) — the guided tour in
// CosmoChat still drives it directly via driveLegacyTab/driveLegacyNonce, since
// that tour narrates the real, truth-locked engines that Legacy — not yet the new
// suite — actually contains.
//
// Scope is real, not mocked: `field` is resolved from the actual OSDU-grounded
// catalogue (src/cosmo/cockpit-search.ts, 7,787 real fields) and the suite requires
// one to render — Field Development operates at field granularity, so a field is
// mandatory. Volve pre-resolves as the sensible default (the one field with a full
// deep-dive bundle), but it is looked up from real data, never hard-coded; search
// genuinely re-scopes the whole shell to any field on earth.
import { lazy, Suspense, useEffect, useState } from 'react';
import {
  ArrowLeft, History, Globe2, Map as MapIcon, Activity, Gauge, Columns3, Layers,
  Grid3x3, Boxes, Waves, Box, Sparkles, LineChart, DollarSign, ClipboardCheck,
} from 'lucide-react';
import './fielddev-suite.css';
import { type Lod } from './registry';
import { FIELDDEV_WORKFLOWS } from './workflow';
import { flattenWorkflow } from '../workspace-blueprint/types';
import { WorkflowTree } from '../workspace-blueprint/WorkflowTree';
import { WidgetBlueprintViewer } from '../workspace-blueprint/WidgetBlueprintViewer';
import { ScopeBar, ModeDossierBar, type FieldDevMode } from './HeaderBars';
import { KnowledgeBank } from './KnowledgeBank';
import { DataQc } from '../../dataqc/DataQc';
import type { Sel } from '../../cosmo/CosmoExplorer';
import { loadSearchIndex, type SearchEntry } from '../../cosmo/cockpit-search';

const CosmoExplorer = lazy(async () => ({ default: (await import('../../cosmo/CosmoExplorer')).CosmoExplorer }));
const LegacyFieldDev = lazy(async () => ({ default: (await import('./legacy/FieldDev')).FieldDev }));

// Legacy's own 13-tab strip — unchanged from the old CosmoShell.FD_TABS, just moved
// here since the shell no longer owns a generic FD tab strip.
const LEGACY_TABS = [
  { id: 'map', label: 'Map', icon: MapIcon }, { id: 'logs', label: 'Logs', icon: Activity },
  { id: 'petrophysics', label: 'Petrophysics', icon: Gauge }, { id: 'correlation', label: 'Correlation', icon: Columns3 },
  { id: 'structural', label: 'Structural', icon: Layers }, { id: 'property', label: 'Property', icon: Grid3x3 },
  { id: 'gridmodel', label: 'Static Model', icon: Boxes }, { id: 'simulation', label: 'Simulation', icon: Waves },
  { id: 'volumetrics', label: 'Volumetrics', icon: Box }, { id: 'uncertainty', label: 'Uncertainty', icon: Sparkles },
  { id: 'forecast', label: 'Forecast', icon: LineChart }, { id: 'economics', label: 'Economics', icon: DollarSign },
  { id: 'review', label: 'Field Review', icon: ClipboardCheck },
];

export function FieldDevShell({ driveLegacyTab, driveLegacyNonce }: {
  /** guided-tour hooks — CosmoChat drives Legacy directly through these */
  driveLegacyTab?: string;
  driveLegacyNonce?: number;
}) {
  const [view, setView] = useState<'suite' | 'legacy'>('suite');
  const workflowTabs = flattenWorkflow(FIELDDEV_WORKFLOWS);
  const [stageId, setStageId] = useState(workflowTabs[0].id);
  const [lod] = useState<Lod>('L2');
  const [mode, setMode] = useState<FieldDevMode>('knowledge');
  const [legacyTab, setLegacyTab] = useState('map');
  const [sel, setSel] = useState<Sel>(null);

  const [field, setField] = useState<SearchEntry | null>(null);
  useEffect(() => {
    loadSearchIndex().then((index) => {
      setField((current) => current ?? index.find((e) => e.type === 'field' && e.name === 'VOLVE') ?? null);
    });
  }, []);

  useEffect(() => {
    if (driveLegacyNonce && driveLegacyNonce > 0 && driveLegacyTab) {
      setView('legacy');
      setLegacyTab(driveLegacyTab);
    }
  }, [driveLegacyNonce, driveLegacyTab]);

  const stage = workflowTabs.find((candidate) => candidate.id === stageId) ?? workflowTabs[0];
  const workflow = FIELDDEV_WORKFLOWS.find((candidate) => candidate.tabs.some((tab) => tab.id === stage.id)) ?? FIELDDEV_WORKFLOWS[0];

  if (view === 'legacy') {
    return (
      <div className="fds-shell">
        <div className="fds-bar">
          <button className="fds-back-btn" onClick={() => setView('suite')}><ArrowLeft size={13} /> Back to Suite</button>
          <span className="fds-crumb" style={{ marginLeft: 8 }}>
            <span>Legacy (v1)</span><span className="sep">/</span><b>{LEGACY_TABS.find((t) => t.id === legacyTab)?.label}</b>
          </span>
          <span className="fds-scope-spacer" />
          <span className="fds-persp-auto"><History size={12} /> the original Petrel-style workbench — every engine here is truth-locked and reused by the new suite</span>
        </div>
        <div className="tabs">
          {LEGACY_TABS.map((t) => (
            <div key={t.id} className={'tab' + (legacyTab === t.id ? ' on' : '')} onClick={() => setLegacyTab(t.id)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <t.icon size={13} />{t.label}
            </div>
          ))}
        </div>
        <div className="fd-body">
          <Suspense fallback={<div className="fd-explorer" />}>
            <CosmoExplorer sel={sel} setSel={setSel} />
          </Suspense>
          <div className="fd-canvas">
            <div className="fd-view">
              <Suspense fallback={<div className="fds-canvas-body"><span style={{ color: 'var(--ink3)', fontSize: 12 }}>Loading…</span></div>}>
                <LegacyFieldDev subtab={legacyTab} />
              </Suspense>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Field Development operates at field granularity — a field is mandatory to
  // render the suite. This is not a fake empty state: it is the real load of the
  // OSDU catalogue, resolving to Volve as the default the moment it lands.
  if (!field) {
    return (
      <div className="fds-shell">
        <div className="fds-gate">
          <div className="fds-canvas-empty">
            <div className="fds-canvas-ic"><Globe2 size={22} /></div>
            <b>Loading the world catalogue…</b>
            <span>Field Development operates at field granularity — resolving a field before the suite opens.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fds-shell">
      <ScopeBar field={field} onSelectField={setField} onOpenLegacy={() => setView('legacy')} />
      <ModeDossierBar field={field} mode={mode} onChange={setMode} />
      {mode === 'knowledge' ? <KnowledgeBank field={field} /> : (
        <div className="wsb-layout">
          <WorkflowTree groups={FIELDDEV_WORKFLOWS} active={stageId} onSelect={setStageId} label="Field Development" />
          {stage.id === 'client-data-qc' ? (
            // The first stage is no longer a blueprint card — it is the real, shared
            // client-data interface. Every other stage still renders its plan.
            <DataQc fieldId={field.id} fieldName={field.name} vertical="field-development" />
          ) : (
            <WidgetBlueprintViewer group={workflow} tab={stage} scope={`${field.name} · ${lod}`} />
          )}
        </div>
      )}
    </div>
  );
}
