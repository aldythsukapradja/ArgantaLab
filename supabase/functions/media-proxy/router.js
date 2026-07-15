// ─────────────────────────────────────────────────────────────────────────
// media-proxy router — pure routing/translation/pricing for the media compute
// substrate (docs/media-center/Compute-Substrate.md). The media twin of
// llm-proxy/router.js: dependency-free (no Deno.env, no fetch) so it runs under
// plain Node for tests; index.ts is the thin Deno wrapper.
//
// v1 = IMAGE only, two upstreams:
//   costClass 1 Sponsored → Cloudflare Workers AI (FLUX-1-schnell, free tier)
//   costClass 2 Economy   → Modal (your deployed FLUX/SDXL web endpoint)
// Voice/music/video are additive later — same catalog shape.
// costClass 0 (Sovereign) never reaches here — media-core handles it on-device.
// ─────────────────────────────────────────────────────────────────────────

export const MEDIA_CATALOG = [
  {
    name: 'cloudflare-flux', kind: 'image', costClass: 1, shape: 'cf-image',
    model: '@cf/black-forest-labs/flux-1-schnell',
    envKeys: ['CF_ACCOUNT_ID', 'CF_API_TOKEN'],
    pricing: null, // free allocation → truthfully $0
  },
  {
    name: 'modal-flux', kind: 'image', costClass: 2, shape: 'modal-image',
    model: 'flux', // whatever modal/media_image.py runs; label only
    envKeys: ['MODAL_IMAGE_URL', 'MODAL_TOKEN'],
    pricing: { perGenUsd: 0.01 }, // rough estimate; real cost is per-GPU-second on Modal
  },
];

export const isAvailable = (e, available) => e.envKeys.every((k) => !!available[k]);

/**
 * Candidate providers for this request, cheapest-first. `force` (exact provider
 * name) wins; `costClass` prefers that exact tier, else degrades to a cheaper
 * AVAILABLE tier (so a stage-2 request still returns *something* if Modal's keys
 * aren't set but Cloudflare's are — the caller records the true tier used).
 * Never more than 2 (bounded in-request fallback).
 * @param {Record<string,unknown>} available  env-key presence map
 * @param {{kind?:string, costClass?:number, force?:string}} [opts]
 */
export function pickMediaCandidates(available, opts = {}) {
  const kind = opts.kind || 'image';
  const pool = MEDIA_CATALOG.filter((e) => e.kind === kind && isAvailable(e, available));
  if (opts.force) {
    const f = pool.find((e) => e.name === opts.force);
    return f ? [f] : [];
  }
  const sorted = [...pool].sort((a, b) => a.costClass - b.costClass);
  if (opts.costClass != null) {
    const atOrBelow = sorted.filter((e) => e.costClass <= opts.costClass);
    const exact = atOrBelow.filter((e) => e.costClass === opts.costClass);
    return (exact.length ? exact : atOrBelow).slice(0, 2);
  }
  return sorted.slice(0, 2);
}

export const priceUsd = (entry) => entry.pricing?.perGenUsd ?? 0;

// ── Cloudflare Workers AI — text-to-image (FLUX-1-schnell) ──────────────────
// account id is a secret → passed in, so this stays pure/testable. The bearer
// token is added by index.ts. flux-1-schnell returns { result: { image: <b64> }}
// (base64 JPEG).
export function toCloudflareImageRequest({ accountId, model, prompt, steps = 4 }) {
  return { url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, body: { prompt, steps } };
}
export function fromCloudflareImageResponse(json) {
  const b64 = json?.result?.image;
  return b64 ? { imageBase64: b64, mime: 'image/jpeg' } : null;
}

// ── Modal — your deployed web endpoint ─────────────────────────────────────
// Contract (see modal/media_image.py): POST { prompt } → { image_base64 } (PNG).
export function toModalImageRequest({ url, prompt }) {
  return { url, body: { prompt } };
}
export function fromModalImageResponse(json) {
  const b64 = json?.image_base64 || json?.image;
  return b64 ? { imageBase64: b64, mime: 'image/png' } : null;
}

/** HTTP outcomes worth trying the next candidate for (rate limit / server error). */
export const isRetryableStatus = (status) => status === 429 || status >= 500;
