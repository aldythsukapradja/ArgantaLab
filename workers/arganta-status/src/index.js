// Arganta Status Worker — GET /status returns live cloud reachability for the
// HQ Command Center. No secrets required for the baseline (plain reachability +
// latency); optional VERCEL_TOKEN upgrades the Vercel tile to real deploy state.
// Every target reports independently, so one failure never reds out the rest.

const TIMEOUT_MS = 4000;

function isLocalhostOrigin(origin) {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
}

function corsHeaders(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = isLocalhostOrigin(origin) || allowed.includes(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin : (allowed[0] || '*'),
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    Vary: 'Origin',
  };
}

/** Fetch with a hard timeout; returns {up, ms, status}. Reachable (even a 4xx
 * from an auth-gated root) counts as "up" — we're probing liveness, not authz. */
async function probe(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  const t0 = Date.now();
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal, redirect: 'manual' });
    return { up: r.status > 0, ms: Date.now() - t0, status: r.status };
  } catch {
    return { up: false, ms: Date.now() - t0, status: 0 };
  } finally {
    clearTimeout(t);
  }
}

async function buildStatus(env) {
  const targets = [];

  // Cloudflare — if we're executing, the edge is up.
  targets.push({ id: 'cloudflare', label: 'Cloudflare', up: true, ms: 0, detail: 'edge worker' });

  // Vercel HQ — real deploy state if a token is present, else site reachability.
  if (env.VERCEL_TOKEN && env.VERCEL_PROJECT) {
    const p = await probe(`https://api.vercel.com/v6/deployments?projectId=${env.VERCEL_PROJECT}&limit=1`, {
      headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` },
    });
    targets.push({ id: 'vercel', label: 'Vercel · HQ', up: p.up && p.status < 500, ms: p.ms, detail: p.up ? 'deploy API' : 'unreachable' });
  } else if (env.HQ_URL) {
    const p = await probe(env.HQ_URL, { method: 'GET' });
    targets.push({ id: 'vercel', label: 'Vercel · HQ', up: p.up, ms: p.ms, detail: p.up ? `HTTP ${p.status}` : 'unreachable' });
  }

  // Supabase — REST root; anon key if provided, else plain reachability.
  if (env.SUPABASE_URL) {
    const headers = env.SUPABASE_ANON_KEY ? { apikey: env.SUPABASE_ANON_KEY } : {};
    const p = await probe(`${env.SUPABASE_URL}/rest/v1/`, { headers });
    targets.push({ id: 'supabase', label: 'Supabase', up: p.up, ms: p.ms, detail: p.up ? `${p.ms}ms` : 'unreachable' });
  }

  // Buffer — authenticated GraphQL ping (account query) so "up" means the token
  // actually works, not just that api.buffer.com is reachable.
  if (env.BUFFER_TOKEN) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    const t0 = Date.now();
    try {
      const r = await fetch('https://api.buffer.com', {
        method: 'POST', signal: ctl.signal,
        headers: { Authorization: `Bearer ${env.BUFFER_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({ query: 'query { account { organizations { id } } }' }),
      });
      const j = await r.json().catch(() => ({}));
      const ok = r.ok && j && j.data && j.data.account && !j.errors;
      targets.push({ id: 'buffer', label: 'Buffer · IG', up: !!ok, ms: Date.now() - t0, detail: ok ? 'token valid' : (r.status === 401 ? 'auth failed' : 'error') });
    } catch {
      targets.push({ id: 'buffer', label: 'Buffer · IG', up: false, ms: Date.now() - t0, detail: 'unreachable' });
    } finally { clearTimeout(t); }
  }

  return { targets, at: new Date().toISOString() };
}

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

    const url = new URL(request.url);
    if (url.pathname !== '/status' && url.pathname !== '/') {
      return new Response(JSON.stringify({ error: 'not found' }), { status: 404, headers: { ...cors, 'content-type': 'application/json' } });
    }

    const body = await buildStatus(env);
    return new Response(JSON.stringify(body), {
      headers: { ...cors, 'content-type': 'application/json', 'Cache-Control': 'public, max-age=30' },
    });
  },
};
