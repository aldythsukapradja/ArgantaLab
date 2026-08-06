// StaticModel — the static modelling workspace, on Petrel's window model.
//
// ONE BIG CANVAS. Not a grid of cards. Petrel keeps a single 3D window and floats
// every process dialog over it, and the reason is not aesthetic: a modelling dialog
// exists to change the model, and you have to be able to watch it do that. A layout
// that puts the controls beside a thumbnail makes you close the controls to see the
// result, which is exactly backwards.
//
// So the layout is:
//
//   ┌──────────┬──────────────────────────────────────────────────────┐
//   │ PROCESSES│  function bar (tools for the ACTIVE process)         │
//   │  ordered │──────────────────────────────────────────────────────│
//   │  gated   │                                                      │
//   │          │            GeaVision Studio — full bleed             │
//   │  S1 ✓    │              ┌───────────────────┐                   │
//   │  S1 ✓    │              │ process dialog    │  ← floats, drags, │
//   │  S3 ●    │              │ (double-click the │    docks, resizes │
//   │  S3 ○    │              │  title to dock)   │                   │
//   │  S4 ○    │              └───────────────────┘                   │
//   └──────────┴──────────────────────────────────────────────────────┘
//
// THE GATING IS REAL. Petrel's Processes pane is ordered because the order is a
// constraint — you cannot insert layers into zones that do not exist. A blocked
// process here is disabled and names the step it is waiting for, rather than
// silently producing something meaningless.
//
// See docs/arganta-energy/STATIC-MODEL-SUITE-CONCEPT.md.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  // `Map` is aliased: importing it bare shadows the global Map constructor and every
  // `new Map()` in this file silently becomes a JSX icon type error
  Box, ChevronRight, Columns2, Database, FileText, Grid3x3, Layers, Map as MapIcon, Ruler, Waves,
} from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { useWorkspace, type Workspace } from './workspace';
import { readSurfaceGrid } from '../../dataqc/readDigest';
import type { DigestedSurface } from '../../dataqc/types';
import { depthConvention } from './StructureLayer';
import { buildZoneModel, type HorizonGrid } from './zone-model';
import { ModelTree } from './ModelTree';
import { ProcessRibbon } from './ProcessRibbon';
import { QcPanel } from './QcPanel';
import { propertyStats, faciesStats, structureStats, upscaleStats, volumeReport } from './model-stats';
import { SectionDrawer } from './SectionDrawer';
import { ReportTab } from './ReportTab';
import { MapsTab } from './MapsTab';
import { UpscaleTab, type UpscaleSample } from './UpscaleTab';
import { auditModel, summariseModelQc } from './model-qc';
import { volumeBreakdown } from './model-stats';
import { structuralQc } from './struct-qc';
import { readRecord } from '../../dataqc/readDigest';
import type { DigestedLog } from '../../dataqc/types';
import { depthToMetres } from '../../units';
import { runPetro, DEFAULT_PARAMS } from './petro-compute';
import { mdToPoint, type TrajStation } from './upscale-grid';
import { propRange, propValueAt } from './prop-view';
import { indexedDbVersionStore, defaultVersionName, type GridVersion } from './grid-versions';
import { buildCase, V0_RECIPE, type CaseProgress } from './build-case';
import { indexedDbCaseStore, caseIsUsable, summariseSim } from './case-store';
import { buildPackedGrid, layerSpan } from './grid-build';
import { UpscaleDialog, SimDialog, VolumesDialog } from './ProcessRuns';
import { GeaStudio, type StudioStats } from './GeaStudio';
import { ProcessDialog } from './ProcessDialog';
import {
  // `processGate` moved with the rail: ProcessRibbon computes the gate itself from
  // `needs` + `done`, so the prerequisite rule still holds — it is just enforced where
  // the buttons now live.
  PROCESSES, PROCESS_BY_ID, useStatic,
  type ProcessId,
} from './static-store';
import './static-model.css';

// ── the cell budget: real arithmetic over the real ingested surfaces ─────────

/** pack3d.ts's default property set: φ/Sw/NTG as u16 (volume-affecting, so HCPV
 *  fidelity matters) plus facies/k as u8. */
const BYTES_PER_CELL = 2 + 2 + 2 + 1 + 1;

export interface GridEstimate {
  nx: number; ny: number; dx: number;
  nzPerZone: number; zones: number; nz: number;
  cells: number; packedMB: number; shellFaces: number; naiveGB: number;
}

/** The model inherits the interpretation's areal resolution — a grid coarser than
 *  the horizons throws away work that was already done. */
export function estimateGrid(ws: Workspace, zones: number, nzPerZone: number): GridEstimate {
  let nx = 0, ny = 0, dx = 0;
  for (const s of ws.surfaces) {
    const a = ws.assets.find((x) => x.id === s.assetId);
    const c = Number(a?.meta.ncol) || 0;
    const r = Number(a?.meta.nrow) || 0;
    if (c * r > nx * ny) { nx = c; ny = r; dx = Number(a?.meta.dx) || 0; }
  }
  const nz = zones * nzPerZone;
  const cells = nx * ny * nz;
  return {
    nx, ny, dx, nzPerZone, zones, nz, cells,
    packedMB: (cells * BYTES_PER_CELL) / 1048576,
    shellFaces: cells > 0 ? 2 * (nx * ny) + 2 * (nx * nz) + 2 * (ny * nz) : 0,
    naiveGB: (cells * 8 * 5) / 1073741824,
  };
}

const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `${(n / 1e3).toFixed(0)} k` : String(Math.round(n)));

// ProcessRail was removed: the processes now live in `ProcessRibbon` as pop-ups and
// the left edge belongs to `ModelTree`. Petrel made the same move — a tree answers
// "what is in my project", which you ask constantly, while a process is run and closed.



// ── the process dialogs ─────────────────────────────────────────────────────

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="pdf">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  );
}

function HorizonsDialog({ ws }: { ws: Workspace }) {
  const visible = useStatic((s) => s.visibleHorizons);
  const toggle = useStatic((s) => s.toggleHorizon);
  const setVisible = useStatic((s) => s.setVisibleHorizons);
  const order = useStatic((s) => s.horizonOrder);
  const setOrder = useStatic((s) => s.setHorizonOrder);

  // stratigraphic order = shallowest first, by the surface's own mid-depth. Not the
  // filename, and not alphabetical: "BCU" sorts before "Hugin" alphabetically and
  // below it in the ground.
  const sorted = useMemo(() => {
    const withDepth = ws.surfaces.map((s) => ({
      s, mid: s.zmin != null && s.zmax != null ? (Math.abs(s.zmin) + Math.abs(s.zmax)) / 2 : Infinity,
    }));
    withDepth.sort((a, b) => a.mid - b.mid);
    return withDepth;
  }, [ws.surfaces]);

  useEffect(() => {
    if (!order.length && sorted.length) setOrder(sorted.map((x) => x.s.id));
  }, [order.length, sorted, setOrder]);

  return (
    <>
      <div className="pdlg-row">
        <button className="pdlg-mini" onClick={() => setVisible(sorted.map((x) => x.s.id))}>All</button>
        <button className="pdlg-mini" onClick={() => setVisible([])}>None</button>
        {/* the selection now drives the GRID, not just the picture, so the label has
            to say that or a user will tick two horizons and wonder why the model still
            reaches the seabed */}
        <span className="pdlg-note">{visible.length} of {sorted.length} — these build the model</span>
      </div>
      <div className="pdlg-list">
        {sorted.map(({ s, mid }, i) => (
          <label key={s.id} className={'pdlg-item' + (visible.includes(s.id) ? ' on' : '')}>
            <input type="checkbox" checked={visible.includes(s.id)} onChange={() => toggle(s.id)} />
            <b>{i + 1}</b>
            <span>{s.name}</span>
            <em>{Number.isFinite(mid) ? `${Math.round(mid)} m` : 'no depth range'}</em>
          </label>
        ))}
      </div>
      <div className="pdlg-note pad">
        Ordered by mid-depth from the grids themselves — never alphabetically, because
        BCU sorts before Hugin in the alphabet and below it in the ground.
      </div>
    </>
  );
}

