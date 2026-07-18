// Codex engine — drives OpenAI's Codex CLI (`codex exec`) as a child process and
// maps its JSONL event stream onto the Bridge's normalized feed. No npm SDK
// dependency: the local `codex` binary (npm i -g @openai/codex + `codex login`)
// is the auth + runtime, same spirit as Claude Code being a local CLI.
//
// AUTONOMY: Codex runs FULL-AUTO (approvals + OS sandbox bypassed), matching the
// access the Claude engine already has on this machine. This is required for the
// media MCP tools (generate_image, …) to run — `codex exec` cancels every MCP
// tool call in its sandboxed/approval mode with no interactive approver. The
// bridge is loopback/tailnet + token gated and runs the founder's own missions,
// so Codex gets the same trust as Claude. ctx.gate is intentionally never called
// (no interactive gate in v1); that parity is a documented follow-up.
//
// COST: Codex reports token usage, not USD. We deliberately return costUsd
// undefined so the UI shows the model only — never a fabricated dollar figure.
import { spawn, spawnSync } from 'node:child_process';
import { resolve } from 'node:path';
import type { MissionEngine, EngineContext, MissionResult } from './types.ts';

const CODEX_BIN = process.env.CODEX_BIN || 'codex';
const WIN = process.platform === 'win32';

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

// Windows needs a shell to resolve the `codex.cmd`/`.ps1` shim. Passing an args
// ARRAY with shell:true trips DEP0190 (args concatenated, not escaped); the
// sanctioned form is a single command STRING. All our tokens are fixed flags
// with no user content (the prompt goes via stdin), so string-joining is
// injection-safe — we only quote a token if it contains whitespace.
function shq(a: string): string { return WIN && /\s/.test(a) ? `"${a}"` : a; }
function codexCmdline(args: string[]): string { return [CODEX_BIN, ...args].map(shq).join(' '); }

/** Ensure the repo's media-gen MCP is registered with Codex so the OpenAI brain
 * can generate images. Idempotent + self-healing: registers it if missing, and
 * re-points it if the repo moved (the stored args no longer match this path).
 * Never throws — if Codex isn't installed the OpenAI brain just can't do media,
 * which the mission would surface anyway. Runs once at bridge startup. */
export function ensureCodexMediaMcp(repoRoot: string): void {
  // Forward slashes: Codex accepts them on Windows and they avoid TOML/shell
  // backslash-escaping headaches.
  const serverPath = resolve(repoRoot, 'tools/media-gen-mcp/src/server.ts').replace(/\\/g, '/');
  const run = (args: string[]) => WIN
    ? spawnSync(codexCmdline(args), { shell: true, encoding: 'utf8', timeout: 20000 })
    : spawnSync(CODEX_BIN, args, { encoding: 'utf8', timeout: 20000 });
  try {
    const got = run(['mcp', 'get', 'media-gen']);
    if (got.error) { // ENOENT — codex not on PATH
      console.warn('Codex CLI not found — OpenAI brain media tools stay off until `npm i -g @openai/codex`.');
      return;
    }
    // Registered AND pointing at this repo's server → nothing to do.
    if (got.status === 0 && (got.stdout || '').includes(serverPath)) return;
    run(['mcp', 'remove', 'media-gen']); // ignore result (may not exist)
    const add = run(['mcp', 'add', 'media-gen', '--', 'npx', 'tsx', serverPath]);
    if (add.status === 0) console.log(`Codex: registered media-gen MCP → ${serverPath}`);
    else console.warn('Codex: could not register media-gen MCP:', ((add.stderr || add.stdout || '') as string).trim().slice(0, 200));
  } catch (e) {
    console.warn('Codex media MCP ensure skipped:', (e as Error).message);
  }
}

