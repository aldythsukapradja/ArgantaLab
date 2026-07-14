// The one public entry point: generate({ kind, spec, maturityStage, approved }).
// Routes to the cheapest capable adapter, enforces the approval gate, and
// returns a MediaJob result with complete provenance. Never throws for expected
// conditions — returns a normalized failed/deferred job instead.

import { checksum as sha256 } from './hash.js';
import { createRegistry } from './registry.js';
import { route } from './router.js';
import {
  MATURITY, APPROVAL_REQUIRED_AT, MEDIA_KINDS,
  mediaResult, deferredResult, domainError, MediaError,
} from './contracts.js';

/**
 * @param {object} req
 * @param {string} req.kind            image|music|video|voice|sfx
 * @param {object} [req.spec]          adapter-specific spec (prompt, size, seed…)
 * @param {number} [req.maturityStage] 0..3, default 0 (deterministic & free)
 * @param {boolean}[req.approved]      required to run stage >= PREMIUM
 * @param {object} [req.actor]         { id, kind } for provenance/audit
 * @param {string} [req.correlationId]
 * @param {object} [opts]
 * @param {ReturnType<createRegistry>} [opts.registry]
 * @param {boolean}[opts.throwOnError] throw MediaError instead of returning failed job
 */
export function generate(req = {}, opts = {}) {
  const registry = opts.registry || createRegistry();
  const { kind, spec = {}, maturityStage = MATURITY.DETERMINISTIC, approved = false, actor, correlationId } = req;

  const fail = (err) => {
    if (opts.throwOnError) throw new MediaError(err);
    return { schemaVersion: 1, status: 'failed', kind, error: err, createdAt: new Date().toISOString() };
  };

  if (!MEDIA_KINDS.includes(kind)) {
    return fail(domainError('unknown_kind', `kind must be one of ${MEDIA_KINDS.join(', ')}`, { source: 'validation', correlationId }));
  }

  const { adapter, stage, downgraded, reason } = route(registry, kind, maturityStage);

  // Approval gate — the core money rule. Premium never runs without approval.
  if (stage >= APPROVAL_REQUIRED_AT && !approved) {
    return fail(domainError(
      'approval_required',
      `stage ${stage} (${kind}) is premium and requires approved:true`,
      { source: 'policy', retryable: false, correlationId, details: { kind, stage, estimatedCost: adapter.cost, provider: adapter.id } },
    ));
  }

  let out;
  try {
    out = adapter.run(spec);
  } catch (e) {
    return fail(domainError('adapter_error', e.message, { source: 'render', retryable: true, correlationId, details: { adapter: adapter.id } }));
  }

  const base = {
    kind, spec, stage, provider: adapter.id, tier: adapter.tier,
    runtime: adapter.runtime, correlationId,
    actor: actor || { id: 'system', kind: 'system' },
  };

  // Adapter deferred to a browser engine or a paid MCP tool.
  if (out && out.deferred) {
    return { ...deferredResult({ ...base, reason: out.reason, descriptor: out.descriptor, estimatedCost: adapter.cost }), downgraded, routeNote: reason };
  }

  // Adapter produced real bytes here in Node.
  const checksum = sha256(out.bytes);
  return {
    ...mediaResult({
      ...base,
      cost: adapter.cost ?? 0,
      estimated: !!adapter.estimated,
      seed: out.seed,
      mime: out.mime,
      bytes: out.bytes,
      checksum,
      extra: out.extra,
    }),
    downgraded,
    routeNote: reason,
  };
}

export { createRegistry };