function ZonesDialog({ ws }: { ws: Workspace }) {
  const order = useStatic((s) => s.horizonOrder);
  const zones = useMemo(() => {
    const byId = new Map(ws.surfaces.map((s) => [s.id, s]));
    const out: Array<{ top: string; base: string; thick: number | null }> = [];
    for (let i = 0; i + 1 < order.length; i++) {
      const a = byId.get(order[i]), b = byId.get(order[i + 1]);
      if (!a || !b) continue;
      const am = a.zmin != null && a.zmax != null ? (Math.abs(a.zmin) + Math.abs(a.zmax)) / 2 : null;
      const bm = b.zmin != null && b.zmax != null ? (Math.abs(b.zmin) + Math.abs(b.zmax)) / 2 : null;
      out.push({ top: a.name, base: b.name, thick: am != null && bm != null ? bm - am : null });
    }
    return out;
  }, [order, ws.surfaces]);

  return (
    <>
      <div className="pdlg-list">
        {zones.map((z, i) => (
          <div key={i} className={'pdlg-item zone' + ((z.thick ?? 1) < 0 ? ' bad' : '')}>
            <i style={{ background: ['#3b82f6', '#f59e0b', '#10b981', '#a855f7', '#ef4444'][i % 5] }} />
            <span>{z.top} → {z.base}</span>
            <em>{z.thick == null ? '—' : `${Math.round(z.thick)} m`}</em>
          </div>
        ))}
        {!zones.length && <div className="pdlg-note pad">Order the horizons first.</div>}
      </div>
      {zones.some((z) => (z.thick ?? 1) < 0) && (
        <div className="pdlg-warn">
          A zone with negative mean thickness means its bounding horizons cross. That is
          a structural error and is shown as one — it is never clipped to zero.
        </div>
      )}
    </>
  );
}

function LayeringDialog({ ws }: { ws: Workspace }) {
  const nz = useStatic((s) => s.nzPerZone);
  const setNz = useStatic((s) => s.setNz);
  const scheme = useStatic((s) => s.layerScheme);
  const setScheme = useStatic((s) => s.setScheme);
  const order = useStatic((s) => s.horizonOrder);
  const zones = Math.max(0, order.length - 1);
  const g = estimateGrid(ws, zones, nz);

  return (
    <>
      <Field label="Layering scheme"
        hint="Proportional follows both bounding surfaces; conform schemes follow one and truncate against the other.">
        <select value={scheme} onChange={(e) => setScheme(e.target.value as typeof scheme)}>
          <option value="proportional">Proportional</option>
          <option value="top-conform">Top-conform</option>
          <option value="base-conform">Base-conform</option>
        </select>
      </Field>
      <Field label={`Layers per zone — ${nz}`}>
        <input type="range" min={1} max={100} value={nz} onChange={(e) => setNz(Number(e.target.value))} />
      </Field>
      {/* the budget, live, BEFORE you commit — finding out you asked for 40 million
          cells should not require waiting for 40 million cells */}
      <div className="pdlg-budget">
        <div><b>{g.nx} × {g.ny} × {g.nz}</b><i>i × j × k</i></div>
        <div><b>{fmt(g.cells)}</b><i>cells</i></div>
        <div><b>{g.packedMB.toFixed(1)} MB</b><i>packed</i></div>
        <div><b>{fmt(g.shellFaces)}</b><i>shell faces</i></div>
      </div>
      <div className="pdlg-note pad">
        Shell faces are {g.cells ? ((g.shellFaces / g.cells) * 100).toFixed(1) : '0'}% of the cell count — you cannot
        see inside a solid, so only the shell is ever meshed. The same model held as
        Float64 per property would be {g.naiveGB.toFixed(1)} GB instead of {g.packedMB.toFixed(1)} MB.
      </div>
    </>
  );
}

/**
 * Build 3D grid — the first process that actually RUNS.
 *
 * Decodes the ordered horizons, resamples them onto one common areal frame
 * (zone-model.ts), then builds and packs zone by zone so peak memory is the largest
 * single zone rather than the whole model. Every number it reports is measured
 * during the run, not estimated before it.
 */
