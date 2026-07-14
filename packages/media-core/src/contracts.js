// Public contracts for @arganta/media-core.
//
// Aligned with docs/marketing-production-fabric SharedContractStandard:
// provider-neutral, every durable result carries provenance, errors use one
// envelope. Kept as plain JS + JSDoc (matches @arganta/audio, /video, /ai).

/** Media kinds the router can produce. */
export const MEDIA_KINDS = ['image', 'music', 'video', 'voice', 'sfx'];

/**
 * Maturity stages — the core cost principle turned into a number.
 *   0 deterministic  free, reproducible (same spec+seed → same bytes), no API
 *   1 free-api       free hosted models
 *   2 economical     cheap paid models, no approval friction
 *   3 premium        expensive providers, REQUIRES evidence + approval
 */
export const MATURITY = Object.freeze({
  DETERMINISTIC: 0,
  FREE_API: 1,
  ECONOMICAL: 2,
  PREMIUM: 3,
});

export const MATURITY_LABEL = ['deterministic', 'free-api', 'economical', 'premium'];

// ── costClass alignment (WS-A) ────────────────────────────────────────────
// media-core's maturityStage IS the Four-Tier Router's costClass — same 0..3.
// Alias so both packages speak one taxonomy. See @arganta/ai/tiers.js and
// docs/adr/0002-media-core-costclass-alignment.md.
export const COST_CLASS = MATURITY; // { SOVEREIGN:0, SPONSORED:1, ECONOMY:2, FRONTIER:3 } by value
export const COST_LABEL = ['Sovereign', 'Sponsored', 'Economy', 'Frontier'];
/** map a maturityStage (0..3) to its costClass — identity, but explicit. */
export const toCostClass = (maturityStage) => maturityStage;

/** Stage at/above which a job may not run without an explicit approval. */
export const APPROVAL_REQUIRED_AT = MATURITY.PREMIUM;

/** Error sources — one envelope shared by every adapter. */
export const ERROR_SOURCES = ['validation', 'policy', 'provider', 'storage', 'render', 'auth', 'internal'];

/**
 * Build a normalized DomainError. Never thrown directly by adapters — returned
 * inside a failed job, or thrown wrapped so callers get one shape.
 * @returns {{code:string,message:string,retryable:boolean,source:string,details?:object,correlationId:string}}
 */
export function domainError(code, message, { source = 'internal', retryable = false, details, correlationId } = {}) {
  return { code, message, retryable, source: ERROR_SOURCES.includes(source) ? source : 'internal', details, correlationId: correlationId || newId('err') };
}

export class MediaError extends Error {
  constructor(err) {
    super(err.message);
    this.name = 'MediaError';
    this.domain = err;
  }
}

let _seq = 0;
/** Deterministic-ish id: prefix + time + monotonic counter. */
export function newId(prefix = 'job') {
  return `${prefix}_${Date.now().toString(36)}_${(_seq++).toString(36)}`;
}

/**
 * A MediaJob result. `provenance` is mandatory — no asset without lineage.
 * @param {object} p
 */
export function mediaResult({ kind, spec, stage, provider, tier, runtime, cost = 0, estimated = false, seed, mime, bytes, uri, checksum, correlationId, extra }) {
  return {
    schemaVersion: 1,
    id: newId('asset'),
    kind,
    status: 'succeeded',
    createdAt: new Date().toISOString(),
    // where it can actually run: 'node' produced bytes here; 'browser' must be
    // executed by the HQ engines; 'mcp' must be executed by an operator tool.
    runtime,
    provenance: {
      provider,
      tier,
      maturityStage: stage,
      maturityLabel: MATURITY_LABEL[stage],
      cost,
      estimated,
      seed: seed ?? null,
      checksum: checksum ?? null,
      spec,
      correlationId: correlationId || newId('corr'),
    },
    output: { mime: mime ?? null, bytes: bytes ?? null, uri: uri ?? null, ...extra },
  };
}

/**
 * A deferred job — the router resolved a real provider but the bytes must be
 * produced elsewhere (browser engine or a paid MCP tool). Carries an actionable
 * descriptor the caller/operator fulfills.
 */
export function deferredResult({ kind, spec, stage, provider, tier, runtime, reason, descriptor, estimatedCost = 0, correlationId }) {
  return {
    schemaVersion: 1,
    id: newId('job'),
    kind,
    status: 'deferred',
    createdAt: new Date().toISOString(),
    runtime,
    reason,
    // what the fulfiller must call. Provider-neutral: {engine|tool, call, args}.
    descriptor,
    provenance: {
      provider, tier, maturityStage: stage, maturityLabel: MATURITY_LABEL[stage],
      cost: estimatedCost, estimated: true, spec, correlationId: correlationId || newId('corr'),
    },
  };
}
