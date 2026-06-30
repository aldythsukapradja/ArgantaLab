// =========================================================
//  Shared integration kit for native apps — the one place apps
//  reach OUT to the rest of KinetikCircle: Calendar, Moments,
//  image export, and Web Share. Keeps every app consistent and
//  means "link it to calendar / moments" is a one-liner per app.
// =========================================================
import { useDataStore } from '@store/dataStore'
import { postMoment } from '@repo/momentsRepo'

/* ── Calendar ─────────────────────────────────────────────
   Apps drop one-off events or multi-day blocks straight onto the
   shared family calendar (same store the Calendar tab reads). */
export async function addCalendarEvent(e: {
  circleId: string; title: string; date: string; start?: string; end?: string; who?: string[]
}): Promise<void> {
  await useDataStore.getState().addEvent({
    circleId: e.circleId, title: e.title, date: e.date,
    start: e.start ?? '18:00', end: e.end ?? '19:00', who: e.who ?? [],
  })
}

/** A multi-day block (trips etc.) — renders as a spanning bar on the month. */
export async function addCalendarBlock(b: {
  circleId: string; title: string; date: string; endDate: string; who?: string[]
}): Promise<void> {
  await useDataStore.getState().addBlock({
    circleId: b.circleId, title: b.title, date: b.date, endDate: b.endDate, who: b.who ?? [],
  })
}

/* ── Moments ──────────────────────────────────────────────
   Share an app result (text + an optional generated image) into
   the circle's Moments feed as a real photo/kudos post. */
export async function shareToMoment(opts: {
  circleId: string; body: string; blob?: Blob | null; filename?: string; tags?: string[]
}): Promise<void> {
  const media = opts.blob
    ? [{ file: new File([opts.blob], opts.filename ?? 'kinetik.png', { type: 'image/png' }), kind: 'photo' as const }]
    : undefined
  await postMoment({
    circleId: opts.circleId,
    kind: media ? 'photo' : 'kudos',
    body: opts.body,
    audience: 'circle',
    media,
    tags: opts.tags ?? [],
  })
}

/* ── Web Share / download ─────────────────────────────────
   Native share sheet when available (with the file), otherwise a
   plain download. Used by every app's export cards. */
export async function shareOrDownload(blob: Blob, filename: string, text?: string): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type || 'image/png' })
  const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean }
  if (nav.share && (!nav.canShare || nav.canShare({ files: [file] }))) {
    try { await nav.share({ files: [file], text }); return 'shared' } catch { /* user cancelled → fall through */ }
  }
  download(blob, filename)
  return 'downloaded'
}

export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ── Canvas export card (1080×1350 story format) ──────────
   Shared premium result-card builder ported from the padel
   reference. Apps pass a draw(ctx, helpers) callback. */
export interface CardHelpers {
  W: number; H: number; font: string
  roundRect: (x: number, y: number, w: number, h: number, r: number) => void
  fit: (text: string, maxW: number, start: number, weight: number) => number
  bgGradient: (stops: [number, string][]) => void
}

export function buildCard(accent: [string, string], draw: (ctx: CanvasRenderingContext2D, h: CardHelpers) => void): Promise<Blob> {
  const W = 1080, H = 1350
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')!
  const font = '-apple-system,BlinkMacSystemFont,Segoe UI,Arial'
  const roundRect = (x: number, y: number, w: number, h: number, r: number) => {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r)
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r)
    ctx.closePath()
  }
  const fit = (text: string, maxW: number, start: number, weight: number) => {
    let z = start
    do { ctx.font = `${weight} ${z}px ${font}`; if (ctx.measureText(text).width <= maxW) return z; z -= 2 } while (z > 20)
    return z
  }
  const bgGradient = (stops: [number, string][]) => {
    const g = ctx.createLinearGradient(0, 0, W, H)
    for (const [at, col] of stops) g.addColorStop(at, col)
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  }
  // default brand backdrop = the app accent, deepened
  bgGradient([[0, '#08111f'], [0.5, accent[0]], [1, accent[1]]])
  draw(ctx, { W, H, font, roundRect, fit, bgGradient })
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(b => (b ? resolve(b) : reject(new Error('Could not render image'))), 'image/png'))
}

/* ── Bulk-name paste detection (comma / newline / space) ── */
export function detectNames(raw: string): { mode: string; names: string[] } {
  const text = raw.trim()
  if (!text) return { mode: 'None', names: [] }
  const cands: { mode: string; index: number; splitter: RegExp }[] = []
  const comma = text.indexOf(','); if (comma >= 0) cands.push({ mode: 'Comma', index: comma, splitter: /,/ })
  const nl = text.search(/[\r\n]/); if (nl >= 0) cands.push({ mode: 'Line break', index: nl, splitter: /[\r\n]+/ })
  const sp = text.search(/[ \t]+/); if (sp >= 0) cands.push({ mode: 'Space', index: sp, splitter: /[ \t]+/ })
  if (!cands.length) return { mode: 'Single name', names: [text] }
  cands.sort((a, b) => a.index - b.index)
  return { mode: cands[0].mode, names: text.split(cands[0].splitter).map(s => s.trim()).filter(Boolean) }
}

/* ── Error message extraction (Supabase errors are plain objects) ── */
export function errMsg(e: unknown): string {
  if (!e) return 'Something went wrong'
  if (e instanceof Error) return e.message
  if (typeof e === 'object') {
    const o = e as Record<string, unknown>
    const parts = [o.message, o.details, o.hint].filter(Boolean) as string[]
    if (parts.length) return parts.join(' · ')
    if (o.code) return `Error ${o.code}`
  }
  return String(e)
}
