import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from 'react'

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

/** Bottom sheet — grabber, title, accent primary inside. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="kap-scrim" onClick={onClose}>
      <div className="kap-sheet" onClick={e => e.stopPropagation()}>
        <div className="kap-grip" /><h3>{title}</h3>{children}
      </div>
    </div>
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
