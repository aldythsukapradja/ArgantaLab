// GB-3 · The Forge canvas — a live, device-framed preview of the current
// artifact. Ports the legacy DeviceCanvas's proven parts (real logical device
// resolutions scaled to fit, the sandboxed iframe, composeRuntime's SDK
// injection, fullscreen via Blob URL) into the fixed-height Forge grid, and
// drops what the Forge doesn't need (the Run button — the canvas is always
// live here; the perf strip — that's Analytics' job, not the build loop's).
//
// GAME FOCUS (GB-3 gotcha): a game iframe must own the keyboard, or arrow keys
// scroll the host instead of moving the player. The frame is focused on load
// and on click for kind:'game', and the stage swallows arrow/space keydowns
// while a game is live and focused.
import { useEffect, useRef } from 'react'
import { Smartphone, Tablet, Monitor, Maximize2, RotateCw, RefreshCw } from 'lucide-react'
import { composeRuntime, openFullscreen } from '../builders/artifact'
import { legacyKindFor } from './forgeConfig'
import type { ArtifactKind } from '../../builder-core/generate'
import type { Circle } from '../../data/live'

export type DeviceMode = 'phone' | 'tablet' | 'desktop'

const DEVICES: { mode: DeviceMode; Icon: typeof Smartphone; label: string }[] = [
  { mode: 'phone', Icon: Smartphone, label: 'Phone' },
  { mode: 'tablet', Icon: Tablet, label: 'Tablet' },
  { mode: 'desktop', Icon: Monitor, label: 'Desktop' },
]

const PHONE = { w: 390, h: 844, radius: 40 }
const TABLET = { w: 834, h: 1112, radius: 18 }

interface Props {
  kind: ArtifactKind
  title: string
  html: string
  device: DeviceMode
  landscape: boolean
  onDevice: (d: DeviceMode) => void
  onLandscape: (v: boolean) => void
  circle: Circle | null
  user: { id: string; name: string; avatar?: string }
  /** Bumped by the parent to force a remount (Reload). */
  nonce: number
  onReload: () => void
}

export function ForgeCanvas({ kind, title, html, device, landscape, onDevice, onLandscape, circle, user, nonce, onReload }: Props) {
  const stageRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const ctx = { user, circle }
  const isGame = kind === 'game'

  // Scale the device to fit whatever height the grid gives us — the Forge is a
  // fixed page, so the frame must adapt to the pane rather than the page
  // growing to fit the frame.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage || device === 'desktop') return
    const base = device === 'phone' ? PHONE : landscape ? { w: TABLET.h, h: TABLET.w } : TABLET
    const fit = () => {
      const pad = 28
      const sx = (stage.clientWidth - pad) / base.w
      const sy = (stage.clientHeight - pad) / base.h
      const scale = Math.max(0.2, Math.min(sx, sy, 1))
      stage.style.setProperty('--forge-scale', String(scale))
      stage.style.setProperty('--forge-w', `${base.w * scale}px`)
      stage.style.setProperty('--forge-h', `${base.h * scale}px`)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [device, landscape, html])

  // Games need the keyboard. Focus the frame once it's loaded so WASD/arrows
  // reach the game and not the host page.
  const focusGame = () => { if (isGame) frameRef.current?.contentWindow?.focus() }

  const frame = device === 'phone' ? PHONE : landscape ? { w: TABLET.h, h: TABLET.w, radius: TABLET.radius } : TABLET
  const doc = html ? composeRuntime(legacyKindFor(kind), html, ctx) : ''

  return (
    <div className="forge-canvas">
      <div className="forge-canvas-bar">
        <div className="forge-seg">
          {DEVICES.map(({ mode, Icon, label }) => (
            <button key={mode} className={device === mode ? 'on' : ''} onClick={() => onDevice(mode)} title={`Preview at ${label.toLowerCase()} size`}>
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <div className="row" style={{ gap: 6 }}>
          {device === 'tablet' && (
            <button className="forge-btn" onClick={() => onLandscape(!landscape)} title="Rotate the tablet">
              <RotateCw size={12} /> {landscape ? 'Landscape' : 'Portrait'}
            </button>
          )}
          <button className="forge-btn" onClick={onReload} disabled={!html} title="Reload the preview">
            <RefreshCw size={12} /> Reload
          </button>
          <button
            className="forge-btn"
            onClick={() => html && openFullscreen(legacyKindFor(kind), html, ctx)}
            disabled={!html}
            title={isGame ? 'Play full-screen in a new tab' : 'Open full-screen in a new tab'}
          >
            <Maximize2 size={12} /> {isGame ? 'Play' : 'Fullscreen'}
          </button>
        </div>
      </div>

      <div ref={stageRef} className={'forge-stage' + (device === 'desktop' ? ' flush' : '')}>
        {html ? (
          device === 'desktop' ? (
            <div className="forge-frame desktop">
              <iframe
                ref={frameRef}
                key={`desktop-${nonce}`}
                srcDoc={doc}
                sandbox="allow-scripts allow-pointer-lock allow-same-origin"
                onLoad={focusGame}
                onClick={focusGame}
                style={{ width: '100%', height: '100%' }}
                title={`${title || 'Artifact'} preview`}
              />
            </div>
          ) : (
            <div
              className="forge-frame"
              style={{ width: 'var(--forge-w)', height: 'var(--forge-h)', borderRadius: frame.radius }}
            >
              <iframe
                ref={frameRef}
                key={`${device}-${landscape}-${nonce}`}
                srcDoc={doc}
                sandbox="allow-scripts allow-pointer-lock allow-same-origin"
                onLoad={focusGame}
                onClick={focusGame}
                style={{
                  width: frame.w, height: frame.h,
                  transform: 'scale(var(--forge-scale, 1))',
                  transformOrigin: 'top left',
                }}
                title={`${title || 'Artifact'} preview`}
              />
            </div>
          )
        ) : (
          <div className="forge-empty-stage">
            <span>Nothing on the canvas yet.</span>
          </div>
        )}
      </div>
    </div>
  )
}
