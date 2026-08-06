// sim-views — the Simulation surface's panes, on real run output.
//
// Every pane here obeys the same rule as the rest of the app: it draws what the run
// produced and states what is absent. There is no placeholder curve, and no pane
// silently borrows the previous run's numbers when the current one has not been made.
import { useMemo } from 'react';
import { TimeChart, type Series } from './TimeChart';
import type { RunOutput } from './sim-run';
import { splitAtHistory } from './sim-run';

const OIL = '#f97316', WATER = '#38bdf8', INJ = '#a78bfa', PRESS = '#f43f5e', CUT = '#22c55e';

/** the run's own assumptions, printed wherever its numbers are. Never optional. */
export function Assumptions({ run }: { run: RunOutput }) {
  return (
    <div className="sim-assume">
      <b>What this run is</b>
      <span>{run.assumptions.phases}</span>
      <span>{run.assumptions.dimensionality}</span>
      <span>{run.assumptions.compressibility}</span>
      {run.assumptions.caveats.map((c, i) => <em key={i}>{c}</em>)}
    </div>
  );
}

export function PlotsPane({ run, historyEnd }: { run: RunOutput; historyEnd: number | null }) {
  const f = run.series.field;

  const rates = useMemo<Series[]>(() => {
    const split = historyEnd != null ? splitAtHistory(run.series, historyEnd) : null;
    const seg = (pick: (s: typeof f[number]) => number, key: string, label: string, color: string): Series[] => {
      if (!split) return [{ key, label, color, points: f.map((s) => ({ x: s.t, y: pick(s) })) }];
      return [
        { key, label, color, points: split.history.map((s) => ({ x: s.t, y: pick(s) })) },
        { key: `${key}-f`, label: `${label} (forecast)`, color, forecast: true,
          points: split.forecast.map((s) => ({ x: s.t, y: pick(s) })) },
      ];
    };
    return [
      ...seg((s) => s.oilRate, 'oil', 'Oil rate', OIL),
      ...seg((s) => s.waterRate, 'water', 'Water rate', WATER),
      ...seg((s) => s.injRate, 'inj', 'Injection rate', INJ),
      { key: 'wc', label: 'Water cut', color: CUT, axis: 'right',
        points: f.map((s) => ({ x: s.t, y: s.watercut })) },
    ];
  }, [f, run.series, historyEnd]);

  const cums = useMemo<Series[]>(() => [
    { key: 'co', label: 'Cumulative oil', color: OIL, fill: true, points: f.map((s) => ({ x: s.t, y: s.cumOil })) },
    { key: 'cw', label: 'Cumulative water', color: WATER, points: f.map((s) => ({ x: s.t, y: s.cumWater })) },
    { key: 'ci', label: 'Cumulative injection', color: INJ, points: f.map((s) => ({ x: s.t, y: s.cumInj })) },
  ], [f]);

  const recovery = useMemo<Series[]>(() => [
    { key: 'rf', label: 'Recovery factor', color: OIL, fill: true, points: f.map((s) => ({ x: s.t, y: s.rf })) },
    { key: 'p', label: 'Mean pressure', color: PRESS, axis: 'right', points: f.map((s) => ({ x: s.t, y: s.pAvg })) },
  ], [f]);

  const last = f[f.length - 1];

  return (
    <div className="sim-scroll">
      <div className="sim-kpis">
        <Kpi label="Cumulative oil" value={fmtVol(last.cumOil)} unit="Sm³" />
        <Kpi label="Recovery factor" value={(last.rf * 100).toFixed(1)} unit="%" />
        <Kpi label="Water cut" value={(last.watercut * 100).toFixed(1)} unit="%" />
        <Kpi label="Pore volumes injected" value={last.pvi.toFixed(3)} unit="PV" />
        <Kpi label="OOIP (surface)" value={fmtVol(run.series.ooipSm3)} unit="Sm³" />
      </div>

      <ChartBlock title="Rates" note="Rates are DIFFERENCED from the cumulatives, so the two charts integrate to each other.">
        <TimeChart series={rates} xLabel="Time (days)" yLabel="Rate (Sm³/d)" yRightLabel="Water cut"
          historyEnd={historyEnd} height={300} />
      </ChartBlock>

      <ChartBlock title="Cumulative production and injection"
        note="Surface volumes: the solver works in reservoir volumes and these are divided by Bo and Bw.">
        <TimeChart series={cums} xLabel="Time (days)" yLabel="Volume (Sm³)" historyEnd={historyEnd} height={260} />
      </ChartBlock>

      <ChartBlock title="Recovery and pressure"
        note="Recovery is against this run's own oil in place, not the static model's STOIIP — the areal collapse changes it.">
        <TimeChart series={recovery} xLabel="Time (days)" yLabel="Recovery factor"
          yRightLabel="Pressure (bar)" historyEnd={historyEnd} height={240} precision={3} />
      </ChartBlock>

      <Assumptions run={run} />
    </div>
  );
}

