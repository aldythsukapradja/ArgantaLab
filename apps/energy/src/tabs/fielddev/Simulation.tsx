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
import { PlotsPane, WellsPane, ForecastPane, MatchPane, ReportPane, Blank } from './sim-views';

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
  const fluids = useSimFluids(field.id);

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
        markDone('case'); markDone('init'); markDone('schedule'); markDone('run');
      } catch (e) {
        setRunErr(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }, 16);
  }, [grid, fluids, wellsIn, markDone, tEnd]);

  const activeTab = useMemo(
    () => SIM_RIBBON_TABS.find((t) => t.id === ribbon) ?? SIM_RIBBON_TABS[0],
    [ribbon],
  );

  const basis = versions.find((v) => v.id === gridVersionId) ?? null;

  const subtitle = !ready
    ? 'reading the workspace…'
    : basis
      ? `${field.name} · on ${basis.name} · ${ws.bores.length} bores`
      : `${field.name} · no static basis selected`;

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
          : <Blank>The 3D dynamic viewer reuses the Static Model viewport and lands with the frame writer.</Blank>
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
