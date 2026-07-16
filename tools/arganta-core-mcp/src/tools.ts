// Registers the Arganta Core content tools on an McpServer. Six tools:
//   content_draft   — brief → generated carousel draft in HQ's Drafts inbox
//   content_list    — recent drafts + their status
//   content_status  — one draft's detail (status, slide count, provenance)
//   buffer_channels — list connected Buffer channels (e.g. Instagram)
//   buffer_publish  — send a draft's images to Buffer (queue-only, BF4)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { readEnv, makeClient, createDraft, listDrafts, getDraft, listBufferChannels, publishDraftToBuffer } from './core'

const json = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] })
const fail = (msg: string) => ({ isError: true, content: [{ type: 'text' as const, text: msg }] })

const FORMATS = ['portrait', 'square', 'story', 'pin', 'wide', 'link'] as const

export function registerTools(server: McpServer) {
  server.tool(
    'content_draft',
    'Generate a social-post carousel with Arganta Core (Cloudflare Worker) and drop it into HQ’s ' +
    'Content Builder → Drafts inbox for the operator to edit and publish. Describe the post in plain ' +
    'English; the Worker writes the slides + caption and (unless disabled) generates a background image ' +
    'per slide. Returns the draft id.',
    {
      brief: z.string().min(3).describe('what the post is about, e.g. "5-slide carousel about ocean animals, playful"'),
      format: z.enum(FORMATS).optional().describe('post shape (default portrait 4:5)'),
      palette: z.string().optional().describe('preferred palette id, e.g. ocean, dusk, kinetik'),
      platform: z.string().optional().describe('caption target: instagram (default), tiktok, x, linkedin, facebook, pinterest'),
      withImages: z.boolean().optional().describe('generate a background image per slide (default true)'),
    },
    async ({ brief, format, palette, platform, withImages }) => {
      try {
        const env = readEnv()
        const client = makeClient(env)
        const r = await createDraft(env, client, brief, { format, palette, platform, withImages })
        return json({ ok: true, draftId: r.id, slides: r.slides, imagesGenerated: r.images,
          next: 'Open HQ → Content Builder → Arganta Core → Drafts to edit and publish.' })
      } catch (e: any) { return fail(e?.message || String(e)) }
    },
  )

  server.tool(
    'content_list',
    'List the most recent Arganta Core content drafts and whether each has been opened in HQ yet.',
    { limit: z.number().int().min(1).max(50).optional().describe('how many (default 20)') },
    async ({ limit }) => {
      try {
        const client = makeClient(readEnv())
        return json({ ok: true, drafts: await listDrafts(client, limit ?? 20) })
      } catch (e: any) { return fail(e?.message || String(e)) }
    },
  )

  server.tool(
    'content_status',
    'Get one content draft in full — status, the generated copy (slides + caption + hashtags), image ' +
    'URLs, and provenance (which Worker model produced it).',
    { id: z.string().describe('the draft id returned by content_draft') },
    async ({ id }) => {
      try {
        const client = makeClient(readEnv())
        const d = await getDraft(client, id)
        return d ? json({ ok: true, draft: d }) : fail(`No draft ${id}.`)
      } catch (e: any) { return fail(e?.message || String(e)) }
    },
  )

  server.tool(
    'buffer_channels',
    'List the social channels connected to Buffer (e.g. an Instagram Business account), with their ' +
    'channel id — needed for buffer_publish.',
    {},
    async () => {
      try {
        const channels = await listBufferChannels(readEnv())
        return json({ ok: true, channels })
      } catch (e: any) { return fail(e?.message || String(e)) }
    },
  )

  server.tool(
    'buffer_publish',
    'Send a ready content_draft’s images to Buffer for a channel. SAFETY: this can only QUEUE the post ' +
    '(mode "addToQueue", the default) or bump it to the next queue slot ("shareNext") — immediate ' +
    'publishing to a live account is intentionally not available from Claude Code; the operator approves ' +
    'the final post inside Buffer before it reaches Instagram. LIMITATION: runs headless, so it sends the ' +
    'raw AI-generated background images per slide, not the fully composed HQ carousel (headline text/brand ' +
    'baked in) — for the polished version, open the draft in HQ → Content Builder → Drafts and use ' +
    '"Send to Buffer" there instead. Requires a draft made with withImages:true (the default).',
    {
      draftId: z.string().describe('the draft id from content_draft / content_list'),
      channelId: z.string().describe('the Buffer channel id from buffer_channels'),
      mode: z.enum(['addToQueue', 'shareNext']).optional().describe('addToQueue (default, safest) or shareNext (jumps the queue) — never immediate'),
    },
    async ({ draftId, channelId, mode }) => {
      try {
        const env = readEnv()
        const client = makeClient(env)
        const r = await publishDraftToBuffer(env, client, draftId, channelId, mode)
        return json({ ok: true, ...r, next: 'Review it in your Buffer queue (publish.buffer.com) before it goes to Instagram.' })
      } catch (e: any) { return fail(e?.message || String(e)) }
    },
  )
}
