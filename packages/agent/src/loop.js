// ─────────────────────────────────────────────────────────────────────────
// C1 · Agentic loop protocol  (Opus, contract-freeze)
// The pure state machine of a turn: the model plans → calls tools → reads real
// results → continues, bounded by step count AND budget, gated by autonomy,
// degrading honestly when no live model is present. Generalizes the working
// orchestrate() in apps/hq/src/data/agentTools.ts. callModel + executeTool are
// INJECTED so this is fully unit-testable with mocks — C3 wires the real ones
// (@arganta/ai chatTools + the tool executors). Nothing here touches the
// network, the DB, or the DOM.
// See docs/arganta-core/Arganta-Core-Concept.md.
// ─────────────────────────────────────────────────────────────────────────

import { toolByName } from './tools.js';
import { autonomyGate, missionBudget, AUTONOMY } from './autonomy.js';

/** Why the loop stopped. Every path is explicit — a caller never has to guess. */
export const STOP_REASONS = Object.freeze(['answered', 'max-steps', 'budget', 'no-model', 'error']);

/**
 * Run one agent turn.
 *
 * @param {object} o
 * @param {Array} o.messages         seed messages ({role, content}); mutated into the running transcript
 * @param {Array} o.tools            provider-shaped tool defs the model may call (from toOpenAITools(availableTools(...)))
 * @param {(args:{messages:Array,tools:Array})=>Promise<{text?:string,toolCalls?:Array,provider?:string,model?:string,costUsd?:number}>} o.callModel
 * @param {(name:string,args:object)=>Promise<any>} o.executeTool  runs a tool, returns its raw result (C3-injected)
 * @param {number} [o.maxSteps=4]
 * @param {object} [o.budget]        missionBudget(); default tight
 * @param {number} [o.autonomyLevel] AUTONOMY.* — ON_DEMAND has a human present
 * @param {(entry:object)=>void} [o.onTrail]  live trail callback (UI streaming)
 * @param {boolean} [o.granted]      standing grant for side-effecting tools (autonomous only)
 * @returns {Promise<{text:string, trail:Array, running:object, stopReason:string}>}
 */
export async function runAgentLoop(o) {
  const {
    messages, tools, callModel, executeTool,
    maxSteps = 4, autonomyLevel = AUTONOMY.ON_DEMAND, onTrail, granted = false,
  } = o;
  const budget = o.budget || missionBudget({});
  const running = { costUsd: 0, frontierCalls: 0, totalCalls: 0, tokens: 0 };
  const trail = [];
  const push = (e) => { trail.push(e); onTrail?.(e); };
  const done = (text, stopReason) => ({ text: text || '', trail, running, stopReason });

  for (let step = 0; step < maxSteps; step++) {
    let res;
    try {
      res = await callModel({ messages, tools });
    } catch (e) {
      push({ type: 'error', message: String(e?.message || e) });
      return done('', 'error');
    }
    // Honest degrade: the adapter fell back to its mock — no real model is
    // connected. Signal the caller to use its deterministic path; never present
    // mock output as a real answer (the truthfulness contract, everywhere).
    if (res.provider === 'mock') return done('', 'no-model');

    running.totalCalls += 1;
    running.costUsd += num(res.costUsd);
    push({ type: 'model', provider: res.provider ?? null, model: res.model ?? null, costUsd: num(res.costUsd) });

    const calls = Array.isArray(res.toolCalls) ? res.toolCalls : [];
    if (calls.length === 0) return done(res.text, 'answered'); // model answered without (more) tools

    // Record the assistant's tool-call turn so the model sees its own request.
    messages.push({ role: 'assistant', content: res.text || '', tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args || {}) } })) });

    for (const c of calls) {
      const spec = toolByName(c.name);
      const gate = autonomyGate({ tool: spec, autonomyLevel, running, budget, granted });

      if (!gate.allowed) {
        // Refused or needs-a-human: feed the model an honest tool result so it
        // can adapt/ask, and record the reason in the trail. Not an error —
        // a bounded system saying "not without approval" is correct behavior.
        const note = gate.needsApproval ? `approval required (${gate.reason})` : `refused (${gate.reason})`;
        push({ type: 'tool', name: c.name, ok: false, costUsd: 0, latencyMs: 0, blocked: gate.reason, needsApproval: gate.needsApproval });
        messages.push({ role: 'tool', tool_call_id: c.id, name: c.name, content: JSON.stringify({ blocked: note }) });
        if (gate.reason === 'budget:maxCostUsd' || String(gate.reason).startsWith('budget:')) return done(res.text, 'budget');
        continue;
      }

      const t0 = now();
      let data, ok = true;
      try { data = await executeTool(c.name, c.args || {}); }
      catch (e) { data = { error: String(e?.message || e) }; ok = false; }
      const latencyMs = Math.round(now() - t0);
      const costUsd = num(data?.costUsd);
      running.costUsd += costUsd;
      push({ type: 'tool', name: c.name, ok, costUsd, latencyMs, blocked: null });
      messages.push({ role: 'tool', tool_call_id: c.id, name: c.name, content: clip(data) });
    }
  }
  return done('', 'max-steps');
}

const num = (v) => (Number.isFinite(+v) ? +v : 0);
const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());
const clip = (o) => { try { return JSON.stringify(o ?? null).slice(0, 2000); } catch { return '"[unserializable]"'; } };
