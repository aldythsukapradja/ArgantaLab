// IG Simulator — the phone.
//
// A deliberately faithful Instagram profile: if it doesn't pass the squint
// test it isn't doing its job, because the whole point is seeing the grid the
// way a follower will. The phone interior stays IG-dark in both HQ themes —
// Instagram is dark, and a "light mode Instagram" preview would lie about how
// the cinematic portraits actually read.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Grid3x3, Clapperboard, Play, Pin, Plus, ChevronLeft, X, Heart, MessageCircle, Send as SendIcon, Bookmark } from 'lucide-react'
import type { Creator } from '../influencerData'
import { SLOTS, type IgPlanItem, type IgSlot } from './planStore'

type Tab = 'grid' | 'reels'

const fmt = (n: number) => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'K' : String(n)

/** Deterministic sim-only counters from any string id — stable across renders,
 * never claims to be measured (always rendered behind a SIM chip). */
function simHash(seed: string) {
  let h = 0
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h
}
function simCounts(c: Creator) {
  const h = simHash(c.id)
  return { followers: 8000 + (h % 14000), following: 120 + (h % 380) }
}
function simEngagement(id: string) {
  const h = simHash(id)
  return { likes: 40 + (h % 900), comments: 2 + (h % 60) }
}

function Tile({ item, day, onClick, onOpen, selected }: {
  item?: IgPlanItem; day?: string; onClick?: () => void; onOpen?: () => void; selected?: boolean
}) {
  if (!item) {
    return (
      <button className="igp-tile igp-tile-empty" onClick={onClick} title={day ? `Plan a post for ${day}` : 'Plan a post'}>
        <Plus size={14} />
        {day && <span>{day.slice(5)}</span>}
      </button>
    )
  }
  return (
    <button
      className={'igp-tile' + (selected ? ' sel' : '')}
      onClick={onClick}
      onDoubleClick={onOpen}
      title="Click to edit · double-click to preview"
    >
      {item.media
        ? <img src={item.media} alt="" loading="lazy" />
        : <span className="igp-tile-ph">{item.caption.slice(0, 28) || 'no media'}</span>}
      {item.kind === 'reel' && <Play size={13} className="igp-tile-badge" fill="currentColor" />}
      {item.pinned && <Pin size={12} className="igp-tile-pin" fill="currentColor" />}
      {item.status !== 'idea' && <i className={'igp-tile-dot s-' + item.status} />}
    </button>
  )
}

// ── post/reel overlay — the single-post detail view, tap-to-preview ────────
function PostOverlay({ c, item, onClose }: { c: Creator; item: IgPlanItem; onClose: () => void }) {
  const eng = useMemo(() => simEngagement(item.id), [item.id])
  const isReel = item.kind === 'reel'
  return (
    <div className="igp-post" role="dialog" aria-modal="true" aria-label="Post preview">
      <div className="igp-post-head">
        <img className="igp-story-av" src={c.looks?.normal} alt="" />
        <b>{c.igKit.username}</b>
        {item.pinned && <Pin size={11} className="igp-post-pin" fill="currentColor" />}
        <span className="spacer" />
        <button onClick={onClose} aria-label="Close post"><X size={18} /></button>
      </div>
      <div className={'igp-post-media' + (isReel ? ' reel' : '')}>
        {item.media
          ? <img src={item.media} alt="" />
          : (
            <div className="igp-post-solo">
              <div className="igp-post-solo-text">{item.caption || 'No caption yet.'}</div>
            </div>
          )}
        {isReel && <Play size={40} className="igp-post-playicon" fill="currentColor" />}
      </div>
      <div className="igp-post-actions">
        <Heart size={22} /><MessageCircle size={22} /><SendIcon size={20} />
        <span className="spacer" /><Bookmark size={20} />
      </div>
      <div className="igp-post-body">
        <div className="igp-post-likes">{eng.likes.toLocaleString()} likes <span className="igp-sim">SIM</span></div>
        <div className="igp-post-cap"><b>{c.igKit.username}</b> {item.caption || <em>No caption yet.</em>}</div>
        {item.hashtags && <div className="igp-post-tags">{item.hashtags}</div>}
        <div className="igp-post-meta">{eng.comments} comments · planned for {item.day}{item.pillar ? ` · ${item.pillar}` : ''}</div>
      </div>
    </div>
  )
}