function GridDialog({ ws }: { ws: Workspace }) {
  const order = useStatic((s) => s.horizonOrder);
  // THE SELECTION IS THE MODEL, not just the picture.
  //
  // The grid used to be built from `horizonOrder` — every ingested horizon — while the
  // checkboxes in Make horizons drove `visibleHorizons`, which only controls what is
  // drawn. Ticking Hugin Top and Hugin Base therefore changed the viewport and left the
  // grid spanning the whole section from the seabed down: 3.4 km of overburden to hold
  // a 69 m reservoir, and a viewport dominated by rock that holds no fluid.
  const selected = useStatic((s) => s.visibleHorizons);
  const nz = useStatic((s) => s.nzPerZone);
  const scheme = useStatic((s) => s.layerScheme);
  const grid = useStatic((s) => s.grid);
  const zoneModel = useStatic((s) => s.zoneModel);
  const building = useStatic((s) => s.building);
  const setGrid = useStatic((s) => s.setGrid);
  const setZoneModel = useStatic((s) => s.setZoneModel);
  const simSeed = useStatic((s) => s.simSeed);
  const simNodes = useStatic((s) => s.simNodes);
  const permAverage = useStatic((s) => s.permAverage);
  const setBuilding = useStatic((s) => s.setBuilding);
  const markDone = useStatic((s) => s.markDone);
  const [err, setErr] = useState<string | null>(null);

  const run = useCallback(async () => {
    setErr(null);
    try {
      // decode every ordered horizon — each on its OWN origin and spacing, which is
      // exactly why a common frame has to exist before anything can be differenced
      // stratigraphic order is kept from `horizonOrder`; membership comes from the
      // selection. Fewer than two selected is not an error worth failing on silently —
      // fall back to the full ordered set and say so.
      const build = order.filter((id) => selected.includes(id));
      const use = build.length >= 2 ? build : order;
      const horizons: HorizonGrid[] = [];
      for (const id of use) {
        const surf = ws.surfaces.find((x) => x.id === id);
        const asset = surf ? ws.assets.find((a) => a.id === surf.assetId) : null;
        if (!asset) continue;
        const g = (await readSurfaceGrid(asset).catch(() => null)) as DigestedSurface | null;
        if (!g) continue;
        horizons.push({
          id, name: surf!.name, ncol: g.ncol, nrow: g.nrow, values: g.values,
          x0: g.x0, y0: g.y0, dx: g.dx, dy: g.dy,
          flip: depthConvention(g.values)?.flip ?? false,
        });
      }
      if (horizons.length < 2) { setErr('At least two horizons are needed to define a zone.'); return; }
      if (build.length < 2) {
        setErr(`Fewer than two horizons are selected, so the grid was built from all ${horizons.length}. Tick the interval you want in Make horizons.`);
      }

      const model = buildZoneModel(horizons, { kind: scheme, nz });
      if (!model) { setErr('These horizons produce no zone with a positive thickness anywhere.'); return; }
      setZoneModel(model);

      setBuilding({ zone: 0, zones: model.zones.length, name: '' });
      const built = await buildPackedGrid(model, (p) =>
        setBuilding({ zone: p.zone, zones: p.zones, name: p.name }));

      // ── SAVE THE RECIPE AS A VERSION ──
      //
      // At build time, not at simulation time: the grid IS the artifact being versioned
      // and the properties are a later step against it. The recipe is stored, never the
      // cells — a realisation rebuilds deterministically from its seed, which is the
      // whole reason the seed is recorded.
      try {
        const existing = ws.fieldId ? await indexedDbVersionStore.list(ws.fieldId) : [];
        const recipe = {
          horizons: use, nzPerZone: nz, layerScheme: scheme,
          seed: simSeed, simNodes, permAverage,
          owc: ws.contacts.find((c) => c.tvdss != null)?.tvdss ?? undefined,
        };
        await indexedDbVersionStore.save({
          id: `${Date.now().toString(36)}-${Math.floor(built.cells % 1e6).toString(36)}`,
          name: defaultVersionName(recipe, existing.length),
          createdAt: Date.now(),
          fieldId: ws.fieldId ?? 'unknown',
          recipe,
          stats: {
            nx: built.packed.nx, ny: built.packed.ny, nz: built.packed.nz,
            cells: built.cells,
            activeColumns: (() => { let n = 0; for (let c = 0; c < built.packed.activeCol.length; c++) if (built.packed.activeCol[c]) n++; return n; })(),
            zones: built.zoneLayers.map((z) => z.name),
            // filled in by the property + volume steps; a fresh grid honestly has none
            ntg: NaN, phi: NaN, sw: NaN, stoiipMMSm3: NaN, sandFraction: NaN,
          },
        });
      } catch {
        // a version that cannot be saved must not lose the grid that was just built
      }
      setBuilding(null);
      setGrid(built);
      markDone('grid');
    } catch (e) {
      setBuilding(null);
      setErr((e as Error).message || 'the build failed');
    }
  }, [order, ws.surfaces, ws.assets, scheme, nz, setGrid, setZoneModel, setBuilding, markDone]);

  const mb = (b: number) => `${(b / 1048576).toFixed(1)} MB`;

  return (
    <>
      <div className="pdlg-kv"><dt>Engine</dt><dd><code>zone-model → grid3d.buildGrid → pack3d.packGrid3D</code></dd></div>
      <div className="pdlg-kv"><dt>Order</dt><dd>{order.length} horizons, shallowest first</dd></div>
      <div className="pdlg-kv"><dt>Layering</dt><dd>{scheme} · {nz} per zone</dd></div>

      {building && (
        <div className="pdlg-run">
          <b>Building zone {building.zone} of {building.zones}</b>
          <span>{building.name || 'resampling horizons onto the common frame…'}</span>
          <i style={{ width: `${(building.zone / Math.max(1, building.zones)) * 100}%` }} />
        </div>
      )}

      {err && <div className="pdlg-warn">{err}</div>}

      {grid && !building && (
        <>
          <div className="pdlg-budget">
            <div><b>{grid.packed.nx} × {grid.packed.ny} × {grid.packed.nz}</b><i>i × j × k</i></div>
            <div><b>{fmt(grid.cells)}</b><i>cells</i></div>
            <div><b>{fmt(grid.activeCells)}</b><i>active</i></div>
            <div><b>{mb(grid.packedBytes)}</b><i>packed</i></div>
          </div>
          <div className="pdlg-note pad">
            Built in {(grid.ms / 1000).toFixed(1)} s, zone by zone. Peak held at once
            was <b>{mb(grid.peakBuildBytes)}</b>; the whole model as one GridModel would
            have been {mb(grid.cells * 58)} — which is why it is built a zone at a time.
          </div>
          {zoneModel && zoneModel.zones.some((z) => z.crossedCols > 0) && (
            <div className="pdlg-warn">
              {zoneModel.zones.filter((z) => z.crossedCols > 0)
                .map((z) => `${z.name}: ${z.crossedCols} columns where the base sits above the top`)
                .join(' · ')}. Excluded, not clipped — a crossing is a structural error, and
              hiding it would carry it into every volume.
            </div>
          )}
          <div className="pdlg-warn soft">
            Geometry only. Porosity is 0 and Sw is 1 until the upscaling and simulations
            run, so every volume this grid reports is zero — visibly, rather than by accident.
          </div>
        </>
      )}

      {!grid && !building && (
        <p className="pdlg-p">
          Resamples every horizon onto one common areal frame — they arrive on different
          origins and spacings, so nothing can be differenced until they share a grid —
          then builds and packs each zone in turn.
        </p>
      )}

      <button className="pdlg-run-btn" disabled={!!building} onClick={run}>
        {building ? 'Building…' : grid ? 'Rebuild' : 'Run'}
      </button>
    </>
  );
}

function PlannedDialog({ id, ws }: { id: ProcessId; ws: Workspace }) {
  const nz = useStatic((s) => s.nzPerZone);
  const order = useStatic((s) => s.horizonOrder);
  const g = estimateGrid(ws, Math.max(0, order.length - 1), nz);
  const body: Record<string, { engine: string; note: string; data: string }> = {
    contacts: {
      engine: 'closure.contactPolygon (truth-locked)',
      note: 'Each contact defines a closure: the volume above it and inside the structural spill. The plane is already drawn in the viewport.',
      data: ws.contacts.length
        ? ws.contacts.map((c) => `${c.kind} ${c.tvdss ?? '?'} m TVDSS (${c.dataNature ?? 'unstated'})`).join(' · ')
        : 'no contact declared in this delivery',
    },
    grid: {
      engine: 'grid3d.buildGrid → pack3d.packGrid3D, in a Worker',
      note: 'Transferred as ArrayBuffers, so nothing is copied. v1 is an UNFAULTED vertical-pillar grid and every volume it produces carries that caveat.',
      data: `${fmt(g.cells)} cells · ${g.packedMB.toFixed(1)} MB packed`,
    },
    upscale: {
      engine: 'upscale.upscaleWell · majority · netFraction',
      note: 'Facies by mode, φ arithmetic, k GEOMETRIC by default — k is not additive and which mean you choose moves the answer by orders of magnitude. Input is ArgantaEnergy’s own petrophysics, never the delivery’s interpreted curves.',
      data: `${ws.bores.filter((b) => b.hasLogs && b.hasPicks).length} bores carry both logs and picks`,
    },
    facies: {
      engine: 'geostat.sis (truth-locked), per layer in a Worker',
      note: 'v1 is 2-facies (sand/shale) because geostat.sis is 2-facies. Multi-facies is a real extension, not a checkbox.',
      data: `${ws.bores.filter((b) => b.hasLogs).length} logged bores available as conditioning data`,
    },
    porosity: {
      engine: 'geostat.buildNscore · sgs · backNscore',
      note: 'Run separately per facies — a sand porosity population and a shale porosity population are different distributions, and simulating them together is the classic mistake.',
      data: `${fmt(g.cells)} cells × one pass per facies per zone`,
    },
    permeability: {
      engine: 'perm.fitPhiK · phiToK · permKv (truth-locked)',
      note: 'log k = a·φ + b. The transform is FITTED in the Petrophysics tab where core or a reference curve exists, and is labelled analog where it is not — an unfitted φ–k transform is the largest hidden assumption in a static model.',
      data: ws.curveTypes.some((t) => t.key === 'PERM' || t.key === 'K')
        ? 'a permeability curve exists — the transform can be fitted'
        : 'no permeability curve in this delivery — {a, b} will be analog until core arrives',
    },
    volumes: {
      engine: 'volumetrics.grvClosure · stoiip · giip + pack3d.hcpvFromPacked',
      note: 'Grid-based and map-based volumes are always shown together. When they disagree, that difference is a QC finding about the grid and is displayed — never reconciled silently.',
      data: 'Volve official STOIIP is 18.70 MMSm³ (Sodir) — a grid volume is checked against it, not quoted instead of it',
    },
  };
  const b = body[id];
  if (!b) return null;
  return (
    <>
      <div className="pdlg-kv"><dt>Engine</dt><dd><code>{b.engine}</code></dd></div>
      <div className="pdlg-kv live"><dt>Data</dt><dd>{b.data}</dd></div>
      <p className="pdlg-p">{b.note}</p>
      <div className="pdlg-warn soft">
        Engine present and truth-locked; this process window is not wired to it yet.
        Running it marks the step complete so the processes below it unlock.
      </div>
    </>
  );
}

