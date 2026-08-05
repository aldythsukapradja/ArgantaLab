// PetroZonationMatrix — zone × bore net/pay. THE deliverable of this tab.
//
// This is the PetrophysicalModel artifact the static model consumes, so it is the
// one table in the suite where an absence must never look like a zero. Three
// distinct states, drawn differently on purpose:
//
//   a number      the interval was picked AND the curves were there
//   "no pick"     the bore has no top for this formation — the interval does not
//                 exist in it, which is a geological fact, not missing data
//   "no curves"   the interval exists but Archie could not run in it
//
// Collapsing those into a blank cell, or worse a 0.0, would let a bore that was
// never evaluated read as a bore with no pay. On Volve that distinction decides
// whether 21 of 24 bores are "dry" or "not interpreted".
import { useMemo, useState } from 'react';
import { Table2, AlertTriangle } from 'lucide-react';
import type { Workspace } from './workspace';
import type { PetroParams } from './petro-compute';
import { useFieldZones, forwardStats, rankByNet, type FieldZoneRow } from './petro-field';

type Metric = 'net' | 'gross' | 'ntg' | 'phie' | 'sw';

/**
 * NET PAY IS NOT HERE, deliberately.
 *
 * engine/petro.zoneAverages publishes ntg, phie, sw, netM, grossM and nSamples —
 * net is thickness passing the cutoffs, and there is no separate pay column.
 * Deriving one as "net × something" on this screen would put a number in the
 * deliverable the interpretation never produced. If pay is wanted it belongs in
 * zoneAverages, applied with the same cutoffs as net, not synthesised in a table.
 */
const METRICS: Array<{ id: Metric; label: string; unit: string; hint: string }> = [
  { id: 'net', label: 'Net', unit: 'm', hint: 'thickness passing the cutoffs' },
  { id: 'gross', label: 'Gross', unit: 'm', hint: 'top to base of the picked interval' },
  { id: 'ntg', label: 'N:G', unit: '', hint: 'net over gross' },
  { id: 'phie', label: 'PHIE', unit: 'v/v', hint: 'net-weighted mean effective porosity' },
  { id: 'sw', label: 'Sw', unit: 'v/v', hint: 'net-weighted mean water saturation' },
];

/** Read a metric off a row, or null when the row could not be evaluated. */
function value(row: FieldZoneRow, m: Metric): number | null {
  const s = forwardStats(row);
  if (!s) return null;
  const v = m === 'net' ? s.netM
    : m === 'gross' ? s.grossM
      : m === 'ntg' ? s.ntg
        : m === 'phie' ? s.phie
          : s.sw;
  return Number.isFinite(v) ? v : null;
}

const fmt = (v: number | null, m: Metric) => (v == null ? '—'
  : m === 'ntg' || m === 'phie' || m === 'sw' ? v.toFixed(3) : v.toFixed(1));

export function PetroZonationMatrix({ ws, params }: { ws: Workspace; params: PetroParams }) {
  const [metric, setMetric] = useState<Metric>('net');
  const zones = useFieldZones(ws, params, true);

  /** Formations down, bores across — the orientation a zonation table is read in. */
  const model = useMemo(() => {
    const formations = [...new Set(zones.rows.map((r) => r.formation))];
    const bores = [...new Set(zones.rows.map((r) => r.well))];
    const byKey = new Map(zones.rows.map((r) => [`${r.formation}|${r.well}`, r]));

    // rank formations by the net they actually carry, so the interval that matters
    // is at the top rather than wherever the pick file happened to list it
    const ranked = rankByNet(zones.rows);
    const order = new Map<string, number>();
    for (const r of ranked) if (!order.has(r.formation)) order.set(r.formation, order.size);
    formations.sort((a, b) => (order.get(a) ?? 99) - (order.get(b) ?? 99));

    return { formations, bores, byKey };
  }, [zones.rows]);

  /** Column totals, and the honest denominator: how many bores could be evaluated
   *  for this formation at all, not how many exist. */
  const totals = useMemo(() => new Map(model.formations.map((f) => {
    const rows = model.bores
      .map((w) => model.byKey.get(`${f}|${w}`))
      .filter((r): r is FieldZoneRow => !!r);
    const vals = rows.map((r) => value(r, metric)).filter((v): v is number => v != null);
    const mean = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    return [f, { mean, n: vals.length, of: rows.length }];
  })), [model, metric]);

  return (
    <section className="pps-region live pzm" style={{ gridArea: 'main' }}>
      <header className="pzm-head">
        <Table2 size={12} /> <b>Zone × bore</b>
        <span className="pzm-metrics">
          {METRICS.map((m) => (
            <button key={m.id} className={metric === m.id ? 'on' : ''} title={m.hint}
              onClick={() => setMetric(m.id)}>{m.label}</button>
          ))}
        </span>
        <em>
          {zones.running
            ? `running ${zones.done}/${zones.total} bores…`
            : `${model.formations.length} formations × ${model.bores.length} bores`}
        </em>
      </header>

      {zones.running && (
        <div className="pzm-bar"><i style={{ width: `${zones.total ? (zones.done / zones.total) * 100 : 0}%` }} /></div>
      )}

      <div className="pzm-scroll">
        <table className="pzm-table">
          <thead>
            <tr>
              <th className="pzm-corner">{METRICS.find((m) => m.id === metric)?.label}
                <i>{METRICS.find((m) => m.id === metric)?.unit}</i>
              </th>
              {model.bores.map((w) => <th key={w} title={w}>{w}</th>)}
              <th className="pzm-tot">mean</th>
            </tr>
          </thead>
          <tbody>
            {model.formations.map((f) => {
              const t = totals.get(f);
              return (
                <tr key={f}>
                  <th className="pzm-row" title={f}>{f}</th>
                  {model.bores.map((w) => {
                    const row = model.byKey.get(`${f}|${w}`);
                    // THE THREE STATES. A bore with no row for this formation has no
                    // pick for it; a row with no stats was picked but could not be
                    // evaluated. Neither is a zero.
                    if (!row) {
                      return <td key={w} className="pzm-none" title={`${w} has no pick for ${f}`}>no pick</td>;
                    }
                    const v = value(row, metric);
                    if (v == null) {
                      return <td key={w} className="pzm-nocurve" title={`${w}: ${f} is picked but the curves Archie needs are not all present`}>no curves</td>;
                    }
                    return (
                      <td key={w} title={`${w} · ${f} · ${row.top.toFixed(0)}–${row.base.toFixed(0)} m`}>
                        {fmt(v, metric)}
                      </td>
                    );
                  })}
                  <td className="pzm-tot" title={t ? `mean of ${t.n} evaluated bores of ${t.of} picked` : ''}>
                    {fmt(t?.mean ?? null, metric)}<i>{t ? `${t.n}/${t.of}` : ''}</i>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!zones.running && !model.formations.length && (
          <div className="pzm-empty">
            No interval could be evaluated. A zone needs a pick to top it and a pick to
            bottom it, and the Archie curves in between.
          </div>
        )}
      </div>

      {zones.skipped.length > 0 && (
        <footer className="pzm-skipped">
          <AlertTriangle size={11} />
          <b>{zones.skipped.length} bore{zones.skipped.length === 1 ? '' : 's'} produced no interval</b>
          <span>{zones.skipped.slice(0, 4).map((s) => `${s.well} — ${s.why}`).join(' · ')}
            {zones.skipped.length > 4 ? ` · +${zones.skipped.length - 4} more` : ''}</span>
        </footer>
      )}
    </section>
  );
}
