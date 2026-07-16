// WS3 — the Cognitive Cortex. A dense, wrinkled two-hemisphere brain over the
// REAL vault: the cortical TISSUE is the brain body; note-neurons are brighter
// points on it, grouped into the 7 reactor-spine regions; real wikilinks are
// curved axons with firing pulses. When a context is active (a cinematic beat,
// a filter, or a selection) that region lights and everything else greys out —
// so the audience sees which part of the brain is engaged. The camera never
// zooms out: it sways gently left/right, breathes a little, and leans toward
// whatever is active. Follows the app light/dark theme.

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import type { KModel } from './model'
import { REGIONS, REGION_BY_ID, REGION_INDEX, regionCentroid, TRIAD_COLOR, type RegionId, type Triad } from './brain'
import { useKnowledge } from './store'
import { useDesign, type ColorBy } from './design'
import { computePositions, FIELD } from './forms'
import { activationFor, activeRegionSet } from './activation'

const PROV = { live: 1, partial: 0.72, simulated: 0.5, placeholder: 0.34 } as Record<string, number>
const PROV_COL: Record<string, string> = { live: '#4ade80', partial: '#38bdf8', simulated: '#a78bfa', placeholder: '#64748b' }
const TRIAD_REGIONS: Record<Triad, Set<RegionId>> = { think: new Set(), know: new Set(), do: new Set() }
REGIONS.forEach((r) => TRIAD_REGIONS[r.triad].add(r.id))

// ── shared round sprite so points render as soft dots, not GL squares ──
let _dot: THREE.Texture | null = null
function dotTexture(): THREE.Texture {
  if (_dot) return _dot
  const s = 64, c = document.createElement('canvas'); c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.85)')
  g.addColorStop(0.75, 'rgba(255,255,255,0.25)'); g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s / 2, s / 2, s / 2, 0, Math.PI * 2); ctx.fill()
  _dot = new THREE.CanvasTexture(c); _dot.needsUpdate = true
  return _dot
}

// ── per-region live colour LUT from the design store (palette + overrides) ──
function useRegionColors(): Record<RegionId, THREE.Color> {
  const regionColors = useDesign((s) => s.regionColors)
  return useMemo(() => REGIONS.reduce((m, r) => { m[r.id] = new THREE.Color(regionColors[r.id] || r.color); return m }, {} as Record<RegionId, THREE.Color>), [regionColors])
}
// resolve one node's base colour under the active color-by mode
function nodeColor(colorBy: ColorBy, rcol: Record<RegionId, THREE.Color>, region: RegionId, triad: Triad, provName: string, tmpMap: Map<string, THREE.Color>): THREE.Color {
  if (colorBy === 'region') return rcol[region]
  if (colorBy === 'triad') { const k = 't' + triad; let c = tmpMap.get(k); if (!c) { c = new THREE.Color(TRIAD_COLOR[triad]); tmpMap.set(k, c) } return c }
  if (colorBy === 'provenance') { const k = 'p' + provName; let c = tmpMap.get(k); if (!c) { c = new THREE.Color(PROV_COL[provName] || '#8b7cf6'); tmpMap.set(k, c) } return c }
  let c = tmpMap.get('u'); if (!c) { c = new THREE.Color('#8b7cf6'); tmpMap.set('u', c) } return c
}

interface Theme {
  clear: string; fog: string; fogNear: number; fogFar: number
  tissueScale: number; tissueOpacity: number; blend: THREE.Blending
  axon: string; axonOpacity: number; pulseOpacity: number
  bloomI: number; bloomT: number; vignette: number
  base: number; provW: number; spike: number
  labelText: string; labelBg: string; commandColor: string; commandCore: string; ring: string
  grey: string; greyDim: number
}
function theme(dark: boolean): Theme {
  return dark ? {
    clear: '#04050d', fog: '#04050d', fogNear: 34, fogFar: 90,
    tissueScale: 0.74, tissueOpacity: 0.7, blend: THREE.AdditiveBlending,
    axon: '#2b3a6b', axonOpacity: 0.14, pulseOpacity: 0.95,
    bloomI: 0.9, bloomT: 0.22, vignette: 0.9,
    base: 0.55, provW: 0.42, spike: 1.5,
    labelText: '#fff', labelBg: 'rgba(6,9,20,.6)', commandColor: '#70e7ff', commandCore: '#d6f7ff', ring: '#eef2ff',
    grey: '#525c7c', greyDim: 0.85,
  } : {
    clear: '#eaeef7', fog: '#eaeef7', fogNear: 34, fogFar: 92,
    tissueScale: 0.92, tissueOpacity: 0.6, blend: THREE.NormalBlending,
    axon: '#9aa6cc', axonOpacity: 0.4, pulseOpacity: 0.92,
    bloomI: 0.3, bloomT: 0.55, vignette: 0.32,
    base: 0.86, provW: 0.2, spike: 0.55,
    labelText: '#0b1020', labelBg: 'rgba(255,255,255,.82)', commandColor: '#0891b2', commandCore: '#0e7490', ring: '#1e293b',
    grey: '#b7c0d4', greyDim: 0.9,
  }
}