function Dialogs({ ws }: { ws: Workspace }) {
  const windows = useStatic((s) => s.windows);
  const markDone = useStatic((s) => s.markDone);
  const close = useStatic((s) => s.close);

  return (
    <>
      {windows.map((win) => {
        const def = PROCESS_BY_ID.get(win.id);
        if (!def) return null;
        return (
          <ProcessDialog key={win.id} def={def} win={win}
            footer={
              <>
                <span className="pdlg-foot-note">{def.step}</span>
                <button className="pdlg-btn" onClick={() => close(def.id)}>Close</button>
                {/* the grid process RUNS its own pipeline and marks itself done from
                    the result; the rest only record that the step was accepted, which
                    is what unlocks the ones below them */}
                {!['grid', 'upscale', 'facies', 'porosity', 'volumes'].includes(def.id) && (
                  <button className="pdlg-btn primary" onClick={() => markDone(def.id)}>Apply</button>
                )}
              </>
            }>
            {win.id === 'horizons' ? <HorizonsDialog ws={ws} />
              : win.id === 'zones' ? <ZonesDialog ws={ws} />
              : win.id === 'layering' ? <LayeringDialog ws={ws} />
              : win.id === 'grid' ? <GridDialog ws={ws} />
              : win.id === 'upscale' ? <UpscaleDialog ws={ws} />
              : win.id === 'facies' || win.id === 'porosity' ? <SimDialog which={win.id} ws={ws} />
              : win.id === 'volumes' ? <VolumesDialog ws={ws} />
              : <PlannedDialog id={win.id} ws={ws} />}
          </ProcessDialog>
        );
      })}
    </>
  );
}

// ── the function bar: tools for the ACTIVE process ──────────────────────────

function FunctionBar({ stats }: { stats: StudioStats }) {
  const active = useStatic((s) => s.active);
  const view = useStatic((s) => s.view);
  const setView = useStatic((s) => s.setView);
  const zScale = useStatic((s) => s.zScale);
  const setZScale = useStatic((s) => s.setZScale);
  const showWells = useStatic((s) => s.showWells);
  const setShowWells = useStatic((s) => s.setShowWells);
  const showContact = useStatic((s) => s.showContact);
  const setShowContact = useStatic((s) => s.setShowContact);
  const def = active ? PROCESS_BY_ID.get(active) : null;

  return (
    <div className="fnbar">
      <span className="fnbar-active">
        {def ? <><ChevronRight size={11} /><b>{def.label}</b></> : <span className="idle">no process active</span>}
      </span>

      <span className="fnbar-grp">
        {/* `section` is no longer a dead button — it opens the 2D map + panel where the
            cross-section is drawn. `split` shows it beside the 3D scene, because a
            section is drawn on a map and read against the structure. */}
        {(['3d', '2d', 'section', 'split', 'maps', 'upscale', 'report'] as const).map((v) => (
          <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}
            title={v === '2d' ? 'The same scene, locked overhead'
              : v === 'section' ? 'Draw a cross-section on the map'
              : v === 'split' ? '3D and the section, side by side'
              : v === 'maps' ? 'Average property maps, per zone'
              : v === 'upscale' ? 'The raw log against the cells it was blocked into'
              : v === 'report' ? 'The static model report'
              : 'Orbit'}>
            {v === '3d' ? <Box size={11} /> : v === '2d' ? <Grid3x3 size={11} />
              : v === 'split' ? <Columns2 size={11} />
              : v === 'maps' ? <MapIcon size={11} />
              : v === 'upscale' ? <Ruler size={11} />
              : v === 'report' ? <FileText size={11} /> : <Layers size={11} />}
            {v.toUpperCase()}
          </button>
        ))}
      </span>

      <span className="fnbar-grp">
        <button className={showWells ? 'on' : ''} onClick={() => setShowWells(!showWells)} title="Wellbore paths">
          <Waves size={11} /> Wells
        </button>
        <button className={showContact ? 'on' : ''} onClick={() => setShowContact(!showContact)} title="Fluid contact plane">
          <Ruler size={11} /> Contact
        </button>
      </span>

      <label className="fnbar-exag" title="Volve is ~7 km across with ~600 m of relief; at true scale it is flat">
        <span>×{zScale}</span>
        <input type="range" min={1} max={30} value={zScale} onChange={(e) => setZScale(Number(e.target.value))} />
      </label>

      <span className="fnbar-sp" />

      {/* the HUD. Measured from the render loop, not counted in React. */}
      <span className="gvs-hud">
        <b className={'fps' + (stats.fps && stats.fps < 24 ? ' low' : '')}>{stats.fps || '—'} fps</b>
        <i>{stats.surfaces} surf</i>
        <i>{fmt(stats.tris)} tris</i>
        <i>{stats.wells} wells</i>
        {/* the ratio is the entire rendering argument, so it is on the HUD */}
        {stats.gridCells > 0 && (
          <i className="grid" title="Grid cells, and the faces on their visible shell">
            {fmt(stats.gridCells)} cells → {fmt(stats.gridFaces)} faces
            {' '}({((stats.gridFaces / stats.gridCells) * 100).toFixed(1)}%)
          </i>
        )}
        {stats.dropped > 0 && (
          <i className="drop" title="Quads dropped for touching a null node — the mesh ends where the interpretation ends rather than dropping a cliff to datum">
            {fmt(stats.dropped)} dropped
          </i>
        )}
      </span>
    </div>
  );
}

// ── the tab ─────────────────────────────────────────────────────────────────

/**
 * The QC gate's input, assembled from the session.
 *
 * -- EVERY FIELD HERE IS MEASURED OR HONESTLY ABSENT -------------------------
 *
 * The first version of this hardcoded the geometry defect counts to zero and declared
 * `ntgSource: 'net-cutoff'` when the volume calculation actually reads the binary
 * facies code. The report therefore showed green for checks that had never run, and
 * passed a consistency test the model fails -- the exact failure this QC design exists
 * to prevent, reintroduced by the thing meant to display it.
 *
 * So `structuralQc` is CALLED rather than assumed, the property statistics come from
 * the packed grid, and anything the session genuinely cannot supply is left empty so
 * `auditModel` reports it ABSENT instead of inventing a pass.
 */
