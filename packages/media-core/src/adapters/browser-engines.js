// Stage-0 adapters for the modalities whose engines already exist in the repo
// but run in the BROWSER (Web Audio, canvas, MediaRecorder): music/sfx via
// @arganta/audio, video/voice via @arganta/video.
//
// The router still owns them at Stage 0 (free, deterministic), but Node can't
// produce the bytes — so these return a `deferred` descriptor telling the HQ
// runtime exactly which engine call to make. This keeps one uniform generate()
// API across every modality without pretending Node can run Web Audio.

import { MATURITY } from '../contracts.js';

const engineAdapter = ({ kind, pkg, call }) => ({
  id: `deterministic-${kind}`,
  kind,
  tier: 0,
  stage: MATURITY.DETERMINISTIC,
  runtime: 'browser',
  cost: 0,
  run(spec) {
    return {
      deferred: true,
      reason: `${kind} is deterministic & free but renders in the browser (${pkg}).`,
      descriptor: { engine: pkg, call, args: spec },
    };
  },
});

export const musicDeterministicAdapter = engineAdapter({ kind: 'music', pkg: '@arganta/audio', call: 'applyMusicThemes|playRecipe' });
export const sfxDeterministicAdapter = engineAdapter({ kind: 'sfx', pkg: '@arganta/audio', call: 'playRecipe' });
export const videoDeterministicAdapter = engineAdapter({ kind: 'video', pkg: '@arganta/video', call: 'exportVideo' });
export const voiceDeterministicAdapter = engineAdapter({ kind: 'voice', pkg: '@arganta/video', call: 'renderVoice' });