// ── shared "what's active" — computed once per frame, read by tissue+neurons+camera ──
const ACTIVE: { regions: Set<RegionId> | null; hemi: 'left' | 'right' | null; key: string } = { regions: null, hemi: null, key: '' }
function ActiveController({ model }: { model: KModel }) {
  useFrame(() => {
    const st = useKnowledge.getState()
    let regions: Set<RegionId> | null = null
    let hemi: 'left' | 'right' | null = null
    const hf = st.hemiFilter === 'left' || st.hemiFilter === 'right' ? st.hemiFilter : null
    if (st.scene) regions = activeRegionSet(st.scene)
    else if (st.regionFilter) { regions = new Set([st.regionFilter]); hemi = hf }
    else if (st.triadFilter) { regions = TRIAD_REGIONS[st.triadFilter]; hemi = hf }
    else if (hf) hemi = hf
    else { const sel = st.selected || st.hovered; if (sel) { const n = model.byId.get(sel); if (n) regions = new Set([n.region]) } }
    ACTIVE.regions = regions; ACTIVE.hemi = hemi
    ACTIVE.key = (regions ? [...regions].sort().join(',') : '*') + '|' + (hemi || '*')
  })
  return null
}

// ── FORM FIELD — owns the live position buffer and morphs it toward whichever
// form/params the design store selects. Everything geometric reads FIELD.cur. ──
function FormField({ model }: { model: KModel }) {
  const form = useDesign((s) => s.form)
  const spread = useDesign((s) => s.spread)
  const squash = useDesign((s) => s.squash)
  const separation = useDesign((s) => s.separation)
  const N = model.nodes.length
  // (re)allocate when the model changes; seed cur = first form's target
  useMemo(() => {
    FIELD.cur = new Float32Array(N * 3); FIELD.tgt = new Float32Array(N * 3); FIELD.N = N; FIELD.form = form
    computePositions(form, model, { spread, squash, separation }, FIELD.tgt)
    FIELD.cur.set(FIELD.tgt); FIELD.progress = 1
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model])
  // recompute target + kick the morph whenever form or space params change
  useEffect(() => {
    if (FIELD.tgt.length !== N * 3) return
    computePositions(form, model, { spread, squash, separation }, FIELD.tgt)
    FIELD.form = form; FIELD.progress = 0
  }, [form, spread, squash, separation, model, N])
  useFrame((_, dt) => {
    if (FIELD.progress >= 1) return
    // ease toward target; stagger keeps it feeling elegant rather than a snap
    const k = Math.min(1, dt * 1.8)
    const cur = FIELD.cur, tgt = FIELD.tgt
    let maxd = 0
    for (let j = 0; j < cur.length; j++) { const d = tgt[j] - cur[j]; cur[j] += d * k; const ad = Math.abs(d); if (ad > maxd) maxd = ad }
    FIELD.progress = maxd < 0.01 ? 1 : Math.min(0.999, FIELD.progress + k * 0.5)
    if (FIELD.progress >= 1) cur.set(tgt)
  })
  return null
}
// read a node's live position into a Vector3
function fieldPos(i: number, v: THREE.Vector3): THREE.Vector3 {
  const j = i * 3
  if (j + 2 < FIELD.cur.length) v.set(FIELD.cur[j], FIELD.cur[j + 1], FIELD.cur[j + 2])
  return v
}

