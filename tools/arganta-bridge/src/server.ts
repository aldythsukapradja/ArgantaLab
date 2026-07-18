// Arganta Bridge — the concrete "Brain Interface". Drives the Claude Agent SDK
// locally and exposes it to HQ over a token-gated WebSocket. HQ sends a mission;
// the Bridge streams back a normalized activity feed and pauses on gated tools
// for an explicit Approve/Deny.
//
// SECURITY: binds to loopback (127.0.0.1) always, plus BRIDGE_TAILSCALE_IP if
// set — never 0.0.0.0/LAN. Requires BRIDGE_TOKEN on every socket. A process
// that can run Claude Code has full machine access — the Tailscale IP is the
// only sanctioned way to reach it off-box (private mesh, not the public LAN).

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import { missionStart, missionDone, heartbeatUpsert, type ActivityEvent } from './persist.ts';
import { createClaudeEngine } from './engines/claude.ts';
import { createCodexEngine } from './engines/codex.ts';
import type { MissionEngine, OutEvent } from './engines/types.ts';
import { health, launch, opsCors } from './ops.ts';
import { telemetry } from './telemetry.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const PORT = Number(process.env.BRIDGE_PORT || 7717);
const TOKEN = process.env.BRIDGE_TOKEN || '';
const MODEL = process.env.BRIDGE_MODEL || undefined; // undefined = Claude Code default
// Optional: this machine's Tailscale IP (100.x.x.x), so devices on your private
// tailnet (e.g. a phone) can reach the bridge. Never bind 0.0.0.0 — that would
// expose full-machine-control to the whole LAN, not just your tailnet.
const TAILSCALE_IP = process.env.BRIDGE_TAILSCALE_IP || '';

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

// One engine per brain. Claude gets the repo's MCP servers + default model;
// Codex drives the local `codex` CLI. Mission `engine` field selects between
// them, defaulting to 'claude' for older clients.
const ENGINES: Record<string, MissionEngine> = {
  claude: createClaudeEngine(MCP_SERVERS, MODEL),
  codex: createCodexEngine(process.env.CODEX_MODEL || undefined),
};

// Reject bad tokens at the HTTP upgrade (401) so unauthorized clients never
// open a socket — cleaner and verifiable, vs. closing after connect.
// noServer mode: the WebSocketServer itself binds nothing. We attach it to one
// or two plain http.Servers below, each listening on a specific interface —
// always loopback, plus the Tailscale IP if configured. This is how a phone on
// your private tailnet can reach the bridge without exposing it to the LAN.
const wss = new WebSocketServer({ noServer: true });

function checkToken(req: import('node:http').IncomingMessage): boolean {
  const url = new URL(req.url || '/', 'http://localhost');
  return url.searchParams.get('token') === TOKEN;
}

