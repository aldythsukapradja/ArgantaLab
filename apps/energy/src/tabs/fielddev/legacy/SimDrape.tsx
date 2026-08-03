// SimDrape.tsx (G5 + G6 + Batch1 1c/1d) — the lightweight 3D HC-flow viewer. Drapes the
// dynamic-sim areal grid as ONE surface (engine/simmesh.ts) following the reservoir top,
// animates the waterflood with a two-texture temporal lerp (G6), colours saturation
// through the shared colorramp oil→water palette, shows the OWC as a translucent water
// body below the reservoir (contact-aware: below = water/blue, above = oil), and renders
// the field WELLS with role colours + labels. One texture upload/frame → no rebuild.
import { useMemo, useRef, useState, useEffect } from 'react';
import { Canvas, useThree, useFrame } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Play, Pause } from 'lucide-react';
import { buildSimSurface, type SimGrid } from '../../../engine/simmesh';
import { frameTexture, type SimPack } from '../../../engine/pack-sim';
import { paletteTextureData } from '../../../engine/colorramp';

type Well = { name: string; x: number; y: number; role: string };

function useThemeCssColor(varName: string, fallback: string): string {
  const read = () => { if (typeof window === 'undefined') return fallback; const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim(); return v || fallback; };
  const [c, setC] = useState(read);
  useEffect(() => { const o = new MutationObserver(() => setC(read())); o.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] }); setC(read()); return () => o.disconnect(); }, [varName]); // eslint-disable-line
  return c;
}
const isDark = () => typeof window !== 'undefined' && (document.documentElement.classList.contains('dark') || document.documentElement.getAttribute('data-theme') === 'dark');
const roleColor = (r: string) => (r === 'injector' ? '#42a5f5' : r === 'producer' ? '#4caf50' : r === 'both' ? '#ab47bc' : '#90a4ae');