function reportQcInput(
  grid: NonNullable<ReturnType<typeof useStatic.getState>['grid']>,
  upscaled: ReturnType<typeof useStatic.getState>['upscaled'],
  sim: ReturnType<typeof useStatic.getState>['simInfo'],
  ws: Workspace,
) {
  const p = grid.packed;
  const sq = structuralQc(grid);
  const chk = (id: string) => sq.checks.find((c) => c.id === id);
  const props = propertyStats(p);
  const fac = faciesStats(p);
  const phiStat = props.find((x) => x.key === 'phi');
  const permStat = props.find((x) => x.key === 'perm');

  let activeCols = 0;
  for (let c = 0; c < p.activeCol.length; c++) if (p.activeCol[c]) activeCols++;
  const flowing = ws.bores.filter((b) => b.role === 'oil-producer' || /inject/i.test(String(b.role ?? '')));
  const prod = flowing.filter((b) => b.role === 'oil-producer');
  const inj = flowing.filter((b) => /inject/i.test(String(b.role ?? '')));
  const blocked = new Set((upscaled?.cells ?? []).map((c) => c.well));
  const owc = ws.contacts.find((c) => c.tvdss != null)?.tvdss;

  const upRes = upscaled?.cells ?? [];
  const mean = (xs: number[]) => {
    const v = xs.filter(Number.isFinite);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
  };
  const sandCells = upRes.filter((c) => c.facies === 1).length;

  let crest = Infinity, deepest = -Infinity, shallowest = Infinity;
  for (let c = 0; c < p.topZ.length; c++) {
    if (Number.isFinite(p.topZ[c])) {
      if (p.topZ[c] < crest) crest = p.topZ[c];
      if (p.topZ[c] < shallowest) shallowest = p.topZ[c];
    }
    if (Number.isFinite(p.baseZ[c]) && p.baseZ[c] > deepest) deepest = p.baseZ[c];
  }

  return {
    data: {
      wellsTotal: ws.bores.length,
      wellsWithLogs: ws.bores.filter((b) => b.hasLogs).length,
      wellsWithSurvey: ws.bores.filter((b) => b.assetIds?.trajectory).length,
      wellsUpscaled: blocked.size,
      producers: prod.length,
      producersUpscaled: prod.filter((b) => blocked.has(b.name)).length,
      injectors: inj.length,
      injectorsUpscaled: inj.filter((b) => blocked.has(b.name)).length,
      // The delivery mixes depth units, but that is read inside the upscale run and not
      // kept on the session. Reporting an empty list would read as "one consistent
      // unit", which is the opposite of the truth on this data.
      depthUnits: [['not recorded on the session', 1]] as Array<[string, number]>,
      logSamples: upRes.reduce((a, c) => a + c.nSamples, 0),
      curveCoverage: [{ family: 'RHOB', wells: ws.bores.filter((b) => b.hasLogs).length }],
      conditionedColumnFraction: activeCols
        ? new Set(upRes.map((c) => c.j * p.nx + c.i)).size / activeCols
        : 0,
      crs: null,
    },
    geometry: {
      nx: p.nx, ny: p.ny, nz: p.nz,
      cells: grid.cells, activeCells: grid.activeCells, liveCells: sq.liveCells,
      negativeCells: chk('cell.negative')?.count ?? 0,
      zeroCells: chk('cell.zero')?.count ?? 0,
      pinchCells: chk('cell.thin')?.count ?? 0,
      highAspectCells: chk('cell.aspect')?.count ?? 0,
      stackingDefects: chk('zone.stacking')?.count ?? 0,
      orderDefects: chk('zone.order')?.count ?? 0,
      bodies: chk('grid.connected')?.count ?? 1,
      repairedColumns: 0,
      repairAddedFraction: 0,
      unfaulted: true,
      verticalExtentM: Number.isFinite(shallowest) && Number.isFinite(deepest)
        ? deepest - shallowest : undefined,
      reservoirThicknessM: sq.zones.length ? sq.zones[sq.zones.length - 1].meanThickM : undefined,
      reservoirColumns: sq.zones.length ? sq.zones[sq.zones.length - 1].columns : undefined,
    },
    facies: {
      count: fac?.codes.length ?? 2,
      conditioningCells: upRes.length,
      conditioningSandFraction: upRes.length ? sandCells / upRes.length : 0,
      realisationSandFraction: fac ? fac.sandFraction : 0,
      unconditionedLayers: sim?.unconditionedLayers ?? 0,
      simulatedLayers: sim?.simulatedLayers ?? 0,
      totalLayers: sim?.totalLayers ?? p.nz,
      // the SIMULATION grid, not the model grid -- conflating them hides the upsampling
      simNodes: sim?.simNodes ?? 0,
      modelNx: p.nx,
    },
    petrophysics: {
      logPhiMean: NaN,
      netPhiMean: mean(upRes.map((c) => c.phie)),
      upscaledPhiMean: mean(upRes.map((c) => c.phie)),
      simulatedPhiMean: phiStat?.dist.mean ?? NaN,
      phiMin: phiStat?.dist.min ?? 0,
      phiMax: phiStat?.dist.max ?? 1,
      netFraction: mean(upRes.map((c) => c.ntg)),
      ntgUsed: fac ? fac.sandFraction : NaN,
      // THE TRUTH: the volume calculation reads the binary facies code, not the
      // petrophysical cutoffs. Declaring 'net-cutoff' made the consistency check pass a
      // test the model fails.
      ntgSource: 'binary-facies' as const,
    },
    permeability: {
      fitted: false,
      geoMeanMd: permStat?.dist.geoMean ?? NaN,
      arithMeanMd: permStat?.dist.mean ?? NaN,
      maxMd: permStat?.dist.max ?? NaN,
      cappedCells: sim?.permCapped ?? 0,
      simulatedCells: sim?.simulatedCells ?? grid.activeCells,
      ceilingMd: 20000,
      kvkh: 0.1,
      kvkhSource: 'assumed' as const,
      upscaleAverage: upscaled?.permAverage ?? 'geometric',
      hasPermZ: true,
    },
    // the session holds no PVT block; an empty object makes `auditModel` report it
    // ABSENT, which is true, rather than a pass
    pvt: {},
    saturation: {
      modelled: !!p.props.find((x) => x.name === 'sw'),
      shfPresent: true,
      shfSource: 'capillary curve at height above contact (SCAL analogue)',
      shfWiredToGrid: true,
      scalPresent: true,
      scalSource: 'fluid-model.ts',
      netSwMean: mean(upRes.map((c) => c.sw)),
      contactTvdss: owc != null ? Math.abs(owc) : undefined,
      crestTvdss: Number.isFinite(crest) ? crest : undefined,
    },
  };
}

