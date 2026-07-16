// Arganta Core Content Engine — pure request logic (Sonnet-testable). CORS,
// auth-header parsing, request validation, and the error envelope live here so
// they can be exercised in plain Node. All network + AI-binding calls live in
// index.js — same split as build-artifact-runtime (router.js pure, index.js
// runtime).

import { TEMPLATE_IDS, aspectFor, DEFAULT_FORMAT } from './schema.js';

// CORS allowlist. Comma-separated in the ALLOWED_ORIGINS var; falls back to the
// known HQ origins so `wrangler dev` works out of the box. `*` is intentionally
// NOT supported — this Worker holds a bearer token and touches Workers AI.
const DEFAULT_ORIGINS = [
  'https://hq.arganta.app',
  'http://localhost:5173',
  'http://localhost:4173',
];

export function allowedOrigins(env) {
  const raw = (env && env.ALLOWED_ORIGINS) || '';
  const list = raw.split(',').map((s) => s.trim()).filter(Boolean);
  return list.length ? list : DEFAULT_ORIGINS;
}

// Origins allowed WITHOUT being listed in ALLOWED_ORIGINS. The real security
// boundary is the CORE_TOKEN bearer (CORS only gates browser origins), so we
// safely auto-allow every place HQ actually runs:
//   • localhost / 127.0.0.1 at ANY port (Vite autoPort bumps 5178→5179→5181…);
//   • *.arganta.app (production hq.arganta.app + any subdomain);
//   • *.vercel.app / *.pages.dev (Vercel & Cloudflare Pages preview deploys).
// A bumped port or a preview URL was silently failing CORS ("Failed to fetch"),
// which fell back to edgeProxy — no Cloudflare generation, no images.
export function isLocalhostOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin || '');
}
export function isTrustedOrigin(origin) {
  return isLocalhostOrigin(origin)
    || /^https:\/\/([a-z0-9-]+\.)*arganta\.app$/i.test(origin || '')
    || /^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(origin || '')
    || /^https:\/\/[a-z0-9-]+\.pages\.dev$/i.test(origin || '');
}

export function corsHeaders(origin, env) {
  const ok = origin && (isTrustedOrigin(origin) || allowedOrigins(env).includes(origin));
  return {
    'Access-Control-Allow-Origin': ok ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** True when the request carries the shared bearer token. When no CORE_TOKEN is
 * configured (local dev), auth is skipped so `wrangler dev` is frictionless. */
export function isAuthed(request, env) {
  const token = env && env.CORE_TOKEN;
  if (!token) return true; // dev / unconfigured
  const header = request.headers.get('Authorization') || '';
  const m = header.match(/^Bearer\s+(.+)$/i);
  return !!m && m[1] === token;
}

export function jsonResponse(body, status, extraHeaders) {
  return { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders }, body: JSON.stringify(body) };
}

export function errorEnvelope(code, message) {
  return { ok: false, error: { code, message } };
}

// Recognised request kinds. `copy` = text carousel + caption; `image` = one
// still; `text` = rewrite ONE line in place (the Post Studio polish capsule).
// O2/S3 add `script` for the Video Builder.
export const KINDS = Object.freeze(['copy', 'image', 'text']);

/** Rewrite intents the `text` kind accepts. An unknown preset is an error, not
 *  a silent default — a mis-typed preset returning "polish" would look like the
 *  model ignoring you. */
export const TEXT_PRESETS = Object.freeze(['polish', 'punchier', 'simpler']);

/**
 * Validate + normalise a parsed request body. Returns { ok:true, req } or
 * { ok:false, code, message }. Pure — no network.
 */
export function parseGenerateBody(raw) {
  if (!raw || typeof raw !== 'object') return { ok: false, code: 'bad_request', message: 'body must be a JSON object' };
  const kind = String(raw.kind || '');
  if (!KINDS.includes(kind)) return { ok: false, code: 'bad_kind', message: `kind must be one of ${KINDS.join(', ')}` };

  if (kind === 'copy') {
    const brief = typeof raw.brief === 'string' ? raw.brief.trim() : '';
    if (!brief) return { ok: false, code: 'no_brief', message: 'copy requires a non-empty "brief"' };
    const ctx = raw.context && typeof raw.context === 'object' ? raw.context : {};
    return { ok: true, req: { kind, brief: brief.slice(0, 2000), context: ctx } };
  }

  if (kind === 'text') {
    const text = typeof raw.text === 'string' ? raw.text.trim() : '';
    if (!text) return { ok: false, code: 'no_text', message: 'text requires a non-empty "text" to rewrite' };
    const preset = typeof raw.preset === 'string' ? raw.preset : 'polish';
    if (!TEXT_PRESETS.includes(preset)) {
      return { ok: false, code: 'bad_preset', message: `preset must be one of ${TEXT_PRESETS.join(', ')}` };
    }
    const ctx = raw.context && typeof raw.context === 'object' ? raw.context : {};
    // 400 chars is a headline/subline, not an essay. Clamping here keeps a
    // runaway paste from spending a carousel's budget on one label.
    return { ok: true, req: { kind, text: text.slice(0, 400), preset, context: ctx } };
  }

  // image
  const prompt = typeof raw.prompt === 'string' ? raw.prompt.trim() : '';
  if (!prompt) return { ok: false, code: 'no_prompt', message: 'image requires a non-empty "prompt"' };
  const format = typeof raw.format === 'string' && aspectFor(raw.format) ? raw.format : DEFAULT_FORMAT;
  const ctx = raw.context && typeof raw.context === 'object' ? raw.context : {};
  return { ok: true, req: { kind, prompt: prompt.slice(0, 800), format, context: ctx, aspect: aspectFor(format) } };
}

/** Approximate Cloudflare "neurons" so the ledger/rack can show real-ish cost
 * without a second API call. Text ≈ tokens/1000; image is a flat per-run rate.
 * These are estimates, tagged as such by callers — never presented as measured. */
export function estimateNeurons(kind, meta = {}) {
  if (kind === 'image') return 1; // SDXL step-bounded run, ~1 neuron-equivalent bucket
  const tokens = (meta.promptTokens || 0) + (meta.completionTokens || 0);
  return Math.max(1, Math.round(tokens / 1000));
}

export { TEMPLATE_IDS };
