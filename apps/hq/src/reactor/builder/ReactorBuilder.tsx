import { useState } from 'react'
import { CoreR3F } from '../cores/CoreR3F'
import { useCinemaScenario, type CinemaFrame } from '../useCinemaScenario'
import { useQualityTier } from '../useQualityTier'
import { useReactorEditor } from './editorStore'
import { useHQ } from '../../shell/store'
import type { LayerMaterial } from '../model/layers'

// ─────────────────────────────────────────────────────────────────────────
// Reactor Builder — HQ Build-tab surface.
//
// Two modes: CINEMA plays the whole Act I→VII story (camera + explosion driven
// by the scenario, so you watch the flat emblem explode through the acts); EDIT
// hands you a pannable camera and the per-layer inspector to author every layer.
// Follows the HQ light/dark theme.
// ─────────────────────────────────────────────────────────────────────────

type Mode = 'cinema' | 'edit'

const MATERIALS: LayerMaterial[] = ['metal', 'glass', 'wire', 'glow']

function styles(dark: boolean) {
  return {
    // Flat field, matched to the canvas clear colour — no gradient border.
    surface: dark ? '#05090f' : '#eef3f9',
    card: {
      background: dark ? 'rgba(6,16,24,.82)' : 'rgba(255,255,255,.82)',
      border: `1px solid ${dark ? 'rgba(132,220,255,.16)' : 'rgba(20,60,100,.14)'}`,
      borderRadius: 12, backdropFilter: 'blur(14px)',
      color: dark ? '#e9faff' : '#16324c',
      font: '12px/1.5 Inter, system-ui, sans-serif',
      boxShadow: dark ? 'none' : '0 10px 40px rgba(30,60,100,.12)',
    } as React.CSSProperties,
    label: { fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: dark ? '#8eabb9' : '#5b7791' } as React.CSSProperties,
    chip: (active: boolean): React.CSSProperties => ({
      border: `1px solid ${active ? (dark ? 'rgba(112,231,255,.6)' : 'rgba(21,151,255,.55)') : (dark ? 'rgba(132,220,255,.2)' : 'rgba(20,60,100,.16)')}`,
      background: active ? (dark ? 'rgba(29,164,218,.35)' : 'rgba(21,151,255,.16)') : (dark ? 'rgba(6,17,26,.55)' : 'rgba(255,255,255,.6)'),
      color: dark ? '#e9faff' : '#16324c', borderRadius: 8, padding: '5px 9px', cursor: 'pointer',
      font: '11px Inter, system-ui, sans-serif', textTransform: 'capitalize',
    }),
  }
}

function LayerInspector({ dark }: { dark: boolean }) {
  const { layers, selectedLayerId, select, updateLayer, toggleVisible } = useReactorEditor()
  const s = styles(dark)
  const sel = layers.find(l => l.id === selectedLayerId)
  return (
    <div style={{ ...s.card, position: 'absolute', top: 16, left: 16, width: 250, maxHeight: 'calc(100% - 150px)', overflow: 'auto', padding: 12 }}>
      <div style={{ ...s.label, marginBottom: 8 }}>Layers · {layers.length}</div>
      {layers.map(l => (
        <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <button onClick={() => select(l.id === selectedLayerId ? null : l.id)}
            style={{ ...s.chip(l.id === selectedLayerId), flex: 1, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 7, opacity: l.visible ? 1 : 0.5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: l.color, flexShrink: 0 }} />
            {l.label}<span style={{ marginLeft: 'auto', opacity: 0.5, fontSize: 9, textTransform: 'none', fontStyle: 'italic' }}>{l.micro}</span>
          </button>
          <button onClick={() => toggleVisible(l.id)} title="toggle" style={{ ...s.chip(false), padding: '5px 7px' }}>{l.visible ? '👁' : '—'}</button>
        </div>
      ))}

      {sel && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${dark ? 'rgba(132,220,255,.12)' : 'rgba(20,60,100,.1)'}`, display: 'grid', gap: 10 }}>
          <div style={s.label}>Edit · {sel.label}</div>
          <label style={{ display: 'grid', gap: 4 }}><span style={s.label}>Color</span>
            <input type="color" value={sel.color} onChange={e => updateLayer(sel.id, { color: e.target.value })} style={{ width: '100%', height: 26, background: 'none', border: 'none' }} />
          </label>
          <div style={{ display: 'grid', gap: 4 }}><span style={s.label}>Material</span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {MATERIALS.map(m => <button key={m} style={s.chip(sel.material === m)} onClick={() => updateLayer(sel.id, { material: m })}>{m}</button>)}
            </div>
          </div>
          {([['radius', 0.3, 4, 0.05], ['zRest', -1, 1, 0.05], ['zExploded', -6, 6, 0.1], ['spin', -0.2, 0.2, 0.01]] as const).map(([key, min, max, step]) => (
            <label key={key} style={{ display: 'grid', gap: 3 }}>
              <span style={s.label}>{key} · {Number(sel[key]).toFixed(2)}</span>
              <input type="range" min={min} max={max} step={step} value={sel[key] as number}
                onChange={e => updateLayer(sel.id, { [key]: parseFloat(e.target.value) } as Record<string, number>)} />
            </label>
          ))}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={sel.wireframe} onChange={e => updateLayer(sel.id, { wireframe: e.target.checked })} />
            <span style={s.label}>Wireframe ghost</span>
          </label>
        </div>
      )}
    </div>
  )
}

const ACT_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

function ScenarioBar({ dark, frame, withAudio, setWithAudio }: {
  dark: boolean; frame: CinemaFrame; withAudio: boolean; setWithAudio: (v: boolean) => void
}) {
  const { manualExplosion, setManualExplosion, scenarioPlaying, setPlaying, scenarioSpeed, setSpeed } = useReactorEditor()
  const s = styles(dark)
  const manual = manualExplosion != null
  return (
    <div style={{ ...s.card, position: 'absolute', left: 16, right: 16, bottom: 16, padding: 14, display: 'grid', gap: 10 }}>
      {/* the live narration line — the story, read-only, all 46 scenes */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
        <span style={{ ...s.label, whiteSpace: 'nowrap' }}>Act {ACT_ROMAN[frame.act]} · {frame.index + 1}/{frame.total}</span>
        <span style={{ fontSize: 13, fontWeight: 650, whiteSpace: 'nowrap' }}>{frame.title}</span>
        <span style={{ fontSize: 12, opacity: 0.72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{frame.narration}</span>
      </div>
      {/* progress across the whole 46-scene run */}
      <div style={{ height: 3, borderRadius: 3, background: dark ? 'rgba(255,255,255,.08)' : 'rgba(20,60,100,.1)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${((frame.index + frame.scene.sceneTime) / frame.total) * 100}%`, background: 'linear-gradient(90deg,#1c72e6,#70e7ff)', transition: 'width .2s' }} />
      </div>
      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button style={s.chip(scenarioPlaying)} onClick={() => setPlaying(!scenarioPlaying)}>{scenarioPlaying ? 'Pause' : 'Play'}</button>
          {[0.5, 1, 2].map(x => <button key={x} style={s.chip(scenarioSpeed === x)} onClick={() => setSpeed(x)}>{x}×</button>)}
          <button style={s.chip(withAudio)} onClick={() => setWithAudio(!withAudio)}>{withAudio ? 'Narration on' : 'Narration off'}</button>
        </div>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={s.label}>Explosion {manual ? '· manual' : '· scenario'}</span>
            <button style={s.chip(manual)} onClick={() => setManualExplosion(manual ? null : 0.5)}>{manual ? 'back to scenario' : 'scrub by hand'}</button>
          </div>
          <input type="range" min={0} max={1} step={0.01} disabled={!manual} value={manualExplosion ?? 0}
            onChange={e => setManualExplosion(parseFloat(e.target.value))} style={{ width: '100%', opacity: manual ? 1 : 0.4 }} />
        </div>
      </div>
    </div>
  )
}

