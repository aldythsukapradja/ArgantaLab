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
import { reservoirEntry } from './well-paths';
import { readRecord } from '../../dataqc/readDigest';
import { propValueAt } from './prop-view';
import { simulateFV } from '../../engine/sim/fv';
import { columnAverages, coarsen, factorFor, runCase, assumptionsOf, type SimWellInput, type RunOutput } from './sim-run';
import { buildCase, V0_RECIPE } from './build-case';
import { indexedDbCaseStore } from './case-store';
import { useFluidBasis, assembleCase } from './fluids-live';
import { useFluidCase } from './fluid-case-store';
import { PlotsPane, WellsPane, ForecastPane, MatchPane, ReportPane, Blank } from './sim-views';
import { GeaStudio } from './GeaStudio';
import { ensureProp } from './grid-props';
import { buildFrames, writeFrame, expandFrame, swRangeOf, FRAME_NOTE, type FrameSet } from './sim-frames';
import { indexedDbRunStore, runId, runMatches, mismatchReason, type StoredRun } from './run-store';

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
  const setGridVersion = useSim((s) => s.setGridVersion);

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
  // ONE grid for the whole vertical. Static, dynamic and streamline all read v0, so a
  // number carried between them is a number about the same rock. Choosing a different
  // realisation per surface is how three tabs end up quietly describing three fields.
  const BASIS = 'v0';
  useEffect(() => { if (gridVersionId !== BASIS) setGridVersion(BASIS); }, [gridVersionId, setGridVersion]);
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

  // ── WELLS GO WHERE THEY MEET THE RESERVOIR, NOT WHERE THEY ARE DRILLED ───
  //
  // Volve is one platform: every bore's surface slot is within metres of every other,
  // so placing wells by wellhead put all 24 in the same grid cell even at 50 m
  // resolution. The waterflood then had one producer and one injector at the same
  // point — which is why a nine-well flood animated as a single well. It WAS one well.
  //
  // Each trajectory is walked to the reservoir's mid-depth. A bore with no survey, or
  // one that never reaches the reservoir, is DROPPED with a reason rather than placed
  // at its slot: a well in the wrong cell is worse than a well that is missing, because
  // the run still looks reasonable.
  const [wellsIn, setWellsIn] = useState<SimWellInput[]>([]);
  const [wellNote, setWellNote] = useState<string[]>([]);
  useEffect(() => {
    const flowing = ws.bores.filter((b) => b.role === 'oil-producer' || /inject/i.test(String(b.role ?? '')));
    if (!flowing.length || !grid?.zoneLayers?.length) { setWellsIn([]); return; }
    const zl = grid.zoneLayers;
    const rz = zl[zl.length - 1];
    let alive = true;
    (async () => {
      // the reservoir's mid-depth, averaged over the columns it actually occupies
      const p = grid.packed;
      let zs = 0, zn = 0;
      for (let c = 0; c < p.nx * p.ny; c++) {
        if (!p.activeCol[c]) continue;
        const t = p.topZ[c], b = p.baseZ[c];
        if (!Number.isFinite(t) || !Number.isFinite(b)) continue;
        const f0 = rz.k0 / p.nz, f1 = (rz.k0 + rz.nz) / p.nz;
        zs += t + ((f0 + f1) / 2) * (b - t); zn++;
      }
      const target = zn ? zs / zn : NaN;
      const out: SimWellInput[] = [];
      const notes: string[] = [];
      for (const b of flowing) {
        if (b.x == null || b.y == null) { notes.push(`${b.name}: no surface slot`); continue; }
        const aid = b.assetIds?.trajectory;
        const asset = aid ? ws.assets.find((a) => a.id === aid) : null;
        if (!asset) { notes.push(`${b.name}: no survey — cannot locate it in the reservoir`); continue; }
        const traj = await readRecord<{ stations?: Array<{ tvd?: number; dispEw?: number; dispNs?: number }> }>(asset).catch(() => null);
        const kb = b.kbM ?? 0;
        const st = (traj?.stations ?? []).map((x) => ({ ...x, tvd: (x.tvd ?? NaN) - kb }));
        const e = reservoirEntry({ x: b.x, y: b.y }, st, target);
        if (!e) { notes.push(`${b.name}: survey has no usable stations`); continue; }
        if (e.shallow) { notes.push(`${b.name}: survey stops at ${e.tvdss.toFixed(0)} m, above the reservoir`); continue; }
        out.push({
          name: b.name, x: e.x, y: e.y,
          kind: /inject/i.test(String(b.role ?? '')) ? 'injector' : 'producer',
        });
      }
      if (alive) { setWellsIn(out); setWellNote(notes); }
    })();
    return () => { alive = false; };
  }, [ws.bores, ws.assets, grid]);

  // the simulated period, and where history is taken to stop. Both are the user's to
  // set; the split is what makes the right-hand half of every chart a FORECAST.
  const [tEnd, setTEnd] = useState(3650);
  const [historyEnd, setHistoryEnd] = useState<number | null>(1825);

  const [run, setRun] = useState<RunOutput | null>(null);
  const [frames, setFrames] = useState<FrameSet | null>(null);
  // the coarsened flow grid the frames live on — NOT the geological grid
  const [coarse, setCoarse] = useState<{ grid: { nx: number; ny: number; nz: number; activeCol: ArrayLike<number> }; factor: number; note: string } | null>(null);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  // which dynamic field the viewport is colouring by
  const [dynProp, setDynProp] = useState<'swSim' | 'sweep'>('swSim');
  const [runErr, setRunErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<StoredRun | null>(null);
  const [restored, setRestored] = useState(false);

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
        // ── ONLY THE RESERVOIR FLOWS ─────────────────────────────────────
        //
        // v0 spans BCU to Hugin Base: layers 0-9 are overburden. Averaging the whole
        // stack put 140 m of seal into the flow model and inflated the pore volume so
        // far that ten years of injection moved 1% of it — the flood was physical and
        // invisible. The LAST zone is the reservoir.
        const zl = grid.zoneLayers ?? [];
        const resZone = zl.length ? zl[zl.length - 1] : null;
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
          resZone ? { k0: resZone.k0, nz: resZone.nz } : undefined,
        );

        // ── AND IT FLOWS ON A COARSER GRID ───────────────────────────────
        //
        // An implicit solve on Volve's 166 x 131 takes ~5 minutes on this thread; the
        // surface showed "solving..." and froze. ~3000 cells brings it to ~12 s, which
        // is a screening tool rather than a hang. The factor is REPORTED, never hidden.
        const f = factorFor(p.nx, p.ny, 3000);
        const co = coarsen(p as never, cols, f);
        const out = runCase(co.grid, co.cols, fluids, wellsIn,
          { tEnd: tEnd, nReports: 40 }, simulateFV);
        out.assumptions = assumptionsOf(out.build.meanH, out.build.rejected, co.note, out.build.collisions);
        out.assumptions.caveats.push(...wellNote);
        setCoarse(co);
        setRun(out);
        // SAVED, so it is solved once. The Streamline surface reads this same record —
        // tracing a re-run would be tracing a different realisation of the same recipe
        // and its allocations would quietly disagree with the animation next door.
        const stored: StoredRun = {
          id: runId(ws.fieldId, BASIS, tEnd), fieldId: ws.fieldId, gridVersionId: BASIS,
          savedAt: Date.now(), tEnd, historyEnd,
          series: out.series, assumptions: out.assumptions,
          grid: {
            nx: co.grid.nx, ny: co.grid.ny, nz: co.grid.nz,
            dx: co.grid.dx, dy: co.grid.dy, x0: co.grid.x0, y0: co.grid.y0,
            activeCol: Uint8Array.from(co.grid.activeCol as ArrayLike<number>),
            phi: Float64Array.from(out.build.cfg.phi as ArrayLike<number>),
            dz: out.build.meanH,
          },
          coarseFactor: co.factor,
          times: out.result.snapshots.map((x) => x.t),
          sw: out.result.snapshots.map((x) => x.sw),
          fluxX: out.result.snapshots.map((x) => x.fluxX),
          fluxY: out.result.snapshots.map((x) => x.fluxY),
          placed: out.build.placed, collisions: out.build.collisions,
        };
        void indexedDbRunStore.put(stored);
        setSaved(stored);
        // the frames the 3D viewport animates. Built once, from the same result the
        // charts read, so the picture and the numbers cannot disagree.
        setFrames(buildFrames(co.grid as never, out.result, fluids.sor));
        setStep(0);
        markDone('case'); markDone('init'); markDone('schedule'); markDone('run');
      } catch (e) {
        setRunErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 16);
  }, [grid, fluids, wellsIn, markDone, tEnd, wellNote]);

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
    if (!coarse) return;
    const ix = Math.max(0, Math.min(frames.sw.length - 1, step));
    // the frames live on the COARSE flow grid; the viewport draws the geological one
    const swProp = ensureProp(p as never, 'swSim');
    swProp.min = frames.swRange.lo; swProp.max = frames.swRange.hi;
    writeFrame(swProp as never, expandFrame(p as never, coarse.grid.nx, coarse.factor, frames.sw[ix]));
    const swpProp = ensureProp(p as never, 'sweep');
    swpProp.min = 0; swpProp.max = 1;
    writeFrame(swpProp as never, expandFrame(p as never, coarse.grid.nx, coarse.factor, frames.sweep[ix]));
    bumpProps();
  }, [grid, frames, step, bumpProps, coarse]);

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

  // ── RESTORE, RATHER THAN RE-SOLVE ────────────────────────────────────────
  //
  // A saved run is only valid against the realisation it was solved on. That is
  // CHECKED, not assumed: loading one against a different grid is a silent failure —
  // the charts render, the animation plays, and the flood is on rock it never flowed
  // through. When it does not match, the reason is shown and the Run button stays.
  const [staleWhy, setStaleWhy] = useState<string | null>(null);
  useEffect(() => {
    if (restored || !ws.fieldId || !grid?.packed) return;
    let alive = true;
    (async () => {
      const st = await indexedDbRunStore.get(runId(ws.fieldId, BASIS, tEnd));
      if (!alive) return;
      setRestored(true);
      if (runMatches(st, ws.fieldId, BASIS, tEnd)) {
        setSaved(st);
        // the charts read `run`; a restored record carries the series and assumptions,
        // and the frames are rebuilt from its saturation field
        setRun({ series: st!.series, assumptions: st!.assumptions,
          build: { cfg: null as never, placed: st!.placed, rejected: [], meanH: st!.grid.dz, collisions: st!.collisions },
          result: null as never } as RunOutput);
        setCoarse({ grid: st!.grid, factor: st!.coarseFactor, note: '' });
        setFrames({
          times: st!.times, sw: st!.sw,
          sweep: st!.sw.map((f) => f),
          swRange: swRangeOf(st!.sw),
        });
        markDone('case'); markDone('init'); markDone('schedule'); markDone('run');
      } else if (st) {
        setStaleWhy(mismatchReason(st, ws.fieldId, BASIS, tEnd));
      }
    })();
    return () => { alive = false; };
  }, [restored, ws.fieldId, grid, tEnd, markDone]);

  const activeTab = useMemo(
    () => SIM_RIBBON_TABS.find((t) => t.id === ribbon) ?? SIM_RIBBON_TABS[0],
    [ribbon],
  );

  const basis = versions.find((v) => v.id === gridVersionId) ?? null;

  const subtitle = !ready
    ? 'reading the workspace…'
    : basis
      ? `${field.name} · on ${basis.name} · ${ws.bores.length} bores`
      : saved
        ? `${field.name} · v0 · saved run, ${saved.times.length} steps · ${ws.bores.length} bores`
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
      {/* THE DIALOG FLOATS. It used to REPLACE the canvas, so opening any ribbon
          button threw away the run you were looking at — which is exactly the
          complaint. The Static Model docks its process dialogs over the viewport for
          this reason; this is the same behaviour, from the same intent. */}
      {open && (
        <ProcessPane id={open} onClose={() => setOpen(null)}
          done={done} onRan={markDone} onInvalidate={invalidate} />
      )}
      {run ? (
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
        <ViewPane view={view} done={done} missing={missing} busy={busy} err={runErr} stale={staleWhy} />
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

function ViewPane({ view, done, missing, busy, err, stale }: {
  view: string; done: Set<SimProcessId>;
  missing: string | null; busy: boolean; err: string | null; stale: string | null;
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
          : stale ? `A saved run exists but does not apply — ${stale}. Press Run.`
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
