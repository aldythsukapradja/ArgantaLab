# Arganta Bridge

The concrete **Brain Interface**: drives the Claude Agent SDK locally and exposes
it to HQ over a token-gated `127.0.0.1` WebSocket. HQ agent chat sends a mission;
the Bridge streams back a normalized **activity feed** and pauses on gated tools
for an explicit Approve/Deny.

```
HQ chat  ⇄  ws://127.0.0.1:7717  ⇄  Bridge (Agent SDK)  ⇄  Claude Code loop + your MCP servers
```

## Run

```bash
cd tools/arganta-bridge
cp .env.example .env      # set a long random BRIDGE_TOKEN
npm run dev               # tsx watch src/server.ts
```

**Auth:** the Bridge spawns Claude Code via the Agent SDK, which uses your normal
Claude Code credentials. Run it in an environment where `claude` is logged in, or
set `ANTHROPIC_API_KEY`. Without auth, missions return "Not logged in" (the
pipeline still streams correctly — it just can't do model work).

## Protocol (HQ ⇄ Bridge)

Connect: `ws://127.0.0.1:7717/?token=<BRIDGE_TOKEN>` (401 at handshake if wrong).

Client → Bridge:
- `{ type:"mission", missionId, prompt, cwd? }` — start a mission
- `{ type:"approval", approvalId, approved:boolean, input? }` — resolve a gated tool

Bridge → Client (activity feed; no internal reasoning):
- `{ type:"status", label }` — Planning / Reading repository / …
- `{ type:"tool", tool, label }` — an auto-allowed tool ran
- `{ type:"message", text }` — user-facing assistant text
- `{ type:"awaiting_approval", approvalId, tool, label, input }` — gated; needs Approve/Deny
- `{ type:"done", ok, result, costUsd }` / `{ type:"error", message }`

## Local-first policy (`src/permissions.ts`)

Auto: Read/Edit/Write/Glob/Grep, tests, local ComfyUI/media-gen, content drafts.
Gate: `git push`, `reset --hard`, `rm -rf`, Supabase migration/db push, deploys
(vercel/wrangler/modal), `npm publish`, `gh pr merge`, premium Higgsfield spend,
`buffer_publish`. Anything not clearly safe is gated.

## Security

Loopback bind + per-socket token only. A process that runs Claude Code has full
machine access — **never expose this port** without the tunnel + auth planned for
B5. `.env` is gitignored.

## Status

- **B1 done + verified**: server, token auth (401 handshake), streaming
  normalizer, MCP passthrough (absolutized `.mcp.json`), `canUseTool` gate.
  Smoke test (`src/smoke.ts`): wrong-token rejected, authed mission streams
  status→message→done.
- **B2** (next): HQ `surfaces/core` brain-mode toggle + WS client.
- **B3**: wire the Approve/Deny card to `awaiting_approval`.
- **B4**: persist missions to Supabase.
