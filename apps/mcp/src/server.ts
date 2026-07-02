// The Bridge — MCP server entry. Two transports from one tool set:
//   • stdio (default)  → Claude Desktop, MCP Inspector, any local MCP client
//   • --http           → Streamable HTTP for remote connectors (Claude.ai, ChatGPT)
//
//   npm run stdio            # local, for Claude Desktop / Inspector
//   npm run http             # remote, listens on PORT (default 8787) at /mcp
//   BRIDGE_TOKEN=secret npm run http   # require Authorization: Bearer <secret>
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import express from 'express'
import { registerTools } from './tools'

const NAME = 'circle-hq-bridge'
const VERSION = '0.1.0'

function buildServer(): McpServer {
  const server = new McpServer(
    { name: NAME, version: VERSION },
    {
      instructions:
        'You are seated as CEO over Circle HQ — an org cockpit for the Arganta ecosystem ' +
        '(KinetikCircle + ArgantaLab). Six offices report to you: COO (operations), CTO (technology), ' +
        'CFO (treasury), GC (legal), CAPO (the agent guild), plus your own Bridge. Prefer `ceo_ask` for ' +
        'plain questions; it routes to the right office and returns context to synthesize. Every value ' +
        'carries a provenance badge — never present a `simulated` or `placeholder` number as measured. ' +
        'This deployment serves the deterministic seed graph and is READ-ONLY.',
    },
  )
  registerTools(server)
  return server
}

const wantsHttp = process.argv.includes('--http') || process.env.MCP_TRANSPORT === 'http'

if (wantsHttp) {
  const app = express()
  app.use(express.json({ limit: '2mb' }))

  const TOKEN = process.env.BRIDGE_TOKEN
  const authed = (req: express.Request): boolean => {
    if (!TOKEN) return true
    const h = req.header('authorization') ?? ''
    return h === `Bearer ${TOKEN}`
  }

  app.get('/', (_req, res) => res.json({ name: NAME, version: VERSION, transport: 'streamable-http', endpoint: '/mcp', readOnly: true }))
  app.get('/healthz', (_req, res) => res.json({ ok: true }))

  // Stateless Streamable HTTP: a fresh server+transport per request (no session state).
  app.post('/mcp', async (req, res) => {
    if (!authed(req)) return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'unauthorized' }, id: null })
    try {
      const server = buildServer()
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
      res.on('close', () => { transport.close(); server.close() })
      await server.connect(transport)
      await transport.handleRequest(req, res, req.body)
    } catch (err) {
      console.error('[bridge] request error', err)
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'internal error' }, id: null })
    }
  })

  // Stateless mode has no server-initiated stream / session to resume.
  const methodNotAllowed = (_req: express.Request, res: express.Response) =>
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'method not allowed' }, id: null })
  app.get('/mcp', methodNotAllowed)
  app.delete('/mcp', methodNotAllowed)

  const port = Number(process.env.PORT ?? 8787)
  app.listen(port, () => {
    console.log(`[bridge] ${NAME} v${VERSION} — Streamable HTTP on :${port}/mcp  (read-only${TOKEN ? ', token required' : ''})`)
  })
} else {
  const server = buildServer()
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error(`[bridge] ${NAME} v${VERSION} — stdio ready (read-only)`)
}
