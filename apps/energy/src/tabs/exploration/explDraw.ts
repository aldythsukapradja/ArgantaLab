// explDraw.ts — shared canvas helpers for the exploration map viewers (Basemap /
// Volumetrics / Interpretation). Thin wrappers over the V1 grid/view engine so each
// viewer stays lean. Token colours only; north-up; contact-aware shading.
import type { SurfaceJson } from '../../engine/grid';
import { cellZ } from '../../engine/grid';
import type { View } from '../../engine/view';
import { depthRamp } from '../fielddev/colormap';
import { cssVar } from '../fielddev/hooks';

/** Paint a depth surface cell-by-cell; cells below `contact` (deeper) are dimmed so
 *  the crest-connected trap stands out. */
export function drawSurface(ctx: CanvasRenderingContext2D, view: View, g: SurfaceJson, minmax: { min: number; max: number }, contact?: number) {
  const ramp = depthRamp();
  const span = Math.max(1e-6, minmax.max - minmax.min);
  const px = Math.max(1, view.s * g.cell * 1.03);
  for (let k = 0; k < g.ny; k++) for (let i = 0; i < g.nx; i++) {
    const z = cellZ(g, i, k); if (z == null) continue;
    const wx = g.x0 + i * g.cell, wy = g.y0 + k * g.cell;
    ctx.globalAlpha = contact != null ? (z < contact ? 1 : 0.22) : 1;
    ctx.fillStyle = ramp((z - minmax.min) / span);
    ctx.fillRect(view.toX(wx) - px / 2, view.toY(wy) - px / 2, px, px);
  }
  ctx.globalAlpha = 1;
}

/** Stroke a closed ring (e.g. a contact/closure polygon) in a token colour. */
export function drawRing(ctx: CanvasRenderingContext2D, view: View, ring: Array<[number, number]>, color = '--rose', width = 1.6) {
  if (!ring.length) return;
  ctx.strokeStyle = cssVar(color); ctx.lineWidth = width; ctx.beginPath();
  ring.forEach(([x, y], i) => { const sx = view.toX(x), sy = view.toY(y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
  ctx.closePath(); ctx.stroke();
}

/** Post well markers (surface x/y) with a label; `active` gets a larger ringed dot. */
export function drawWells(ctx: CanvasRenderingContext2D, view: View, wells: Array<{ name: string; x: number; y: number }>, active?: string, color = '--green') {
  ctx.font = `10px ${cssVar('--mono')}, monospace`;
  for (const w of wells) {
    const sx = view.toX(w.x), sy = view.toY(w.y); const on = w.name === active;
    ctx.fillStyle = cssVar(color); ctx.strokeStyle = cssVar('--bg'); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(sx, sy, on ? 5.5 : 3.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (on) { ctx.strokeStyle = cssVar('--ink'); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(sx, sy, 9, 0, Math.PI * 2); ctx.stroke(); }
    ctx.fillStyle = cssVar('--ink'); ctx.fillText(w.name, sx + 8, sy + 3);
  }
}
