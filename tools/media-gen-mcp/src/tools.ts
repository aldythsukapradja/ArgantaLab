// Registers generate_image: tries providers in order, writes the first
// success to disk, and reports every failed attempt so a total failure is
// diagnosable (which provider, which error) rather than a bare "it didn't work".
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { FORMAT_ASPECT, generateViaCloudflare, generateViaLeonardo, generateViaLocalComfy, generateViaModal, generateMusicViaLocalComfy, generateVideoViaLocalComfy, type ImageResult } from './providers'
import { persistToSupabase } from './persist'
import { registerPixelVaultTools } from './pixelVault'

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
  registerPixelVaultTools(server)

  // Sovereign music — local ComfyUI ACE-Step 1.5 only (no billing path). Saves a
  // FLAC/MP3 to disk and, if Supabase keys are set, to the media-artifacts bucket
  // with an audio lineage row. See Phase O2 — graph needs a live verify after the
  // ACE-Step model finishes downloading + ComfyUI restarts.
  server.tool(
    'generate_music',
    'Generate a music clip locally with ComfyUI ACE-Step 1.5 (sovereign, zero cost — no cloud/billing). ' +
    'Give a comma-tag style prompt (e.g. "lofi, warm, rainy, mellow piano") and a duration; optional lyrics. ' +
    'Saves a FLAC/MP3 file and reports the path. Requires the ACE-Step checkpoint (tools/comfyui/download-media-models.ps1) and a running ComfyUI.',
    {
      tags: z.string().min(2).describe('comma-separated style tags, e.g. "epic, orchestral, driving drums"'),
      seconds: z.number().min(4).max(240).optional().describe('duration in seconds (default 30)'),
      lyrics: z.string().optional().describe('optional lyrics; omit for instrumental'),
      outPath: z.string().optional().describe('where to save (default: generated-media/music-<ts>.<ext>)'),
    },
    async ({ tags, seconds, lyrics, outPath }) => {
      const secs = seconds || 30
      try {
        const r = await generateMusicViaLocalComfy(tags, secs, lyrics || '')
        const ext = r.mime === 'audio/mpeg' ? 'mp3' : 'flac'
        const path = resolve(outPath || join('generated-media', `music-${Date.now().toString(36)}.${ext}`))
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, r.bytes)
        const persisted = await persistToSupabase({
          bytes: r.bytes, mime: r.mime, provider: r.provider, model: r.model,
          prompt: tags, format: 'audio', kind: 'music', seconds: r.seconds,
        })
        return json({ ok: true, provider: r.provider, model: r.model, path, mime: r.mime, seconds: r.seconds, bytes: r.bytes.length, supabase: persisted })
      } catch (e: any) {
        return fail(`generate_music failed: ${e?.message || e}`)
      }
    },
  )

  // Sovereign video — local ComfyUI Wan 2.2 TI2V-5B only (no billing). Small on
  // 8GB (defaults 384² × 25 frames). Saves an MP4 + optional Supabase lineage.
  server.tool(
    'generate_video',
    'Generate a short video clip locally with ComfyUI Wan 2.2 TI2V-5B (sovereign, zero cost — no cloud/billing). ' +
    'Text-to-video from a prompt. On 8GB VRAM keep it small (defaults 384x384, 25 frames ≈ 1s); larger is slower ' +
    'and can OOM. Saves an MP4 and reports the path. Requires the Wan 2.2 5B files + a running ComfyUI.',
    {
      prompt: z.string().min(3).describe('what should happen, e.g. "a calm ocean wave at golden hour, gentle motion"'),
      width: z.number().min(256).max(1280).optional().describe('default 384 (rounded to /16)'),
      height: z.number().min(256).max(1280).optional().describe('default 384'),
      frames: z.number().min(9).max(121).optional().describe('frame count (default 25 ≈ 1s @24fps)'),
      fps: z.number().min(8).max(30).optional().describe('default 24'),
      outPath: z.string().optional().describe('where to save (default: generated-media/video-<ts>.mp4)'),
    },
    async ({ prompt, width, height, frames, fps, outPath }) => {
      try {
        const r = await generateVideoViaLocalComfy(prompt, { width, height, frames, fps })
        const path = resolve(outPath || join('generated-media', `video-${Date.now().toString(36)}.mp4`))
        mkdirSync(dirname(path), { recursive: true })
        writeFileSync(path, r.bytes)
        const persisted = await persistToSupabase({ bytes: r.bytes, mime: r.mime, provider: r.provider, model: r.model, prompt, format: 'video', kind: 'video' })
        return json({ ok: true, provider: r.provider, model: r.model, path, mime: r.mime, bytes: r.bytes.length, supabase: persisted })
      } catch (e: any) {
        return fail(`generate_video failed: ${e?.message || e}`)
      }
    },
  )

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
          const dims = FORMAT_ASPECT[fmt] || FORMAT_ASPECT.square
          const persisted = await persistToSupabase({
            bytes: result.bytes, mime: result.mime,
            provider: result.provider, model: result.model, prompt, format: fmt,
            width: dims.w, height: dims.h,
          })
          return json({
            ok: true, provider: result.provider, model: result.model, path,
            mime: result.mime, bytes: result.bytes.length,
            supabase: persisted,
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
