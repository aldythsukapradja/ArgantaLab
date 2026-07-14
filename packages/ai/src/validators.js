// ─────────────────────────────────────────────────────────────────────────
// WS-4 · Validation Layer  (Sonnet)
// Concrete implementations of the five validators the source doc's escalation
// ladder requires (Generate → schema → grounding → policy → confidence →
// accept/escalate). Pure, dependency-free (no ajv — a minimal JSON-Schema
// subset covers what @arganta/ai's callers actually need: required top-level
// keys + primitive types). Policy/cost validators are thin wrappers over the
// already-shipped governance.js so there is exactly one source of truth for
// those rules.
// ─────────────────────────────────────────────────────────────────────────

import { isRouteAllowed, budgetGuard } from './governance.js';

/** @typedef {{ok:boolean, reason?:string}} VCheck */

// ── schema ───────────────────────────────────────────────────────────────
/**
 * Minimal JSON-Schema subset: `type:'object'`, `required:string[]`,
 * `properties:{key:{type}}` (type ∈ string|number|boolean|array|object).
 * Enough for the shapes @arganta/ai callers actually pass; a real ajv swap is
 * a drop-in upgrade later if a schema needs more (oneOf/pattern/etc).
 * @param {unknown} value
 * @param {object} [schema]
 * @returns {VCheck}
 */
export function validateSchema(value, schema) {
  if (!schema) return { ok: value != null, reason: value == null ? 'no value' : undefined };
  if (value == null || typeof value !== 'object') return { ok: false, reason: 'not an object' };
  for (const key of schema.required || []) {
    if (!(key in value)) return { ok: false, reason: `missing required field "${key}"` };
  }
  for (const [key, def] of Object.entries(schema.properties || {})) {
    if (!(key in value)) continue;
    const t = def?.type;
    if (!t) continue;
    const actual = Array.isArray(value[key]) ? 'array' : typeof value[key];
    if (actual !== t) return { ok: false, reason: `field "${key}" expected ${t}, got ${actual}` };
  }
  return { ok: true };
}

// ── grounding ────────────────────────────────────────────────────────────
const NUM_RE = /-?\d[\d,]*\.?\d*/g;
/**
 * Anti-hallucination check for numeric claims: every number the answer states
 * (beyond small/common ones) should trace back to a number actually present in
 * the source data it was given. Catches a model inventing a stat, not a model
 * paraphrasing text — text-citation checking is a documented follow-up.
 * @param {string} text
 * @param {unknown} sourceData  the same data passed into the prompt
 * @param {{minMagnitude?:number}} [opts]  ignore small numbers (percentages, counts) below this
 */
export function validateGrounding(text, sourceData, opts = {}) {
  const minMagnitude = opts.minMagnitude ?? 100;
  const claimed = [...String(text || '').matchAll(NUM_RE)].map((m) => parseFloat(m[0].replace(/,/g, ''))).filter((n) => Number.isFinite(n) && Math.abs(n) >= minMagnitude);
  if (claimed.length === 0) return { ok: true }; // nothing to check
  const sourceNums = new Set(extractNumbers(sourceData).map(round2sig));
  const unsupported = claimed.filter((n) => !sourceNums.has(round2sig(n)));
  return unsupported.length === 0
    ? { ok: true }
    : { ok: false, reason: `unsupported numeric claim(s): ${unsupported.slice(0, 3).join(', ')}` };
}
function extractNumbers(v, out = []) {
  if (typeof v === 'number') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => extractNumbers(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => extractNumbers(x, out));
  return out;
}
// tolerate rounding differences (a model saying "≈48k" for 47975) via 2-sig-fig bucketing
const round2sig = (n) => { if (n === 0) return 0; const d = Math.ceil(Math.log10(Math.abs(n))); const p = 2 - d; const f = 10 ** p; return Math.round(n * f) / f; };

// ── policy (thin wrapper over governance.js — one source of truth) ────────
/** @param {object} model @param {string} dataClass @returns {VCheck} */
export function validatePolicy(model, dataClass) {
  const ok = isRouteAllowed(model, dataClass);
  return ok ? { ok: true } : { ok: false, reason: `${model?.id ?? 'model'} not permitted for dataClass=${dataClass}` };
}

/** @returns {VCheck} */
export function validateCost(budget, running, planned) {
  if (!budget) return { ok: true };
  const g = budgetGuard(budget, running, planned);
  return g.ok ? { ok: true } : { ok: false, reason: g.reason };
}

// ── quality ──────────────────────────────────────────────────────────────
/**
 * Structural completeness + benchmark floor. Not a substitute for real eval —
 * catches empty/truncated/placeholder answers before they reach the user.
 * @param {string} text @param {{minLength?:number, benchmarkScore?:number, floor?:number}} [opts]
 */
export function validateQuality(text, opts = {}) {
  const minLength = opts.minLength ?? 1;
  if (!text || text.trim().length < minLength) return { ok: false, reason: 'empty or too short' };
  if (opts.floor != null && (opts.benchmarkScore ?? 100) < opts.floor) return { ok: false, reason: `benchmark ${opts.benchmarkScore} below floor ${opts.floor}` };
  return { ok: true };
}

// ── pipeline ─────────────────────────────────────────────────────────────
/**
 * Run the full ladder in the doc's order; short-circuits on the first failure
 * (cheaper checks first). Returns a ValidationResult-shaped object matching
 * ledger.js's validationResult().
 * @param {{text?:string, json?:unknown, schema?:object, model:object, dataClass:string,
 *          sourceData?:unknown, budget?:object, running?:object, planned?:object,
 *          minLength?:number, benchmarkScore?:number, floor?:number}} ctx
 */
export function runValidators(ctx) {
  const schema = ctx.schema ? validateSchema(ctx.json, ctx.schema) : { ok: true };
  const grounding = ctx.sourceData !== undefined ? validateGrounding(ctx.text, ctx.sourceData) : { ok: true };
  const policy = ctx.model ? validatePolicy(ctx.model, ctx.dataClass) : { ok: true };
  const cost = validateCost(ctx.budget, ctx.running, ctx.planned);
  const quality = validateQuality(ctx.text, { minLength: ctx.minLength, benchmarkScore: ctx.benchmarkScore, floor: ctx.floor });
  const checks = { schema, grounding, policy, cost, quality };
  const failed = Object.entries(checks).find(([, c]) => !c.ok);
  return {
    schema: schema.ok, grounding: grounding.ok, policy: policy.ok, cost: cost.ok, quality: quality.ok,
    passed: !failed,
    notes: failed ? [`${failed[0]}: ${failed[1].reason}`] : [],
  };
}
