import type { ChoreographyId, CoreState } from '../contract'
import { DEFAULT_CHOREOGRAPHY } from '../contract'
import type { LayerCluster } from './layers'

// ─────────────────────────────────────────────────────────────────────────
// Choreography — semantic state → how the reactor sits/moves.
//
// `explosion` (0..1) drives the axial accordion: each layer lerps zRest→
// zExploded by this amount. `camera` frames it (distances sized so nothing
// clips at the 30° lens). `flare` emphasises a cluster per beat. This is the
// spine's single choreography (axial); the other presets (triad/orbital/
// helix) will re-map the same scalars per beat in a later pass.
// ─────────────────────────────────────────────────────────────────────────

type Cluster = LayerCluster
export type { Cluster }

export interface ChoreoTarget {
  camera: [number, number, number]
  /** 0 = flat compressed emblem · 1 = fully exploded fan. */
  explosion: number
  /** Per-cluster emphasis, ~0.3 dim … 1.6 flared. */
  flare: Record<Cluster, number>
  /** Tonemap exposure for the beat. */
  exposure: number
  /** Which expansion layout to arrange the layers with. */
  layout: ChoreographyId
}

const FRONT: [number, number, number] = [0, 0, 18]
const THREE_Q: [number, number, number] = [6.5, 3.8, 17]
const WIDE: [number, number, number] = [8.5, 5, 18]

const FLAT: Record<Cluster, number> = { core: 1.0, think: 0.7, know: 0.7, do: 0.7, signal: 0.6 }
// Command Core (cluster 'core') stays bright/stable across beats — authority,
// not activity — so it never dims as far as the other clusters.
const dim = (over: Partial<Record<Cluster, number>>): Record<Cluster, number> =>
  ({ core: 0.9, think: 0.4, know: 0.4, do: 0.4, signal: 0.4, ...over })

const ARCH_FLARE: Record<Cluster, number> = { core: 1.1, think: 1.1, know: 1.1, do: 1.1, signal: 0.9 }

function easeOutCubic(t: number) { return 1 - (1 - t) ** 3 }
function easeInCubic(t: number) { return t ** 3 }

/**
 * @param progress 0..1 elapsed within the current beat (scene.sceneTime /
 * scene.sceneDuration). Used by beats whose explosion amount animates across
 * the scene's own duration rather than sitting at one fixed value.
 */
export function choreoFor(state: CoreState, choreography?: ChoreographyId, progress = 0): ChoreoTarget {
  return { ...baseFor(state, progress), layout: choreography ?? DEFAULT_CHOREOGRAPHY[state] }
}

function baseFor(state: CoreState, progress: number): Omit<ChoreoTarget, 'layout'> {
  switch (state) {
    case 'offline':
      return { camera: FRONT, explosion: 0, exposure: 0.72, flare: dim({ core: 0.15, think: 0.12, know: 0.12, do: 0.12, signal: 0.12 }) }
    case 'booting':
      // Ignition: the reactor visibly cracks open as it powers on — a small
      // "breath" — then settles flat once idle takes over.
      return { camera: FRONT, explosion: 0.32 * easeOutCubic(progress), exposure: 1.05, flare: FLAT }
    case 'idle':
    case 'listening':
    case 'jarvis-speaking':
    case 'specialist-speaking':
      return { camera: FRONT, explosion: 0, exposure: 1.15, flare: FLAT }
    case 'product-focus':
      return { camera: [0, 0, 17], explosion: 0.18, exposure: 1.2, flare: dim({ core: 0.7, do: 1.4, signal: 0.6 }) }
    case 'think':
      return { camera: THREE_Q, explosion: 0.7, exposure: 1.3, flare: dim({ core: 1.0, think: 1.6 }) }
    case 'know':
      return { camera: THREE_Q, explosion: 0.7, exposure: 1.3, flare: dim({ core: 1.0, know: 1.6 }) }
    case 'do':
      return { camera: THREE_Q, explosion: 0.7, exposure: 1.3, flare: dim({ core: 1.0, do: 1.6 }) }
    case 'vault-entry':
      return { camera: [0, 0, 13.5], explosion: 0.5, exposure: 1.25, flare: dim({ core: 0.9, know: 1.6 }) }
    case 'architecture-unfold':
      return { camera: WIDE, explosion: 1, exposure: 1.42, flare: ARCH_FLARE }
    case 'popup-open':
      return { camera: FRONT, explosion: 0, exposure: 0.95, flare: dim({ core: 0.4, think: 0.35, know: 0.35, do: 0.35, signal: 0.35 }) }
    case 'return': {
      // Recombination: hold the full-system reveal (the send-off, matching
      // architecture-unfold's reach) then fold back to the flat resting
      // emblem as the scene plays out — the actual "recombining" motion,
      // landing at the collapsed idle pose by the time it ends.
      const close = easeInCubic(progress)
      return { camera: THREE_Q, explosion: 0.85 * (1 - close), exposure: 1.42 - 0.27 * close, flare: ARCH_FLARE }
    }
    default:
      return { camera: FRONT, explosion: 0, exposure: 1.15, flare: FLAT }
  }
}

export function clusterFlare(flare: Record<Cluster, number>, cluster: LayerCluster): number {
  return flare[cluster] ?? 0.7
}
