// WS3 — Run 2: cinematic mirroring. Maps a `SceneState` (contract.ts) onto how
// hard each of the 7 brain regions fires, and which region the camera frames.
// Cross-validated against the reactor spine (model/layers.ts) and the 46-scene
// manifest (docs/…-NarrativeStudio-SceneManifest.md) — the 7 regions ARE the
// reactor spine, so this map stays consistent across brain, reactor and cinema.

import type { RegionId } from './brain'
import type { CoreState, SceneState } from './contract'

const ALL_REGIONS: RegionId[] = ['command', 'think', 'know', 'orchestrate', 'act', 'experience', 'sense']

// Base per-CoreState region weights (0..1). Unlisted regions default to a low
// ambient floor so the brain never reads "dead" even during quiet beats.
const BASE: Record<CoreState, Partial<Record<RegionId, number>>> = {
  offline: {},                                                          // dormant — no signal
  booting: { command: 1 },                                              // Act I: ignition, the hub wakes first
  idle: { command: 0.3, think: 0.25, know: 0.3, orchestrate: 0.2, act: 0.2, experience: 0.2, sense: 0.25 },
  listening: { command: 0.9, sense: 0.4 },                              // attentive; founder has the mic
  'jarvis-speaking': { command: 0.8, think: 0.7 },                      // Jarvis narrating — reasoning core lit
  'specialist-speaking': { experience: 0.9, think: 0.3 },               // a product specialist is presenting
  think: { command: 0.6, think: 1 },                                    // Act IV.2 — THINK explanation
  know: { know: 1, sense: 0.5 },                                        // Act IV.3 — KNOW explanation
  do: { orchestrate: 0.85, act: 1, experience: 0.7 },                   // Act IV.4 — DO explanation
  'product-focus': { experience: 1 },                                   // Act III — five products
  'popup-open': { command: 0.2 },                                       // an HQ surface takes the stage; brain softens back
  'vault-entry': { know: 1, command: 0.3 },                             // camera pushes into KNOW like a tunnel
  'architecture-unfold': { command: 1, think: 1, know: 1, orchestrate: 1, act: 1, experience: 1, sense: 1 }, // Act V enter — full bloom
  return: { command: 0.4, think: 0.3, know: 0.3, orchestrate: 0.25, act: 0.25, experience: 0.25, sense: 0.3 }, // Act VII — fold back
}

// Per-scene overrides for the Act V spine trace and Act VI deterministic proof
// — these key off the real narration scene ids (docs manifest §Act V/VI) so a
// future real audio swap-in stays valid without touching this table.
const SCENE_OVERRIDE: Record<string, Partial<Record<RegionId, number>>> = {
  '5.1': { command: 1 },                                                 // Founder → Command: intent enters
  '5.2': { know: 1 },                                                    // Vault → Data: evidence resolves
  '5.3': { orchestrate: 0.9, act: 1, experience: 0.9 },                   // Architecture → Agents → Products
  '5.4': { command: 0.4, think: 0.4, know: 0.4, orchestrate: 0.4, act: 0.4, experience: 0.4, sense: 0.4 }, // provenance legend
  '6.1': { command: 0.7 },                                               // "why is activation weak?"
  '6.2': { command: 0.5, think: 1 },                                     // THINK locates
  '6.3': { know: 1, sense: 0.6 },                                        // KNOW reveals
  '6.4': { command: 0.4, think: 0.9 },                                   // measure first
  '6.5': { orchestrate: 0.7, act: 1 },                                   // DO builds the package
}

/** Per-region 0..1 activation for the current scene, or null when there's no
 *  active cinematic (the caller falls back to the ambient sim). */
export function activationFor(scene: SceneState | null): Record<RegionId, number> | null {
  if (!scene) return null
  const weights = (scene.sceneId && SCENE_OVERRIDE[scene.sceneId]) || BASE[scene.state] || {}
  const intensity = Math.max(0.15, Math.min(1, scene.intensity ?? 0.5))
  const out = {} as Record<RegionId, number>
  for (const r of ALL_REGIONS) out[r] = (weights[r] ?? 0.06) * intensity
  return out
}

/** Which region the camera should frame for this state — a region id to frame
 *  its hero neuron, `'overview'` for the whole-brain resting frame, or `null`
 *  to leave the camera exactly where it is (dormant / a popup takes the
 *  stage). Deterministic: the same state always frames the same way. */
export function cameraRegionFor(state: CoreState): RegionId | 'overview' | null {
  switch (state) {
    case 'booting': return 'command'
    case 'listening': return 'command'
    case 'jarvis-speaking': return 'command'
    case 'specialist-speaking': return 'experience'
    case 'think': return 'think'
    case 'know': return 'know'
    case 'do': return 'act'
    case 'product-focus': return 'experience'
    case 'vault-entry': return 'know'
    case 'architecture-unfold': return 'overview'
    case 'return': return 'overview'
    case 'idle': return 'overview'
    case 'offline': return null
    case 'popup-open': return null
  }
}
