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

// Which node class_types does this ComfyUI have installed? Used to decide
// whether the optional face-restore pass can run (all pieces already present on
// a stock Impact Pack + Ultralytics install → no extra downloads).
async function listNodeTypes(url) {
  try {
    const r = await fetch(`${url}/object_info`);
    if (!r.ok) return new Set();
    const info = await r.json();
    return new Set(Object.keys(info));
  } catch { return new Set(); }
}

// Upload a start frame (data URL or raw bytes) to ComfyUI's input folder so a
// LoadImage node can reference it — this is what turns text→video into
// image→video. Returns the stored filename, or null on failure (caller then
// falls back to text→video).
async function uploadStartImage(url, image) {
  try {
    let bytes, filename = 'arganta_start.png', mime = 'image/png';
    if (typeof image === 'string' && image.startsWith('data:')) {
      mime = (image.match(/^data:([^;]+)/) || [])[1] || 'image/png';
      const bin = atob(image.split(',')[1]);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      filename = `arganta_start.${(mime.split('/')[1] || 'png').split('+')[0]}`;
    } else if (image && image.bytes) {
      bytes = image.bytes; mime = image.mime || mime;
    } else {
      return null;
    }
    const form = new FormData();
    form.append('image', new Blob([bytes], { type: mime }), filename);
    form.append('overwrite', 'true');
    const r = await fetch(`${url}/upload/image`, { method: 'POST', body: form });
    if (!r.ok) return null;
    const data = await r.json().catch(() => null);
    return data?.name || null;
  } catch {
    return null;
  }
}

// round to the model's multiple-of-16 grid, clamped for 8GB sanity.
const grid = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(n / 16) * 16));

// The loader differs by model kind: a .gguf turbo model needs the ComfyUI-GGUF
// custom node (UnetLoaderGGUF); a .safetensors uses the native UNETLoader.
// Turbo (distilled) runs at 4 steps / cfg 1 / shift 5; base fp16 at 30 / 5 / 8.
function buildGraph({ unet, gguf, clipName, vae, prompt, negative, width, height, length, fps, seed, startImage, faceRestore }) {
  const loader = gguf
    ? { class_type: 'UnetLoaderGGUF', inputs: { unet_name: unet } }
    : { class_type: 'UNETLoader', inputs: { unet_name: unet, weight_dtype: 'default' } };
  const steps = gguf ? 4 : 30;
  const cfg = gguf ? 1 : 5;
  const shift = gguf ? 5 : 8;

  // The latent node makes an empty latent for text→video, or encodes a start
  // frame for image→video. When a start image is present, load + scale it to
  // the target size and feed it as start_image (this is the I2V switch).
  const latentInputs = { vae: ['39', 0], width, height, length, batch_size: 1 };
  const graph = {
    '37': loader,
    '38': { class_type: 'CLIPLoader', inputs: { clip_name: clipName, type: 'wan', device: 'default' } },
    '39': { class_type: 'VAELoader', inputs: { vae_name: vae } },
    '48': { class_type: 'ModelSamplingSD3', inputs: { shift, model: ['37', 0] } },
    '6': { class_type: 'CLIPTextEncode', inputs: { clip: ['38', 0], text: prompt } },
    '7': { class_type: 'CLIPTextEncode', inputs: { clip: ['38', 0], text: negative } },
    '3': { class_type: 'KSampler', inputs: { model: ['48', 0], seed, steps, cfg, sampler_name: gguf ? 'euler' : 'uni_pc', scheduler: 'simple', denoise: 1, positive: ['6', 0], negative: ['7', 0], latent_image: ['55', 0] } },
    '8': { class_type: 'VAEDecode', inputs: { samples: ['3', 0], vae: ['39', 0] } },
    '57': { class_type: 'CreateVideo', inputs: { images: ['8', 0], fps } },
    '58': { class_type: 'SaveVideo', inputs: { video: ['57', 0], filename_prefix: 'arganta_video', format: 'auto', codec: 'auto' } },
  };
  if (startImage) {
    graph['60'] = { class_type: 'LoadImage', inputs: { image: startImage } };
    graph['61'] = { class_type: 'ImageScale', inputs: { image: ['60', 0], width, height, upscale_method: 'lanczos', crop: 'center' } };
    latentInputs.start_image = ['61', 0];
  }
  graph['55'] = { class_type: 'Wan22ImageToVideoLatent', inputs: latentInputs };

  // ── Optional face-restore pass ──────────────────────────────────────────
  // Wan 5B melts faces (no low-noise expert). If a face-restore stack is
  // present (Impact Pack FaceDetailer + Ultralytics face detector + an SD1.5
  // checkpoint), re-detail each frame's face with SD1.5 at low denoise so it
  // enhances rather than replaces — un-melting the face on 8GB, no new models.
  // The frames feeding CreateVideo are swapped from the raw VAEDecode (8) to
  // the FaceDetailer output (74).
  let framesRef = ['8', 0];
  if (faceRestore?.sdCkpt) {
    graph['70'] = { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: faceRestore.sdCkpt } };
    graph['71'] = { class_type: 'CLIPTextEncode', inputs: { clip: ['70', 1], text: 'a detailed realistic human face, sharp eyes, natural skin texture, high quality photograph' } };
    graph['72'] = { class_type: 'CLIPTextEncode', inputs: { clip: ['70', 1], text: 'deformed, distorted, melted, blurry, extra eyes, disfigured, plastic, cartoon, low quality' } };
    graph['73'] = { class_type: 'UltralyticsDetectorProvider', inputs: { model_name: faceRestore.detector } };
    graph['74'] = { class_type: 'FaceDetailer', inputs: {
      image: ['8', 0], model: ['70', 0], clip: ['70', 1], vae: ['70', 2],
      positive: ['71', 0], negative: ['72', 0], bbox_detector: ['73', 0],
      guide_size: 384, guide_size_for: true, max_size: 768, seed, steps: 10, cfg: 6.5,
      sampler_name: 'euler', scheduler: 'normal', denoise: 0.42, feather: 5,
      noise_mask: true, force_inpaint: true, bbox_threshold: 0.5, bbox_dilation: 10,
      bbox_crop_factor: 3.0, sam_detection_hint: 'center-1', sam_dilation: 0, sam_threshold: 0.93,
      sam_bbox_expansion: 0, sam_mask_hint_threshold: 0.7, sam_mask_hint_use_negative: 'False',
      drop_size: 10, wildcard: '', cycle: 1,
    } };
    framesRef = ['74', 0];
  }
  graph['57'].inputs.images = framesRef;
  return graph;
}

