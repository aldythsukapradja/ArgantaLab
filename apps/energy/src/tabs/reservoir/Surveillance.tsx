// Surveillance.tsx — the Integrated Surveillance tab (COSMO). Acquisition status + data
// coverage matrix (per well: production / BHP / THP / uptime months) + the exception
// list (surveillance engine detectExceptions on water cut) + HONEST no-data states for
// the streams Volve doesn't have (4D seismic, PLT, discrete build-up tests) — shown as
// explicit gaps, never faked.
import { useMemo } from 'react';
import { useRM } from './ReservoirMgmt';
import { setSelection } from './selection';
import { Panel, Stat, TabHeader, Page } from './surface';
import { detectExceptions } from '../../engine/surveillance';

function cov(arr: Array<number | null>): number { const n = arr.length; return n ? arr.filter((v) => v != null).length / n : 0; }
const bar = (frac: number, col: string) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
    <span style={{ width: 54, height: 6, borderRadius: 3, background: 'var(--panel-2)', overflow: 'hidden' }}>
      <span style={{ display: 'block', height: '100%', width: (frac * 100).toFixed(0) + '%', background: col }} />
    </span>
    <span className="mono" style={{ fontSize: 10.5, color: 'var(--muted)' }}>{(frac * 100).toFixed(0)}%</span>
  </span>
);

export function Surveillance() {
  const rm = useRM();
  const rows = useMemo(() => rm.wells.map((w) => ({
    well: w.well, role: w.role, months: w.raw.length,
    prod: 1, bhp: cov(w.bhp), thp: cov(w.thp), uptime: cov(w.uptime),
  })), [rm]);

  const exceptions = useMemo(() => {
    const out: Array<{ well: string; i: number; kind: string; dir: string; ym: string }> = [];
    for (const w of rm.producers) {
      for (const e of detectExceptions(w.wct, { k: 3 })) out.push({ well: w.well, i: e.i, kind: e.kind, dir: e.dir, ym: w.ym[e.i] ?? String(e.i) });
    }
    return out.sort((a, b) => b.i - a.i).slice(0, 40);
  }, [rm]);

  const noData = [
    { name: '4D seismic', why: 'No repeat-survey vintages in the Volve release.' },
    { name: 'PLT / production logging', why: 'No PLT passes available — zonal allocation not measured.' },
    { name: 'Well-test build-up', why: 'No discrete transient tests; Well Tests uses allocated-rate proxy.' },
  ];

  return (
    <Page>
      <TabHeader title="Integrated Surveillance" nature="reported"
        subtitle="Acquisition status, coverage and exceptions — combine dynamic evidence into a surveillance view. Missing streams shown honestly." />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginTop: 12 }}>
        <Stat label="Wells monitored" value={rm.wells.length} sub={`${rm.producers.length}P · ${rm.injectors.length}I`} />
        <Stat label="BHP coverage" value={(rows.reduce((s, r) => s + r.bhp, 0) / (rows.length || 1) * 100).toFixed(0) + '%'} sub="measured downhole" accent="var(--violet)" />
        <Stat label="Exceptions" value={exceptions.length} sub="water-cut anomalies flagged" accent={exceptions.length ? 'var(--orange)' : 'var(--green)'} />
        <Stat label="Data gaps" value={noData.length} sub="streams unavailable" accent="var(--muted)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 12, marginTop: 12 }}>
        <Panel title="Coverage matrix (per well)" minHeight={0}>
          <div style={{ maxHeight: 320, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase' }}>
                <th style={{ padding: '6px 12px' }}>Well</th><th style={{ padding: '6px 12px' }}>Months</th><th style={{ padding: '6px 12px' }}>BHP</th><th style={{ padding: '6px 12px' }}>THP</th><th style={{ padding: '6px 12px' }}>Uptime</th>
              </tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.well} style={{ borderTop: '1px solid var(--line)', cursor: 'pointer' }} onClick={() => setSelection({ well: r.well, pattern: null })}>
                    <td className="mono" style={{ padding: '6px 12px', color: r.role === 'injector' ? 'var(--cblue)' : 'var(--text)' }}>{r.well}</td>
                    <td className="mono" style={{ padding: '6px 12px', color: 'var(--muted)' }}>{r.months}</td>
                    <td style={{ padding: '6px 12px' }}>{bar(r.bhp, 'var(--violet)')}</td>
                    <td style={{ padding: '6px 12px' }}>{bar(r.thp, 'var(--blue)')}</td>
                    <td style={{ padding: '6px 12px' }}>{bar(r.uptime, 'var(--green)')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Exceptions (water-cut anomalies, latest first)" minHeight={0}>
          <div style={{ maxHeight: 320, overflow: 'auto', padding: exceptions.length ? 0 : 20 }}>
            {exceptions.length === 0 ? <div style={{ color: 'var(--muted)', fontSize: 12 }}>No exceptions flagged.</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  {exceptions.map((e, k) => (
                    <tr key={k} style={{ borderTop: k ? '1px solid var(--line)' : undefined, cursor: 'pointer' }} onClick={() => setSelection({ well: e.well, pattern: null })}>
                      <td className="mono" style={{ padding: '6px 12px', color: 'var(--text)' }}>{e.well}</td>
                      <td className="mono" style={{ padding: '6px 12px', color: 'var(--muted)' }}>{e.ym}</td>
                      <td style={{ padding: '6px 12px' }}><span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: e.kind === 'shift' ? 'var(--orange)' : 'var(--rose)' }}>{e.kind === 'shift' ? 'LEVEL SHIFT' : 'SPIKE'}</span></td>
                      <td className="mono" style={{ padding: '6px 12px', color: 'var(--muted)' }}>{e.dir === 'high' ? '↑' : '↓'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Panel>
      </div>

      <Panel title="Acquisition gaps (streams unavailable in the Volve release)" minHeight={0}>
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {noData.map((d) => (
            <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
              <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--muted)', border: '1px solid var(--line)', borderRadius: 4, padding: '2px 7px' }}>NO DATA</span>
              <span style={{ color: 'var(--text)' }}>{d.name}</span>
              <span style={{ color: 'var(--muted)' }}>— {d.why}</span>
            </div>
          ))}
        </div>
      </Panel>
    </Page>
  );
}
