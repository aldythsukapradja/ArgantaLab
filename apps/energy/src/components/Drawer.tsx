import { DOMAINS, SIBLING_APPS } from '../nav';
import { useStore } from '../store';
import { ChevronLeft, ChevronRight, Lock } from 'lucide-react';

// The MAIN nav: expanded 232px by default, collapsible to a 60px icon rail (persisted).
// Sections come from nav zones — MOTHERSHIP (platform) then VERTICALS (vertical) — with
// locked sibling apps at the bottom. Each item: icon + label + phase chip (chip → tooltip
// when collapsed).
export function Drawer() {
  const { domain, setDomain, drawerCollapsed, toggleDrawer } = useStore();
  const w = drawerCollapsed ? 60 : 232;

  const groups: { zone: 'platform' | 'vertical'; label: string }[] = [
    { zone: 'platform', label: 'MOTHERSHIP' },
    { zone: 'vertical', label: 'VERTICALS' },
  ];

  return (
    <nav aria-label="Main navigation" style={{
      width: w, flex: `0 0 ${w}px`, background: 'var(--panel)', borderRight: '1px solid var(--line)',
      display: 'flex', flexDirection: 'column', transition: 'width .18s ease', overflow: 'hidden',
    }}>
      {/* brand + collapse toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderBottom: '1px solid var(--line)', minHeight: 54 }}>
        <div style={{ width: 30, height: 30, flexShrink: 0, borderRadius: 6, display: 'grid', placeItems: 'center',
          background: 'linear-gradient(160deg, rgba(80,208,177,.22), rgba(98,174,247,.12))', border: '1px solid var(--line)' }}>
          <div style={{ width: 12, height: 12, border: '2px solid var(--teal)', borderRadius: 3, transform: 'rotate(45deg)' }} />
        </div>
        {!drawerCollapsed && (
          <span className="mono" style={{ fontSize: 12.5, fontWeight: 600, letterSpacing: '0.03em', flex: 1, whiteSpace: 'nowrap' }}>
            ARGANTA<span style={{ color: 'var(--teal)' }}>ENERGY</span>
          </span>
        )}
        <button onClick={() => toggleDrawer()} title={drawerCollapsed ? 'Expand' : 'Collapse'} aria-label="Toggle navigation"
          style={{ width: 24, height: 24, display: 'grid', placeItems: 'center', color: 'var(--muted)', borderRadius: 4, border: '1px solid var(--line)', flexShrink: 0 }}>
          {drawerCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px 8px 4px' }}>
        {groups.map((g) => (
          <div key={g.zone} style={{ marginBottom: 10 }}>
            {!drawerCollapsed
              ? <div className="eyebrow" style={{ padding: '4px 8px 6px', fontSize: 9 }}>{g.label}</div>
              : <div style={{ height: 1, background: 'var(--line)', margin: '6px 8px' }} />}
            {DOMAINS.filter((d) => d.zone === g.zone).map((d) => {
              const Icon = d.icon;
              const active = domain === d.id;
              return (
                <button key={d.id} onClick={() => setDomain(d.id)} aria-current={active ? 'page' : undefined}
                  title={drawerCollapsed ? `${d.label} · ${d.status === 'live' ? d.phase + ' live' : d.phase}` : d.blurb}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 9px', marginBottom: 1,
                    borderRadius: 5, position: 'relative', textAlign: 'left',
                    color: active ? `var(--${d.accent})` : 'var(--muted)',
                    background: active ? 'var(--panel-2)' : 'transparent',
                    border: active ? '1px solid var(--line)' : '1px solid transparent',
                    opacity: d.status === 'stub' ? 0.72 : 1,
                    justifyContent: drawerCollapsed ? 'center' : 'flex-start',
                  }}>
                  {active && <span style={{ position: 'absolute', left: 0, top: 7, bottom: 7, width: 2, borderRadius: 2, background: `var(--${d.accent})` }} />}
                  <Icon size={16} strokeWidth={1.8} style={{ flexShrink: 0 }} />
                  {!drawerCollapsed && <>
                    <span style={{ flex: 1, fontSize: 12.5, color: active ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap' }}>{d.label}</span>
                    <span className="chip mono" style={{ padding: '0 5px', fontSize: 8.5, color: d.status === 'live' ? 'var(--teal)' : 'var(--muted)' }}>{d.phase}</span>
                  </>}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* locked sibling apps */}
      <div style={{ borderTop: '1px solid var(--line)', padding: '8px' }}>
        {!drawerCollapsed && <div className="eyebrow" style={{ padding: '2px 8px 6px', fontSize: 9 }}>APPS</div>}
        {SIBLING_APPS.map((s) => {
          const Icon = s.icon;
          return (
            <button key={s.id} disabled={s.locked} title={`${s.label}${s.locked ? ' · locked' : ' · current'}`}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '6px 9px', borderRadius: 5,
                color: s.locked ? 'var(--muted)' : 'var(--teal)', cursor: s.locked ? 'not-allowed' : 'default', opacity: s.locked ? 0.6 : 1,
                justifyContent: drawerCollapsed ? 'center' : 'flex-start' }}>
              <Icon size={15} strokeWidth={1.8} style={{ flexShrink: 0 }} />
              {!drawerCollapsed && <span style={{ flex: 1, fontSize: 12, textAlign: 'left', whiteSpace: 'nowrap' }}>{s.label}</span>}
              {!drawerCollapsed && s.locked && <Lock size={11} style={{ color: 'var(--muted)' }} />}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
