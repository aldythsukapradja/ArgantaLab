// Engine abstraction — the Bridge drives more than one local coding agent
// (Claude Agent SDK, Codex CLI). Each engine turns a mission prompt into the
// same normalized activity feed; the WebSocket session owns transport, the
// approval gate, and persistence. Engines never touch the socket directly —
// they only call ctx.send / ctx.gate.

export type OutEvent =
  | { type: 'status'; label: string; missionId: string }
  | { type: 'tool'; label: string; tool: string; missionId: string }
  | { type: 'message'; text: string; missionId: string }
  | { type: 'awaiting_approval'; approvalId: string; tool: string; label: string; input: unknown; missionId: string }
  | { type: 'artifact'; label: string; uri?: string; missionId: string }
  | { type: 'done'; ok: boolean; result?: string; costUsd?: number; missionId: string }
  | { type: 'error'; message: string; missionId: string };

export interface EngineContext {
  prompt: string;
  missionId: string;
  cwd: string;
  model?: string;
  /** Push a feed event to HQ (status/tool/message/awaiting_approval/artifact).
   * done + error are sent by the session, not the engine. */
  send: (ev: OutEvent) => void;
  /** Ask the operator to approve a gated tool. Resolves when they Approve/Deny
   * in HQ (or the mission ends). `input` carries any operator edits. Engines
   * that run fully sandboxed (no interactive approval) simply never call this. */
  gate: (tool: string, input: Record<string, unknown>, label: string) => Promise<{ approved: boolean; input?: unknown }>;
}

export interface MissionResult {
  ok: boolean;
  result?: string;
  /** USD cost when the engine reports it (Claude does). Undefined when the
   * engine only reports tokens (Codex) — never fabricate a dollar figure. */
  costUsd?: number;
}

export interface MissionEngine {
  /** Human name for logs/errors. */
  readonly name: string;
  run(ctx: EngineContext): Promise<MissionResult>;
}
