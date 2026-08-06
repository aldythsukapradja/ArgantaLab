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
import type { AgentCommand, AnswerCard, GazIndexed } from './types.ts';
import { buildIndex, loadGazetteer, type GazIndex } from './gazetteer.ts';
import { makeScopeBrain } from './brain.ts';
import { newTurn, respond, runIntent, ladderLabel, type Turn } from './dialogue.ts';
import { suggest, type Candidate } from './resolve.ts';
import { agentEnabled, fetchActiveModel, runTurn, tier as currentTier, type ActiveModel, type Tier } from './runtime.ts';
import { TOOL_NAMES, toolCallToIntent } from './tools.ts';
import { enforceGrounding, toolSummary } from './guard.ts';
import { buildTrace } from './trace.ts';
import { CAPABILITY_BY_ID } from './capabilities.ts';
import { WORKFLOW_BY_ID, type Workflow } from './workflows.ts';
import { summarise } from './summary.ts';
import type { TurnTrace } from './types.ts';

/** How long the language tier gets before the deterministic grammar takes over.
 *
 *  A try/catch cannot rescue a promise that never settles, and that is exactly
 *  what a stalled Worker fetch is: no error, no response, the turn simply hangs
 *  and the user watches nothing happen forever. Silence is the worst failure
 *  this app can produce -- worse than either tier answering -- so the wait is
 *  bounded and the fallback is a real answer built from the same local files.
 *
 *  20s is deliberately generous: observed healthy turns run 9-16s because the
 *  loop makes several model round-trips. Cutting it finer would abandon turns
 *  that were about to succeed. */
const LANGUAGE_TIER_TIMEOUT_MS = 20_000;

export interface AgentAnswer {
  card: AnswerCard;
  /** Prose from the language tier, already grounding-checked. Usually empty. */
  text: string;
  tier: Tier;
  /** Set when the tier tried the Worker and fell back. */
  fellBack: boolean;
  /** What actually happened, step by step. Never a synthesised monologue. */
  trace: TurnTrace;
  /** The closing line — what the card means, in one or two sentences. Empty when
   *  nothing could be said without inventing a figure. */
  summary: string;
}

/** One step of a workflow, after it ran. `skipped` means the capability's own
 *  probe refused — the card explains why, and the chain carried on. */
export interface WorkflowStepResult {
  capabilityId: string;
  title: string;
  why: string;
  answer: AgentAnswer;
  skipped: boolean;
}

