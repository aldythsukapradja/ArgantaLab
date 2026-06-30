import { useMemo, useState } from 'react'
import { injectCircle, circleCtx } from '@lib/circleBridge'

// A device-accurate preview, modelled on Circle HQ's DeviceCanvas. Phone and
// tablet render at real logical resolution and are scaled to fit, so the preview
// reflects the true device breakpoint; desktop fills the stage. It injects
// window.ARGANTA_DEVICE before the game's own code runs, plus the Circle Game
// SDK (mock in previews, live when a gameId is given).

type Device = 'desktop' | 'ipad' | 'iphone'

// real logical resolution + the scale we draw the floating device at
const PHONE = { w: 390, h: 844, scale: 0.62, radius: 34, border: 10 }
const TABLET = { w: 820, h: 1112, scale: 0.42, radius: 22, border: 8 }

const META: Record<Device, { label: string; emoji: string; flag: string }> = {
  desktop: { label: 'Desktop', emoji: '🖥️', flag: 'desktop' },
  ipad: { label: 'Tablet', emoji: '📱', flag: 'ipad' },
  iphone: { label: 'Phone', emoji: '📲', flag: 'iphone' },
}

function inject(html: string, device: Device, gameId?: string): string {
  const tag = `<script>window.ARGANTA_DEVICE=${JSON.stringify(device)};</script>`
  // Device flag first, then the Circle SDK (live only when a real gameId is set).
  const base = circleCtx(gameId || 'preview')
  const withSdk = injectCircle(html, { ...base, live: base.live && !!gameId })
  if (/<head[^>]*>/i.test(withSdk)) return withSdk.replace(/<head[^>]*>/i, m => m + tag)
  if (/<html[^>]*>/i.test(withSdk)) return withSdk.replace(/<html[^>]*>/i, m => m + tag)
  return tag + withSdk
}

export default function DeviceFrame({ html, onRestartKey, gameId }: { html: string; onRestartKey?: number; gameId?: string }) {
  const [device, setDevice] = useState<Device>('iphone')
  const [landscape, setLandscape] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const srcDoc = useMemo(() => inject(html, device, gameId), [html, device, gameId])
  const key = `${device}-${landscape}-${reloadKey}-${onRestartKey ?? 0}`

  // tablet can rotate; phone stays portrait; desktop fills the stage
  const base = device === 'iphone' ? PHONE : TABLET
  const frame = device === 'ipad' && landscape
    ? { ...base, w: base.h, h: base.w }
    : base

  const openFullscreen = () => {
    const w = window.open('', '_blank')
    if (w) { w.document.open(); w.document.write(srcDoc); w.document.close() }
  }

  return (
    <div className="dv">
      <div className="dv-switch">
        {(Object.keys(META) as Device[]).map(d => (
          <button key={d} className={`dv-tab${device === d ? ' on' : ''}`} onClick={() => setDevice(d)}>
            <span>{META[d].emoji}</span>{META[d].label}
          </button>
        ))}
        {device === 'ipad' && (
          <button className="dv-tab" onClick={() => setLandscape(l => !l)} title="Rotate tablet">
            ⟳ {landscape ? 'Landscape' : 'Portrait'}
          </button>
        )}
        <span className="dv-sp" />
        <button className="dv-icon" onClick={() => setReloadKey(k => k + 1)} title="Restart">↺</button>
        <button className="dv-icon" onClick={openFullscreen} title="Open full-screen in a new tab">⛶</button>
      </div>

      <div className={`dv-stage dv-${device}`}>
        {device === 'desktop' ? (
          <div className="dv-shell" style={{ aspectRatio: `${1280} / ${760}` }}>
            <iframe key={key} title="game preview" srcDoc={srcDoc} sandbox="allow-scripts allow-pointer-lock" />
          </div>
        ) : (
          // real-resolution device, scaled to fit (HQ DeviceCanvas approach)
          <div className="dv-float" style={{ width: frame.w * frame.scale, height: frame.h * frame.scale }}>
            <div className="dv-bezel" style={{ borderRadius: frame.radius, borderWidth: frame.border }}>
              <iframe
                key={key}
                title="game preview"
                srcDoc={srcDoc}
                sandbox="allow-scripts allow-pointer-lock"
                style={{ width: frame.w, height: frame.h, transform: `scale(${frame.scale})`, transformOrigin: 'top left' }}
              />
            </div>
          </div>
        )}
      </div>

      <p className="dv-hint">
        {device === 'desktop'
          ? '🖥️ On desktop your game uses the keyboard (arrow keys / space).'
          : '📲 On a phone or tablet your game shows big touch buttons.'}
      </p>
    </div>
  )
}
