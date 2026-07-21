import { DOMAINS, SIBLING_APPS } from '../nav';
import { useStore } from '../store';
import { Command, Lock } from 'lucide-react';

export function ActivityRail() {
  const { domain, setDomain, togglePalette } = useStore();
  return (
    <nav
      aria-label="Domains"
      style={{
        width: 'var(--rail-w)', flex: '0 0 var(--rail-w)', background: 'var(--panel)',
        borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column',
        alignItems: 'center', paddingTop: 8, gap: 2,
      }}
    >
      {/* brand mark */}
      <div style={{ width: 34, height: 34, borderRadius: 6, marginBottom: 6, display: 'grid', placeItems: 'center',
        background: 'linear-gradient(160deg, rgba(80,208,177,.22), rgba(98,174,247,.12))', border: '1px solid var(--line)' }}>
        <div style={{ width: 14, height: 14, border: '2px solid var(--teal)', borderRadius: 3, transform: 'rotate(45deg)' }} />
      </div>

      {DOMAINS.map((d) => {
        const Icon = d.icon;
        const active = domain === d.id;
        return (
          <button
            key={d.id}
            onClick={() => setDomain(d.id)}
            title={`${d.label} · ${d.status === 'live' ? d.phase + ' live' : d.phase}`}
            aria-current={active ? 'page' : undefined}
            style={{
              width: 42, height: 40, borderRadius: 5, display: 'grid', placeItems: 'center', position: 'relative',
              color: active ? `var(--${d.accent})` : 'var(--muted)',
              background: active ? 'var(--panel-2)' : 'transparent',
              border: active ? '1px solid var(--line)' : '1px solid transparent',
              opacity: d.status === 'stub' ? 0.55 : 1,
            }}
          >
            <Icon size={17} strokeWidth={1.8} />
            {active && <span style={{ position: 'absolute', left: -9, top: 8, bottom: 8, width: 2, borderRadius: 2, background: `var(--${d.accent})` }} />}
            {d.status === 'stub' && <span style={{ position: 'absolute', right: 4, bottom: 4, width: 4, height: 4, borderRadius: 4, background: 'var(--line)' }} />}
          </button>
        );
      })}

      <div style={{ flex: 1 }} />

      {/* Ctrl-K */}
      <button onClick={() => togglePalette(true)} title="Command palette (Ctrl/⌘-K)"
        style={{ width: 42, height: 38, borderRadius: 5, display: 'grid', placeItems: 'center', color: 'var(--muted)' }}>
        <Command size={16} strokeWidth={1.8} />
      </button>

      {/* locked sibling-apps switcher slot */}
      <div style={{ borderTop: '1px solid var(--line)', width: 42, margin: '4px 0', paddingTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {SIBLING_APPS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id} disabled={s.locked} title={`${s.label}${s.locked ? ' · locked' : ' · current'}`}
              style={{ width: 42, height: 30, display: 'grid', placeItems: 'center', position: 'relative',
                color: s.locked ? 'var(--line)' : 'var(--teal)', cursor: s.locked ? 'not-allowed' : 'default' }}>
              <Icon size={15} strokeWidth={1.8} />
              {s.locked && <Lock size={8} style={{ position: 'absolute', right: 5, bottom: 3, color: 'var(--muted)' }} />}
            </button>
          );
        })}
      </div>

      {/* floating agent-orb slot (reserved, not wired) */}
      <div title="Agent orb — reserved for P4" aria-hidden
        style={{ width: 22, height: 22, borderRadius: 22, margin: '6px 0 10px', border: '1px dashed var(--line)',
          display: 'grid', placeItems: 'center' }}>
        <div className="pulse" style={{ width: 8, height: 8, borderRadius: 8, background: 'radial-gradient(circle, var(--violet), transparent)' }} />
      </div>
    </nav>
  );
}
