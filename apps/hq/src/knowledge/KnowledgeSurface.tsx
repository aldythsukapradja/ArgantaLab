// WS3 — the Cognitive Cortex surface. A read-only brain-shaped digital twin over
// the REAL vault: left hemisphere analytic, right creative, front→back THINK ·
// KNOW · DO, animated by a cognition simulation. Additive + read-only — clicking
// a neuron opens the real note in the 2D Vault. WebGL-fallback to the 2D graph.

import { Suspense, useEffect, useMemo } from 'react'
import { Brain, ExternalLink, X, AlertTriangle, Activity, Play } from 'lucide-react'
import { useVault } from '../vault/store'
import { useHQ } from '../shell/store'
import { GraphViewV3 } from '../vault/components/GraphViewV3'
import '../vault/vault.css'
import { buildKnowledgeModel } from './model'
import { KnowledgeScene } from './KnowledgeScene'
import { useKnowledge } from './store'
import { neuronCloud, COGNITION_COLOR, COGNITION_LABEL, COGNITION_HINT, type Cognition } from './brain'
import { ONTOLOGY_COLOR } from './ontology'
import { PROVENANCE_META } from './provenance'

function hasWebGL(): boolean {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) } catch { return false }
}

const COGS: Cognition[] = ['think', 'know', 'do']

