// Slice a Kenney spritesheet into individual sprite PNGs. The two sheets are
// already in the repo (CC0), so this needs no network — real Kenney pixels at
// volume, fully testable offline. Kenney sheets use 16px tiles with 1px spacing
// (stride 17). Fully-transparent tiles are skipped.
import { PNG } from 'pngjs'

export interface Tile { r: number; c: number; png: Buffer; colors: number }

export function sliceSheet(buf: Buffer, tile = 16, stride = 17): Tile[] {
  const sheet = PNG.sync.read(buf)
  const cols = Math.floor((sheet.width + (stride - tile)) / stride)
  const rows = Math.floor((sheet.height + (stride - tile)) / stride)
  const out: Tile[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const ox = c * stride, oy = r * stride
      const t = new PNG({ width: tile, height: tile })
      const seen = new Set<string>()
      let anyOpaque = false
      for (let y = 0; y < tile; y++) {
        for (let x = 0; x < tile; x++) {
          const sIdx = ((oy + y) * sheet.width + (ox + x)) * 4
          const dIdx = (y * tile + x) * 4
          const R = sheet.data[sIdx], G = sheet.data[sIdx + 1], B = sheet.data[sIdx + 2], A = sheet.data[sIdx + 3]
          t.data[dIdx] = R; t.data[dIdx + 1] = G; t.data[dIdx + 2] = B; t.data[dIdx + 3] = A
          if (A > 8) { anyOpaque = true; seen.add(`${R},${G},${B}`) }
        }
      }
      // skip blanks and single-flat-color tiles (usually padding/background swatches)
      if (anyOpaque && seen.size >= 2) out.push({ r, c, png: PNG.sync.write(t), colors: seen.size })
    }
  }
  return out
}
