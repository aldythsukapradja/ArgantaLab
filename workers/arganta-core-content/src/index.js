// Arganta Core Content Engine — Cloudflare Worker runtime. Thin: CORS/auth via
// router.js (pure), then call Workers AI (env.AI) for copy (text model → strict
// JSON) or image (SDXL → PNG bytes). Returns a truthful provenance envelope so
// HQ's ledger records the REAL provider/model/latency, never a fabricated one.
//
// Bindings (wrangler.toml): AI (Workers AI), vars TEXT_MODEL / IMAGE_MODEL /
// ALLOWED_ORIGINS, secret CORE_TOKEN.
import {
  corsHeaders, isAuthed, jsonResponse, errorEnvelope, parseGenerateBody, estimateNeurons,
} from '../router.js';
import { coerceCopy, extractJson } from '../schema.js';
import { copyMessages, imagePrompt, textMessages, cleanRewrite } from '../prompts.js';
import {
  BUFFER_API, accountOrgsQuery, extractOrgs, channelsQuery, extractChannels,
  createPostMutation, extractPostResult, parsePublishBody,
} from '../buffer.js';

const TEXT_MODEL_DEFAULT = '@cf/meta/llama-3.1-8b-instruct-fp8';
const IMAGE_MODEL_DEFAULT = '@cf/bytedance/stable-diffusion-xl-lightning';

function send(env, origin, { status, headers, body }) {
  return new Response(body, { status, headers: { ...headers, ...corsHeaders(origin, env) } });
}

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function runCopy(env, req) {
  const model = env.TEXT_MODEL || TEXT_MODEL_DEFAULT;
  const started = Date.now();
  // The small instruct model is streaky — it occasionally returns unparseable
  // or empty JSON. Retry ONCE on an empty result (slightly hotter) before
  // giving up, so the app uses Arganta Core instead of the weaker local draft.
  let out, copy;
  for (let attempt = 0; attempt < 2; attempt++) {
    out = await env.AI.run(model, {
      messages: copyMessages(req.brief, req.context),
      max_tokens: 1200,
      temperature: attempt === 0 ? 0.7 : 0.55,
    });
    const text = typeof out === 'string' ? out : (out.response || out.result || '');
    copy = coerceCopy(extractJson(text) || {});
    if (copy.slides.length > 0) break;
  }
  return {
    copy,
    provenance: {
      provider: 'cloudflare-workers-ai',
      model,
      latencyMs: Date.now() - started,
      neurons: estimateNeurons('copy', { promptTokens: (out.usage && out.usage.prompt_tokens) || 0, completionTokens: (out.usage && out.usage.completion_tokens) || 0 }),
      estimated: true,
    },
    // surfaced so callers can see whether the model actually produced usable slides
    usable: copy.slides.length > 0,
  };
}

/** The `text` kind — rewrite one line. Low temperature and a tight token budget:
 *  this is fine-tuning a line the founder already wrote, so drifting off it is
 *  the failure mode, not being boring. `usable` is false when the model wrapped
 *  its answer in chatter or ballooned the length past what cleanRewrite allows —
 *  the caller then keeps the original rather than wrecking the canvas. */
async function runText(env, req) {
  const model = env.TEXT_MODEL || TEXT_MODEL_DEFAULT;
  const started = Date.now();
  const out = await env.AI.run(model, {
    messages: textMessages(req.text, req.preset, req.context),
    max_tokens: 160,
    temperature: 0.6,
  });
  const raw = typeof out === 'string' ? out : (out.response || out.result || '');
  const text = cleanRewrite(raw, req.text);
  return {
    text,
    usable: !!text && text !== req.text,
    provenance: {
      provider: 'cloudflare-workers-ai',
      model,
      latencyMs: Date.now() - started,
      neurons: estimateNeurons('text', {
        promptTokens: (out.usage && out.usage.prompt_tokens) || 0,
        completionTokens: (out.usage && out.usage.completion_tokens) || 0,
      }),
      estimated: true,
    },
  };
}

// Sniff real magic bytes rather than trust a model's documented contentType —
// confirmed live that @cf/bytedance/stable-diffusion-xl-lightning's catalog
// schema claims "image/png" but actually returns JPEG bytes (JFIF header).
// Mislabeling this breaks anything that inspects the Blob's type downstream.
function sniffImageMime(bytes) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return 'image/webp';
  return 'application/octet-stream';
}

async function runImage(env, req) {
  const model = env.IMAGE_MODEL || IMAGE_MODEL_DEFAULT;
  const started = Date.now();
  const prompt = imagePrompt(req.prompt, req.context);
  const result = await env.AI.run(model, {
    prompt,
    width: req.aspect.w,
    height: req.aspect.h,
    num_steps: 20,
  });
  // Workers AI image models return either a ReadableStream (SDXL family) or an
  // object with a base64 `image` field (flux family). Normalise both to bytes,
  // sniff the real mime, then base64 that.
  let bytes;
  if (result && typeof result.image === 'string') {
    bytes = b64ToBytes(result.image);
  } else {
    bytes = new Uint8Array(await new Response(result).arrayBuffer());
  }
  const mime = sniffImageMime(bytes);
  const base64 = bytesToBase64(bytes);
  return {
    imageBase64: base64,
    mime,
    width: req.aspect.w,
    height: req.aspect.h,
    provenance: {
      provider: 'cloudflare-workers-ai',
      model,
      latencyMs: Date.now() - started,
      neurons: estimateNeurons('image'),
      estimated: true,
    },
  };
}

