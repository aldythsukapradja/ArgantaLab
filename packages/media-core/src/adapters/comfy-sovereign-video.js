// Sovereign-tier (stage 0) VIDEO adapter backed by LOCAL ComfyUI + Wan 2.2
// TI2V-5B (diffusion_models/wan2.2_ti2v_5B_fp16 + umt5 encoder + wan2.2 vae).
// Your own GPU, zero marginal cost. Produces real MP4 BYTES in Node.
//
// ✅ GRAPH VERIFIED 2026-07-18 against the bundled video_wan2_2_5B_ti2v template
// — rendered a real MP4 on the 3070 Ti (8GB) via ComfyUI weight offload. Text→
// video (no start image) and image→video (pass `image` bytes as a start frame).
//
// 8GB reality: keep it SMALL. Defaults are 384² × 25 frames (~1s). Bigger res /
// more frames work but get slow (offload to system RAM). Never hard-fails: on
// any error it returns the DEFERRED browser descriptor (@arganta/video).

import { MATURITY } from '../contracts.js';
import { videoDeterministicAdapter } from './browser-engines.js';

const ENV = (typeof process !== 'undefined' && process.env) ? process.env : {};
const base = () => (ENV.COMFY_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '');
const TIMEOUT_MS = Number(ENV.COMFY_VIDEO_TIMEOUT_MS || 900_000); // video is slow

async function listModels(url, folder) {
  try { const r = await fetch(`${url}/models/${folder}`); return r.ok ? await r.json() : []; }
  catch { return []; }
}

// round to the model's multiple-of-16 grid, clamped for 8GB sanity.
const grid = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(n / 16) * 16));

function buildGraph({ unet, clipName, vae, prompt, negative, width, height, length, fps, seed }) {
  return {
    '37': { class_type: 'UNETLoader', inputs: { unet_name: unet, weight_dtype: 'default' } },
    '38': { class_type: 'CLIPLoader', inputs: { clip_name: clipName, type: 'wan', device: 'default' } },
    '39': { class_type: 'VAELoader', inputs: { vae_name: vae } },
    '48': { class_type: 'ModelSamplingSD3', inputs: { shift: 8, model: ['37', 0] } },
    '6': { class_type: 'CLIPTextEncode', inputs: { clip: ['38', 0], text: prompt } },
    '7': { class_type: 'CLIPTextEncode', inputs: { clip: ['38', 0], text: negative } },
    '55': { class_type: 'Wan22ImageToVideoLatent', inputs: { vae: ['39', 0], width, height, length, batch_size: 1 } },
    '3': { class_type: 'KSampler', inputs: { model: ['48', 0], seed, steps: 20, cfg: 5, sampler_name: 'uni_pc', scheduler: 'simple', denoise: 1, positive: ['6', 0], negative: ['7', 0], latent_image: ['55', 0] } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['39', 0] } },
    '57': { class_type: 'CreateVideo', inputs: { images: ['8', 0], fps } },
    '58': { class_type: 'SaveVideo', inputs: { video: ['57', 0], filename_prefix: 'arganta_video', format: 'auto', codec: 'auto' } },
  };
}

async function runComfyVideo(spec) {
  const url = base();
  const width = grid(spec.width || 384, 256, 1280);
  const height = grid(spec.height || 384, 256, 1280);
  const length = Math.max(9, Math.min(121, spec.frames || spec.length || 25));
  const fps = Math.max(8, Math.min(30, spec.fps || 24));
  const seed = spec.seed != null ? spec.seed >>> 0 : Math.floor(Math.random() * 1e15);
  const prompt = spec.prompt || 'a calm cinematic scene, gentle motion';
  const negative = spec.negative || 'static, blurry, low quality, watermark, distorted';

  const [diffusion, encoders, vaes] = await Promise.all([
    listModels(url, 'diffusion_models'), listModels(url, 'text_encoders'), listModels(url, 'vae'),
  ]);
  const unet = diffusion.find((m) => /wan.*ti2v.*5b/i.test(m)) || diffusion.find((m) => /wan.*5b/i.test(m));
  const clipName = encoders.find((m) => /umt5/i.test(m));
  const vae = vaes.find((m) => /wan.*vae/i.test(m));
  if (!unet || !clipName || !vae) throw new Error('comfyui missing Wan 2.2 5B files (run tools/comfyui/download-media-models.ps1)');

  const graph = buildGraph({ unet, clipName, vae, prompt, negative, width, height, length, fps, seed });
  const queue = await fetch(`${url}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph }),
  });
  const queued = await queue.json().catch(() => null);
  const promptId = queued?.prompt_id;
  if (!queue.ok || !promptId) throw new Error(`comfyui video queue failed: HTTP ${queue.status} ${queued?.error?.message || ''}`.trim());

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 3000));
    const hist = await fetch(`${url}/history/${promptId}`);
    const histData = await hist.json().catch(() => null);
    const entry = histData?.[promptId];
    if (!entry) continue;
    // SaveVideo emits the MP4 under `images` (with an `animated` flag), not
    // `video`/`gifs` — check all three so the poll actually completes.
    const vids = Object.values(entry.outputs || {}).flatMap((o) => o?.video || o?.gifs || o?.images || []);
    if (vids.length) {
      const v = vids[0];
      const q = new URLSearchParams({ filename: v.filename, subfolder: v.subfolder || '', type: v.type || 'output' });
      const view = await fetch(`${url}/view?${q}`);
      if (!view.ok) throw new Error(`comfyui video view failed: HTTP ${view.status}`);
      const bytes = new Uint8Array(await view.arrayBuffer());
      return { mime: 'video/mp4', bytes, seed, extra: { width, height, length, fps, model: unet, engine: 'comfyui-wan22' } };
    }
    if (entry.status?.status_str === 'error') throw new Error('comfyui reported a Wan video workflow error (likely OOM — reduce width/height/frames)');
  }
  throw new Error(`comfyui video timed out after ${TIMEOUT_MS}ms`);
}

/** Sovereign video adapter — local ComfyUI Wan 2.2 5B first, browser defer. */
export const comfySovereignVideoAdapter = {
  id: 'comfy-video',
  kind: 'video',
  tier: 0,
  stage: MATURITY.DETERMINISTIC,
  runtime: 'node',
  cost: 0,
  async run(spec) {
    try {
      return await runComfyVideo(spec);
    } catch (e) {
      const out = videoDeterministicAdapter.run(spec);
      return { ...out, extra: { ...(out.extra || {}), fallback: 'browser-video', comfyError: e.message } };
    }
  },
};
