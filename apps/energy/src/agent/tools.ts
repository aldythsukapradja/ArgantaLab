// agent/tools.ts — the capability registry, projected into @arganta/agent's
// shared tool registry (W2, HQ-parity).
//
// One capability = one ToolSpec = one LLM tool. The projection is mechanical and
// total: no tool exists that is not a capability, and every capability becomes a
// tool. That is what stops the two tiers drifting — the model cannot be taught a
// trick the deterministic grammar does not also know.
//
// The specs are registered into the SAME frozen registry apps/hq uses, so the
// autonomy gate, the budget accounting and `toolByName` in @arganta/agent's pure
// loop all resolve our tools exactly as they resolve HQ's.
//
// A tool call comes back as an Intent and runs through dialogue.runIntent() —
// the same function the typed path uses. The model therefore has no privileged
// route into the app: it can only ask for things a user could have typed.

import { registerToolSpecs, type ToolSpec } from '@arganta/agent';
import { CAPABILITIES, CAPABILITY_BY_ID } from './capabilities.ts';
import type { Intent } from './grammar.ts';

/** OpenAI function names allow [a-zA-Z0-9_-]{1,64}; capability ids use a dot. */
export const toToolName = (capabilityId: string): string => capabilityId.replace(/\./g, '_');
export const fromToolName = (toolName: string): string => {
  const dotted = toolName.replace(/_/g, '.');
  if (CAPABILITY_BY_ID.has(dotted)) return dotted;
  // camelCase ids ("basin.petroleumSystems") only survive the round trip if we
  // match on the transformed form rather than reversing blindly.
  const match = CAPABILITIES.find((c) => toToolName(c.id) === toolName);
  return match ? match.id : dotted;
};

const READABLE: Record<string, string> = {
  'assessment-unit': 'assessment unit',
  'petroleum-system': 'petroleum system',
  'basin-cycle': 'basin cycle',
};
const readable = (kind: string) => READABLE[kind] ?? kind;

/**
 * Every capability as an @arganta/agent ToolSpec.
 *
 * The parameter is deliberately just the user's own words. The model does NOT
 * resolve entities — the resolver does, with a five-stage ladder, spelling
 * correction and explicit disambiguation. Letting the model "helpfully" tidy
 * "kutai" into some basin it half-remembers is exactly the failure this whole
 * design exists to prevent.
 *
 * Governance metadata, honestly set:
 *   costClass 0    every tool runs locally against JSON already in the browser
 *   dataClass      'public' — the shipped catalogue is USGS/GOGET/regulator open data
 *   sideEffect     false — a tool navigates and renders; it never writes
 *   autonomySafe   true — nothing here can publish, spend or destroy
 */
export function energyToolSpecs(): ToolSpec[] {
  const perCapability: ToolSpec[] = CAPABILITIES.map((capability) => ({
    name: toToolName(capability.id),
    title: capability.label,
    backing: 'engine',
    costClass: 0,
    dataClass: 'public',
    sideEffect: false,
    autonomySafe: true,
    description: [
      `${capability.label}. Applies to: ${capability.kinds.map(readable).join(', ')}.`,
      `Triggered by phrasings like: ${capability.phrases.slice(0, 5).join(', ')}.`,
      "Pass the user's own wording as `query`; do not correct or expand it.",
    ].join(' '),
    params: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The entity exactly as the user named it (e.g. "kutai", "volve", "south sumatra"). Omit to use the entity currently in focus.',
        },
      },
      required: [],
    },
  }));

  // Comparison is not one capability's job — dialogue.runIntent() already
  // handles verb:'compare' + secondEntityQuery (that's the grammar's path for
  // "compare X and Y"). Without a dedicated tool, a tool-calling model has no
  // way to express "two entities, side by side": it can only call one
  // single-query capability, and "volve vs kutei" resolves as one garbled
  // entity name and fails. This tool is the missing bridge to that same path.
  const compareTool: ToolSpec = {
    name: COMPARE_TOOL_NAME,
    title: 'Compare two entities',
    backing: 'engine',
    costClass: 0,
    dataClass: 'public',
    sideEffect: false,
    autonomySafe: true,
    description: [
      'Compare two basins, countries, fields or wells side by side — known fields,',
      'petroleum systems, resources, well-bundle coverage, whatever both sides can',
      "report. Use for phrasings like: compare X and Y, X vs Y, how does X stack up",
      'against Y, X versus Y. Pass each side exactly as the user named it — do not',
      'correct, expand or paraphrase either name.',
    ].join(' '),
    params: {
      type: 'object',
      properties: {
        queryA: { type: 'string', description: 'The first entity, in the user\'s own words. Omit to use the entity currently in focus.' },
        queryB: { type: 'string', description: "The second entity, in the user's own words." },
      },
      required: ['queryB'],
    },
  };

  return [...perCapability, compareTool];
}

/** Not a capability id — `compare` spans two entities, not one entity's data. */
export const COMPARE_TOOL_NAME = 'compare_entities';

/** Register once, at module load, so `toolByName` resolves our tools inside
 *  @arganta/agent's loop (the autonomy gate looks the spec up by name). */
let registered = false;
export function ensureRegistered(): ToolSpec[] {
  const specs = energyToolSpecs();
  if (!registered) { registerToolSpecs(specs); registered = true; }
  return specs;
}

/** The flat `{name, description, parameters}` shape @arganta/ai's
 *  openaiCompat provider expects — it does the OpenAI `{type:'function'}`
 *  wrapping itself. (`toOpenAITools` produces the already-wrapped form, which is
 *  what the edgeProxy path wants; passing that here would send `name: undefined`.) */
export function toProviderTools(specs: ToolSpec[]) {
  return specs.map((spec) => ({ name: spec.name, description: spec.description, parameters: spec.params }));
}

function parseArgs(rawArgs: unknown): Record<string, unknown> {
  try {
    const args = typeof rawArgs === 'string' ? JSON.parse(rawArgs || '{}') : (rawArgs ?? {});
    return typeof args === 'object' && args !== null ? (args as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
const asString = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/** Convert a model tool call into the same Intent the grammar would have made. */
export function toolCallToIntent(toolName: string, rawArgs: unknown): Intent {
  const args = parseArgs(rawArgs);

  if (toolName === COMPARE_TOOL_NAME) {
    const queryA = asString(args.queryA);
    const queryB = asString(args.queryB);
    return {
      verb: 'compare',
      capabilityIds: [],
      entityQuery: queryA,
      secondEntityQuery: queryB || undefined,
      usesFocus: queryA === '',
      confidence: queryB ? 0.9 : 0.3,
      // A tool call has no utterance to re-read: the model already told us the
      // entity outright, so there is no phrase-vs-name ambiguity to resolve.
      fullQuery: queryA,
    };
  }

  const capabilityId = fromToolName(toolName);
  const known = CAPABILITY_BY_ID.get(capabilityId);
  const query = asString(args.query);
  return {
    // A tool call is always an explicit request, so it reads as `show`; the
    // planner still refuses it if the data is not there.
    verb: 'show',
    capabilityIds: known ? [capabilityId] : [],
    entityQuery: query,
    usesFocus: query === '',
    matchedPhrase: known?.phrases[0],
    confidence: known ? 0.95 : 0.3,
    // Same as above: the entity arrived as its own argument, so it was never
    // cut out of a longer utterance and there is nothing to reconsider.
    fullQuery: query,
  };
}

/** Tool names the model is allowed to call. Anything else is rejected before it
 *  can reach the planner. */
export const TOOL_NAMES = new Set([...CAPABILITIES.map((c) => toToolName(c.id)), COMPARE_TOOL_NAME]);
