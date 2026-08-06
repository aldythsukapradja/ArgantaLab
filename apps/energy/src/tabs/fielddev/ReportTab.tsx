// ReportTab — the static modelling report, in one readable document.
//
// This is the artifact a modeller hands over with the grid, so it obeys the same rule
// as everything else here: it must be possible to disagree with it. That means every
// number carries where it came from, every check that did not run says so instead of
// showing a tick, and the volumetric breakdown is checked against the total it claims
// to explain rather than assumed to sum.
//
// It assembles what already exists — `model-qc` (the pass/fail gate), `model-stats`
// (the distributions), `volumeBreakdown` (per zone and per segment) — and adds nothing
// of its own except the layout. A report that computes its own numbers is a second
// implementation waiting to disagree with the first.
import { useMemo } from 'react';
import type { QcItem, QcStatus } from './model-qc';
import type {
  FaciesStats, PropertyStats, StructureStats, UpscaleStats,
  VolumeBreakdownRow, VolumeReportRow,
} from './model-stats';
import { breakdownResidual } from './model-stats';

const f = (v: number, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const int = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—');
const mm = (v: number) => (Number.isFinite(v) ? (v / 1e6).toFixed(1) : '—');

const BADGE: Record<QcStatus, string> = {
  pass: 'pass', flag: 'flag', fail: 'FAIL', absent: 'absent', 'n/a': 'n/a',
};

export interface ReportTabProps {
  fieldName: string;
  qc: QcItem[];
  structure: StructureStats | null;
  properties: PropertyStats[];
  facies: FaciesStats | null;
  upscale: UpscaleStats | null;
  volumes: VolumeReportRow[] | null;
  byZone: VolumeBreakdownRow[];
  bySegment: VolumeBreakdownRow[];
  totalStoiipMMSm3: number;
  officialMMSm3?: number;
  /** what the model was built from, so the report can be reproduced */
  recipe?: { horizons: number; nzPerZone: number; seed: number; simNodes: number; owc?: number };
}

function BreakdownTable({ title, rows, total, note }: {
  title: string; rows: VolumeBreakdownRow[]; total: number; note: string;
}) {
  const residual = useMemo(() => breakdownResidual(rows, total), [rows, total]);
  if (!rows.length) return <p className="rpt-empty">{title} — nothing to break down yet.</p>;
  return (
    <>
      <h4>{title}</h4>
      <p className="rpt-note">{note}</p>
      <table className="rpt-tbl">
        <thead>
          <tr>
            <th />
            <th>cells</th><th>GRV Mm³</th><th>NRV Mm³</th><th>PV Mm³</th><th>HCPV Mm³</th>
            <th>NTG</th><th>φ</th><th>Sw</th><th>STOIIP</th><th>share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.group}>
              <td className="rpt-k">{r.group}</td>
              <td>{int(r.cells)}</td>
              <td>{mm(r.grvM3)}</td><td>{mm(r.nrvM3)}</td>
              <td>{mm(r.pvM3)}</td><td>{mm(r.hcpvM3)}</td>
              <td>{f(r.ntg)}</td><td>{f(r.phi)}</td><td>{f(r.sw)}</td>
              <td className="rpt-strong">{f(r.stoiipMMSm3, 2)}</td>
              <td>{(r.share * 100).toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
      {/* A breakdown that does not sum to its own total is worse than no breakdown:
          every row looks defensible and nothing shows that one is missing. */}
      <p className={`rpt-note${residual > 0.005 ? ' rpt-warn' : ''}`}>
        {residual > 0.005
          ? `⚠ these rows sum to ${(100 - residual * 100).toFixed(1)}% of the reported total — ${(residual * 100).toFixed(1)}% is unaccounted for`
          : 'rows sum to the reported total'}
      </p>
    </>
  );
}

export function ReportTab(p: ReportTabProps) {
  const bySection = useMemo(() => {
    const m = new Map<string, QcItem[]>();
    for (const i of p.qc) {
      const list = m.get(i.section);
      if (list) list.push(i); else m.set(i.section, [i]);
    }
    return [...m.entries()];
  }, [p.qc]);

  const counts = useMemo(() => {
    const c: Record<QcStatus, number> = { pass: 0, flag: 0, fail: 0, absent: 0, 'n/a': 0 };
    for (const i of p.qc) c[i.status]++;
    return c;
  }, [p.qc]);

  const ratio = p.officialMMSm3 ? p.totalStoiipMMSm3 / p.officialMMSm3 : NaN;

  return (
    <div className="rpt">
      <header className="rpt-head">
        <h2>Static model report — {p.fieldName}</h2>
        {p.recipe && (
          <p className="rpt-recipe">
            {p.recipe.horizons} horizons · {p.recipe.nzPerZone} layers/zone ·
            seed {p.recipe.seed} · simulated {p.recipe.simNodes}²
            {p.recipe.owc != null && <> · contact {Math.abs(p.recipe.owc).toFixed(0)} m</>}
          </p>
        )}
        <div className="rpt-verdict">
          <span className="rpt-c rpt-c-pass">{counts.pass} pass</span>
          <span className="rpt-c rpt-c-flag">{counts.flag} flag</span>
          <span className="rpt-c rpt-c-fail">{counts.fail} fail</span>
          <span className="rpt-c rpt-c-absent">{counts.absent} absent</span>
          <span className="rpt-c rpt-c-na">{counts['n/a']} n/a</span>
        </div>
      </header>

      {/* ── 1 · the gate ─────────────────────────────────────────── */}
      <section className="rpt-sec">
        <h3>1 · Quality gate</h3>
        <p className="rpt-note">
          <b>n/a</b> means the check could not apply to this model, not that it passed —
          a green tick for a test that never ran is how a bad grid gets a clean bill of health.
        </p>
        {bySection.map(([sec, items]) => (
          <div key={sec} className="rpt-qc-sec">
            <h4>{sec}</h4>
            <table className="rpt-tbl rpt-qc">
              <tbody>
                {items.map((i) => (
                  <tr key={i.id} className={`rpt-r-${i.status}`}>
                    <td className="rpt-badge"><span className={`rpt-s rpt-s-${i.status}`}>{BADGE[i.status]}</span></td>
                    <td className="rpt-k">{i.label}</td>
                    <td className="rpt-find">
                      {i.finding}
                      {i.status !== 'pass' && i.consequence && <em> ⇒ {i.consequence}</em>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </section>

      {/* ── 2 · structure ────────────────────────────────────────── */}
      <section className="rpt-sec">
        <h3>2 · Structure</h3>
        {!p.structure ? <p className="rpt-empty">no grid built</p> : (
          <table className="rpt-tbl">
            <tbody>
              <tr><td className="rpt-k">Dimensions</td><td>{p.structure.nx} × {p.structure.ny} × {p.structure.nz}</td>
                <td className="rpt-k">Cells</td><td>{int(p.structure.cells)}</td></tr>
              <tr><td className="rpt-k">Active columns</td><td>{int(p.structure.activeColumns)}</td>
                <td className="rpt-k">Area</td><td>{f(p.structure.areaKm2, 2)} km²</td></tr>
              <tr><td className="rpt-k">Cell size</td><td>{f(p.structure.cellSizeM, 0)} m</td>
                <td className="rpt-k">Live cells</td><td>{int(p.structure.liveCells)}</td></tr>
              <tr><td className="rpt-k">Gross thickness</td>
                <td colSpan={3}>
                  P10 {f(p.structure.thickness.p10, 1)} · P50 {f(p.structure.thickness.p50, 1)} ·
                  P90 {f(p.structure.thickness.p90, 1)} m (mean {f(p.structure.thickness.mean, 1)})
                </td></tr>
              <tr><td className="rpt-k">Depth range</td>
                <td colSpan={3}>{f(p.structure.topDepth.min, 0)} – {f(p.structure.baseDepth.max, 0)} m TVDSS</td></tr>
            </tbody>
          </table>
        )}
      </section>

      {/* ── 3 · petrophysics ─────────────────────────────────────── */}
      <section className="rpt-sec">
        <h3>3 · Petrophysical parameters</h3>
        {!p.properties.length ? <p className="rpt-empty">no properties modelled</p> : (
          <>
            <table className="rpt-tbl">
              <thead><tr><th /><th>min</th><th>P10</th><th>P50</th><th>P90</th><th>max</th><th>mean</th><th>geo</th><th>n</th></tr></thead>
              <tbody>
                {p.properties.map((pr) => (
                  <tr key={pr.key}>
                    <td className="rpt-k">{pr.label}{pr.unit ? <em> {pr.unit}</em> : null}</td>
                    <td>{f(pr.dist.min, pr.logDistributed ? 1 : 3)}</td>
                    <td>{f(pr.dist.p10, pr.logDistributed ? 1 : 3)}</td>
                    <td>{f(pr.dist.p50, pr.logDistributed ? 1 : 3)}</td>
                    <td>{f(pr.dist.p90, pr.logDistributed ? 1 : 3)}</td>
                    <td>{f(pr.dist.max, pr.logDistributed ? 1 : 3)}</td>
                    <td className={pr.logDistributed ? '' : 'rpt-strong'}>{f(pr.dist.mean, pr.logDistributed ? 1 : 3)}</td>
                    <td className="rpt-strong">{pr.logDistributed ? f(pr.dist.geoMean, 1) : '—'}</td>
                    <td className="rpt-dim">{int(pr.dist.n)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rpt-note">
              Permeability is log-distributed: the <b>geometric</b> mean describes a typical
              cell; the arithmetic mean is dominated by the high tail and describes none.
            </p>
          </>
        )}
        {p.facies && (
          <>
            <h4>Facies proportions</h4>
            <table className="rpt-tbl">
              <tbody>
                {p.facies.codes.map((c) => (
                  <tr key={c.code}>
                    <td className="rpt-k">{c.label}</td>
                    <td className="rpt-strong">{(c.fraction * 100).toFixed(1)}%</td>
                    <td className="rpt-dim">{int(c.count)} cells</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="rpt-note">Counted, never averaged — a “mean facies” is not a rock.</p>
          </>
        )}
      </section>

      {/* ── 4 · upscaling ────────────────────────────────────────── */}
      <section className="rpt-sec">
        <h3>4 · Upscaling</h3>
        {!p.upscale ? <p className="rpt-empty">logs not scaled up</p> : (
          <>
            <table className="rpt-tbl">
              <tbody>
                <tr><td className="rpt-k">Wells blocked</td><td>{p.upscale.wellsWithCells} / {p.upscale.wells}</td>
                  <td className="rpt-k">Cells</td><td>{int(p.upscale.cells)}</td></tr>
                <tr><td className="rpt-k">Columns crossed</td><td>{int(p.upscale.columnsCrossed)}</td>
                  <td className="rpt-k">On &lt;3 samples</td>
                  <td className={p.upscale.thinCells ? 'rpt-warnv' : ''}>{int(p.upscale.thinCells)}</td></tr>
                <tr><td className="rpt-k">Log φ</td><td>{f(p.upscale.logPhi.mean)}</td>
                  <td className="rpt-k">Blocked φ</td><td>{f(p.upscale.blockedPhi.mean)}</td></tr>
              </tbody>
            </table>
            <p className="rpt-note">
              The gap between those last two <b>is</b> the blocking bias — averaging many
              samples into one cell should not move the mean.
            </p>
          </>
        )}
      </section>

      {/* ── 5 · volumetrics ──────────────────────────────────────── */}
      <section className="rpt-sec">
        <h3>5 · Volumetrics</h3>
        {p.volumes && (
          <table className="rpt-tbl">
            <tbody>
              {p.volumes.map((r, i) => (
                <tr key={i}>
                  <td className="rpt-k">{r.label}</td>
                  <td className="rpt-strong">{r.value}</td>
                  <td><span className={`rpt-src rpt-src-${r.source}`}>{r.source}</span></td>
                  <td className="rpt-dim">{r.note ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <BreakdownTable title="By zone" rows={p.byZone} total={p.totalStoiipMMSm3}
          note="Averages are BULK-WEIGHTED, so a zone split into many thin layers cannot outvote one split into few thick ones." />

        <BreakdownTable title="By segment" rows={p.bySegment} total={p.totalStoiipMMSm3}
          note="A segment is an accumulation: two columns belong to the same one only if oil could travel between them without crossing below the contact." />
      </section>

      {/* ── 6 · benchmark ────────────────────────────────────────── */}
      <section className="rpt-sec">
        <h3>6 · Benchmark</h3>
        {!Number.isFinite(ratio) ? (
          <p className="rpt-empty">no published figure in the delivery to compare against.</p>
        ) : (
          <>
            <table className="rpt-tbl">
              <tbody>
                <tr><td className="rpt-k">This model</td><td className="rpt-strong">{f(p.totalStoiipMMSm3, 2)} MMSm³</td></tr>
                <tr><td className="rpt-k">Published</td><td>{f(p.officialMMSm3 ?? NaN, 2)} MMSm³</td></tr>
                <tr><td className="rpt-k">Ratio</td>
                  <td className={ratio > 0.7 && ratio < 1.4 ? 'rpt-strong' : 'rpt-warnv'}>{f(ratio, 2)}×</td></tr>
              </tbody>
            </table>
            <p className="rpt-note">
              Does this make sense? A ratio near 1.0 means the <b>volume</b> is right, not that
              the model is. How that volume is distributed in space — which is what a history
              match tests — is constrained by the wells and the simulation resolution, not by
              this number. And if the contact was chosen to reproduce a published figure, the
              comparison is partly circular: read the parameter agreement above instead.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
