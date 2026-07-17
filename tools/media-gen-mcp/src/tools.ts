// Registers generate_image: tries providers in order, writes the first
// success to disk, and reports every failed attempt so a total failure is
// diagnosable (which provider, which error) rather than a bare "it didn't work".
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { generateViaCloudflare, generateViaLeonardo, generateViaLocalComfy, generateViaModal, type ImageResult } from './providers'

const json = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] })
const fail = (msg: string) => ({ isError: true, content: [{ type: 'text' as const, text: msg }] })

const FORMATS = ['portrait', 'square', 'story', 'pin', 'wide', 'link'] as const
const EXT_FOR_MIME: Record<string, string> = { 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/png': 'png' }

// All known backends. Order is controlled by MEDIA_PROVIDER_ORDER (comma list);
// default preserves the original Cloudflare -> Leonardo behaviour exactly, so
// nothing changes unless you opt in. Example to prefer your own GPU:
//   MEDIA_PROVIDER_ORDER=local,modal,cloudflare,leonardo
const ALL_PROVIDERS: Record<string, (prompt: string, format: string) => Promise<ImageResult>> = {
  local: generateViaLocalComfy,
  modal: generateViaModal,
  cloudflare: generateViaCloudflare,
  leonardo: generateViaLeonardo,
}
const DEFAULT_ORDER = ['cloudflare', 'leonardo']
const ORDER = (process.env.MEDIA_PROVIDER_ORDER || DEFAULT_ORDER.join(','))
  .split(',').map((s) => s.trim().toLowerCase()).filter((s) => s in ALL_PROVIDERS)
const PROVIDERS = (ORDER.length ? ORDER : DEFAULT_ORDER).map((name) => ({ name, run: ALL_PROVIDERS[name] }))

export function registerTools(server: McpServer) {
  server.tool(
    'generate_image',
    'Generate an image from a text prompt using free-tier providers, trying each in order and ' +
    'automatically falling back to the next one if a provider errors (e.g. its daily free credits are ' +
    'used up). Order: Cloudflare Workers AI (SDXL Lightning, ~10k free neurons/day) → Leonardo.ai (~150 ' +
    'free tokens/day). Saves the result as a PNG/JPG file and returns its path plus which provider produced it.',
    {
      prompt: z.string().min(3).describe('what to generate, e.g. "a moody neon cyberpunk alley at night"'),
      format: z.enum(FORMATS).optional().describe('aspect ratio (default square): portrait 4:5, square 1:1, story 9:16, pin 2:3, wide 16:9, link 1.91:1'),
      outPath: z.string().optional().describe('where to save the file (default: generated-media/image-<timestamp>.<ext> under the repo root)'),
    },
    async ({ prompt, format, outPath }) => {
      const fmt = format || 'square'
      const attempts: { provider: string; error: string }[] = []

      for (const p of PROVIDERS) {
        try {
          const result = await p.run(prompt, fmt)
          const ext = EXT_FOR_MIME[result.mime] || 'png'
          const path = resolve(outPath || join('generated-media', `image-${Date.now().toString(36)}.${ext}`))
          mkdirSync(dirname(path), { recursive: true })
          writeFileSync(path, result.bytes)
          return json({
            ok: true, provider: result.provider, model: result.model, path,
            mime: result.mime, bytes: result.bytes.length,
            failedAttemptsBeforeSuccess: attempts,
          })
        } catch (e: any) {
          attempts.push({ provider: p.name, error: e?.message || String(e) })
        }
      }
      return fail(`All providers failed:\n${attempts.map((a) => `- ${a.provider}: ${a.error}`).join('\n')}`)
    },
  )
}
