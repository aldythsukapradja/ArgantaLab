import { TILE } from '../farm-map.js';

// Shared helpers for realm loop modules (drawing + geometry + cooldowns).
// Keeps each world module tiny and consistent.

export const px = (t) => t * TILE;              // tile -> world px (corner)
export const cx = (t) => (t + 0.5) * TILE;      // tile -> world px (center)
export const tileDist = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);
export const euclid = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A labelled station/pad drawn in WORLD space at tile (tx,ty) spanning wTiles×hTiles.
export function drawPad(ctx, tx, ty, wTiles, hTiles, { color = '#ffffff', label = '', icon = '', active = false, dim = false } = {}) {
  const x = px(tx), y = px(ty), w = wTiles * TILE, h = hTiles * TILE;
  ctx.save();
  ctx.globalAlpha = dim ? 0.55 : 1;
  roundRect(ctx, x + 4, y + 4, w - 8, h - 8, 12);
  ctx.fillStyle = 'rgba(15,18,34,.55)';
  ctx.fill();
  ctx.lineWidth = active ? 5 : 3;
  ctx.strokeStyle = color;
  if (active) { ctx.shadowColor = color; ctx.shadowBlur = 16; }
  ctx.stroke();
  ctx.shadowBlur = 0;
  if (icon) {
    ctx.font = `${Math.floor(h * 0.42)}px system-ui, sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.fillText(icon, x + w / 2, y + h * 0.44);
  }
  if (label) {
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.lineWidth = 3;
    ctx.strokeText(label, x + w / 2, y + h - 14);
    ctx.fillText(label, x + w / 2, y + h - 14);
  }
  ctx.restore();
}

// A small progress ring (0..1) centred on a world point.
export function drawRing(ctx, wx, wy, r, pct, color) {
  ctx.save();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.beginPath(); ctx.arc(wx, wy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = color;
  ctx.beginPath(); ctx.arc(wx, wy, r, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2); ctx.stroke();
  ctx.restore();
}

// Cooldown-aware controller action builder.
export function action(id, label, icon, opts = {}) {
  return { id, label, icon, kind: opts.kind || 'skill', cooldownMs: opts.cooldownMs, cooldownUntil: opts.cooldownUntil, disabledReason: opts.disabledReason };
}

// A simple cooldown tracker keyed by action id.
export function makeCooldowns() {
  const until = {};
  return {
    trigger(id, ms) { until[id] = performance.now() + ms; },
    left(id) { return Math.max(0, (until[id] || 0) - performance.now()); },
    until(id) { return until[id] || 0; },
    ready(id) { return (until[id] || 0) <= performance.now(); },
  };
}