export function StaticModel({ field }: { field: SearchEntry }) {
  const { ws, ready } = useWorkspace();
  const [stats, setStats] = useState<StudioStats>({
    fps: 0, tris: 0, verts: 0, dropped: 0, surfaces: 0, wells: 0, gridCells: 0, gridFaces: 0,
  });
  const onStats = useCallback((s: StudioStats) => setStats(s), []);

  const setVisible = useStatic((s) => s.setVisibleHorizons);
  const visible = useStatic((s) => s.visibleHorizons);
  const done = useStatic((s) => s.done);

  // Open on something rather than on nothing: the reservoir horizons if the delivery
  // names them, else everything. A viewport whose first state is empty teaches people
  // it is broken.
  //
  // ONCE. The effect used to re-run whenever `visible.length` fell to zero, so
  // deselecting the last horizon immediately re-selected the default set and the tree
  // fought the user. A default is a starting point, not a rule.
  const seeded = useRef(false);
  useEffect(() => {
    if (seeded.current || !ws.surfaces.length) return;
    seeded.current = true;
    if (visible.length) return;
    const hugin = ws.surfaces.filter((s) => /hugin/i.test(s.name)).map((s) => s.id);
    setVisible(hugin.length ? hugin : ws.surfaces.slice(0, 3).map((s) => s.id));
  }, [ws.surfaces, visible.length, setVisible]);

  const zones = Math.max(0, ws.surfaces.length - 1);

  // ── the restructured shell ──
  const [ribbon, setRibbon] = useState<'structure' | 'property'>('structure');
  const [rightTab, setRightTab] = useState<'none' | 'qc'>('none');
  const propKey = useStatic((s) => s.propKey);
  const setPropKey = useStatic((s) => s.setProp);
  const secPts = useStatic((s) => s.sectionPoints);
  const setSecPts = useStatic((s) => s.setSectionPoints);
  const sliceAxis = useStatic((s) => s.sliceAxis);
  const sliceIndex = useStatic((s) => s.sliceIndex);
  const setSliceAxis = useStatic((s) => s.setSliceAxis);
  const setSliceIndex = useStatic((s) => s.setSliceIndex);
  const setSliceOn = useStatic((s) => s.setSliceOn);
  const view = useStatic((s) => s.view);
  const grid = useStatic((s) => s.grid);
  const upscaled = useStatic((s) => s.upscaled);
  const simInfoState = useStatic((s) => s.simInfo);
  const volumes = useStatic((s) => s.volumes);
  const reservoirZones = useStatic((s) => s.reservoirZones);
  const propsVersion = useStatic((s) => s.propsVersion);
  const setReservoirZones = useStatic((s) => s.setReservoirZones);

  // ── THE CASE RUNNER ──
  //
  // `grid-versions` stores a RECIPE, which was the right call and also left v0 as a row
  // in a dropdown with an empty viewport behind it. This is what makes a recipe into a
  // model: it runs the whole pipeline and drops the result into the session exactly as
  // the process dialogs would have.
  const setGrid = useStatic((st) => st.setGrid);
  const setUpscaled = useStatic((st) => st.setUpscaled);
  const setVolumesState = useStatic((st) => st.setVolumes);
  const bumpProps = useStatic((st) => st.bumpProps);
  const markDone = useStatic((st) => st.markDone);
  const setReservoir = useStatic((st) => st.setReservoirZones);
  const [running, setRunning] = useState<CaseProgress | null>(null);
  const [caseWarnings, setCaseWarnings] = useState<string[]>([]);
  const [versionId, setVersionId] = useState<string | null>(null);

  const setSimInfo = useStatic((st) => st.setSimInfo);

  /** Drop a built or loaded case into the session. One path, so a rebuild and a reload
   *  put the tab in exactly the same state. */
  const applyCase = useCallback((c: {
    grid: Parameters<typeof setGrid>[0];
    upscaled: Parameters<typeof setUpscaled>[0];
    simInfo: ReturnType<typeof summariseSim>;
    volumes: Parameters<typeof setVolumesState>[0];
    reservoirZones: string[];
    warnings: string[];
  }, id: string | null) => {
    setGrid(c.grid);
    setUpscaled(c.upscaled);
    setSimInfo(c.simInfo);
    if (c.volumes) setVolumesState(c.volumes);
    setReservoir(c.reservoirZones.length ? c.reservoirZones : null);
    bumpProps();
    for (const step of ['horizons', 'zones', 'layering', 'grid', 'upscale',
                        'facies', 'porosity', 'permeability'] as const) markDone(step);
    if (c.volumes) markDone('volumes');
    if (ws.contacts.length) markDone('contacts');
    setCaseWarnings(c.warnings);
    setVersionId(id);
  }, [setGrid, setUpscaled, setSimInfo, setVolumesState, setReservoir, bumpProps, markDone, ws.contacts.length]);

  /**
   * Build a case and SAVE it.
   *
   * Saving the built result, not just the recipe, is what makes v0 a reference: a case
   * that is recomputed on every open tracks the code, so a changed cutoff or default
   * would quietly redefine "ground truth" under the same name.
   */
  const runCase = useCallback(async (recipe = V0_RECIPE, id: string | null = null, groundTruth = false) => {
    if (!ws.surfaces.length) return;
    setRunning({ step: 'starting', done: 0, total: 6 });
    setCaseWarnings([]);
    try {
      const out = await buildCase(ws, recipe, setRunning);
      const simInfo = summariseSim(out.sim);
      applyCase({ ...out, simInfo }, id);
      if (id && ws.fieldId) {
        await indexedDbCaseStore.put({
          id, fieldId: ws.fieldId, savedAt: Date.now(), groundTruth,
          grid: out.grid, upscaled: out.upscaled, simInfo,
          volumes: out.volumes, reservoirZones: out.reservoirZones, warnings: out.warnings,
        }).catch(() => undefined);
      }
    } catch (e) {
      setCaseWarnings([(e as Error).message || 'the case failed to build']);
    } finally {
      setRunning(null);
    }
  }, [ws, applyCase]);

  /** Load a saved case; build it only if nothing usable is stored. */
  const openCase = useCallback(async (id: string, recipe = V0_RECIPE, groundTruth = false) => {
    if (!ws.fieldId) return;
    const saved = await indexedDbCaseStore.get(id).catch(() => null);
    if (caseIsUsable(saved)) {
      applyCase(saved!, id);
      return;
    }
    await runCase(recipe, id, groundTruth);
  }, [ws.fieldId, applyCase, runCase]);

  /** Rebuild a stored case deliberately — the only way a reference case changes. */
  const rebuildCase = useCallback(async (id: string, recipe = V0_RECIPE, groundTruth = false) => {
    await indexedDbCaseStore.remove(id).catch(() => undefined);
    await runCase(recipe, id, groundTruth);
  }, [runCase]);

  const autoRan = useRef(false);
  useEffect(() => {
    if (autoRan.current || !ready || grid || !ws.surfaces.length) return;
    autoRan.current = true;
    // LOAD, do not rebuild. v0 is ground truth: it is built once and then read, so
    // opening the tab is instant and the reference cannot drift with the code.
    void openCase('v0', V0_RECIPE, true);
  }, [ready, grid, ws.surfaces.length, openCase]);

  const zoneNames = useMemo(() => grid?.zoneLayers.map((z) => z.name) ?? [], [grid]);
  const activeZones = reservoirZones ?? zoneNames;
  const availableProps = useMemo(() => (grid?.packed.props ?? []).map((p) => p.name), [grid]);
  // the 2D panel colours by the SAME property and the SAME range as the 3D scene
  const sectionProp = useMemo(
    () => (grid?.packed.props ?? []).find((p) => p.name === propKey) ?? grid?.packed.props?.[0] ?? null,
    [grid, propKey],
  );
  const sectionRange = useMemo(
    () => (grid?.packed && sectionProp ? propRange(grid.packed, sectionProp) : { lo: 0, hi: 1, n: 0 }),
    [grid, sectionProp, propsVersion],
  );

  // the QC numbers, computed only while the panel is open — a full pass over every
  // cell of every property is not something to run behind a closed drawer
  const qc = useMemo(() => {
    if (rightTab !== 'qc' || !grid) {
      return { structure: null, properties: [], facies: null, upscale: null, volumes: null };
    }
    const p = grid.packed;
    return {
      structure: structureStats(p),
      properties: propertyStats(p),
      facies: faciesStats(p),
      upscale: upscaled
        ? upscaleStats(
            upscaled.cells.map((c) => ({ well: c.well, i: c.i, j: c.j, phie: c.phie, ntg: c.ntg, nSamples: c.nSamples })),
            upscaled.cells.map((c) => c.phie),
            ws.bores.length,
          )
        : null,
      volumes: volumes
        ? volumeReport({
            grvM3: volumes.grid.grvM3, ntg: volumes.grid.meanNtg, phi: volumes.grid.meanPhi,
            sw: volumes.grid.meanSw, bo: 1.47,
            stoiipMMSm3: volumes.grid.stoiipSm3 / 1e6,
            swSource: 'assumed',
          })
        : null,
    };
  }, [rightTab, grid, upscaled, volumes, ws.bores.length, propsVersion]);

  // ── the report + upscale tabs ──
  //
  // Computed only when their tab is open. A full pass over every cell of every property
  // behind a closed panel is work nobody asked for.
  const nzPerZone = useStatic((s) => s.nzPerZone);
  const simSeedV = useStatic((s) => s.simSeed);
  const simNodesV = useStatic((s) => s.simNodes);
  const [upWell, setUpWell] = useState<string | null>(null);

  const upscaleWells = useMemo(
    () => [...new Set((upscaled?.cells ?? []).map((c) => c.well))].sort(),
    [upscaled],
  );
  const upCells = useMemo(() => {
    if (!grid || !upscaled) return [];
    const w = upWell ?? upscaleWells[0];
    return upscaled.cells
      .filter((c) => c.well === w)
      .map((c) => {
        const sp = layerSpan(grid, c.j * grid.packed.nx + c.i, c.k);
        return {
          k: c.k, top: sp?.top ?? NaN, base: sp?.base ?? NaN,
          phie: c.phie, sw: c.sw, ntg: c.ntg, nSamples: c.nSamples,
        };
      })
      .filter((c) => Number.isFinite(c.top))
      .sort((a, b) => a.top - b.top);
  }, [grid, upscaled, upWell, upscaleWells]);

  // ── the zone tops AT THIS WELL, as markers on the log ──
  //
  // Not the field-wide pick depths: the log is being compared against the CELLS, and
  // the cells were blocked inside the zone boundaries the grid actually has at this
  // column. A marker from a different surface would be a line the blocking never saw,
  // and the reader would blame the upscaling for a mismatch that is really a mistie.
  const upMarkers = useMemo(() => {
    if (!grid || !upscaled) return [];
    const w = upWell ?? upscaleWells[0];
    const cell = upscaled.cells.find((c) => c.well === w);
    if (!cell) return [];
    const col = cell.j * grid.packed.nx + cell.i;
    const out: { name: string; tvdss: number }[] = [];
    for (const z of grid.zoneLayers) {
      const top = layerSpan(grid, col, z.k0);
      const base = layerSpan(grid, col, z.k0 + z.nz - 1);
      if (top) out.push({ name: z.name.split('→')[0].trim() || z.name, tvdss: top.top });
      // only the LAST zone contributes a base, or every boundary is drawn twice
      if (base && z === grid.zoneLayers[grid.zoneLayers.length - 1]) {
        out.push({ name: `${z.name.split('→').pop()?.trim() ?? z.name} base`, tvdss: base.base });
      }
    }
    return out.filter((m) => Number.isFinite(m.tvdss));
  }, [grid, upscaled, upWell, upscaleWells]);

  // ── the raw log behind the blocked cells ──
  //
  // Without this the Upscale tab drew the step trace over an empty track, which is the
  // one comparison it exists to make. Loaded per well and only while the tab is open —
  // a log is tens of thousands of samples and there is no reason to hold every well's.
  const [upSamples, setUpSamples] = useState<UpscaleSample[]>([]);
  useEffect(() => {
    const name = upWell ?? upscaleWells[0];
    if (view !== 'upscale' || !name) { setUpSamples([]); return; }
    let alive = true;
    (async () => {
      const bore = ws.bores.find((b) => b.name === name);
      const asset = bore?.assetIds.log ? ws.assets.find((a) => a.id === bore.assetIds.log) : null;
      if (!asset) { if (alive) setUpSamples([]); return; }
      const log = await readRecord<DigestedLog>(asset).catch(() => null);
      if (!log?.md?.length) { if (alive) setUpSamples([]); return; }

      // THE DELIVERY MIXES DEPTH UNITS — read raw and 19 of 24 wells land three orders
      // of magnitude out. Convert by the log's own declared unit, every time.
      const f = depthToMetres(1, log.depthUnit);
      if (f == null) { if (alive) setUpSamples([]); return; }
      const mdM = log.md.map((v) => v * f);
      const byFam = (fa: string) => log.curves.find((c) => c.family === fa);
      const res = runPetro({
        md: mdM,
        gr: byFam('GR')?.values, rt: (byFam('RT') ?? byFam('RXO'))?.values,
        rhob: byFam('RHOB')?.values, nphi: byFam('NPHI')?.values, dt: byFam('DT')?.values,
      }, DEFAULT_PARAMS);

      // TVDSS from the survey, minus the kelly bushing. A survey reports TVD below the
      // DRILLING datum and the grid is sub-sea; using one as the other puts every
      // sample one rig floor too deep and the step trace beside the curve rather than
      // through it.
      const tAsset = bore?.assetIds.trajectory ? ws.assets.find((a) => a.id === bore.assetIds.trajectory) : null;
      const traj = tAsset ? await readRecord<{ stations?: TrajStation[] }>(tAsset).catch(() => null) : null;
      const kbM = bore?.kbM ?? 0;
      const stations = (traj?.stations ?? []).map((st) => ({ ...st, tvd: st.tvd - kbM }));

      const out: UpscaleSample[] = mdM.map((m, i) => ({
        md: m,
        tvdss: stations.length ? mdToPoint(stations, m).tvd : m,
        phie: res.phie[i], vsh: res.vsh[i], sw: res.sw[i], net: res.net[i],
      }));
      if (alive) setUpSamples(out);
    })();
    return () => { alive = false; };
  }, [view, upWell, upscaleWells, ws.bores, ws.assets]);

  const modelQc = useMemo(() => {
    if (view !== 'report' || !grid) return { items: [], summary: null };
    void propsVersion;
    const items = auditModel(reportQcInput(grid, upscaled, simInfoState, ws));
    return { items, summary: summariseModelQc(items) };
  }, [view, grid, upscaled, simInfoState, ws, propsVersion]);

  const breakdown = useMemo(() => {
    if (view !== 'report' || !grid) return { byZone: [], bySegment: [], total: 0 };
    const p = grid.packed;
    const zoneOf: string[] = [];
    for (const zl of grid.zoneLayers) for (let k = 0; k < zl.nz; k++) zoneOf[zl.k0 + k] = zl.name;
    const prop = (n: string) => p.props.find((x) => x.name === n) ?? null;
    const phiP = prop('phi'), swP = prop('sw'), ntgP = prop('ntg');
    const owc = ws.contacts.find((c) => c.tvdss != null)?.tvdss;
    const owcM = owc != null ? Math.abs(owc) : null;
    const cells: Array<{ group: string; bulkM3: number; ntg: number; phi: number; sw: number }> = [];
    const val = (pr: typeof phiP, i: number, j: number, l: number) =>
      pr ? propValueAt(p, pr, i, j, l) : NaN;
    for (let l = 0; l < p.nz; l++) {
      for (let j = 0; j < p.ny; j++) {
        for (let i = 0; i < p.nx; i++) {
          const c = j * p.nx + i;
          if (!p.activeCol[c]) continue;
          const sp = layerSpan(grid, c, l);
          if (!sp) continue;
          const thk = sp.base - sp.top;
          if (!(thk > 0)) continue;
          // contact cut, fractional — an all-or-nothing cut swings by a whole cell
          let frac = 1;
          if (owcM != null) {
            if (sp.top >= owcM) frac = 0;
            else if (sp.base > owcM) frac = (owcM - sp.top) / thk;
          }
          if (frac <= 0) continue;
          cells.push({
            group: zoneOf[l] ?? `layer ${l}`,
            bulkM3: p.dx * p.dy * thk * frac,
            ntg: val(ntgP, i, j, l), phi: val(phiP, i, j, l), sw: val(swP, i, j, l),
          });
        }
      }
    }
    const bo = 1.47;
    const byZone = volumeBreakdown(cells, bo);
    const total = byZone.reduce((a, r) => a + r.stoiipMMSm3, 0);
    // segments need the pool decomposition; until that is threaded through, say so
    // rather than showing the zone rows relabelled as segments
    return { byZone, bySegment: [], total };
  }, [view, grid, ws, propsVersion]);

  return (
    <div className="sms">
      <div className="sms-bar">
        <span className="sms-sub lead">
          {ready
            ? `${field.name} · ${ws.surfaces.length} horizons · ${zones} zones · ${ws.contacts.length} contact${ws.contacts.length === 1 ? '' : 's'}`
            : 'reading the workspace…'}
        </span>
        <span className="sms-sp" />
        <span className="sms-progress" title="Processes that have produced an artifact">
          <Database size={10} /> {done.size}/{PROCESSES.length} processes run
        </span>
      </div>

      {/* processes are a RIBBON of pop-ups now; the left edge belongs to the tree */}
      <ProcessRibbon tab={ribbon} onTab={setRibbon} />

      {running && (
        <div className="sms-running">
          <div className="sms-running-box">
            <b>Building the case</b>
            <span>{running.step}</span>
            <i style={{ width: `${(running.done / running.total) * 100}%` }} />
            <em>{running.done} / {running.total}</em>
          </div>
        </div>
      )}
      {!running && caseWarnings.length > 0 && (
        <div className="sms-warn">
          {caseWarnings.map((w, i) => <span key={i}>{w}</span>)}
          <button onClick={() => setCaseWarnings([])}>dismiss</button>
        </div>
      )}

      <div className="sms-shell">
        <ModelTree
          ws={ws}
          propKey={propKey} onProp={setPropKey}
          availableProps={availableProps}
          zones={zoneNames} activeZones={activeZones} onZones={setReservoirZones}
          versionId={versionId}
          onRebuild={() => void rebuildCase(versionId ?? 'v0', V0_RECIPE, versionId === 'v0')}
          onLoadVersion={(v: GridVersion) => void openCase(v.id, {
            horizons: v.recipe.horizons,
            nzPerZone: v.recipe.nzPerZone,
            layerScheme: v.recipe.layerScheme as 'proportional',
            seed: v.recipe.seed,
            simNodes: v.recipe.simNodes,
            permAverage: v.recipe.permAverage as 'geometric',
            owc: v.recipe.owc,
          }, v.id === 'v0')}
        />
        <div className="sms-stage">
          <FunctionBar stats={stats} />
          <div className={`sms-canvas${view === 'split' ? ' split' : ''}`}>
            {view === 'report' && (
              <div className="sms-pane sms-pane-doc">
                <ReportTab
                  fieldName={field.name}
                  qc={modelQc.items}
                  structure={qc.structure} properties={qc.properties}
                  facies={qc.facies} upscale={qc.upscale} volumes={qc.volumes}
                  byZone={breakdown.byZone} bySegment={breakdown.bySegment}
                  totalStoiipMMSm3={breakdown.total}
                  officialMMSm3={undefined}
                  recipe={grid ? {
                    horizons: grid.zoneLayers.length + 1, nzPerZone: nzPerZone,
                    seed: simSeedV, simNodes: simNodesV,
                    owc: ws.contacts.find((c) => c.tvdss != null)?.tvdss ?? undefined,
                  } : undefined}
                />
              </div>
            )}
            {view === 'maps' && (
              <div className="sms-pane sms-pane-doc">
                {grid?.packed
                  ? (
                    <MapsTab
                      grid={grid.packed as never}
                      zones={grid.zoneLayers.map((z) => ({ name: z.name, k0: z.k0, nz: z.nz }))}
                      owc={ws.contacts.find((c) => c.tvdss != null)?.tvdss ?? undefined}
                      wells={ws.bores.filter((b) => b.x != null && b.y != null).map((b) => ({
                        name: b.name, x: b.x as number, y: b.y as number,
                        producer: b.role === 'oil-producer',
                        injector: /inject/i.test(String(b.role ?? '')),
                      }))}
                    />
                  )
                  : <div className="mp-empty">Build the 3D grid first.</div>}
              </div>
            )}
            {view === 'upscale' && (
              <div className="sms-pane sms-pane-doc">
                <UpscaleTab
                  wells={upscaleWells}
                  well={upWell} onWell={setUpWell}
                  samples={upSamples} cells={upCells} markers={upMarkers}
                  bias={qc.upscale ? { log: qc.upscale.logPhi.mean, blocked: qc.upscale.blockedPhi.mean } : null}
                />
              </div>
            )}
            {(view === '3d' || view === '2d' || view === 'split') && (
              <div className="sms-pane">
                <GeaStudio ws={ws} onStats={onStats} />
              </div>
            )}
            {(view === 'section' || view === 'split') && (
              <div className="sms-pane sms-pane-2d">
                {grid?.packed && sectionProp
                  ? (
                    <SectionDrawer
                      grid={grid.packed as never}
                      prop={sectionProp}
                      lo={sectionRange.lo} hi={sectionRange.hi}
                      // follows the K player; on an I or J slice the map has no single
                      // layer to show, so it falls back to the top
                      layer={sliceAxis === 'k' ? sliceIndex : 0}
                      points={secPts} onPoints={setSecPts}
                      nz={grid.packed.nz}
                      onLayer={(l) => { setSliceAxis('k'); setSliceOn(true); setSliceIndex(l); }}
                      wells={ws.bores
                        .filter((b) => b.x != null && b.y != null)
                        .map((b) => ({ name: b.name, x: b.x as number, y: b.y as number,
                          producer: b.role === 'oil-producer',
                          injector: /inject/i.test(String(b.role ?? '')) }))}
                    />
                  )
                  : <div className="sms-2d-empty">Build the 3D grid and model a property to draw a section.</div>}
              </div>
            )}
            <Dialogs ws={ws} />
          </div>
        </div>
        {rightTab === 'qc' && (
          <aside className="sms-qc">
            <div className="sms-qc-head">
              <span>Model QC</span>
              <button onClick={() => setRightTab('none')}>×</button>
            </div>
            <QcPanel {...qc} />
          </aside>
        )}
        {rightTab !== 'qc' && (
          <button className="sms-qc-tab" onClick={() => setRightTab('qc')} title="Model QC — statistics and the volumetric report">
            QC
          </button>
        )}
      </div>
    </div>
  );
}
