import { SCENES } from '../../cinema/scenario'
import type { MediaAsset, MediaManifest } from '../contract'

// ─────────────────────────────────────────────────────────────────────────
// Deterministic media timeline (O7) — the Higgsfield handoff seam.
//
// Assigns every one of the 46 scenes a frame window at a fixed fps. A
// generated per-scene MP4/GLB can then be aligned frame-accurate to the audio
// clock: the media renderer seeks to a scene's `startFrame` when that beat
// begins. Defining this BEFORE assets exist is what keeps generation aligned.
//
// The Sonnet stream (S5) consumes this to drive CoreMedia; asset *generation*
// is a separate media-production task, not reactor code.
// ─────────────────────────────────────────────────────────────────────────

export interface SceneTiming {
  sceneId: string
  index: number
  startFrame: number
  durationFrames: number
  fps: number
}

/**
 * Build the timeline. `durations` (seconds, keyed by sceneId) overrides the
 * fallback estimate when real clip lengths are known.
 */
export function buildSceneTimeline(fps = 30, durations?: Record<string, number>): SceneTiming[] {
  let frame = 0
  return SCENES.map((s, index) => {
    const seconds = durations?.[s.id] ?? 5
    const durationFrames = Math.max(1, Math.round(seconds * fps))
    const timing: SceneTiming = { sceneId: s.id, index, startFrame: frame, durationFrames, fps }
    frame += durationFrames
    return timing
  })
}

export function timingForScene(timeline: SceneTiming[], sceneId: string): SceneTiming | undefined {
  return timeline.find(t => t.sceneId === sceneId)
}

/** Total run length in frames (for a captured single-file tour asset). */
export function timelineTotalFrames(timeline: SceneTiming[]): number {
  const last = timeline[timeline.length - 1]
  return last ? last.startFrame + last.durationFrames : 0
}

/** Build a manifest keyed by sceneId from a flat list of generated assets. */
export function mediaManifestFrom(assets: MediaAsset[]): MediaManifest {
  const manifest: MediaManifest = {}
  for (const asset of assets) manifest[asset.sceneId] = asset
  return manifest
}