const VERT = /* glsl */`
  out vec2 vUv; out vec3 vN; in vec3 aUvw;
  void main(){ vUv = aUvw.xy; vN = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const FRAG = /* glsl */`
  precision highp float;
  uniform sampler2D uPrev; uniform sampler2D uNext; uniform sampler2D uPalette; uniform float uMix;
  uniform vec3 uLight; uniform float uOpacity;
  in vec2 vUv; in vec3 vN; out vec4 outColor;
  void main(){
    vec4 a = texture(uPrev, vUv); vec4 b = texture(uNext, vUv);
    if(a.a < 0.5) discard;
    float sw = clamp(mix(a.r, b.r, uMix), 0.0, 1.0);           // temporal lerp of saturation
    vec3 base = texture(uPalette, vec2(clamp(sw,0.003,0.997), 0.5)).rgb; // oil→water ramp
    float lam = 0.5 + 0.5 * clamp(dot(normalize(vN), normalize(uLight)), 0.0, 1.0);
    outColor = vec4(base * lam, uOpacity);
  }`;

function makeTex(pack: SimPack, frame: number): THREE.DataTexture {
  const t = new THREE.DataTexture(frameTexture(pack, frame), pack.nx, pack.ny, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}
function palTexture(): THREE.DataTexture {
  const t = new THREE.DataTexture(paletteTextureData('oilwater', false, 256), 256, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

function WellMarker({ x, y, depth, role, name, hi }: { x: number; y: number; depth: number; role: string; name: string; hi: boolean }) {
  const c = roleColor(role);
  const h = hi ? 90 : 55;
  return (
    <group position={[x, -depth, y]}>
      <mesh position={[0, h / 2, 0]}><cylinderGeometry args={[hi ? 7 : 4, hi ? 7 : 4, h, 8]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} /></mesh>
      <mesh position={[0, h, 0]}><sphereGeometry args={[hi ? 16 : 11, 16, 16]} /><meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.5} /></mesh>
      {hi && <Html position={[0, h + 26, 0]} center distanceFactor={2600} style={{ pointerEvents: 'none' }}>
        <div style={{ fontFamily: 'var(--mono, monospace)', fontSize: 11, fontWeight: 700, color: '#fff', background: c, borderRadius: 5, padding: '1px 6px', whiteSpace: 'nowrap' }}>{name}</div>
      </Html>}
    </group>
  );
}

function Scene({ pack, grid, zAt, owc, wells, injName, prodName, playing, speed, scrubT, zExag, bg, onFrame }: {
  pack: SimPack; grid: SimGrid; zAt?: (x: number, y: number) => number | null; owc: number; wells: Well[]; injName?: string; prodName?: string;
  playing: boolean; speed: number; scrubT: number | null; zExag: number; bg: string; onFrame: (f: number) => void;
}) {
  const { scene } = useThree();
  useEffect(() => { scene.background = new THREE.Color(bg); }, [scene, bg]);

  const built = useMemo(() => buildSimSurface(grid, { zAt }), [grid, zAt]);
  const [cx, cy, cz] = built.center;
  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(built.position, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(built.normal, 3));
    g.setAttribute('aUvw', new THREE.BufferAttribute(built.uvw, 3));
    g.setIndex(new THREE.BufferAttribute(built.index, 1));
    return g;
  }, [built]);

  const texA = useMemo(() => makeTex(pack, 0), [pack]);
  const texB = useMemo(() => makeTex(pack, Math.min(1, pack.nt - 1)), [pack]);
  const pal = useMemo(() => palTexture(), []);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, side: THREE.DoubleSide, transparent: true,
    uniforms: { uPrev: { value: texA }, uNext: { value: texB }, uPalette: { value: pal }, uMix: { value: 0 }, uLight: { value: new THREE.Vector3(0.4, 1, 0.5) }, uOpacity: { value: 1 } },
  }), [texA, texB, pal]);
  useEffect(() => () => { geom.dispose(); texA.dispose(); texB.dispose(); pal.dispose(); mat.dispose(); }, [geom, texA, texB, pal, mat]);

  const tRef = useRef(0); const lastA = useRef(-1);
  useFrame((_, delta) => {
    const nt = pack.nt; if (nt <= 1) return;
    if (scrubT != null) tRef.current = scrubT;
    else if (playing) tRef.current = (tRef.current + delta * speed) % nt;
    const fa = Math.floor(tRef.current) % nt, fb = (fa + 1) % nt;
    if (fa !== lastA.current) {
      (texA.image.data as Uint8Array).set(frameTexture(pack, fa)); texA.needsUpdate = true;
      (texB.image.data as Uint8Array).set(frameTexture(pack, fb)); texB.needsUpdate = true;
      lastA.current = fa; onFrame(fa);
    }
    mat.uniforms.uMix.value = tRef.current - Math.floor(tRef.current);
  });

  // OWC water body — a translucent blue plane at the contact depth (below = water)
  const gw = grid.nx * grid.dx, gh = grid.ny * grid.dy, owcY = -(owc - cz);
  const waterMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1c4fb0', transparent: true, opacity: 0.28, side: THREE.DoubleSide, depthWrite: false }), []);

  return (
    <group scale={[1, zExag, 1]}>
      <mesh geometry={geom} material={mat} />
      {/* below-contact water body */}
      <mesh position={[0, owcY, 0]} rotation={[-Math.PI / 2, 0, 0]} material={waterMat}><planeGeometry args={[gw * 1.05, gh * 1.05]} /></mesh>
      {/* wells (draped on the reservoir top; injector/producer highlighted + labelled) */}
      {wells.map((w) => {
        const d = zAt ? zAt(w.x, w.y) : null; if (d == null || !Number.isFinite(d)) return null;
        return <WellMarker key={w.name} x={w.x - cx} y={w.y - cy} depth={d - cz} role={w.role} name={w.name} hi={w.name === injName || w.name === prodName} />;
      })}
    </group>
  );
}

export default function SimDrape({ pack, grid, zAt, owc = 3200, wells = [], injName, prodName }: {
  pack: SimPack; grid: SimGrid; zAt?: (x: number, y: number) => number | null; owc?: number; wells?: Well[]; injName?: string; prodName?: string;
}) {
  const [playing, setPlaying] = useState(true);
  const [scrubT, setScrubT] = useState<number | null>(null);
  const [speed, setSpeed] = useState(6);
  const [zExag, setZExag] = useState(6);
  const [dispFrame, setDispFrame] = useState(0);
  const bg = useThemeCssColor('--panel-2', isDark() ? '#0b0f19' : '#f5f7fa');
  const dark = isDark();
  const nFrames = pack.nt;
  const extent = Math.max(grid.nx * grid.dx, grid.ny * grid.dy);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0 }}>
      <Canvas camera={{ position: [extent * 0.7, extent * 0.9, extent * 0.7], far: extent * 25, near: 1 }} gl={{ antialias: true }}>
        <ambientLight intensity={dark ? 0.7 : 0.9} /><directionalLight position={[1, 2, 1]} intensity={dark ? 0.75 : 0.6} />
        <Scene pack={pack} grid={grid} zAt={zAt} owc={owc} wells={wells} injName={injName} prodName={prodName}
          playing={playing} speed={speed} scrubT={scrubT} zExag={zExag} bg={bg} onFrame={setDispFrame} />
        <OrbitControls enableDamping makeDefault />
      </Canvas>

      <div style={ovl}>
        <button onClick={() => { if (playing) { setPlaying(false); setScrubT(dispFrame); } else { setScrubT(null); setPlaying(true); } }} style={btn}>{playing ? <Pause size={13} /> : <Play size={13} />}</button>
        <input type="range" min={0} max={Math.max(0, nFrames - 1)} step={1} value={Math.min(dispFrame, nFrames - 1)}
          onChange={(e) => { setPlaying(false); setScrubT(+e.target.value); setDispFrame(+e.target.value); }} style={{ width: 160, accentColor: 'var(--teal)' }} />
        <span style={{ fontFamily: 'var(--mono, monospace)', fontSize: 10, color: 'var(--muted)', minWidth: 42 }}>{Math.min(dispFrame, nFrames - 1) + 1}/{nFrames}</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}><i style={{ width: 9, height: 9, borderRadius: 2, background: 'rgb(56,161,105)' }} />oil<i style={{ width: 9, height: 9, borderRadius: 2, background: 'rgb(41,107,204)', marginLeft: 6 }} />water<i style={{ width: 9, height: 9, borderRadius: 2, background: '#4caf50', marginLeft: 6 }} />prod<i style={{ width: 9, height: 9, borderRadius: 2, background: '#42a5f5', marginLeft: 4 }} />inj</span>
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>×{speed}fps</span>
        <input type="range" min={1} max={24} step={1} value={speed} onChange={(e) => setSpeed(+e.target.value)} style={{ width: 56, accentColor: 'var(--teal)' }} />
        <span style={{ fontSize: 10, color: 'var(--muted)' }}>Z×{zExag}</span>
        <input type="range" min={1} max={20} step={1} value={zExag} onChange={(e) => setZExag(+e.target.value)} style={{ width: 56, accentColor: 'var(--teal)' }} />
      </div>
      <div style={badge}>{grid.nx}×{grid.ny} · {nFrames}f · OWC {owc}m · {wells.length} wells · GPU drape · temporal lerp</div>
    </div>
  );
}

const ovl: React.CSSProperties = { position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 8, background: 'color-mix(in srgb, var(--panel) 90%, transparent)', border: '1px solid var(--line)', borderRadius: 10, padding: '7px 10px', backdropFilter: 'blur(6px)', color: 'var(--text)', boxShadow: 'var(--shadow, 0 2px 8px rgba(0,0,0,.15))', flexWrap: 'wrap', maxWidth: 'calc(100% - 20px)' };
const btn: React.CSSProperties = { display: 'grid', placeItems: 'center', width: 26, height: 26, borderRadius: 7, border: '1px solid var(--line)', background: 'var(--panel-2)', color: 'var(--text)', cursor: 'pointer' };
const badge: React.CSSProperties = { position: 'absolute', bottom: 10, left: 10, color: 'var(--muted)', fontSize: 9.5, fontFamily: 'var(--mono, monospace)' };
