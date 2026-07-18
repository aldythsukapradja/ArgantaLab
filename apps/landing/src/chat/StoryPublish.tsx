// In-chat review + send. The parent sees the composed image, can edit the
// caption, picks the Instagram channel, and sends it to Buffer — where THEY give
// the final approval. Nothing here posts live; the button says so.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { StoryDraft } from './storyCompose'
import { renderStoryCard } from './storyCompose'
import { getChannels, uploadPostImage, publishPost, type BufferChannel } from './publish'
import { cloudEnabled } from '../lib/supabase'

type Phase = 'review' | 'confirm' | 'sending' | 'posted' | 'error'

// Buffer/Instagram rate-limits the shared token, and every retry within the
// window makes it worse. This cooldown is deliberately shared across every
// StoryPublish instance (localStorage, not component state) so re-asking
// "share this week" in a fresh chat turn can't be used to sneak past it.
const COOLDOWN_KEY = 'arganta_publish_cooldown_until'
const COOLDOWN_MS = 3 * 60 * 1000
function getCooldownRemaining(): number {
  const until = Number(localStorage.getItem(COOLDOWN_KEY) || 0)
  return Math.max(0, until - Date.now())
}
function startCooldown() { try { localStorage.setItem(COOLDOWN_KEY, String(Date.now() + COOLDOWN_MS)) } catch { /* private mode */ } }

export function StoryPublish({ draft }: { draft: StoryDraft }) {
  const [caption, setCaption] = useState(draft.caption + '\n\n' + draft.hashtags)
  const [preview, setPreview] = useState<string | null>(null)
  const [channels, setChannels] = useState<BufferChannel[]>([])
  const [channelId, setChannelId] = useState<string>('')
  const [phase, setPhase] = useState<Phase>('review')
  const [msg, setMsg] = useState('')
  const blobRef = useRef<Blob | null>(null)
  const [cooldown, setCooldown] = useState(getCooldownRemaining)

  // tick the cooldown countdown once a second while it's active
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setInterval(() => setCooldown(getCooldownRemaining()), 1000)
    return () => clearInterval(id)
  }, [cooldown > 0])

  // render the branded image once
  useEffect(() => {
    let url: string | null = null
    renderStoryCard(draft).then(b => { blobRef.current = b; url = URL.createObjectURL(b); setPreview(url) })
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [draft])

  // load the parent's Instagram channels — an error here must be SHOWN, not
  // swallowed: "couldn't reach the worker" and "no channel connected" are very
  // different problems and the parent (and we, debugging) need to know which.
  const [channelErr, setChannelErr] = useState<string | null>(null)
  useEffect(() => {
    if (!cloudEnabled) return
    getChannels().then(cs => {
      setChannels(cs)
      const ig = cs.find(c => c.service?.toLowerCase().includes('instagram')) ?? cs[0]
      if (ig) setChannelId(ig.id)
      setChannelErr(cs.length ? null : 'Buffer reports no connected channels.')
    }).catch(e => setChannelErr((e as Error).message || 'Couldn’t reach the publish service.'))
  }, [])

  const igLabel = useMemo(() => channels.find(c => c.id === channelId)?.name || 'your Instagram', [channels, channelId])

  const publish = async () => {
    if (!blobRef.current || !channelId || cooldown > 0) return
    setPhase('sending'); setMsg('')
    try {
      const url = await uploadPostImage(blobRef.current)
      const { postId } = await publishPost({ channelId, text: caption, imageUrls: [url], mode: 'shareNow' })
      setMsg(postId ? `Posted to ${igLabel}.` : 'Posted.')
      setPhase('posted')
    } catch (e) {
      const raw = (e as Error).message || 'Something went wrong.'
      // Buffer/worker rate-limit: repeated tries make it worse, so start a real
      // cooldown (shared across attempts) instead of just apologizing.
      const rateLimited = /too many requests|rate limit|429/i.test(raw)
      if (rateLimited) { startCooldown(); setCooldown(getCooldownRemaining()) }
      setMsg(rateLimited ? 'Instagram is rate-limiting posts right now. I’ve paused the button for a few minutes so it doesn’t make things worse — it’ll unlock automatically.' : raw)
      setPhase('error')
    }
  }

  const cooldownLabel = cooldown > 0 ? `Try again in ${Math.ceil(cooldown / 1000 / 60)} min` : null

  return (
    <div className="ac-assistant">
      <div className="ac-answer-lead"><p>Here's a little post from this week — have a look, tweak the words, and when it's right you can publish it straight to Instagram.</p></div>
      <div className="ac-acard ac-publish">
        {preview
          ? <img className="ac-publish-img" src={preview} alt="Your story preview" />
          : <div className="ac-publish-img ac-publish-img--load">rendering…</div>}

        <label className="ac-publish-label">Caption</label>
        <textarea className="ac-publish-caption" value={caption} onChange={e => setCaption(e.target.value)} rows={5} disabled={phase === 'sending' || phase === 'posted'} />

        {channels.length > 1 && (phase === 'review' || phase === 'confirm') && (
          <select className="ac-publish-select" value={channelId} onChange={e => setChannelId(e.target.value)}>
            {channels.map(c => <option key={c.id} value={c.id}>{c.name} · {c.service}</option>)}
          </select>
        )}

        {phase === 'posted' ? (
          <div className="ac-publish-done">✓ {msg} It's live now.</div>
        ) : phase === 'confirm' ? (
          <>
            <div className="ac-publish-confirm">This posts to <b>{igLabel}</b> right now, for real. Ready?</div>
            <div className="ac-publish-row">
              <button className="ac-publish-send" onClick={publish} disabled={phase !== 'confirm' || cooldown > 0}>{cooldownLabel || 'Yes, post it now'}</button>
              <button className="ac-publish-cancel" onClick={() => setPhase('review')}>Back</button>
            </div>
          </>
        ) : (
          <>
            <button className="ac-publish-send" onClick={() => setPhase('confirm')} disabled={phase === 'sending' || !channelId || !cloudEnabled || cooldown > 0}>
              {phase === 'sending' ? 'Posting…' : cooldownLabel || 'Publish to Instagram now'}
            </button>
            {!cloudEnabled && <div className="ac-publish-note">Publishing isn't connected in this preview.</div>}
            {!channelId && cloudEnabled && <div className="ac-publish-err">{channelErr || 'No Instagram channel connected yet.'}</div>}
            {phase === 'error' && <div className="ac-publish-err">{msg}</div>}
            <div className="ac-publish-fineprint">Publishes straight to your connected Instagram. You confirm once before it goes.</div>
          </>
        )}
      </div>
    </div>
  )
}
