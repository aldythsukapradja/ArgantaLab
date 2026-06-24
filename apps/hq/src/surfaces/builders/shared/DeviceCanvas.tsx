import { useState, useRef, type SyntheticEvent } from 'react'
import { Smartphone, Tablet, Monitor, Play, Maximize2, RefreshCw, RotateCw, Zap } from 'lucide-react'
import type { Circle } from '../../../data/live'
import { composeRuntime, openFullscreen, type Kind } from '../artifact'

export type DeviceMode = 'iphone' | 'tablet' | 'desktop'

const DEVICES: { mode: DeviceMode; Icon: typeof Smartphone; label: string }[] = [
  { mode: 'iphone', Icon: Smartphone, label: 'Phone' },
  { mode: 'tablet', Icon: Tablet, label: 'Tablet' },
  { mode: 'desktop', Icon: Monitor, label: 'Desktop' },
]

// Phone & tablet render at real logical resolution, scaled to fit — so the
// preview reflects the true device breakpoint. Desktop fills the whole stage.
const PHONE  = { w: 390, h: 844, scale: 0.58, radius: 44 }
const TABLET = { w: 834, h: 1112, scale: 0.46, radius: 20 }

interface Props {
  kind: Kind
  title: string
  html: string
  running: boolean
  device: DeviceMode
  circle: Circle | null
  user: { id: string; name: string; avatar?: string }
  onRun: () => void
  onDevice: (d: DeviceMode) => void
}

/**
 * The Canvas — device-framed live preview with audience panel. Identical for
 * Game and App studios; only the injected SDK differs (driven by `kind`).
 */
