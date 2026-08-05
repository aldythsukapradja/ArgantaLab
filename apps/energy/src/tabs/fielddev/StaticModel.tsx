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
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Boxes, Check, ChevronRight, CircleDot, Database, Grid3x3, Layers, Lock,
  Play, RotateCcw, Ruler, Waves,
} from 'lucide-react';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { useWorkspace, type Workspace } from './workspace';
import { GeaStudio, type StudioStats } from './GeaStudio';
import { ProcessDialog } from './ProcessDialog';
import {
  PROCESSES, PROCESS_BY_ID, processGate, useStatic,
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

// ── the Processes pane ──────────────────────────────────────────────────────

function ProcessRail() {
  const done = useStatic((s) => s.done);
  const active = useStatic((s) => s.active);
  const open = useStatic((s) => s.open);
  const reset = useStatic((s) => s.reset);

  const groups = useMemo(() => {
    const m = new Map<string, typeof PROCESSES>();
    for (const p of PROCESSES) {
      const list = m.get(p.group) ?? [];
      list.push(p);
      m.set(p.group, list);
    }
    return [...m.entries()];
  }, []);

  return (
    <aside className="prail">
      <div className="prail-head">
        <Play size={11} /> Processes
        <button title="Clear the session — every process becomes unrun"
          onClick={reset}><RotateCcw size={10} /></button>
      </div>
      <div className="prail-scroll">
        {groups.map(([group, list]) => (
          <div key={group} className="prail-group">
            <div className="prail-gh">{group}</div>
            {list.map((p) => {
              const gate = processGate(p, done);
              const isDone = done.has(p.id);
              return (
                <button key={p.id}
                  className={'prail-p' + (active === p.id ? ' on' : '') + (isDone ? ' done' : '') + (gate.ok ? '' : ' blocked')}
                  disabled={!gate.ok}
                  // Petrel opens a process on double-click; single-click works here
                  // too because a rail you have to double-click is a rail people
                  // think is broken
                  onClick={() => gate.ok && open(p.id)}
                  onDoubleClick={() => gate.ok && open(p.id)}
                  title={gate.ok
                    ? `${p.purpose}\n\nOpens a floating process window.`
                    : `Waiting on “${gate.blockedBy.label}” — ${p.purpose}`}>
                  <span className="prail-ic">
                    {isDone ? <Check size={11} /> : gate.ok ? <CircleDot size={10} /> : <Lock size={9} />}
                  </span>
                  <span className="prail-lbl">{p.label}</span>
                  <em>{p.step}</em>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}

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
        <span className="pdlg-note">{visible.length} of {sorted.length} in the viewport</span>
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
                <button className="pdlg-btn primary" onClick={() => { markDone(def.id); }}>
                  Apply
                </button>
              </>
            }>
            {win.id === 'horizons' ? <HorizonsDialog ws={ws} />
              : win.id === 'zones' ? <ZonesDialog ws={ws} />
              : win.id === 'layering' ? <LayeringDialog ws={ws} />
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
        {(['3d', '2d', 'section'] as const).map((v) => (
          <button key={v} className={view === v ? 'on' : ''} onClick={() => setView(v)}
            title={v === '2d' ? 'The same scene, locked overhead' : v === 'section' ? 'Not built (S2)' : 'Orbit'}
            disabled={v === 'section'}>
            {v === '3d' ? <Box size={11} /> : v === '2d' ? <Grid3x3 size={11} /> : <Layers size={11} />}
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

export function StaticModel({ field }: { field: SearchEntry }) {
  const { ws, ready } = useWorkspace();
  const [stats, setStats] = useState<StudioStats>({ fps: 0, tris: 0, verts: 0, dropped: 0, surfaces: 0, wells: 0 });
  const onStats = useCallback((s: StudioStats) => setStats(s), []);

  const setVisible = useStatic((s) => s.setVisibleHorizons);
  const visible = useStatic((s) => s.visibleHorizons);
  const done = useStatic((s) => s.done);

  // Open on something rather than on nothing: the reservoir horizons if the delivery
  // names them, else everything. A viewport whose first state is empty teaches people
  // it is broken.
  useEffect(() => {
    if (visible.length || !ws.surfaces.length) return;
    const hugin = ws.surfaces.filter((s) => /hugin/i.test(s.name)).map((s) => s.id);
    setVisible(hugin.length ? hugin : ws.surfaces.slice(0, 3).map((s) => s.id));
  }, [ws.surfaces, visible.length, setVisible]);

  const zones = Math.max(0, ws.surfaces.length - 1);

  return (
    <div className="sms">
      <div className="sms-bar">
        <span className="sms-title"><Boxes size={13} /> Static Model</span>
        <span className="sms-sub">
          {ready
            ? `${field.name} · ${ws.surfaces.length} horizons · ${zones} zones · ${ws.contacts.length} contact${ws.contacts.length === 1 ? '' : 's'}`
            : 'reading the workspace…'}
        </span>
        <span className="sms-sp" />
        <span className="sms-progress" title="Processes that have produced an artifact">
          <Database size={10} /> {done.size}/{PROCESSES.length} processes run
        </span>
      </div>

      <div className="sms-shell">
        <ProcessRail />
        <div className="sms-stage">
          <FunctionBar stats={stats} />
          <div className="sms-canvas">
            <GeaStudio ws={ws} onStats={onStats} />
            <Dialogs ws={ws} />
          </div>
        </div>
      </div>
    </div>
  );
}
