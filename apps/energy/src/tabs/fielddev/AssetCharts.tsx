// AssetCharts.tsx — the chart primitives for the Asset Dossier. Deliberately the same
// visual grammar as the Basin Dossier's BasinCharts (thin SVG, no chart library, CSS
// variables for every colour so light/dark just work), but on a CALENDAR-time axis
// running forwards, not a geologic axis running backwards.
//
// Every chart takes already-derived data from asset-dossier.ts and draws it. None of
// them compute, guess or fill a missing value — an absent number renders as an
// explicitly "unrecorded" mark, never as a zero or an interpolated point.
import type { Milestone, ProductionPoint, MixSlice, Benchmark, Stage } from './asset-dossier';
import { STAGE_LABEL, STAGE_PROGRESS, fmtMMBOE, fmtPct } from './asset-dossier';

const FLUID_COLORS: Record<string, string> = { Liquids: '#10b981', Gas: '#f43f5e' };

/** Lifecycle progress bar — where the asset sits on Discovered→Ceased. */
export function LifecycleBar({ stage }: { stage: Stage }) {
  const steps: Stage[] = ['discovered', 'appraisal', 'sanctioned', 'producing', 'late-life', 'ceased'];
  const at = STAGE_PROGRESS[stage];
  return (
    <div className="fds-ad-lifebar" title={STAGE_LABEL[stage]}>
      <div className="fds-ad-lifebar-track">
        <i style={{ width: `${at * 100}%` }} className={'tone-' + stage} />
      </div>
      <div className="fds-ad-lifebar-pips">
        {steps.map((s) => (
          <span key={s} className={STAGE_PROGRESS[s] <= at && stage !== 'unknown' ? 'on' : ''}
            title={STAGE_LABEL[s]} />
        ))}
      </div>
    </div>
  );
}

/** Small inline production sparkline for the verdict card. */
export function ProductionSpark({ series }: { series: ProductionPoint[] }) {
  if (series.length < 2) return null;
  const W = 118, H = 26;
  const xs = series.map((p) => p.year), ys = series.map((p) => p.mmboe);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), ymax = Math.max(...ys) || 1;
  const px = (y: number) => ((y - x0) / (x1 - x0 || 1)) * W;
  const py = (v: number) => H - (v / ymax) * (H - 3) - 1;
  const d = series.map((p, i) => `${i ? 'L' : 'M'}${px(p.year).toFixed(1)},${py(p.mmboe).toFixed(1)}`).join(' ');
  const area = `${d} L${W},${H} L0,${H} Z`;
  return (
    <svg className="fds-ad-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden>
      <path d={area} fill="var(--cyan,#22d3ee)" opacity=".16" />
      <path d={d} fill="none" stroke="var(--cyan,#22d3ee)" strokeWidth="1.4" />
    </svg>
  );
}

