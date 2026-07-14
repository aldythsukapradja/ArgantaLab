// WS3 — the semantic contract the Cognitive Cortex receives from the Cinema
// Director (WS1). The real `cinema/contract.ts` does not exist yet — this is
// the MOCK, and it deliberately mirrors the SHAPE of the reactor's own
// `SceneState` (apps/hq/src/reactor/contract.ts) so brain ⇄ reactor ⇄ cinema
// speak one language: WS1 emits one `SceneState`, WS2 (reactor) and WS3 (this
// brain) each react to it independently. When the real Director lands, this
// file is the single import seam to swap — the brain never reads audio, never
// drives the story, and never reaches into the reactor.

/**
 * Mirrors the reactor's `CoreState` — the same 14 semantic states, grouped by
 * the THINK · KNOW · DO anatomy. Kept as its own local type (not imported from
 * reactor/) so `apps/hq/src/knowledge/**` stays self-contained per the WS3
 * boundary; the values are identical so activation.ts maps 1:1 onto both.
 */
export type CoreState =
  | 'offline' | 'booting' | 'idle' | 'listening'
  | 'jarvis-speaking' | 'specialist-speaking'
  | 'think' | 'know' | 'do'
  | 'product-focus' | 'popup-open' | 'vault-entry'
  | 'architecture-unfold' | 'return'

export type Speaker = 'jarvis' | 'specialist' | null

/**
 * The one payload WS1 emits each frame/beat. The brain only reads `state`,
 * `intensity`, `focusProduct` and the scene identity/timing fields — it never
 * touches `choreography` (that's the reactor's own visual vocabulary).
 */
export interface SceneState {
  state: CoreState
  /** 0..1 energy on the audio clock; drives how hard regions fire. */
  intensity: number
  speaker: Speaker
  /** Which product is focused (Act III), else null. */
  focusProduct: string | null
  /** Seconds elapsed inside the current beat. */
  sceneTime: number
  /** Clip length of the current beat in seconds; 0 when unknown. */
  sceneDuration: number
  /** Scene key from the manifest (e.g. "5.2") — drives per-scene overrides. */
  sceneId?: string
  act: 1 | 2 | 3 | 4 | 5 | 6 | 7
}

export const RESTING_SCENE: SceneState = {
  state: 'idle',
  intensity: 0.3,
  speaker: null,
  focusProduct: null,
  sceneTime: 0,
  sceneDuration: 0,
  act: 1,
}
