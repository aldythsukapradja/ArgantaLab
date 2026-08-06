// PetroCrossplot3D — three curves as axes, our net-pay flag as colour.
//
// The third axis has to earn itself. Each preset is a triad where the third
// curve resolves what the other two overlap on (see petro-xplot3d), and the
// hint under the plot says which ambiguity it is resolving — so the view is a
// question being asked, not a rotatable ornament.
//
// COLOUR IS PAY, computed under the rail's parameters. Move a cutoff on the
// Single Well pane and this cloud recolours, because it is the same
// interpretation. That is the check the plot exists for: whether pay is a
// CORNER of the space or a smear across it.
//
// three.js rather than deck.gl: the rest of this suite's 3D is r3f, and one 3D
// stack per app is worth more than the blueprint's preference.
import { useEffect, useMemo, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import * as THREE from 'three';
import { Box, AlertTriangle, RotateCcw } from 'lucide-react';
import { cssVar } from './hooks';
import type { FieldCurves } from './petro-curves';
import { PRESETS_3D, buildCloud3D, axisTicks, type Preset3, type Cloud3D } from './petro-xplot3d';

/** Axis colours match the frame lines, so a label is findable without reading it. */
const AXIS_COLOR = ['#e0654c', '#4ec38a', '#5aa9f5'];

/**
 * The scene follows the app's theme.
 *
 * A WebGL canvas cannot inherit a CSS variable — the colours have to be read out
 * and handed to three.js as numbers. That means re-reading them when the theme
 * flips, which is what the MutationObserver is for: the cosmo shell toggles a
 * `dark` class on <html>, and nothing else tells this component about it. Before
 * this, the plot was a hardcoded near-black rectangle sitting inside a white
 * card.
 */
function useSceneTheme() {
  const read = () => ({
    bg: cssVar('--panel'),
    frame: cssVar('--ink3'),
    // A cloud on a light card needs MORE alpha than one on a dark card: dark
    // points on white read as dirt at the alpha that looks right on black.
    dark: document.documentElement.classList.contains('dark'),
  });
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme((prev) => {
      const next = read();
      // functional-update guard: an observer that setStates unconditionally on a
      // class change re-renders for every unrelated class the shell touches
      return prev.bg === next.bg && prev.dark === next.dark ? prev : next;
    }));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-ui'] });
    return () => mo.disconnect();
  }, []);
  return theme;
}