function listenOn(host: string) {
  const server = createServer();
  // Ops endpoints (Command Center): token-gated GET /health + POST /launch.
  // Same http.Server that carries the WS upgrade, so `tailscale serve` fronts
  // all of it under one https origin for the phone.
  server.on('request', (req, res) => {
    opsCors(res);
    const url = new URL(req.url || '/', 'http://localhost');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (!checkToken(req)) { res.writeHead(401, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'unauthorized' })); return; }

    if (req.method === 'GET' && url.pathname === '/health') {
      health().then((h) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(h)); })
        .catch((e) => { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(e?.message || e) })); });
      return;
    }
    if (req.method === 'GET' && url.pathname === '/telemetry') {
      telemetry().then((t) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(t)); })
        .catch((e) => { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: String(e?.message || e) })); });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/launch') {
      let body = '';
      req.on('data', (c) => { body += c; if (body.length > 4096) req.destroy(); });
      req.on('end', () => {
        let service = '';
        try { service = JSON.parse(body || '{}').service || ''; } catch { /* bad json */ }
        launch(service).then((r) => { res.writeHead(r.ok ? 200 : 400, { 'content-type': 'application/json' }); res.end(JSON.stringify(r)); })
          .catch((e) => { res.writeHead(500, { 'content-type': 'application/json' }); res.end(JSON.stringify({ ok: false, message: String(e?.message || e) })); });
      });
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' }); res.end(JSON.stringify({ error: 'not found' }));
  });
  server.on('upgrade', (req, socket, head) => {
    if (!checkToken(req)) {
      socket.write('HTTP/1.1 401 unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });
  server.on('error', (e) => console.error(`Bridge listener on ${host}:${PORT} failed:`, (e as Error).message));
  server.listen(PORT, host, () => console.log(`Arganta Bridge on ws://${host}:${PORT} (repo: ${REPO_ROOT})`));
  return server;
}

listenOn('127.0.0.1');
if (TAILSCALE_IP) listenOn(TAILSCALE_IP);

// Heartbeat: upsert a health snapshot every 60s so the Command Center can show
// "last seen" when this node is unreachable. Fire once on boot, then interval.
async function beat() {
  try {
    const h = await health();
    await heartbeatUpsert({ node: h.node, bridge_version: h.bridgeVersion, node_version: h.nodeVersion, engines: h.engines, services: h.services });
  } catch { /* persistence never throws into the process */ }
}
void beat();
setInterval(beat, 60_000).unref();

wss.on('connection', (ws) => {
  const session = new BridgeSession(ws);
  ws.on('message', (raw) => session.onMessage(raw.toString()));
  ws.on('close', () => session.dispose());
});

class BridgeSession {
  // approvalId -> resolver. The engine's gate() awaits these; HQ's approval
  // message resolves them.
  private pendingApprovals = new Map<string, (r: { approved: boolean; input?: unknown }) => void>();
  private running = false;
  // Per-mission persistence buffer (flushed once on completion).
  private activity: ActivityEvent[] = [];

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
        resolveFn({ approved: !!msg.approved, input: msg.input });
      }
      return;
    }

    // Start a mission.
    if (msg.type === 'mission' && typeof msg.prompt === 'string') {
      if (this.running) { this.send({ type: 'error', message: 'A mission is already running on this socket.', missionId: msg.missionId }); return; }
      this.runMission(msg.prompt, msg.missionId || `m_${Date.now().toString(36)}`, msg.cwd, msg.model, msg.engine);
    }
  }

  private async runMission(prompt: string, missionId: string, cwd?: string, model?: string, engineId?: string) {
    const engine = ENGINES[engineId || 'claude'] || ENGINES.claude;
    this.running = true;
    this.activity = [];
    let ok = true;
    let result: string | undefined;
    let costUsd: number | undefined = 0;
    let failed = false;
    const workdir = cwd || REPO_ROOT;
    void missionStart(missionId, prompt, workdir, engineId || 'claude');

    // The approval gate the engine calls for a gated tool. Sandbox-only engines
    // (Codex v1) never call it.
    const gate = (tool: string, input: Record<string, unknown>, label: string) => {
      const approvalId = `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      this.send({ type: 'awaiting_approval', approvalId, tool, label, input, missionId });
      return new Promise<{ approved: boolean; input?: unknown }>((res) => this.pendingApprovals.set(approvalId, res));
    };

    try {
      const r = await engine.run({
        prompt, missionId, cwd: workdir, model,
        send: (ev) => this.send(ev),
        gate,
      });
      ok = r.ok; result = r.result; costUsd = r.costUsd;
      this.send({ type: 'done', ok, result, costUsd, missionId });
    } catch (e: any) {
      failed = true;
      this.send({ type: 'error', message: e?.message || String(e), missionId });
    } finally {
      this.running = false;
      for (const [, res] of this.pendingApprovals) res({ approved: false });
      this.pendingApprovals.clear();
      const status = failed || !ok ? 'failed' : 'done';
      void missionDone(missionId, status, this.activity, result, costUsd || 0);
    }
  }

  dispose() {
    for (const [, res] of this.pendingApprovals) res({ approved: false });
    this.pendingApprovals.clear();
  }
}
