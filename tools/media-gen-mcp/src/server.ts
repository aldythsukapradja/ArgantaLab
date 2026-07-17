// media-gen-mcp — MCP server entry (stdio). generate_image tries Cloudflare
// Workers AI first, then Leonardo.ai, so one provider running out of its
// daily free credits doesn't stop image generation.
//
//   ARGANTA_CORE_URL=…  ARGANTA_CORE_TOKEN=…  LEONARDO_API_KEY=…  npm run stdio
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools'

// Local, gitignored .env (tools/media-gen-mcp/.env) — same hand-parser pattern
// as tools/arganta-core-mcp, so setup is one file to fill. process.env always wins.
try {
  const envPath = join(dirname(fileURLToPath(import.meta.url)), '..', '.env')
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
    if (!m) continue
    const key = m[1]
    let val = m[2].trim().replace(/^["']|["']$/g, '')
    if (val && process.env[key] === undefined) process.env[key] = val
  }
} catch { /* no .env file — rely on process.env (e.g. .mcp.json env block) */ }

const server = new McpServer(
  { name: 'media-gen', version: '0.1.0' },
  {
    instructions:
      'generate_image tries free-tier image providers in order (Cloudflare Workers AI, then Leonardo.ai) ' +
      'and automatically falls back to the next one if a provider errors, e.g. its daily free quota is ' +
      'exhausted. Saves the result to disk and reports which provider actually produced it.',
  },
)
registerTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[media-gen-mcp] stdio ready')
