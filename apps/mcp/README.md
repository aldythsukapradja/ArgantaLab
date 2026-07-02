# The Bridge — an LLM seat over Circle HQ

Give **Claude** or **ChatGPT** a **CEO seat** over Circle HQ. The Bridge is an
[MCP](https://modelcontextprotocol.io) server: the LLM becomes the CEO's cortex,
and every office + slice of your product ontology becomes a **tool it can call**.

- **Read-only** — the LLM can brief, query, and run the models, but cannot mutate anything.
- **Hierarchical** — `ceo_ask` routes a plain question to the right office(s) and returns context to synthesize.
- **Deterministic seed** — serves the built-in graph; always on, offline, every number carries a provenance badge (`live` / `partial` / `simulated` / `placeholder`). **Nothing fake renders as real.**

It **reuses the HQ engine** (`apps/hq/src/data/graph/*`) with zero rebuild — the same
deterministic functions the Command tab renders.

## The tools the CEO can call

| Tool | What it does |
|---|---|
| `ceo_ask` | **Main entry.** Plain-English question → routes to office(s) → returns decision-grade context |
| `ceo_brief` | Polls all six offices: North Star, coverage, health, verdicts, resolve queue |
| `office_report` | Drill into one chief (Treasury adds the financial model; Technology adds coverage + scale/cost) |
| `graph_query` | Filter the ontology by kind / office / provenance / lever |
| `node_get` | One node: provenance, owner, children, blast radius |
| `verdict_queue` | The open verdict to-do list (each LADDERS_TO a lever/stage) |
| `root_cause` | North Star → weakest lever → least-instrumented surface → missing event |
| `financial_model` | Treasury unit-economics + cashflow (simulated): ARPU, break-even, NPV |
| `scale_model` | CTO stack cost per layer at N families; $/active vs the $0.08 load |

## Run it

```bash
cd apps/mcp
npm install
npm run smoke     # battle test — exercises every tool against the real engine
```

### Local — Claude Desktop (no hosting, works immediately)

`npm run stdio` speaks MCP over stdio. Add to Claude Desktop's config
(`claude_desktop_config.json` → Settings → Developer → Edit Config):

```jsonc
{
  "mcpServers": {
    "circle-hq": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/ArgantaLab/apps/mcp/src/server.ts"]
    }
  }
}
```

Restart Claude Desktop, then ask: *"As CEO of Circle HQ, are we cashflow positive and what should we fix first?"* — it will call `ceo_ask` → `financial_model` → `root_cause`.

### Inspect (visual test client)

```bash
npm run inspect      # opens the MCP Inspector against the stdio server
```

### Remote — one link for Claude.ai and ChatGPT

The "give a link" mode. Start Streamable HTTP and expose it over public HTTPS:

```bash
BRIDGE_TOKEN=your-secret npm run http      # listens on :8787/mcp
```

Expose it: deploy to any Node host (Render / Railway / Fly), or tunnel for a quick
test (`npx localtunnel --port 8787` / `cloudflared tunnel --url http://localhost:8787`).
Your link is `https://<host>/mcp`.

- **Claude.ai** → Settings → **Connectors** → *Add custom connector* → paste `https://<host>/mcp`
  (add the `Authorization: Bearer your-secret` header if you set `BRIDGE_TOKEN`). *Requires a Pro/Max/Team plan.*
- **ChatGPT** → Settings → **Connectors** (developer mode) → *Add MCP server* → same URL.
  Fallback for plans without MCP: wrap `/mcp` as a **Custom GPT Action**.

> The server must be reachable over **HTTPS** for the hosted apps to connect. `BRIDGE_TOKEN`
> is a light guard so a public URL isn't wide open — treat the link as a secret.

## What's next (not in this slice)

- **Read + act** tools (file a verdict, change an assumption) behind a write token.
- **Live Supabase** source so the LLM sees measured numbers where instrumentation exists.
- **In-app** topology: the Command agent orb calling these same tools server-side via the Claude/OpenAI API.
