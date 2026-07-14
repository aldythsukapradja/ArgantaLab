// ─────────────────────────────────────────────────────────────────────────
// WS-A · Model Registry contract  (Opus)
// The ModelSpec is the single source of truth for provider availability, model
// capabilities, cost, task/data permissions, lifecycle, benchmark, priority.
// Sonnet WS-2 populates MODEL_REGISTRY against this shape.
// ─────────────────────────────────────────────────────────────────────────

import { COST_CLASS, EXECUTION, CAPABILITIES, DATA_CLASSES, isCostClass } from './tiers.js';

const NO_CAPS = Object.freeze(Object.fromEntries(CAPABILITIES.map((c) => [c, false])));

/**
 * Build a validated ModelSpec (fills defaults, never throws — returns { spec, errors }).
 * @param {object} m
 */
export function modelSpec(m) {
  const errors = [];
  if (!m.id) errors.push('id required');
  if (!isCostClass(m.costClass)) errors.push('costClass must be 0..3');
  if (m.execution && !EXECUTION.includes(m.execution)) errors.push(`execution invalid: ${m.execution}`);
  const spec = {
    id: m.id,
    name: m.name || m.id,
    provider: m.provider || 'unknown',
    apiModel: m.apiModel || m.id,
    costClass: m.costClass ?? COST_CLASS.SOVEREIGN,
    subtier: m.subtier || null, // '0A' | '0B' | '0C' for Tier 0
    execution: m.execution || 'external-api',
    capabilities: { ...NO_CAPS, ...(m.capabilities || {}) },
    dataClasses: (m.dataClasses || ['public']).filter((d) => DATA_CLASSES.includes(d)),
    lifecycle: m.lifecycle || 'active', // active|preview|deprecated|disabled
    contextWindow: m.contextWindow || 4096,
    vramRequiredMB: m.vramRequiredMB,
    pricing: m.pricing || null, // { inputUsdPerMillion, outputUsdPerMillion, cachedInputUsdPerMillion? }
    limits: m.limits || null,   // { requestsPerMinute, tokensPerMinute, requestsPerDay }
    benchmarkProfile: m.benchmarkProfile || null,
    priority: m.priority ?? 100,
  };
  return { spec, errors };
}

export const hasCapabilities = (model, required = []) => required.every((c) => model.capabilities?.[c]);
export const isActive = (model) => model.lifecycle === 'active';
export const allowsDataClass = (model, dataClass) => (model.dataClasses || []).includes(dataClass);

/** Estimated USD for a call given rough token counts (0 for Tier 0 / no pricing). */
export function estimateCostUsd(model, inputTokens = 0, outputTokens = 0) {
  const p = model.pricing;
  if (!p) return 0;
  return (inputTokens / 1e6) * (p.inputUsdPerMillion || 0) + (outputTokens / 1e6) * (p.outputUsdPerMillion || 0);
}
