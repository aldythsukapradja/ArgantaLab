// MARK — declarative brand geometry, rendered two ways from ONE source.
//
// A logo must be deterministic: pixel-identical forever, infinitely scalable,
// diffable in git. So marks are not AI-generated rasters and not hand-copied
// twice — they are DATA (primitive shapes in a viewBox), and this file draws
// that data onto either a canvas (postEngine stamps every slide) or an SVG
// string (logo files, favicons, press kits).
//
// Because both renderers read the same shape list, the carousel in Instagram
// and the .svg in the press kit cannot silently disagree.
//
// Shape kinds: roundRect | polygon | line | circle | group
// Paint refs:  "@name" resolves to mark.gradients[name]; anything else is a
//              literal CSS color.

const isGrad = (p) => typeof p === 'string' && p.startsWith('@')

function roundRectPath(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + rr, y)
  ctx.arcTo(x + w, y, x + w, y + h, rr)
  ctx.arcTo(x + w, y + h, x, y + h, rr)
  ctx.arcTo(x, y + h, x, y, rr)
  ctx.arcTo(x, y, x + w, y, rr)
  ctx.closePath()
}

/** Bounding box of a shape in viewBox units — gradients are resolved against
 *  it to mirror SVG's default gradientUnits="objectBoundingBox". Getting this
 *  wrong restretches the logo's gradient across the whole tile, which is
 *  exactly the kind of silent drift this package exists to prevent. */
function bboxOf(s) {
  if (s.kind === 'roundRect') return { x: s.x, y: s.y, w: s.w, h: s.h }
  if (s.kind === 'circle') return { x: s.cx - s.r, y: s.cy - s.r, w: s.r * 2, h: s.r * 2 }
  if (s.kind === 'polygon') {
    const xs = s.points.map((p) => p[0]), ys = s.points.map((p) => p[1])
    const x = Math.min(...xs), y = Math.min(...ys)
    return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
  }
  if (s.kind === 'line') {
    const x = Math.min(s.x1, s.x2), y = Math.min(s.y1, s.y2)
    return { x, y, w: Math.abs(s.x2 - s.x1), h: Math.abs(s.y2 - s.y1) }
  }
  return { x: 0, y: 0, w: 0, h: 0 }
}

/** Build a canvas gradient over a shape's bbox, in scaled canvas space. */
function canvasGradient(ctx, g, bb, ox, oy, k) {
  const px = (u) => ox + (bb.x + u * bb.w) * k
  const py = (v) => oy + (bb.y + v * bb.h) * k
  if (g.type === 'radial') {
    const cx = px(g.cx ?? 0.5), cy = py(g.cy ?? 0.5)
    const r = (g.r ?? 0.5) * Math.max(bb.w, bb.h) * k
    const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, r || 1)
    for (const [off, col] of g.stops) rg.addColorStop(off, col)
    return rg
  }
  const [x1, y1] = g.from || [0, 0]
  const [x2, y2] = g.to || [1, 1]
  const lg = ctx.createLinearGradient(px(x1), py(y1), px(x2), py(y2))
  for (const [off, col] of g.stops) lg.addColorStop(off, col)
  return lg
}

function paint(ctx, mark, ref, bb, ox, oy, k) {
  if (isGrad(ref)) {
    const g = mark.gradients?.[ref.slice(1)]
    return g ? canvasGradient(ctx, g, bb, ox, oy, k) : '#888888'
  }
  return ref
}

