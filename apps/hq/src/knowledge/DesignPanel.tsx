// Knowledge Canvas — the Design Studio. A sliding glass panel that gives the
// founder maximum control over the 3D creative space: which FORM the knowledge
// takes, how far it spreads, neuron size/glow, sparkle look, how it's coloured
// (palette presets + per-region pickers), and atmosphere. Every control writes
// straight to useDesign, which the scene reads live — so tweaks are instant and
// the whole thing persists across reloads.

import { Sparkles, RotateCcw, Shuffle, X } from 'lucide-react'
import { REGIONS } from './brain'
import {
  useDesign, FORMS, PALETTES,
  type FormId, type ColorBy, type PaletteId, type Background,
} from './design'

interface UI { glass: string; border: string; tx: string; tx2: string; tx3: string; panel: string }

export function DesignPanel({ open, onClose, ui, dark, compact = false }: { open: boolean; onClose: () => void; ui: UI; dark: boolean; compact?: boolean }) {
  const d = useDesign()
  if (!open) return null
  // On a phone the studio docks as a bottom sheet (full width, capped height)
  // instead of a right-side rail that would eat the whole viewport.
  const shell: React.CSSProperties = compact
    ? { position: 'absolute', left: 8, right: 8, bottom: 8, maxHeight: '68%', zIndex: 30,
        background: ui.panel, border: '1px solid ' + ui.border, borderRadius: 16, backdropFilter: 'blur(16px)',
        boxShadow: '0 20px 60px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', pointerEvents: 'auto', overflow: 'hidden' }
    : { position: 'absolute', top: 12, right: 12, bottom: 12, width: 296, zIndex: 30,
        background: ui.panel, border: '1px solid ' + ui.border, borderRadius: 16, backdropFilter: 'blur(16px)',
        boxShadow: '0 20px 60px rgba(0,0,0,.5)', display: 'flex', flexDirection: 'column', pointerEvents: 'auto', overflow: 'hidden' }
  return (
    <div style={shell}>
      {/* header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '13px 14px', borderBottom: '1px solid ' + ui.border }}>
        <Sparkles size={15} color="#c4b5fd" />
        <div style={{ fontSize: 13, fontWeight: 800, color: ui.tx, letterSpacing: 0.3, flex: 1 }}>Design Studio</div>
        <button onClick={() => d.randomize()} title="Surprise me" style={iconBtn(ui)}><Shuffle size={13} /></button>
        <button onClick={() => d.reset()} title="Reset to default brain" style={iconBtn(ui)}><RotateCcw size={13} /></button>
        <button onClick={onClose} title="Close" style={iconBtn(ui)}><X size={14} /></button>
      </div>

      <div style={{ overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* FORM */}
        <Section title="Shape" ui={ui}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {FORMS.map((f) => (
              <button key={f.id} title={f.hint} onClick={() => d.set('form', f.id as FormId)}
                style={{
                  padding: '9px 8px', borderRadius: 10, cursor: 'pointer', fontSize: 11.5, fontWeight: 700, textAlign: 'left',
                  border: '1px solid ' + (d.form === f.id ? '#8b7cf6' : ui.border),
                  background: d.form === f.id ? '#8b7cf626' : ui.glass, color: d.form === f.id ? (dark ? '#c4b5fd' : '#6d28d9') : ui.tx3,
                }}>{f.label}</button>
            ))}
          </div>
        </Section>

        {/* SPACE */}
        <Section title="Space" ui={ui}>
          <Slider label="Spread" value={d.spread} min={0.5} max={2.2} step={0.02} onChange={(v) => d.set('spread', v)} ui={ui} />
          <Slider label="Vertical" value={d.squash} min={0.3} max={1.4} step={0.02} onChange={(v) => d.set('squash', v)} ui={ui} />
          <Slider label="Region gap" value={d.separation} min={0.4} max={2} step={0.02} onChange={(v) => d.set('separation', v)} ui={ui} />
        </Section>

        {/* NEURONS */}
        <Section title="Neurons" ui={ui}>
          <Slider label="Size" value={d.neuronSize} min={0.5} max={2.5} step={0.02} onChange={(v) => d.set('neuronSize', v)} ui={ui} />
          <Slider label="Glow" value={d.glow} min={0.4} max={2} step={0.02} onChange={(v) => d.set('glow', v)} ui={ui} />
          {d.form === 'brain' && <>
            <Slider label="Sparkle density" value={d.sparkleDensity} min={0} max={1.4} step={0.02} onChange={(v) => d.set('sparkleDensity', v)} ui={ui} />
            <Slider label="Sparkle size" value={d.sparkleSize} min={0.4} max={2} step={0.02} onChange={(v) => d.set('sparkleSize', v)} ui={ui} />
          </>}
        </Section>

        {/* COLOUR */}
        <Section title="Colour" ui={ui}>
          <Row label="Colour by" ui={ui}>
            <Segmented value={d.colorBy} options={[['region', 'Region'], ['triad', 'Triad'], ['provenance', 'Source'], ['uniform', 'Uniform']]}
              onChange={(v) => d.set('colorBy', v as ColorBy)} ui={ui} />
          </Row>
          <Row label="Palette" ui={ui}>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {(Object.keys(PALETTES) as PaletteId[]).map((p) => (
                <button key={p} title={PALETTES[p].label} onClick={() => d.applyPalette(p)}
                  style={{ display: 'flex', gap: 2, padding: 3, borderRadius: 8, cursor: 'pointer', border: '1px solid ' + (d.palette === p ? '#8b7cf6' : ui.border), background: ui.glass }}>
                  {REGIONS.slice(0, 4).map((r) => <span key={r.id} style={{ width: 8, height: 14, borderRadius: 2, background: PALETTES[p].colors[r.id] }} />)}
                </button>
              ))}
            </div>
          </Row>
          {d.colorBy === 'region' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 4 }}>
              {REGIONS.map((r) => (
                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, color: ui.tx3, cursor: 'pointer' }}>
                  <input type="color" value={d.regionColors[r.id]} onChange={(e) => d.setRegionColor(r.id, e.target.value)}
                    style={{ width: 20, height: 20, padding: 0, border: 'none', borderRadius: 5, background: 'none', cursor: 'pointer' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                </label>
              ))}
            </div>
          )}
        </Section>

        {/* ATMOSPHERE */}
        <Section title="Atmosphere" ui={ui}>
          <Slider label="Bloom" value={d.bloom} min={0} max={2} step={0.02} onChange={(v) => d.set('bloom', v)} ui={ui} />
          <Slider label="Edges" value={d.edgeOpacity} min={0} max={2} step={0.02} onChange={(v) => d.set('edgeOpacity', v)} ui={ui} />
          <Row label="Background" ui={ui}>
            <Segmented value={d.background} options={[['void', 'Void'], ['nebula', 'Nebula'], ['grid', 'Grid']]}
              onChange={(v) => d.set('background', v as Background)} ui={ui} />
          </Row>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11.5, color: ui.tx3, cursor: 'pointer', marginTop: 2 }}>
            <input type="checkbox" checked={d.showLabels} onChange={(e) => d.set('showLabels', e.target.checked)} /> Region labels
          </label>
        </Section>
      </div>
    </div>
  )
}

