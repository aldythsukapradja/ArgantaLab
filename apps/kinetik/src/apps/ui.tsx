import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'
import { initials } from '@data/energy'
import { detectNames } from './integrations'

/** Ultrahuman-style metric ring — sweeps on mount, single-accent stroke. */
export function Ring({ pct, size = 76, stroke = 9, value, label }: { pct: number; size?: number; stroke?: number; value?: ReactNode; label?: string }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { const r = requestAnimationFrame(() => setMounted(true)); return () => cancelAnimationFrame(r) }, [])
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const off = mounted ? c * (1 - Math.max(0, Math.min(1, pct / 100))) : c
  return (
    <div className="kap-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle className="kap-ring-track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle className="kap-ring-bar" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} strokeDasharray={c} strokeDashoffset={off} />
      </svg>
      <div className="kap-ring-c">{value != null && <b>{value}</b>}{label && <span>{label}</span>}</div>
    </div>
  )
}

/** Shimmer placeholder while data loads. */
export function Skeleton({ h = 64, style }: { h?: number; style?: CSSProperties }) {
  return <div className="kap-skel" style={{ height: h, marginBottom: 8, ...style }} />
}

/** Bottom sheet — grabber, title (optional subtitle), body-scroll lock. */
export function Sheet({ title, sub, onClose, children }: { title: string; sub?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])
  return (
    <div className="kap-scrim" onClick={onClose}>
      <div className="kap-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="kap-grip" /><h3>{title}</h3>{sub && <p className="kap-sheet-sub">{sub}</p>}{children}
      </div>
    </div>
  )
}

/** Segmented control (2–3 options). */
export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { k: T; label: ReactNode }[]; onChange: (k: T) => void }) {
  return (
    <div className="kap-seg" style={{ gridTemplateColumns: `repeat(${options.length},1fr)` }}>
      {options.map(o => (
        <button key={o.k} className={`kap-seg-btn${value === o.k ? ' on' : ''}`} onClick={() => onChange(o.k)}>{o.label}</button>
      ))}
    </div>
  )
}

/** Wrapping pill choices (durations, points, etc.). */
export function ChoiceGrid<T extends string | number>({ value, options, onChange, cols }: { value: T; options: { k: T; label: ReactNode }[]; onChange: (k: T) => void; cols?: number }) {
  return (
    <div className="kap-choices" style={cols ? { gridTemplateColumns: `repeat(${cols},1fr)`, display: 'grid' } : undefined}>
      {options.map(o => (
        <button key={String(o.k)} className={`kap-choice${value === o.k ? ' on' : ''}`} onClick={() => onChange(o.k)}>{o.label}</button>
      ))}
    </div>
  )
}

/** A −/value/+ stepper. */
export function Stepper({ value, min = 0, max = 99, onChange, suffix }: { value: number; min?: number; max?: number; onChange: (n: number) => void; suffix?: string }) {
  return (
    <div className="kap-stepper">
      <button className="kap-step-btn" onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease">−</button>
      <b>{value}{suffix ? <span>{suffix}</span> : null}</b>
      <button className="kap-step-btn" onClick={() => onChange(Math.min(max, value + 1))} aria-label="Increase">＋</button>
    </div>
  )
}

/** Member chips drawn from the active circle (selectable). */
export interface PickMember { id: string; name: string; color?: string }
export function MemberPicker({ members, selected, onToggle, max }: { members: PickMember[]; selected: string[]; onToggle: (id: string) => void; max?: number }) {
  const allOn = members.length > 0 && selected.length === members.length
  return (
    <div className="kap-who">
      {max == null && (
        <button className={`kap-who-chip all${allOn ? ' on' : ''}`} onClick={() => members.forEach(m => { const on = selected.includes(m.id); if (allOn ? on : !on) onToggle(m.id) })}>
          {allOn ? '✓ ' : ''}All
        </button>
      )}
      {members.map(m => {
        const on = selected.includes(m.id)
        return (
          <button key={m.id} className={`kap-who-chip${on ? ' on' : ''}`} onClick={() => onToggle(m.id)}>
            <span className="kap-who-av" style={{ background: m.color || 'var(--c0)' }}>{initials(m.name)}</span>
            {m.name.split(' ')[0]}
          </button>
        )
      })}
    </div>
  )
}

/** A single stat tile (big number + label). */
export function StatTile({ value, label }: { value: ReactNode; label: string }) {
  return <div className="kap-stat"><b>{value}</b><span>{label}</span></div>
}

/** Textarea that live-previews bulk-pasted names (delimiter auto-detect). */
export function BulkPaste({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const d = detectNames(value)
  return (
    <>
      <textarea className="kap-field" rows={4} placeholder="Aldyth, Kinara, Baginda, Keyla" value={value} onChange={e => onChange(e.target.value)} autoFocus />
      <div className="kap-bulk-meta">{d.names.length ? `${d.mode} · ${d.names.length} name${d.names.length === 1 ? '' : 's'}` : 'Paste names — comma, line, or space.'}</div>
    </>
  )
}

/** Eased number count-up — the premium "numbers lead" touch. */
export function CountUp({ to, dur = 750, fmt }: { to: number; dur?: number; fmt?: (n: number) => string }) {
  const [n, setN] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    let raf = 0; const start = performance.now(); const a = from.current
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur)
      setN(a + (to - a) * (1 - Math.pow(1 - p, 3)))
      if (p < 1) raf = requestAnimationFrame(tick); else from.current = to
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [to, dur])
  return <>{fmt ? fmt(n) : Math.round(n).toLocaleString()}</>
}
