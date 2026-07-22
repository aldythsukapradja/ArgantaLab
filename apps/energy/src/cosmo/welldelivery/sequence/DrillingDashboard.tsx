// DrillingDashboard — the bottom cross-filtering panel grid. Volve remap of the
// reference's phase/DC/well-count/maturation/PM panels. Clicking a row/pill/cell
// sets the single active filter (dims the Gantt + tints the map). Reference parity
// on the interaction model; Al Shaheen-specific concepts remapped to Volve.
import { useMemo } from 'react';
import type { DrillingSchedule, Reservoir, Basis } from './schedule-model';
import { RESERVOIR_COLOR, allActivities, pmList, wellCountByYear } from './schedule-model';

interface Props {
  schedule: DrillingSchedule;
  activeFilter: string | null;
  onFilter: (f: string) => void;
}

const CAMPAIGNS: { key: string; label: string; color: string }[] = [
  { key: 'act:Dev', label: 'Development', color: '#0FB5A6' },
  { key: 'act:App', label: 'Appraisal', color: '#f59e0b' },
  { key: 'act:WO', label: 'Workover', color: '#7c3aed' },
  { key: 'welltype:WI', label: 'Injector', color: '#2563eb' },
  { key: 'basis:APPROVED', label: 'Approved (from proposal)', color: '#0FB5A6' },
  { key: 'basis:BOD', label: 'Basis of Design', color: '#10b981' },
  { key: 'nonfid:1', label: 'Non-FID', color: '#ef4444' },
];

const RESERVOIRS: Reservoir[] = ['Hugin', 'Skagerrak', 'Ty', 'Other'];