function drawShapes(ctx, mark, shapes, x, y, size, k) {
  for (const s of shapes) {
    if (s.kind === 'group') {
      ctx.save()
      ctx.translate((s.dx || 0) * k, (s.dy || 0) * k)
      drawShapes(ctx, mark, s.shapes || [], x, y, size, k)
      ctx.restore()
      continue
    }
    // Trace the path
    if (s.kind === 'roundRect') roundRectPath(ctx, x + s.x * k, y + s.y * k, s.w * k, s.h * k, (s.r || 0) * k)
    else if (s.kind === 'polygon') {
      ctx.beginPath()
      s.points.forEach(([px, py], i) => {
        const cx = x + px * k, cy = y + py * k
        i === 0 ? ctx.moveTo(cx, cy) : ctx.lineTo(cx, cy)
      })
      ctx.closePath()
    } else if (s.kind === 'line') {
      ctx.beginPath()
      ctx.moveTo(x + s.x1 * k, y + s.y1 * k)
      ctx.lineTo(x + s.x2 * k, y + s.y2 * k)
    } else if (s.kind === 'circle') {
      ctx.beginPath()
      ctx.arc(x + s.cx * k, y + s.cy * k, s.r * k, 0, Math.PI * 2)
    } else continue

    const bb = bboxOf(s)
    if (s.fill) {
      ctx.globalAlpha = s.fillOpacity ?? 1
      ctx.fillStyle = paint(ctx, mark, s.fill, bb, x, y, k)
      ctx.fill()
    }
    if (s.stroke) {
      ctx.globalAlpha = s.strokeOpacity ?? 1
      ctx.strokeStyle = paint(ctx, mark, s.stroke, bb, x, y, k)
      ctx.lineWidth = (s.strokeWidth || 1) * k
      ctx.lineJoin = s.strokeLinejoin || 'miter'
      ctx.stroke()
    }
    ctx.globalAlpha = 1
  }
}

/**
 * Draw a mark onto a 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} mark      the brand's identity.mark
 * @param {number} x,y       top-left in canvas pixels
 * @param {number} size      edge length in canvas pixels
 * @param {string} variant   'core' (the tile — slides) | 'profile' (avatar)
 */
export function drawMark(ctx, mark, x, y, size, variant = 'core') {
  if (!mark) return
  const shapes = mark.variants?.[variant] || mark.variants?.core || []
  const k = size / (mark.viewBox || 1080)
  ctx.save()
  drawShapes(ctx, mark, shapes, x, y, size, k)
  ctx.restore()
}

// ── SVG export ────────────────────────────────────────────────
const esc = (v) => String(v).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]))
const attr = (o) => Object.entries(o).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')

function gradDefs(mark) {
  const out = []
  for (const [name, g] of Object.entries(mark.gradients || {})) {
    const stops = g.stops.map(([o, c]) => `<stop offset="${o}" stop-color="${esc(c)}"/>`).join('')
    if (g.type === 'radial') {
      out.push(`<radialGradient id="${esc(name)}" cx="${(g.cx ?? 0.5) * 100}%" cy="${(g.cy ?? 0.5) * 100}%" r="${(g.r ?? 0.5) * 100}%">${stops}</radialGradient>`)
    } else {
      const [x1, y1] = g.from || [0, 0]; const [x2, y2] = g.to || [1, 1]
      out.push(`<linearGradient id="${esc(name)}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops}</linearGradient>`)
    }
  }
  return out.join('')
}

const svgPaint = (ref) => (isGrad(ref) ? `url(#${ref.slice(1)})` : ref)

function shapesToSvg(shapes) {
  return shapes.map((s) => {
    if (s.kind === 'group') {
      return `<g transform="translate(${s.dx || 0},${s.dy || 0})">${shapesToSvg(s.shapes || [])}</g>`
    }
    const common = {
      fill: s.fill ? svgPaint(s.fill) : 'none',
      'fill-opacity': s.fillOpacity,
      stroke: s.stroke ? svgPaint(s.stroke) : undefined,
      'stroke-opacity': s.strokeOpacity,
      'stroke-width': s.strokeWidth,
      'stroke-linejoin': s.strokeLinejoin,
    }
    if (s.kind === 'roundRect') return `<rect ${attr({ x: s.x, y: s.y, width: s.w, height: s.h, rx: s.r, ...common })}/>`
    if (s.kind === 'polygon') return `<polygon ${attr({ points: s.points.map((p) => p.join(',')).join(' '), ...common })}/>`
    if (s.kind === 'line') return `<line ${attr({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, ...common })}/>`
    if (s.kind === 'circle') return `<circle ${attr({ cx: s.cx, cy: s.cy, r: s.r, ...common })}/>`
    return ''
  }).join('')
}

/** Render the mark as a standalone SVG document string. */
export function markToSvg(mark, { size = 1080, variant = 'core' } = {}) {
  if (!mark) return ''
  const vb = mark.viewBox || 1080
  const shapes = mark.variants?.[variant] || mark.variants?.core || []
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}">` +
    `<defs>${gradDefs(mark)}</defs>${shapesToSvg(shapes)}</svg>`
}

/** Variants a mark actually defines. */
export const markVariants = (mark) => Object.keys(mark?.variants || {})