/** Fluid-split donut — same shape as the Basin Dossier's HcDonut. */
export function MixDonut({ mix }: { mix: MixSlice[] }) {
  const total = mix.reduce((s, d) => s + d.value, 0);
  if (!total) return null;
  const R = 26, C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="fds-ad-donut">
      <svg viewBox="0 0 64 64" width="62" height="62" aria-hidden>
        <g transform="translate(32,32) rotate(-90)">
          <circle r={R} fill="none" stroke="var(--line2)" strokeWidth="9" />
          {mix.map((s) => {
            const frac = s.value / total, dash = frac * C;
            const el = (
              <circle key={s.key} r={R} fill="none" strokeWidth="9"
                stroke={FLUID_COLORS[s.key] ?? 'var(--cyan,#22d3ee)'}
                strokeDasharray={`${dash} ${C - dash}`} strokeDashoffset={-offset} />
            );
            offset += dash;
            return el;
          })}
        </g>
      </svg>
      <div className="fds-ad-donut-key">
        {mix.map((s) => (
          <span key={s.key}>
            <i style={{ background: FLUID_COLORS[s.key] ?? 'var(--cyan,#22d3ee)' }} />
            {s.key} <b>{fmtPct(s.value / total)}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

/** The signature chart: the field's own development history on a CALENDAR axis.
 *  Milestones as dated pips, produced volume as bars, the future greyed. */
export function DevelopmentTimeline({ milestones, series, nowYear, onPick }: {
  milestones: Milestone[]; series: ProductionPoint[]; nowYear: number;
  onPick?: (id: string) => void;
}) {
  const dated = milestones.filter((m) => m.year != null) as Array<Milestone & { year: number }>;
  const undatedCount = milestones.length - dated.length;
  if (!dated.length && !series.length) {
    return (
      <div className="fds-ad-empty">
        <b>No dated development record</b>
        <span>this field has no discovery, sanction, start-up or production date filed — the readiness ledger is the finding</span>
      </div>
    );
  }
  const years = [...dated.map((m) => m.year), ...series.map((p) => p.year), nowYear];
  const y0 = Math.min(...years), y1 = Math.max(...years);
  const span = Math.max(1, y1 - y0);
  const pad = Math.max(1, Math.round(span * 0.04));
  const lo = y0 - pad, hi = y1 + pad;
  const px = (y: number) => ((y - lo) / (hi - lo)) * 100;
  const ymax = Math.max(...series.map((p) => p.mmboe), 0) || 1;

  // decade ticks, so the axis reads like a calendar not a number line
  const tickStep = span > 60 ? 20 : span > 25 ? 10 : span > 10 ? 5 : 2;
  const ticks: number[] = [];
  for (let t = Math.ceil(lo / tickStep) * tickStep; t <= hi; t += tickStep) ticks.push(t);

  return (
    <div className="fds-ad-timeline">
      {/* produced volume, per year */}
      <div className="fds-ad-tl-bars">
        {series.map((p) => (
          <i key={p.year} title={`${p.year} · ${fmtMMBOE(p.mmboe)} MMBOE produced`}
            style={{ left: `${px(p.year)}%`, height: `${Math.max(2, (p.mmboe / ymax) * 100)}%` }} />
        ))}
        {!series.length && <div className="fds-ad-tl-nobars">no production history filed</div>}
      </div>

      {/* milestone lane */}
      <div className="fds-ad-tl-lane">
        <div className="fds-ad-tl-axisline" />
        {dated.map((m) => (
          <button key={m.id} className={'fds-ad-tl-pip m-' + m.id} style={{ left: `${px(m.year)}%` }}
            onClick={() => onPick?.(m.id)} title={`${m.label} · ${m.year}`}>
            <i /><b>{m.year}</b><span>{m.label}</span>
          </button>
        ))}
        {/* today marker — separates record from future */}
        {nowYear >= lo && nowYear <= hi && (
          <div className="fds-ad-tl-now" style={{ left: `${px(nowYear)}%` }} title={`Today · ${nowYear}`}><i /></div>
        )}
      </div>

      {/* calendar axis */}
      <div className="fds-ad-tl-axis">
        {ticks.map((t) => <span key={t} style={{ left: `${px(t)}%` }}>{t}</span>)}
      </div>

      {undatedCount > 0 && (
        <div className="fds-ad-tl-missing">
          {milestones.filter((m) => m.year == null).map((m) => (
            <span key={m.id} title={m.note}>{m.label}: <b>unrecorded</b></span>
          ))}
        </div>
      )}
    </div>
  );
}

/** Recovery benchmark — this asset's produced fraction against the literature CLASS band.
 *  Labelled a class prior throughout; it never claims a named peer field. */
export function BenchmarkBand({ bm }: { bm: Benchmark }) {
  const scaleMax = 0.9;
  const pos = (v: number) => Math.min(100, (v / scaleMax) * 100);
  return (
    <div className="fds-ad-bench">
      <div className="fds-ad-bench-head">
        <b>{bm.className}</b>
        <span>{bm.basis === 'class-prior' ? `class band · n=${bm.n}` : 'unmatched'}</span>
      </div>

      <div className="fds-ad-bench-track">
        <div className="fds-ad-bench-band"
          style={{ left: `${pos(bm.bandLow)}%`, width: `${pos(bm.bandHigh) - pos(bm.bandLow)}%` }} />
        <div className="fds-ad-bench-mid" style={{ left: `${pos(bm.bandMid)}%` }} title={`Class mid ${fmtPct(bm.bandMid)}`} />
        {bm.observedRF != null && (
          <div className="fds-ad-bench-obs" style={{ left: `${pos(bm.observedRF)}%` }}
            title={`Produced ${fmtPct(bm.observedRF)} of booked reserves`}><i /></div>
        )}
        {[0, 0.25, 0.5, 0.75].map((t) => (
          <span key={t} className="fds-ad-bench-tick" style={{ left: `${pos(t)}%` }}>{Math.round(t * 100)}%</span>
        ))}
      </div>

      <div className="fds-ad-bench-legend">
        <span><i className="band" />class {fmtPct(bm.bandLow)}–{fmtPct(bm.bandHigh)}</span>
        {bm.observedRF != null
          ? <span><i className="obs" />produced <b>{fmtPct(bm.observedRF)}</b> of booked</span>
          : <span className="muted">produced fraction not derivable</span>}
      </div>

      <p className="fds-ad-note">{bm.note}</p>
      <p className="fds-ad-note">
        The marker is <b>cumulative production ÷ booked reserves</b>, not a recovery factor —
        no in-place volume is carried for this field, so a true RF cannot be stated.
      </p>
    </div>
  );
}
