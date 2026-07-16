# arganta-core-content

Cloudflare Worker powering **Arganta Core** — the content-generation brain behind HQ's
Content Builder and Video Builder. `POST /v1/generate` turns a plain-English brief into
carousel copy (JSON matching Post Studio's `POST_SCHEMA`) or a static background image
(Workers AI SDXL → PNG). `GET /v1/quota` reports the free-tier neuron allowance.

Contract: [docs/arganta-core/Content-Engine-Contract.md](../../docs/arganta-core/Content-Engine-Contract.md).
Consumers: `apps/hq/src/lib/argantaCoreClient.ts` (the browser client) and
`tools/arganta-core-mcp` (the Claude Code bridge).

## Local dev
```
cd workers/arganta-core-content
npm install
npm test          # 15 pure-logic tests, no Cloudflare runtime needed
npm run dev        # wrangler dev — CORE_TOKEN auth is skipped when unset
```

## Deploy (founder-only — needs your Cloudflare account)
1. Enable **Workers AI** on the account this Worker will run under.
2. Generate a token for `CORE_TOKEN` — any long random string, e.g.:
   ```
   openssl rand -hex 32
   ```
3. Set it as a Worker secret (never put it in `wrangler.toml` or git):
   ```
   wrangler secret put CORE_TOKEN
   ```
4. Deploy:
   ```
   wrangler deploy
   ```
5. (Optional) Add a custom domain/route in `wrangler.toml`, mirroring
   `workers/build-artifact-runtime`'s `routes` block — e.g. `core.arganta.app/*`.
6. Point HQ at it — set in `apps/hq`'s env (`.env`, or your deploy platform's env vars):
   ```
   VITE_ARGANTA_CORE_URL=https://<your-worker-subdomain-or-custom-domain>
   VITE_ARGANTA_CORE_TOKEN=<the same CORE_TOKEN value>
   ```
7. (Optional, for the MCP bridge) give `tools/arganta-core-mcp` the same URL/token
   plus a Supabase **service-role** key — see its own README.

Without steps 1–4, HQ still works: `argantaCoreClient.ts` is worker-first with an honest
fallback, so Post Studio / Video Builder silently drop back to the free `ai.chatJSON` →
local-draft chain and the UI shows "local mode" instead of "Cloudflare · live".

## Config reference (`wrangler.toml`)
| Key | Kind | Meaning |
|-----|------|---------|
| `[ai] binding = "AI"` | binding | Workers AI — `env.AI.run(model, input)` |
| `TEXT_MODEL` | var | copy-generation model (default `@cf/meta/llama-3.1-8b-instruct`) |
| `IMAGE_MODEL` | var | image-generation model (default `@cf/stabilityai/stable-diffusion-xl-base-1.0`) |
| `ALLOWED_ORIGINS` | var | comma-separated CORS allowlist |
| `CORE_TOKEN` | **secret** | shared bearer; skipped when unset (local dev only) |

## Verifying a deploy
```
curl -X POST https://<your-worker>/v1/generate \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <CORE_TOKEN>' \
  -d '{"kind":"copy","brief":"3 slides about ocean animals, playful"}'
```
A healthy response is `{"ok":true,"kind":"copy","copy":{...},"usable":true,"provenance":{...}}`.
Then open HQ → Content Builder → Arganta Core — the panel tag should read
**"Cloudflare · live"** instead of "local mode", and the Model Rack's Arganta Core
tile should show the neuron allowance.
