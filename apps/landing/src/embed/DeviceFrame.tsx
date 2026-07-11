import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Frame } from './bridge'

// ── DeviceFrame — a phone or desktop chrome whose INNER viewport keeps true device
// pixels (so the embedded app renders its real mobile/desktop layout — kinetik & hq
// switch at 821px) while the whole frame is transform-scaled to fit its slot. Scale
// is measured with a ResizeObserver: the app never sees a fractional viewport, only
// the visual presentation shrinks.

const DIMS: Record<Frame, { w: number; h: number }> = {
  phone: { w: 390, h: 844 },
  desktop: { w: 1280, h: 800 },
}
const CHROME: Record<Frame, { padTop: number; padSide: number; padBottom: number }> = {
  phone: { padTop: 22, padSide: 8, padBottom: 8 },
  desktop: { padTop: 34, padSide: 0, padBottom: 0 },
}

export function DeviceFrame({ frame, label, children }: { frame: Frame; label?: string; children: ReactNode }) {
  const { w, h } = DIMS[frame]
  const c = CHROME[frame]
  const outerW = w + c.padSide * 2
  const outerH = h + c.padTop + c.padBottom
  const boxRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const measure = () => {
      const bw = el.clientWidth, bh = el.clientHeight
      if (bw > 0 && bh > 0) setScale(Math.min(bw / outerW, bh / outerH, 1))
      return bw > 0 && bh > 0
    }
    // slides mount hidden/transformed, so one measurement isn't enough:
    // retry on rAF until we get a real box, re-measure on resize, on element
    // resize (RO) AND on visibility (IO — catches display/transform reveals
    // that never fire a ResizeObserver).
    let tries = 0
    const retry = () => { if (!measure() && tries++ < 30) requestAnimationFrame(retry) }
    retry()
    const ro = new ResizeObserver(() => measure())
    ro.observe(el)
    const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) measure() })
    io.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); io.disconnect(); window.removeEventListener('resize', measure) }
  }, [outerW, outerH])

  return (
    <div className={`dframe dframe-${frame}`} ref={boxRef}>
      <div className="dframe-scale" style={{ width: outerW, height: outerH, transform: `scale(${scale})` }}>
        <div className="dframe-chrome" style={{ width: outerW, height: outerH }}>
          {frame === 'phone' ? (
            <>
              <span className="dframe-notch" />
              <div className="dframe-vp" style={{ width: w, height: h }}>{children}</div>
              <span className="dframe-bar" />
            </>
          ) : (
            <>
              <div className="dframe-topbar">
                <span className="dframe-dots"><i /><i /><i /></span>
                {label && <span className="dframe-url">{label}</span>}
              </div>
              <div className="dframe-vp" style={{ width: w, height: h }}>{children}</div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
