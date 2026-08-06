// SimulationTree — the Simulation surface's left drawer.
//
// The MIRROR of the Static Model's tree, deliberately: same branch shape, same row
// controls, same "this toggle changes the MODEL, not just the picture" rule, from the
// same `studio-shell` primitives. A modeller who has learned one tree has learned this
// one, and that only stays true while both are built from shared code.
//
// What differs is the CONTENT, because the two surfaces hold different things. The
// static tree lists what the reservoir IS — horizons, zones, properties. This lists
// what the case DOES — the realisation it stands on, the initial state, the schedule,
// the runs, the history it is judged against, and the forecast.
//
// ── THE STATIC MODEL IS A POINTER, NOT A COPY ───────────────────────────────
//
// The first branch names the grid realisation the case is built on and nothing else.
// A simulation case that copies the grid can drift from it silently; one that points
// at a version cannot, and when the version is rebuilt the case says it is stale.
import { Boxes, Droplets, CalendarClock, Play, Activity, GitCompare, TrendingUp } from 'lucide-react';
import { TreeBranch, TreeRow, TreeEmpty, TreeFacts } from './studio-shell';
import { useSim, SIM_PROCESSES, blockedBy } from './sim-store';
import type { Workspace } from './workspace-model';

export interface SimulationTreeProps {
  ws: Workspace;
  /** the saved static realisations this case may be built on */
  versions: Array<{ id: string; name: string; note?: string }>;
}

/** the curves a run produces, and what each is FOR */
const CURVES = [
  { key: 'oilRate', label: 'Oil rate', unit: 'Sm³/d' },
  { key: 'waterRate', label: 'Water rate', unit: 'Sm³/d' },
  { key: 'gasRate', label: 'Gas rate', unit: 'Sm³/d' },
  { key: 'watercut', label: 'Water cut', unit: 'frac' },
  { key: 'bhp', label: 'Bottom-hole pressure', unit: 'bar' },
  { key: 'cumOil', label: 'Cumulative oil', unit: 'MSm³' },
];