function Section({ title, children, ui }: { title: string; children: React.ReactNode; ui: UI }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 1, color: ui.tx2, textTransform: 'uppercase' }}>{title}</div>
      {children}
    </div>
  )
}
function Row({ label, children, ui }: { label: string; children: React.ReactNode; ui: UI }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ fontSize: 11, color: ui.tx3 }}>{label}</span>
      {children}
    </div>
  )
}
function Slider({ label, value, min, max, step, onChange, ui }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; ui: UI }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: ui.tx3 }}>
        <span>{label}</span><span style={{ color: ui.tx2, fontVariantNumeric: 'tabular-nums' }}>{value.toFixed(2)}</span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', accentColor: '#8b7cf6', cursor: 'pointer' }} />
    </div>
  )
}
function Segmented({ value, options, onChange, ui }: { value: string; options: [string, string][]; onChange: (v: string) => void; ui: UI }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
      {options.map(([v, lbl]) => (
        <button key={v} onClick={() => onChange(v)}
          style={{ padding: '4px 10px', borderRadius: 999, cursor: 'pointer', fontSize: 11, fontWeight: 600, border: '1px solid ' + (value === v ? '#8b7cf6' : ui.border), background: value === v ? '#8b7cf626' : ui.glass, color: value === v ? '#c4b5fd' : ui.tx3 }}>
          {lbl}
        </button>
      ))}
    </div>
  )
}
function iconBtn(ui: UI): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26, borderRadius: 8, border: '1px solid ' + ui.border, background: ui.glass, color: ui.tx3, cursor: 'pointer' }
}
