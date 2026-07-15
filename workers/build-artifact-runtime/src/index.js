// B5 · build.arganta.app — the Cloudflare Worker serving published
// single-file artifacts to the open internet (docs/adr/0006-*, Decisions
// 1/3/4). Deliberately thin: parse the route, call the ONE public RPC
// (publication_by_slug), re-validate server-side, serve with a CSP that
// mirrors the exact generation-time allowlist. Never touches any other
// table — hq_artifact/artifact_version stay operator-only.
import { parseRoute, SECURITY_HEADERS } from './router.js';
import { validateHtml } from '../../../packages/builder/src/validate.js';

const HTML_HEADERS = { ...SECURITY_HEADERS, 'Content-Type': 'text/html; charset=utf-8' };

function unavailablePage(status, reason) {
  const body = `<!doctype html><html><head><meta charset="utf8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unavailable</title></head>` +
    `<body style="margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,sans-serif;background:#12101f;color:#f4f2ff">` +
    `<p style="opacity:.75">This artifact is unavailable.</p></body></html>`;
  console.warn('[build-artifact-runtime] unavailable:', status, reason);
  return new Response(body, { status, headers: HTML_HEADERS });
}

async function fetchPublication(env, slug) {
  const resp = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/publication_by_slug`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_ANON_KEY,
      Authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({ p_slug: slug }),
  });
  if (!resp.ok) return { error: `rpc status ${resp.status}` };
  const rows = await resp.json();
  const row = Array.isArray(rows) ? rows[0] : null;
  if (!row) return { error: 'not found or not live' };
  return { row };
}

export default {
  async fetch(request, env) {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return unavailablePage(405, 'method not allowed');
    }

    const url = new URL(request.url);
    const route = parseRoute(url.pathname);
    if (!route) return unavailablePage(404, `no route for ${url.pathname}`);

    const { row, error } = await fetchPublication(env, route.slug);
    if (error) return unavailablePage(404, error);
    if (row.kind !== route.kind) return unavailablePage(404, `kind mismatch: path=${route.kind} publication=${row.kind}`);

    // Defence in depth (ADR-0006 Decision 4): publish already required a
    // pass; this catches DB tampering or a validate.js rule tightening
    // after publication. Never serve HTML that doesn't pass RIGHT NOW.
    const check = validateHtml(row.html, { kind: row.kind });
    if (!check.ok) return unavailablePage(503, `re-validation failed: ${check.errors.map((e) => e.id).join(',')}`);

    return new Response(row.html, { status: 200, headers: HTML_HEADERS });
  },
};
