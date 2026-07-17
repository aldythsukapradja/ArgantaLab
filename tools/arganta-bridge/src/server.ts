// Arganta Bridge — the concrete "Brain Interface". Drives the Claude Agent SDK
// locally and exposes it to HQ over a token-gated 127.0.0.1 WebSocket. HQ sends
// a mission; the Bridge streams back a normalized activity feed and pauses on
// gated tools for an explicit Approve/Deny.
//
// SECURITY: binds to loopback only and requires BRIDGE_TOKEN on every socket.
// A process that can run Claude Code has full machine access — never expose this
// port without the tunnel + auth added in B5.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, type WebSocket } from 'ws';
import { query, type SDKMessage, type SDKUserMessage, type PermissionResult } from '@anthropic-ai/claude-agent-sdk';
import { classify, toolLabel } from './permissions.ts';
import { missionStart, missionDone, persistEnabled, type ActivityEvent } from './persist.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const PORT = Number(process.env.BRIDGE_PORT || 7717);
const TOKEN = process.env.BRIDGE_TOKEN || '';
const MODEL = process.env.BRIDGE_MODEL || undefined; // undefined = Claude Code default

if (!TOKEN) {
  console.error('FATAL: set BRIDGE_TOKEN in tools/arganta-bridge/.env (HQ must send the same token).');
  process.exit(1);
}

/** Load the repo's .mcp.json and absolutize stdio server paths (they use
 * repo-relative args that would break when a mission runs in another cwd). */
function loadMcpServers(): Record<string, any> {
  try {
    const cfg = JSON.parse(readFileSync(resolve(REPO_ROOT, '.mcp.json'), 'utf8'));
    const servers = cfg.mcpServers || {};
    for (const s of Object.values<any>(servers)) {
      if (Array.isArray(s.args)) {
        s.args = s.args.map((a: string) =>
          a.endsWith('.ts') || a.includes('/') || a.includes('\\') ? resolve(REPO_ROOT, a) : a);
      }
    }
    return servers;
  } catch (e) {
    console.warn('WARN: could not load .mcp.json — missions run without MCP tools:', (e as Error).message);
    return {};
  }
}
const MCP_SERVERS = loadMcpServers();

type OutEvent =
  | { type: 'status'; label: string; missionId: string }
  | { type: 'tool'; label: string; tool: string; missionId: string }
  | { type: 'message'; text: string; missionId: string }
  | { type: 'awaiting_approval'; approvalId: string; tool: string; label: string; input: unknown; missionId: string }
  | { type: 'artifact'; label: string; uri?: string; missionId: string }
  | { type: 'done'; ok: boolean; result?: string; costUsd?: number; missionId: string }
  | { type: 'error'; message: string; missionId: string };

// Reject bad tokens at the HTTP upgrade (401) so unauthorized clients never
// open a socket — cleaner and verifiable, vs. closing after connect.
const wss = new WebSocketServer({
  host: '127.0.0.1',
  port: PORT,
  verifyClient: (info, cb) => {
    const url = new URL(info.req.url || '/', 'http://127.0.0.1');
    url.searchParams.get('token') === TOKEN ? cb(true) : cb(false, 401, 'unauthorized');
  },
});
console.log(`Arganta Bridge on ws://127.0.0.1:${PORT} (repo: ${REPO_ROOT})`);

wss.on('connection', (ws) => {
  const session = new BridgeSession(ws);
  ws.on('message', (raw) => session.onMessage(raw.toString()));
  ws.on('close', () => session.dispose());
});

class BridgeSession {
  private pendingApprovals = new Map<string, (r: PermissionResult) => void>();
  private running = false;
  // Per-mission persistence buffer (flushed once on completion).
  private activity: ActivityEvent[] = [];
  private finalResult?: string;
  private finalCost = 0;
  private missionOk = true;

  constructor(private ws: WebSocket) {}

