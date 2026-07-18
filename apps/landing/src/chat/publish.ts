// Client seam to the arganta-publish edge function. The Buffer token lives on the
// server; here we only carry the signed-in parent's access token. Publishing is
// always queue-only — the post lands in Buffer for the parent to approve; nothing
// goes live to Instagram from here.
import { supabase, cloudEnabled } from '../lib/supabase'

export interface BufferChannel { id: string; name: string; service: string }

const FN = 'arganta-publish'

async function invoke<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(FN, { body })
  if (error) throw new Error(error.message)
  if (data && (data as any).ok === false) throw new Error((data as any).error || 'Publish failed')
  return data as T
}

export async function getChannels(): Promise<BufferChannel[]> {
  if (!cloudEnabled) return []
  const r = await invoke<{ channels: BufferChannel[] }>({ action: 'channels' })
  return r.channels ?? []
}

/** Upload a rendered PNG to the public arganta-posts bucket; return its public URL. */
export async function uploadPostImage(blob: Blob): Promise<string> {
  const { data: u } = await supabase.auth.getUser()
  const uid = u?.user?.id ?? 'anon'
  const path = `${uid}/${Date.now()}.png`
  const { error } = await supabase.storage.from('arganta-posts').upload(path, blob, { contentType: 'image/png', upsert: true })
  if (error) throw new Error(error.message)
  const { data } = supabase.storage.from('arganta-posts').getPublicUrl(path)
  return data.publicUrl
}

export type PublishMode = 'addToQueue' | 'shareNow'

/** Publish a post to the channel. mode 'shareNow' posts to the live account
 * immediately; 'addToQueue' drops it in Buffer for manual approval. */
export async function publishPost(input: { channelId: string; text: string; imageUrls: string[]; mode: PublishMode }): Promise<{ postId: string }> {
  const r = await invoke<{ postId: string }>({ action: 'publish', ...input })
  return { postId: r.postId }
}
