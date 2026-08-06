// Simulation — the dynamic core, from a case through a forecast.
//
// ── SCOPE ───────────────────────────────────────────────────────────────────
//
// One chain lives here and it ends at a forecast:
//
//     case → initialise → schedule → run → history match → forecast
//
// That is the whole dynamic argument. What sits downstream — streamline diagnostics,
// a recovery benchmark, a development plan — reads this chain's output and argues
// about it; none of them can be made before it exists. Keeping the chain in one
// surface is what stops a forecast being produced in one tab from a match performed in
// another, with nothing on screen tying the two together.
//
// ── SHELL FIRST, DELIBERATELY ───────────────────────────────────────────────
//
// This is the shell: the layout, the tree, the process ribbon with its gating, and the
// state machine that says which step may run. The solvers land behind it. Every pane
// therefore reports what is ABSENT and what it is waiting for, and draws nothing else
// — a forecast curve rendered before a match is the most expensive wrong number this
// app could produce, so there is no placeholder chart anywhere in this file.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Lock, Play } from 'lucide-react';
import { StudioShell, type StudioView } from './studio-shell';
import { SimulationTree } from './SimulationTree';
import {
  useSim, SIM_PROCESSES, SIM_PROCESS_BY_ID, SIM_RIBBON_TABS,
  blockedBy, downstreamOf, type SimProcessId,
} from './sim-store';
import { useWorkspace } from './workspace';
import { indexedDbVersionStore, type GridVersion } from './grid-versions';
import type { SearchEntry } from '../../cosmo/cockpit-search';
import { useStatic } from './static-store';
import { useSimFluids } from './fluid-case-store';
import { layerSpan } from './grid-build';
import { propValueAt } from './prop-view';
import { simulateFV } from '../../engine/sim/fv';
import { columnAverages, runCase, type SimWellInput, type RunOutput } from './sim-run';
import { buildCase, V0_RECIPE } from './build-case';
import { indexedDbCaseStore } from './case-store';
import { useFluidBasis, assembleCase } from './fluids-live';
import { useFluidCase } from './fluid-case-store';
import { PlotsPane, WellsPane, ForecastPane, MatchPane, ReportPane, Blank } from './sim-views';
import { GeaStudio } from './GeaStudio';
import { ensureProp } from './grid-props';
import { buildFrames, writeFrame, FRAME_NOTE, type FrameSet } from './sim-frames';

const VIEWS: StudioView[] = [
  { id: 'plots', label: 'Plots', hint: 'Rates and pressures through time — simulated against observed' },
  { id: '3d', label: '3D', hint: 'The dynamic field: saturation and pressure over the grid, through time' },
  { id: 'wells', label: 'Wells', hint: 'Per-well response and completion state' },
  { id: 'match', label: 'Match', hint: 'The objective function, per well and per curve' },
  { id: 'forecast', label: 'Forecast', hint: 'The matched case carried forward under a control strategy' },
  { id: 'report', label: 'Report', hint: 'What was run, what it was judged against, and what it produced' },
];

