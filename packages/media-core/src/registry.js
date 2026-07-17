// Adapter registry: (kind, stage) → adapter. Built from the bundled adapters,
// extendable at runtime. Mirrors how @arganta/ai keeps provider availability in
// a config map rather than hard-wiring.

import { imageDeterministicAdapter } from './adapters/image-deterministic.js';
import {
  musicDeterministicAdapter, sfxDeterministicAdapter,
  videoDeterministicAdapter, voiceDeterministicAdapter,
} from './adapters/browser-engines.js';
import {
  premiumImageAdapter, premiumVideoAdapter, premiumMusicAdapter, premiumVoiceAdapter,
} from './adapters/premium-mcp.js';
import { comfySovereignImageAdapter } from './adapters/comfy-sovereign.js';
import { comfySovereignMusicAdapter } from './adapters/comfy-sovereign-music.js';
import { comfySovereignVideoAdapter } from './adapters/comfy-sovereign-video.js';

/** Always-available fallback so a call never hard-fails on a missing adapter. */
export const mockAdapter = {
  id: 'mock', kind: '*', tier: 0, stage: 0, runtime: 'node', cost: 0,
  run(spec) { return { mime: 'application/json', bytes: new TextEncoder().encode(JSON.stringify({ mock: true, spec })), seed: 0 }; },
};

const BUNDLED = [
  imageDeterministicAdapter,
  musicDeterministicAdapter, sfxDeterministicAdapter,
  videoDeterministicAdapter, voiceDeterministicAdapter,
  premiumImageAdapter, premiumVideoAdapter, premiumMusicAdapter, premiumVoiceAdapter,
  // Opt-in Sovereign upgrade: when COMFY_URL is set, local ComfyUI replaces the
  // deterministic image adapter at image:0 (it still falls back to deterministic
  // internally if the server is unreachable). Unset = original behaviour.
  ...(typeof process !== 'undefined' && process.env?.COMFY_URL ? [comfySovereignImageAdapter, comfySovereignMusicAdapter, comfySovereignVideoAdapter] : []),
];

export function createRegistry(extra = []) {
  const byKindStage = new Map(); // `${kind}:${stage}` -> adapter
  const add = (a) => byKindStage.set(`${a.kind}:${a.stage}`, a);
  for (const a of BUNDLED) add(a);
  for (const a of extra) add(a);

  return {
    add,
    get: (kind, stage) => byKindStage.get(`${kind}:${stage}`),
    /** Highest stage available for a kind that is <= requested. */
    stagesFor: (kind) =>
      [...byKindStage.keys()].filter((k) => k.startsWith(`${kind}:`)).map((k) => Number(k.split(':')[1])).sort((a, b) => a - b),
    mock: mockAdapter,
  };
}
