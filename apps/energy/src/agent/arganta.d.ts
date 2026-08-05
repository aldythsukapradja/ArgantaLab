// Ambient types for the shared Arganta runtime packages.
//
// @arganta/ai and @arganta/agent are plain ESM JavaScript with no bundled .d.ts
// (apps/hq consumes them the same way). These declarations describe ONLY the
// surface apps/energy actually uses, so the type-checker stays honest instead of
// pretending to fully type someone else's package.
//
// Resolution: vite.config.ts aliases the bare specifiers to
// ../../packages/{ai,agent}/src/index.js; tsconfig `paths` points them here.

declare module '@arganta/ai' {
  export interface LlmToolCall { id: string; name: string; args: Record<string, unknown> }
  export interface LlmReply {
    text: string;
    toolCalls?: LlmToolCall[];
    /** 'mock' means NO live model answered — the honest-degrade signal every
     *  Arganta surface keys off. Never render mock output as a real answer. */
    provider?: string;
    model?: string;
    costUsd?: number;
  }
  /** The flat shape openaiCompatProvider expects; it does the OpenAI wrapping. */
  export interface LlmTool { name: string; description?: string; parameters?: unknown }
  export interface Llm {
    info(): { available: boolean; providers: string[] };
    chat(o: { task?: string; messages: unknown[]; temperature?: number }): Promise<LlmReply>;
    chatTools(o: { task?: string; messages: unknown[]; tools: LlmTool[]; temperature?: number }): Promise<LlmReply>;
    chatStream(o: { task?: string; messages: unknown[] }, onToken: (t: string) => void): Promise<LlmReply>;
  }
  export function createLLM(config: Record<string, unknown>): Llm;
}

declare module '@arganta/agent' {
  export interface ToolSpec {
    name: string;
    title?: string;
    backing?: string;
    costClass: number;
    dataClass?: string;
    sideEffect?: boolean;
    autonomySafe?: boolean;
    description?: string;
    params?: unknown;
  }
  export const TOOL_SPECS: readonly ToolSpec[];
  export const AUTONOMY: Record<string, number>;
  export const STOP_REASONS: readonly string[];
  export function registerToolSpecs(specs: ToolSpec[]): void;
  export function allToolSpecs(): ToolSpec[];
  export function toolByName(name: string): ToolSpec | null;
  export function availableTools(specs?: ToolSpec[], opts?: { autonomous?: boolean; maxCostClass?: number }): ToolSpec[];
  export function toOpenAITools(specs?: ToolSpec[]): unknown[];
  export function missionBudget(o: Record<string, unknown>): Record<string, unknown>;
  export function runAgentLoop(o: {
    messages: unknown[];
    tools: unknown[];
    callModel: (a: { messages: unknown[]; tools: unknown[] }) => Promise<import('@arganta/ai').LlmReply>;
    executeTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
    maxSteps?: number;
    budget?: Record<string, unknown>;
    autonomyLevel?: number;
    onTrail?: (entry: Record<string, unknown>) => void;
    granted?: boolean;
  }): Promise<{
    text: string;
    trail: Record<string, unknown>[];
    running: Record<string, number>;
    /** 'answered' | 'max-steps' | 'budget' | 'no-model' | 'error' */
    stopReason: string;
  }>;
}