// ─────────────── cortical tissue (the brain body) ───────────────
function CorticalTissue({ tissue, th }: { tissue: { positions: Float32Array; region: Uint8Array; fade: Float32Array }; th: Theme }) {
  const ref = useRef<THREE.Points>(null)
  const matRef = useRef<THREE.PointsMaterial>(null)
  const grey = useMemo(() => new THREE.Color(th.grey), [th.grey])
  const RCOL = useRegionColors()
  const form = useDesign((s) => s.form)
  const sparkleSize = useDesign((s) => s.sparkleSize)
  const sparkleDensity = useDesign((s) => s.sparkleDensity)
  const dot = useMemo(dotTexture, [])
  const N = tissue.region.length
  const hemi = useMemo(() => {
    const a = new Uint8Array(N)
    for (let i = 0; i < N; i++) a[i] = tissue.positions[i * 3] < 0 ? 0 : 1 // 0 left, 1 right
    return a
  }, [tissue, N])
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(tissue.positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3))
    return g
  }, [tissue, N])
  const lastKey = useRef('')
  const tmp = useMemo(() => new THREE.Color(), [])
  // the cortical body only makes sense for the brain form — fade it out for the
  // other forms (atom/galaxy/etc.) rather than snapping it away.
  const opac = useRef(th.tissueOpacity)
  useFrame((s, dt) => {
    if (ref.current) ref.current.rotation.y = Math.sin(s.clock.elapsedTime * 0.02) * 0.008
    // sparkle density: draw only a fraction of the tissue points
    geo.setDrawRange(0, Math.max(0, Math.min(N, Math.floor(N * sparkleDensity))))
    if (matRef.current) {
      const target = form === 'brain' ? th.tissueOpacity : 0
      opac.current += (target - opac.current) * Math.min(1, dt * 3)
      matRef.current.opacity = opac.current
      matRef.current.size = 0.05 * sparkleSize
    }
    if (ACTIVE.key === lastKey.current) return
    lastKey.current = ACTIVE.key
    const colors = (geo.getAttribute('color') as THREE.BufferAttribute).array as Float32Array
    for (let i = 0; i < N; i++) {
      const rid = REGION_INDEX[tissue.region[i]]
      const inR = !ACTIVE.regions || ACTIVE.regions.has(rid)
      const inH = ACTIVE.hemi == null || (hemi[i] === 0 ? 'left' : 'right') === ACTIVE.hemi
      const f = tissue.fade[i]
      if (inR && inH) { tmp.copy(RCOL[rid]).multiplyScalar(th.tissueScale * f) }
      else { tmp.copy(grey).multiplyScalar(th.greyDim * 0.5 * f) }
      colors[i * 3] = tmp.r; colors[i * 3 + 1] = tmp.g; colors[i * 3 + 2] = tmp.b
    }
    ;(geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
  })
  return (
    <points ref={ref} geometry={geo}>
      <pointsMaterial ref={matRef} map={dot} alphaTest={0.02} size={0.05} sizeAttenuation vertexColors transparent opacity={th.tissueOpacity} depthWrite={false} blending={th.blend} toneMapped={false} />
    </points>
  )
}