// ── story viewer ─────────────────────────────────────────────────────────
function StoryViewer({ c, frames, onClose }: {
  c: Creator
  frames: { title: string; body: string; media?: string; slot?: IgSlot }[]
  onClose: () => void
}) {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const timer = useRef<number | null>(null)

  // Advance/close read `i` directly rather than closing over a setState updater:
  // calling onClose() inside an updater fires a parent setState during render,
  // which React rejects (and which broke the viewer).
  const next = useCallback(() => {
    if (i + 1 >= frames.length) { onClose(); return }
    setI(i + 1)
  }, [i, frames.length, onClose])
  const prev = useCallback(() => setI(v => Math.max(0, v - 1)), [])

  useEffect(() => {
    if (paused) return
    timer.current = window.setTimeout(next, 4000)
    return () => { if (timer.current) window.clearTimeout(timer.current) }
  }, [i, paused, next])

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') next()
      if (e.key === 'ArrowLeft') prev()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [next, prev, onClose])

  const f = frames[i]
  if (!f) return null
  return (
    <div className="igp-story" onMouseDown={() => setPaused(true)} onMouseUp={() => setPaused(false)}>
      <div className="igp-story-bars">
        {frames.map((_, n) => (
          <div className="igp-story-bar" key={n}>
            <i style={{ width: n < i ? '100%' : n === i ? undefined : '0%' }}
               className={n === i && !paused ? 'run' : ''} />
          </div>
        ))}
      </div>
      <div className="igp-story-head">
        <img className="igp-story-av" src={c.looks?.normal} alt="" />
        <b>{c.igKit.username}</b>
        {f.slot && <span className="igp-story-slot">{f.slot}</span>}
        <span className="spacer" />
        <button onClick={onClose} aria-label="Close story"><X size={16} /></button>
      </div>
      {f.media && <img className="igp-story-media" src={f.media} alt="" />}
      {/* No media yet? Render it as an IG text story rather than a black void —
          a ritual frame is a real, previewable story beat before any asset exists. */}
      <div className={'igp-story-body' + (f.media ? '' : ' solo')}>
        <div className="igp-story-title">{f.title}</div>
        <div className="igp-story-text">{f.body}</div>
      </div>
      <button className="igp-story-nav l" onClick={prev} aria-label="Previous" />
      <button className="igp-story-nav r" onClick={next} aria-label="Next" />
    </div>
  )
}

