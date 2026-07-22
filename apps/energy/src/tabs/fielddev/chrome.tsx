// chrome.tsx — shared workbench UI chrome: 3-pane shell, inspector, toolbar
// buttons, layer rows, segmented control, sliders, readout + scale bar.
// Token colours only; both themes; reduced-motion safe (no animations here).
import type { ReactNode, CSSProperties } from 'react';
import type { WellRole } from '../../wb/types';

/** Role → token colour name for well posting. */
export const ROLE_VAR: Record<WellRole, string> = {
  producer: '--amber',
  injector: '--blue',
  both: '--teal',
  none: '--muted',
};
export const roleColor = (r: WellRole) => `var(${ROLE_VAR[r]})`;

/** Apply alpha to any hex or rgb() colour string → rgba(). */
export function withAlpha(color: string, alpha: number): string {
  const c = color.trim();
  if (c.startsWith('#')) {
    const s = c.slice(1);
    const h = s.length === 3 ? s.split('').map((x) => x + x).join('') : s;
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  const m = c.match(/\d+(\.\d+)?/g);
  if (m && m.length >= 3) return `rgba(${m[0]},${m[1]},${m[2]},${alpha})`;
  return c;
}

/** Colours for the 16 correlation/pick surfaces (token palette, cycled). */
export const SURFACE_VARS = ['--teal', '--amber', '--blue', '--violet', '--rose', '--orange'];
export const surfaceColor = (i: number) => `var(${SURFACE_VARS[i % SURFACE_VARS.length]})`;

export function Segmented<T extends string>({ options, value, onChange, accent = '--blue' }: {
  options: Array<{ id: T; label: string }>; value: T; onChange: (v: T) => void; accent?: string;
}) {
  return (
    <div style={{ display: 'inline-flex', border: '1px solid var(--line)', borderRadius: 4, overflow: 'hidden', background: 'var(--panel-2)' }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button key={o.id} onClick={() => onChange(o.id)}
            style={{ padding: '4px 10px', fontSize: 11, fontFamily: 'var(--mono)',
              color: active ? 'var(--text)' : 'var(--muted)',
              background: active ? `var(${accent})` : 'transparent',
              filter: active ? 'saturate(0.9)' : 'none', border: 'none' }}>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ToolButton({ active, title, onClick, children, accent = '--blue' }: {
  active?: boolean; title: string; onClick: () => void; children: ReactNode; accent?: string;
}) {
  return (
    <button title={title} aria-label={title} onClick={onClick}
      style={{ display: 'grid', placeItems: 'center', width: 30, height: 30, borderRadius: 4,
        border: `1px solid ${active ? `var(${accent})` : 'var(--line)'}`,
        background: active ? 'var(--sel)' : 'var(--panel-2)',
        color: active ? `var(${accent})` : 'var(--muted)' }}>
      {children}
    </button>
  );
}

export function LayerRow({ on, onToggle, label, swatch, right, indent = 0, onClick, active }: {
  on: boolean; onToggle: () => void; label: ReactNode; swatch?: string; right?: ReactNode;
  indent?: number; onClick?: () => void; active?: boolean;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '3px 6px', paddingLeft: 6 + indent * 14,
      borderRadius: 3, background: active ? 'var(--sel)' : 'transparent', cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}>
      <button onClick={(e) => { e.stopPropagation(); onToggle(); }} aria-label={on ? 'Hide layer' : 'Show layer'}
        style={{ width: 16, height: 16, display: 'grid', placeItems: 'center', color: on ? 'var(--text)' : 'var(--muted)', opacity: on ? 1 : 0.45 }}>
        {on ? '◉' : '○'}
      </button>
      {swatch && <span style={{ width: 10, height: 10, borderRadius: 2, background: swatch, flexShrink: 0 }} />}
      <span style={{ flex: 1, fontSize: 11.5, color: on ? 'var(--text)' : 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {right}
    </div>
  );
}

export function Slider({ label, min, max, step, value, onChange, fmt }: {
  label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; fmt?: (v: number) => string;
}) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>
        <span>{label}</span><span className="mono" style={{ color: 'var(--text)' }}>{fmt ? fmt(value) : value}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--blue)' }} />
    </label>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 3 }}>{label}</div>
      {children}
    </label>
  );
}

export const inputStyle: CSSProperties = {
  width: '100%', padding: '5px 8px', fontSize: 12, fontFamily: 'var(--mono)',
  background: 'var(--panel-2)', border: '1px solid var(--line)', borderRadius: 3, color: 'var(--text)',
};

/** Right inspector drawer — collapsible, token-themed. */
export function Inspector({ title, open, onToggle, children }: {
  title: string; open: boolean; onToggle: () => void; children: ReactNode;
}) {
  return (
    <aside style={{ width: open ? 296 : 0, flexShrink: 0, borderLeft: open ? '1px solid var(--line)' : 'none',
      background: 'var(--panel)', display: 'flex', flexDirection: 'column', minHeight: 0, transition: 'width .12s', overflow: 'hidden' }}>
      {open && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderBottom: '1px solid var(--line)' }}>
            <div className="eyebrow" style={{ flex: 1 }}>{title}</div>
            <button onClick={onToggle} title="Collapse inspector" style={{ color: 'var(--muted)', fontSize: 14 }}>{'›'}</button>
          </div>
          <div style={{ flex: 1, overflow: 'auto', padding: 12 }}>{children}</div>
        </>
      )}
    </aside>
  );
}

export function InspectorSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 8, color: 'var(--muted)' }}>{title}</div>
      {children}
    </div>
  );
}

/** Bottom-left readout + scale bar overlay. */
export function ReadoutBar({ left, scale }: { left: ReactNode; scale?: { px: number; label: string } }) {
  return (
    <div style={{ position: 'absolute', left: 10, bottom: 10, display: 'flex', flexDirection: 'column', gap: 6, pointerEvents: 'none' }}>
      {scale && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: scale.px, height: 4, borderLeft: '2px solid var(--text)', borderRight: '2px solid var(--text)', borderBottom: '2px solid var(--text)' }} />
          <span className="mono" style={{ fontSize: 10, color: 'var(--text)', textShadow: '0 1px 3px var(--bg)' }}>{scale.label}</span>
        </div>
      )}
      <div className="mono" style={{ fontSize: 10.5, color: 'var(--text)', background: 'color-mix(in srgb, var(--panel) 78%, transparent)',
        padding: '3px 7px', borderRadius: 3, border: '1px solid var(--line)' }}>{left}</div>
    </div>
  );
}

/** Simple loading / error banners. */
export function Loading({ what }: { what: string }) {
  return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--muted)', fontSize: 12 }}>Loading {what}…</div>;
}
export function ErrorBanner({ msg }: { msg: string }) {
  return <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'var(--rose)', fontSize: 12, padding: 24, textAlign: 'center' }}>{msg}</div>;
}