export interface UseAgent {
  ready: boolean;
  /** Null until the gazetteer lands. */
  index: GazIndex | null;
  ask: (text: string) => Promise<AgentAnswer | null>;
  /** The entity the last answer was about, or null. Assisted planning needs the
   *  NODE, not its name — every deviation it proposes is derived from that
   *  node's own probes, and a string cannot be probed. */
  focusNode: () => GazIndexed | null;
  /** Run a whole chain deterministically against one subject. No model is
   *  called at any point — same subject, same steps, same order, every time. */
  runWorkflow: (
    workflowId: string,
    subject: string,
    opts?: {
      onStepStart?: (step: { n: number; of: number; title: string; why: string }) => void;
      onStep?: (r: WorkflowStepResult) => void;
      /** Pause between steps. Purely for legibility — the work itself takes
       *  single-digit milliseconds, and five answers arriving at once is not a
       *  walkthrough, it is a wall. Set 0 to run flat out. */
      paceMs?: number;
    },
  ) => Promise<WorkflowStepResult[]>;
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
    const startedAt = performance.now();
    setBusy(true);
    try {
      const scope = useStore.getState().scope;

      // ── language tier · @arganta/agent's pure loop ─────────────────────────
      //
      // WRAPPED, and that wrap is the contract. The design promise is that ANY
      // language-tier failure falls back to the deterministic grammar. It did
      // not hold: a rejected fetch -- Worker down, CORS refusing an origin it
      // does not know, laptop offline -- threw straight out of `ask`, and the
      // caller had no .catch, so the turn died in silence. The user typed a
      // question and got nothing at all, which is worse than either tier.
      try {
      if (agentEnabled) {
        // The loop calls this for each tool the model picks. It runs through the
        // SAME dialogue.runIntent() the typed path uses, so the model can only
        // ask for things a user could have typed. What goes BACK to the model is
        // a number-free summary — it never sees a figure it could restate wrong.
        let produced: AnswerCard | null = null;
        let producedResult: ReturnType<typeof runIntent> | null = null;
        // Identical calls within one turn are answered from what already ran.
        //
        // Not merely an optimisation. Traces showed the model calling
        // basin_figures three times for one question, and runIntent DISPATCHES
        // COMMANDS -- so the map flew three times and the scope was set three
        // times for a single answer. Replaying a side effect because the model
        // repeated itself is a correctness bug wearing a performance costume.
        const seen = new Map<string, unknown>();
        const executeTool = async (name: string, args: Record<string, unknown>) => {
          if (!TOOL_NAMES.has(name)) return { error: 'no such tool' };
          const key = `${name}:${JSON.stringify(args)}`;
          const already = seen.get(key);
          if (already !== undefined) return already;
          const result = runIntent(index, turnRef.current, toolCallToIntent(name, args), text, scope);
          turnRef.current = result.turn;
          dispatch(result.commands);
          setBreadcrumb(ladderLabel(result.turn));
          produced = result.card;
          producedResult = result;
          const reply = { ok: true, summary: toolSummary(result.card) };
          seen.set(key, reply);
          return reply;
        };

        // Bounded. On timeout this rejects, the catch below logs it, and the
        // turn falls through to the deterministic tier rather than hanging.
        const outcome = await Promise.race([
          runTurn(text, executeTool),
          new Promise<never>((_, reject) => setTimeout(
            () => reject(new Error(`language tier exceeded ${LANGUAGE_TIER_TIMEOUT_MS} ms`)),
            LANGUAGE_TIER_TIMEOUT_MS,
          )),
        ]);
        if (produced && producedResult) {
          const settled = producedResult as ReturnType<typeof runIntent>;
          setTier('core');
          // The model's own prose is gated: any number not in the card or in the
          // user's own words means the whole utterance is discarded.
          const guarded = enforceGrounding(outcome.text, produced, text);
          if (guarded.discarded) {
            // eslint-disable-next-line no-console
            console.warn('[agent] discarded ungrounded prose', guarded.violations);
          }
          const coreTrace = buildTrace({
              facts: settled.facts,
              card: settled.card,
              capabilityId: settled.plan?.capabilityId ?? null,
              commands: settled.commands,
              node: turnRef.current.focus,
            trail: outcome.trail,
            tier: 'core',
            elapsedMs: performance.now() - startedAt,
          });
          return {
            card: produced,
            text: guarded.text,
            tier: 'core',
            fellBack: false,
            trace: coreTrace,
            summary: summarise(settled.card, settled.facts, coreTrace).text,
          };
        }
        // 'no-model' is the adapter honestly reporting it fell back to its mock;
        // any other barren outcome means the model declined to pick a tool. Both
        // drop to the deterministic tier rather than showing the model's words.
      }
      } catch (err) {
        // Falls THROUGH, deliberately -- no rethrow, no early return. The
        // deterministic answer below is a real answer built from the same local
        // files, so a Worker outage costs the user prose they never see anyway.
        // eslint-disable-next-line no-console
        console.warn('[agent] language tier failed, falling back to the grammar', err);
      }

      // ── deterministic tier ─────────────────────────────────────────────────
      const result = respond(index, turnRef.current, text, scope);
      turnRef.current = result.turn;
      dispatch(result.commands);
      setBreadcrumb(ladderLabel(result.turn));
      const fellBack = agentEnabled;
      setTier(fellBack ? 'lite' : currentTier());
      const liteTrace = buildTrace({
          facts: result.facts,
          card: result.card,
          capabilityId: result.plan?.capabilityId ?? null,
          commands: result.commands,
          node: turnRef.current.focus,
        tier: 'lite',
        elapsedMs: performance.now() - startedAt,
        fellBack,
      });
      return {
        card: result.card,
        text: '',
        tier: 'lite',
        fellBack,
        trace: liteTrace,
        summary: summarise(result.card, result.facts, liteTrace).text,
      };
    } finally {
      setBusy(false);
    }
  }, [index, dispatch]);

  /** Deterministic workflow run.
   *
   *  Every step goes through runIntent — the same path a typed question takes —
   *  with the capability named explicitly, so the grammar never has to guess and
   *  the model is never consulted. That is the whole point of the deterministic
   *  mode: it is auditable precisely because nothing in it is a judgement call.
   *
   *  `onStep` fires as each step lands so the UI can render progressively
   *  rather than sitting silent and dumping five answers at the end. */
  const runWorkflow = useCallback(async (
    workflowId: string,
    subject: string,
    opts: {
      onStepStart?: (step: { n: number; of: number; title: string; why: string }) => void;
      onStep?: (r: WorkflowStepResult) => void;
      paceMs?: number;
    } = {},
  ): Promise<WorkflowStepResult[]> => {
    const { onStepStart, onStep, paceMs = 900 } = opts;
    const workflow: Workflow | undefined = WORKFLOW_BY_ID.get(workflowId);
    if (!index || !workflow || !subject.trim()) return [];
    const out: WorkflowStepResult[] = [];
    setBusy(true);
    try {
      for (const [i, step] of workflow.steps.entries()) {
        const capability = CAPABILITY_BY_ID.get(step.capabilityId);
        if (!capability) continue;          // registry drift; resolvedSteps warns up front

        // Announce the step, then pause before answering it. The pause buys
        // nothing computationally and is not pretending to: it exists so the
        // reader can see WHICH step is running before its answer replaces the
        // question. Naming it `paceMs` rather than something suggestive of work
        // keeps that honest at the call site.
        onStepStart?.({ n: i + 1, of: workflow.steps.length, title: step.title, why: step.why });
        if (paceMs > 0) await new Promise((r) => setTimeout(r, paceMs));

        const startedAt = performance.now();
        const scope = useStore.getState().scope;
        const result = runIntent(index, turnRef.current, {
          verb: 'show',
          capabilityIds: [step.capabilityId],
          entityQuery: subject,
          usesFocus: false,
          matchedPhrase: capability.phrases[0],
          confidence: 1,
          fullQuery: subject,
        }, subject, scope);

        turnRef.current = result.turn;
        dispatch(result.commands);
        setBreadcrumb(ladderLabel(result.turn));

        const trace = buildTrace({
          facts: result.facts,
          card: result.card,
          capabilityId: step.capabilityId,
          commands: result.commands,
          node: result.turn.focus,
          tier: 'lite',
          elapsedMs: performance.now() - startedAt,
        });
        const entry: WorkflowStepResult = {
          capabilityId: step.capabilityId,
          title: step.title,
          why: step.why,
          // An absence is a real result, not a failure: the capability probed
          // its own data and reported honestly. The chain continues.
          skipped: result.card.kind === 'absence' || result.card.kind === 'error',
          answer: {
            card: result.card,
            text: '',
            tier: 'lite',
            fellBack: false,
            trace,
            summary: summarise(result.card, result.facts, trace).text,
          },
        };
        out.push(entry);
        onStep?.(entry);
        // Yield so React paints this step before the next begins.
        await new Promise((r) => setTimeout(r, 0));
      }
      return out;
    } finally {
      setBusy(false);
    }
  }, [index, dispatch]);

  const focusNode = useCallback(() => turnRef.current.focus, []);

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
    focusNode,
    runWorkflow,
    suggestions,
    breadcrumb,
    reset,
    tier,
    workerConfigured: agentEnabled,
    busy,
    activeModel,
  }), [index, ask, focusNode, runWorkflow, suggestions, breadcrumb, reset, tier, busy, activeModel]);
}

export { buildIndex };