// ─────────────── curved axons + firing pulses ───────────────
const bez = (a: number, c: number, b: number, t: number) => { const it = 1 - t; return it * it * a + 2 * it * t * c + t * t * b }
function control(a: THREE.Vector3, b: THREE.Vector3): THREE.Vector3 {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, mz = (a.z + b.z) / 2
  const len = a.distanceTo(b); const out = Math.hypot(mx, mz) || 1
  return new THREE.Vector3(mx + (mx / out) * len * 0.12, my + len * 0.3 + 0.6, mz + (mz / out) * len * 0.12)
}
function Axons({ model, th }: { model: KModel; th: Theme }) {
  const SEG = 12, PMAX = 1600
  const RCOL = useRegionColors()
  const edgeOpacity = useDesign((s) => s.edgeOpacity)
  const dot = useMemo(dotTexture, [])
  const lineMat = useRef<THREE.LineBasicMaterial>(null)
  // Edges reference node INDICES into FIELD.cur so the curves re-derive from
  // live positions each frame — they stay glued to the neurons through a morph.
  const { lineGeo, ea, eb, pa, pb, pcol, pcount, edgeCount } = useMemo(() => {
    const ea: number[] = [], eb: number[] = [], pa: number[] = [], pb: number[] = [], pcol: number[] = []
    let pcount = 0
    for (const e of model.edges) {
      const ia = model.index.get(e.a), ib = model.index.get(e.b)
      if (ia == null || ib == null) continue
      ea.push(ia); eb.push(ib)
      if (pcount < PMAX && (e.hub || e.provenance === 'confirmed')) {
        const na = model.byId.get(e.a)!; const col = RCOL[na.region]; const n = e.hub ? 3 : 1
        for (let k = 0; k < n && pcount < PMAX; k++) { pa.push(ia); pb.push(ib); pcol.push(col.r, col.g, col.b); pcount++ }
      }
    }
    const edgeCount = ea.length
    const lineGeo = new THREE.BufferGeometry()
    lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(edgeCount * SEG * 2 * 3), 3))
    return { lineGeo, ea: new Int32Array(ea), eb: new Int32Array(eb), pa: new Int32Array(pa), pb: new Int32Array(pb), pcol: new Float32Array(pcol), pcount, edgeCount }
  }, [model, RCOL])

  const pulses = useRef<THREE.Points>(null)
  const pgeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pcount * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(pcol, 3)); return g }, [pcount, pcol])
  const phase = useMemo(() => Float32Array.from({ length: pcount }, () => Math.random()), [pcount])
  const va = useMemo(() => new THREE.Vector3(), []); const vb = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    if (lineMat.current) lineMat.current.opacity = th.axonOpacity * edgeOpacity
    // rebuild line vertices from live node positions
    const lp = (lineGeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    let w = 0
    for (let ei = 0; ei < edgeCount; ei++) {
      fieldPos(ea[ei], va); fieldPos(eb[ei], vb); const c = control(va, vb)
      let px = va.x, py = va.y, pz = va.z
      for (let i = 1; i <= SEG; i++) { const t = i / SEG; const x = bez(va.x, c.x, vb.x, t), y = bez(va.y, c.y, vb.y, t), z = bez(va.z, c.z, vb.z, t); lp[w++] = px; lp[w++] = py; lp[w++] = pz; lp[w++] = x; lp[w++] = y; lp[w++] = z; px = x; py = y; pz = z }
    }
    ;(lineGeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
    if (!pulses.current) return
    const on = useKnowledge.getState().simRunning; const t = state.clock.elapsedTime * (on ? 0.16 : 0.03)
    const arr = (pgeo.getAttribute('position') as THREE.BufferAttribute).array as Float32Array
    for (let i = 0; i < pcount; i++) {
      fieldPos(pa[i], va); fieldPos(pb[i], vb); const c = control(va, vb)
      const tt = (phase[i] + t) % 1, j = i * 3
      arr[j] = bez(va.x, c.x, vb.x, tt); arr[j + 1] = bez(va.y, c.y, vb.y, tt); arr[j + 2] = bez(va.z, c.z, vb.z, tt)
    }
    ;(pgeo.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  })
  return (
    <group>
      <lineSegments geometry={lineGeo}><lineBasicMaterial ref={lineMat} color={th.axon} transparent opacity={th.axonOpacity} blending={th.blend} toneMapped={false} /></lineSegments>
      <points ref={pulses} geometry={pgeo}><pointsMaterial map={dot} alphaTest={0.02} size={0.09} sizeAttenuation vertexColors transparent opacity={th.pulseOpacity} depthWrite={false} blending={th.blend} toneMapped={false} /></points>
    </group>
  )
}

