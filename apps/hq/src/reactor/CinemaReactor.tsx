import { CoreR3F } from './cores/CoreR3F'
import { useQualityTier, type QualityTier } from './useQualityTier'
import { DEFAULT_CHOREOGRAPHY, type CoreState, type ProductId, type SceneState } from './contract'
import { useHQ } from '../shell/store'

// ─────────────────────────────────────────────────────────────────────────
// CinemaReactor — the WS2 adapter for the WS1 Cinema slot.
//
// WS1 emits CoreSlotProps ({ state, product, progress, reducedMotion, quality })
// on the audio clock; this maps them to the reactor's SceneState and renders
// the 3D core. It never reads audio or advances the story — it only reacts,
// exactly per the shared contract. Camera is locked (Director owns framing).
//
// `intensity` is a baseline per state; the core's speaking "breath" is driven
// by CoreR3F's own clock, so it animates smoothly regardless of how often WS1
// re-renders the slot.
// ─────────────────────────────────────────────────────────────────────────

function baselineIntensity(state: CoreState): number {
  switch (state) {
    case 'offline': return 0.06
    case 'jarvis-speaking':
    case 'specialist-speaking': return 0.85
    case 'think': case 'know': case 'do': return 0.7
    case 'architecture-unfold': return 0.85
    case 'vault-entry': return 0.7
    case 'listening': return 0.45
    default: return 0.35
  }
}

export function ReactorCoreSlot({ state, product, progress, reducedMotion = false, quality, interactive = false, centered = false }: {
  state: CoreState
  product?: ProductId
  progress: number
  reducedMotion?: boolean
  quality?: QualityTier
  /** Hand the camera to the founder (drag-rotate, scroll-zoom) — used by the
   *  Cinema Editor's authoring preview. Normal playback never sets this. */
  interactive?: boolean
  centered?: boolean
}) {
  const auto = useQualityTier()
  const dark = useHQ(s => s.theme === 'dark')
  const tier = quality ?? auto
  const speaking = state === 'jarvis-speaking' || state === 'specialist-speaking'

  const scene: SceneState = {
    state,
    intensity: baselineIntensity(state),
    speaker: speaking ? (state === 'specialist-speaking' ? 'specialist' : 'jarvis') : null,
    focusProduct: product ?? null,
    choreography: DEFAULT_CHOREOGRAPHY[state],
    signal: 'live',
    reducedMotion,
    sceneTime: progress,
    sceneDuration: 1,
  }

  return <CoreR3F scene={scene} tier={tier} dark={dark} interactive={interactive} centered={centered} />
}