export function createCodexEngine(defaultModel?: string): MissionEngine {
  return {
    name: 'Codex',
    run(ctx: EngineContext): Promise<MissionResult> {
      return new Promise<MissionResult>((resolveRun, rejectRun) => {
        ctx.send({ type: 'status', label: 'Planning mission', missionId: ctx.missionId });

        const args = ['exec', '--json'];
        // `ctx.model` carries the picker choice. On a ChatGPT-account login the
        // model can't be overridden (only the API-key path allows real model
        // ids), but reasoning EFFORT can — so the picker sends low|medium|high
        // and we pass it as a config override. A non-effort value is treated as
        // a real model id (API-key users / CODEX_MODEL env).
        const sel = ctx.model || defaultModel;
        if (sel) {
          if (['minimal', 'low', 'medium', 'high'].includes(sel)) args.push('-c', `model_reasoning_effort=${sel}`);
          else args.push('--model', sel);
        }
        // Full-auto: skip approvals + sandbox so MCP tool calls (media-gen, etc.)
        // actually run headlessly. Same trust level as the Claude engine.
        args.push('--dangerously-bypass-approvals-and-sandbox');
        // Prompt goes via STDIN, never argv — codex reads it, and keeping user
        // content out of the command line means the fixed flags above are all
        // that hit the (Windows) shell, so there's no command-injection risk.
        let child: ReturnType<typeof spawn>;
        try {
          child = WIN
            ? spawn(codexCmdline(args), { cwd: ctx.cwd, env: process.env, shell: true, stdio: ['pipe', 'pipe', 'pipe'] })
            : spawn(CODEX_BIN, args, { cwd: ctx.cwd, env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
        } catch (e) {
          return rejectRun(e);
        }
        // Feed the prompt, then close stdin so codex stops waiting for input.
        try { child.stdin?.end(ctx.prompt); } catch { /* stdin may already be gone */ }

        let stdoutBuf = '';
        let stderrBuf = '';
        let rawFallback = '';          // full stdout, for the no-JSON degrade path
        let sawStructured = false;
        let announcedRepo = false;
        let lastAgentMessage: string | undefined;
        let lastCommand = '';
        let errorMsg: string | undefined;

        const send = ctx.send;
        const mid = ctx.missionId;

        const handleEvent = (o: any) => {
          sawStructured = true;
          const item = o?.item ?? o ?? {};
          const type = String(o?.type ?? '').toLowerCase();       // outer event
          const itemType = String(item?.type ?? '').toLowerCase(); // inner item (item.completed wraps these)

          if (!announcedRepo && /(thread|session|task)[._](started|created)/.test(type)) {
            announcedRepo = true;
            send({ type: 'status', label: 'Reading repository', missionId: mid });
            return;
          }
          if (itemType.includes('reasoning')) return; // strip chain-of-thought

          // Assistant text — emit final messages, skip streaming deltas.
          const isAgentMsg = itemType === 'agent_message' || (item?.role === 'assistant' && (item?.text || item?.message));
          if (isAgentMsg && !type.includes('delta') && !itemType.includes('delta')) {
            const text = String(item?.text ?? item?.message ?? o?.text ?? '').trim();
            if (text && text !== lastAgentMessage) {
              lastAgentMessage = text;
              send({ type: 'message', text, missionId: mid });
            }
            return;
          }

          // Command execution.
          const cmd = item?.command ?? o?.command;
          if (itemType.includes('command') || cmd) {
            const c = String(Array.isArray(cmd) ? cmd.join(' ') : (cmd ?? '')).trim();
            if (c && c !== lastCommand) {
              lastCommand = c;
              send({ type: 'tool', tool: 'shell', label: `Running: ${c.slice(0, 80)}`, missionId: mid });
            }
            return;
          }

          // File edits / patches.
          if (/(file_change|patch|apply_patch|edit)/.test(itemType)) {
            send({ type: 'tool', tool: 'edit', label: 'Editing files', missionId: mid });
            return;
          }

          // Errors (top-level {type:error}, turn.failed {error}, or an error item).
          if (type.includes('error') || itemType.includes('error') || o?.error) {
            errorMsg = String(o?.error?.message ?? o?.message ?? item?.message ?? 'Codex reported an error');
          }
        };

        const drainLines = () => {
          let nl: number;
          while ((nl = stdoutBuf.indexOf('\n')) >= 0) {
            const line = stdoutBuf.slice(0, nl).trim();
            stdoutBuf = stdoutBuf.slice(nl + 1);
            if (!line) continue;
            try { handleEvent(JSON.parse(line)); }
            catch { /* not a JSON line (banner/log) — ignore, kept in rawFallback */ }
          }
        };

        child.stdout?.on('data', (d: Buffer) => {
          const s = d.toString();
          rawFallback += s;
          stdoutBuf += s;
          drainLines();
        });
        child.stderr?.on('data', (d: Buffer) => { stderrBuf += d.toString(); });

        child.on('error', (err: NodeJS.ErrnoException) => {
          if (err.code === 'ENOENT') {
            rejectRun(new Error('Codex CLI not found. Install it (`npm i -g @openai/codex`) and sign in (`codex login`) on this machine.'));
          } else {
            rejectRun(err);
          }
        });

        child.on('close', (code) => {
          drainLines();
          // Degrade path: --json unsupported / no structured events — surface the
          // raw transcript as one message so the mission still returns something.
          if (!sawStructured) {
            const raw = stripAnsi(rawFallback).trim();
            if (raw) { lastAgentMessage = raw; send({ type: 'message', text: raw, missionId: mid }); }
          }
          // Exit code is the source of truth for pass/fail — an item-level error
          // (e.g. a "model metadata not found" warning) must not fail a mission
          // that codex itself completed with code 0.
          const ok = code === 0;
          if (!ok) {
            const stderr = stripAnsi(stderrBuf).trim();
            // With shell:true (Windows) a missing binary is a non-zero exit +
            // "not recognized", not an ENOENT event — give the same friendly hint.
            const notFound = /not recognized|not found|no such file|command not found/i.test(stderr) && !sawStructured;
            const detail = notFound
              ? 'Codex CLI not found. Install it (`npm i -g @openai/codex`) and sign in (`codex login`) on this machine.'
              : (errorMsg || stderr || lastAgentMessage || `Codex exited with code ${code}`);
            return resolveRun({ ok: false, result: detail, costUsd: undefined });
          }
          resolveRun({ ok: true, result: lastAgentMessage, costUsd: undefined });
        });
      });
    },
  };
}
