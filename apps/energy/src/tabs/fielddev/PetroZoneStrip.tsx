// PetroZoneStrip — the per-well zone summary (P8, single-well slice).
//
// Gross · net · N:G · mean PHIE · mean Sw for every interval between consecutive
// picks, from `engine/petro.zoneAverages` — the truth-locked engine, net-weighted,
// the same call the field-wide Zonation matrix will make.
//
// It recomputes the moment a cutoff moves, because that is the question the strip
// exists to answer: what does this cutoff cost me in net metres?
//
// Rows that cannot be filled stay, hatched, with the reason. An interval where the
// log stops before the base, or a bore with no porosity curve, is a real hole in the
// delivery — dropping the row would make the summary look complete when it is not.
import { Layers } from 'lucide-react';
import { useScene } from './scene';
import { useUnits, depth as depthQ } from '../../units';
import type { PetroWell } from './petro-well';

const pct = (v: number) => `${(v * 100).toFixed(0)}%`;

export function PetroZoneStrip({ well }: { well: PetroWell }) {
  const sel = useScene((s) => s.sel);
  const setSel = useScene((s) => s.setSel);
  const { system } = useUnits();
  const { bore, zones, result } = well;

  if (!bore) return null;

  if (!zones.length) {
    return (
      <div className="pzs-empty">
        <Layers size={18} />
        <b>No picks on {bore.name}</b>
        <span>An interval needs a top and a base. Without a pick there is nothing to average over — so this bore reports no zone statistics rather than an interval invented from the log’s own extent.</span>
      </div>
    );
  }

  const totalNet = zones.reduce((n, z) => n + (z.stats?.netM ?? 0), 0);
  const totalGross = zones.reduce((n, z) => n + (z.stats?.grossM ?? 0), 0);

  return (
    <div className="pzs">
      <div className="pzs-head">
        <span className="pzs-h-zone">Interval</span>
        <span>Gross</span><span>Net</span><span>N:G</span><span>φe</span><span>Sw</span>
      </div>
      <div className="pzs-rows">
        {zones.map((z) => {
          const s = z.stats;
          // an interval the interpretation could not evaluate at all — no porosity in
          // range, or the log ends above the base
          const empty = !s || s.nSamples === 0;
          const on = sel === `wpick:${bore.name}:${z.name}` || sel === 'top:' + z.name;
          return (
            <div key={z.name} className={'pzs-row' + (on ? ' sel' : '') + (empty ? ' empty' : '')}
              title={empty
                ? 'The log carries no evaluable sample in this interval — no statistic is reported rather than a zero'
                : `${s!.nSamples.toLocaleString('en-US')} samples · ${depthQ(z.top, system).text} – ${depthQ(z.base, system).text}`}
              onClick={() => setSel(`wpick:${bore.name}:${z.name}`)}>
              <span className="pzs-zone">
                <i style={{ background: z.tint }} />
                <b>{z.name}</b>
                <em>{Math.round(z.top)}–{Math.round(z.base)} m</em>
              </span>
              {empty ? (
                <span className="pzs-hole" style={{ gridColumn: 'span 5' }}>no evaluable sample</span>
              ) : (
                <>
                  <span>{s!.grossM.toFixed(1)}</span>
                  <span className="pzs-net">{s!.netM.toFixed(1)}</span>
                  <span className="pzs-ng">
                    <i style={{ width: `${Math.min(100, s!.ntg * 100)}%` }} />
                    <u>{pct(s!.ntg)}</u>
                  </span>
                  <span>{s!.netM > 0 ? s!.phie.toFixed(3) : '—'}</span>
                  <span>{s!.netM > 0 ? s!.sw.toFixed(3) : '—'}</span>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="pzs-foot">
        <b>{zones.length}</b> intervals · net <b>{totalNet.toFixed(1)} m</b> of <b>{totalGross.toFixed(1)} m</b> gross
        {totalGross > 0 && <> · <b>{pct(totalNet / totalGross)}</b> N:G</>}
        {result?.missing.sw && <em className="pzs-warn">{result.missing.sw}</em>}
      </div>
    </div>
  );
}
