import { useState } from 'react';

interface Entity { id: string; label: string; accent: string; rows: number; sub: string; nature: string; }
interface Schema { entities: Entity[]; edges: string[][]; }

// Power-BI-style relational canvas: fixed hierarchical layout, hairline connectors.
const POS: Record<string, { x: number; y: number }> = {
  field: { x: 40, y: 150 },
  well: { x: 230, y: 150 },
  wellbore: { x: 430, y: 150 },
  production: { x: 660, y: 30 },
  logrun: { x: 660, y: 118 },
  trajectory: { x: 660, y: 206 },
  marker: { x: 660, y: 294 },
  horizon: { x: 230, y: 300 },
};
const NW = 178, NH = 62;

export function SchemaCanvas({ schema }: { schema: Schema }) {
  const [hover, setHover] = useState<string | null>(null);
  const W = 880, H = 380;
  const center = (id: string) => ({ x: (POS[id]?.x ?? 0) + NW / 2, y: (POS[id]?.y ?? 0) + NH / 2 });

  return (
    <div style={{ overflow: 'auto', width: '100%', height: '100%' }}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} style={{ display: 'block', minWidth: W }}>
        <defs>
          <pattern id="dots" width="26" height="26" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="1" fill="#12242b" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#dots)" />

        {/* edges */}
        {schema.edges.map(([a, b], i) => {
          const p1 = center(a), p2 = center(b);
          const active = hover === a || hover === b;
          const midX = (p1.x + p2.x) / 2;
          return (
            <path key={i} d={`M ${p1.x} ${p1.y} C ${midX} ${p1.y}, ${midX} ${p2.y}, ${p2.x} ${p2.y}`}
              fill="none" stroke={active ? 'var(--teal)' : 'var(--line)'} strokeWidth={active ? 1.6 : 1} />
          );
        })}
        {/* crow's-foot dots at ends */}
        {schema.edges.map(([, b], i) => {
          const p2 = center(b);
          return <circle key={'d' + i} cx={p2.x - NW / 2 + 2} cy={p2.y} r={2.4} fill="var(--muted)" />;
        })}

        {/* entity cards */}
        {schema.entities.map((e) => {
          const p = POS[e.id]; if (!p) return null;
          const isHover = hover === e.id;
          const zero = e.rows === 0;
          return (
            <g key={e.id} transform={`translate(${p.x},${p.y})`} onMouseEnter={() => setHover(e.id)} onMouseLeave={() => setHover(null)} style={{ cursor: 'default' }}>
              <rect width={NW} height={NH} rx={3} fill="var(--panel-2)" stroke={isHover ? `var(--${e.accent})` : 'var(--line)'} strokeWidth={isHover ? 1.4 : 1} />
              <rect width={4} height={NH} rx={2} fill={`var(--${e.accent})`} opacity={zero ? 0.4 : 1} />
              <text x={14} y={20} fill="var(--text)" fontSize={12.5} fontWeight={600} fontFamily="var(--mono)">{e.label}</text>
              <text x={14} y={36} fill="var(--muted)" fontSize={10} fontFamily="var(--sans)">{e.sub}</text>
              <text x={NW - 12} y={NH - 12} textAnchor="end" fill={zero ? 'var(--rose)' : `var(--${e.accent})`} fontSize={13} fontFamily="var(--mono)" fontWeight={600}>
                {zero ? '0' : e.rows.toLocaleString()}
              </text>
              <text x={14} y={NH - 12} fill="var(--muted)" fontSize={8.5} fontFamily="var(--mono)" letterSpacing="0.06em">{e.nature.toUpperCase()}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
