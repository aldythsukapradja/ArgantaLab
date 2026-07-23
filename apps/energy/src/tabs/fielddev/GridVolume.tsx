// GridVolume.tsx (G3) — GPU-scale 3D static-model viewer. Replaces the InstancedMesh
// box grid: the reservoir is ONE BufferGeometry shell (top+base surfaces + boundary
// walls) plus a movable vertical SECTION (the X-section), coloured by a property
// Data3DTexture sampled through a palette in a GLSL3 shader. Millions of cells become
// colour, not geometry — recolour/attribute swap = a texture upload, never a rebuild.
// Geometry from engine/gridmesh.ts (pure, unit-tested); packing from engine/pack3d.ts.
import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { GridModel } from '../../engine/grid3d';
import { packGrid3D, type PackedGrid3D, type PackedProp } from '../../engine/pack3d';
import { buildShell, buildSection, type MeshBuffers } from '../../engine/gridmesh';

// ── palettes (t∈[0,1] → [r,g,b] 0..255) ──────────────────────────────────────
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function ramp(stops: Array<[number, [number, number, number]]>): (t: number) => [number, number, number] {
  return (t) => {
    t = Math.max(0, Math.min(1, t));
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i]; const f = (t - t0) / (t1 - t0 || 1);
      return [lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)];
    }
    return stops[stops.length - 1][1];
  };
}
const PALETTES: Record<string, (t: number) => [number, number, number]> = {
  viridis: ramp([[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]]),
  turbo: ramp([[0, [48, 18, 59]], [0.25, [40, 160, 220]], [0.5, [90, 220, 110]], [0.75, [240, 190, 50]], [1, [180, 30, 30]]]),
  phi: ramp([[0, [40, 40, 70]], [0.5, [90, 150, 200]], [1, [250, 240, 130]]]),      // warm high-φ
  sw: ramp([[0, [200, 60, 40]], [0.5, [230, 210, 120]], [1, [40, 90, 190]]]),        // oil red → water blue
  facies: ramp([[0, [120, 85, 70]], [0.49, [120, 85, 70]], [0.5, [245, 195, 60]], [1, [245, 195, 60]]]), // shale/sand
  depth: ramp([[0, [180, 30, 30]], [0.5, [240, 220, 90]], [1, [40, 90, 190]]]),
};

function paletteTexture(name: string): THREE.DataTexture {
  const fn = PALETTES[name] || PALETTES.viridis; const n = 256; const data = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) { const [r, g, b] = fn(i / (n - 1)); data[i * 4] = r; data[i * 4 + 1] = g; data[i * 4 + 2] = b; data[i * 4 + 3] = 255; }
  const tex = new THREE.DataTexture(data, n, 1, THREE.RGBAFormat); tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true; return tex;
}

// property volume → Data3DTexture RGBA (R = normalised prop 0..255, A = active 0/255)
function volumeTexture(p: PackedGrid3D, prop: PackedProp): THREE.Data3DTexture {
  const { nx, ny, nz } = p; const data = new Uint8Array(nx * ny * nz * 4);
  const qmax = prop.dtype === 'u8' ? 255 : 65535;
  const catSpan = prop.categorical ? Math.max(1, prop.max) : 1;
  for (let l = 0; l < nz; l++) for (let k = 0; k < ny; k++) for (let i = 0; i < nx; i++) {
    const ci = (l * ny + k) * nx + i, o = ci * 4;
    const act = p.activeCol[k * nx + i] === 1;
    const norm = prop.categorical ? prop.data[ci] / catSpan : prop.data[ci] / qmax;
    data[o] = Math.round(Math.max(0, Math.min(1, norm)) * 255); data[o + 3] = act ? 255 : 0;
  }
  const tex = new THREE.Data3DTexture(data, nx, ny, nz);
  tex.format = THREE.RGBAFormat; tex.type = THREE.UnsignedByteType;
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.wrapR = tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping; tex.needsUpdate = true; return tex;
}

