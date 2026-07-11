import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'

// ── Shared chart kit ────────────────────────────────────────────────────────
// Every D3 chart in HQ draws from the same small kit: the fixed-order
// categorical palette (CVD-validated per theme in theme.css), a container
// measurer, one tooltip implementation, and duration formatting. Marks follow
// the house specs: 2px lines, ≥8px ringed markers, ~10%-opacity area washes,
// hairline solid gridlines, ≤24px bars with a 4px rounded data-end.

/** Fixed-order categorical slots — resolve to the theme's validated steps. */
export const SLOT = ['var(--ch1)', 'var(--ch2)', 'var(--ch3)', 'var(--ch4)', 'var(--ch5)', 'var(--ch6)']
export const slotColor = (i: number) => SLOT[i % SLOT.length]

/** Stable app → slot assignment (color follows the entity, never its rank). */
const APP_SLOT: Record<string, number> = { arganta: 0, kinetik: 1, lashira: 2, hq: 3, landing: 4, kingdom: 5 }
export const appColor = (app: string) => slotColor(APP_SLOT[app] ?? 5)
export const APP_LABEL: Record<string, string> = {
  arganta: 'ArgantaLab', kinetik: 'KinetikCircle', lashira: 'LashiraBloom',
  hq: 'Circle HQ', landing: 'Landing', kingdom: 'Kingdom Heroes',
}
export const appLabel = (app: string) => APP_LABEL[app] ?? app.charAt(0).toUpperCase() + app.slice(1)

/** Seconds → human duration: 45s · 12m · 3.4h · 26h. */
export function fmtDur(secs: number): string {
  if (!Number.isFinite(secs) || secs <= 0) return '0m'
  if (secs < 60) return Math.round(secs) + 's'
  const m = secs / 60
  if (m < 60) return Math.round(m) + 'm'
  const h = m / 60
  return (h < 10 ? Math.round(h * 10) / 10 : Math.round(h)) + 'h'
}

/** Measure a container's width (ResizeObserver; SSR-safe). */
export function useMeasure<T extends HTMLElement>(): [React.RefObject<T>, number] {
  const ref = useRef<T>(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) setW(Math.round(e.contentRect.width))
    })
    ro.observe(el)
    // Immediate measure + a short retry ladder: on first mount the stylesheet
    // may not be applied yet (width 0), and RO callbacks don't fire while the
    // window isn't painting — so poll briefly until a real width appears.
    let tries = 0
    let timer = 0
    const measure = () => {
      const w = Math.round(el.getBoundingClientRect().width)
      if (w > 0) { setW(w); return }
      if (tries++ < 20) timer = window.setTimeout(measure, 60)
    }
    measure()
    return () => { ro.disconnect(); window.clearTimeout(timer) }
  }, [])
  return [ref, w]
}

// ── Tooltip ────────────────────────────────────────────────────────────────
export interface TipState { x: number; y: number; body: ReactNode }

export function useTooltip() {
  const [tip, setTip] = useState<TipState | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const show = useCallback((evt: { clientX: number; clientY: number }, body: ReactNode) => {
    const box = wrapRef.current?.getBoundingClientRect()
    if (!box) return
    setTip({ x: evt.clientX - box.left, y: evt.clientY - box.top, body })
  }, [])
  const hide = useCallback(() => setTip(null), [])
  return { wrapRef, tip, show, hide }
}

/** Positioned tooltip layer; render inside the wrapRef container (position:relative). */
export function TooltipLayer({ tip }: { tip: TipState | null }) {
  if (!tip) return null
  return (
    <div
      style={{
        position: 'absolute', left: tip.x + 12, top: tip.y - 8, zIndex: 20,
        pointerEvents: 'none', background: 'var(--bg)', border: '1px solid var(--bd2)',
        borderRadius: 9, boxShadow: 'var(--shadow-md)', padding: '7px 10px',
        fontSize: 11.5, lineHeight: 1.5, color: 'var(--tx2)', whiteSpace: 'nowrap',
        transform: tip.x > 240 ? 'translateX(calc(-100% - 24px))' : undefined,
      }}
    >
      {tip.body}
    </div>
  )
}

/** One tooltip row: short line-key in the series color + label + strong value. */
export function TipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
      {color && <span style={{ width: 10, height: 2.5, borderRadius: 2, background: color, flex: 'none' }} />}
      <span style={{ color: 'var(--tx3)' }}>{label}</span>
      <span style={{ marginLeft: 'auto', paddingLeft: 12, fontWeight: 700, color: 'var(--tx)' }}>{value}</span>
    </div>
  )
}

/** Legend row (always shown for ≥2 series). Swatch mirrors the mark. */
export function Legend({ items, mark = 'rect' }: { items: { label: string; color: string }[]; mark?: 'rect' | 'line' }) {
  if (items.length < 2) return null
  return (
    <div className="row" style={{ gap: 14, flexWrap: 'wrap', fontSize: 11, color: 'var(--tx2)' }}>
      {items.map((it) => (
        <span key={it.label} className="row" style={{ gap: 5 }}>
          <span style={mark === 'line'
            ? { width: 11, height: 3, borderRadius: 2, background: it.color }
            : { width: 9, height: 9, borderRadius: 3, background: it.color }} />
          {it.label}
        </span>
      ))}
    </div>
  )
}

/** Horizontal bar with a 4px rounded data-end, square at the baseline. */
export function roundedRightBar(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, w, h / 2)
  return `M${x},${y} h${Math.max(0, w - rr)} a${rr},${rr} 0 0 1 ${rr},${rr} v${h - 2 * rr} a${rr},${rr} 0 0 1 -${rr},${rr} h${-Math.max(0, w - rr)} z`
}

/** Vertical column with a 4px rounded top (data end), square at the baseline. */
export function roundedTopBar(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.min(r, h, w / 2)
  return `M${x},${y + h} v${-Math.max(0, h - rr)} a${rr},${rr} 0 0 1 ${rr},-${rr} h${w - 2 * rr} a${rr},${rr} 0 0 1 ${rr},${rr} v${Math.max(0, h - rr)} z`
}