async function runComfyVideo(spec) {
  const url = base();
  // Wan 2.2 is trained on 480p–720p; default to a coherent 480p (NOT 384²,
  // which is off-distribution and renders as colorful noise). Floor at 480.
  const width = grid(spec.width || 832, 480, 1280);
  const height = grid(spec.height || 480, 480, 1280);
  const length = Math.max(25, Math.min(121, spec.frames || spec.length || 73));
  const fps = Math.max(8, Math.min(30, spec.fps || 24));
  const seed = spec.seed != null ? spec.seed >>> 0 : Math.floor(Math.random() * 1e15);
  const prompt = spec.prompt || 'a calm cinematic scene, gentle motion';
  const negative = spec.negative || 'static, blurry, low quality, watermark, distorted';

  const [diffusion, unetFolder, encoders, vaes, checkpoints, nodeTypes] = await Promise.all([
    listModels(url, 'diffusion_models'), listModels(url, 'unet'),
    listModels(url, 'text_encoders'), listModels(url, 'vae'),
    listModels(url, 'checkpoints'), listNodeTypes(url),
  ]);
  // Prefer the distilled TURBO GGUF (4-step, ~6× faster) when present in the
  // unet folder; else fall back to the base fp16 diffusion model (30-step).
  const turbo = unetFolder.find((m) => /wan.*ti2v.*5b.*turbo.*\.gguf$/i.test(m)) || unetFolder.find((m) => /wan.*5b.*\.gguf$/i.test(m));
  const fp16 = diffusion.find((m) => /wan.*ti2v.*5b/i.test(m)) || diffusion.find((m) => /wan.*5b/i.test(m));
  const gguf = !!turbo;
  const unet = turbo || fp16;
  const clipName = encoders.find((m) => /umt5/i.test(m));
  const vae = vaes.find((m) => /wan.*vae/i.test(m));
  if (!unet || !clipName || !vae) throw new Error('comfyui missing Wan 2.2 5B files (run tools/comfyui/download-media-models.ps1)');

  // image→video: upload the start frame first (falls back to text→video if it fails).
  const startImage = spec.image ? await uploadStartImage(url, spec.image) : null;

  // Optional face-restore: only when requested AND the full stack is installed
  // (FaceDetailer + Ultralytics detector + an SD checkpoint). No new downloads.
  let faceRestore = null;
  if (spec.enhanceFaces && nodeTypes.has('FaceDetailer') && nodeTypes.has('UltralyticsDetectorProvider')) {
    const sdCkpt = checkpoints.find((m) => /v1-5|sd15|sd_?1\.?5|dreamshaper|realistic|epic|photon/i.test(m)) || checkpoints.find((m) => !/ace.?step|audio/i.test(m));
    if (sdCkpt) faceRestore = { sdCkpt, detector: 'bbox/face_yolov8m.pt' };
  }

  const graph = buildGraph({ unet, gguf, clipName, vae, prompt, negative, width, height, length, fps, seed, startImage, faceRestore });
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
      return { mime: 'video/mp4', bytes, seed, extra: { width, height, length, fps, model: unet, mode: startImage ? 'i2v' : 't2v', faceRestore: !!faceRestore, engine: gguf ? 'comfyui-wan22-turbo' : 'comfyui-wan22' } };
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
