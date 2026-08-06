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
import { WorkflowRibbon } from '../workspace-blueprint/WorkflowRibbon';
import { WidgetBlueprintViewer } from '../workspace-blueprint/WidgetBlueprintViewer';
import { ScopeBar, ModeDossierBar, type FieldDevMode } from './HeaderBars';
import { AssetDossier } from './AssetDossier';
import { DataExplorer } from './DataExplorer';
import { Petrophysics } from './Petrophysics';
import { FluidsRocks } from './FluidsRocks';
import { Simulation } from './Simulation';
import { Streamline } from './Streamline';
import { StaticModel } from './StaticModel';
import { InputTree } from './InputTree';
import type { Sel } from '../../cosmo/CosmoExplorer';
import { loadSearchIndex, type SearchEntry } from '../../cosmo/cockpit-search';
import { useViewMode } from '../../cosmo/use-view-mode';
import { useScopeEntry } from '../../cosmo/use-scope-entry';
import { useScene } from './scene';
import { ensureReferenceBundle, type BundleProgress } from '../../dataqc/ensureBundle';

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

/**
 * Stages that do NOT get the Input tree.
 *
 * The tree is an inventory of the delivery's spatial objects — wells, logs, surfaces,
 * picks — and it is a control: clicking a surface drapes it, clicking a top flattens
 * on it. A stage earns the tree by being able to act on those objects.
 *
 * Fluids & Rock cannot. Its inputs are the PVT block, the contacts and the pressure
 * records, none of which the tree offers a verb for, and its own rail already carries
 * every parameter the stage can change. A tree that greys out nine of its eleven
 * folders and does nothing when you click the other two is a 180px column of noise.
 * The Static Model likewise brings its own object tree.
 */
// Surfaces that carry their own tree. Showing the shared Input rail beside one
// puts two trees of the same data on screen and costs the canvas 200 px.
const NO_INPUT_TREE = new Set(['static-model-lite', 'fluids-rock', 'simulation-cases', 'history-uncertainty']);

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
  // a Fieldcraft card shortcut can ask for the dossier or the workspace directly
  useViewMode('field-development', setMode);
  const [legacyTab, setLegacyTab] = useState('map');
  const [sel, setSel] = useState<Sel>(null);

  const [field, setField] = useState<SearchEntry | null>(null);
  useScopeEntry(['field'], setField);
  useEffect(() => {
    loadSearchIndex().then((index) => {
      setField((current) => current ?? index.find((e) => e.type === 'field' && e.name === 'VOLVE') ?? null);
    });
  }, []);

  // The SHELL owns the scene's field, not the map. The Input tree is mounted on every
  // stage, so scoping the scene only when a map happened to mount left the tree empty
  // for anyone who opened Petrophysics before Data Explorer.
  const setSceneField = useScene((s) => s.setField);
  const bumpData = useScene((s) => s.bumpData);
  useEffect(() => { if (field) setSceneField(field.id); }, [field, setSceneField]);
  // …and for the same reason the delivery has to be digested because the FIELD is
  // open, not because a particular stage is showing. Cached in IndexedDB, so this is
  // paid once per browser per field and resumes if interrupted.
  // Visible, because an invisible ingest is indistinguishable from missing data.
  // The package is ~90 items and takes minutes in a browser that has never seen
  // it; until now that ran with no progress callback at all, so a fresh browser
  // showed an empty Data Explorer and an empty Input tree with no explanation and
  // the reasonable conclusion was "my data is gone".
  const [bundleProgress, setBundleProgress] = useState<BundleProgress | null>(null);
  useEffect(() => {
    if (!field) return;
    setBundleProgress(null);
    return ensureReferenceBundle(field.id, 'field-development', setBundleProgress, bumpData);
  }, [field, bumpData]);

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
      <ScopeBar field={field} onSelectField={setField} onOpenLegacy={() => setView('legacy')}>
        <ModeDossierBar field={field} mode={mode} onChange={setMode} />
      </ScopeBar>
      {bundleProgress && (
        <div className={'fds-ingest' + (bundleProgress.error ? ' bad' : '')}>
          {bundleProgress.error ? (
            <>
              <b>Reference package incomplete</b>
              <span>
                {bundleProgress.failed
                  ? `${bundleProgress.failed} of ${bundleProgress.total} items failed to digest`
                  : 'the package could not be read'} — {bundleProgress.error}
              </span>
            </>
          ) : (
            <>
              <b>Loading {bundleProgress.label}</b>
              <span>{bundleProgress.done}/{bundleProgress.total} digested — the workspace fills as it lands</span>
              <i style={{ width: `${bundleProgress.total ? (bundleProgress.done / bundleProgress.total) * 100 : 0}%` }} />
            </>
          )}
        </div>
      )}
      {mode === 'knowledge' ? <AssetDossier field={field} /> : (
        <div className={'wsb-layout' + (NO_INPUT_TREE.has(stage.id) ? ' no-drawer' : '')}>
          {/* The Static Model carries its own Model tree, which lists the same wells,
              surfaces and contacts plus the zones, properties and realisation the Input
              tree cannot know about. Showing both puts two trees of the same data on
              the same screen and costs the canvas 200 px for the privilege.
              Fluids & Rock has no use for it at all — see NO_INPUT_TREE. */}
          <WorkflowRibbon groups={FIELDDEV_WORKFLOWS} active={stageId} onSelect={setStageId} label="Field Development"
            drawer={NO_INPUT_TREE.has(stage.id) ? null : <InputTree stageId={stageId} />} />
          {stage.id === 'client-data-qc' ? (
            // The first stage is no longer a blueprint card — it is the real, shared
            // client-data interface.
            <DataExplorer field={field} />
          ) : stage.id === 'petrophysics-lite' ? (
            // Petrophysics is under construction as its own surface: the SHELL CANVAS
            // (layout + live data contract) is real, the interpretation engines land
            // behind it in P1–P9. See PETROPHYSICS-SUITE-CONCEPT.md.
            <Petrophysics field={field} />
          ) : stage.id === 'static-model-lite' ? (
            // the static modelling workflow: its shell canvas is real and its cell
            // budget is live arithmetic; the GeaVision Studio viewport is S2.
            <StaticModel field={field} />
          ) : stage.id === 'simulation-cases' ? (
            // The dynamic CORE: case → initialise → schedule → run → history match →
            // forecast. It wears the same shell as the Static Model, from the same
            // `studio-shell` code, so the two cannot drift apart.
            <Simulation field={field} />
          ) : stage.id === 'history-uncertainty' ? (
            // The drainage read of the SAVED run. It never re-solves: tracing a fresh
            // solve would describe a different realisation of the same recipe, and its
            // allocations would quietly disagree with the animation one tab over.
            <Streamline field={field} />
          ) : stage.id === 'fluids-rock' ? (
            // The dynamic model's rock-fluid basis is REAL: the delivery's own PVT
            // block, the rock-fluid functions over it, and the equilibration —
            // published as the one artifact every downstream run initialises from,
            // and checked against the field's measured gauge stations.
            <FluidsRocks field={field} />
          ) : (
            // every remaining stage still renders its plan
            <WidgetBlueprintViewer group={workflow} tab={stage} scope={`${field.name} · ${lod}`} />
          )}
        </div>
      )}
    </div>
  );
}
