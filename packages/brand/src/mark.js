// MARK — declarative brand geometry, rendered two ways from ONE source.
//
// A logo must be deterministic: pixel-identical forever, infinitely scalable,
// diffable in git. So marks are not AI-generated rasters and not hand-copied
// twice — they are DATA (primitive shapes in a viewBox), and this file draws
// that data onto either a canvas (postEngine stamps every slide) or an SVG
// string (logo files, favicons, press kits).
//
// Because both renderers read the same shape list, the carousel on Instagram
// and the .svg in the press kit cannot silently disagree.
//
// Shape kinds
//   roundRect · polygon · line · circle · group · path
//
//   `path` carries raw SVG path data and is drawn with Path2D — the browser
//   rasterizes exactly what the .svg would. That is what lets a mark use arcs,
//   béziers and open polylines (handoff v2's Resonance Rings, Bloom and Wire
//   Cube all need them) without this file learning to parse path syntax. It also
//   means no future mark can outgrow the schema.
//
// Paint refs
//   "@name" resolves against mark.gradients[name] first, then mark.tokens[name];
//   anything else is a literal CSS colour. Tokens are how a mark stays
//   theme-agnostic: geometry is authored once with stroke:"@line", and the
//   caller passes the light palette's tokens to flip it.
//
// Coordinate system
//   Everything is authored in viewBox units. drawMark applies ONE transform
//   (translate + scale) and every shape — including stroke widths and gradient
//   stops — is then expressed in those units. Nothing is pre-multiplied by hand.

const isRef = (p) => typeof p === 'string' && p.startsWith('@')

/** Bounding box in viewBox units. Gradients resolve against it to mirror SVG's
 *  default gradientUnits="objectBoundingBox" — get this wrong and the gradient
 *  restretches across the whole tile (it did, once).
 *
 *  A `path` cannot be measured here: Path2D exposes no bounds and this file
 *  refuses to parse path data. Its bbox is therefore DATA, computed once at
 *  transcription (SVGGraphicsElement.getBBox) and stored beside the `d`. When a
 *  path with a gradient has no bbox we fall back to the full viewBox and say so
 *  — a wrong gradient that renders is worse than a loud one that doesn't. */
function bboxOf(s, viewBox) {
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
  if (s.kind === 'path') return s.bbox || { x: 0, y: 0, w: viewBox, h: viewBox }
  return { x: 0, y: 0, w: 0, h: 0 }
}

/** Build a canvas gradient over a shape's bbox, in viewBox units. */
function canvasGradient(ctx, g, bb) {
  const px = (u) => bb.x + u * bb.w
  const py = (v) => bb.y + v * bb.h
  if (g.type === 'radial') {
    const cx = px(g.cx ?? 0.5), cy = py(g.cy ?? 0.5)
    const r = (g.r ?? 0.5) * Math.max(bb.w, bb.h)
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

function paint(ctx, mark, ref, bb, tokens) {
  if (!isRef(ref)) return ref
  const name = ref.slice(1)
  const g = mark.gradients?.[name]
  if (g) return canvasGradient(ctx, g, bb)
  return (tokens && tokens[name]) || mark.tokens?.[name] || '#888888'
}

/** One shape → one Path2D, in viewBox units. */
function shapePath(s) {
  const p = new Path2D()
  if (s.kind === 'path') return new Path2D(s.d)
  if (s.kind === 'roundRect') {
    const r = Math.min(s.r || 0, s.w / 2, s.h / 2)
    p.moveTo(s.x + r, s.y)
    p.arcTo(s.x + s.w, s.y, s.x + s.w, s.y + s.h, r)
    p.arcTo(s.x + s.w, s.y + s.h, s.x, s.y + s.h, r)
    p.arcTo(s.x, s.y + s.h, s.x, s.y, r)
    p.arcTo(s.x, s.y, s.x + s.w, s.y, r)
    p.closePath()
  } else if (s.kind === 'polygon') {
    s.points.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)))
    p.closePath()
  } else if (s.kind === 'line') {
    p.moveTo(s.x1, s.y1); p.lineTo(s.x2, s.y2)
  } else if (s.kind === 'circle') {
    p.arc(s.cx, s.cy, s.r, 0, Math.PI * 2)
  }
  return p
}

