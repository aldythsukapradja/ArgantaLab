// S3a Vault Ingest Contract — the ONLY sanctioned write path for generated
// pixel art (docs/media-center/ComfyUI-Sovereign-Fabric-Plan.md). Bytes go to
// the PRIVATE `pixel-art` bucket under generated/<kind>/<yyyy-mm>/, metadata
// goes to `pixel_ingest` (schema: supabase/migration_pixel_ingest.sql), and a
// human promotes/rejects in HQ's Pixel → Ingest tab. Never write generated
// pixel art to media-artifacts alone, a bare local file, or nowhere at all.
//
// Uses the service key (bypasses RLS) — same posture as persist.ts. Unlike
// persist.ts this is NOT optional-best-effort: if the vault write fails the
// tool reports failure, because "generated but lost" is exactly the bug the
// contract exists to kill.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readFileSync } from 'node:fs'

const BUCKET = 'pixel-art'
const KINDS = ['character', 'sprite', 'tile', 'tileset', 'background', 'ui', 'portrait', 'icon', 'animation'] as const

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'pixel'
const shortId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 5)

const ANIMATION = z.object({
  name: z.string(),
  frames: z.number().int().positive(),
  fps: z.number().positive(),
  directions: z.union([z.literal(1), z.literal(4), z.literal(8)]),
  loop: z.boolean(),
})

