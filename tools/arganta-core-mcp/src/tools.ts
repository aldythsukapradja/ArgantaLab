// Registers the Arganta Core content tools on an McpServer. Eight tools:
//   content_draft   — brief → generated carousel draft in HQ's Drafts inbox
//   content_compose — a finished PostDoc → draft loaded VERBATIM (style batches)
//   content_list    — recent drafts + their status
//   content_status  — one draft's detail (status, slide count, provenance)
//   brand_get       — a brand's voice, readiness and platform audit (BF-5)
//   brand_update    — patch a brand's founder-lane text (BF-5)
//   buffer_channels — list connected Buffer channels (e.g. Instagram)
//   buffer_publish  — send a draft's images to Buffer (queue-only, BF4)
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import {
  readEnv, makeClient, createDraft, createComposedDraft, listDrafts, getDraft, listBufferChannels, publishDraftToBuffer,
  getBrand, updateBrand, listBrands,
} from './core'

const json = (o: unknown) => ({ content: [{ type: 'text' as const, text: JSON.stringify(o, null, 2) }] })
const fail = (msg: string) => ({ isError: true, content: [{ type: 'text' as const, text: msg }] })

const FORMATS = ['portrait', 'square', 'story', 'pin', 'wide', 'link'] as const
const BUFFER_MODES = ['addToQueue', 'shareNext'] as const // shareNow deliberately absent — never reachable from Claude Code

const PublishIntentSchema = z.union([
  z.object({ dest: z.literal('moment'), circleId: z.string().describe('the Kinetik circle id to post into') }),
  z.object({ dest: z.literal('buffer'), channelId: z.string().describe('the Buffer channel id from buffer_channels'), mode: z.enum(BUFFER_MODES).optional() }),
])

