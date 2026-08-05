// WellReviewCards.tsx — the Well Review Register. One card per producer, ranked
// worst-first, with EVERY headline number on the face of the card (latest rate, the move
// on the prior month, YoY decline, remaining reserves + its error, the pattern's VRR,
// water cut, TD, peer benchmark). Clicking a card expands it IN PLACE — no modal — to
// add the well's own production/injection history, reusing the same D3 VoidageChart the
// dossier's signature panel uses, plus the ranked root cause and the action plan.
import { useMemo, useState } from 'react';
import { ChevronRight, Droplets, GaugeCircle, Ruler, TrendingDown, TrendingUp } from 'lucide-react';
import { fmt1, fmtInt, type WellReview } from './well-review';
import { VoidageChartView } from './SurveillanceChartViews';
import { MSCF_PER_BOE, type VoidagePoint } from '../../engine/charts/SurveillanceCharts';
import type { RMWellSeries } from './data';

/** One metric on the card face. `dir` says which way is good, so tone is per-metric. */
function Cell({ label, value, unit, sub, dir, tone, big }: {
  label: string; value: string; unit?: string; sub?: string; big?: boolean;
  dir?: 'up-good' | 'down-good'; tone?: 'good' | 'warn' | 'bad' | 'unknown';
}) {
  const numeric = parseFloat(value.replace(/[^0-9.+-]/g, ''));
  const auto = dir && Number.isFinite(numeric) && numeric !== 0
    ? ((numeric > 0) === (dir === 'up-good') ? 'good' : 'bad')
    : undefined;
  return (
    <div className={'rms-wr-cell' + (big ? ' big' : '') + (tone || auto ? ' tone-' + (tone ?? auto) : '')}>
      <span>{label}</span>
      <b>{value}{unit && <em>{unit}</em>}</b>
      {sub && <small>{sub}</small>}
    </div>
  );
}

function seriesFor(w: RMWellSeries | undefined): VoidagePoint[] {
  if (!w) return [];
  let li = -1;
  for (let i = w.oilRate.length - 1; i >= 0; i--) if (w.oilRate[i] > 0) { li = i; break; }
  return w.ym.map((label, i) => {
    const gasMscf = w.gasRate[i] ?? 0;
    return {
      label, oil: w.oilRate[i] ?? 0, water: w.waterRate[i] ?? 0,
      gas: gasMscf / MSCF_PER_BOE, gasMscf,
      inj: w.injRate[i] ?? 0, vrr: null, live: li < 0 || i <= li,
    };
  });
}

export function WellReviewCards({ rows, byWell }: { rows: WellReview[]; byWell: Record<string, RMWellSeries> }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!rows.length) {
    return <div className="rms-sd-empty small"><b>No well-level series</b><span>this field reports at field level only</span></div>;
  }
  return (
    <div className="rms-wr">
      {rows.map((r, i) => <Card key={r.well} r={r} rank={i + 1} series={byWell[r.well]}
        open={open === r.well} onToggle={() => setOpen(open === r.well ? null : r.well)} />)}
    </div>
  );
}

