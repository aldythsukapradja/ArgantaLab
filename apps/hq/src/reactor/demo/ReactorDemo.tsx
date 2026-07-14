import { useState } from 'react'
import { CoreSlot } from '../CoreSlot'
import { useMockDirector } from '../mockDirector'
import { CORE_STATES, type CoreState, type RendererId } from '../contract'

// ─────────────────────────────────────────────────────────────────────────
// ReactorDemo — founder-only harness at ?reactor-demo.
//
// Drives CoreSlot from the mock Director so the whole Act I→VII cinema plays
// against every semantic state, before WS1 exists. Toggle renderer, pin a
// state, scrub speed, force reduced motion. This is where the reactor is
// reviewed and iterated in isolation from the shell.
// ─────────────────────────────────────────────────────────────────────────

const PANEL: React.CSSProperties = {
  position: 'absolute', zIndex: 10, background: 'rgba(4,12,18,.72)',
  border: '1px solid rgba(132,220,255,.18)', borderRadius: 14, padding: 12,
  backdropFilter: 'blur(14px)', color: '#e9faff', font: '11px/1.5 Inter, system-ui, sans-serif',
}
const btn = (active: boolean): React.CSSProperties => ({
  border: `1px solid ${active ? 'rgba(112,231,255,.6)' : 'rgba(132,220,255,.2)'}`,
  background: active ? 'rgba(29,164,218,.35)' : 'rgba(6,17,26,.6)',
  color: '#e9faff', borderRadius: 9, padding: '6px 10px', cursor: 'pointer',
  font: '11px Inter, system-ui, sans-serif', textTransform: 'capitalize',
})

export function ReactorDemo() {
  const [renderer, setRenderer] = useState<RendererId>('r3f')
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState(1)
  const [override, setOverride] = useState<CoreState | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)
  const scene = useMockDirector({ speed, paused, override, reducedMotion })

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'radial-gradient(circle at 50% 42%,#0b2030 0,#06121b 32%,#02060a 72%,#010204 100%)', overflow: 'hidden' }}>
      <CoreSlot renderer={renderer} state={scene}
        onSelectProduct={id => console.log('reactor select', id)}
        onHoverProduct={() => {}} />

      {/* left: live SceneState readout */}
      <div style={{ ...PANEL, top: 16, left: 16, width: 220 }}>
        <div style={{ letterSpacing: '.16em', textTransform: 'uppercase', opacity: 0.7, fontSize: 9, marginBottom: 8 }}>Scene state</div>
        <div style={{ fontSize: 22, fontWeight: 650, letterSpacing: '-.02em' }}>{scene.state}</div>
        <div style={{ marginTop: 8, display: 'grid', gap: 4, opacity: 0.85 }}>
          <div>scene <b>{scene.sceneId ?? '—'}</b> · {scene.choreography}</div>
          <div>speaker {scene.speaker ?? '—'} · signal {scene.signal}</div>
          <div>focus {scene.focusProduct ?? '—'}</div>
          <div style={{ marginTop: 4 }}>intensity</div>
          <div style={{ height: 4, background: 'rgba(255,255,255,.08)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${scene.intensity * 100}%`, background: 'linear-gradient(90deg,#1597ff,#70e7ff)' }} />
          </div>
        </div>
      </div>

      {/* right: renderer + transport */}
      <div style={{ ...PANEL, top: 16, right: 16, width: 176, display: 'grid', gap: 8 }}>
        <div style={{ letterSpacing: '.16em', textTransform: 'uppercase', opacity: 0.7, fontSize: 9 }}>Renderer</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['r3f', '2d', 'media'] as RendererId[]).map(r => (
            <button key={r} style={btn(renderer === r)} onClick={() => setRenderer(r)}>{r}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
          <button style={btn(paused)} onClick={() => setPaused(p => !p)}>{paused ? 'play' : 'pause'}</button>
          <button style={btn(reducedMotion)} onClick={() => setReducedMotion(m => !m)}>reduced</button>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ opacity: 0.7 }}>speed</span>
          {[0.5, 1, 2].map(s => <button key={s} style={btn(speed === s)} onClick={() => setSpeed(s)}>{s}×</button>)}
        </div>
      </div>

      {/* bottom: state override rail */}
      <div style={{ ...PANEL, bottom: 16, left: '50%', transform: 'translateX(-50%)', maxWidth: 'calc(100vw - 32px)', display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center' }}>
        <button style={btn(override === null)} onClick={() => setOverride(null)}>auto tour</button>
        {CORE_STATES.map(s => (
          <button key={s} style={btn(override === s)} onClick={() => setOverride(s)}>{s}</button>
        ))}
      </div>
    </div>
  )
}
