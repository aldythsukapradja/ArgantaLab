// agent/useAgent.ts — the one React seam into the agent (D8).
//
// Owns the gazetteer load, the ScopeBrain installation, the dialogue turn and
// the dispatch of commands onto the store's bus. Every surface that wants to
// talk to the agent — the chat, ⌘K, a "explain this" affordance on a card —
// uses this hook, so there is exactly one place where the agent meets React.
//
// Tier selection lives here too: when a Worker is configured the turn goes
// through the language tier, and on ANY failure it falls back to the
// deterministic grammar. The user is told which tier answered; it never
// pretends.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../store';
import type { AgentCommand, AnswerCard } from './types.ts';
import { buildIndex, loadGazetteer, type GazIndex } from './gazetteer.ts';
import { makeScopeBrain } from './brain.ts';
import { newTurn, respond, runIntent, ladderLabel, type Turn } from './dialogue.ts';
import { suggest, type Candidate } from './resolve.ts';
import { agentEnabled, fetchActiveModel, runTurn, tier as currentTier, type ActiveModel, type Tier } from './runtime.ts';
import { TOOL_NAMES, toolCallToIntent } from './tools.ts';
import { enforceGrounding, toolSummary } from './guard.ts';

export interface AgentAnswer {
  card: AnswerCard;
  /** Prose from the language tier, already grounding-checked. Usually empty. */
  text: string;
  tier: Tier;
  /** Set when the tier tried the Worker and fell back. */
  fellBack: boolean;
}

export interface UseAgent {
  ready: boolean;
  /** Null until the gazetteer lands. */
  index: GazIndex | null;
  ask: (text: string) => Promise<AgentAnswer | null>;
  /** Type-ahead over the gazetteer, ranked by the same scorer as resolution. */
  suggestions: (query: string, limit?: number) => Candidate[];
  /** "Indonesia › Kutei Basin › Badak" — what the agent is looking at. */
  breadcrumb: string;
  reset: () => void;
  tier: Tier;
  workerConfigured: boolean;
  busy: boolean;
  /** What the Worker is actually running, read from its /v1/health. Null until
   *  loaded, unreachable, or the deterministic tier (no LLM at all — Lite means
   *  no model, not a hidden one). Never a picker; there is one model, or none. */
  activeModel: ActiveModel | null;
}

export function useAgent(): UseAgent {
  const [index, setIndex] = useState<GazIndex | null>(null);
  const [busy, setBusy] = useState(false);
  const [breadcrumb, setBreadcrumb] = useState('');
  const [tier, setTier] = useState<Tier>(currentTier());
  const [activeModel, setActiveModel] = useState<ActiveModel | null>(null);
  const turnRef = useRef<Turn>(newTurn());

  useEffect(() => {
    if (!agentEnabled) return;
    let alive = true;
    fetchActiveModel().then((m) => { if (alive) setActiveModel(m); });
    return () => { alive = false; };
  }, []);

  const setScope = useStore((s) => s.setScope);
  const requestView = useStore((s) => s.requestView);
  const requestMap = useStore((s) => s.requestMap);
  const clearScopeLevel = useStore((s) => s.clearScopeLevel);
  const installScopeBrain = useStore((s) => s.installScopeBrain);

  // Load once, then teach the store how petroleum entities nest so scope
  // auto-fills ancestors and surfaces contradictions.
  useEffect(() => {
    let alive = true;
    loadGazetteer()
      .then((loaded) => {
        if (!alive) return;
        setIndex(loaded);
        installScopeBrain(makeScopeBrain(loaded));
      })
      .catch(() => { if (alive) setIndex(null); });
    return () => { alive = false; };
  }, [installScopeBrain]);

  /** Apply a plan to the bus. The ONLY way the agent changes the app. */
  const dispatch = useCallback((commands: AgentCommand[]) => {
    for (const command of commands) {
      if (command.op === 'scope') setScope(command.patch, { autofill: command.autofill, reroot: command.reroot });
      else if (command.op === 'view') requestView(command.view);
      else if (command.op === 'map') requestMap(command.map);
      else if (command.op === 'clear' && command.level) clearScopeLevel(command.level);
    }
  }, [setScope, requestView, requestMap, clearScopeLevel]);

  const ask = useCallback(async (text: string): Promise<AgentAnswer | null> => {
    if (!index || !text.trim()) return null;
    setBusy(true);
    try {
      const scope = useStore.getState().scope;

      // ── language tier · @arganta/agent's pure loop ─────────────────────────
      if (agentEnabled) {
        // The loop calls this for each tool the model picks. It runs through the
        // SAME dialogue.runIntent() the typed path uses, so the model can only
        // ask for things a user could have typed. What goes BACK to the model is
        // a number-free summary — it never sees a figure it could restate wrong.
        let produced: AnswerCard | null = null;
        const executeTool = async (name: string, args: Record<string, unknown>) => {
          if (!TOOL_NAMES.has(name)) return { error: 'no such tool' };
          const result = runIntent(index, turnRef.current, toolCallToIntent(name, args), text, scope);
          turnRef.current = result.turn;
          dispatch(result.commands);
          setBreadcrumb(ladderLabel(result.turn));
          produced = result.card;
          return { ok: true, summary: toolSummary(result.card) };
        };

        const outcome = await runTurn(text, executeTool);
        if (produced) {
          setTier('core');
          // The model's own prose is gated: any number not in the card or in the
          // user's own words means the whole utterance is discarded.
          const guarded = enforceGrounding(outcome.text, produced, text);
          if (guarded.discarded) {
            // eslint-disable-next-line no-console
            console.warn('[agent] discarded ungrounded prose', guarded.violations);
          }
          return { card: produced, text: guarded.text, tier: 'core', fellBack: false };
        }
        // 'no-model' is the adapter honestly reporting it fell back to its mock;
        // any other barren outcome means the model declined to pick a tool. Both
        // drop to the deterministic tier rather than showing the model's words.
      }

      // ── deterministic tier ─────────────────────────────────────────────────
      const result = respond(index, turnRef.current, text, scope);
      turnRef.current = result.turn;
      dispatch(result.commands);
      setBreadcrumb(ladderLabel(result.turn));
      const fellBack = agentEnabled;
      setTier(fellBack ? 'lite' : currentTier());
      return { card: result.card, text: '', tier: 'lite', fellBack };
    } finally {
      setBusy(false);
    }
  }, [index, dispatch]);

  const suggestions = useCallback(
    (query: string, limit = 6) => (index && query.trim() ? suggest(index, query, { limit }) : []),
    [index],
  );

  const reset = useCallback(() => {
    turnRef.current = newTurn();
    setBreadcrumb('');
  }, []);

  return useMemo(() => ({
    ready: !!index,
    index,
    ask,
    suggestions,
    breadcrumb,
    reset,
    tier,
    workerConfigured: agentEnabled,
    busy,
    activeModel,
  }), [index, ask, suggestions, breadcrumb, reset, tier, busy, activeModel]);
}

export { buildIndex };
