// Ops surface for the Command Center: a token-gated health report and a
// registry-only service launcher. Kept in its own module so the WS server stays
// small and merge-friendly. Everything here is LOCAL truth — the machine this
// bridge runs on. Cloud truth comes from the separate status Worker.
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ServerResponse } from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));

let VERSION = '0.0.0';
try { VERSION = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8')).version || VERSION; } catch { /* keep default */ }

const NODE_ID = process.env.BRIDGE_NODE_ID || 'laptop';
const COMFY_PORT = Number(process.env.COMFY_PORT || 8188);

export interface ServiceHealth {
  id: string;
  label: string;
  up: boolean;
  detail?: string;
  /** Whether the Command Center can start this service via /launch. */
  launchable: boolean;
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

export async function health(): Promise<HealthReport> {
  const comfyUp = await probeHttp(`http://127.0.0.1:${COMFY_PORT}/system_stats`);
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
      { id: 'comfy', label: 'ComfyUI', up: comfyUp, detail: `port ${COMFY_PORT}`, launchable: true },
    ],
    at: new Date().toISOString(),
  };
}

// --- Launch registry ------------------------------------------------------
// FIXED map only — never a free-form command channel. Each entry is an exact
// executable + a port to guard against double-starts.
interface LaunchSpec { label: string; exe: string; args?: string[]; port: number; }
const REGISTRY: Record<string, LaunchSpec> = {
  comfy: {
    label: 'ComfyUI',
    exe: process.env.COMFY_EXE || 'C:\\Program Files\\Comfy Desktop\\Comfy Desktop.exe',
    port: COMFY_PORT,
  },
};

export function launchableServices(): string[] { return Object.keys(REGISTRY); }

export async function launch(service: string): Promise<{ ok: boolean; message: string }> {
  const spec = REGISTRY[service];
  if (!spec) return { ok: false, message: `Unknown service "${service}". Allowed: ${launchableServices().join(', ')}` };
  if (await probeHttp(`http://127.0.0.1:${spec.port}/`, 800)) {
    return { ok: true, message: `${spec.label} already running on port ${spec.port}.` };
  }
  try {
    const child = spawn(spec.exe, spec.args || [], { detached: true, stdio: 'ignore' });
    child.unref();
    return { ok: true, message: `Started ${spec.label}. Give it a moment to come online.` };
  } catch (e) {
    return { ok: false, message: `Could not start ${spec.label}: ${(e as Error).message}` };
  }
}

/** Permissive CORS for the token-gated ops endpoints. The token (not the
 * origin) is the security boundary, so reflecting any origin is acceptable and
 * lets the deployed HQ page on Vercel read local health. */
export function opsCors(res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
}
