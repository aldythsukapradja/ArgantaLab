import { useMemo, useState } from 'react';
import { TABLES, FKS, GROUPS, CENTERS, fksFor, type TableMeta, type Role } from '../model/schema-meta';

// The mothership's SEMANTIC MODEL surface — renders the locked M1 contract
// (schema-meta.ts) as a Power-BI-style relational canvas: tables = nodes,
// FK = edges with cardinality + orphan-count badges, click = column dictionary,
// hover = neighbour-focus dimming. Hand-rolled SVG (lean; React Flow deferred to depth phases).

const ROLE_ACCENT: Record<Role, string> = {
  hub: 'var(--teal)', dim: 'var(--blue)', fact: 'var(--amber)',
  detail: 'var(--violet)', bridge: 'var(--orange)', gis: 'var(--rose)', evidence: 'var(--muted)',
};

// Deterministic layout: hub centre-left, wellbore centre, facts/details ring right, bridge/evidence below.
const POS: Record<string, { x: number; y: number }> = {
  well: { x: 40, y: 250 },
  wellbore: { x: 250, y: 250 },
  production: { x: 500, y: 40 },
  log_sample: { x: 500, y: 130 },
  pressure: { x: 500, y: 220 },
  trajectory: { x: 500, y: 310 },
  marker: { x: 500, y: 400 },
  horizon: { x: 250, y: 470 },
  surface: { x: 500, y: 490 },
  evidence: { x: 780, y: 250 },
};
const NW = 176;
const nh = (t: TableMeta) => 34 + Math.min(t.cols.length, 6) * 15;