export function ReactorBuilder() {
  const tier = useQualityTier()
  const dark = useHQ(st => st.theme === 'dark')
  const [mode, setMode] = useState<Mode>('cinema')
  const [withAudio, setWithAudio] = useState(false)
  const { layers, selectedLayerId, manualExplosion, scenarioPlaying, scenarioSpeed } = useReactorEditor()
  const frame = useCinemaScenario({ playing: scenarioPlaying, speed: scenarioSpeed, withAudio })
  const scene = frame.scene
  const s = styles(dark)

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', background: s.surface, overflow: 'hidden' }}>
      {/* CINEMA locks the camera to the scenario; EDIT hands it to the founder. */}
      <CoreR3F scene={scene} tier={tier} layers={layers} dark={dark}
        interactive={mode === 'edit'} manualExplosion={manualExplosion}
        selectedLayerId={mode === 'edit' ? selectedLayerId : null} />

      <div style={{ ...s.card, position: 'absolute', top: 16, right: 16, padding: 14, width: 236 }}>
        {/* premium segmented control — no emoji */}
        <div style={{ display: 'flex', padding: 3, borderRadius: 10, gap: 3,
          background: dark ? 'rgba(255,255,255,.04)' : 'rgba(20,60,100,.06)',
          border: `1px solid ${dark ? 'rgba(132,220,255,.12)' : 'rgba(20,60,100,.1)'}` }}>
          {(['cinema', 'edit'] as Mode[]).map(m => {
            const on = mode === m
            return (
              <button key={m} onClick={() => setMode(m)} style={{
                flex: 1, border: 'none', cursor: 'pointer', borderRadius: 8, padding: '7px 0',
                font: '600 12px Inter, system-ui, sans-serif', letterSpacing: '.02em',
                textTransform: 'capitalize',
                color: on ? (dark ? '#03121c' : '#fff') : (dark ? '#cfeaf6' : '#3a5570'),
                background: on ? (dark ? 'linear-gradient(180deg,#7fe8ff,#3fb8e6)' : 'linear-gradient(180deg,#2b93ff,#1c72e6)') : 'transparent',
                boxShadow: on ? '0 4px 14px rgba(31,140,230,.28)' : 'none', transition: 'all .18s',
              }}>{m === 'cinema' ? 'Cinema' : 'Edit'}</button>
            )
          })}
        </div>
        <div style={{ fontSize: 11, lineHeight: 1.5, opacity: 0.72, marginTop: 10 }}>
          {mode === 'cinema'
            ? 'Playing the full narration — camera and explosion follow the scenario.'
            : 'Drag to orbit · right-drag to pan · scroll to zoom. Edits drive the live cinema.'}
        </div>
      </div>

      {mode === 'edit' && <LayerInspector dark={dark} />}
      <ScenarioBar dark={dark} frame={frame} withAudio={withAudio} setWithAudio={setWithAudio} />
    </div>
  )
}