// S5: a quota READ, not a metered count — Workers AI per-request usage needs
// the Cloudflare GraphQL Analytics API (account-level token), which this Worker
// doesn't hold. Returns the documented free-tier daily neuron allowance as an
// honest, clearly-estimated figure (mirrors mediaGateway.getNeuronQuota's own
// fallback) rather than fabricating a measured count.
function quotaResponse(env, origin) {
  return send(env, origin, jsonResponse({
    ok: true, freePerDay: 10000, estimated: true,
    textModel: env.TEXT_MODEL || TEXT_MODEL_DEFAULT,
    imageModel: env.IMAGE_MODEL || IMAGE_MODEL_DEFAULT,
    note: 'Static free-tier allowance — per-call usage requires Cloudflare Account Analytics access, not held by this Worker.',
  }, 200));
}

// ── BF1: Buffer proxy ──────────────────────────────────────────────────────
// One GraphQL call against Buffer, holding BUFFER_TOKEN server-side so it never
// touches the browser. Returns the parsed JSON (throws on transport failure).
async function bufferGraphql(env, query) {
  const res = await fetch(BUFFER_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${env.BUFFER_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = (data && (data.error || (data.errors && data.errors.map((e) => e.message).join('; ')))) || `Buffer HTTP ${res.status}`;
    throw new Error(msg);
  }
  // GraphQL reports schema/validation/authorization failures as HTTP 200 with an
  // `errors` array — surface those instead of silently returning empty data.
  if (data && Array.isArray(data.errors) && data.errors.length) {
    throw new Error(data.errors.map((e) => e.message).join('; '));
  }
  return data;
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }
    if (request.method === 'GET' && url.pathname === '/v1/quota') {
      return quotaResponse(env, origin);
    }

    // ── Buffer routes (BF1). Gated by the same CORE_TOKEN bearer as generation. ──
    if (url.pathname === '/v1/buffer/channels' && request.method === 'GET') {
      if (!isAuthed(request, env)) return send(env, origin, jsonResponse(errorEnvelope('unauthorized', 'missing or bad bearer token'), 401));
      if (!env.BUFFER_TOKEN) return send(env, origin, jsonResponse(errorEnvelope('buffer_unconfigured', 'BUFFER_TOKEN not set on the Worker'), 503));
      try {
        // Buffer's channels query needs an organizationId — fetch the account's
        // orgs first, then gather channels across them.
        const orgs = extractOrgs(await bufferGraphql(env, accountOrgsQuery()));
        const all = [];
        for (const org of orgs) {
          const chans = extractChannels(await bufferGraphql(env, channelsQuery(org.id)));
          for (const c of chans) all.push({ ...c, organizationId: org.id });
        }
        return send(env, origin, jsonResponse({ ok: true, channels: all }, 200));
      } catch (e) {
        console.error('[buffer channels]', e && e.message);
        return send(env, origin, jsonResponse(errorEnvelope('buffer_failed', (e && e.message) || 'Buffer request failed'), 502));
      }
    }

    if (url.pathname === '/v1/buffer/publish' && request.method === 'POST') {
      if (!isAuthed(request, env)) return send(env, origin, jsonResponse(errorEnvelope('unauthorized', 'missing or bad bearer token'), 401));
      if (!env.BUFFER_TOKEN) return send(env, origin, jsonResponse(errorEnvelope('buffer_unconfigured', 'BUFFER_TOKEN not set on the Worker'), 503));
      let body;
      try { body = await request.json(); }
      catch { return send(env, origin, jsonResponse(errorEnvelope('bad_json', 'body was not valid JSON'), 400)); }
      const pub = parsePublishBody(body);
      if (!pub.ok) return send(env, origin, jsonResponse(errorEnvelope(pub.code, pub.message), 400));
      try {
        const data = await bufferGraphql(env, createPostMutation(pub.req));
        const result = extractPostResult(data);
        if (!result.ok) return send(env, origin, jsonResponse(errorEnvelope('buffer_rejected', result.message), 502));
        return send(env, origin, jsonResponse({
          ok: true, postId: result.postId, mode: pub.req.mode,
          images: pub.req.imageUrls ? pub.req.imageUrls.length : 0,
          video: !!pub.req.videoUrl,
        }, 200));
      } catch (e) {
        console.error('[buffer publish]', e && e.message);
        return send(env, origin, jsonResponse(errorEnvelope('buffer_failed', (e && e.message) || 'Buffer request failed'), 502));
      }
    }

    if (request.method !== 'POST') {
      return send(env, origin, jsonResponse(errorEnvelope('method_not_allowed', 'POST only'), 405));
    }

    if (url.pathname !== '/v1/generate') {
      return send(env, origin, jsonResponse(errorEnvelope('not_found', `no route for ${url.pathname}`), 404));
    }

    if (!isAuthed(request, env)) {
      return send(env, origin, jsonResponse(errorEnvelope('unauthorized', 'missing or bad bearer token'), 401));
    }

    let raw;
    try { raw = await request.json(); }
    catch { return send(env, origin, jsonResponse(errorEnvelope('bad_json', 'body was not valid JSON'), 400)); }

    const parsed = parseGenerateBody(raw);
    if (!parsed.ok) return send(env, origin, jsonResponse(errorEnvelope(parsed.code, parsed.message), 400));

    try {
      const run = parsed.req.kind === 'copy' ? runCopy : parsed.req.kind === 'text' ? runText : runImage
      const data = await run(env, parsed.req);
      return send(env, origin, jsonResponse({ ok: true, kind: parsed.req.kind, ...data }, 200));
    } catch (e) {
      console.error('[arganta-core-content]', parsed.req.kind, e && e.message);
      return send(env, origin, jsonResponse(errorEnvelope('generation_failed', (e && e.message) || 'AI run failed'), 502));
    }
  },
};