export function SchemaTab() {
  const [sel, setSel] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const W = 1000, H = 560;

  const focus = hover ?? sel;
  const neighbours = useMemo(() => {
    if (!focus) return null;
    const s = new Set<string>([focus]);
    for (const f of fksFor(focus)) { s.add(f.from.split('.')[0]); s.add(f.to.split('.')[0]); }
    return s;
  }, [focus]);

  const selTable = sel ? TABLES.find((t) => t.id === sel) : null;
  const totalOrphans = FKS.reduce((a, f) => a + (f.orphans ?? 0), 0);

  const anchor = (id: string, side: 'l' | 'r') => {
    const p = POS[id]; const t = TABLES.find((x) => x.id === id)!;
    return { x: p.x + (side === 'r' ? NW : 0), y: p.y + nh(t) / 2 };
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: sel ? '1fr 300px' : '1fr', height: '100%', gap: 10 }}>
      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div className="panel-header" style={{ marginBottom: 8 }}>
          <span>Semantic model — star schema · {TABLES.length} tables · {FKS.length} relationships · contract v1.0.0 LOCKED</span>
          <span className="chip teal">hub: well ▸ wellbore</span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', border: '1px solid var(--line)', borderRadius: 4, background: 'var(--panel)' }}>
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', minWidth: W }} role="img" aria-label="Star schema relational canvas">
            <defs>
              <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#12242b" />
              </pattern>
            </defs>
            <rect width={W} height={H} fill="url(#grid)" />

            {/* FK edges */}
            {FKS.map((f, i) => {
              const a = f.from.split('.')[0], b = f.to.split('.')[0];
              if (!POS[a] || !POS[b]) return null;
              const aRight = POS[a].x < POS[b].x;
              const p1 = anchor(a, aRight ? 'r' : 'l');
              const p2 = anchor(b, aRight ? 'l' : 'r');
              const active = !neighbours || (neighbours.has(a) && neighbours.has(b));
              const midX = (p1.x + p2.x) / 2;
              const orphan = (f.orphans ?? 0) > 0;
              return (
                <g key={i} opacity={active ? 1 : 0.12}>
                  <path d={`M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`}
                    fill="none" stroke={orphan ? 'var(--rose)' : 'var(--line)'} strokeWidth={orphan ? 1.6 : 1.2} />
                  {/* crow's-foot (many) at the FROM end */}
                  <circle cx={p1.x} cy={p1.y} r={2.4} fill={orphan ? 'var(--rose)' : 'var(--muted)'} />
                  {orphan && (
                    <g transform={`translate(${midX - 14}, ${(p1.y + p2.y) / 2 - 7})`}>
                      <rect width="28" height="14" rx="3" fill="var(--panel-2)" stroke="var(--rose)" />
                      <text x="14" y="10" textAnchor="middle" fontSize="8" fontFamily="var(--mono)" fill="var(--rose)">{f.orphans}⌀</text>
                    </g>
                  )}
                </g>
              );
            })}

            {/* table nodes */}
            {TABLES.map((t) => {
              const p = POS[t.id]; if (!p) return null;
              const dim = neighbours && !neighbours.has(t.id);
              const isHub = t.id === CENTERS.primary || t.id === CENTERS.secondary;
              const h = nh(t);
              return (
                <g key={t.id} transform={`translate(${p.x},${p.y})`} opacity={dim ? 0.22 : 1}
                  style={{ cursor: 'pointer' }}
                  onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)}
                  onClick={() => setSel(sel === t.id ? null : t.id)}>
                  <rect width={NW} height={h} rx={4} fill="var(--panel-2)"
                    stroke={sel === t.id ? ROLE_ACCENT[t.role] : 'var(--line)'} strokeWidth={sel === t.id ? 2 : 1} />
                  <rect width={NW} height={22} rx={4} fill={ROLE_ACCENT[t.role]} opacity={0.16} />
                  <rect x={0} y={0} width={3} height={h} fill={ROLE_ACCENT[t.role]} />
                  <text x={10} y={15} fontSize={11} fontFamily="var(--mono)" fill="var(--text)" fontWeight={isHub ? 700 : 500}>{t.name}</text>
                  <text x={NW - 8} y={15} textAnchor="end" fontSize={8} fontFamily="var(--mono)" fill="var(--muted)">{t.role} · {t.rows.toLocaleString()}</text>
                  {t.cols.slice(0, 6).map((c, ci) => (
                    <text key={ci} x={10} y={36 + ci * 15} fontSize={9} fontFamily="var(--mono)"
                      fill={c.key === 'pk' ? 'var(--teal)' : c.key === 'fk' ? 'var(--blue)' : 'var(--muted)'}>
                      {c.key === 'pk' ? '★ ' : c.key === 'fk' ? '→ ' : ''}{c.name}
                    </text>
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
        <div style={{ display: 'flex', gap: 8, padding: '8px 2px', flexWrap: 'wrap' }}>
          {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((g) => (
            <span key={g} className="chip">{GROUPS[g]}</span>
          ))}
          <span style={{ flex: 1 }} />
          <span className="chip rose">{totalOrphans} orphan rows across FKs · carried verbatim, never merged</span>
        </div>
      </div>

      {selTable && (
        <aside className="panel" style={{ overflow: 'auto' }}>
          <div className="panel-header"><span>{selTable.name}</span><span className="chip" style={{ color: ROLE_ACCENT[selTable.role] }}>{selTable.role}</span></div>
          <div style={{ padding: 12, fontSize: 12 }}>
            <p className="muted" style={{ marginTop: 0, lineHeight: 1.5 }}>{selTable.desc}</p>
            <div className="mono" style={{ fontSize: 10, color: 'var(--muted)', margin: '8px 0' }}>
              rows {selTable.rows.toLocaleString()} · {selTable.dataNature} · src {selTable.source}
            </div>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--muted)', margin: '10px 0 4px' }}>COLUMNS</div>
            <table className="mono" style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse' }}>
              <tbody>
                {selTable.cols.map((c) => (
                  <tr key={c.name} style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '3px 4px', color: c.key === 'pk' ? 'var(--teal)' : c.key === 'fk' ? 'var(--blue)' : 'var(--text)' }}>
                      {c.key === 'pk' ? '★' : c.key === 'fk' ? '→' : ''} {c.name}
                    </td>
                    <td style={{ padding: '3px 4px', color: 'var(--muted)' }}>{c.type}{c.unit ? ` ${c.unit}` : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: 10, letterSpacing: '0.08em', color: 'var(--muted)', margin: '12px 0 4px' }}>RELATIONSHIPS</div>
            {fksFor(selTable.id).map((f) => (
              <div key={f.id} className="mono" style={{ fontSize: 10, padding: '3px 0', color: 'var(--muted)' }}>
                {f.from} <span style={{ color: 'var(--text)' }}>{f.card}</span> {f.to}
                {(f.orphans ?? 0) > 0 && <span className="chip rose" style={{ marginLeft: 6 }}>{f.orphans} orphan</span>}
              </div>
            ))}
          </div>
        </aside>
      )}
    </div>
  );
}
