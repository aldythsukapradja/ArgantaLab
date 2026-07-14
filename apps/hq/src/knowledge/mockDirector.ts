// WS3 — Run 2: a mock Cinema Director for the Cognitive Cortex. Steps through a
// representative sequence covering every act of the 46-scene manifest
// (docs/…-NarrativeStudio-SceneManifest.md), emitting `SceneState` beats on a
// timer — a stand-in for the real audio clock until WS1's Director exists.
// This is deliberately compressed (not all 46 rows): Acts I/II/III/VII don't
// carry per-scene region overrides (activation.ts keys those off `state`
// alone), so one representative beat per moment is enough to prove the
// mirroring end to end. Acts IV/V/VI reuse the REAL scene ids from the
// manifest so a future real-audio swap-in needs no changes to activation.ts.

import type { CoreState, SceneState } from './contract'

export interface MockBeat {
  sceneId: string
  act: 1 | 2 | 3 | 4 | 5 | 6 | 7
  state: CoreState
  caption: string
  hold: number              // ms — stand-in for the clip's audio length
  focusProduct?: string | null
  intensity?: number        // 0..1, default 0.75
}

export const MOCK_SCRIPT: MockBeat[] = [
  // Act I — Ignition & cockpit
  { sceneId: '1.1', act: 1, state: 'booting', caption: 'System awakening — the reactor ignites.', hold: 3200 },
  { sceneId: '1.2', act: 1, state: 'listening', caption: 'Jarvis greets the founder by role.', hold: 3000 },
  { sceneId: '1.3', act: 1, state: 'idle', caption: 'Reactor anatomy — Left / Center / Right named.', hold: 2800 },
  // Act II — Six instruments
  { sceneId: '2.1', act: 2, state: 'idle', caption: 'Left instruments — World Reach, Weekly Engaged, Valuation Audit.', hold: 2800 },
  { sceneId: '2.2', act: 2, state: 'idle', caption: 'Right instruments — Five Products, Access & Attention, Visit Rhythm.', hold: 2800 },
  { sceneId: '2.3', act: 2, state: 'idle', caption: 'Truth policy — cards stay honest.', hold: 2600 },
  // Act III — Five products (one representative beat per product)
  { sceneId: '3.2', act: 3, state: 'product-focus', caption: 'ArgantaLab — the learning engine.', hold: 3000, focusProduct: 'arganta' },
  { sceneId: '3.7', act: 3, state: 'product-focus', caption: 'KinetikCircle — the family shell.', hold: 3000, focusProduct: 'kinetik' },
  { sceneId: '3.12', act: 3, state: 'product-focus', caption: 'LashiraBloom — the retention world.', hold: 3000, focusProduct: 'lashira' },
  { sceneId: '3.17', act: 3, state: 'product-focus', caption: 'Landing — the acquisition surface.', hold: 3000, focusProduct: 'landing' },
  { sceneId: '3.22', act: 3, state: 'product-focus', caption: 'Circle HQ — the founder cockpit.', hold: 3000, focusProduct: 'hq' },
  // Act IV — THINK / KNOW / DO
  { sceneId: '4.1', act: 4, state: 'architecture-unfold', caption: 'The orb splits into THINK / KNOW / DO.', hold: 3200 },
  { sceneId: '4.2', act: 4, state: 'think', caption: 'THINK — founder intent, command, reasoning, routing.', hold: 3400 },
  { sceneId: '4.3', act: 4, state: 'know', caption: 'KNOW — Vault, evidence, telemetry, provenance.', hold: 3400 },
  { sceneId: '4.4', act: 4, state: 'do', caption: 'DO — architecture, agents, tools, controlled execution.', hold: 3400 },
  // Act V — Architecture graph (real scene ids; overridden in activation.ts)
  { sceneId: '5.1', act: 5, state: 'vault-entry', caption: 'Founder → Command — intent enters the system.', hold: 3200 },
  { sceneId: '5.2', act: 5, state: 'know', caption: 'Vault → Data — evidence and telemetry resolve.', hold: 3200 },
  { sceneId: '5.3', act: 5, state: 'do', caption: 'Architecture → Agents → Products — execution reaches the products.', hold: 3200 },
  { sceneId: '5.4', act: 5, state: 'architecture-unfold', caption: 'Provenance — live / partial / simulated / placeholder.', hold: 3000 },
  // Act VI — Deterministic agentic proof (real scene ids)
  { sceneId: '6.1', act: 6, state: 'listening', caption: '"Why is activation weak?"', hold: 2800 },
  { sceneId: '6.2', act: 6, state: 'think', caption: 'THINK locates — activation isolated in the graph.', hold: 3000 },
  { sceneId: '6.3', act: 6, state: 'know', caption: 'KNOW reveals — unwired exits surfaced from evidence.', hold: 3000 },
  { sceneId: '6.4', act: 6, state: 'think', caption: 'Measure first — choose instrumentation over guesswork.', hold: 2800 },
  { sceneId: '6.5', act: 6, state: 'do', caption: 'DO builds — instrumentation package, stops at approval.', hold: 3200 },
  // Act VII — Recombination & return
  { sceneId: '7.1', act: 7, state: 'return', caption: 'Recombination — THINK / KNOW / DO fold back into one orb.', hold: 3000 },
  { sceneId: '7.2', act: 7, state: 'idle', caption: 'Return to the live cockpit.', hold: 3000 },
]

export function sceneStateForBeat(beat: MockBeat, sceneTime = 0): SceneState {
  return {
    state: beat.state,
    intensity: beat.intensity ?? 0.75,
    speaker: 'jarvis',
    focusProduct: beat.focusProduct ?? null,
    sceneTime,
    sceneDuration: beat.hold / 1000,
    sceneId: beat.sceneId,
    act: beat.act,
  }
}