function env() {
  const url = (process.env.SUPABASE_URL || '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) throw new Error('SUPABASE_URL/SUPABASE_SERVICE_KEY not set (tools/media-gen-mcp/.env) — the pixel vault is unreachable')
  return { url, key, headers: { Authorization: `Bearer ${key}`, apikey: key } }
}

export function registerPixelVaultTools(server: McpServer) {
  server.tool(
    'pixel_vault_ingest',
    'Store a generated pixel-art file in the Pixel Vault ingest queue (S3a contract). Uploads the ' +
    'bytes to the private pixel-art bucket under generated/<kind>/<yyyy-mm>/ and inserts a pixel_ingest ' +
    'row; the operator then reviews it in HQ → Pixel → Ingest and promotes it to the canonical Library ' +
    'or rejects it. Use this for EVERY pixel asset generated via PixelLab, ComfyUI, or any other ' +
    'source — generated art that skips the vault is considered lost. Accepts a local file path ' +
    '(PNG/GIF/WebP) or a URL to download (e.g. a PixelLab download URL).',
    {
      file: z.string().describe('local file path OR https URL of the generated image / sprite sheet'),
      suggestedName: z.string().min(2).describe('human name, e.g. "Frost Pup"'),
      kind: z.enum(KINDS).describe('what it is — decides the storage folder'),
      generatedVia: z.string().describe("generator, e.g. 'pixellab' | 'comfyui'"),
      prompt: z.string().optional().describe('the generation prompt (reproducibility)'),
      sourceJobId: z.string().optional().describe('generator-side job/character id'),
      styleRefId: z.string().optional().describe('vault item id it was generated against'),
      width: z.number().int().positive().optional(),
      height: z.number().int().positive().optional(),
      tags: z.array(z.string()).optional().describe('suggested tags for the reviewer'),
      swatch: z.array(z.string()).optional().describe('representative hex colors, e.g. ["#6ee7f9"]'),
      animations: z.array(ANIMATION).optional().describe('sprite-sheet animation meta (name/frames/fps/directions/loop)'),
    },
    async (a) => {
      try {
        const { url, headers } = env()

        // 1 · bytes — local path or download
        let bytes: Uint8Array
        let mime = 'image/png'
        if (/^https?:\/\//i.test(a.file)) {
          const r = await fetch(a.file)
          if (!r.ok) throw new Error(`download failed: HTTP ${r.status} for ${a.file}`)
          mime = r.headers.get('content-type')?.split(';')[0] || 'image/png'
          bytes = new Uint8Array(await r.arrayBuffer())
        } else {
          bytes = new Uint8Array(readFileSync(a.file))
          mime = a.file.toLowerCase().endsWith('.gif') ? 'image/gif'
            : a.file.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png'
        }
        if (!bytes.length) throw new Error('file is empty')

        // 2 · organized, deterministic storage path (contract layout)
        const ext = mime === 'image/gif' ? 'gif' : mime === 'image/webp' ? 'webp' : 'png'
        const id = `ingest.${slug(a.suggestedName)}-${shortId()}`
        const month = new Date().toISOString().slice(0, 7)
        const path = `generated/${a.kind}/${month}/${slug(a.suggestedName)}-${id.split('-').pop()}.${ext}`

        // 3 · upload (private bucket, service role)
        const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': mime, 'x-upsert': 'true' },
          body: bytes as any,
        })
        if (!up.ok) {
          const t = await up.text().catch(() => '')
          throw new Error(`bucket upload failed (bucket "${BUCKET}" missing? run migration_pixel_vault.sql): HTTP ${up.status} ${t.slice(0, 140)}`)
        }

        // 4 · animation meta rides as a sibling .json (contract: sheet + meta)
        if (a.animations?.length) {
          await fetch(`${url}/storage/v1/object/${BUCKET}/${path.replace(/\.[a-z]+$/, '.json')}`, {
            method: 'POST',
            headers: { ...headers, 'Content-Type': 'application/json', 'x-upsert': 'true' },
            body: JSON.stringify({ animations: a.animations, size: { w: a.width, h: a.height } }),
          }).catch(() => { /* meta is best-effort; the sheet is the artifact */ })
        }

        // 5 · queue row — REQUIRED; a failure here fails the tool
        const ins = await fetch(`${url}/rest/v1/pixel_ingest`, {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({
            id,
            suggested_name: a.suggestedName,
            generated_via: a.generatedVia,
            source_job_id: a.sourceJobId ?? null,
            style_ref_id: a.styleRefId ?? null,
            prompt: a.prompt ?? null,
            kind: a.kind,
            size: a.width && a.height ? { w: a.width, h: a.height } : {},
            swatch: a.swatch ?? [],
            suggested_tags: a.tags ?? [],
            animations: a.animations ?? [],
            storage_path: path,
            status: 'pending',
          }),
        })
        if (!ins.ok) {
          const t = await ins.text().catch(() => '')
          throw new Error(`pixel_ingest insert failed (run supabase/migration_pixel_ingest.sql?): HTTP ${ins.status} ${t.slice(0, 140)} — bytes ARE uploaded at ${BUCKET}/${path}`)
        }

        return { content: [{ type: 'text' as const, text: JSON.stringify({
          ok: true, id, storagePath: `${BUCKET}/${path}`, bytes: bytes.length, mime,
          next: 'review in HQ → Pixel → Ingest (promote or reject)',
        }, null, 2) }] }
      } catch (e: any) {
        return { isError: true, content: [{ type: 'text' as const, text: e?.message || String(e) }] }
      }
    },
  )

  server.tool(
    'pixel_brief_list',
    'List pending Pixel Studio Forge briefs (founder-authored generation requests). For each, generate ' +
    'the asset(s) via the PixelLab MCP (game sprites/tilesets/animations) or ComfyUI pixel-LoRA, call ' +
    'pixel_vault_ingest for each result, then pixel_brief_resolve to close it.',
    { status: z.enum(['pending', 'claimed', 'done']).optional().describe('default pending') },
    async ({ status }) => {
      try {
        const { url, headers } = env()
        const r = await fetch(`${url}/rest/v1/pixel_brief?status=eq.${status || 'pending'}&order=created_at.asc&limit=50`, { headers })
        if (!r.ok) throw new Error(`brief read failed: HTTP ${r.status}`)
        const rows: any[] = await r.json() as any[]
        return { content: [{ type: 'text' as const, text: JSON.stringify({ count: rows.length, briefs: rows }, null, 2) }] }
      } catch (e: any) {
        return { isError: true, content: [{ type: 'text' as const, text: e?.message || String(e) }] }
      }
    },
  )

  server.tool(
    'pixel_brief_resolve',
    'Mark a Pixel Studio Forge brief done (or cancelled) after generating + ingesting its assets.',
    {
      id: z.string().describe('the brief id'),
      resultCount: z.number().int().min(0).describe('how many ingest rows it produced'),
      status: z.enum(['done', 'cancelled']).optional().describe('default done'),
    },
    async ({ id, resultCount, status }) => {
      try {
        const { url, headers } = env()
        const r = await fetch(`${url}/rest/v1/pixel_brief?id=eq.${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { ...headers, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ status: status || 'done', result_count: resultCount, resolved_at: new Date().toISOString() }),
        })
        if (!r.ok) throw new Error(`brief resolve failed: HTTP ${r.status}`)
        return { content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, id }, null, 2) }] }
      } catch (e: any) {
        return { isError: true, content: [{ type: 'text' as const, text: e?.message || String(e) }] }
      }
    },
  )

  server.tool(
    'pixel_vault_queue',
    'List the Pixel Vault ingest queue (pending generated art awaiting review), newest first.',
    { status: z.enum(['pending', 'rejected', 'promoted']).optional().describe('default pending') },
    async ({ status }) => {
      try {
        const { url, headers } = env()
        const r = await fetch(`${url}/rest/v1/pixel_ingest?status=eq.${status || 'pending'}&order=created_at.desc&limit=100`, { headers })
        if (!r.ok) throw new Error(`queue read failed: HTTP ${r.status}`)
        const rows: any[] = await r.json() as any[]
        return { content: [{ type: 'text' as const, text: JSON.stringify({ count: rows.length, items: rows }, null, 2) }] }
      } catch (e: any) {
        return { isError: true, content: [{ type: 'text' as const, text: e?.message || String(e) }] }
      }
    },
  )
}