// ─────────────── neurons (instanced) + firing + grey-out ───────────────
function Neurons({ model, th }: { model: KModel; th: Theme }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const setHovered = useKnowledge((s) => s.setHovered), setSelected = useKnowledge((s) => s.setSelected), setFocus = useKnowledge((s) => s.setFocus)
  const N = model.nodes.length
  const RCOL = useRegionColors()
  const colorBy = useDesign((s) => s.colorBy)
  const neuronSize = useDesign((s) => s.neuronSize)
  const glow = useDesign((s) => s.glow)
  const colTmpMap = useMemo(() => new Map<string, THREE.Color>(), [])
  const data = useMemo(() => model.nodes.map((n) => ({
    id: n.id, prov: PROV[n.provenance] ?? 0.6, region: n.region, triad: n.triad, r: n.r,
    hemisphere: n.hemisphere, provName: n.provenance, phase: Math.random() * Math.PI * 2, rate: 0.5 + Math.random() * 2.5,
  })), [model])
  // colour LUT recomputed when colour mode / palette changes
  const colorOf = useMemo(() => model.nodes.map((n) => nodeColor(colorBy, RCOL, n.region, n.triad, n.provenance, colTmpMap).clone()), [model, colorBy, RCOL, colTmpMap])
  // Seed instance matrices + colours once so the instanceColor buffer EXISTS —
  // the per-frame updater below early-returns until it does, and R3F only
  // allocates instanceColor after the first setColorAt call.
  useLayoutEffect(() => {
    const mesh = ref.current; if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    model.nodes.forEach((n, i) => {
      p.set(...n.pos); s.setScalar(n.r); m.compose(p, q, s); mesh.setMatrixAt(i, m); mesh.setColorAt(i, colorOf[i])
    })
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [model, colorOf])
  const tmp = useMemo(() => new THREE.Color(), [])
  const grey = useMemo(() => new THREE.Color(th.grey), [th.grey])
  const m4 = useMemo(() => new THREE.Matrix4(), []); const q = useMemo(() => new THREE.Quaternion(), [])
  const sv = useMemo(() => new THREE.Vector3(), []); const pv = useMemo(() => new THREE.Vector3(), [])
  useFrame((state) => {
    const mesh = ref.current; if (!mesh || !mesh.instanceColor) return
    const st = useKnowledge.getState(); const t = state.clock.elapsedTime
    const act = activationFor(st.scene)
    for (let i = 0; i < N; i++) {
      const d = data[i]
      // live position (morph) + size control
      fieldPos(i, pv); sv.setScalar(d.r * neuronSize); m4.compose(pv, q, sv); mesh.setMatrixAt(i, m4)
      const inR = !ACTIVE.regions || ACTIVE.regions.has(d.region)
      const inH = ACTIVE.hemi == null || d.hemisphere === ACTIVE.hemi
      const inP = !st.provFilter || d.provName === st.provFilter
      if (!(inR && inH && inP)) { tmp.copy(grey).multiplyScalar(th.greyDim * 0.9); mesh.setColorAt(i, tmp); continue }
      let b = th.base + d.prov * th.provW
      if (act) {
        const w = act[d.region] ?? 0.08
        b += w * th.spike
        if (st.simRunning) b += Math.pow(Math.max(0, Math.sin(t * d.rate + d.phase)), 16) * th.spike * 0.4 * (0.4 + w)
      } else if (st.simRunning) {
        b += Math.pow(Math.max(0, Math.sin(t * d.rate + d.phase)), 16) * th.spike
      }
      if (st.selected === d.id) b += 1.6; else if (st.hovered === d.id) b += 0.9
      tmp.copy(colorOf[i]).multiplyScalar(b * glow); mesh.setColorAt(i, tmp)
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.instanceColor.needsUpdate = true
  })
  const onMove = (e: any) => { e.stopPropagation(); const id = model.nodes[e.instanceId]?.id; if (id) { setHovered(id); document.body.style.cursor = 'pointer' } }
  const onOut = () => { setHovered(null); document.body.style.cursor = 'auto' }
  const onDown = (e: any) => { e.stopPropagation(); const id = model.nodes[e.instanceId]?.id; if (id) { setSelected(id); setFocus(id) } }
  return (
    <instancedMesh ref={ref} args={[undefined as any, undefined as any, N]} onPointerMove={onMove} onPointerOut={onOut} onPointerDown={onDown}>
      <sphereGeometry args={[1, 10, 10]} /><meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  )
}

function CommandCore({ model, th }: { model: KModel; th: Theme }) {
  const grp = useRef<THREE.Group>(null)
  const ref = useRef<THREE.Mesh>(null), glow = useRef<THREE.Mesh>(null)
  const ci = model.commandId ? model.index.get(model.commandId) : undefined
  const pv = useMemo(() => new THREE.Vector3(0, -0.4, 0.4), [])
  useFrame((s) => {
    if (grp.current) { if (ci != null) fieldPos(ci, pv); grp.current.position.copy(pv) }
    const st = useKnowledge.getState()
    const boost = st.scene ? 0.7 + st.scene.intensity * 1.1 : 1
    const t = s.clock.elapsedTime, pulse = 1 + Math.sin(t * 2.2) * 0.12 * boost
    if (ref.current) ref.current.scale.setScalar(0.42 * pulse * Math.min(1.35, boost))
    if (glow.current) { glow.current.scale.setScalar((0.9 + Math.sin(t * 2.2) * 0.12) * Math.min(1.5, boost)); (glow.current.material as THREE.Material & { opacity: number }).opacity = (0.14 + Math.sin(t * 2.2) * 0.04) * Math.min(1.4, boost) }
  })
  return (
    <group ref={grp}>
      <mesh ref={ref}><sphereGeometry args={[1, 20, 20]} /><meshBasicMaterial color={th.commandCore} toneMapped={false} /></mesh>
      <mesh ref={glow}><sphereGeometry args={[1, 14, 14]} /><meshBasicMaterial color={th.commandColor} transparent opacity={0.14} toneMapped={false} depthWrite={false} /></mesh>
    </group>
  )
}

function RegionLabel({ model, r, th, col }: { model: KModel; r: typeof REGIONS[number]; th: Theme; col: string }) {
  const grp = useRef<THREE.Group>(null)
  // indices of this region's nodes (hero first) so the label rides the live centroid
  const idxs = useMemo(() => {
    const list: number[] = []
    model.nodes.forEach((n, i) => { if (n.region === r.id) list.push(i) })
    return list
  }, [model, r.id])
  const pv = useMemo(() => new THREE.Vector3(), []); const t = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!grp.current || !idxs.length) return
    pv.set(0, 0, 0)
    for (const i of idxs) { fieldPos(i, t); pv.add(t) }
    pv.multiplyScalar(1 / idxs.length); pv.y += 0.9
    grp.current.position.copy(pv)
  })
  return (
    <group ref={grp}>
      <Html center distanceFactor={19} style={{ pointerEvents: 'none' }} zIndexRange={[16, 0]}>
        <div style={{ whiteSpace: 'nowrap', fontSize: r.id === 'command' ? 12.5 : 11, fontWeight: 700, color: th.labelText, letterSpacing: 0.4, textShadow: `0 0 12px ${col}`, padding: '2px 9px', borderRadius: 7, background: th.labelBg, border: `1px solid ${col}88` }}>{r.label}</div>
      </Html>
    </group>
  )
}
function RegionLabels({ model, th }: { model: KModel; th: Theme }) {
  const showLabels = useDesign((s) => s.showLabels)
  const regionColors = useDesign((s) => s.regionColors)
  if (!showLabels) return null
  return <group>{REGIONS.map((r) => <RegionLabel key={r.id} model={model} r={r} th={th} col={regionColors[r.id] || r.color} />)}</group>
}