function Cloud({ cloud, showPay, showNonPay, dark }: {
  cloud: Cloud3D; showPay: boolean; showNonPay: boolean; dark: boolean;
}) {
  const geo = useMemo(() => {
    // Filtering here rather than in buildCloud3D keeps the domains — and so the
    // camera framing — fixed while you toggle. A box that rescales when you hide
    // half the points is a different plot, not a filtered one.
    const keep: number[] = [];
    for (let i = 0; i < cloud.n; i++) {
      const c = cloud.cls[i];
      // class 2 is "no verdict" — it stays visible under either toggle, because
      // hiding it would let a missing curve read as an absence of rock
      if (c === 2 || (c === 1 ? showPay : showNonPay)) keep.push(i);
    }
    const pos = new Float32Array(keep.length * 3);
    const col = new Float32Array(keep.length * 3);
    keep.forEach((src, d) => {
      pos[d * 3] = cloud.position[src * 3];
      pos[d * 3 + 1] = cloud.position[src * 3 + 1];
      pos[d * 3 + 2] = cloud.position[src * 3 + 2];
      col[d * 3] = cloud.color[src * 3];
      col[d * 3 + 1] = cloud.color[src * 3 + 1];
      col[d * 3 + 2] = cloud.color[src * 3 + 2];
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return g;
  }, [cloud, showPay, showNonPay]);

  return (
    <points geometry={geo}>
      <pointsMaterial size={0.018} vertexColors sizeAttenuation transparent
        opacity={dark ? 0.72 : 0.85} />
    </points>
  );
}

/** The unit-cube frame — twelve edges, so depth is readable without a grid. */
function Frame({ color }: { color: string }) {
  const geo = useMemo(() => {
    const v: THREE.Vector3[] = [];
    const c = [-1, 1];
    for (const a of c) for (const b of c) {
      v.push(new THREE.Vector3(-1, a, b), new THREE.Vector3(1, a, b));
      v.push(new THREE.Vector3(a, -1, b), new THREE.Vector3(a, 1, b));
      v.push(new THREE.Vector3(a, b, -1), new THREE.Vector3(a, b, 1));
    }
    return new THREE.BufferGeometry().setFromPoints(v);
  }, []);
  return (
    <lineSegments>
      <primitive object={geo} attach="geometry" />
      <lineBasicMaterial color={color} transparent opacity={0.45} />
    </lineSegments>
  );
}

function AxisLabels({ preset, cloud }: { preset: Preset3; cloud: Cloud3D }) {
  // Each axis is labelled at its positive end and ticked along the bottom-back
  // edge, which is the one corner never occluded by the cloud from a default orbit.
  const at = (k: number, t: number): [number, number, number] =>
    (k === 0 ? [t, -1.06, -1.06] : k === 1 ? [-1.06, t, -1.06] : [-1.06, -1.06, t]);
  return (
    <group>
      {preset.axes.map((a, k) => (
        <group key={a.key}>
          <Html position={at(k, 1.18)} center style={{ pointerEvents: 'none' }}>
            <span className="pc3-axlabel" style={{ color: AXIS_COLOR[k] }}>
              {a.label}<i>{a.unit}{a.log ? ' · log' : ''}</i>
            </span>
          </Html>
          {axisTicks(a, cloud.domains[k]).map((t) => (
            <Html key={t.at} position={at(k, t.at)} center style={{ pointerEvents: 'none' }}>
              <span className="pc3-tick">{t.label}</span>
            </Html>
          ))}
        </group>
      ))}
    </group>
  );
}

export function PetroCrossplot3D({ curves }: { curves: FieldCurves }) {
  const [presetId, setPresetId] = useState<Preset3['id']>('fluid');
  const [showPay, setShowPay] = useState(true);
  const [showNonPay, setShowNonPay] = useState(true);
  const [spin, setSpin] = useState(0);   // remounts OrbitControls to reset the view
  const theme = useSceneTheme();

  const preset = PRESETS_3D.find((p) => p.id === presetId) ?? PRESETS_3D[0];
  // The interpretation is handed IN, not read here: the pane decodes the
  // delivery once and both plots project out of it.
  const cloud = useMemo(() => buildCloud3D(curves.bores, preset), [curves.bores, preset]);

  return (
    <section className="pps-region live pc3" style={{ gridArea: 'aside' }}>
      <header>
        <span className="pps-region-ic"><Box size={13} /></span>
        <b>3D crossplot</b>
        <span className="pc3-presets">
          {PRESETS_3D.map((p) => (
            <button key={p.id} className={p.id === presetId ? 'on' : ''}
              onClick={() => setPresetId(p.id)} title={p.hint}>{p.label}</button>
          ))}
        </span>
        <button className="pc3-reset" onClick={() => setSpin((s) => s + 1)} title="Reset the view">
          <RotateCcw size={11} />
        </button>
      </header>

      <div className="pc3-canvas">
        {curves.running && (
          <div className="pc3-progress"><i style={{ width: `${curves.total ? (curves.done / curves.total) * 100 : 0}%` }} /></div>
        )}
        {cloud.blocked ? (
          <div className="pc3-empty">
            <AlertTriangle size={13} />
            <b>{cloud.blocked}</b>
            <span>{cloud.ofWells} bores read · this preset needs {preset.axes.map((a) => a.label).join(' + ')}</span>
          </div>
        ) : (
          // dpr capped at 1.5 rather than 2: a retina canvas is 4× the fragments
          // for a point cloud whose points are 2 px wide, and that is where the
          // frame budget went.
          <Canvas key={spin} camera={{ position: [2.6, 1.9, 2.6], fov: 42 }} dpr={[1, 1.5]}>
            <color attach="background" args={[theme.bg]} />
            <ambientLight intensity={0.9} />
            <Frame color={theme.frame} />
            <AxisLabels preset={preset} cloud={cloud} />
            <Cloud cloud={cloud} showPay={showPay} showNonPay={showNonPay} dark={theme.dark} />
            <OrbitControls enablePan makeDefault minDistance={1.6} maxDistance={9} />
          </Canvas>
        )}
      </div>

      <div className="pc3-legend">
        <button className={showPay ? 'on pay' : 'pay'} onClick={() => setShowPay((v) => !v)}>
          <i /> pay <b>{cloud.pay.toLocaleString('en-US')}</b>
        </button>
        <button className={showNonPay ? 'on non' : 'non'} onClick={() => setShowNonPay((v) => !v)}>
          <i /> non-pay <b>{(cloud.n - cloud.pay - cloud.unclassified).toLocaleString('en-US')}</b>
        </button>
        {cloud.unclassified > 0 && (
          <span className="pc3-unk" title="No net verdict — a curve the cutoffs need was missing at that sample. Shown, not silently dropped.">
            <i /> no verdict <b>{cloud.unclassified.toLocaleString('en-US')}</b>
          </span>
        )}
      </div>

      <p className="pc3-hint">{preset.hint}</p>

      <footer className="pc3-foot">
        {/* Thinning is stated. A plot that silently drops 80% of its samples reads
            as a complete picture, and this one is not one. */}
        <span>
          <b>{cloud.n.toLocaleString('en-US')}</b> drawn
          {cloud.found > cloud.n && <> of <b>{cloud.found.toLocaleString('en-US')}</b> screened (even stride)</>}
        </span>
        <span>{cloud.wellsWithAll}/{cloud.ofWells} bores carry all three</span>
        <span className="pc3-prov">colour is OUR net flag, at the current cutoffs</span>
      </footer>
    </section>
  );
}
