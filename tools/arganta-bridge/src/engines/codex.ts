// Codex engine — drives OpenAI's Codex CLI (`codex exec`) as a child process and
// maps its JSONL event stream onto the Bridge's normalized feed. No npm SDK
// dependency: the local `codex` binary (npm i -g @openai/codex + `codex login`)
// is the auth + runtime, same spirit as Claude Code being a local CLI.
//
// APPROVALS (v1): Codex runs in its own `workspace-write` sandbox with approvals
// non-interactive — it blocks disallowed actions itself rather than round-
// tripping an Approve/Deny to HQ. So ctx.gate is intentionally never called
// here; gated-tool parity with the Claude engine is a documented v2. This is an
// honest scope cut, not a silent one.
//
// COST: Codex reports token usage, not USD. We deliberately return costUsd
// undefined so the UI shows the model only — never a fabricated dollar figure.
import { spawn } from 'node:child_process';
import type { MissionEngine, EngineContext, MissionResult } from './types.ts';

const CODEX_BIN = process.env.CODEX_BIN || 'codex';

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

export function createCodexEngine(defaultModel?: string): MissionEngine {
  return {
    name: 'Codex',
    run(ctx: EngineContext): Promise<MissionResult> {
      return new Promise<MissionResult>((resolveRun, rejectRun) => {
        ctx.send({ type: 'status', label: 'Planning mission', missionId: ctx.missionId });

        const args = ['exec', '--json'];
        const model = ctx.model || defaultModel;
        if (model) args.push('--model', model);
        args.push('--sandbox', 'workspace-write');
        args.push(ctx.prompt);

        let child: ReturnType<typeof spawn>;
        try {
          child = spawn(CODEX_BIN, args, { cwd: ctx.cwd, env: process.env });
        } catch (e) {
          return rejectRun(e);
        }

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
          const type = String(o?.type ?? item?.type ?? '').toLowerCase();

          if (!announcedRepo && /(thread|session|task)[._](started|created)/.test(type)) {
            announcedRepo = true;
            send({ type: 'status', label: 'Reading repository', missionId: mid });
            return;
          }
          if (type.includes('reasoning')) return; // strip chain-of-thought

          // Assistant text — emit final messages, skip streaming deltas.
          const isAgentMsg = type.includes('agent_message') || item?.type === 'agent_message' || (item?.role === 'assistant' && (item?.text || item?.message));
          if (isAgentMsg && !type.includes('delta')) {
            const text = String(item?.text ?? item?.message ?? o?.text ?? '').trim();
            if (text && text !== lastAgentMessage) {
              lastAgentMessage = text;
              send({ type: 'message', text, missionId: mid });
            }
            return;
          }

          // Command execution.
          const cmd = item?.command ?? o?.command;
          if (type.includes('command') || cmd) {
            const c = String(Array.isArray(cmd) ? cmd.join(' ') : (cmd ?? '')).trim();
            if (c && c !== lastCommand) {
              lastCommand = c;
              send({ type: 'tool', tool: 'shell', label: `Running: ${c.slice(0, 80)}`, missionId: mid });
            }
            return;
          }

          // File edits / patches.
          if (/(file_change|patch|apply_patch|edit)/.test(type)) {
            send({ type: 'tool', tool: 'edit', label: 'Editing files', missionId: mid });
            return;
          }

          // Errors.
          if (type.includes('error') || o?.error) {
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
          const ok = code === 0 && !errorMsg;
          if (!ok && !lastAgentMessage) {
            const detail = errorMsg || stripAnsi(stderrBuf).trim() || `Codex exited with code ${code}`;
            // Surface as a failed mission with the detail as the result body.
            return resolveRun({ ok: false, result: detail, costUsd: undefined });
          }
          resolveRun({ ok, result: lastAgentMessage, costUsd: undefined });
        });
      });
    },
  };
}
