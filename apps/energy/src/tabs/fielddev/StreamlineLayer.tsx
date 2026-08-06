// StreamlineLayer — traced streamlines, drawn in the Static Model's own 3D scene.
//
// ── WHY IT IS AN OVERLAY AND NOT A SECOND VIEWER ────────────────────────────
//
// The lines have to be read against the structure, the grid and the well trajectories.
// A separate 3D canvas would put them next to that instead of in it, and the two could
// disagree about camera, exaggeration and origin without anything on screen saying so.
// So this hands geometry to `GeaStudio` through its scene-frame seam and inherits every
// one of those decisions.
//
// ── DEPTH ───────────────────────────────────────────────────────────────────
//
// The tracer is AREAL: a streamline is a path in map view with no depth of its own. It
// is draped on the reservoir's mid-surface, per column, which is where the flow model
// says the flow is. Where the run carries no structure, it drapes FLAT and says so —
// a flat drape that pretends to follow structure is the lie worth avoiding here.
import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Streamline } from '../../engine/sim/streamline';
import type { SceneFrame } from './GeaStudio';
import type { StoredRun } from './run-store';
import { useThemeInk } from './theme-ink';

export interface StreamlineLayerProps {
  frame: SceneFrame;
  run: StoredRun;
  lines: Streamline[];
  /** producer name → colour, so a line's colour names its destination */
  colourOf: Map<string, string>;
  /** the longest travel time, for fading the slow paths back */
  maxTof: number;
  /** lift the lines a little off the surface so they are not z-fought by it */
  lift?: number;
}

/** depth of the reservoir mid-surface under a map position, or NaN */
function depthAt(run: StoredRun, x: number, y: number): number {
  const g = run.grid;
  const i = Math.floor((x - g.x0) / g.dx);
  const j = Math.floor((y - g.y0) / g.dy);
  if (i < 0 || j < 0 || i >= g.nx || j >= g.ny) return NaN;
  const c = j * g.nx + i;
  if (!g.activeCol[c]) return NaN;
  const t = g.topZ?.[c] ?? NaN, b = g.baseZ?.[c] ?? NaN;
  if (!Number.isFinite(t) || !Number.isFinite(b)) return NaN;
  return (t + b) / 2;
}

export function StreamlineLayer({ frame, run, lines, colourOf, maxTof, lift = 6 }: StreamlineLayerProps) {
  const ink = useThemeInk();
  const object = useMemo(() => {
    // ── ONE OBJECT, NOT ONE PER LINE ──────────────────────────────────────
    //
    // A few hundred THREE.Line objects is a few hundred draw calls every frame, in a
    // scene that is already drawing a 66k-face grid and 25 well paths. Merged into a
    // single LineSegments with per-vertex colour it is ONE, which is what makes a
    // dense fan affordable — and density is the point: two dozen lines read as a
    // handful of arbitrary paths, a few hundred read as a sweep pattern with gaps in
    // it, and the gaps are the finding.
    const g = run.grid;
    let zs = 0, zn = 0;
    for (let c = 0; c < g.nx * g.ny; c++) {
      if (!g.activeCol[c]) continue;
      const t = g.topZ?.[c] ?? NaN, b = g.baseZ?.[c] ?? NaN;
      if (Number.isFinite(t) && Number.isFinite(b)) { zs += (t + b) / 2; zn++; }
    }
    const flat = zn ? zs / zn : NaN;

    const pos: number[] = [], col: number[] = [];
    const grey = new THREE.Color('#94a3b8');
    const tmp = new THREE.Color();

    for (const l of lines) {
      if (l.pts.length < 2) continue;
      const dest = l.toWell ? colourOf.get(l.toWell) : null;
      const base = dest ? tmp.set(dest).clone() : grey;
      // the slow tail fades back, so the fast paths — the ones that control
      // breakthrough — are what the eye lands on
      const speed = maxTof > 0 && Number.isFinite(l.totalTof)
        ? 1 - Math.min(1, l.totalTof / maxTof) : 1;
      // on a LIGHT ground the colours must stay dark to be visible, so the same
      // "faster is stronger" signal runs the other way round
      const amp = dest ? 0.45 + 0.55 * speed : 0.16;

      const v: Array<[number, number, number]> = [];
      for (const [x, y] of l.pts) {
        const d = depthAt(run, x, y);
        const z = Number.isFinite(d) ? d : flat;
        if (!Number.isFinite(z)) continue;
        v.push([x - frame.originX, y - frame.originY, -Math.abs(z - lift) * frame.zScale]);
      }
      if (v.length < 2) continue;

      for (let i = 0; i < v.length - 1; i++) {
        pos.push(v[i][0], v[i][1], v[i][2], v[i + 1][0], v[i + 1][1], v[i + 1][2]);
        // brightening ALONG the line, from injector to producer, so direction of
        // travel is readable without arrowheads cluttering the scene
        for (const t2 of [i / (v.length - 1), (i + 1) / (v.length - 1)]) {
          const along = 0.35 + 0.65 * t2;
          if (ink.dark) {
            const k = amp * along;
            col.push(base.r * k, base.g * k, base.b * k);
          } else {
            // light ground: fade TOWARD the colour from a pale start, so the line
            // still darkens along its travel instead of vanishing into the page
            const k = 1 - amp * along;
            col.push(base.r + (1 - base.r) * k * 0.75,
              base.g + (1 - base.g) * k * 0.75,
              base.b + (1 - base.b) * k * 0.75);
          }
        }
      }
    }

    if (!pos.length) return null;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(pos), 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(col), 3));
    return new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
      vertexColors: true, transparent: true, opacity: 0.95,
      // ADDITIVE ONLY ON A DARK GROUND. Overlapping lines build toward white, which
      // reads as a dense trunk against black and as a hole against the light theme's
      // near-white canvas — the brightest, most-travelled paths would be the ones that
      // disappeared. Normal blending on light.
      blending: ink.dark ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false,
    }));
  }, [lines, run, frame, colourOf, maxTof, lift, ink.dark]);

  useEffect(() => () => {
    if (!object) return;
    object.geometry.dispose();
    (object.material as THREE.Material).dispose();
  }, [object]);

  return object ? <primitive object={object} /> : null;
}
