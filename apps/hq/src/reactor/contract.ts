// ─────────────────────────────────────────────────────────────────────────
// Jarvis Reactor — WS2 semantic contract
//
// This is the ONLY surface WS2 exposes to the outside world. The Cinema
// Director (WS1) emits a `SceneState` describing the *semantic intent* of the
// current beat; the reactor reacts. WS2 never reads audio, never advances the
// story, and never manipulates Three.js from outside this module. WS1 never
// reaches into the renderer.
//
//   WS1 Director ── SceneState ──▶ <CoreSlot renderer={…} state={…} />
//
// Because everything the reactor knows arrives through this one type, any of
// the three renderers ('2d' | 'r3f' | 'media') can express the same beat, and
// a Higgsfield asset can later replace the 3D core by swapping `renderer`
// alone — nothing else in the shell moves.
// ─────────────────────────────────────────────────────────────────────────

import type { ProductId } from '../surfaces/Portfolio'

export type { ProductId }

/** Which core implementation renders the beat. WS1 is oblivious to this. */
export type RendererId = '2d' | 'r3f' | 'media'

/**
 * The reactor's semantic states. This enum is a superset of WS1's per-scene
 * `coreState` string — the Director's override maps 1:1 onto these values.
 * Grouped by the THINK · KNOW · DO anatomy of the Orb & Visual System.
 */
export type CoreState =
  | 'offline'             // no signal; cold, dormant
  | 'booting'             // ignition chain (spark → layers → arcs → shockwave)
  | 'idle'                // resting compressed emblem, breathing
  | 'listening'           // attentive; founder has the mic
  | 'jarvis-speaking'     // JM narrating; energy pulses on the voice envelope
  | 'specialist-speaking' // a specialist voice; triad tilts toward the speaker
  | 'think'               // THINK core flares — reasoning, routing, decision
  | 'know'                // KNOW field swells — memory, evidence, provenance
  | 'do'                  // DO shell energizes — agents, tools, execution
  | 'product-focus'       // one of the five products pushed forward + lit
  | 'popup-open'          // an HQ surface takes the stage; reactor softens back
  | 'vault-entry'         // camera pushes into the KNOW field like a tunnel
  | 'architecture-unfold' // the full expansion: layers + triad + product field
  | 'return'              // exact reversible recombination back to `idle`

export const CORE_STATES: readonly CoreState[] = [
  'offline', 'booting', 'idle', 'listening',
  'jarvis-speaking', 'specialist-speaking',
  'think', 'know', 'do',
  'product-focus', 'popup-open', 'vault-entry',
  'architecture-unfold', 'return',
] as const

/**
 * Expansion choreographies (WS2 spec §"3D expansion"). Selectable per beat so
 * the founder can iterate the reveal in the Cinema Director. Signature set:
 * axial (default reveal), triad (Act IV), orbital (Act V bridge).
 */
export type ChoreographyId =
  | 'axial'    // #1 layers slide apart on Z; camera to three-quarter
  | 'tower'    // #2 layers lift into floors on Y
  | 'iris'     // #3 rings fan out in XY then tilt to depth
  | 'triad'    // #4 core cracks; THINK/KNOW/DO hinge to a triangle
  | 'orbital'  // #5 everything drifts into slow spatial orbit; 5 products scatter
  | 'helix'    // #6 layers spiral around a vertical axis

export type SignalState = 'live' | 'partial' | 'offline'

/** Voice currently carrying the beat (never the audio itself — just who). */
export type Speaker = 'jarvis' | 'specialist' | null

export type QualityTier = 'high' | 'medium' | 'mobile'

/**
 * The one payload WS1 emits each frame/beat. Values are semantic only.
 * `intensity` is a 0..1 energy proxy for the voice envelope — WS1 derives it
 * from the audio clock so WS2 can pulse to the narration without ever touching
 * the audio element.
 */
