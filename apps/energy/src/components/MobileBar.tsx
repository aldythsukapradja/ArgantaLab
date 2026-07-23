import { useState } from 'react';
import { useStore } from '../store';
import { DOMAINS, ZONE_LABEL, type Zone } from '../nav';
import { Orb } from './Cosmonaut';
import { LayoutGrid, Layers, Database } from 'lucide-react';

// Mobile (≤820px) bottom bar: exactly 5 targets — 4 zone tabs + the center Agent orb.
// No "More" overflow. Tapping a zone with multiple domains opens a compact popover of
// that zone's domains ABOVE the bar (the bar stays on top, z-index-wise — sheets sit
// behind it). Single-domain zones navigate directly.
const NAV_H = 60;
const ZONES: { zone: Zone; label: string; icon: typeof LayoutGrid }[] = [
  { zone: 'command', label: 'Command', icon: LayoutGrid },
  { zone: 'vertical', label: 'Verticals', icon: Layers },
  { zone: 'intelligence', label: 'Intelligence', icon: Database },
];

export function MobileBar() {
  const { domain, setDomain, toggleCosmo } = useStore();
  const [popover, setPopover] = useState<Zone | null>(null);
  const activeZone = DOMAINS.find((d) => d.id === domain)!.zone;

  const openZone = (zone: Zone) => {
    const domains = DOMAINS.filter((d) => d.zone === zone);
    if (domains.length <= 1) { setDomain(domains[0].id); setPopover(null); }
    else setPopover((p) => (p === zone ? null : zone));
  };

  const Tab = ({ z }: { z: typeof ZONES[number] }) => {
    const Icon = z.icon;
    const active = activeZone === z.zone;
    return (
      <button onClick={() => openZone(z.zone)} aria-label={z.label} aria-expanded={popover === z.zone}
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 0',
          color: active ? 'var(--teal)' : 'var(--muted)' }}>
        <Icon size={18} /><span style={{ fontSize: 9.5 }}>{z.label}</span>
      </button>
    );
  };

  const left = ZONES.slice(0, 2), right = ZONES.slice(2);
  const popDomains = popover ? DOMAINS.filter((d) => d.zone === popover) : [];

  return (
    <>
      {/* zone popover — sits ABOVE the bar; backdrop is BEHIND the bar (bar z=100 > backdrop z=90) */}
      {popover && (
        <div onClick={() => setPopover(null)} style={{ position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(0,0,0,.45)' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ position: 'fixed', left: 8, right: 8,
            bottom: `calc(${NAV_H}px + env(safe-area-inset-bottom) + 8px)`, background: 'var(--panel)',
            border: '1px solid var(--line)', borderRadius: 12, padding: 12, boxShadow: '0 10px 30px rgba(0,0,0,.4)' }}>
            <div className="eyebrow" style={{ marginBottom: 8, fontSize: 9 }}>{ZONE_LABEL[popover]}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {popDomains.map((d) => {
                const Icon = d.icon; const isActive = domain === d.id;
                return (
                  <button key={d.id} onClick={() => { setDomain(d.id); setPopover(null); }}
                    style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '11px 12px', borderRadius: 8, textAlign: 'left',
                      border: '1px solid ' + (isActive ? `var(--${d.accent})` : 'var(--line)'),
                      background: isActive ? 'var(--panel-2)' : 'var(--panel-2)' }}>
                    <Icon size={16} style={{ color: `var(--${d.accent})`, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 12, color: isActive ? 'var(--text)' : 'var(--muted)' }}>{d.label}</span>
                    <span className="chip mono" style={{ padding: '0 5px', fontSize: 8.5 }}>{d.phase}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav aria-label="Mobile navigation" style={{ flex: '0 0 auto', height: NAV_H, background: 'var(--panel)', borderTop: '1px solid var(--line)',
        display: 'flex', alignItems: 'center', position: 'relative', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {left.map((z) => <Tab key={z.zone} z={z} />)}
        {/* center-raised orb */}
        <div style={{ flex: 1, display: 'grid', placeItems: 'center' }}>
          <div style={{ position: 'relative', top: -18 }}><Orb size={50} label={false} onClick={() => { setPopover(null); toggleCosmo(true); }} /></div>
        </div>
        {right.map((z) => <Tab key={z.zone} z={z} />)}
      </nav>
    </>
  );
}
