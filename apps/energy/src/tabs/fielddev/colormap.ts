// colormap.ts — token-safe structural depth ramp + hillshade helper.
// The ramp is built from the theme accent tokens so it re-themes automatically.
import { cssVar } from './hooks';

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '').trim();
  if (s.length === 3) return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Build a depth colour ramp (shallow→deep) from token accents. Returns a
 *  function t∈[0,1] → 'rgb(...)'. t=0 is shallow (crest), t=1 is deep. */
export function depthRamp(): (t: number) => string {
  // crest (warm/amber) → mid (teal) → deep (blue/violet) — geoscience-style.
  const stops = [
    hexToRgb(cssVar('--rose') || '#df7084'),
    hexToRgb(cssVar('--amber') || '#e1ae48'),
    hexToRgb(cssVar('--teal') || '#50d0b1'),
    hexToRgb(cssVar('--blue') || '#62aef7'),
    hexToRgb(cssVar('--violet') || '#b37df0'),
  ];
  return (t: number) => {
    const tt = Math.max(0, Math.min(1, t));
    const seg = tt * (stops.length - 1);
    const i = Math.min(stops.length - 2, Math.floor(seg));
    const [r, g, b] = mix(stops[i], stops[i + 1], seg - i);
    return `rgb(${r | 0},${g | 0},${b | 0})`;
  };
}

export function rampRgba(ramp: (t: number) => string, t: number, alpha: number): string {
  const c = ramp(t); // rgb(r,g,b)
  return c.replace('rgb(', 'rgba(').replace(')', `,${alpha})`);
}
