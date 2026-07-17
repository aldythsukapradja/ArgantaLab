// Sovereign-tier (stage 0) MUSIC adapter backed by LOCAL ComfyUI + ACE-Step 1.5
// (checkpoints/ace_step_1.5_turbo_aio.safetensors). Your own GPU, zero marginal
// cost — costClass 0. Produces real song BYTES in Node, exactly like the image
// adapter, so media-core can route music to it uniformly.
//
// Never hard-fails: if the server is down, the ACE-Step checkpoint is missing,
// or the graph errors, it returns the DEFERRED browser descriptor (the existing
// @arganta/audio generative engine) so callers always get a usable result.
//
// ✅ GRAPH VERIFIED 2026-07-18: mirrors ComfyUI's bundled
// audio_ace_step_1_5_checkpoint template exactly — the AIO checkpoint needs the
// 1.5 nodes (TextEncodeAceStepAudio1.5 + ModelSamplingAuraFlow shift 3 +
// EmptyAceStep1.5LatentAudio + ConditioningZeroOut + VAEDecodeAudio) at 8 steps
// / cfg 1. Rendered a real 48kHz stereo MP3 in ~24s on the 3070 Ti.

import { MATURITY } from '../contracts.js';
import { musicDeterministicAdapter } from './browser-engines.js';

const ENV = (typeof process !== 'undefined' && process.env) ? process.env : {};
const base = () => (ENV.COMFY_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '');
const TIMEOUT_MS = Number(ENV.COMFY_MUSIC_TIMEOUT_MS || 300_000);

async function listModels(url, folder) {
  try {
    const r = await fetch(`${url}/models/${folder}`);
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

function pickAceCheckpoint(checkpoints) {
  // the all-in-one turbo file bundles model+clip+vae — preferred.
  return (
    checkpoints.find((m) => /ace.?step.*aio/i.test(m)) ||
    checkpoints.find((m) => /ace.?step/i.test(m)) ||
    null
  );
}

function buildGraph({ ckpt, tags, lyrics, seconds, seed, bpm, keyscale }) {
  // ACE-Step 1.5 AIO graph (bundled audio_ace_step_1_5_checkpoint template).
  // The AIO checkpoint feeds model[0]/clip[1]/vae[2]. generate_audio_codes runs
  // the 4B LM for quality; turbo → 8 steps / cfg 1. Negative = zeroed positive.
  return {
    '97': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
    '78': { class_type: 'ModelSamplingAuraFlow', inputs: { shift: 3, model: ['97', 0] } },
    '94': { class_type: 'TextEncodeAceStepAudio1.5', inputs: {
      clip: ['97', 1], tags, lyrics, seed, bpm, duration: seconds,
      timesignature: '4', language: 'en', keyscale, generate_audio_codes: true,
      cfg_scale: 2.0, temperature: 0.85, top_p: 0.9, top_k: 0, min_p: 0.0 } },
    '47': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['94', 0] } },
    '98': { class_type: 'EmptyAceStep1.5LatentAudio', inputs: { seconds, batch_size: 1 } },
    '3': { class_type: 'KSampler', inputs: { model: ['78', 0], seed, steps: 8, cfg: 1, sampler_name: 'euler', scheduler: 'simple', denoise: 1, positive: ['94', 0], negative: ['47', 0], latent_image: ['98', 0] } },
    '18': { class_type: 'VAEDecodeAudio', inputs: { samples: ['3', 0], vae: ['97', 2] } },
    '104': { class_type: 'SaveAudioMP3', inputs: { audio: ['18', 0], filename_prefix: 'arganta_music', quality: 'V0' } },
  };
}

async function runComfyMusic(spec) {
  const url = base();
  const seconds = Math.max(4, Math.min(240, spec.durationSec || spec.seconds || 30));
  const seed = spec.seed != null ? spec.seed >>> 0 : Math.floor(Math.random() * 1e15);
  const tags = spec.tags || spec.prompt || 'warm, gentle, instrumental';
  const lyrics = spec.lyrics || '';
  const bpm = Math.max(10, Math.min(300, spec.bpm || 120));
  const keyscale = spec.keyscale || 'C major';

  const checkpoints = await listModels(url, 'checkpoints');
  const ckpt = pickAceCheckpoint(checkpoints);
  if (!ckpt) throw new Error('comfyui has no ACE-Step checkpoint (run tools/comfyui/download-media-models.ps1)');

  const graph = buildGraph({ ckpt, tags, lyrics, seconds, seed, bpm, keyscale });
  const queue = await fetch(`${url}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph }),
  });
  const queued = await queue.json().catch(() => null);
  const promptId = queued?.prompt_id;
  if (!queue.ok || !promptId) throw new Error(`comfyui music queue failed: HTTP ${queue.status} ${queued?.error?.message || ''}`.trim());

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const hist = await fetch(`${url}/history/${promptId}`);
    const histData = await hist.json().catch(() => null);
    const entry = histData?.[promptId];
    if (!entry) continue;
    const audios = Object.values(entry.outputs || {}).flatMap((o) => o?.audio || []);
    if (audios.length) {
      const a = audios[0];
      const q = new URLSearchParams({ filename: a.filename, subfolder: a.subfolder || '', type: a.type || 'output' });
      const view = await fetch(`${url}/view?${q}`);
      if (!view.ok) throw new Error(`comfyui music view failed: HTTP ${view.status}`);
      const bytes = new Uint8Array(await view.arrayBuffer());
      const mime = /\.mp3$/i.test(a.filename) ? 'audio/mpeg' : 'audio/flac';
      return { mime, bytes, seed, extra: { seconds, tags, model: ckpt, engine: 'comfyui-acestep' } };
    }
    if (entry.status?.status_str === 'error') throw new Error('comfyui reported an ACE-Step workflow error');
  }
  throw new Error(`comfyui music timed out after ${TIMEOUT_MS}ms`);
}

/** Sovereign music adapter — local ComfyUI ACE-Step first, browser engine defer. */
export const comfySovereignMusicAdapter = {
  id: 'comfy-music',
  kind: 'music',
  tier: 0,
  stage: MATURITY.DETERMINISTIC,
  runtime: 'node',
  cost: 0,
  async run(spec) {
    try {
      return await runComfyMusic(spec);
    } catch (e) {
      const out = musicDeterministicAdapter.run(spec);
      return { ...out, extra: { ...(out.extra || {}), fallback: 'browser-audio', comfyError: e.message } };
    }
  },
};