function Card({ r, rank, series, open, onToggle }: {
  r: WellReview; rank: number; series?: RMWellSeries; open: boolean; onToggle: () => void;
}) {
  const pts = useMemo(() => (open ? seriesFor(series) : []), [open, series]);
  const deltaTxt = r.deltaPrevPct == null ? '—' : `${r.deltaPrevPct >= 0 ? '+' : ''}${fmt1(r.deltaPrevPct)}`;
  const yoyTxt = r.yoyDeclinePct == null ? '—' : `${r.yoyDeclinePct >= 0 ? '+' : ''}${fmt1(r.yoyDeclinePct)}`;
  const vrrTone = r.patternVrr == null ? 'unknown'
    : Math.abs(r.patternVrr - 1) <= 0.15 ? 'good' : 'warn';

  return (
    <article className={'rms-wr-card tone-' + r.tone + (open ? ' open' : '') + (r.rankable ? '' : ' unrankable')}>
      <button className="rms-wr-head" onClick={onToggle} aria-expanded={open}>
        <span className="rms-wr-rank">{r.rankable ? rank : '—'}</span>
        <span className="rms-wr-id">
          <b>{r.well}</b>
          <small>{r.role}{r.latestYm ? ` · to ${r.latestYm}` : ''}</small>
        </span>

        {/* the bar is CUMULATIVE OIL — how much of the field this well actually delivered,
            so the biggest contributor reads as the biggest bar */}
        <span className="rms-wr-cum" title={r.hasSeries
          ? `#${r.cumRank} by cumulative oil · ${fmt1(r.cumOilMM)} MMSTB · ${r.shareOfFieldPct != null ? fmt1(r.shareOfFieldPct) + '% of field' : 'share unknown'}`
          : 'no production series on record'}>
          <span className="rms-wr-cum-top">
            <em>{r.hasSeries ? `#${r.cumRank} by cum oil` : 'no production record'}</em>
            {r.hasSeries && <s>{fmt1(r.cumOilMM)} MMSTB{r.shareOfFieldPct != null ? ` · ${fmt1(r.shareOfFieldPct)}%` : ''}</s>}
          </span>
          <span className={'rms-wr-cum-track' + (r.hasSeries ? '' : ' empty')}>
            {r.hasSeries && <i style={{ width: `${Math.max(2, r.cumShareOfMax * 100)}%` }} />}
          </span>
        </span>

        <span className="rms-wr-score" title={r.hasSeries
          ? `health ${r.health.toFixed(0)}${r.benchPercentile != null ? ` · P${r.benchPercentile} of the field cohort` : ''}`
          : 'not scored — no production series'}>
          <b>{r.hasSeries ? r.health.toFixed(0) : '—'}</b>
          <em>{r.hasSeries ? (r.benchPercentile != null ? `P${r.benchPercentile}` : 'n/a') : 'no data'}</em>
        </span>
        <ChevronRight size={15} className="rms-wr-chev" />
      </button>

      {/* every headline number lives on the FACE of the card */}
      <div className="rms-wr-grid">
        <Cell label="Latest oil" value={fmtInt(r.latestRate)} unit=" bopd" big sub={r.latestYm ?? ''} />
        <Cell label="vs prior mo" value={deltaTxt} unit="%" dir="up-good"
          sub={r.deltaPrev != null ? `${r.deltaPrev >= 0 ? '+' : ''}${fmtInt(r.deltaPrev)} bopd` : 'no prior month'} />
        <Cell label="Stabilized decline" value={r.decline.annualPct != null ? fmt1(r.decline.annualPct) : '—'} unit="%/yr"
          tone={r.decline.annualPct == null ? 'unknown' : r.decline.annualPct > -15 ? 'good' : r.decline.annualPct > -35 ? 'warn' : 'bad'}
          sub={r.decline.excludedMonths > 0 ? `excl. ${r.decline.excludedMonths} mo abandonment` : 'full post-peak fit'} />
        <Cell label="Remaining" value={fmt1(r.remainingMMstb)} unit=" MMSTB" tone={r.remainingTrust}
          sub={r.remainingMapePct != null ? `±${Math.round(r.remainingMapePct)}% blind test` : 'no error estimate'} />
        <Cell label="Pattern VRR" value={r.patternVrr != null ? r.patternVrr.toFixed(2) : '—'} tone={vrrTone}
          sub={r.patternName ? r.patternName : 'no pattern linked'} />
        <Cell label="Water cut" value={r.wct != null ? Math.round(r.wct).toString() : '—'} unit="%"
          tone={r.wct != null && r.wct > 90 ? 'bad' : r.wct != null && r.wct > 70 ? 'warn' : 'good'}
          sub={`WOR ${r.worTrendPct >= 0 ? '+' : ''}${Math.round(r.worTrendPct)}%/yr`} />
        <Cell label="Year on year" value={yoyTxt} unit="%" dir="up-good"
          sub={r.decline.excludedMonths > 0 ? 'includes shut-down' : '12-mo vs prior 12'} />
        <Cell label="TD" value={r.tdMd != null ? fmtInt(r.tdMd) : '—'} unit=" m MD"
          tone={r.rankable ? undefined : 'bad'}
          sub={r.tdTvd != null ? `${fmtInt(r.tdTvd)} m TVD` : 'no TVD'} />
      </div>

      <div className="rms-wr-note">
        <span className="rms-wr-obs">{r.observation}</span>
        <span className="rms-wr-ins"><TrendingDown size={11} />{r.insight}</span>
      </div>

      {r.flags.length > 0 && (
        <div className="rms-wr-flags">{r.flags.map((f) => <i key={f}>{f}</i>)}</div>
      )}

      {open && (
        <div className="rms-wr-more">
          {/* the well's own production / injection history — same D3 chart class as the
              dossier's signature panel, so the reading grammar is identical */}
          <div className="rms-wr-chart-h"><Droplets size={12} /><span>Production &amp; injection history</span><em>{r.well}</em></div>
          {pts.length
            ? <div className="rms-wr-chart"><VoidageChartView data={pts} events={[]}
                xUnit="year (monthly steps)" yUnit="rate · boe/d ▲ produced ▼ injected" y2Unit="" /></div>
            : <div className="rms-sd-empty small"><b>No monthly series</b><span>this well has no production record</span></div>}

          <div className="rms-wr-diag">
            <div className="rms-wr-cause">
              <h5>Root cause — ranked</h5>
              {r.rootCauses.map((c) => (
                <div key={c.cause} className="rms-wr-cause-row">
                  <b>{c.cause}<s>{Math.round(c.confidence * 100)}%</s></b>
                  <ul>{c.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
                  <p>{c.remedy}</p>
                </div>
              ))}
            </div>
            <div className="rms-wr-plan">
              <h5>Action plan</h5>
              <p>{r.action}</p>
              <div className="rms-wr-meta">
                <span><GaugeCircle size={11} />Pattern {r.patternName ?? '—'}{r.patternInjectors.length ? ` · injectors ${r.patternInjectors.join(', ')}` : ''}</span>
                <span><Ruler size={11} />TD {r.tdMd != null ? `${fmtInt(r.tdMd)} m MD` : '—'}{r.tdTvd != null ? ` · ${fmtInt(r.tdTvd)} m TVD` : ''}</span>
                <span><TrendingUp size={11} />Water path: {r.mechanism}</span>
              </div>
              <p className="rms-sd-note">Actions are <b>scenario</b>; observations are reported. No per-well recovery factor is quoted — this field carries only a model in-place volume, so the benchmark is the peer cohort.</p>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