export function SimulationTree({ ws, versions }: SimulationTreeProps) {
  const done = useSim((s) => s.done);
  const gridVersionId = useSim((s) => s.gridVersionId);
  const setGridVersion = useSim((s) => s.setGridVersion);
  const curveKey = useSim((s) => s.curveKey);
  const setCurve = useSim((s) => s.setCurve);
  const activeWells = useSim((s) => s.activeWells);
  const setActiveWells = useSim((s) => s.setActiveWells);
  const showObserved = useSim((s) => s.showObserved);
  const setShowObserved = useSim((s) => s.setShowObserved);

  const flowing = ws.bores.filter((b) => b.role === 'oil-producer' || /inject/i.test(String(b.role ?? '')));
  const wellsOn = activeWells ?? flowing.map((b) => b.name);
  const toggleWell = (name: string) => {
    const next = wellsOn.includes(name) ? wellsOn.filter((w) => w !== name) : [...wellsOn, name];
    setActiveWells(next);
  };

  return (
    <div className="mt">
      <div className="mt-head">Simulation</div>

      {/* ── the realisation this case stands on ── */}
      <TreeBranch id="basis" icon={<Boxes size={13} />} label="Static basis"
        count={gridVersionId ? '1/1' : `0/${versions.length}`}
        affects="the case POINTS at a saved realisation — rebuild that version and this case reports stale, it does not silently follow">
        {versions.length === 0
          ? <TreeEmpty>no saved realisation — build and save one in the Static Model</TreeEmpty>
          : versions.map((v) => (
            <TreeRow key={v.id} kind="radio" on={gridVersionId === v.id}
              onToggle={() => setGridVersion(gridVersionId === v.id ? null : v.id)}
              label={v.name} right={v.note ? undefined : 'grid'} />
          ))}
      </TreeBranch>

      {/* ── initial state ── */}
      <TreeBranch id="init" icon={<Droplets size={13} />} label="Initial state"
        count={done.has('init') ? 'ready' : '—'}
        affects="equilibration sets the state at time zero; every run starts from it">
        {done.has('init')
          ? <TreeFacts><span>{ws.contacts.length} contact{ws.contacts.length === 1 ? '' : 's'}</span></TreeFacts>
          : <TreeEmpty>not initialised</TreeEmpty>}
      </TreeBranch>

      {/* ── schedule ── */}
      <TreeBranch id="schedule" icon={<CalendarClock size={13} />} label="Well schedule"
        count={`${wellsOn.length}/${flowing.length}`}
        affects="a well switched off here is not in the RUN — it is not merely hidden from the plot">
        {flowing.length === 0
          ? <TreeEmpty>no producers or injectors in the delivery</TreeEmpty>
          : flowing.map((b) => (
            <TreeRow key={b.name} on={wellsOn.includes(b.name)} onToggle={() => toggleWell(b.name)}
              label={b.name}
              right={/inject/i.test(String(b.role ?? '')) ? 'INJ' : 'PROD'} />
          ))}
      </TreeBranch>

      {/* ── runs ── */}
      <TreeBranch id="runs" icon={<Play size={13} />} label="Runs" defaultOpen={false}
        count={done.has('run') ? '1' : '0'}>
        {done.has('run')
          ? <TreeFacts><span>base case</span></TreeFacts>
          : <TreeEmpty>nothing has been run</TreeEmpty>}
      </TreeBranch>

      {/* ── the curve the plots draw ── */}
      <TreeBranch id="curves" icon={<Activity size={13} />} label="Results"
        affects="one at a time — this is what the plot pane draws">
        {CURVES.map((c) => (
          <TreeRow key={c.key} kind="radio" on={curveKey === c.key}
            onToggle={() => setCurve(c.key)} label={c.label} right={c.unit}
            dim={!done.has('run')}
            title={done.has('run') ? undefined : 'nothing has been run yet'} />
        ))}
      </TreeBranch>

      {/* ── observed history ── */}
      <TreeBranch id="observed" icon={<GitCompare size={13} />} label="Observed history"
        count={done.has('observed') ? 'loaded' : '—'}
        affects="the measured data the run is SCORED against; without it there is no match">
        <TreeRow on={showObserved} onToggle={() => setShowObserved(!showObserved)}
          label="Show history on plots" dim={!done.has('observed')}
          disabled={!done.has('observed')}
          title={done.has('observed') ? undefined : 'no observed data loaded'} />
        {!done.has('observed') && <TreeEmpty>not loaded</TreeEmpty>}
      </TreeBranch>

      {/* ── forecast ── */}
      <TreeBranch id="forecast" icon={<TrendingUp size={13} />} label="Forecast" defaultOpen={false}
        count={done.has('forecast') ? 'ready' : '—'}>
        {done.has('forecast')
          ? <TreeFacts><span>base forecast</span></TreeFacts>
          : (
            <TreeEmpty>
              {blockedBy('forecast', done)
                ? `waiting on ${blockedBy('forecast', done)}`
                : 'not run'}
            </TreeEmpty>
          )}
      </TreeBranch>

      {/* ── the chain, as a state, so "what is left" is never a guess ── */}
      <TreeBranch id="chain" icon={<Activity size={13} />} label="Chain" defaultOpen={false}
        count={`${done.size}/${SIM_PROCESSES.length}`}>
        {SIM_PROCESSES.map((p) => {
          const wait = blockedBy(p.id, done);
          return (
            <div key={p.id} className={`mt-chain${done.has(p.id) ? ' done' : wait ? ' blocked' : ' ready'}`}>
              <span>{p.name}</span>
              <em>{done.has(p.id) ? 'done' : wait ? `needs ${wait}` : 'ready'}</em>
            </div>
          );
        })}
      </TreeBranch>
    </div>
  );
}
