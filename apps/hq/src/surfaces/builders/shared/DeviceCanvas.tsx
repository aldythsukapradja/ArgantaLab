import { type CSSProperties } from 'react'
import { Smartphone, Tablet, Monitor, Play, Maximize2, RefreshCw } from 'lucide-react'
import type { Circle } from '../../../data/live'
import { composeRuntime, openFullscreen, type Kind } from '../artifact'

export type DeviceMode = 'iphone' | 'tablet' | 'desktop'

const DEVICES: { mode: DeviceMode; Icon: typeof Smartphone; label: string }[] = [
  { mode: 'iphone', Icon: Smartphone, label: 'Phone' },
  { mode: 'tablet', Icon: Tablet, label: 'Tablet' },
  { mode: 'desktop', Icon: Monitor, label: 'Desktop' },
]

function frameStyle(device: DeviceMode): CSSProperties {
  switch (device) {
    case 'iphone':  return { width: 280, aspectRatio: '9 / 19.5' }
    case 'tablet':  return { width: 360, aspectRatio: '3 / 4' }
    case 'desktop': return { width: 520, aspectRatio: '16 / 9' }
  }
}

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
  const radius = device === 'iphone' ? 40 : device === 'tablet' ? 22 : 12

  return (
    <div className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            onClick={onRun} disabled={!html} className="chip"
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

      {/* Stage */}
      <div style={{
        flex: 1, background: '#05070f', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        minHeight: 480, padding: 18, gap: 14,
      }}>
        {running && html ? (
          <>
            <div style={{ position: 'relative', height: '100%', ...frameStyle(device) }}>
              <div style={{
                position: 'absolute', inset: 0, background: '#fff',
                borderRadius: radius, overflow: 'hidden',
                boxShadow: '0 22px 44px rgba(0,0,0,.45)', border: '1px solid rgba(255,255,255,.08)',
              }}>
                <iframe
                  key={`${device}-${html.length}`}
                  srcDoc={composeRuntime(kind, html, ctx)}
                  sandbox="allow-scripts allow-pointer-lock allow-same-origin"
                  style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
                  title={`${title} preview`}
                />
              </div>
            </div>

            {circle && (
              <div style={{
                display: 'flex', flexDirection: 'column', gap: 10, height: '100%',
                width: 168, overflowY: 'auto',
              }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: 'rgba(255,255,255,.4)', marginBottom: 6 }}>
                    AUDIENCE
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                    {circle.emoji} {circle.name}
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
                    {circle.members.length} {circle.members.length === 1 ? 'member' : 'members'}
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {circle.members.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                        background: m.avatar ? `url(${m.avatar})` : 'linear-gradient(135deg,#6366f1,#8b5cf6)',
                        backgroundSize: 'cover', backgroundPosition: 'center',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 600, fontSize: 11,
                      }}>
                        {!m.avatar && m.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.name}
                        </div>
                        <div style={{ fontSize: 10, color: 'rgba(255,255,255,.45)' }}>
                          {m.kind === 'parent' ? 'Parent' : 'Child'}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 10, color: 'rgba(255,255,255,.3)', fontSize: 13, textAlign: 'center',
          }}>
            <Play size={30} strokeWidth={1.5} />
            <span>{html ? 'Press Run to launch the preview' : 'Paste code, then press Run'}</span>
          </div>
        )}
      </div>

      <div style={{ padding: '7px 12px', fontSize: 11, color: 'var(--tx3)', borderTop: '1px solid var(--bd)', textAlign: 'center' }}>
        {running
          ? `Live · ${circle ? circle.name : 'mock SDK'} · ${device} · real ${kind === 'game' ? 'CircleGame' : 'CircleApp'} SDK injected`
          : 'Preview sandboxed · Fullscreen opens a real, playable tab'}
      </div>
    </div>
  )
}
