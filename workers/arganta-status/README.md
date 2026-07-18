# arganta-status

Cloud-truth probe for the HQ **Command Center**. One endpoint — `GET /status` —
returns the live reachability of the cloud organs (Cloudflare, Vercel HQ,
Supabase, optionally Buffer) so the cockpit's INFRASTRUCTURE tiles show
green/red instead of "pending".

## Why a Worker (and not the browser)
The deployed HQ page (https) can't probe most infra directly — CORS and
private-network rules block it. A Worker at the edge can, and it caches for 30s
so the cockpit polling is cheap.

## Deploy (founder)
```bash
cd workers/arganta-status
wrangler deploy
```
No bindings or secrets are required for the baseline (plain reachability +
latency). Then point HQ at it:
```
# apps/hq/.env.local
VITE_STATUS_URL=https://arganta-status.<your-subdomain>.workers.dev
```

### Optional upgrades
- Real Vercel deploy state instead of site reachability:
  `wrangler secret put VERCEL_TOKEN` and set `VERCEL_PROJECT` in `wrangler.toml`.
- Live Buffer tile: `wrangler secret put BUFFER_TOKEN`.
- Supabase latency without a fallback: set `SUPABASE_ANON_KEY` (public anon key).

## Response shape
```json
{
  "targets": [
    { "id": "cloudflare", "label": "Cloudflare", "up": true,  "ms": 0,  "detail": "edge worker" },
    { "id": "vercel",     "label": "Vercel · HQ", "up": true,  "ms": 42, "detail": "HTTP 200" },
    { "id": "supabase",   "label": "Supabase",    "up": true,  "ms": 31, "detail": "31ms" }
  ],
  "at": "2026-07-18T…Z"
}
```
Each target reports independently — one failure never reds out the others.
