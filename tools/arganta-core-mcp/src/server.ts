// arganta-core-mcp — MCP server entry (stdio). Add it to Claude Code and you can
// author HQ content from the terminal: `content_draft "5 slides about ocean life"`
// generates copy + images via the Arganta Core Worker and drops a draft into HQ's
// Content Builder inbox.
//
//   ARGANTA_CORE_URL=…  ARGANTA_CORE_TOKEN=…  \
//   SUPABASE_URL=…      SUPABASE_SERVICE_KEY=…  \
//   npm run stdio
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerTools } from './tools'

// Load a local, gitignored .env (tools/arganta-core-mcp/.env) so setup is one
// file to fill — no OS env vars, no secrets in the committed .mcp.json. Existing
// process.env always wins (so an explicit env override still works). Tiny hand
// parser — no dotenv dependency.
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
  { name: 'arganta-core-content', version: '0.1.0' },
  {
    instructions:
      'You can author social content for Circle HQ. Use `content_draft` with a plain-English brief to ' +
      'generate a carousel (slides + caption + a background image per slide) via Arganta Core; it lands ' +
      'in HQ’s Content Builder → Drafts inbox for the operator to edit and publish (including to a ' +
      'KinetikCircle moment). Use `content_list` / `content_status` to track drafts. You can also send a ' +
      'ready draft toward Instagram with `buffer_channels` + `buffer_publish` — but that ONLY queues it in ' +
      'Buffer (mode addToQueue/shareNext), never publishes immediately; the operator still approves the ' +
      'final post inside Buffer, and it sends raw generated images, not the fully composed HQ carousel. ' +
      'Never claim content was published/live on Instagram or any feed — content_draft only creates ' +
      'editable drafts, and buffer_publish only queues for review.',
  },
)
registerTools(server)

const transport = new StdioServerTransport()
await server.connect(transport)
console.error('[arganta-core-mcp] stdio ready')