const VERT = /* glsl */`
  out vec3 vUvw; out vec3 vNormalW;
  in vec3 uvw;
  void main(){ vUvw = uvw; vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const FRAG = /* glsl */`
  precision highp sampler3D;
  uniform sampler3D uVolume; uniform sampler2D uPalette; uniform float uOpacity; uniform vec3 uLight;
  in vec3 vUvw; in vec3 vNormalW; out vec4 outColor;
  void main(){
    vec4 s = texture(uVolume, vUvw);
    if(s.a < 0.5) discard;
    vec3 base = texture(uPalette, vec2(clamp(s.r,0.002,0.998), 0.5)).rgb;
    float lambert = 0.45 + 0.55 * clamp(dot(normalize(vNormalW), normalize(uLight)), 0.0, 1.0);
    outColor = vec4(base * lambert, uOpacity);
  }`;

// theme-aware CSS colour — re-reads on light/dark toggle (html class + data-theme)
function useThemeCssColor(varName: string, fallback: string): string {
  const read = () => { if (typeof window === 'undefined') return fallback; const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); return v || fallback; };
  const [c, setC] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    setC(read());
    return () => obs.disconnect();
  }, [varName]); // eslint-disable-line react-hooks/exhaustive-deps
  return c;
}
function isDark(): boolean {
  if (typeof window === 'undefined') return true;
  const h = document.documentElement;
  return h.classList.contains('dark') || h.getAttribute('data-theme') === 'dark';
}

function geomFrom(m: MeshBuffers): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  g.setAttribute('uvw', new THREE.BufferAttribute(m.uvw, 3));
  g.setIndex(new THREE.BufferAttribute(m.index, 1));
  return g;
}

export type GVWell = { name: string; x: number; y: number; role: string };
const gvRoleColor = (r: string) => (r === 'injector' ? '#42a5f5' : r === 'producer' ? '#4caf50' : r === 'both' ? '#ab47bc' : '#90a4ae');

// world centre used to place wells consistently with gridmesh's centred geometry
function packedCentre(p: PackedGrid3D): [number, number, number] {
  const cx = p.x0 + (p.nx * p.dx) / 2, cy = p.y0 + (p.ny * p.dy) / 2;
  let zs = 0, n = 0;
  for (let c = 0; c < p.activeCol.length; c++) if (p.activeCol[c]) { zs += (p.topZ[c] + p.baseZ[c]) / 2; n++; }
  return [cx, cy, n ? zs / n : 0];
}
function GridWellMarker({ x, y, depth, role, name }: { x: number; y: number; depth: number; role: string; name: string }) {
  const c = gvRoleColor(role), h = 70;
  return (
    <group position={[x, -depth, y]}>
      <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[5, 5, h, 8]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.4} /></mesh>
      <mesh position={[0, h, 0]}><sphereGeometry args={[13, 16, 16]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} /></mesh>
      <Html position={[0, h + 24, 0]} center distanceFactor={3200} style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 11, fontWeight: 700, color: '#fff', background: c, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>{name}</div>
      </Html>
    </group>
  );
}

function Scene({ packed, prop, palette, mode, sectionAxis, sectionIndex, zExag, clip, opacity, wells }: {
  packed: PackedGrid3D; prop: PackedProp; palette: string; mode: 'shell' | 'section';
  sectionAxis: 'i' | 'k'; sectionIndex: number; zExag: number; clip: number; opacity: number; wells: GVWell[];
}) {
  const { gl } = useThree();
  useEffect(() => { gl.localClippingEnabled = true; }, [gl]);
  const [cx, cy, cz] = useMemo(() => packedCentre(packed), [packed]);

  const shell = useMemo(() => geomFrom(buildShell(packed)), [packed]);
  const section = useMemo(() => geomFrom(buildSection(packed, sectionAxis, sectionIndex)), [packed, sectionAxis, sectionIndex]);
  const volTex = useMemo(() => volumeTexture(packed, prop), [packed, prop]);
  const palTex = useMemo(() => paletteTexture(palette), [palette]);
  const halfX = (packed.nx * packed.dx) / 2;
  const clipPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0), []);
  clipPlane.constant = halfX * (2 * clip - 1);

  const mat = useMemo(() => new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true,
    uniforms: { uVolume: { value: volTex }, uPalette: { value: palTex }, uOpacity: { value: opacity }, uLight: { value: new THREE.Vector3(0.4, 1, 0.6) } },
  }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { mat.uniforms.uVolume.value = volTex; mat.uniforms.uPalette.value = palTex; mat.uniforms.uOpacity.value = opacity; mat.needsUpdate = true; }, [mat, volTex, palTex, opacity]);
  useEffect(() => { mat.clippingPlanes = mode === 'shell' && clip < 0.999 ? [clipPlane] : null; }, [mat, mode, clip, clipPlane]);
  useEffect(() => () => { shell.dispose(); volTex.dispose(); palTex.dispose(); }, [shell, volTex, palTex]);

  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.scale.y = zExag; });

  return (
    <group ref={ref}>
      <mesh geometry={mode === 'shell' ? shell : section} material={mat} />
      {/* wells draped on the reservoir top (2b) — role-coloured markers + labels */}
      {wells.map((w) => {
        const i = Math.round((w.x - packed.x0) / packed.dx - 0.5), k = Math.round((w.y - packed.y0) / packed.dy - 0.5);
        if (i < 0 || k < 0 || i >= packed.nx || k >= packed.ny) return null;
        const col = k * packed.nx + i; if (!packed.activeCol[col]) return null;
        const top = packed.topZ[col]; if (!Number.isFinite(top)) return null;
        return <GridWellMarker key={w.name} x={w.x - cx} y={w.y - cy} depth={top - cz} role={w.role} name={w.name} />;
      })}
    </group>
  );
}

export default function GridVolume({ model, wells = [] }: { model: GridModel; wells?: GVWell[] }) {
  const packed = useMemo(() => packGrid3D(model), [model]);
  const [propName, setPropName] = useState('phi');
  const [palette, setPalette] = useState('viridis');
  const [mode, setMode] = useState<'shell' | 'section'>('shell');
  const [axis, setAxis] = useState<'i' | 'k'>('i');
  const [sIdx, setSIdx] = useState(Math.floor(model.nx / 2));
  const [zExag, setZExag] = useState(6);
  const [clip, setClip] = useState(1);
  const [opacity, setOpacity] = useState(1);
  const prop = packed.props.find((p) => p.name === propName) || packed.props[0];
  const extent = Math.max(packed.nx * packed.dx, packed.ny * packed.dy);
  const bg = useThemeCssColor('--panel-2', isDark() ? '#0b0f19' : '#f5f7fa'); // theme-aware scene bg
  const dark = isDark();

  const propPal: Record<string, string> = { phi: 'phi', sw: 'sw', facies: 'facies', perm: 'turbo', ntg: 'viridis' };
  useEffect(() => { setPalette(propPal[propName] || 'viridis'); }, [propName]); // eslint-disable-line

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <Canvas camera={{ position: [extent * 0.9, extent * 0.7, extent * 0.9], far: extent * 20, near: 1 }} gl={{ antialias: true, localClippingEnabled: true }}>
        <color attach="background" args={[bg]} />
        <ambientLight intensity={dark ? 0.6 : 0.85} /><directionalLight position={[1, 2, 1]} intensity={dark ? 0.8 : 0.7} />
        <Scene packed={packed} prop={prop} palette={palette} mode={mode} sectionAxis={axis} sectionIndex={sIdx} zExag={zExag} clip={clip} opacity={opacity} wells={wells} />
        <OrbitControls enableDamping makeDefault />
      </Canvas>

      <div style={overlay}>
        <Seg label="Prop" value={propName} set={setPropName} opts={packed.props.map((p) => p.name)} />
        <Seg label="View" value={mode} set={(v) => setMode(v as 'shell' | 'section')} opts={['shell', 'section']} />
        {mode === 'section' && <>
          <Seg label="Axis" value={axis} set={(v) => setAxis(v as 'i' | 'k')} opts={['i', 'k']} />
          <Range label={`Slice ${sIdx}`} value={sIdx} min={0} max={(axis === 'i' ? model.nx : model.ny) - 1} step={1} set={setSIdx} />
        </>}
        {mode === 'shell' && <Range label={`Cut ${Math.round(clip * 100)}%`} value={clip} min={0} max={1} step={0.02} set={setClip} />}
        <Range label={`Z×${zExag}`} value={zExag} min={1} max={20} step={1} set={setZExag} />
        <Range label={`Opacity ${Math.round(opacity * 100)}%`} value={opacity} min={0.2} max={1} step={0.05} set={setOpacity} />
      </div>
      <div style={badge}>{model.nx}×{model.ny}×{model.nz} = {(model.nx * model.ny * model.nz).toLocaleString()} cells · shell+section · {(packed.bytes / 1024).toFixed(0)} KB · GPU texture-coloured</div>
    </div>
  );
}

// theme-aware chrome via CSS vars (the browser resolves var() per current theme)
const overlay: React.CSSProperties = { position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 6, background: 'color-mix(in srgb, var(--panel) 90%, transparent)', border: '1px solid var(--line)', borderRadius: 10, padding: 10, backdropFilter: 'blur(6px)', color: 'var(--text)', fontSize: 11, fontFamily: 'var(--mono, monospace)', boxShadow: 'var(--shadow, 0 2px 8px rgba(0,0,0,.15))' };
const badge: React.CSSProperties = { position: 'absolute', bottom: 10, left: 10, color: 'var(--muted)', fontSize: 9.5, fontFamily: 'var(--mono, monospace)' };
function Seg({ label, value, set, opts }: { label: string; value: string; set: (v: string) => void; opts: string[] }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ opacity: .6, width: 34 }}>{label}</span>
    <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>{opts.map((o) => <button key={o} onClick={() => set(o)} style={{ padding: '3px 7px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 10, background: value === o ? 'var(--teal)' : 'var(--panel-2)', color: value === o ? '#04120f' : 'var(--muted)' }}>{o}</button>)}</div></div>;
}
function Range({ label, value, min, max, step, set }: { label: string; value: number; min: number; max: number; step: number; set: (v: number) => void }) {
  return <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ opacity: .6, width: 74 }}>{label}</span>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => set(+e.target.value)} style={{ width: 120, accentColor: 'var(--teal)' }} /></div>;
}