function drawShapes(ctx, mark, shapes, tokens) {
  for (const s of shapes) {
    if (s.kind === 'group') {
      ctx.save()
      ctx.translate(s.dx || 0, s.dy || 0)
      drawShapes(ctx, mark, s.shapes || [], tokens)
      ctx.restore()
      continue
    }
    const p = shapePath(s)
    if (!p) continue
    const bb = bboxOf(s, mark.viewBox || 1080)
    if (s.fill) {
      ctx.globalAlpha = s.fillOpacity ?? 1
      ctx.fillStyle = paint(ctx, mark, s.fill, bb, tokens)
      ctx.fill(p)
    }
    if (s.stroke) {
      ctx.globalAlpha = s.strokeOpacity ?? 1
      ctx.strokeStyle = paint(ctx, mark, s.stroke, bb, tokens)
      ctx.lineWidth = s.strokeWidth || 1
      ctx.lineJoin = s.strokeLinejoin || 'miter'
      ctx.lineCap = s.strokeLinecap || 'butt'
      ctx.stroke(p)
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
 * @param {string} variant   which geometry — 'core' (slides) | 'profile' (avatar)
 *                           | 'compact' | 'glyph' (small sizes)
 * @param {object} [opts]    { tokens } — override the mark's colour tokens, e.g.
 *                           the light-ground stroke.
 *
 * One transform does all the scaling, so stroke widths and gradients are simply
 * authored in viewBox units and come out right at any size.
 */
export function drawMark(ctx, mark, x, y, size, variant = 'core', opts = {}) {
  if (!mark) return
  const shapes = mark.variants?.[variant] || mark.variants?.core || []
  const k = size / (mark.viewBox || 1080)
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(k, k)
  drawShapes(ctx, mark, shapes, opts.tokens)
  ctx.restore()
}

/**
 * The variant to draw at a given rendered size.
 *
 * A monoline mark authored at 1024 dies at 40: a 2.5px stroke on a 120 viewBox
 * is 2.08% of the mark, i.e. 0.83px on an Instagram avatar and 0.33px on a
 * favicon — sub-pixel, antialiased to mush. A brand system is judged at its
 * SMALLEST deployment, so marks ship a ladder and the renderer picks.
 * Falls through to whatever exists: glyph → compact → core.
 */
export function variantForSize(mark, px) {
  const v = mark?.variants || {}
  if (px <= 24 && v.glyph) return 'glyph'
  if (px <= 96 && v.compact) return 'compact'
  return v.core ? 'core' : Object.keys(v)[0]
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

const svgPaint = (mark, ref, tokens) => {
  if (!isRef(ref)) return ref
  const name = ref.slice(1)
  if (mark.gradients?.[name]) return `url(#${name})`
  return (tokens && tokens[name]) || mark.tokens?.[name] || '#888888'
}

function shapesToSvg(mark, shapes, tokens) {
  return shapes.map((s) => {
    if (s.kind === 'group') {
      return `<g transform="translate(${s.dx || 0},${s.dy || 0})">${shapesToSvg(mark, s.shapes || [], tokens)}</g>`
    }
    const common = {
      fill: s.fill ? svgPaint(mark, s.fill, tokens) : 'none',
      'fill-opacity': s.fillOpacity,
      stroke: s.stroke ? svgPaint(mark, s.stroke, tokens) : undefined,
      'stroke-opacity': s.strokeOpacity,
      'stroke-width': s.strokeWidth,
      'stroke-linejoin': s.strokeLinejoin,
      'stroke-linecap': s.strokeLinecap,
    }
    if (s.kind === 'path') return `<path ${attr({ d: s.d, ...common })}/>`
    if (s.kind === 'roundRect') return `<rect ${attr({ x: s.x, y: s.y, width: s.w, height: s.h, rx: s.r, ...common })}/>`
    if (s.kind === 'polygon') return `<polygon ${attr({ points: s.points.map((p) => p.join(',')).join(' '), ...common })}/>`
    if (s.kind === 'line') return `<line ${attr({ x1: s.x1, y1: s.y1, x2: s.x2, y2: s.y2, ...common })}/>`
    if (s.kind === 'circle') return `<circle ${attr({ cx: s.cx, cy: s.cy, r: s.r, ...common })}/>`
    return ''
  }).join('')
}

/** Render the mark as a standalone SVG document string. */
export function markToSvg(mark, { size = 1080, variant = 'core', tokens } = {}) {
  if (!mark) return ''
  const vb = mark.viewBox || 1080
  const shapes = mark.variants?.[variant] || mark.variants?.core || []
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${vb} ${vb}">` +
    `<defs>${gradDefs(mark)}</defs>${shapesToSvg(mark, shapes, tokens)}</svg>`
}

/** Variants a mark actually defines. */
export const markVariants = (mark) => Object.keys(mark?.variants || {})
