// ─────────────────────────────────────────────────────────────────────────
// media-proxy router — pure routing/translation/pricing for the media compute
// substrate (docs/media-center/Compute-Substrate.md). The media twin of
// llm-proxy/router.js: dependency-free (no Deno.env, no fetch) so it runs under
// plain Node for tests; index.ts is the thin Deno wrapper.
//
// v1 = IMAGE + TTS, three upstreams:
//   image  costClass 1 Sponsored → Cloudflare Workers AI (FLUX-1-schnell, free tier)
//   image  costClass 2 Economy   → Modal (your deployed FLUX/SDXL web endpoint)
//   tts    costClass 1 Sponsored → Cloudflare Workers AI (Deepgram Aura-1)
// Music/video are additive later — same catalog shape.
// costClass 0 (Sovereign) never reaches here — media-core/browser Web Speech
// handle it on-device.
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
  {
    name: 'cloudflare-aura', kind: 'tts', costClass: 1, shape: 'cf-tts',
    model: '@cf/deepgram/aura-1',
    envKeys: ['CF_ACCOUNT_ID', 'CF_API_TOKEN'], // same secrets as cloudflare-flux — nothing new to set
    pricing: { usdPer1kChars: 0.015 }, // Cloudflare's published Aura-1 rate; still inside the same free daily neuron quota as image/text
  },
  {
    name: 'cloudflare-bge', kind: 'embed', costClass: 1, shape: 'cf-embed',
    model: '@cf/baai/bge-base-en-v1.5', // 768-dim — verified live against the real account (2026-07-15)
    envKeys: ['CF_ACCOUNT_ID', 'CF_API_TOKEN'], // same secrets, nothing new to set
    pricing: null, // free allocation → truthfully $0
  },
];

/** bge-base-en-v1.5's fixed output width — the memory_chunk migration's vector
 * column width MUST match this exactly (pgvector similarity ops require equal
 * dimensions), so it's exported as the one source of truth rather than a
 * number copy-pasted into a migration. */
export const EMBED_DIMENSIONS = 768;

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

/** @param {object} entry @param {number} [units] char count — only meaningful for usdPer1kChars pricing */
export const priceUsd = (entry, units = 0) =>
  entry.pricing?.perGenUsd ?? (entry.pricing?.usdPer1kChars ? (units / 1000) * entry.pricing.usdPer1kChars : 0);

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

// ── Cloudflare Workers AI — text-to-speech (Deepgram Aura-1) ────────────────
// Same account-scoped URL shape as the image model. Unlike flux-1-schnell,
// Aura-1's REST response is the raw audio body (not JSON-wrapped base64) — the
// Deno shell reads it as bytes and base64-encodes it itself, so there's no
// fromCloudflareTtsResponse counterpart here (nothing to parse out of JSON).
export function toCloudflareTtsRequest({ accountId, model, text, speaker = 'orion', encoding = 'mp3' }) {
  return { url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, body: { text, speaker, encoding } };
}

/** True when the response body is raw audio bytes, not a JSON envelope — Aura-1's
 * normal case. Defensive: some Workers AI models wrap output in JSON even for
 * binary kinds, so the caller still needs to branch on this rather than assume. */
export const isBinaryAudioContentType = (contentType) => !!contentType && !contentType.includes('application/json');

// ── Cloudflare Workers AI — text embeddings (BAAI bge-base-en-v1.5) ─────────
// Same account-scoped URL shape as image/tts. Response IS JSON (unlike Aura's
// raw bytes): { result: { data: [[...768 floats...]], shape: [n, 768] } }.
// Batches are supported (text: string[]) but C2 only ever sends one string at
// a time — kept as an array param anyway so batching is a non-breaking future
// change, not a new function.
export function toCloudflareEmbedRequest({ accountId, model, text }) {
  return { url: `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`, body: { text: [text] } };
}
export function fromCloudflareEmbedResponse(json) {
  const vec = json?.result?.data?.[0];
  return Array.isArray(vec) && vec.length === EMBED_DIMENSIONS ? { embedding: vec, dims: vec.length } : null;
}

// ── Cloudflare GraphQL Analytics — Workers AI neuron quota ──────────────────
// Verified live against the real account (2026-07-15): dataset name, field
// names, and query shape are all confirmed correct via schema introspection —
// NOT guessed from docs (Cloudflare's docs don't cover this dataset at all).
// The free allocation is 10,000 neurons/day (Cloudflare's published pricing).
// Requires the API token to carry "Account Analytics: Read" — a DIFFERENT
// scope than "Workers AI: Run" (used for actual generation) — so this can
// legitimately 403 even when image/tts generation works fine. Honest fallback
// on that, never a fabricated number.
export const FREE_NEURONS_PER_DAY = 10000;

export function toNeuronQuotaQuery({ accountId, date }) {
  return {
    url: 'https://api.cloudflare.com/client/v4/graphql',
    body: {
      query: `query($accountTag: String!, $date: Date!) {
        viewer {
          accounts(filter: { accountTag: $accountTag }) {
            aiInferenceAdaptiveGroups(limit: 100, filter: { date: $date }) {
              count
              sum { totalNeurons }
              dimensions { modelId }
            }
          }
        }
      }`,
      variables: { accountTag: accountId, date },
    },
  };
}

export function fromNeuronQuotaResponse(json) {
  const authzError = json?.errors?.find((e) => e.extensions?.code === 'authz' || /not authorized/i.test(e.message || ''));
  if (authzError) return { error: 'insufficient_scope' };
  if (json?.errors?.length) return { error: json.errors[0].message || 'unknown_error' };
  const rows = json?.data?.viewer?.accounts?.[0]?.aiInferenceAdaptiveGroups;
  if (!rows) return { error: 'no_data' };
  const byModel = rows.map((r) => ({ modelId: r.dimensions?.modelId || 'unknown', requests: r.count, neurons: r.sum?.totalNeurons ?? 0 }))
    .sort((a, b) => b.neurons - a.neurons);
  const neuronsUsedToday = byModel.reduce((s, m) => s + m.neurons, 0);
  return { neuronsUsedToday, byModel };
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