export function DeviceCanvas({ kind, title, html, running, device, circle, user, onRun, onDevice }: Props) {
  const ctx = { user, circle }
  const [landscape, setLandscape] = useState(false)
  const [perf, setPerf] = useState<{ ms: number; kb: number; nodes: number } | null>(null)
  const startRef = useRef(0)
  const frame = device === 'iphone'
    ? PHONE
    : landscape
      ? { w: TABLET.h, h: TABLET.w, scale: TABLET.scale, radius: TABLET.radius }
      : TABLET

  // Press Run → also profile the artifact: real load time + payload + DOM size.
  const run = () => { startRef.current = performance.now(); setPerf(null); onRun() }
  const measure = (e: SyntheticEvent<HTMLIFrameElement>) => {
    const f = e.currentTarget
    try {
      const win = f.contentWindow as Window & typeof globalThis
      const nav = win?.performance?.getEntriesByType?.('navigation')?.[0] as PerformanceNavigationTiming | undefined
      const ms = nav?.duration ? Math.round(nav.duration) : Math.round(performance.now() - startRef.current)
      const nodes = f.contentDocument?.querySelectorAll('*').length ?? 0
      setPerf({ ms, kb: Math.round(html.length / 1024), nodes })
    } catch {
      setPerf({ ms: Math.round(performance.now() - startRef.current), kb: Math.round(html.length / 1024), nodes: 0 })
    }
  }

  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 480 }}>
      {/* Device bar */}
      <div style={{
        padding: '9px 12px', borderBottom: '1px solid var(--bd)',
        display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {DEVICES.map(({ mode, Icon, label }) => (
            <button
              key={mode}
              onClick={() => onDevice(mode)}
              className="chip"
              style={{
                padding: '4px 9px', fontSize: 11, gap: 4,
                background: device === mode ? 'var(--acc)' : 'transparent',
                color: device === mode ? '#fff' : 'var(--tx2)',
                borderColor: device === mode ? 'var(--acc)' : 'var(--bd2)',
              }}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
          {device === 'tablet' && (
            <button onClick={() => setLandscape(l => !l)} className="chip" title="Rotate tablet"
              style={{ padding: '4px 9px', fontSize: 11, gap: 4, color: 'var(--tx2)', borderColor: 'var(--bd2)' }}>
              <RotateCw size={12} /> {landscape ? 'Landscape' : 'Portrait'}
            </button>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={run} disabled={!html} className="chip"
            style={{
              gap: 4, padding: '4px 10px', fontSize: 11.5,
              background: html ? 'var(--acc)' : 'var(--bg3)',
              color: html ? '#fff' : 'var(--tx3)',
              borderColor: html ? 'var(--acc)' : 'var(--bd2)',
            }}
          >
            {running ? <RefreshCw size={11} /> : <Play size={11} fill={html ? '#fff' : 'var(--tx3)'} />}
            {running ? 'Reload' : 'Run'}
          </button>
          <button
            onClick={() => html && openFullscreen(kind, html, ctx)}
            disabled={!html} className="chip"
            style={{ gap: 4, padding: '4px 10px', fontSize: 11.5, opacity: html ? 1 : 0.5 }}
            title="Open full-screen in a new tab"
          >
            <Maximize2 size={11} /> Fullscreen
          </button>
        </div>
      </div>

      {/* Run performance — real load time, payload size & DOM weight */}
      {running && html && perf && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 14, padding: '5px 12px',
          borderBottom: '1px solid var(--bd)', fontSize: 11, color: 'var(--tx2)', flexWrap: 'wrap',
        }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 600,
            color: perf.ms < 400 ? 'var(--ok)' : perf.ms < 1200 ? 'var(--warn)' : 'var(--bad)' }}>
            <Zap size={11} /> {perf.ms < 400 ? 'Fast' : perf.ms < 1200 ? 'OK' : 'Heavy'}
          </span>
          <span>{perf.ms} ms load</span>
          <span>{perf.kb} KB</span>
          <span>{perf.nodes.toLocaleString()} DOM nodes</span>
        </div>
      )}

      {/* Stage — light gradient by default, dark gradient under dark mode.
          Desktop fills the box edge-to-edge; phone/tablet float as scaled devices. */}
      <div className="cloud-stage" style={{
        flex: 1, position: 'relative', overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 480, padding: device === 'desktop' && running && html ? 0 : 18,
      }}>
        {running && html ? (
          device === 'desktop' ? (
            <div style={{ width: '100%', height: '100%', background: '#fff', overflow: 'hidden' }}>
              <iframe
                key={`desktop-${html.length}`}
                srcDoc={composeRuntime(kind, html, ctx)}
                sandbox="allow-scripts allow-pointer-lock allow-same-origin"
                onLoad={measure}
                style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                title={`${title} preview`}
              />
            </div>
          ) : (
            <div style={{ position: 'relative', width: frame.w * frame.scale, height: frame.h * frame.scale, flexShrink: 0 }}>
              <div className="device-float" style={{
                position: 'absolute', inset: 0, background: '#fff',
                borderRadius: frame.radius, overflow: 'hidden',
              }}>
                <iframe
                  key={`${device}-${landscape}-${html.length}`}
                  srcDoc={composeRuntime(kind, html, ctx)}
                  sandbox="allow-scripts allow-pointer-lock allow-same-origin"
                  onLoad={measure}
                  style={{
                    width: frame.w, height: frame.h, border: 'none', display: 'block',
                    transform: `scale(${frame.scale})`, transformOrigin: 'top left',
                  }}
                  title={`${title} preview`}
                />
              </div>
            </div>
          )
        ) : (
          <div className="device-float" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, color: 'var(--tx3)', fontSize: 13, textAlign: 'center',
            background: '#fff', borderRadius: 14, padding: '34px 44px',
          }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', background: 'var(--acc-soft)', display: 'grid', placeItems: 'center', color: 'var(--acc)' }}>
              <Play size={22} strokeWidth={1.5} fill="currentColor" />
            </div>
            <span style={{ color: '#71717a' }}>{html ? 'Press Run to launch the preview' : 'Paste code, then press Run'}</span>
          </div>
        )}
      </div>

      <div style={{ padding: '7px 12px', fontSize: 11, color: 'var(--tx3)', borderTop: '1px solid var(--bd)', textAlign: 'center' }}>
        {running
          ? `Live · ${circle ? circle.name : 'public'} · ${device}${device === 'tablet' ? ` ${landscape ? 'landscape' : 'portrait'}` : ''} · real ${kind === 'game' ? 'CircleGame' : 'CircleApp'} SDK injected`
          : 'Preview sandboxed · Fullscreen opens a real, playable tab'}
      </div>
    </div>
  )
}