function ActiveRing({ model, th }: { model: KModel; th: Theme }) {
  const ref = useRef<THREE.Mesh>(null)
  const pv = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    const st = useKnowledge.getState(); const id = st.selected || st.hovered
    const idx = id ? model.index.get(id) : undefined; const n = id ? model.byId.get(id) : null
    const m = ref.current; if (!m) return
    if (n && idx != null) { m.visible = true; fieldPos(idx, pv); m.position.copy(pv); m.scale.setScalar(Math.max(0.5, n.r * 3.4)); m.rotation.z += 0.03; m.rotation.x = Math.PI / 2.4 }
    else m.visible = false
  })
  return <mesh ref={ref} visible={false}><torusGeometry args={[1, 0.05, 8, 40]} /><meshBasicMaterial color={th.ring} toneMapped={false} transparent opacity={0.9} /></mesh>
}

function DebugExpose() { const s = useThree(); useEffect(() => { if (import.meta.env.DEV) (window as unknown as { __kg?: unknown }).__kg = s }, [s]); return null }
function Heartbeat({ onFrame }: { onFrame?: () => void }) { useFrame(() => onFrame?.()); return null }
function Resizer({ width, height }: { width: number; height: number }) {
  const setSize = useThree((s) => s.setSize), camera = useThree((s) => s.camera)
  useEffect(() => { if (width < 2 || height < 2) return; setSize(width, height); const c = camera as THREE.PerspectiveCamera; c.aspect = width / height; c.updateProjectionMatrix() }, [width, height, setSize, camera])
  return null
}

