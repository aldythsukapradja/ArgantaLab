import { useMemo, useState } from 'react'

// A device-accurate preview. Wraps the game in a desktop / iPad / iPhone
// shell at real proportions and tells the game which control scheme to use
// by injecting window.ARGANTA_DEVICE before the game's own code runs.

type Device = 'desktop' | 'ipad' | 'iphone'
const SIZES: Record<Device, { w: number; h: number; label: string; emoji: string }> = {
  desktop: { w: 1280, h: 760, label: 'Desktop', emoji: '🖥️' },
  ipad: { w: 820, h: 1120, label: 'iPad', emoji: '📱' },
  iphone: { w: 390, h: 844, label: 'iPhone', emoji: '📲' },
}

function inject(html: string, device: Device): string {
  const tag = `<script>window.ARGANTA_DEVICE=${JSON.stringify(device)};</script>`
  // Put the flag first so the game reads it on load.
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head[^>]*>/i, m => m + tag)
  if (/<html[^>]*>/i.test(html)) return html.replace(/<html[^>]*>/i, m => m + tag)
  return tag + html
}

export default function DeviceFrame({ html, onRestartKey }: { html: string; onRestartKey?: number }) {
  const [device, setDevice] = useState<Device>('iphone')
  const [reloadKey, setReloadKey] = useState(0)
  const s = SIZES[device]
  const srcDoc = useMemo(() => inject(html, device), [html, device])
  const key = `${device}-${reloadKey}-${onRestartKey ?? 0}`

  return (
    <div className="dv">
      <div className="dv-switch">
        {(Object.keys(SIZES) as Device[]).map(d => (
          <button key={d} className={`dv-tab${device === d ? ' on' : ''}`} onClick={() => setDevice(d)}>
            <span>{SIZES[d].emoji}</span>{SIZES[d].label}
          </button>
        ))}
        <span className="dv-sp" />
        <button className="dv-reload" onClick={() => setReloadKey(k => k + 1)} title="Restart game">↺</button>
      </div>

      <div className={`dv-stage dv-${device}`}>
        <div className="dv-shell" style={{ aspectRatio: `${s.w} / ${s.h}` }}>
          <iframe
            key={key}
            title="game preview"
            srcDoc={srcDoc}
            sandbox="allow-scripts allow-pointer-lock"
          />
        </div>
      </div>

      <p className="dv-hint">
        {device === 'desktop'
          ? '🖥️ On desktop your game uses the keyboard (arrow keys / space).'
          : '📲 On a phone or tablet your game shows big touch buttons.'}
      </p>
    </div>
  )
}
