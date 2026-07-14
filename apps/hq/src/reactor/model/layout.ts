import type { ChoreographyId } from '../contract'
import type { LayerCluster, ReactorLayerSpec } from './layers'

// ─────────────────────────────────────────────────────────────────────────
// Layouts (O5) — the six expansion choreographies as distinct motions.
//
// Every layout interpolates from the SAME compressed rest pose ([0,0,zRest],
// the flat emblem) to a layout-specific target by the explosion scalar e, so
// all six share one flat start and diverge only as the reactor opens. The
// scenario picks one per beat (DEFAULT_CHOREOGRAPHY): triad for THINK/KNOW/DO,
// orbital for product-focus, helix for vault-entry, axial for architecture.
// ─────────────────────────────────────────────────────────────────────────

// Where each THINK/KNOW/DO cluster hinges to in the triad layout.
const TRIAD: Record<LayerCluster, [number, number, number]> = {
  core: [0, 0, 0.2],
  think: [0, 1.75, 1.5],
  know: [-1.85, -1.05, 0.6],
  do: [1.85, -1.05, -0.5],
  signal: [0, 0, 3.4],
}

const GOLDEN = 2.399963229728653

export function layerPosition(
  spec: ReactorLayerSpec,
  layout: ChoreographyId,
  e: number,
  index: number,
  count: number,
): [number, number, number] {
  const mid = (count - 1) / 2
  let tx = 0
  let ty = 0
  let tz = spec.zExploded
  switch (layout) {
    case 'tower': // lift into stacked floors on Y
      tx = 0; ty = (index - mid) * 1.25; tz = 0
      break
    case 'iris': // fan forward into a funnel toward the camera
      tx = 0; ty = 0; tz = index * 0.72
      break
    case 'triad': { // cluster hinge to a triangle
      const p = TRIAD[spec.cluster]
      tx = p[0]; ty = p[1]; tz = p[2]
      break
    }
    case 'orbital': { // scatter into a slow spatial orbit
      const a = index * GOLDEN
      const R = 2.6 + (index % 3) * 0.5
      tx = Math.cos(a) * R; ty = Math.sin(a) * R * 0.62; tz = Math.sin(index * 1.3) * 2.2
      break
    }
    case 'helix': { // spiral around the vertical axis
      const a = index * 0.9
      tx = Math.cos(a) * 2.0; ty = (index - mid) * 0.72; tz = Math.sin(a) * 2.0
      break
    }
    default: // axial — slide apart along the depth axis
      tx = 0; ty = 0; tz = spec.zExploded
  }
  return [tx * e, ty * e, spec.zRest + (tz - spec.zRest) * e]
}
