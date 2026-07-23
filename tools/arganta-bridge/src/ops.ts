// Ops surface for the Command Center: a token-gated health report and a
// registry-only service launcher/stopper. Kept in its own module so the WS
// server stays small and merge-friendly. Everything here is LOCAL truth — the
// machine this bridge runs on. Cloud truth comes from the separate status
// Worker.
import { spawn, execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerResponse } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');

let VERSION = '0.0.0';
try { VERSION = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')).version || VERSION; } catch { /* keep default */ }

const NODE_ID = process.env.BRIDGE_NODE_ID || 'laptop';
const COMFY_PORT = Number(process.env.COMFY_PORT || 8188);
const OLLAMA_PORT = Number(process.env.OLLAMA_PORT || 11434);

export interface ServiceHealth {
  id: string;
  label: string;
  up: boolean;
  detail?: string;
  /** Whether the Command Center can start this service via /launch. */
  launchable: boolean;
  /** True if this bridge process holds the child (so it can /stop it directly). */
  managed?: boolean;
}

export interface HealthReport {
  node: string;
  bridgeVersion: string;
  nodeVersion: string;
  engines: { id: string; label: string; ready: boolean; detail?: string }[];
  services: ServiceHealth[];
  at: string;
}

/** Probe a localhost TCP service over HTTP with a hard timeout. */
async function probeHttp(url: string, timeoutMs = 1500): Promise<boolean> {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    return r.ok || r.status === 401 || r.status === 403; // reachable = up, even if gated
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

/** Is a CLI resolvable on PATH (or an explicit override path present)? */
function binExists(bin: string): boolean {
  const isPath = bin.includes('/') || bin.includes('\\');
  if (isPath) {
    try { readFileSync(bin); return true; } catch { return false; }
  }
  // Cheap PATH scan without spawning: check each PATH dir for bin(.exe/.cmd).
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  const dirs = (process.env.PATH || '').split(process.platform === 'win32' ? ';' : ':');
  for (const d of dirs) {
    for (const e of exts) {
      try { readFileSync(resolve(d, bin + e)); return true; } catch { /* next */ }
    }
  }
  return false;
}

// --- Launch registry ------------------------------------------------------
// FIXED map only — never a free-form command channel. Each entry is an exact
// executable + a port to guard against double-starts. `cwd` scopes npm-based
// entries to their app directory; ids/ports/paths are ours, never user input.
interface LaunchSpec { label: string; exe: string; args?: string[]; cwd?: string; port: number; probePath?: string; }

const NPM_BIN = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const app = (dir: string) => resolve(REPO_ROOT, dir);
const viteArgs = (port: number) => ['run', 'dev', '--', '--port', String(port), '--strictPort'];

const REGISTRY: Record<string, LaunchSpec> = {
  comfy: {
    label: 'ComfyUI',
    exe: process.env.COMFY_EXE || 'C:\\Program Files\\Comfy Desktop\\Comfy Desktop.exe',
    port: COMFY_PORT,
    probePath: '/system_stats',
  },
  ollama: {
    label: 'Local LLM',
    exe: process.env.OLLAMA_EXE || 'ollama',
    args: ['serve'],
    port: OLLAMA_PORT,
  },
  hq: { label: 'ArgantaHQ', exe: NPM_BIN, args: viteArgs(5273), cwd: app('apps/hq'), port: 5273 },
  energy: { label: 'ArgantaEnergy', exe: NPM_BIN, args: viteArgs(5279), cwd: app('apps/energy'), port: 5279 },
  studio: { label: 'ArgantaStudio', exe: NPM_BIN, args: ['run', 'dev'], cwd: app('apps/studio'), port: 3200 },
  kinetik: { label: 'KinetikCircle', exe: NPM_BIN, args: viteArgs(5180), cwd: app('apps/kinetik'), port: 5180 },
  lab: { label: 'ArgantaLab', exe: NPM_BIN, args: viteArgs(5176), cwd: app('apps/web'), port: 5176 },
  lashira: { label: 'LashiraBloom', exe: NPM_BIN, args: viteArgs(5173), cwd: app('apps/lashira/web'), port: 5173 },
  landing: { label: 'ArgantaLife', exe: NPM_BIN, args: viteArgs(5174), cwd: app('apps/landing'), port: 5174 },
};

// Child handles for services this bridge process itself started — lets /stop
// kill the exact tree without a port lookup. Cleared on natural exit.
const RUNNING: Record<string, ReturnType<typeof spawn>> = {};

export function launchableServices(): string[] { return Object.keys(REGISTRY); }

export async function health(): Promise<HealthReport> {
  const ids = Object.keys(REGISTRY);
  const probes = await Promise.all(ids.map(async (id) => {
    const spec = REGISTRY[id];
    const up = await probeHttp(`http://127.0.0.1:${spec.port}${spec.probePath || '/'}`);
    return [id, up] as const;
  }));
  const upById = Object.fromEntries(probes);
  const codexBin = process.env.CODEX_BIN || 'codex';
  const codexReady = binExists(codexBin);

  return {
    node: NODE_ID,
    bridgeVersion: VERSION,
    nodeVersion: process.version,
    engines: [
      // Claude runs through the Agent SDK; "ready" here means the engine is
      // wired. Auth is only provable by running a mission (surfaced in PULSE).
      { id: 'claude', label: 'Claude Code', ready: true },
      { id: 'codex', label: 'Codex', ready: codexReady, detail: codexReady ? undefined : `codex CLI not found (set CODEX_BIN)` },
    ],
    services: [
      { id: 'bridge', label: 'Bridge', up: true, launchable: false },
      ...ids.map((id) => {
        const spec = REGISTRY[id];
        return {
          id, label: spec.label, up: upById[id], detail: `port ${spec.port}`,
          launchable: true, managed: !!RUNNING[id],
        };
      }),
    ],
    at: new Date().toISOString(),
  };
}

export async function launch(service: string): Promise<{ ok: boolean; message: string }> {
  const spec = REGISTRY[service];
  if (!spec) return { ok: false, message: `Unknown service "${service}". Allowed: ${launchableServices().join(', ')}` };
  if (await probeHttp(`http://127.0.0.1:${spec.port}${spec.probePath || '/'}`, 800)) {
    return { ok: true, message: `${spec.label} already running on port ${spec.port}.` };
  }
  try {
    const child = spawn(spec.exe, spec.args || [], { cwd: spec.cwd, detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    RUNNING[service] = child;
    child.on('exit', () => { delete RUNNING[service]; });
    return { ok: true, message: `Started ${spec.label}. Give it a moment to come online.` };
  } catch (e) {
    return { ok: false, message: `Could not start ${spec.label}: ${(e as Error).message}` };
  }
}

/** Windows-only: find PID(s) LISTENING on a port via netstat, taskkill each.
 * Safe here because `port` always comes from our own fixed REGISTRY, never
 * from request input. Lets /stop kill a service even if it was started
 * outside the bridge (e.g. one of the repo's start-*.bat scripts). */
function killPortWindows(port: number): Promise<boolean> {
  return new Promise((res) => {
    execFile('netstat', ['-ano'], (err, stdout) => {
      if (err || !stdout) return res(false);
      const pids = new Set<string>();
      for (const line of stdout.split('\n')) {
        if (!line.includes(`:${port} `) && !line.includes(`:${port}\r`)) continue;
        if (!/LISTENING/i.test(line)) continue;
        const parts = line.trim().split(/\s+/);
        const pid = parts[parts.length - 1];
        if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid);
      }
      if (pids.size === 0) return res(false);
      let remaining = pids.size, anyOk = false;
      for (const pid of pids) {
        execFile('taskkill', ['/PID', pid, '/T', '/F'], (killErr) => {
          if (!killErr) anyOk = true;
          if (--remaining === 0) res(anyOk);
        });
      }
    });
  });
}

export async function stop(service: string): Promise<{ ok: boolean; message: string }> {
  const spec = REGISTRY[service];
  if (!spec) return { ok: false, message: `Unknown service "${service}".` };

  const child = RUNNING[service];
  if (child?.pid) {
    delete RUNNING[service];
    try {
      if (process.platform === 'win32') await new Promise<void>((res) => execFile('taskkill', ['/PID', String(child.pid), '/T', '/F'], () => res()));
      else { try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch { /* already gone */ } } }
      return { ok: true, message: `Stopped ${spec.label}.` };
    } catch (e) {
      return { ok: false, message: `Could not stop ${spec.label}: ${(e as Error).message}` };
    }
  }

  // Not started by this bridge session — best-effort kill by port.
  if (process.platform === 'win32') {
    const killed = await killPortWindows(spec.port);
    return killed
      ? { ok: true, message: `Stopped ${spec.label} (was running outside the bridge).` }
      : { ok: false, message: `${spec.label} isn't running.` };
  }
  return { ok: false, message: `${spec.label} wasn't started by this bridge — close its terminal window.` };
}

/** Permissive CORS for the token-gated ops endpoints. The token (not the
 * origin) is the security boundary, so reflecting any origin is acceptable and
 * lets the deployed HQ page on Vercel read local health. */
export function opsCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}
