// Token-gated static file serving for generated media/HTML, so the HQ chat can
// PREVIEW a mission's local output (a jpg, a single-file .html) that has no URL.
//
// SECURITY IS THE WHOLE POINT HERE. This endpoint turns "the bridge can run
// Claude/Codex" into "the bridge can also hand back file bytes", so it must NEVER
// serve anything outside a tiny allowlist of generated-output directories:
//   - resolve() collapses `..` before the allowlist check (no traversal)
//   - realpathSync re-checks after following symlinks (no symlink escape)
//   - only known media/html extensions are served (never .env/.ts/.key/…)
//   - a size cap avoids streaming something huge
// The HTTP layer already 401s without the bridge token before we get here.
import { createReadStream, statSync, realpathSync } from 'node:fs';
import { resolve, sep, extname } from 'node:path';
import { homedir } from 'node:os';
import type { ServerResponse } from 'node:http';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif',
  '.webp': 'image/webp', '.avif': 'image/avif', '.svg': 'image/svg+xml',
  '.html': 'text/html', '.htm': 'text/html', '.txt': 'text/plain', '.json': 'application/json',
  '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.wav': 'audio/wav',
};
const MAX_BYTES = 40 * 1024 * 1024;

/** The ONLY directories the bridge will serve from. Deliberately narrow —
 * generated output only, never source, home, or config. */
export function allowedRoots(repoRoot: string): string[] {
  const roots = [
    resolve(repoRoot, 'generated-media'),
    resolve(homedir(), '.codex', 'generated_images'),
  ];
  // Compare against real paths so a symlinked root still matches correctly.
  return roots.map((r) => { try { return realpathSync(r); } catch { return r; } });
}

const norm = (p: string) => (process.platform === 'win32' ? p.toLowerCase() : p);
function insideAllowed(realPath: string, roots: string[]): boolean {
  const r = norm(realPath);
  return roots.some((root) => { const nr = norm(root); return r === nr || r.startsWith(nr + sep); });
}

/** Serve `requested` if — and only if — it resolves to a real file of an allowed
 * type inside an allowed root. Every other case is an explicit non-2xx. */
export function serveFile(res: ServerResponse, repoRoot: string, requested: string | null): void {
  const fail = (code: number, msg: string) => { res.writeHead(code, { 'content-type': 'text/plain' }); res.end(msg); };
  if (!requested) return fail(400, 'missing path');

  const ext = extname(requested).toLowerCase();
  const mime = MIME[ext];
  if (!mime) return fail(415, 'unsupported type');           // reject .env/.ts/.key/… up front

  let resolved: string;
  try { resolved = resolve(requested); } catch { return fail(400, 'bad path'); }

  const roots = allowedRoots(repoRoot);
  // First guard: the resolved (../-collapsed) path must be inside an allowed root.
  if (!insideAllowed(resolved, roots)) return fail(403, 'forbidden');

  let real: string; let st: ReturnType<typeof statSync>;
  try { real = realpathSync(resolved); st = statSync(real); } catch { return fail(404, 'not found'); }
  // Second guard: after following symlinks, STILL inside an allowed root.
  if (!insideAllowed(real, roots)) return fail(403, 'forbidden');
  if (!st.isFile()) return fail(404, 'not a file');
  if (st.size > MAX_BYTES) return fail(413, 'too large');

  res.writeHead(200, {
    'content-type': mime,
    'content-length': String(st.size),
    'cache-control': 'private, max-age=300',
    'x-content-type-options': 'nosniff',
  });
  createReadStream(real).pipe(res);
}
