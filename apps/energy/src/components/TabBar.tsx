import { DOMAINS } from '../nav';
import { useStore } from '../store';

export function TabBar() {
  const { domain, setDomain } = useStore();
  return (
    <div
      role="tablist"
      aria-label="Domain tabs"
      style={{
        height: 'var(--tabbar-h)', flex: '0 0 var(--tabbar-h)', background: 'var(--bg)',
        borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'stretch',
        padding: '0 8px', gap: 2, overflowX: 'auto',
      }}
    >
      {DOMAINS.map((d, i) => {
        const active = domain === d.id;
        const zoneStart = i > 0 && DOMAINS[i - 1].zone !== d.zone;
        return (
          <div key={d.id} style={{ display: 'contents' }}>
          {zoneStart && (
            <span aria-hidden style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', borderLeft: '1px solid var(--line)', marginLeft: 4 }}>
              <span className="eyebrow" style={{ fontSize: 8.5 }}>VERTICALS</span>
            </span>
          )}
          <button
            role="tab"
            aria-selected={active}
            onClick={() => setDomain(d.id)}
            title={d.blurb}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '0 12px',
              fontSize: 12, whiteSpace: 'nowrap', position: 'relative',
              color: active ? 'var(--text)' : 'var(--muted)',
              borderBottom: active ? `2px solid var(--${d.accent})` : '2px solid transparent',
              opacity: d.status === 'stub' ? 0.7 : 1,
            }}
          >
            {d.label}
            {d.status === 'stub' && (
              <span className="chip mono" style={{ padding: '0px 4px', fontSize: 9, borderColor: 'var(--line)' }}>{d.phase}</span>
            )}
          </button>
          </div>
        );
      })}
    </div>
  );
}