export function DrillingDashboard({ schedule, activeFilter, onFilter }: Props) {
  const isOn = (key: string) => activeFilter === key;

  const acts = useMemo(() => allActivities(schedule), [schedule]);
  const counts = useMemo(() => wellCountByYear(schedule), [schedule]);

  // PM pivot: year × reservoir.
  const pm = useMemo(() => {
    const list = pmList(schedule);
    const years = [...new Set(list.map((p) => new Date(p.td).getFullYear()))].sort();
    const grid = new Map<string, number>();
    for (const p of list) {
      const y = new Date(p.td).getFullYear();
      grid.set(`${y}_${p.res}`, (grid.get(`${y}_${p.res}`) ?? 0) + 1);
    }
    return { years, grid };
  }, [schedule]);

  // Maturation: gate × count (from bar basis).
  const maturation = useMemo(() => {
    const order: Basis[] = ['APPROVED', 'BOD', 'SOR2', 'SOR1', 'SOR0'];
    const label: Record<string, string> = { APPROVED: 'Approved', BOD: 'Basis of Design', SOR2: 'SOR2 · Ready', SOR1: 'SOR1 · Maturing', SOR0: 'SOR0 · Concept', ACTUAL: 'Actual' };
    const by = new Map<string, number>();
    for (const a of acts) { if (a.kind === 'Rig') continue; by.set(String(a.basis), (by.get(String(a.basis)) ?? 0) + 1); }
    return order.filter((g) => by.has(g)).map((g) => ({ gate: g, label: label[g], count: by.get(g)! }));
  }, [acts]);

  // Reservoir well counts (real Volve roles) for the count table.
  const resCounts = useMemo(() => {
    const by = new Map<Reservoir, { OP: number; WI: number; App: number }>();
    for (const a of acts) {
      if (a.kind === 'Rig' || a.kind === 'WO' || !a.reservoir) continue;
      const r = by.get(a.reservoir) ?? { OP: 0, WI: 0, App: 0 };
      if (a.kind === 'App') r.App++; else if (a.wellType === 'WI') r.WI++; else r.OP++;
      by.set(a.reservoir, r);
    }
    return RESERVOIRS.filter((r) => by.has(r)).map((r) => ({ res: r, ...by.get(r)! }));
  }, [acts]);

  return (
    <div className="ddash">
      {/* col A — campaign legend + reservoir key */}
      <div className="dcol">
        <div className="dsec">
          <div className="dsec-t">Filter · Campaign</div>
          {CAMPAIGNS.map((c) => (
            <div key={c.key} className={`dpill${isOn(c.key) ? ' on' : ''}`} onClick={() => onFilter(c.key)}>
              <i style={{ background: c.color }} /><span>{c.label}</span>
            </div>
          ))}
        </div>
        <div className="dsec">
          <div className="dsec-t">Reservoir</div>
          {RESERVOIRS.map((r) => (
            <div key={r} className={`dpill${isOn(`res:${r}`) ? ' on' : ''}`} onClick={() => onFilter(`res:${r}`)}>
              <i style={{ background: RESERVOIR_COLOR[r] }} /><span>{r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* col B — well count tables */}
      <div className="dcol">
        <div className="dsec">
          <div className="dsec-t">Well Count by TD Year (scenario schedule)</div>
          <table className="dtbl">
            <thead><tr><th>Year</th><th>Producers</th><th>Injectors</th><th>Appraisal</th><th>Total</th></tr></thead>
            <tbody>
              {counts.map((r) => (
                <tr key={r.year}><td>{r.year}</td><td>{r.OP}</td><td>{r.WI}</td><td>{r.App}</td><td>{r.total}</td></tr>
              ))}
              <tr className="tot"><td>Total</td>
                <td>{sum(counts, 'OP')}</td><td>{sum(counts, 'WI')}</td><td>{sum(counts, 'App')}</td><td>{sum(counts, 'total')}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="dsec">
          <div className="dsec-t">Well Count by Reservoir (real Volve roles)</div>
          <table className="dtbl">
            <thead><tr><th>Reservoir</th><th>Producers</th><th>Injectors</th><th>Appraisal</th><th>Total</th></tr></thead>
            <tbody>
              {resCounts.map((r) => (
                <tr key={r.res} className={isOn(`res:${r.res}`) ? 'on' : ''} onClick={() => onFilter(`res:${r.res}`)}>
                  <td>{r.res}</td><td>{r.OP}</td><td>{r.WI}</td><td>{r.App}</td><td>{r.OP + r.WI + r.App}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* col C — maturation + PM tracker */}
      <div className="dcol">
        <div className="dsec">
          <div className="dsec-t">Maturation (gate × wells)</div>
          <table className="dtbl">
            <tbody>
              {maturation.map((m) => (
                <tr key={m.gate} className={isOn(`basis:${m.gate}`) ? 'on' : ''} onClick={() => onFilter(`basis:${m.gate}`)}>
                  <td>{m.label}</td><td>{m.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="dsec">
          <div className="dsec-t">Post-Well Review Tracker (6mo post-TD, ≥2026)</div>
          <table className="dtbl">
            <thead>
              <tr><th>Year</th>{RESERVOIRS.map((r) => <th key={r} style={{ color: RESERVOIR_COLOR[r] }}>{r}</th>)}<th>Total</th></tr>
            </thead>
            <tbody>
              {pm.years.map((y) => {
                const rowTotal = RESERVOIRS.reduce((s, r) => s + (pm.grid.get(`${y}_${r}`) ?? 0), 0);
                return (
                  <tr key={y}>
                    <td>{y}</td>
                    {RESERVOIRS.map((r) => {
                      const n = pm.grid.get(`${y}_${r}`) ?? 0;
                      const key = `pm:${y}_${r}`;
                      return n > 0
                        ? <td key={r} className={isOn(key) ? 'on' : ''} onClick={() => onFilter(key)}>{n}</td>
                        : <td key={r} className="z">·</td>;
                    })}
                    <td>{rowTotal}</td>
                  </tr>
                );
              })}
              {pm.years.length === 0 && <tr><td colSpan={RESERVOIRS.length + 2} className="z">No wells past TD threshold</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function sum<T>(rows: T[], key: keyof T): number {
  return rows.reduce((s, r) => s + (Number(r[key]) || 0), 0);
}