export function Simulation({ field }: { field: SearchEntry }) {
  const { ws, ready } = useWorkspace();
  const done = useSim((s) => s.done);
  const open = useSim((s) => s.open);
  const setOpen = useSim((s) => s.setOpen);
  const markDone = useSim((s) => s.markDone);
  const invalidate = useSim((s) => s.invalidate);
  const view = useSim((s) => s.view);
  const setView = useSim((s) => s.setView);
  const gridVersionId = useSim((s) => s.gridVersionId);

  const [ribbon, setRibbon] = useState<'model' | 'predict'>('model');
  const [versions, setVersions] = useState<GridVersion[]>([]);
  const [qcOpen, setQcOpen] = useState(false);

  // the saved static realisations a case may point at
  useEffect(() => {
    let alive = true;
    indexedDbVersionStore.list(field.id).then((v) => { if (alive) setVersions(v); }).catch(() => {});
    return () => { alive = false; };
  }, [field.id]);

  // ── THE STATIC MODEL AND THE FLUID CASE, JOINED ──────────────────────────
  //
  // Both are READ, never copied. The grid comes from the Static Model's own store and
  // the rock-fluid functions from the Fluids & Rock stage's published case — which is
  // the seam that stage exists to provide. A simulation that carries its own PVT is a
  // simulation that can disagree with the case it claims to be running.
  const grid = useStatic((st) => st.grid);
  const setGrid = useStatic((st) => st.setGrid);
  const fluids = useSimFluids(field.id);

  // ── V0 IS THE DEFAULT BASIS, LOADED WITHOUT BEING ASKED ──────────────────
  //
  // The surface used to open with a disabled Run button and no way to enable it
  // without visiting two other tabs first. v0 is the shipped ground-truth realisation,
  // so it is what a case stands on until someone chooses otherwise: restored from the
  // case store if it has been built before, rebuilt from V0_RECIPE if not.
  //
  // It is loaded, never invented. If the recipe cannot be rebuilt the surface says so
  // and stays empty rather than running on something it made up.
  const [basisNote, setBasisNote] = useState<string | null>(null);
  useEffect(() => {
    if (grid?.packed || !ready || !ws.fieldId) return;
    let alive = true;
    (async () => {
      setBasisNote('loading v0…');
      try {
        const saved = await indexedDbCaseStore.get('v0').catch(() => null);
        if (!alive) return;
        if (saved?.grid) {
          setGrid(saved.grid);
          setBasisNote('v0 (restored)');
          return;
        }
        setBasisNote('building v0 from its recipe…');
        const out = await buildCase(ws, V0_RECIPE, (p) => {
          if (alive) setBasisNote(`building v0 — ${p.step} ${p.done}/${p.total}`);
        });
        if (!alive) return;
        setGrid(out.grid);
        setBasisNote('v0 (built)');
        await indexedDbCaseStore.put({
          id: 'v0', fieldId: ws.fieldId, savedAt: Date.now(), groundTruth: true,
          grid: out.grid, upscaled: out.upscaled, simInfo: null,
        } as never).catch(() => {});
      } catch (e) {
        if (alive) setBasisNote(`v0 could not be built: ${e instanceof Error ? e.message : String(e)}`);
      }
    })();
    return () => { alive = false; };
  }, [grid, ready, ws, setGrid]);

  // ── AND THE FLUID CASE, FROM THE SAME DEFAULTS THE FLUIDS TAB USES ───────
  //
  // Not a second set of constants: `assembleCase` on the delivery's own basis is
  // exactly what Fluids & Rock computes and publishes. Publishing it here means a user
  // who has not opened that tab still runs on the same rock-fluid functions rather than
  // on something this file made up — and the moment they DO open it and change
  // anything, their case replaces this one.
  const { basis: fluidBasis, ready: basisReady } = useFluidBasis();
  useEffect(() => {
    if (fluids || !basisReady || !ws.fieldId) return;
    const init = assembleCase(ws.fieldId, fluidBasis, {});
    if (init) useFluidCase.getState().publish(init);
  }, [fluids, basisReady, fluidBasis, ws.fieldId]);

  const wellsIn = useMemo<SimWellInput[]>(() => ws.bores
    .filter((b) => b.x != null && b.y != null)
    .filter((b) => b.role === 'oil-producer' || /inject/i.test(String(b.role ?? '')))
    .map((b) => ({
      name: b.name, x: b.x as number, y: b.y as number,
      kind: /inject/i.test(String(b.role ?? '')) ? 'injector' as const : 'producer' as const,
    })), [ws.bores]);

  // the simulated period, and where history is taken to stop. Both are the user's to
  // set; the split is what makes the right-hand half of every chart a FORECAST.
  const [tEnd, setTEnd] = useState(3650);
  const [historyEnd, setHistoryEnd] = useState<number | null>(1825);

  const [run, setRun] = useState<RunOutput | null>(null);
  const [frames, setFrames] = useState<FrameSet | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  // which dynamic field the viewport is colouring by
  const [dynProp, setDynProp] = useState<'swSim' | 'sweep'>('swSim');
  const [runErr, setRunErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canRun = !!grid?.packed && !!fluids && wellsIn.length > 0;
  const missing = !grid?.packed
    ? 'no static grid — build one in the Static Model'
    : !fluids
      ? 'no published fluid case — publish one in Fluids & Rock'
      : wellsIn.length === 0
        ? 'no producers or injectors in the delivery'
        : null;

  const doRun = useCallback(() => {
    if (!grid?.packed || !fluids) return;
    setBusy(true); setRunErr(null);
    // deferred a frame so the busy state paints before the solver blocks the thread —
    // this is a main-thread solve and pretending otherwise would just look frozen
    setTimeout(() => {
      try {
        const p = grid.packed;
        const phi = p.props.find((x) => x.name === 'phi');
        const perm = p.props.find((x) => x.name === 'perm');
        const sw = p.props.find((x) => x.name === 'sw');
        const cols = columnAverages(
          p as never,
          (col, l) => {
            const i = col % p.nx, j = (col - (col % p.nx)) / p.nx;
            return {
              phi: phi ? propValueAt(p, phi, i, j, l) : NaN,
              perm: perm ? propValueAt(p, perm, i, j, l) : NaN,
              sw: sw ? propValueAt(p, sw, i, j, l) : NaN,
            };
          },
          (col, l) => layerSpan(grid, col, l),
        );
        const out = runCase(p as never, cols, fluids, wellsIn,
          { tEnd: tEnd, nReports: 60 }, simulateFV);
        setRun(out);
        // the frames the 3D viewport animates. Built once, from the same result the
        // charts read, so the picture and the numbers cannot disagree.
        setFrames(buildFrames(p as never, out.result, fluids.sor));
        setStep(0);
        markDone('case'); markDone('init'); markDone('schedule'); markDone('run');
      } catch (e) {
        setRunErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 16);
  }, [grid, fluids, wellsIn, markDone, tEnd]);

  // ── THE FRAME ON SCREEN ──────────────────────────────────────────────────
  //
  // Written into the packed grid the Static Model viewport already draws, rather than
  // building a second 3D scene. That reuse is the point: the flood is shown on the
  // same geometry, the same camera, the same slicing and the same cross-section tool
  // the static properties use, so a user is not learning a second viewer.
  //
  // The property keeps ONE range across the whole run — per-frame autoscaling makes the
  // colours churn while the front appears to stand still.
  const bumpProps = useStatic((st) => st.bumpProps);
  const setPropKey = useStatic((st) => st.setProp);
  useEffect(() => {
    const p = grid?.packed;
    if (!p || !frames || !frames.sw.length) return;
    const ix = Math.max(0, Math.min(frames.sw.length - 1, step));
    const swProp = ensureProp(p as never, 'swSim');
    swProp.min = frames.swRange.lo; swProp.max = frames.swRange.hi;
    writeFrame(swProp as never, frames.sw[ix]);
    const swpProp = ensureProp(p as never, 'sweep');
    swpProp.min = 0; swpProp.max = 1;
    writeFrame(swpProp as never, frames.sweep[ix]);
    bumpProps();
  }, [grid, frames, step, bumpProps]);

  // colour by the dynamic field whenever the 3D view is the one being looked at
  useEffect(() => {
    if (view === '3d' && frames) setPropKey(dynProp);
  }, [view, frames, dynProp, setPropKey]);

  // playback
  useEffect(() => {
    if (!playing || !frames) return;
    const id = setInterval(() => {
      setStep((v) => {
        if (v >= frames.sw.length - 1) { setPlaying(false); return v; }
        return v + 1;
      });
    }, 220);
    return () => clearInterval(id);
  }, [playing, frames]);

  const activeTab = useMemo(
    () => SIM_RIBBON_TABS.find((t) => t.id === ribbon) ?? SIM_RIBBON_TABS[0],
    [ribbon],
  );

  const basis = versions.find((v) => v.id === gridVersionId) ?? null;

  const subtitle = !ready
    ? 'reading the workspace…'
    : basis
      ? `${field.name} · on ${basis.name} · ${ws.bores.length} bores`
      : grid?.packed
        ? `${field.name} · ${basisNote ?? 'v0'} · ${ws.bores.length} bores`
        : `${field.name} · ${basisNote ?? 'no static basis'}`;

  return (
    <StudioShell
      subtitle={subtitle}
      progress={
        <span className="sms-progress" title="Steps of the dynamic chain that have produced an artifact">
          <Play size={10} /> {done.size}/{SIM_PROCESSES.length} steps run
        </span>
      }
      ribbon={
        <div className="rb">
          <div className="rb-tabs">
            {SIM_RIBBON_TABS.map((t) => {
              const ran = t.ids.filter((id) => done.has(id)).length;
              return (
                <button key={t.id} className={`rb-tab${ribbon === t.id ? ' on' : ''}`}
                  onClick={() => setRibbon(t.id)}>
                  {t.label}
                  <span className="rb-tab-count">{ran}/{t.ids.length}</span>
                </button>
              );
            })}
          </div>
          <div className="rb-actions">
            {activeTab.ids.map((id) => {
              const def = SIM_PROCESS_BY_ID.get(id)!;
              const wait = blockedBy(id, done);
              const ran = done.has(id);
              return (
                <button key={id}
                  className={`rb-btn${open === id ? ' open' : ''}${ran ? ' ran' : ''}`}
                  disabled={!!wait}
                  // a gated button names the step it waits on. A control that runs and
                  // silently produces nothing is worse than one that refuses.
                  title={wait ? `waiting on ${wait}` : def.purpose}
                  onClick={() => setOpen(open === id ? null : id)}>
                  <span className="rb-btn-top">
                    {ran ? <CheckCircle2 size={12} /> : wait ? <Lock size={12} /> : <span className="rb-dot" />}
                    {def.name}
                  </span>
                  <span className="rb-btn-step">{def.produces}</span>
                </button>
              );
            })}
            <span className="rb-sp" />
            <span className="rb-progress">{done.size}/{SIM_PROCESSES.length}</span>
          </div>
        </div>
      }
      tree={<SimulationTree ws={ws} versions={versions} />}
      views={VIEWS}
      view={view}
      onView={setView}
      toolbar={
        <span className="sim-toolbar">
          <label>days
            <input type="number" min={30} step={30} value={tEnd}
              onChange={(e) => setTEnd(Math.max(30, Number(e.target.value) || 30))} />
          </label>
          <label title="Everything after this is drawn as a FORECAST, not a measurement">
            history ends
            <input type="number" min={0} step={30} value={historyEnd ?? 0}
              onChange={(e) => setHistoryEnd(Number(e.target.value) || null)} />
          </label>
          <button className="sim-run" disabled={!canRun || busy} onClick={doRun}
            title={missing ?? 'Run the case'}>
            {busy ? 'solving…' : run ? 'Re-run' : 'Run'}
          </button>
        </span>
      }
      aside={qcOpen ? <SimQc /> : undefined}
      asideTitle="Run QC"
      onCloseAside={() => setQcOpen(false)}
      asideTab={qcOpen ? undefined : { label: 'QC', title: 'Run QC — material balance, convergence and the match score', onOpen: () => setQcOpen(true) }}
    >
      {open ? (
        <ProcessPane id={open} onClose={() => setOpen(null)}
          done={done} onRan={markDone} onInvalidate={invalidate} />
      ) : run ? (
        view === 'plots' ? <PlotsPane run={run} historyEnd={historyEnd} />
          : view === 'wells' ? <WellsPane run={run} historyEnd={historyEnd} />
          : view === 'forecast' ? <ForecastPane run={run} historyEnd={historyEnd} />
          : view === 'match' ? <MatchPane run={run} historyEnd={historyEnd} />
          : view === 'report' ? <ReportPane run={run} historyEnd={historyEnd} />
          : frames && frames.sw.length ? (
            <div className="sim3d">
              <div className="sim3d-bar">
                <div className="mp-seg">
                  <button className={dynProp === 'swSim' ? 'on' : ''} onClick={() => setDynProp('swSim')}
                    title="Water saturation at this timestep — green is oil, blue is water">water saturation</button>
                  <button className={dynProp === 'sweep' ? 'on' : ''} onClick={() => setDynProp('sweep')}
                    title="How much of each column's movable oil has been displaced — this is the FRONT">sweep</button>
                </div>
                <button className="sim-run" onClick={() => setPlaying(!playing)}>
                  {playing ? 'pause' : 'play'}
                </button>
                <input type="range" className="gea-scrub" min={0} max={frames.sw.length - 1} step={1}
                  value={step} onChange={(e) => { setPlaying(false); setStep(Number(e.target.value)); }} />
                <span className="sim3d-t">
                  day {frames.times[step]?.toFixed(0)} · step {step + 1}/{frames.sw.length}
                  {' · '}PVI {run.series.field[step]?.pvi.toFixed(3)}
                  {' · '}WC {((run.series.field[step]?.watercut ?? 0) * 100).toFixed(0)}%
                </span>
              </div>
              <div className="sim3d-canvas">
                <GeaStudio ws={ws} onStats={() => {}} />
              </div>
              <p className="sim-note">{FRAME_NOTE}</p>
            </div>
          ) : <Blank>Run the case to animate the flood.</Blank>
      ) : (
        <ViewPane view={view} done={done} missing={missing} busy={busy} err={runErr} />
      )}
    </StudioShell>
  );
}

/**
 * A process dialog.
 *
 * The shell is real — gating, the downstream-invalidation warning, the artifact it
 * will produce. The solver is not wired, and the pane says exactly that rather than
 * offering a Run button that does nothing.
 */
function ProcessPane({ id, onClose, done, onRan, onInvalidate }: {
  id: SimProcessId;
  onClose: () => void;
  done: Set<SimProcessId>;
  onRan: (p: SimProcessId) => void;
  onInvalidate: (p: SimProcessId) => void;
}) {
  const def = SIM_PROCESS_BY_ID.get(id)!;
  const wait = blockedBy(id, done);
  // re-running does not leave what came after it valid — it leaves it STALE, which
  // looks identical on screen. Say so before the click, not after.
  const stale = done.has(id) ? downstreamOf(id).filter((d) => done.has(d)) : [];

  return (
    <div className="simp">
      <div className="simp-head">
        <b>{def.name}</b>
        <span>{def.produces}</span>
        <button onClick={onClose} title="Close">×</button>
      </div>
      <p className="simp-purpose">{def.purpose}</p>

      {wait ? (
        <div className="simp-block">
          <Lock size={13} />
          <span>Waiting on <b>{wait}</b>. This step cannot produce {def.produces} until that has run.</span>
        </div>
      ) : (
        <>
          {stale.length > 0 && (
            <div className="simp-stale">
              Re-running this invalidates {stale.map((d) => SIM_PROCESS_BY_ID.get(d)!.name).join(', ')}.
            </div>
          )}
          <div className="simp-todo">
            <b>Not wired yet.</b>
            <span>
              The shell, the gating and the artifact contract are real. {def.name} runs
              once its engine lands — nothing here fabricates a result in the meantime.
            </span>
          </div>
          {/* dev seam: lets the chain be walked and the gating exercised before the
              solvers exist. It marks the step as run; it does not compute anything,
              and it says so. */}
          <div className="simp-seam">
            <button onClick={() => { onInvalidate(id); onRan(id); }}>
              Mark as run (shell only — computes nothing)
            </button>
            {done.has(id) && (
              <button onClick={() => onInvalidate(id)}>Clear this step and everything after it</button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ViewPane({ view, done, missing, busy, err }: {
  view: string; done: Set<SimProcessId>;
  missing: string | null; busy: boolean; err: string | null;
}) {
  const v = VIEWS.find((x) => x.id === view) ?? VIEWS[0];
  // which step has to have run for this view to have anything to show
  const NEEDS: Record<string, SimProcessId> = {
    plots: 'run', '3d': 'run', wells: 'run', match: 'match', forecast: 'forecast', report: 'run',
  };
  const need = NEEDS[v.id];
  const wait = need && !done.has(need) ? SIM_PROCESS_BY_ID.get(need)!.name : null;

  return (
    <div className="sim-empty">
      <b>{v.label}</b>
      <span>{v.hint}</span>
      {/* a REASONED blank: what is missing, and which step supplies it */}
      {/* a REASONED blank: what is missing, and which step supplies it */}
      <em>
        {busy ? 'solving…'
          : err ? `The run failed: ${err}`
          : missing ? `Cannot run — ${missing}.`
          : wait ? `Nothing to show — ${wait} has not run. Press Run.`
          : 'Press Run.'}
      </em>
    </div>
  );
}

function SimQc() {
  return (
    <div className="qc">
      <div className="sim-empty">
        <b>Run QC</b>
        <span>Material balance, convergence and the match score, per well and per curve.</span>
        <em>Nothing to check — no run exists.</em>
      </div>
    </div>
  );
}
