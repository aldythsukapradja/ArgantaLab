// WS3 — the semantic contract WS3 receives from the Cinema Director (WS1).
//
// The real `cinema/contract.ts` does not exist yet. This is the MOCK: it mirrors
// the shape WS1 will emit (derived from the WS1 stage/act table) so the whole 3D
// module is built against a stable interface. When the real Director lands, this
// file is the single import seam to swap — nothing in the scene reads audio or
// drives the story; it only reacts to `SceneState`.

export type CinemaStage = 'cockpit' | 'guided' | 'auto'
export type Triad = 'think' | 'know' | 'do'

// The graph's own phases inside Acts V/VI, plus the continuity states that let
// the reactor (WS2) dissolve into the graph and back (WS2 `vault-entry` /
// `architecture-unfold` / `return`).
export type GraphPhase =
  | 'idle'
  | 'vault-entry'        // reactor dissolves → graph blooms in
  | 'core-path'          // Act V: trace the 8-node spine
  | 'architecture-unfold'// widen to the neighbourhoods
  | 'locate'             // Act VI: find the weak node
  | 'reveal'             // expose unwired exits
  | 'do-package'         // instrumentation package, stops at approval
  | 'return'             // fold back to the CEO Orb

export type TourId = 'A' | 'B' | 'C' | 'D'

export interface SceneState {
  sceneId: string
  stage: CinemaStage
  act: 1 | 2 | 3 | 4 | 5 | 6 | 7
  triad?: Triad
  graphPhase: GraphPhase
  /** Node the story is pointing at right now (a real vault note id). */
  focusedNode?: string
  /** Ordered path the story is tracing (real vault note ids). */
  focusPath?: string[]
  /** manual = founder drives; auto = the Director drives. */
  mode: 'manual' | 'auto'
  tour?: TourId
}

export const RESTING_SCENE: SceneState = {
  sceneId: 'manual',
  stage: 'cockpit',
  act: 1,
  graphPhase: 'idle',
  mode: 'manual',
}
