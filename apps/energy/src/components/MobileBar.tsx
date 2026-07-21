import { useState } from 'react';
import { useStore } from '../store';
import { DOMAINS, type DomainId } from '../nav';
import { Orb } from './Cosmonaut';
import { LayoutGrid, Layers, Database, GraduationCap, MoreHorizontal, X } from 'lucide-react';

// Mobile (≤820px) bottom tab bar mirrors the 4 shell zones + center Agent orb:
// Command Center · Verticals · (orb) · Intelligence · Foundation. Each zone tab
// navigates to a sensible entry domain within that zone; "More" lists every domain.
const KEYS: { id: DomainId; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'core', label: 'Command', icon: LayoutGrid },
  { id: 'exploration', label: 'Verticals', icon: Layers },      // lifecycle entry
  { id: 'data', label: 'Intelligence', icon: Database },        // most content-rich entry
  { id: 'foundation', label: 'Foundation', icon: GraduationCap },
];

export function MobileBar() {
  const { domain, setDomain, toggleCosmo } = useStore();
  const [moreOpen, setMoreOpen] = useState(false);
  const left = KEYS.slice(0, 2), right = KEYS.slice(2);

  const Item = ({ d }: { d: typeof KEYS[number] }) => {
    const Icon = d.icon;
    // Highlight the zone tab whenever the active domain is anywhere in that zone,
    // not just its literal entry domain (e.g. "Verticals" stays lit inside Field Development).
    const itemZone = DOMAINS.find((x) => x.id === d.id)!.zone;
    const activeDomainDef = DOMAINS.find((x) => x.id === domain)!;
    const active = activeDomainDef.zone === itemZone;
    return (
      <button onClick={() => setDomain(d.id)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0', color: active ? 'var(--teal)' : 'var(--muted)' }}>
        <Icon size={18} /><span style={{ fontSize: 9.5 }}>{d.label}</span>
      </button>
    );
  };

  return (
    <>
      {moreOpen && (
        <div onClick={() => setMoreOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.5)', display: 'flex', alignItems: 'flex-end' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--panel)', width: '100%', borderTop: '1px solid var(--line)', borderRadius: '12px 12px 0 0', padding: 14, maxHeight: '70vh', overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <span className="eyebrow" style={{ flex: 1 }}>All domains</span>
              <button onClick={() => setMoreOpen(false)} style={{ color: 'var(--muted)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {DOMAINS.map((d) => {
                const Icon = d.icon; const active = domain === d.id;
                return (
                  <button key={d.id} onClick={() => { setDomain(d.id); setMoreOpen(false); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px', borderRadius: 6, textAlign: 'left',
                      border: '1px solid ' + (active ? `var(--${d.accent})` : 'var(--line)'), background: 'var(--panel-2)' }}>
                    <Icon size={16} style={{ color: `var(--${d.accent})` }} />
                    <span style={{ flex: 1, fontSize: 12 }}>{d.label}</span>
                    <span className="chip mono" style={{ padding: '0 5px', fontSize: 8.5 }}>{d.phase}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav aria-label="Mobile navigation" style={{ flex: '0 0 auto', height: 60, background: 'var(--panel)', borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', position: 'relative', paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {left.map((d) => <Item key={d.id} d={d} />)}
        {/* center-raised orb */}
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'relative', top: -18 }}><Orb size={50} label={false} onClick={() => toggleCosmo(true)} /></div>
        </div>
        {right.map((d) => <Item key={d.id} d={d} />)}
        <button onClick={() => setMoreOpen(true)} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0', color: 'var(--muted)' }}>
          <MoreHorizontal size={18} /><span style={{ fontSize: 9.5 }}>More</span>
        </button>
      </nav>
    </>
  );
}
