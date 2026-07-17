// Sovereign-tier (stage 0) image adapter backed by a LOCAL ComfyUI server —
// your own GPU, zero marginal cost, which is exactly what costClass 0 means.
// Auto-detects the best engine on the server: Z-Image Turbo (diffusion model +
// qwen text encoder) when installed, else the classic SD checkpoint graph.
//
// Never hard-fails: if the server is down, has no models, or errors, it falls
// back to the deterministic procedural engine so callers always get bytes.
// run() is async — core.generate() is promise-aware and returns a Promise for
// this adapter while staying synchronous for the pure-Node adapters.

import { MATURITY } from '../contracts.js';
import { imageDeterministicAdapter } from './image-deterministic.js';

// This module is bundled into the browser too (registry.js imports it eagerly,
// even though it only ADDS the adapter under Node). `process` doesn't exist in
// the browser, so reading process.env at module scope hard-crashes the whole
// bundle — read through a guarded ENV instead.
const ENV = (typeof process !== 'undefined' && process.env) ? process.env : {};
const base = () => (ENV.COMFY_URL || 'http://127.0.0.1:8188').replace(/\/+$/, '');
const TIMEOUT_MS = Number(ENV.COMFY_TIMEOUT_MS || 300_000);

async function listModels(url, folder) {
  try {
    const r = await fetch(`${url}/models/${folder}`);
    return r.ok ? await r.json() : [];
  } catch {
    return [];
  }
}

function buildWorkflow({ prompt, width, height, seed }, models) {
  const zImage = models.diffusion.find((m) => m.toLowerCase().includes('z_image'));
  const qwenClip = models.encoders.find((m) => m.toLowerCase().includes('qwen'));
  const zVae = models.vaes.find((m) => m === 'ae.safetensors') || models.vaes[0];

  if (zImage && qwenClip && zVae) {
    // Mirrors ComfyUI's bundled image_z_image_turbo template: 8 steps, cfg 1,
    // zeroed negative conditioning, native 1024-class resolution.
    return {
      model: zImage,
      graph: {
        '1': { class_type: 'UNETLoader', inputs: { unet_name: zImage, weight_dtype: 'default' } },
        '2': { class_type: 'CLIPLoader', inputs: { clip_name: qwenClip, type: 'lumina2', device: 'default' } },
        '3': { class_type: 'VAELoader', inputs: { vae_name: zVae } },
        '4': { class_type: 'ModelSamplingAuraFlow', inputs: { shift: 3, model: ['1', 0] } },
        '5': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['2', 0] } },
        '6': { class_type: 'ConditioningZeroOut', inputs: { conditioning: ['5', 0] } },
        '7': { class_type: 'EmptySD3LatentImage', inputs: { width, height, batch_size: 1 } },
        '8': { class_type: 'KSampler', inputs: { seed, steps: 8, cfg: 1, sampler_name: 'res_multistep', scheduler: 'simple', denoise: 1, model: ['4', 0], positive: ['5', 0], negative: ['6', 0], latent_image: ['7', 0] } },
        '9': { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['3', 0] } },
        '10': { class_type: 'SaveImage', inputs: { filename_prefix: 'arganta', images: ['9', 0] } },
      },
    };
  }

  const ckpt = ENV.COMFY_CKPT || 'v1-5-pruned-emaonly.safetensors';
  if (!models.checkpoints.includes(ckpt)) {
    throw new Error(`comfyui has neither a z_image model nor checkpoint "${ckpt}"`);
  }
  // SD1.5 is trained at 512; scale down to keep 8GB VRAM happy.
  const scale = Math.min(1, 512 / Math.min(width, height));
  const w = Math.max(256, Math.round((width * scale) / 8) * 8);
  const h = Math.max(256, Math.round((height * scale) / 8) * 8);
  return {
    model: ckpt,
    graph: {
      '3': { class_type: 'KSampler', inputs: { seed, steps: 20, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1, model: ['4', 0], positive: ['6', 0], negative: ['7', 0], latent_image: ['5', 0] } },
      '4': { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ckpt } },
      '5': { class_type: 'EmptyLatentImage', inputs: { width: w, height: h, batch_size: 1 } },
      '6': { class_type: 'CLIPTextEncode', inputs: { text: prompt, clip: ['4', 1] } },
      '7': { class_type: 'CLIPTextEncode', inputs: { text: 'lowres, bad anatomy, watermark, blurry', clip: ['4', 1] } },
      '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['4', 2] } },
      '9': { class_type: 'SaveImage', inputs: { filename_prefix: 'arganta', images: ['8', 0] } },
    },
  };
}

async function runComfy(spec) {
  const url = base();
  const width = Math.max(256, Math.min(2048, spec.width || 1024));
  const height = Math.max(256, Math.min(2048, spec.height || 1024));
  const seed = spec.seed != null ? spec.seed >>> 0 : Math.floor(Math.random() * 1e15);

  const [diffusion, encoders, vaes, checkpoints] = await Promise.all([
    listModels(url, 'diffusion_models'), listModels(url, 'text_encoders'),
    listModels(url, 'vae'), listModels(url, 'checkpoints'),
  ]);
  const { model, graph } = buildWorkflow(
    { prompt: spec.prompt || 'arganta', width, height, seed },
    { diffusion, encoders, vaes, checkpoints },
  );

  const queue = await fetch(`${url}/prompt`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph }),
  });
  const queued = await queue.json().catch(() => null);
  const promptId = queued?.prompt_id;
  if (!queue.ok || !promptId) throw new Error(`comfyui queue failed: HTTP ${queue.status} ${queued?.error?.message || ''}`.trim());

  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1500));
    const hist = await fetch(`${url}/history/${promptId}`);
    const histData = await hist.json().catch(() => null);
    const entry = histData?.[promptId];
    if (!entry) continue;
    const images = Object.values(entry.outputs || {}).flatMap((o) => o?.images || []);
    if (images.length) {
      const img = images[0];
      const q = new URLSearchParams({ filename: img.filename, subfolder: img.subfolder || '', type: img.type || 'output' });
      const view = await fetch(`${url}/view?${q}`);
      if (!view.ok) throw new Error(`comfyui view failed: HTTP ${view.status}`);
      const bytes = new Uint8Array(await view.arrayBuffer());
      return { mime: 'image/png', bytes, seed, extra: { width, height, model, engine: 'comfyui' } };
    }
    if (entry.status?.status_str === 'error') throw new Error('comfyui reported a workflow error');
  }
  throw new Error(`comfyui timed out after ${TIMEOUT_MS}ms`);
}

/** Sovereign image adapter — local ComfyUI first, deterministic fallback. */
export const comfySovereignImageAdapter = {
  id: 'comfy-local',
  kind: 'image',
  tier: 0,
  stage: MATURITY.DETERMINISTIC,
  runtime: 'node',
  cost: 0,
  async run(spec) {
    try {
      return await runComfy(spec);
    } catch (e) {
      const out = imageDeterministicAdapter.run(spec);
      return { ...out, extra: { ...out.extra, fallback: 'deterministic', comfyError: e.message } };
    }
  },
};
