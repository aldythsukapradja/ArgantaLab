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

/** Per-colo cache for rate-limited upstreams (Buffer's 24h limit, Vercel/
 * Supabase management APIs). Stores the probe RESULT, not a fetch response. */
async function cached(key, ttlSec, fn) {
  const cache = caches.default;
  const ck = new Request(`https://status-cache.internal/${key}`);
  const hit = await cache.match(ck);
  if (hit) { try { return await hit.json(); } catch { /* fall through */ } }
  const data = await fn();
  await cache.put(ck, new Response(JSON.stringify(data), { headers: { 'Cache-Control': `max-age=${ttlSec}` } }));
  return data;
}
async function fetchJson(url, init) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try { const r = await fetch(url, { ...init, signal: ctl.signal }); return r.ok ? await r.json() : null; }
  catch { return null; } finally { clearTimeout(t); }
}
const fmtAge = (min) => min < 60 ? `${min}m` : min < 1440 ? `${Math.round(min / 60)}h` : `${Math.round(min / 1440)}d`;

async function buildStatus(env) {
  const targets = [];

  // Cloudflare — if we're executing, the edge is up.
  targets.push({ id: 'cloudflare', label: 'Cloudflare', up: true, ms: 0, detail: 'edge worker' });

  // Vercel — real deployment state (READY/BUILDING/ERROR) + age when a token is
  // set (cached 60s); else plain site reachability. Web Analytics visitors if
  // VERCEL_TEAM present too.
  if (env.VERCEL_TOKEN && env.VERCEL_PROJECT) {
    const v = await cached('vercel', 60, async () => {
      const t0 = Date.now();
      const j = await fetchJson(`https://api.vercel.com/v6/deployments?projectId=${encodeURIComponent(env.VERCEL_PROJECT)}&limit=1`, { headers: { Authorization: `Bearer ${env.VERCEL_TOKEN}` } });
      const d = j?.deployments?.[0];
      const state = d?.readyState || d?.state || null;
      return { up: state === 'READY' || state == null, ms: Date.now() - t0, state: state ? String(state).toLowerCase() : 'no deploys', ageMin: d?.created ? Math.round((Date.now() - d.created) / 60000) : (d?.createdAt ? Math.round((Date.now() - d.createdAt) / 60000) : null) };
    });
    targets.push({ id: 'vercel', label: 'Vercel · HQ', up: v.up, ms: v.ms, detail: v.ageMin != null ? `${v.state} · ${fmtAge(v.ageMin)} ago` : v.state });
  } else if (env.HQ_URL) {
    const p = await probe(env.HQ_URL, { method: 'GET' });
    targets.push({ id: 'vercel', label: 'Vercel · HQ', up: p.up, ms: p.ms, detail: p.up ? `HTTP ${p.status}` : 'unreachable' });
  }

  // Supabase — fast anon reachability always; project status/region via the
  // Management API when a PAT is present (cached 5min, gentle on 120/min limit).
  if (env.SUPABASE_URL) {
    const headers = env.SUPABASE_ANON_KEY ? { apikey: env.SUPABASE_ANON_KEY } : {};
    const p = await probe(`${env.SUPABASE_URL}/rest/v1/`, { headers });
    let detail = p.up ? `${p.ms}ms` : 'unreachable';
    if (env.SUPABASE_MGMT_TOKEN && env.SUPABASE_REF) {
      const meta = await cached('supabase', 300, async () => {
        const j = await fetchJson(`https://api.supabase.com/v1/projects/${env.SUPABASE_REF}`, { headers: { Authorization: `Bearer ${env.SUPABASE_MGMT_TOKEN}` } });
        return { status: j?.status || null, region: j?.region || null };
      });
      if (meta?.status) detail = `${String(meta.status).toLowerCase().replace(/_/g, ' ')}${meta.region ? ' · ' + meta.region : ''}`;
    }
    targets.push({ id: 'supabase', label: 'Supabase', up: p.up, ms: p.ms, detail });
  }

  // Buffer — authenticated GraphQL ping, CACHED 6h. Buffer has a hard 24h rate
  // limit; polling every 30s locked the token out (the earlier 'error' bug). A
  // RATE_LIMIT_EXCEEDED response still proves the token authenticates → "up".
  if (env.BUFFER_TOKEN) {
    const b = await cached('buffer', 21600, async () => {
      const t0 = Date.now();
      try {
        const r = await fetch('https://api.buffer.com', {
          method: 'POST', headers: { Authorization: `Bearer ${env.BUFFER_TOKEN}`, 'content-type': 'application/json' },
          body: JSON.stringify({ query: 'query { account { organizations { id } } }' }),
        });
        const j = await r.json().catch(() => ({}));
        if (j?.errors?.[0]?.extensions?.code === 'RATE_LIMIT_EXCEEDED') return { up: true, ms: Date.now() - t0, detail: 'connected' };
        const ok = r.ok && j?.data?.account && !j.errors;
        return { up: !!ok, ms: Date.now() - t0, detail: ok ? 'token valid' : (r.status === 401 ? 'auth failed' : 'error') };
      } catch { return { up: false, ms: Date.now() - t0, detail: 'unreachable' }; }
    });
    targets.push({ id: 'buffer', label: 'Buffer · IG', up: b.up, ms: b.ms, detail: b.detail });
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
