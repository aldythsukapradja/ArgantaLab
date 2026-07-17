// IG Simulator → Post Studio bridge (P3).
//
// One function: insert a row into content_draft matching the exact shape
// lib/contentDrafts.ts reads, so the item appears in Post Studio's existing
// S7 inbox within its 12s poll and rides the already-shipped Buffer path.
// Post Studio stays the single publish gate — this NEVER calls Buffer.
import { supabase, cloudEnabled } from '../../../lib/supabase'
import type { Creator } from '../influencerData'
import type { IgPlanItem } from './planStore'

/** item.media is a relative public path (e.g. /influencer/arganta-normal.webp);
 * Post Studio's canvas fetches it as a plain <img> src, so an absolute URL
 * off the current origin is what a coerced slide's imageUrl expects. */
function absMedia(media?: string): string | undefined {
  if (!media) return undefined
  if (/^https?:\/\//.test(media)) return media
  try { return new URL(media, window.location.origin).href } catch { return undefined }
}

const KIND_FORMAT: Record<IgPlanItem['kind'], string> = { post: 'feed', reel: 'reel', story: 'story' }

export type BridgeResult = { ok: true; draftId: string } | { ok: false; error: string }

/**
 * Send one plan item into Post Studio's drafts inbox. Uses the plain-brief
 * coerce path (a single 'hook' slide), not the verbatim docJson channel — a
 * planned IG item isn't a pixel-locked design, it's a brief for the founder
 * to compose on the canvas, same as any Arganta Core draft.
 */
export async function sendToPostStudio(item: IgPlanItem, creator: Creator): Promise<BridgeResult> {
  if (!cloudEnabled) return { ok: false, error: 'Connect Supabase to send drafts.' }

  const briefTag = `[IG plan · ${creator.name} · ${item.day}]`
  const headline = item.caption.slice(0, 60) || `${creator.name} — ${item.kind}`

  const { data, error } = await supabase
    .from('content_draft')
    .insert({
      brief: `${briefTag} ${item.caption.slice(0, 80)}`.trim(),
      status: 'ready',
      copy: {
        slides: [{ template: 'hook', headline, body: item.caption, imageUrl: absMedia(item.media) }],
        caption: item.caption,
        hashtags: item.hashtags,
        brandId: creator.id,
      },
      format: KIND_FORMAT[item.kind],
      platform: 'instagram',
      source: 'ig-simulator',
    })
    .select('id')
    .single()

  if (error) return { ok: false, error: error.message }
  return { ok: true, draftId: data.id as string }
}