export function KnowledgeSurface() {
  const notes = useVault((s) => s.notes)
  const go = useHQ((s) => s.go)
  const webgl = useMemo(hasWebGL, [])

  const model = useMemo(() => buildKnowledgeModel(notes), [notes])
  const cloud = useMemo(() => neuronCloud(6500), [])

  const selected = useKnowledge((s) => s.selected)
  const setSelected = useKnowledge((s) => s.setSelected)
  const cogFilter = useKnowledge((s) => s.cogFilter)
  const setCogFilter = useKnowledge((s) => s.setCogFilter)
  const hemiFilter = useKnowledge((s) => s.hemiFilter)
  const setHemiFilter = useKnowledge((s) => s.setHemiFilter)
  const simRunning = useKnowledge((s) => s.simRunning)
  const setSim = useKnowledge((s) => s.setSim)

  const selNode = selected ? model.byId.get(selected) : null

  // R3F measures its parent on mount; a lazy Suspense boundary can read 0×0 for
  // the first frame. Nudge a resize once mounted so the canvas fills. Timers (not
  // rAF) so it fires even before the tab is first painted.
  useEffect(() => {
    const t1 = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 60)
    const t2 = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 300)
    const onVis = () => window.dispatchEvent(new Event('resize'))
    document.addEventListener('visibilitychange', onVis)
    return () => { clearTimeout(t1); clearTimeout(t2); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  const openRealNote = (noteId: string) => { useVault.getState().openNote(noteId); go('vault') }

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#04050d', overflow: 'hidden' }}>
      {webgl ? (
        <Suspense fallback={<Loading />}>
          <KnowledgeScene model={model} cloud={cloud} />
        </Suspense>
      ) : (
        <div className="vault" style={{ position: 'absolute', inset: 0 }}>
          <div style={banner}>WebGL unavailable — showing the 2D knowledge graph.</div>
          <div style={{ position: 'absolute', inset: '34px 0 0' }}><GraphViewV3 /></div>
        </div>
      )}

      {/* hemisphere labels — left analytic, right creative */}
      {webgl && (
        <>
          <SideLabel side="left" title="ANALYTIC" sub="left hemisphere · data · logic · structure"
            active={hemiFilter === 'left'} onClick={() => setHemiFilter(hemiFilter === 'left' ? null : 'left')} count={model.counts.left} />
          <SideLabel side="right" title="CREATIVE" sub="right hemisphere · product · narrative · design"
            active={hemiFilter === 'right'} onClick={() => setHemiFilter(hemiFilter === 'right' ? null : 'right')} count={model.counts.right} />
        </>
      )}

      {/* title + node count */}
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', alignItems: 'center', gap: 11, pointerEvents: 'none' }}>
        <div style={{ width: 32, height: 32, borderRadius: 9, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg,#8b7cf6,#38bdf8)', boxShadow: '0 0 20px #8b7cf699' }}>
          <Brain size={18} color="#fff" />
        </div>
        <div>
          <div style={{ fontSize: 14.5, fontWeight: 800, color: '#eef2ff', letterSpacing: 0.3 }}>Cognitive Cortex</div>
          <div style={{ fontSize: 10.5, color: '#8891b5', letterSpacing: 0.5 }}>{model.counts.total} REAL NEURONS · DIGITAL TWIN OF THE VAULT</div>
        </div>
      </div>

      {/* THINK · KNOW · DO triad + simulation control (top-center) */}
      {webgl && (
        <div style={{ position: 'absolute', top: 14, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 8, alignItems: 'center', pointerEvents: 'auto' }}>
          {COGS.map((c) => {
            const on = cogFilter === c
            const col = COGNITION_COLOR[c]
            const count = model.counts[c]
            return (
              <button key={c} title={COGNITION_HINT[c]} onClick={() => setCogFilter(on ? null : c)}
                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 14px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (on ? col : col + '44'), background: on ? col + '26' : 'rgba(8,10,22,.6)', color: on ? '#fff' : '#cdd5f0', backdropFilter: 'blur(10px)', fontWeight: 700, fontSize: 12, letterSpacing: 0.5 }}>
                <span style={{ width: 9, height: 9, borderRadius: 9, background: col, boxShadow: `0 0 8px ${col}` }} />
                {COGNITION_LABEL[c]}
                <span style={{ fontSize: 10.5, opacity: 0.6, fontWeight: 500 }}>{count}</span>
              </button>
            )
          })}
          <button onClick={() => setSim(!simRunning)} title="Cognition simulation: a THINK→KNOW→DO wave firing the neurons"
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 13px', borderRadius: 999, cursor: 'pointer', border: '1px solid ' + (simRunning ? '#4ade8088' : '#34407a'), background: simRunning ? '#4ade8018' : 'rgba(8,10,22,.6)', color: simRunning ? '#86efac' : '#cdd5f0', backdropFilter: 'blur(10px)', fontWeight: 600, fontSize: 12 }}>
            {simRunning ? <Activity size={13} /> : <Play size={12} />} {simRunning ? 'Simulating' : 'Simulate'}
          </button>
        </div>
      )}

      {/* provenance legend (bottom-left) */}
      {webgl && (
        <div style={{ position: 'absolute', bottom: 16, left: 16, display: 'flex', gap: 14, alignItems: 'center', background: 'rgba(8,10,22,.6)', border: '1px solid #232c52', borderRadius: 12, padding: '9px 14px', backdropFilter: 'blur(10px)' }}>
          <span style={{ fontSize: 10, color: '#8891b5', letterSpacing: 0.6 }}>PROVENANCE</span>
          {(['live', 'partial', 'simulated', 'placeholder'] as const).map((p) => (
            <span key={p} title={PROVENANCE_META[p].hint} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#cdd5f0' }}>
              <span style={{ width: 10, height: 10, borderRadius: 10, background: '#8b7cf6', opacity: p === 'live' ? 1 : p === 'partial' ? 0.65 : p === 'simulated' ? 0.42 : 0.25, boxShadow: p === 'live' ? '0 0 7px #8b7cf6' : 'none' }} />
              {PROVENANCE_META[p].label}
            </span>
          ))}
          <span style={{ fontSize: 11, color: '#93a4d8', borderLeft: '1px solid #232c52', paddingLeft: 12 }}>brightness = how grounded</span>
        </div>
      )}

      {/* inspector */}
      {selNode && (
        <div style={{ position: 'absolute', right: 16, top: 16, width: 280, background: 'rgba(9,11,24,.85)', border: '1px solid #2a3566', borderRadius: 14, padding: 16, backdropFilter: 'blur(14px)', boxShadow: '0 16px 50px rgba(0,0,0,.55)', pointerEvents: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 8 }}>
            <div style={{ fontSize: 15.5, fontWeight: 700, color: '#f0f3ff', lineHeight: 1.25 }}>{selNode.label}</div>
            <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8891b5', flex: 'none' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '10px 0' }}>
            <Chip color={COGNITION_COLOR[selNode.cognition]}>{COGNITION_LABEL[selNode.cognition]}</Chip>
            <Chip color={ONTOLOGY_COLOR[selNode.ontology]}>{selNode.ontology}</Chip>
            <Chip color={PROVENANCE_META[selNode.provenance].color}>{PROVENANCE_META[selNode.provenance].label}</Chip>
            {selNode.spine && <Chip color="#a78bfa">Spine</Chip>}
          </div>
          <p style={{ fontSize: 12.5, color: '#aab4da', lineHeight: 1.55, margin: '0 0 14px' }}>{selNode.summary || 'No summary available.'}</p>
          {selNode.noteId ? (
            <button onClick={() => openRealNote(selNode.noteId!)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', boxShadow: '0 6px 20px #6366f155' }}>
              <ExternalLink size={14} /> Open real note in Vault
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', borderRadius: 10, background: '#f59e0b18', border: '1px solid #f59e0b55', color: '#fbbf24', fontSize: 12 }}>
              <AlertTriangle size={15} /> Missing source
            </div>
          )}
          <div style={{ marginTop: 10, fontSize: 10.5, color: '#6b769e' }}>{selNode.hemisphere === 'left' ? 'Analytic' : selNode.hemisphere === 'right' ? 'Creative' : 'Executive'} hemisphere · {selNode.degree} links</div>
        </div>
      )}

      {model.missing.length > 0 && (
        <div style={{ position: 'absolute', bottom: 16, right: 16, fontSize: 11, color: '#fbbf24', background: '#f59e0b18', border: '1px solid #f59e0b44', padding: '6px 11px', borderRadius: 8 }}>
          {model.missing.length} spine node(s) missing a source
        </div>
      )}
    </div>
  )
}

function SideLabel({ side, title, sub, active, onClick, count }: { side: 'left' | 'right'; title: string; sub: string; active: boolean; onClick: () => void; count: number }) {
  const col = side === 'left' ? '#7dd3fc' : '#c4b5fd'
  return (
    <button onClick={onClick} title={`Isolate the ${title.toLowerCase()} hemisphere`}
      style={{ position: 'absolute', top: '46%', ...(side === 'left' ? { left: 16 } : { right: 16 }), transform: 'translateY(-50%)', textAlign: side, pointerEvents: 'auto', maxWidth: 160, cursor: 'pointer', background: active ? col + '1a' : 'transparent', border: '1px solid ' + (active ? col + '66' : 'transparent'), borderRadius: 12, padding: '8px 12px' }}>
      <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 2, color: col, opacity: active ? 1 : 0.8 }}>{title}</div>
      <div style={{ fontSize: 10, color: '#5a6690', letterSpacing: 0.3, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
      <div style={{ fontSize: 10, color: col, opacity: 0.7, marginTop: 3 }}>{count} neurons</div>
    </button>
  )
}

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 999, background: color + '22', color, border: '1px solid ' + color + '55' }}>{children}</span>
}

function Loading() {
  return <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#8891b5', fontSize: 13 }}>Waking the cortex…</div>
}

const banner: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, right: 0, height: 34, display: 'grid', placeItems: 'center',
  background: '#1a1520', color: '#fbbf24', fontSize: 12, borderBottom: '1px solid #33251a', zIndex: 5,
}