// ── phone ────────────────────────────────────────────────────────────────
export function IgPhone({ c, items, selId, onSelect, onAdd, day }: {
  c: Creator
  items: IgPlanItem[]
  selId: string | null
  onSelect: (id: string) => void
  onAdd: (kind: 'post' | 'reel') => void
  day: string
}) {
  const [tab, setTab] = useState<Tab>('grid')
  const [story, setStory] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const counts = useMemo(() => simCounts(c), [c])

  // Real IG shows posts AND reels in the main grid; the Reels tab filters.
  const feed = useMemo(() => items
    .filter(i => i.kind !== 'story')
    .sort((a, b) => (Number(b.pinned) - Number(a.pinned)) || b.day.localeCompare(a.day)),
    [items])
  const reels = useMemo(() => feed.filter(i => i.kind === 'reel'), [feed])
  const shown = tab === 'grid' ? feed : reels

  // Switching creators must not leave a stale overlay pointing at another
  // person's item — same class of bug the look-pill reset guards against.
  useEffect(() => { setOpenId(null); setStory(false) }, [c.id])

  const dayStories = useMemo(() => items.filter(i => i.kind === 'story' && i.day === day), [items, day])
  const openItem = useMemo(() => items.find(i => i.id === openId) ?? null, [items, openId])

  /** Story frames: planned items when they exist, otherwise the character's own
   * ritual — so the story rhythm is previewable before a single asset exists. */
  const frames = useMemo(() => {
    if (dayStories.length) {
      const order = (s?: IgSlot) => s ? SLOTS.indexOf(s) : 0
      return [...dayStories].sort((a, b) => order(a.slot) - order(b.slot)).map(s => ({
        title: s.slot ? s.slot.toUpperCase() : 'STORY',
        body: s.caption,
        media: s.media,
        slot: s.slot,
      }))
    }
    return c.rituals.flatMap(r => r.frames.map(f => ({
      title: `${r.name.toUpperCase()} · ${r.theme}`,
      body: `${f.t} — ${f.note}`,
      slot: r.name.toLowerCase() as IgSlot,
    })))
  }, [dayStories, c.rituals])

  return (
    <div className="igp-frame">
      <div className="igp-screen">
        <div className="igp-status"><b>9:41</b><span className="spacer" /><i className="igp-sig" /></div>
        <div className="igp-nav">
          <ChevronLeft size={19} />
          <b>{c.igKit.username}</b>
          <span className="spacer" />
        </div>

        <div className="igp-scroll">
          <div className="igp-head">
            <button className={'igp-av' + (frames.length ? ' ring' : '')} onClick={() => setStory(true)} aria-label="Open stories">
              {c.looks ? <img src={c.looks.normal} alt="" /> : <span>{c.name[0]}</span>}
            </button>
            <div className="igp-stats">
              <div><b>{feed.length}</b><span>posts</span></div>
              <div><b>{fmt(counts.followers)}</b><span>followers</span></div>
              <div><b>{counts.following}</b><span>following</span></div>
            </div>
          </div>
          <div className="igp-bio">
            <b>{c.igKit.displayName}</b>
            <p>{c.igKit.bio}</p>
            <span className="igp-sim">SIM · follower counts are illustrative, not measured</span>
          </div>
          <div className="igp-actions">
            <button className="igp-btn" onClick={() => onAdd('post')}>Plan post</button>
            <button className="igp-btn" onClick={() => onAdd('reel')}>Plan reel</button>
          </div>

          <div className="igp-highs">
            {c.igKit.highlights.map(h => (
              <div className="igp-high" key={h}>
                <div className="igp-high-c">{h[0]}</div>
                <span>{h}</span>
              </div>
            ))}
          </div>

          <div className="igp-tabs">
            <button className={tab === 'grid' ? 'on' : ''} onClick={() => setTab('grid')} aria-label="Grid"><Grid3x3 size={17} /></button>
            <button className={tab === 'reels' ? 'on' : ''} onClick={() => setTab('reels')} aria-label="Reels"><Clapperboard size={17} /></button>
          </div>

          {/* IG only badges pins in the main grid, never inside Reels. */}
          {tab === 'grid' && shown.some(i => i.pinned) && (
            <div className="igp-pinned-head"><Pin size={10} fill="currentColor" /> PINNED</div>
          )}
          <div className={'igp-grid' + (tab === 'reels' ? ' reels' : '')}>
            {shown.map(i => (
              <Tile key={i.id} item={i} selected={i.id === selId} onClick={() => onSelect(i.id)} onOpen={() => setOpenId(i.id)} />
            ))}
            {/* Holes in the grid are the point — plan the gap before followers see it. */}
            {shown.length < 9 && Array.from({ length: 9 - shown.length }).map((_, n) => (
              <Tile key={'e' + n} onClick={() => onAdd(tab === 'reels' ? 'reel' : 'post')} />
            ))}
          </div>
        </div>

        {story && <StoryViewer c={c} frames={frames} onClose={() => setStory(false)} />}
        {openItem && <PostOverlay c={c} item={openItem} onClose={() => setOpenId(null)} />}
      </div>
    </div>
  )
}
