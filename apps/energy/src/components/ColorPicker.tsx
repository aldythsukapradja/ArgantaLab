// ColorPicker.tsx (0b) — the reusable color-scale control every viewer's inspector
// drops in: palette swatches (live gradient preview), reverse toggle, auto-scale toggle
// (default on), and manual min/max fields (enabled only when auto-scale is off). Pure
// controlled component over engine/colorramp.ts's ColorState — callers own the state and
// pass the live data domain (for the "auto" readout) via `dataMin`/`dataMax`.
import { PALETTES, cssGradient, type ColorState } from '../engine/colorramp';

export function ColorPicker({ value, onChange, dataMin, dataMax, label }: {
  value: ColorState;
  onChange: (next: ColorState) => void;
  dataMin?: number;
  dataMax?: number;
  label?: string;
}) {
  const set = (patch: Partial<ColorState>) => onChange({ ...value, ...patch });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 11.5, color: 'var(--text)' }}>
      {label && <div style={{ fontWeight: 600, color: 'var(--muted)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</div>}

      {/* palette swatches */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {PALETTES.map((p) => {
          const on = value.palette === p.id;
          return (
            <button
              key={p.id}
              onClick={() => set({ palette: p.id })}
              title={p.label}
              style={{
                display: 'flex', flexDirection: 'column', gap: 3, padding: 4, borderRadius: 6, cursor: 'pointer',
                border: `1px solid ${on ? 'var(--teal)' : 'var(--line)'}`,
                background: on ? 'color-mix(in srgb, var(--teal) 12%, var(--panel-2))' : 'var(--panel-2)',
              }}
            >
              <div style={{ height: 14, borderRadius: 4, background: cssGradient(p.id, value.reverse) }} />
              <span style={{ fontSize: 9.5, color: on ? 'var(--text)' : 'var(--muted)', textAlign: 'left', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.label}</span>
            </button>
          );
        })}
      </div>

      {/* reverse + auto-scale toggles */}
      <div style={{ display: 'flex', gap: 6 }}>
        <ToggleChip active={value.reverse} onClick={() => set({ reverse: !value.reverse })}>Reverse</ToggleChip>
        <ToggleChip active={value.auto} onClick={() => set({ auto: !value.auto })}>Auto-scale</ToggleChip>
      </div>

      {/* domain: live readout when auto, editable fields when manual */}
      {value.auto ? (
        <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10, color: 'var(--muted)' }}>
          domain: {dataMin != null ? dataMin.toFixed(3) : '–'} … {dataMax != null ? dataMax.toFixed(3) : '–'}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <NumField value={value.min} onChange={(v) => set({ min: v })} placeholder="min" />
          <span style={{ color: 'var(--muted)' }}>–</span>
          <NumField value={value.max} onChange={(v) => set({ max: v })} placeholder="max" />
        </div>
      )}
    </div>
  );
}

function ToggleChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: '4px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 10.5,
        border: `1px solid ${active ? 'var(--teal)' : 'var(--line)'}`,
        background: active ? 'color-mix(in srgb, var(--teal) 16%, var(--panel-2))' : 'var(--panel-2)',
        color: active ? 'var(--text)' : 'var(--muted)',
      }}
    >
      {children}
    </button>
  );
}

function NumField({ value, onChange, placeholder }: { value: number; onChange: (v: number) => void; placeholder: string }) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : ''}
      placeholder={placeholder}
      onChange={(e) => { const v = parseFloat(e.target.value); if (Number.isFinite(v)) onChange(v); }}
      style={{
        width: 0, flex: 1, minWidth: 0, padding: '4px 6px', borderRadius: 5, fontSize: 11,
        border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--text)',
        fontFamily: 'var(--mono, monospace)',
      }}
    />
  );
}
