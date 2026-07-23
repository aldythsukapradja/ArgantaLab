// colorramp.ts (0a) — the shared color engine for every 3D/2D viewer. A palette registry
// (rainbow/jet · viridis · turbo · grayscale · seismic · terrain · oil-water · spectral),
// with reverse, a data domain [min,max], auto-scale, and a GLSL palette-texture bake so
// shaders sample one 256-px ramp. Pure TS (no three/DOM) → unit-testable + worker-safe.
// The ColorPicker UI (0b) drives a ColorState; viewers pass it here.

export type RGB = [number, number, number]; // 0..255
type Stop = [number, RGB];
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

function stopsToFn(stops: Stop[]): (t: number) => RGB {
  return (t) => {
    t = Math.max(0, Math.min(1, t));
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) {
      const [t0, c0] = stops[i - 1], [t1, c1] = stops[i], f = (t - t0) / (t1 - t0 || 1);
      return [lerp(c0[0], c1[0], f), lerp(c0[1], c1[1], f), lerp(c0[2], c1[2], f)];
    }
    return stops[stops.length - 1][1];
  };
}

export interface Palette { id: string; label: string; fn: (t: number) => RGB; group: 'sequential' | 'diverging' | 'domain' }
const P = (id: string, label: string, group: Palette['group'], stops: Stop[]): Palette => ({ id, label, group, fn: stopsToFn(stops) });

export const PALETTES: Palette[] = [
  P('rainbow', 'Rainbow / Jet', 'sequential', [[0, [0, 0, 140]], [0.25, [0, 200, 235]], [0.5, [70, 210, 70]], [0.75, [245, 215, 40]], [1, [200, 20, 20]]]),
  P('viridis', 'Viridis', 'sequential', [[0, [68, 1, 84]], [0.25, [59, 82, 139]], [0.5, [33, 145, 140]], [0.75, [94, 201, 98]], [1, [253, 231, 37]]]),
  P('turbo', 'Turbo', 'sequential', [[0, [48, 18, 59]], [0.25, [40, 160, 220]], [0.5, [90, 220, 110]], [0.75, [240, 190, 50]], [1, [180, 30, 30]]]),
  P('grayscale', 'Dark → White', 'sequential', [[0, [12, 14, 20]], [1, [244, 246, 250]]]),
  P('seismic', 'Seismic', 'diverging', [[0, [30, 60, 175]], [0.5, [246, 246, 246]], [1, [180, 30, 30]]]),
  P('spectral', 'Spectral', 'diverging', [[0, [180, 30, 30]], [0.25, [245, 170, 60]], [0.5, [250, 245, 160]], [0.75, [110, 200, 160]], [1, [50, 90, 175]]]),
  P('terrain', 'Terrain', 'sequential', [[0, [40, 90, 120]], [0.35, [60, 150, 120]], [0.6, [200, 195, 130]], [0.85, [150, 120, 95]], [1, [246, 246, 246]]]),
  P('oilwater', 'Oil → Water', 'domain', [[0, [56, 161, 105]], [0.5, [90, 175, 175]], [1, [41, 107, 204]]]),
  P('phi', 'Porosity', 'sequential', [[0, [40, 40, 70]], [0.5, [90, 150, 200]], [1, [250, 240, 130]]]),
];
export const PALETTE_BY_ID = (id: string) => PALETTES.find((p) => p.id === id) || PALETTES[0];

// ── domain + state ─────────────────────────────────────────────────────────────
export interface ColorState { palette: string; reverse: boolean; auto: boolean; min: number; max: number }
export const defaultColorState = (palette = 'viridis'): ColorState => ({ palette, reverse: false, auto: true, min: 0, max: 1 });

/** min/max over finite values — the auto-scale domain. */
export function autoDomain(values: ArrayLike<number>): { min: number; max: number } {
  let min = Infinity, max = -Infinity;
  for (let i = 0; i < values.length; i++) { const v = values[i]; if (Number.isFinite(v)) { if (v < min) min = v; if (v > max) max = v; } }
  return min <= max ? { min, max } : { min: 0, max: 1 };
}

/** Effective [min,max] for a state: auto → computed from the data, else the manual pair. */
export function effectiveDomain(s: ColorState, data?: ArrayLike<number>): { min: number; max: number } {
  if (s.auto && data) return autoDomain(data);
  return { min: s.min, max: s.max };
}

/** value → normalized t∈[0,1], honoring domain + reverse. */
export function normT(v: number, dom: { min: number; max: number }, reverse = false): number {
  const span = dom.max - dom.min || 1;
  const t = Math.max(0, Math.min(1, (v - dom.min) / span));
  return reverse ? 1 - t : t;
}

/** value → RGB through a full color state (+ its resolved domain). */
export function colorOf(v: number, s: ColorState, dom: { min: number; max: number }): RGB {
  return PALETTE_BY_ID(s.palette).fn(normT(v, dom, s.reverse));
}

/** Bake a palette (with reverse) to RGBA bytes for a THREE.DataTexture (256×1 default). */
export function paletteTextureData(paletteId: string, reverse = false, n = 256): Uint8Array {
  const fn = PALETTE_BY_ID(paletteId).fn, out = new Uint8Array(n * 4);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), [r, g, b] = fn(reverse ? 1 - t : t);
    out[i * 4] = Math.round(r); out[i * 4 + 1] = Math.round(g); out[i * 4 + 2] = Math.round(b); out[i * 4 + 3] = 255;
  }
  return out;
}

/** A CSS gradient string for palette-preview swatches (used by the picker UI). */
export function cssGradient(paletteId: string, reverse = false, stops = 8): string {
  const fn = PALETTE_BY_ID(paletteId).fn, parts: string[] = [];
  for (let i = 0; i < stops; i++) { const t = i / (stops - 1), [r, g, b] = fn(reverse ? 1 - t : t); parts.push(`rgb(${r | 0},${g | 0},${b | 0}) ${(t * 100).toFixed(0)}%`); }
  return `linear-gradient(90deg, ${parts.join(', ')})`;
}
