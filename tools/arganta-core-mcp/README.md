# arganta-core-mcp

An MCP server that lets you author HQ social content **from Claude Code**. Describe a
post; it calls the Arganta Core Content Worker (Cloudflare Workers AI) to generate the
slides, caption, and a background image per slide, then drops a **draft** into HQ's
Content Builder → Drafts inbox for you to edit and publish (including to a KinetikCircle
moment).

`content_draft`/`content_list`/`content_status` never publish anything — they only create
editable drafts. `buffer_publish` is the one tool that reaches a real social account, and
even it can only **queue** a post for you to approve inside Buffer — never publish instantly.

## Tools
| Tool | What it does |
|------|--------------|
| `content_draft` | brief → generated carousel draft in the inbox. Args: `brief` (required), `format`, `palette`, `platform`, `withImages`. |
| `content_list` | recent drafts + whether each was opened in HQ yet. |
| `content_status` | one draft in full (copy, image URLs, provenance). |
| `buffer_channels` | list connected Buffer channels (e.g. your Instagram Business account) + their ids. |
| `buffer_publish` | send a ready draft's images to Buffer. **Safety:** mode is `addToQueue` (default) or `shareNext` only — `shareNow` (immediate publish) is not reachable from Claude Code at all. **Limitation:** runs headless, so it sends the raw AI-generated background images per slide, not the fully composed HQ carousel (headline text/brand baked in) — open the draft in HQ → Content Builder → Drafts and use Post Studio's own "Send to Buffer" for the polished version. |

## Prerequisites
1. Run the migration `supabase/migration_content_drafts.sql` in the ArgantaLab project.
2. Deploy the Worker (`workers/arganta-core-content`, `wrangler deploy`) and set its `CORE_TOKEN`.
3. `cd tools/arganta-core-mcp && npm install`.

## Environment
| Var | Meaning |
|-----|---------|
| `ARGANTA_CORE_URL` | deployed Worker base, e.g. `https://core.arganta.app` |
| `ARGANTA_CORE_TOKEN` | the Worker's `CORE_TOKEN` (optional in local dev) |
| `SUPABASE_URL` | `https://bdagdxgpnlialkppjwor.supabase.co` |
| `SUPABASE_SERVICE_KEY` | **service-role** key — bypasses RLS to write drafts + upload images. Secret; never commit. |

## Configuration (`.env`)
The server auto-loads a **gitignored** `tools/arganta-core-mcp/.env` at startup — one file,
no OS env vars, no secrets in the committed `.mcp.json`. Fill in:
```
ARGANTA_CORE_URL=https://arganta-core-content.<subdomain>.workers.dev
ARGANTA_CORE_TOKEN=<the Worker CORE_TOKEN>
SUPABASE_URL=https://bdagdxgpnlialkppjwor.supabase.co
SUPABASE_SERVICE_KEY=<service-role key — Supabase dashboard → Settings → API → service_role>
```
(`process.env` still wins if you'd rather export them instead.)

## Register in Claude Code
Already in the repo `.mcp.json` — just launches the server, which reads its own `.env`:
```jsonc
{ "mcpServers": {
  "arganta-core-content": { "command": "npx", "args": ["tsx", "tools/arganta-core-mcp/src/server.ts"] }
} }
```
Restart Claude Code after filling `.env` so the server (and its `content_draft` tool) loads.

## Verify
```
npm run type-check                 # types compile
npm run inspect                    # MCP Inspector — call content_draft with a brief
```
Then in HQ → Content Builder → Arganta Core → Drafts, the new draft appears; open it to
load the slides on the canvas.

## Flow
```
Claude Code ──content_draft──▶ MCP ──/v1/generate──▶ Cloudflare Worker (copy + images)
                                 │
                                 ├─ upload images → video-assets bucket (media library)
                                 └─ insert row  → content_draft table
                                                        │
HQ Drafts inbox (S7) ◀── realtime ──────────────────────┘  → coercePost → editable canvas

Claude Code ──buffer_publish(draftId)──▶ MCP ──/v1/buffer/publish──▶ Worker ──GraphQL──▶ Buffer
                                                                                          │
                                                                              your Buffer queue
                                                                          (you approve → Instagram)
```