export function registerTools(server: McpServer) {
  server.tool(
    'content_draft',
    'Generate a social-post carousel with Arganta Core (Cloudflare Worker) and drop it into HQ’s ' +
    'Content Builder → Drafts inbox for the operator to edit and publish. Describe the post in plain ' +
    'English; the Worker writes the slides + caption and (unless disabled) generates a background image ' +
    'per slide. Returns the draft id. Optionally attach `publishTo` intents (Path C, hybrid workflow) — ' +
    'these are just RECORDED on the draft as intent badges, never acted on automatically; the operator ' +
    'still opens the draft in HQ and clicks "Approve & publish everywhere" once, which composes the real ' +
    'branded slides (this tool cannot — it runs headless, no canvas) and fans out to every intent. ' +
    'Pass `brand` to write in that brand’s voice: its persona, pillars, CTAs, hashtag banks and art ' +
    'direction are injected into generation, and the draft remembers the brand so HQ composes it with ' +
    'the right mark and palette. Use brand_get first if you need to know a brand’s voice or gaps.',
    {
      brief: z.string().min(3).describe('what the post is about, e.g. "5-slide carousel about ocean animals, playful"'),
      brand: z.string().optional().describe('brand id to write as, e.g. "argantalab" or "kinetikcircle" (see brand_get). Without it the copy has no brand voice.'),
      lang: z.enum(['en', 'id']).optional().describe('language for the copy — the brand must declare it (default en)'),
      format: z.enum(FORMATS).optional().describe('post shape (default portrait 4:5)'),
      palette: z.string().optional().describe('preferred palette id, e.g. ocean, dusk, kinetik. Ignored for colour when a brand is set — the brand’s palette wins at compose time.'),
      platform: z.string().optional().describe('caption target: instagram (default), tiktok, x, linkedin, facebook, pinterest'),
      withImages: z.boolean().optional().describe('generate a background image per slide (default true)'),
      publishTo: z.array(PublishIntentSchema).optional().describe(
        'destinations to record as intents, e.g. [{"dest":"moment","circleId":"..."},{"dest":"buffer","channelId":"...","mode":"addToQueue"}]. ' +
        'Purely declarative — the operator approves the actual publish in HQ.'),
    },
    async ({ brief, brand, lang, format, palette, platform, withImages, publishTo }) => {
      try {
        const env = readEnv()
        const client = makeClient(env)
        const r = await createDraft(env, client, brief, { brand, lang, format, palette, platform, withImages, publishTo: publishTo as any })
        return json({ ok: true, draftId: r.id, brand: r.brand ?? null, slides: r.slides, imagesGenerated: r.images,
          publishIntents: publishTo || [],
          next: publishTo?.length
            ? 'Open HQ → Content Builder → Arganta Core → Drafts, then click "Approve & publish everywhere" to fan out to the requested destinations.'
            : 'Open HQ → Content Builder → Arganta Core → Drafts to edit and publish.' })
      } catch (e: any) { return fail(e?.message || String(e)) }
    },
  )

  server.tool(
    'content_compose',
    'Drop an ALREADY-DESIGNED post into HQ’s Drafts inbox, VERBATIM. Use this — not content_draft — ' +
    'when the founder gave you a style recipe (saved in HQ → Post Studio → Style → Styles) and a content ' +
    'table, and wants their exact design reproduced across many posts. content_draft sends a brief and lets ' +
    'the model choose a layout, which re-templates the slides and loses the founder’s pixels; content_compose ' +
    'sends a finished PostDoc that HQ loads untouched (no coercion), so every position, size, font and colour ' +
    'survives. Build the doc by filling the recipe’s slots ({title}, {body}, {pill1}, {image}…) — one content ' +
    'row per slide — and drop any layer whose slot has no value. Unfilled slots are rejected, so never send ' +
    'a literal "{title}" through. Optionally pass imagePrompts to have Arganta Core generate a background per ' +
    'slide. Like content_draft, publishTo only RECORDS intent — the operator approves the publish in HQ.',
    {
      brief: z.string().min(3).describe('what this post is, for the inbox label, e.g. "Ocean facts #3 — octopus"'),
      doc: z.record(z.any()).describe('a complete v1 PostDoc: {v:1, format, palette, brandId?, slides:[{id,template,bg,layers:[…]}], caption, hashtags, brand:{name,handle}}. Produce it by filling a style recipe\'s slots.'),
      brand: z.string().optional().describe('brand id to render as, e.g. "argantalab" — sets the mark and palette at compose time'),
      platform: z.string().optional().describe('caption target (default instagram)'),
      imagePrompts: z.array(z.string().optional()).optional().describe('one image brief per slide, positionally zipped onto doc.slides; omit or leave an entry empty to keep the slide\'s existing background'),
      publishTo: z.array(PublishIntentSchema).optional().describe('destinations to record as intents — declarative only, the operator approves in HQ'),
    },
    async ({ brief, doc, brand, platform, imagePrompts, publishTo }) => {
      try {
        const env = readEnv()
        const client = makeClient(env)
        const r = await createComposedDraft(env, client, brief, doc, { brand, platform, imagePrompts, publishTo: publishTo as any })
        return json({ ok: true, draftId: r.id, slides: r.slides, imagesGenerated: r.images, verbatim: true,
          next: 'Open HQ → Content Builder → Drafts. It is badged “styled” and loads with the exact design preserved.' })
      } catch (e: any) { return fail(e?.message || String(e)) }
    },
  )

  server.tool(
    'brand_get',
    'Read a brand from the Brand OS: its voice (persona, pillars, CTAs, hashtag banks, touchy rules), ' +
    'its readiness score per layer with the next actions, and its platform×asset audit (which handles, ' +
    'avatars, bios and links exist or are missing/over-limit on Instagram, TikTok, LinkedIn, Facebook, X ' +
    'and YouTube). Call with no id to list the canonized brands. This is the single source of truth for ' +
    'branding — read it before writing anything on a brand’s behalf.',
    {
      id: z.string().optional().describe('brand id, e.g. "argantalab". Omit to list all brands.'),
      lang: z.enum(['en', 'id']).optional().describe('which language’s copy to return in the voice block (default en)'),
    },
    async ({ id, lang }) => {
      try {
        if (!id) return json({ ok: true, brands: listBrands(), hint: 'Call brand_get with an id for that brand’s voice, readiness and platform audit.' })
        const client = makeClient(readEnv())
        return json({ ok: true, brand: await getBrand(client, id, lang) })
      } catch (e: any) { return fail(e?.message || String(e)) }
    },
  )

  server.tool(
    'brand_update',
    'Patch a brand’s FOUNDER-LANE text — voice (persona, taglines, boilerplates, hashtag banks, CTAs, ' +
    'touchy rules), campaign spine, platform handles/bios/links, and discovery copy. Pass a partial ' +
    'BrandDoc; it is deep-merged into the brand’s Supabase overlay. ' +
    'HARD LIMIT: visuals are agent-lane and live in git — marks, palettes, fonts, templates and routing ' +
    'CANNOT be changed here and the call fails if you try. Editing those means editing ' +
    'packages/brand/brands/<id>/brand.json in the repo directly.',
    {
      id: z.string().describe('brand id, e.g. "argantalab"'),
      patch: z.record(z.any()).describe(
        'partial BrandDoc, founder-lane only. e.g. {"voice":{"hashtags":{"branded":["#argantalab"]}}} ' +
        'or {"presence":{"instagram":{"bio":"..."}}} or {"spine":{"rhythm":[{"day":"mon","pillar":"build"}]}}'),
    },
    async ({ id, patch }) => {
      try {
        const client = makeClient(readEnv())
        const r = await updateBrand(client, id, patch as Record<string, unknown>)
        return json({ ok: true, brand: r.id, changed: r.changed,
          next: 'The founder sees this immediately in HQ → Brand Forge. Derived platform bios may now be flagged stale for re-approval.' })
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