export function WellsPane({ run, historyEnd }: { run: RunOutput; historyEnd: number | null }) {
  const prod = run.series.wells.filter((w) => w.kind === 'producer');
  const inj = run.series.wells.filter((w) => w.kind === 'injector');
  const mk = (ws: typeof prod, base: string): Series[] => ws.map((w, i) => ({
    key: w.name, label: w.name,
    // spread the hue so ten wells stay separable rather than ten shades of one colour
    color: `hsl(${(i * 47 + (base === 'oil' ? 20 : 250)) % 360} 70% 58%)`,
    points: w.steps.map((s) => ({ x: s.t, y: s.rate })),
  }));

  return (
    <div className="sim-scroll">
      <ChartBlock title={`Producers (${prod.length})`} note="Rates are magnitudes — no sign convention to remember.">
        {prod.length
          ? <TimeChart series={mk(prod, 'oil')} xLabel="Time (days)" yLabel="Rate (Sm³/d)" historyEnd={historyEnd} height={280} />
          : <Blank>No producer was placed on an active column.</Blank>}
      </ChartBlock>
      <ChartBlock title={`Injectors (${inj.length})`}>
        {inj.length
          ? <TimeChart series={mk(inj, 'water')} xLabel="Time (days)" yLabel="Rate (Sm³/d)" historyEnd={historyEnd} height={240} />
          : <Blank>No injector was placed on an active column.</Blank>}
      </ChartBlock>
      {run.build.rejected.length > 0 && (
        <div className="sim-assume">
          <b>Wells not in the run</b>
          {run.build.rejected.map((r) => <em key={r.name}>{r.name} — {r.reason}</em>)}
          <span>These are refused rather than moved to the nearest live cell: a nudged well is in the wrong place and the plot still looks reasonable.</span>
        </div>
      )}
    </div>
  );
}

export function ForecastPane({ run, historyEnd }: { run: RunOutput; historyEnd: number | null }) {
  if (historyEnd == null) {
    return <Blank>No history end is set, so nothing here is a forecast — the whole run is one curve.</Blank>;
  }
  const { history, forecast } = splitAtHistory(run.series, historyEnd);
  const last = forecast[forecast.length - 1];
  const atHistory = history[history.length - 1];

  const s: Series[] = [
    { key: 'h', label: 'Cumulative oil (history)', color: OIL, points: history.map((p) => ({ x: p.t, y: p.cumOil })) },
    { key: 'f', label: 'Cumulative oil (forecast)', color: OIL, forecast: true,
      points: forecast.map((p) => ({ x: p.t, y: p.cumOil })) },
  ];

  return (
    <div className="sim-scroll">
      <div className="sim-kpis">
        <Kpi label="At history end" value={fmtVol(atHistory?.cumOil ?? NaN)} unit="Sm³" />
        <Kpi label="At forecast end" value={fmtVol(last?.cumOil ?? NaN)} unit="Sm³" />
        <Kpi label="Incremental" value={fmtVol((last?.cumOil ?? 0) - (atHistory?.cumOil ?? 0))} unit="Sm³" />
        <Kpi label="RF at forecast end" value={((last?.rf ?? 0) * 100).toFixed(1)} unit="%" />
      </div>
      <ChartBlock title="Forecast"
        note="The dashed segment is prediction. It is the SAME physics as the history segment — what changes is that nothing measured constrains it.">
        <TimeChart series={s} xLabel="Time (days)" yLabel="Cumulative oil (Sm³)" historyEnd={historyEnd} height={300} />
      </ChartBlock>
      <Assumptions run={run} />
    </div>
  );
}

export function MatchPane({ run, historyEnd }: { run: RunOutput; historyEnd: number | null }) {
  // OBSERVED DATA IS NOT WIRED. A match pane that scores a run against nothing, or
  // against the run itself, reads as a good match and is the most misleading thing
  // this surface could show.
  void run; void historyEnd;
  return (
    <Blank>
      No observed history has been loaded, so there is nothing to score the run against.
      Load it in the <b>Observed data</b> step — until then this pane stays empty rather
      than reporting a match against nothing.
    </Blank>
  );
}

export function ReportPane({ run, historyEnd }: { run: RunOutput; historyEnd: number | null }) {
  const f = run.series.field;
  const last = f[f.length - 1];
  return (
    <div className="sim-scroll">
      <table className="sim-table">
        <tbody>
          <Row k="Grid" v={`${run.build.cfg.nx} × ${run.build.cfg.ny} areal · ${run.build.meanH.toFixed(1)} m mean gross`} />
          <Row k="Wells in the run" v={`${run.build.placed.length} placed · ${run.build.rejected.length} refused`} />
          <Row k="Simulated period" v={`${last.t.toFixed(0)} days · ${f.length} report steps`} />
          <Row k="History end" v={historyEnd != null ? `${historyEnd.toFixed(0)} days` : 'not set — the run is not split'} />
          <Row k="Pore volume" v={`${fmtVol(run.series.poreVolume)} rm³`} />
          <Row k="OOIP (surface)" v={`${fmtVol(run.series.ooipSm3)} Sm³`} />
          <Row k="Cumulative oil" v={`${fmtVol(last.cumOil)} Sm³`} />
          <Row k="Recovery factor" v={`${(last.rf * 100).toFixed(1)} %`} />
          <Row k="Pore volumes injected" v={last.pvi.toFixed(3)} />
          <Row k="Final water cut" v={`${(last.watercut * 100).toFixed(1)} %`} />
        </tbody>
      </table>
      <Assumptions run={run} />
    </div>
  );
}

// ── small shared pieces ─────────────────────────────────────────────────────

function Row({ k, v }: { k: string; v: string }) {
  return <tr><th>{k}</th><td>{v}</td></tr>;
}

function Kpi({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="sim-kpi">
      <b>{value}<em>{unit}</em></b>
      <span>{label}</span>
    </div>
  );
}

function ChartBlock({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="sim-block">
      <h4>{title}</h4>
      {children}
      {note && <p className="sim-note">{note}</p>}
    </section>
  );
}

export function Blank({ children }: { children: React.ReactNode }) {
  return <div className="sim-empty"><em>{children}</em></div>;
}

const fmtVol = (v: number) => {
  if (!Number.isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1e9) return `${(v / 1e9).toFixed(2)}G`;
  if (a >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(1)}k`;
  return v.toFixed(0);
};