export interface SceneState {
  /** Current semantic state. */
  state: CoreState
  /** 0..1 energy on the audio clock; drives bloom, emissive and pulse rate. */
  intensity: number
  /** Who is speaking, for specialist-lean and tint. */
  speaker: Speaker
  /** Which product is focused (Act III / product-focus), else null. */
  focusProduct: ProductId | null
  /** Which expansion this beat uses when the state is an expansion state. */
  choreography: ChoreographyId
  /** Instrument truth signal — colors the calibration ring, never faked. */
  signal: SignalState
  /** Honor OS/user reduced-motion: crossfade instead of violent transitions. */
  reducedMotion: boolean
  /** Seconds elapsed inside the current beat (drives the deterministic timeline). */
  sceneTime: number
  /** Clip length of the current beat in seconds; 0 when unknown. */
  sceneDuration: number
  /** Scene key from the manifest (e.g. "4.1") — keys media alignment + capture. */
  sceneId?: string
}

/** The resting state the reactor boots into and always recovers to. */
export const IDLE_SCENE: SceneState = {
  state: 'idle',
  intensity: 0.32,
  speaker: null,
  focusProduct: null,
  choreography: 'axial',
  signal: 'offline',
  reducedMotion: false,
  sceneTime: 0,
  sceneDuration: 0,
}

/**
 * Default choreography for the expansion states, per the WS2 signature set.
 * The Director can override `choreography` per scene; this is the fallback.
 */
export const DEFAULT_CHOREOGRAPHY: Record<CoreState, ChoreographyId> = {
  offline: 'axial',
  booting: 'axial',
  idle: 'axial',
  listening: 'axial',
  'jarvis-speaking': 'axial',
  'specialist-speaking': 'axial',
  think: 'triad',
  know: 'triad',
  do: 'triad',
  'product-focus': 'orbital',
  'popup-open': 'axial',
  'vault-entry': 'helix',
  'architecture-unfold': 'axial',
  return: 'axial',
}

// ── Media slot (Higgsfield handoff) ────────────────────────────────────────
// The 'media' renderer plays a generated asset keyed to the same SceneState.
// Defining the seam *before* generating is what keeps assets aligned to the
// audio clock: each scene maps to an asset id + in/out frames at a known fps.

export interface MediaAsset {
  /** Scene key this asset covers (matches SceneState.sceneId). */
  sceneId: string
  /** Source URL — an MP4/WebM loop or a GLB. */
  src: string
  kind: 'video' | 'glb'
  /** Frame the asset should show when the beat starts. */
  inFrame: number
  /** Frame the asset should hold on when the beat ends. */
  outFrame: number
  fps: number
}

/** Keyed by sceneId. A missing entry means "fall back to the r3f core". */
export type MediaManifest = Record<string, MediaAsset>

// ── Legacy compatibility ────────────────────────────────────────────────────
// Landing.tsx currently mounts the old <ReactorOrb {...legacyProps} />. The
// compat shim maps those props onto a SceneState so the live landing keeps
// working untouched during the transition. Prop names below MUST stay in sync
// with surfaces/ReactorOrb.tsx.

export interface LegacyReactorProps {
  dark: boolean
  selectedProduct?: ProductId | null
  signalState?: SignalState
  bootKey?: number
  quickBoot?: boolean
  skipBoot?: boolean
  reducedMotion?: boolean
}

/** Derive a SceneState from the legacy Landing prop surface. */
export function sceneFromLegacyProps(props: LegacyReactorProps): SceneState {
  const focusProduct = props.selectedProduct ?? null
  const state: CoreState = focusProduct ? 'product-focus' : 'idle'
  return {
    ...IDLE_SCENE,
    state,
    focusProduct,
    signal: props.signalState ?? 'offline',
    reducedMotion: props.reducedMotion ?? false,
    choreography: DEFAULT_CHOREOGRAPHY[state],
  }
}
