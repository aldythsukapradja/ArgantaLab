// The descent's right-hand panel — the three wedges, live, for Kutei.
//
// Slide 4 used to name the wedges and show nothing. Naming a body of work is a
// claim; showing it is evidence, and this deck's whole argument is the
// difference between the two. Each stop of the descent now brings up the thing
// it names:
//
//   Petroleum System    the Knowledge Bank's real events chart
//   Tectonostratigraphy the Knowledge Bank's real cycle column
//   Field Analogue      who operates Kutei's fields and what they produce
//
// All three read the same corpus the rest of the app reads. Nothing is staged.
import { useEffect, useState } from 'react';
import { Droplets, Factory, Gauge } from 'lucide-react';
import { EventsChartView, TectonoStratChart } from '../tabs/exploration/BasinCharts';
import { basinDossier, fieldAnalogue, type BasinDossier, type FieldAnalogue, type Tally } from './basin-dossier';
import { KUTEI } from './data';

/** Fluid and status are small closed vocabularies, so a fixed hue per term
 *  beats a cycled palette — "gas" is the same red on every basin. */
const FLUID: Record<string, string> = {
  'oil and gas': '#6BBF8A', gas: '#E2606A', oil: '#D8B15A',
};
const STATUS: Record<string, string> = {
  operating: '#69D6FF', 'in-development': '#D8B15A', discovered: '#7C8797',
};

function MixBar({ rows, colors }: { rows: Tally[]; colors: Record<string, string> }) {
  const total = rows.reduce((t, r) => t + r.n, 0) || 1;
  return (
    <div className="kn-wedge-mix">
      <div className="kn-wedge-bar">
        {rows.map((r) => (
          <i key={r.label}
            style={{ width: `${(r.n / total) * 100}%`, background: colors[r.label] ?? '#7C8797' }} />
        ))}
      </div>
      <div className="kn-wedge-key">
        {rows.map((r) => (
          <span key={r.label}>
            <i style={{ background: colors[r.label] ?? '#7C8797' }} />
            {r.label} <b>{r.n}</b>
          </span>
        ))}
      </div>
    </div>
  );
}

function Analogue({ a }: { a: FieldAnalogue }) {
  const top = a.operators[0]?.n || 1;
  return (
    <div className="kn-wedge-body">
      <section>
        <h5><Droplets size={13} /> Hydrocarbon type</h5>
        <MixBar rows={a.fluid} colors={FLUID} />
      </section>
      <section>
        <h5><Gauge size={13} /> Status</h5>
        <MixBar rows={a.status} colors={STATUS} />
      </section>
      <section>
        <h5><Factory size={13} /> Most active operators</h5>
        <ul className="kn-wedge-ops">
          {a.operators.map((o) => (
            <li key={o.label}>
              <span className="kn-wedge-op">{o.label}</span>
              <i style={{ width: `${(o.n / top) * 100}%` }} />
              <b>{o.n}</b>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

/** `stop` is 0, 1 or 2 — the descent's current wedge. */
export function Wedges({ stop }: { stop: number }) {
  const [d, setD] = useState<BasinDossier | null>(null);
  const [a, setA] = useState<FieldAnalogue | null>(null);

  useEffect(() => {
    let live = true;
    // Both are module-cached, so the two later stops cost nothing.
    basinDossier(KUTEI).then((x) => { if (live) setD(x); });
    fieldAnalogue(KUTEI).then((x) => { if (live) setA(x); });
    return () => { live = false; };
  }, []);

  return (
    <aside className="kn-wedges" aria-hidden>
      <header>
        <span className="kn-wedge-scope">Kutei Basin, East Kalimantan</span>
        <span className="kn-wedge-count">{a ? `${a.fields} fields` : ''}</span>
      </header>

      <div className="kn-wedge-pane" key={stop}>
        {stop === 0 && d?.events && (
          <div className="kn-dossier-chart">
            <EventsChartView chart={d.events} range={d.dataSpan} />
          </div>
        )}
        {stop === 1 && d && d.tecto.cycles.length > 0 && (
          <div className="kn-dossier-chart">
            <TectonoStratChart
              periods={d.tecto.periods} cycles={d.tecto.cycles} elements={d.tecto.elements} />
          </div>
        )}
        {stop === 2 && a && <Analogue a={a} />}
        {/* Deliberately blank rather than a spinner: a loading state that
            appears for 200 ms mid-descent is worse than nothing. */}
      </div>
    </aside>
  );
}