// Manual orbit + zoom is the founder's own navigation (drag to orbit, wheel/
// pinch to zoom, right-drag to pan). The gentle sway/breathe/lean is an IDLE
// ambient behaviour only: it pauses the instant the founder touches the
// controls and waits a grace period after release before easing back in —
// never fights the user's own framing.
const BASE_RADIUS = 20.5
function CameraRig({ autoEnabled }: { autoEnabled: boolean }) {
  const controlsRef = useRef<any>(null)
  const { camera } = useThree()
  const target = useRef(new THREE.Vector3(0, 0.4, 0.5))
  const tTgt = useMemo(() => new THREE.Vector3(), [])
  const tPos = useMemo(() => new THREE.Vector3(), [])
  const userActive = useRef(false)
  const idleSince = useRef(0)

  useEffect(() => {
    const c = controlsRef.current; if (!c) return
    const onStart = () => { userActive.current = true }
    const onEnd = () => { userActive.current = false; idleSince.current = performance.now() }
    c.addEventListener('start', onStart)
    c.addEventListener('end', onEnd)
    return () => { c.removeEventListener('start', onStart); c.removeEventListener('end', onEnd) }
  }, [])

  useFrame((state) => {
    const c = controlsRef.current
    const idleLongEnough = performance.now() - idleSince.current > 1400
    if (autoEnabled && c && !userActive.current && idleLongEnough) {
      const t = state.clock.elapsedTime
      const regions = ACTIVE.regions
      let cy = 0.4, cz = 0.5
      if (regions && regions.size >= 1 && regions.size <= 3) {
        let y = 0, z = 0; regions.forEach((r) => { const rc = regionCentroid(r); y += rc[1]; z += rc[2] })
        cy = (y / regions.size) * 0.4 + 0.3; cz = (z / regions.size) * 0.5
      }
      target.current.lerp(tTgt.set(0, cy, cz), 0.015)
      const zoomIn = regions && regions.size <= 3 ? 2 : 0          // lean IN on a focused context
      const breathe = Math.abs(Math.sin(t * 0.1)) * 1.2            // inward-only breathing
      const radius = BASE_RADIUS - zoomIn - breathe
      const az = Math.sin(t * 0.06) * 0.3                          // gentle left/right sway
      const pol = 0.56 + Math.sin(t * 0.05) * 0.04                 // top-down-ish (reads as a brain)
      tPos.set(
        target.current.x + radius * Math.sin(pol) * Math.sin(az),
        target.current.y + radius * Math.cos(pol),
        target.current.z + radius * Math.sin(pol) * Math.cos(az),
      )
      camera.position.lerp(tPos, 0.02)
      c.target.lerp(target.current, 0.02)
    }
    if (c) c.update()
  })
  return (
    <OrbitControls ref={controlsRef} enablePan enableZoom enableRotate
      enableDamping dampingFactor={0.08} minDistance={5} maxDistance={46} rotateSpeed={0.55} zoomSpeed={0.85} panSpeed={0.7} />
  )
}

export function KnowledgeScene({ model, tissue, width, height, dark, autoCamera = true, onFrame }: {
  model: KModel; tissue: { positions: Float32Array; region: Uint8Array; fade: Float32Array }; width: number; height: number; dark: boolean; autoCamera?: boolean; onFrame?: () => void
}) {
  const th = useMemo(() => theme(dark), [dark])
  const bloomMul = useDesign((s) => s.bloom)
  return (
    <Canvas style={{ width, height }} dpr={[1, 2]} camera={{ position: [0, 17, 18], fov: 50, near: 0.1, far: 400 }}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onCreated={({ gl }) => gl.setClearColor(th.clear, 1)}>
      <DebugExpose /><Heartbeat onFrame={onFrame} /><Resizer width={width} height={height} /><ActiveController model={model} />
      <FormField model={model} />
      <fog attach="fog" args={[th.fog, th.fogNear, th.fogFar]} />
      <ambientLight intensity={0.5} />
      <CorticalTissue tissue={tissue} th={th} />
      <Axons model={model} th={th} />
      <Neurons model={model} th={th} />
      <CommandCore model={model} th={th} />
      <ActiveRing model={model} th={th} />
      <RegionLabels model={model} th={th} />
      <CameraRig autoEnabled={autoCamera} />
      <EffectComposer>
        <Bloom intensity={th.bloomI * bloomMul} luminanceThreshold={th.bloomT} luminanceSmoothing={0.88} mipmapBlur radius={0.75} />
        <Vignette eskil={false} offset={0.2} darkness={th.vignette} />
      </EffectComposer>
    </Canvas>
  )
}

export { REGION_BY_ID }
