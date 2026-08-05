// agent/runtime.ts — the language tier, on the shared Arganta runtime.
//
// Mirrors apps/hq/src/lib/core/runtime.ts: @arganta/ai's createLLM for
// transport, @arganta/agent's pure runAgentLoop for the turn. Same contracts,
// same honest-degrade rule, same tool registry.
//
// ONE deliberate difference from HQ — the transport. HQ routes through the
// Supabase Edge Function `llm-proxy`, which hard-gates on an operator email in
// the JWT (403 for anyone else) and has no Anthropic tool translation.
// apps/energy has no Supabase auth at all, so it points @arganta/ai's
// `openaiCompat` provider at our own Cloudflare Worker instead. That provider
// exists for exactly this, and it brings real SSE streaming with it.
//
// The Worker never sees petroleum data: tools execute HERE, in the browser,
// against local JSON. That is both the privacy story for client datasets and the
// reason the model cannot fabricate a figure — it is never handed one.

import { createLLM, type Llm, type LlmReply } from '@arganta/ai';
import { AUTONOMY, missionBudget, availableTools, runAgentLoop, type ToolSpec } from '@arganta/agent';
import { ensureRegistered, toProviderTools } from './tools.ts';

// Vite always defines import.meta.env; plain Node (the truth-lock scripts) does
// not, so this stays optional-chained.
const env = ((import.meta as { env?: Record<string, string | undefined> }).env ?? {});
const BASE = (env.VITE_ENERGY_AGENT_URL || '').replace(/\/+$/, '');
const TOKEN = env.VITE_ENERGY_AGENT_TOKEN || '';
/** Kept in step with the Worker's GROQ_MODEL var; the Worker is free to override. */
const MODEL = env.VITE_ENERGY_AGENT_MODEL || 'llama-3.3-70b-versatile';

/** True when a Worker URL is configured. Not a promise that it works — the
 *  first failed turn flips the degraded flag below. */
export const agentEnabled = !!BASE;

export type Tier = 'lite' | 'core';

let degraded = false;
export function tier(): Tier { return agentEnabled && !degraded ? 'core' : 'lite'; }
export function clearDegraded(): void { degraded = false; }

/**
 * The adapter. `openaiCompat` appends `/chat/completions` to baseUrl, so the
 * base must end at `/v1` to reach the Worker's `/v1/chat/completions`.
 *
 * createLLM NEVER hard-fails: with no baseUrl it falls back to the deterministic
 * mock, and the loop reports `provider === 'mock'` → stopReason 'no-model'.
 * That is the signal we use to drop to the deterministic tier — the same
 * honest-degrade contract HQ relies on.
 */
export const llm: Llm = createLLM(
  BASE
    ? { openaiCompat: { baseUrl: `${BASE}/v1`, apiKey: TOKEN, model: MODEL } }
    : {},
);

export interface TurnOutcome {
  text: string;
  stopReason: string;
  provider: string | null;
  trail: Record<string, unknown>[];
}

export interface ActiveModel {
  provider: string;
  model: string;
  /** The whole ladder the Worker will try, in order. `provider`/`model` are its
   *  head — the PREFERRED provider, which is not the same claim as the one that
   *  answered. When groq is configured but failing, health still lists it first
   *  and Workers AI does the work; only the turn's own trace knows which ran. */
  ladder: { provider: string; model: string }[];
}

/**
 * What the Worker is configured to try, read from its own /v1/health.
 *
 * This is an AVAILABILITY report, not an attribution: health can only say which
 * providers have credentials, in preference order. Which one actually served a
 * given turn is knowable only after the fact, from that turn's trace. Callers
 * must not present the head of this ladder as "the model that answered".
 *
 * Returns null if unconfigured, unreachable, or reporting no provider — the
 * deterministic tier, honestly, with nothing to show.
 */
export async function fetchActiveModel(): Promise<ActiveModel | null> {
  if (!BASE) return null;
  try {
    const res = await fetch(`${BASE}/v1/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const body = await res.json() as { providers?: { name: string; model: string }[] };
    const ladder = (body.providers ?? []).map((p) => ({ provider: p.name, model: p.model }));
    const first = ladder[0];
    return first ? { ...first, ladder } : null;
  } catch {
    return null;
  }
}

/**
 * Run one language-tier turn.
 *
 * `executeTool` is injected by the caller (useAgent), which runs the tool call
 * through dialogue.runIntent() and keeps the resulting card. What comes BACK to
 * the model is only a number-free summary, so it has nothing to restate.
 */
export async function runTurn(
  userText: string,
  executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>,
  options: { maxSteps?: number; onTrail?: (entry: Record<string, unknown>) => void } = {},
): Promise<TurnOutcome> {
  const specs: ToolSpec[] = ensureRegistered();
  // maxCostClass 0: only free, local, side-effect-free tools are ever offered.
  // Defence in depth alongside the loop's own autonomy gate.
  const offered = availableTools(specs, { autonomous: false, maxCostClass: 0 });

  let provider: string | null = null;
  const callModel = async ({ messages, tools }: { messages: unknown[]; tools: unknown[] }): Promise<LlmReply> => {
    const reply = await llm.chatTools({
      task: 'orchestrate',
      messages,
      tools: tools as { name: string }[],
      temperature: 0,
    });
    provider = reply.provider ?? null;
    // Truthfulness gate, lifted from HQ's runtime: a silently-mocked provider
    // must never look like a real answer.
    if (reply.provider === 'mock') { degraded = true; return { ...reply, provider: 'mock' }; }
    degraded = false;
    return reply;
  };

  try {
    const result = await runAgentLoop({
      messages: [{ role: 'user', content: userText }],
      tools: toProviderTools(offered),
      callModel,
      executeTool,
      maxSteps: options.maxSteps ?? 4,
      autonomyLevel: AUTONOMY.ON_DEMAND,
      budget: missionBudget({}),
      onTrail: options.onTrail,
    });
    return { text: result.text, stopReason: result.stopReason, provider, trail: result.trail };
  } catch {
    degraded = true;
    return { text: '', stopReason: 'error', provider, trail: [] };
  }
}
