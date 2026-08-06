// QcPanel — the model's own numbers, on screen.
//
// Renders `model-stats.ts`. Four rules it inherits from that module and must not break
// in the presentation:
//
//  · a distribution shows P10 / P50 / P90 beside the mean, because one capped cell owns
//    a max and a mean over a log-distributed property describes no cell in the model;
//  · permeability's GEOMETRIC mean is the headline and the arithmetic one is shown
//    beside it, labelled, so the gap between them is visible rather than surprising;
//  · facies is a COUNT with proportions, never a mean;
//  · every volumetric row wears its provenance, so an assumed saturation cannot be read
//    with the same confidence as a simulated porosity.
import { useMemo } from 'react';
import type {
  Distribution, FaciesStats, PropertyStats, StructureStats, UpscaleStats, VolumeReportRow,
} from './model-stats';

const f = (v: number, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');
const int = (v: number) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-US') : '—');

function DistRow({ label, unit, d, geo, decimals = 3 }: {
  label: string; unit?: string; d: Distribution; geo?: boolean; decimals?: number;
}) {
  return (
    <tr>
      <td className="qc-k">{label}{unit ? <em> {unit}</em> : null}</td>
      <td>{f(d.min, decimals)}</td>
      <td>{f(d.p10, decimals)}</td>
      <td>{f(d.p50, decimals)}</td>
      <td>{f(d.p90, decimals)}</td>
      <td>{f(d.max, decimals)}</td>
      <td className={geo ? 'qc-dim' : 'qc-strong'}>{f(d.mean, decimals)}</td>
      {geo && <td className="qc-strong">{f(d.geoMean, decimals)}</td>}
      <td className="qc-dim">{int(d.n)}</td>
    </tr>
  );
}

export interface QcPanelProps {
  structure: StructureStats | null;
  properties: PropertyStats[];
  facies: FaciesStats | null;
  upscale: UpscaleStats | null;
  volumes: VolumeReportRow[] | null;
}

export function QcPanel({ structure, properties, facies, upscale, volumes }: QcPanelProps) {
  const hasLog = useMemo(() => properties.some((p) => p.logDistributed), [properties]);

  return (
    <div className="qc">
      {/* ── structure ─────────────────────────────────────────── */}
      <section className="qc-sec">
        <h4>Structure</h4>
        {!structure ? <p className="qc-empty">no grid built</p> : (
          <>
            <div className="qc-facts">
              <span><b>{structure.nx} × {structure.ny} × {structure.nz}</b> cells</span>
              <span><b>{int(structure.cells)}</b> total</span>
              <span><b>{int(structure.activeColumns)}</b> active columns</span>
              <span><b>{f(structure.areaKm2, 2)}</b> km²</span>
              <span><b>{f(structure.cellSizeM, 0)}</b> m cells</span>
            </div>
            <table className="qc-tbl">
              <thead><tr><th /><th>min</th><th>P10</th><th>P50</th><th>P90</th><th>max</th><th>mean</th><th>n</th></tr></thead>
              <tbody>
                <DistRow label="Gross thickness" unit="m" d={structure.thickness} decimals={1} />
                <DistRow label="Top depth" unit="m" d={structure.topDepth} decimals={0} />
                <DistRow label="Base depth" unit="m" d={structure.baseDepth} decimals={0} />
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* ── petrophysics ──────────────────────────────────────── */}
      <section className="qc-sec">
        <h4>Petrophysical properties</h4>
        {!properties.length ? <p className="qc-empty">no properties modelled</p> : (
          <>
            <table className="qc-tbl">
              <thead>
                <tr>
                  <th /><th>min</th><th>P10</th><th>P50</th><th>P90</th><th>max</th>
                  <th>mean</th>{hasLog && <th>geo mean</th>}<th>n</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <DistRow key={p.key} label={p.label} unit={p.unit} d={p.dist}
                    geo={p.logDistributed && hasLog}
                    decimals={p.logDistributed ? 1 : 3} />
                ))}
              </tbody>
            </table>
            {hasLog && (
              <p className="qc-note">
                Permeability is log-distributed: the <b>geometric</b> mean describes a typical
                cell, the arithmetic one is dominated by the high tail and describes none.
              </p>
            )}
          </>
        )}
      </section>

      {/* ── facies ────────────────────────────────────────────── */}
      <section className="qc-sec">
        <h4>Facies proportions</h4>
        {!facies ? <p className="qc-empty">no facies model</p> : (
          <>
            <div className="qc-bars">
              {facies.codes.map((c) => (
                <div key={c.code} className="qc-bar-row">
                  <span className="qc-bar-label">{c.label}</span>
                  <span className="qc-bar-track">
                    <span className="qc-bar-fill" style={{ width: `${(c.fraction * 100).toFixed(1)}%` }} />
                  </span>
                  <span className="qc-bar-val">{(c.fraction * 100).toFixed(1)}%</span>
                  <span className="qc-dim">{int(c.count)}</span>
                </div>
              ))}
            </div>
            <p className="qc-note">Counted over {int(facies.total)} active cells — a proportion, never a mean.</p>
          </>
        )}
      </section>

      {/* ── upscaling ─────────────────────────────────────────── */}
      <section className="qc-sec">
        <h4>Upscaling</h4>
        {!upscale ? <p className="qc-empty">logs not scaled up</p> : (
          <>
            <div className="qc-facts">
              <span><b>{upscale.wellsWithCells}/{upscale.wells}</b> wells blocked</span>
              <span><b>{int(upscale.cells)}</b> cells</span>
              <span><b>{int(upscale.columnsCrossed)}</b> columns crossed</span>
              <span className={upscale.thinCells ? 'qc-warn' : ''}>
                <b>{int(upscale.thinCells)}</b> on &lt;3 samples
              </span>
            </div>
            <table className="qc-tbl">
              <thead><tr><th /><th>min</th><th>P10</th><th>P50</th><th>P90</th><th>max</th><th>mean</th><th>n</th></tr></thead>
              <tbody>
                <DistRow label="Log φ" d={upscale.logPhi} />
                <DistRow label="Blocked φ" d={upscale.blockedPhi} />
              </tbody>
            </table>
            <p className="qc-note">
              The gap between those two rows <b>is</b> the blocking bias — averaging many
              samples into one cell should not move the mean.
            </p>
            <table className="qc-tbl qc-wells">
              <thead><tr><th>well</th><th>cells</th><th>columns</th><th>φ</th><th>NTG</th></tr></thead>
              <tbody>
                {upscale.perWell.slice(0, 12).map((w) => (
                  <tr key={w.well}>
                    <td className="qc-k">{w.well}</td>
                    <td>{w.cells}</td><td>{w.columns}</td>
                    <td>{f(w.meanPhi)}</td><td>{f(w.meanNtg)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      {/* ── volumetrics ───────────────────────────────────────── */}
      <section className="qc-sec">
        <h4>Volumetric report</h4>
        {!volumes ? <p className="qc-empty">volumes not computed</p> : (
          <>
            <table className="qc-tbl qc-vol">
              <tbody>
                {volumes.map((r, i) => (
                  <tr key={i}>
                    <td className="qc-k">{r.label}</td>
                    <td className="qc-strong">{r.value}</td>
                    <td><span className={`qc-src qc-src-${r.source}`}>{r.source}</span></td>
                    <td className="qc-dim">{r.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="qc-note">
              Every row carries where its number came from. An <b>assumed</b> saturation must
              not be read with the confidence of a <b>modelled</b> porosity.
            </p>
          </>
        )}
      </section>
    </div>
  );
}