  send(ev: OutEvent) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(JSON.stringify(ev));
    // Buffer meaningful events for the mission record (skip nothing high-freq
    // enough to matter — missions are low-frequency).
    if (ev.type === 'status' || ev.type === 'tool' || ev.type === 'message' || ev.type === 'awaiting_approval') {
      this.activity.push({
        type: ev.type,
        label: (ev as any).label,
        text: (ev as any).text,
        at: new Date().toISOString(),
      });
    }
  }

  onMessage(raw: string) {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }

    // Approve/Deny for a gated tool.
    if (msg.type === 'approval' && typeof msg.approvalId === 'string') {
      const resolveFn = this.pendingApprovals.get(msg.approvalId);
      if (resolveFn) {
        this.pendingApprovals.delete(msg.approvalId);
        resolveFn(msg.approved
          ? { behavior: 'allow', updatedInput: msg.input }
          : { behavior: 'deny', message: 'Denied by operator in HQ.' });
      }
      return;
    }

    // Start a mission.
    if (msg.type === 'mission' && typeof msg.prompt === 'string') {
      if (this.running) { this.send({ type: 'error', message: 'A mission is already running on this socket.', missionId: msg.missionId }); return; }
      this.runMission(msg.prompt, msg.missionId || `m_${Date.now().toString(36)}`, msg.cwd, msg.model);
    }
  }

  private async runMission(prompt: string, missionId: string, cwd?: string, model?: string) {
    this.running = true;
    this.activity = [];
    this.finalResult = undefined;
    this.finalCost = 0;
    let failed = false;
    const workdir = cwd || REPO_ROOT;
    void missionStart(missionId, prompt, workdir);
    this.send({ type: 'status', label: 'Planning mission', missionId });

    // Streaming input mode (async iterable) so canUseTool is honored.
    async function* input(): AsyncIterable<SDKUserMessage> {
      yield {
        type: 'user',
        session_id: missionId,
        parent_tool_use_id: null,
        message: { role: 'user', content: prompt },
      } as SDKUserMessage;
    }

    const canUseTool = async (tool: string, toolInput: Record<string, unknown>): Promise<PermissionResult> => {
      if (classify(tool, toolInput) === 'auto') {
        this.send({ type: 'tool', tool, label: toolLabel(tool, toolInput), missionId });
        return { behavior: 'allow', updatedInput: toolInput };
      }
      const approvalId = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      this.send({ type: 'awaiting_approval', approvalId, tool, label: toolLabel(tool, toolInput), input: toolInput, missionId });
      return new Promise<PermissionResult>((res) => this.pendingApprovals.set(approvalId, res));
    };

    try {
      const q = query({
        prompt: input(),
        options: {
          cwd: cwd || REPO_ROOT,
          model: model || MODEL,
          mcpServers: MCP_SERVERS,
          canUseTool,
          permissionMode: 'default',
        },
      });

      for await (const m of q as AsyncIterable<SDKMessage>) {
        this.normalize(m, missionId);
      }
    } catch (e: any) {
      failed = true;
      this.send({ type: 'error', message: e?.message || String(e), missionId });
    } finally {
      this.running = false;
      for (const [, res] of this.pendingApprovals) res({ behavior: 'deny', message: 'Mission ended.' });
      this.pendingApprovals.clear();
      const status = failed || !this.missionOk ? 'failed' : 'done';
      void missionDone(missionId, status, this.activity, this.finalResult, this.finalCost);
    }
  }

  /** SDKMessage -> operational activity feed (no internal reasoning). */
  private normalize(m: SDKMessage, missionId: string) {
    switch (m.type) {
      case 'system':
        if ((m as any).subtype === 'init') this.send({ type: 'status', label: 'Reading repository', missionId });
        return;
      case 'assistant': {
        for (const block of (m as any).message?.content || []) {
          if (block.type === 'text' && block.text?.trim()) {
            this.send({ type: 'message', text: block.text, missionId });
          }
          // tool_use blocks are surfaced via canUseTool, not here (avoids dupes).
        }
        return;
      }
      case 'result': {
        const ok = (m as any).subtype === 'success';
        this.finalResult = (m as any).result;
        this.finalCost = (m as any).total_cost_usd || 0;
        this.missionOk = ok;
        this.send({ type: 'done', ok, result: this.finalResult, costUsd: this.finalCost, missionId });
        return;
      }
      default:
        return; // partial/status/hook frames: ignored for the feed
    }
  }

  dispose() {
    for (const [, res] of this.pendingApprovals) res({ behavior: 'deny', message: 'Socket closed.' });
    this.pendingApprovals.clear();
  }
}
