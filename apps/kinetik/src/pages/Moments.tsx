import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useDataStore } from '@store/dataStore'
import { useUiStore } from '@store/uiStore'
import { initials } from '@data/energy'
import * as M from '@repo/momentsRepo'
import { fetchFamily, type FamilyMember } from '@repo/kinetikRepo'
import { IconHeart, IconComment, IconDiamond, IconPlus, IconPhoto, IconChevron, IconCheck } from '@components/Icons'

type Sub = 'feed' | 'grid' | 'videos' | 'albums' | 'milestones'
const SUBS: { key: Sub; label: string }[] = [
  { key: 'feed', label: 'Feed' }, { key: 'grid', label: 'Moments' }, { key: 'videos', label: 'Videos' },
  { key: 'albums', label: 'Albums' }, { key: 'milestones', label: 'Milestones' },
]
const REACTIONS = ['❤️', '🏆', '😂', '😍', '👏', '🔥']

function timeAgo(iso: string): string {
  const t = new Date(iso)
  const s = (Date.now() - t.getTime()) / 1000
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  const d = Math.floor(s / 86400)
  if (d === 1) return 'yesterday'
  if (d < 7) return `${d}d`
  if (d < 35) return `${Math.floor(d / 7)}w`
  // older than ~a month → an actual calendar date
  const now = new Date()
  return t.toLocaleDateString('en-US', t.getFullYear() === now.getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' })
}
function errMsg(e: unknown): string {
  if (e instanceof Error) return e.message
  if (e && typeof e === 'object') { const o = e as any; return o.message || o.details || JSON.stringify(o) }
  return String(e)
}

// Image with a glass-shimmer skeleton that fades in once fully decoded — so you
// never see the top-to-bottom paint. Fills its (positioned) parent box.
function SmartImg({ src, alt = '', cover = true }: { src?: string; alt?: string; cover?: boolean }) {
  const [loaded, setLoaded] = useState(false)
  return (
    <span className="smimg">
      {!loaded && <span className="smimg-shim" />}
      {src && <img src={src} alt={alt} loading="lazy" decoding="async" referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)} className={`smimg-img${loaded ? ' on' : ''}`} style={{ objectFit: cover ? 'cover' : 'contain' }} />}
    </span>
  )
}

export default function Moments() {
  const circles = useDataStore(s => s.circles)
  const me = useDataStore(s => s.me)
  const activeCircleId = useUiStore(s => s.activeCircleId)
  const circle = circles.find(c => c.id === activeCircleId) ?? circles[0]

  const [sub, setSub] = useState<Sub>('feed')
  const [feed, setFeed] = useState<M.MPost[] | null>(null)
  const [stories, setStories] = useState<M.MStoryGroup[]>([])
  const [albums, setAlbums] = useState<M.MAlbum[] | null>(null)
  const [milestones, setMilestones] = useState<M.MMilestone[] | null>(null)
  const [family, setFamily] = useState<FamilyMember[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [openPost, setOpenPost] = useState<M.MPost | null>(null)
  const [storyAt, setStoryAt] = useState<number | null>(null)
  const [reelsAt, setReelsAt] = useState<number | null>(null)
  const [albumOpen, setAlbumOpen] = useState<M.MAlbum | null>(null)
  const [albumStoryFor, setAlbumStoryFor] = useState<M.MAlbum | null>(null)
  const [albumPickFor, setAlbumPickFor] = useState<M.MPost | null>(null)
  const [creatingAlbum, setCreatingAlbum] = useState(false)
  const [creatingMilestone, setCreatingMilestone] = useState(false)
  const [editDateFor, setEditDateFor] = useState<M.MPost | null>(null)
  const [editCaptionFor, setEditCaptionFor] = useState<M.MPost | null>(null)
  const [editMsFor, setEditMsFor] = useState<M.MMilestone | null>(null)
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const pullRef = useRef(0)

  const nameOf = (id: string) => family.find(f => f.id === id)?.name ?? 'Member'

  const loadFeed = () => {
    if (!circle) return
    setFeed(null); setErr(null)
    M.fetchFeed(circle.id).then(setFeed).catch(e => { setFeed([]); setErr(errMsg(e)) })
    M.fetchStories(circle.id).then(setStories).catch(() => setStories([]))
  }
  useEffect(loadFeed, [circle?.id])
  useEffect(() => { if (circle) fetchFamily(circle.id, me).then(setFamily).catch(() => {}) }, [circle?.id, me?.id])
  useEffect(() => { if (circle) M.fetchAlbums(circle.id).then(setAlbums).catch(() => setAlbums([])) }, [circle?.id])
  useEffect(() => { if (circle) M.fetchMilestones(circle.id).then(setMilestones).catch(() => setMilestones([])) }, [circle?.id])

  if (!circle) return <div className="fade-in"><p className="me-foot">No circle loaded yet.</p></div>

  const react = async (post: M.MPost, emoji: string) => {
    const next = post.myReaction === emoji ? null : emoji
    setFeed(f => f && f.map(p => p.id === post.id ? applyReaction(p, next) : p))
    try { await M.toggleReaction(post.id, next) } catch { loadFeed() }
  }
  const reward = async (post: M.MPost, amount: number) => {
    try {
      const total = await M.rewardMoment(post.id, amount)
      setFeed(f => f && f.map(p => p.id === post.id ? { ...p, rewardTotal: p.rewardTotal + total } : p))
    } catch (e) { setErr(errMsg(e)) }
  }
  const del = async (post: M.MPost) => {
    if (!window.confirm('Delete this moment? This can’t be undone.')) return
    setFeed(f => f && f.filter(p => p.id !== post.id))
    try { await M.deletePost(post.id) } catch (e) { setErr(errMsg(e)); loadFeed() }
  }
  const reloadAlbums = () => { if (circle) M.fetchAlbums(circle.id).then(setAlbums).catch(() => {}) }
  const reloadMilestones = () => { if (circle) M.fetchMilestones(circle.id).then(setMilestones).catch(() => {}) }
  const refreshAll = async () => {
    if (!circle) return
    await Promise.all([
      M.fetchFeed(circle.id).then(setFeed).catch(() => {}),
      M.fetchStories(circle.id).then(setStories).catch(() => {}),
      M.fetchAlbums(circle.id).then(setAlbums).catch(() => {}),
      M.fetchMilestones(circle.id).then(setMilestones).catch(() => {}),
    ])
  }
  // pull-to-refresh on the scroll container
  useEffect(() => {
    const main = rootRef.current?.closest('.main') as HTMLElement | null
    if (!main) return
    let startY = 0, pulling = false
    const ts = (e: TouchEvent) => { if (main.scrollTop <= 0) { startY = e.touches[0].clientY; pulling = true } }
    const tm = (e: TouchEvent) => {
      if (!pulling) return
      const dy = e.touches[0].clientY - startY
      if (dy > 0 && main.scrollTop <= 0) { pullRef.current = Math.min(dy * 0.5, 80); setPull(pullRef.current) }
      else { pulling = false; pullRef.current = 0; setPull(0) }
    }
    const te = async () => {
      const did = pullRef.current > 56; pulling = false; pullRef.current = 0; setPull(0)
      if (did) { setRefreshing(true); await refreshAll(); setRefreshing(false) }
    }
    main.addEventListener('touchstart', ts, { passive: true })
    main.addEventListener('touchmove', tm, { passive: true })
    main.addEventListener('touchend', te)
    return () => { main.removeEventListener('touchstart', ts); main.removeEventListener('touchmove', tm); main.removeEventListener('touchend', te) }
  }, [circle?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const videos = (feed ?? []).filter(p => p.kind === 'video')

  return (
    <div className="fade-in mom2" ref={rootRef} style={{ ['--c0' as any]: circle.accent[0], ['--c1' as any]: circle.accent[1], transform: pull ? `translateY(${pull}px)` : undefined }}>
      {(pull > 0 || refreshing) && (
        <div className="mom2-pull" style={{ height: refreshing ? 40 : pull, opacity: refreshing ? 1 : Math.min(pull / 56, 1) }}>
          <span className={`mom2-pull-spin${refreshing ? ' on' : ''}`} />
        </div>
      )}
      {/* header */}
      <div className="mom2-head">
        <h1>Moments</h1>
        <button className="mom2-add" onClick={() => setCreating(true)} aria-label="New moment"><IconPlus width={20} height={20} /></button>
      </div>

      {/* sub-tabs */}
      <div className="mom2-tabs">
        {SUBS.map(s => (
          <button key={s.key} className={`mom2-tab${sub === s.key ? ' on' : ''}`} onClick={() => setSub(s.key)}>{s.label}</button>
        ))}
      </div>

      {err && <div className="me3-error">{err}</div>}

      {/* FEED */}
      {sub === 'feed' && (
        <div className="mom2-feedwrap">
          <div className="mom2-feedmain">
            <StoriesRail stories={stories} albums={albums ?? []} onAdd={() => setCreating(true)} onOpen={i => setStoryAt(i)} onOpenAlbum={a => setAlbumStoryFor(a)} />
            {feed === null && <div className="mom2-empty">Loading…</div>}
            {feed && feed.length === 0 && <EmptyState onCreate={() => setCreating(true)} />}
            {feed && feed.map(p => (
              <PostCard key={p.id} post={p} meId={me?.id} nameOf={nameOf} onReact={react} onReward={reward} onComments={() => setOpenPost(p)} onDelete={() => del(p)} onAddToAlbum={() => setAlbumPickFor(p)} onEditDate={() => setEditDateFor(p)} onEditCaption={() => setEditCaptionFor(p)} />
            ))}
          </div>
          <aside className="mom2-rail">
            {(albums ?? []).length > 0 && <>
              <div className="mom2-rail-title">Albums</div>
              <div className="mom2-rail-albums">
                {(albums ?? []).slice(0, 4).map(a => (
                  <button key={a.id} className="mom2-rail-album" onClick={() => setAlbumStoryFor(a)}>
                    <span className="mom2-rail-cover">{a.coverUrl ? <img src={a.coverUrl} alt="" /> : <IconPhoto width={20} height={20} />}</span>
                    <small>{a.title}</small>
                  </button>
                ))}
              </div>
            </>}
            {(milestones ?? []).length > 0 && <>
              <div className="mom2-rail-title">Recent milestones</div>
              <div className="mom2-rail-ms">
                {(milestones ?? []).slice(0, 5).map(ms => (
                  <button key={ms.id} className="mom2-rail-msrow" onClick={() => setEditMsFor(ms)}>
                    <span className="mom2-rail-dot" style={{ background: ms.kind === 'learn' ? 'var(--memory)' : 'var(--c0)' }} />
                    <span className="mom2-rail-msinfo"><b>{ms.title}</b><small>{[ms.kid?.name, timeAgo(ms.createdAt)].filter(Boolean).join(' · ')}</small></span>
                  </button>
                ))}
              </div>
            </>}
          </aside>
        </div>
      )}

      {/* MOMENTS GRID */}
      {sub === 'grid' && <Grid posts={feed ?? []} onOpen={p => setOpenPost(p)} />}

      {/* VIDEOS */}
      {sub === 'videos' && (videos.length ? <Grid posts={videos} onOpen={p => setReelsAt(videos.findIndex(v => v.id === p.id))} /> : <SoftEmpty label="No videos yet" />)}

      {/* ALBUMS */}
      {sub === 'albums' && <AlbumsGrid albums={albums} onOpen={a => setAlbumOpen(a)} onNew={() => setCreatingAlbum(true)} />}

      {/* MILESTONES */}
      {sub === 'milestones' && (
        <>
          <button className="mom2-newrow" onClick={() => setCreatingMilestone(true)}><IconPlus width={16} height={16} /> Add milestone</button>
          <MilestonesTimeline items={milestones} albums={albums ?? []} onOpenAlbum={a => setAlbumOpen(a)} onEditMs={ms => setEditMsFor(ms)} />
        </>
      )}

      {creating && <CreateSheet circle={circle} me={me} family={family} accent={circle.accent} onClose={() => setCreating(false)} onPosted={() => { setCreating(false); setSub('feed'); loadFeed() }} />}
      {openPost && <PostDetail post={openPost} meId={me?.id} accent={circle.accent}
        onClose={() => { setOpenPost(null); loadFeed() }}
        onReact={react} onReward={reward}
        onDelete={() => { setOpenPost(null); del(openPost) }}
        onEditCaption={() => { setOpenPost(null); setEditCaptionFor(openPost) }}
        onEditDate={() => { setOpenPost(null); setEditDateFor(openPost) }}
        onAddToAlbum={() => { setOpenPost(null); setAlbumPickFor(openPost) }} />}
      {storyAt !== null && stories[storyAt] && <StoryViewer groups={stories} start={storyAt} onClose={() => setStoryAt(null)} />}
      {reelsAt !== null && videos[reelsAt] && <ReelsPlayer posts={videos} start={reelsAt} onClose={() => setReelsAt(null)} onReact={react} onReward={reward} onComments={p => setOpenPost(p)} />}
      {albumOpen && <AlbumDetail album={albumOpen} onClose={() => setAlbumOpen(null)} onChanged={reloadAlbums} />}
      {albumStoryFor && <AlbumStory album={albumStoryFor} onClose={() => setAlbumStoryFor(null)} />}
      {creatingAlbum && <NewAlbumSheet circleId={circle.id} accent={circle.accent} onClose={() => setCreatingAlbum(false)} onCreated={() => { setCreatingAlbum(false); reloadAlbums() }} />}
      {albumPickFor && <AddToAlbumSheet circleId={circle.id} post={albumPickFor} accent={circle.accent} onClose={() => setAlbumPickFor(null)} onDone={() => { setAlbumPickFor(null); reloadAlbums() }} />}
      {creatingMilestone && <AddMilestoneSheet circleId={circle.id} kids={family.filter(f => f.kind === 'child')} accent={circle.accent} onClose={() => setCreatingMilestone(false)} onCreated={() => { setCreatingMilestone(false); reloadMilestones() }} />}
      {editDateFor && <EditDateSheet post={editDateFor} accent={circle.accent} onClose={() => setEditDateFor(null)} onSaved={() => { setEditDateFor(null); loadFeed() }} />}
      {editCaptionFor && <EditCaptionSheet post={editCaptionFor} accent={circle.accent} onClose={() => setEditCaptionFor(null)} onSaved={() => { setEditCaptionFor(null); loadFeed() }} />}
      {editMsFor && <EditMilestoneSheet ms={editMsFor} kids={family.filter(f => f.kind === 'child')} accent={circle.accent} onClose={() => setEditMsFor(null)} onSaved={() => { setEditMsFor(null); reloadMilestones() }} />}
    </div>
  )
}

function applyReaction(p: M.MPost, next: string | null): M.MPost {
  const reactions = { ...p.reactions }
  if (p.myReaction) reactions[p.myReaction] = Math.max((reactions[p.myReaction] ?? 1) - 1, 0)
  if (next) reactions[next] = (reactions[next] ?? 0) + 1
  const count = p.reactionCount + (next ? 1 : 0) - (p.myReaction ? 1 : 0)
  return { ...p, reactions, myReaction: next, reactionCount: Math.max(count, 0) }
}

// ── stories rail ──
function StoriesRail({ stories, albums, onAdd, onOpen, onOpenAlbum }: { stories: M.MStoryGroup[]; albums: M.MAlbum[]; onAdd: () => void; onOpen: (i: number) => void; onOpenAlbum: (a: M.MAlbum) => void }) {
  return (
    <div className="mom2-stories">
      <button className="mom2-story" onClick={onAdd}>
        <span className="mom2-story-av add"><IconPlus width={18} height={18} /></span>
        <small>Add</small>
      </button>
      {stories.map((g, i) => (
        <button className="mom2-story" key={g.author.id} onClick={() => onOpen(i)}>
          <span className={`mom2-story-av${g.seen ? ' seen' : ''}`}>
            <span className="mom2-story-pic">
              {g.author.photo ? <SmartImg src={g.author.photo} /> : <span className="mom2-story-fb">{initials(g.author.name)}</span>}
            </span>
          </span>
          <small>{g.author.name.split(' ')[0]}</small>
        </button>
      ))}
      {albums.map(a => (
        <button className="mom2-story" key={a.id} onClick={() => onOpenAlbum(a)}>
          <span className="mom2-story-av album">
            <span className="mom2-story-pic">
              {a.coverUrl ? <SmartImg src={a.coverUrl} /> : <span className="mom2-story-fb"><IconPhoto width={18} height={18} /></span>}
            </span>
          </span>
          <small>{a.title}</small>
        </button>
      ))}
    </div>
  )
}

// ── post card ──
function PostCard({ post, meId, nameOf, onReact, onReward, onComments, onDelete, onAddToAlbum, onEditDate, onEditCaption }: {
  post: M.MPost; meId?: string; nameOf: (id: string) => string
  onReact: (p: M.MPost, e: string) => void; onReward: (p: M.MPost, n: number) => void; onComments: () => void
  onDelete: () => void; onAddToAlbum: () => void; onEditDate: () => void; onEditCaption: () => void
}) {
  const [showReacts, setShowReacts] = useState(false)
  const [rewardOpen, setRewardOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [amt, setAmt] = useState(10)
  const [mediaIdx, setMediaIdx] = useState(0)
  const carRef = useRef<HTMLDivElement | null>(null)
  const onCarScroll = () => { const el = carRef.current; if (el) setMediaIdx(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1))) }
  const clusters = Object.entries(post.reactions).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  const mine = meId === post.author.id
  return (
    <div className="mom2-card">
      <div className="mom2-card-head">
        {post.author.photo ? <img className="mom2-av" src={post.author.photo} alt="" referrerPolicy="no-referrer" />
          : <span className="mom2-av mom2-av-fb">{initials(post.author.name)}</span>}
        <div className="mom2-id">
          <b>{post.author.name}{post.author.role === 'kid' && <span className="mom2-kid">kid</span>}</b>
          <small>{post.tags.length ? `with ${post.tags.map(nameOf).map(n => '@' + n.split(' ')[0]).join(' ')} · ` : ''}{timeAgo(post.createdAt)}</small>
        </div>
        <span className="mom2-aud">{post.audience === 'grownups' ? 'Grown-ups' : post.audience === 'custom' ? 'Custom' : 'Whole circle'}</span>
        <div className="mom2-menu-wrap">
          <button className="mom2-kebab" onClick={() => setMenuOpen(v => !v)} aria-label="More">⋯</button>
          {menuOpen && (
            <>
              <div className="mom2-menu-scrim" onClick={() => setMenuOpen(false)} />
              <div className="mom2-menu">
                <button onClick={() => { setMenuOpen(false); onEditCaption() }}>Edit caption</button>
                <button onClick={() => { setMenuOpen(false); onEditDate() }}>Edit date</button>
                <button onClick={() => { setMenuOpen(false); onAddToAlbum() }}>Add to album</button>
                <button className="danger" onClick={() => { setMenuOpen(false); onDelete() }}>Delete{mine ? '' : ' (owner)'}</button>
              </div>
            </>
          )}
        </div>
      </div>

      {post.media.length > 0 && (
        <div className="mom2-media-wrap">
          <div className="mom2-carousel" ref={carRef} onScroll={onCarScroll}>
            {post.media.map((m, i) => (
              <div key={i} className="mom2-slide">
                {m.kind === 'video' ? <video className="mom2-media-el" src={m.url} controls playsInline />
                  : m.url ? <SmartImg src={m.url} /> : <span className="mom2-media-ph2"><IconPhoto width={30} height={30} /></span>}
              </div>
            ))}
          </div>
          {post.media.length > 1 && <span className="mom2-count">{mediaIdx + 1}/{post.media.length}</span>}
          {post.media.length > 1 && <div className="mom2-dots">{post.media.map((_, i) => <span key={i} className={`mom2-dot${i === mediaIdx ? ' on' : ''}`} />)}</div>}
        </div>
      )}

      <div className="mom2-body">
        <div className="mom2-acts">
          <button className={`mom2-act${post.myReaction ? ' on' : ''}`} onClick={() => setShowReacts(v => !v)}>
            <IconHeart width={19} height={19} /> {post.reactionCount || ''}
          </button>
          <button className="mom2-act" onClick={onComments}><IconComment width={19} height={19} /> {post.commentCount || ''}</button>
          <button className="mom2-act reward" onClick={() => setRewardOpen(v => !v)}>
            <IconDiamond width={17} height={17} /> {post.rewardTotal ? `+${post.rewardTotal}` : 'Reward'}
          </button>
        </div>

        {showReacts && (
          <div className="mom2-react-row">
            {REACTIONS.map(e => <button key={e} className={`mom2-emoji${post.myReaction === e ? ' on' : ''}`} onClick={() => { onReact(post, e); setShowReacts(false) }}>{e}</button>)}
          </div>
        )}
        {rewardOpen && (
          <div className="mom2-reward-row">
            {post.tags.length === 0 ? <span className="mom2-reward-hint">Tag someone to reward.</span> : <>
              <button className="mom2-step" onClick={() => setAmt(a => Math.max(1, a - 5))}>−</button>
              <b>{amt} 💎 each</b>
              <button className="mom2-step" onClick={() => setAmt(a => a + 5)}>+</button>
              <button className="mom2-reward-go" onClick={() => { onReward(post, amt); setRewardOpen(false) }}>Send</button>
            </>}
          </div>
        )}

        {clusters.length > 0 && (
          <div className="mom2-cluster">
            {clusters.slice(0, 4).map(([e, n]) => <span key={e} className="mom2-chip">{e} {n}</span>)}
            {post.reactors.length > 0 && <span className="mom2-reactors">{post.reactors.map(r => r.name.split(' ')[0]).join(', ')}{post.reactionCount > post.reactors.length ? ` and ${post.reactionCount - post.reactors.length} others` : ''}</span>}
          </div>
        )}
        {post.body && <div className="mom2-caption"><b>{post.author.name.split(' ')[0]}</b> {post.body}</div>}
        {post.commentCount > 0 && <button className="mom2-viewcom" onClick={onComments}>View all {post.commentCount} comments</button>}
      </div>
    </div>
  )
}

function Grid({ posts, onOpen }: { posts: M.MPost[]; onOpen: (p: M.MPost) => void }) {
  if (!posts.length) return <SoftEmpty label="Nothing here yet" />
  return (
    <div className="mom2-grid">
      {posts.map(p => (
        <button key={p.id} className="mom2-cell" onClick={() => onOpen(p)}>
          {p.media[0]?.url
            ? (p.media[0].kind === 'video' ? <video src={p.media[0].url} muted playsInline preload="metadata" /> : <SmartImg src={p.media[0].url} />)
            : <span className="mom2-cell-ph"><IconPhoto width={22} height={22} /></span>}
          {p.media.length > 1 && <span className="mom2-cell-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 3h11a2 2 0 0 1 2 2v11h-2V5H8V3zM5 7h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/></svg></span>}
          {p.media[0]?.kind === 'video' && p.media.length === 1 && <span className="mom2-cell-badge">▶</span>}
        </button>
      ))}
    </div>
  )
}

function AlbumsGrid({ albums, onOpen, onNew }: { albums: M.MAlbum[] | null; onOpen: (a: M.MAlbum) => void; onNew: () => void }) {
  if (albums === null) return <div className="mom2-empty">Loading…</div>
  return (
    <div className="mom2-albums">
      <button className="mom2-album mom2-album-new" onClick={onNew}>
        <div className="mom2-album-cover dashed"><IconPlus width={24} height={24} /></div>
        <b>New album</b><small>Group moments</small>
      </button>
      {albums.map(a => (
        <button className="mom2-album" key={a.id} onClick={() => onOpen(a)}>
          <div className="mom2-album-cover">{a.coverUrl ? <SmartImg src={a.coverUrl} /> : <IconPhoto width={26} height={26} />}</div>
          <b>{a.title}</b><small>{a.count} moment{a.count === 1 ? '' : 's'}</small>
        </button>
      ))}
    </div>
  )
}

function MilestonesTimeline({ items, albums, onOpenAlbum, onEditMs }: { items: M.MMilestone[] | null; albums: M.MAlbum[]; onOpenAlbum: (a: M.MAlbum) => void; onEditMs: (ms: M.MMilestone) => void }) {
  if (items === null) return <div className="mom2-empty">Loading…</div>
  // Albums auto-feed the timeline; both sorted together by date (newest first).
  const merged = [
    ...items.map(ms => ({ t: 'ms' as const, date: ms.createdAt, ms })),
    ...albums.map(al => ({ t: 'al' as const, date: al.createdAt, al })),
  ].sort((x, y) => +new Date(y.date) - +new Date(x.date))
  if (!merged.length) return <SoftEmpty label="No milestones yet" />
  const nowYear = new Date().getFullYear()
  const DateChip = ({ iso }: { iso: string }) => {
    const d = new Date(iso)
    return (
      <span className="mom2-tl-date">
        <span className="mom2-tl-day">{d.getDate()}</span>
        <span className="mom2-tl-mon">{d.toLocaleDateString(undefined, { month: 'short' })}</span>
        {d.getFullYear() !== nowYear && <span className="mom2-tl-yr">{d.getFullYear()}</span>}
      </span>
    )
  }
  return (
    <div className="mom2-tl">
      {/* "now" cap — the timeline flows from today down into the past */}
      <div className="mom2-tl-now">
        <span className="mom2-tl-now-lbl">Today</span>
        <span className="mom2-tl-now-node" />
        <span className="mom2-tl-now-line"><span className="mom2-tl-now-pill">Now</span></span>
      </div>

      {merged.map(e => e.t === 'al' ? (
        <div className="mom2-tl-row" key={'al' + e.al.id}>
          <DateChip iso={e.al.createdAt} />
          <span className="mom2-tl-node" style={{ ['--nc' as any]: 'var(--c0)' }}><IconPhoto width={13} height={13} /></span>
          <button className="mom2-tl-card mom2-tl-album" onClick={() => onOpenAlbum(e.al)}>
            <span className="mom2-tl-hero">
              {e.al.coverUrl ? <SmartImg src={e.al.coverUrl} /> : <span className="mom2-tl-hero-fb"><IconPhoto width={26} height={26} /></span>}
              <span className="mom2-tl-hero-grad" />
              <span className="mom2-tl-hero-cap"><b>{e.al.title}</b><small>{e.al.count} moment{e.al.count === 1 ? '' : 's'}</small></span>
              <span className="mom2-tl-hero-go"><IconChevron width={15} height={15} /></span>
            </span>
          </button>
        </div>
      ) : (
        <div className="mom2-tl-row" key={'ms' + e.ms.id}>
          <DateChip iso={e.ms.createdAt} />
          <span className="mom2-tl-node" style={{ ['--nc' as any]: e.ms.kind === 'learn' ? 'var(--memory)' : 'var(--c0)' }}><IconCheck width={14} height={14} /></span>
          <button className="mom2-tl-card" onClick={() => onEditMs(e.ms)}>
            <span className="mom2-tl-head">
              <span className="mom2-tl-title">{e.ms.title}</span>
              {e.ms.diamonds > 0 && <span className="mom2-tl-dia"><IconDiamond width={12} height={12} /> +{e.ms.diamonds}</span>}
            </span>
            <span className="mom2-tl-meta">{[e.ms.kid?.name ?? (e.ms.ref ?? ''), e.ms.author ? `by ${e.ms.author.name.split(' ')[0]}` : ''].filter(Boolean).join(' · ') || 'Milestone'}</span>
            {e.ms.body && <p className="mom2-tl-body">{e.ms.body}</p>}
            {e.ms.mediaUrl && <span className="mom2-tl-media"><SmartImg src={e.ms.mediaUrl} /></span>}
          </button>
        </div>
      ))}
    </div>
  )
}

// ── create sheet ──
function CreateSheet({ circle, me, family, accent, onClose, onPosted }: {
  circle: { id: string; name: string }; me: { id: string; name: string } | null
  family: FamilyMember[]; accent: [string, string]; onClose: () => void; onPosted: () => void
}) {
  const [files, setFiles] = useState<M.NewMedia[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [body, setBody] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [audience, setAudience] = useState<'circle' | 'grownups' | 'custom'>('circle')
  const [rewardOn, setRewardOn] = useState(false)
  const [amt, setAmt] = useState(15)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const taggable = family.filter(f => f.id !== me?.id && f.name && f.name !== 'Member')

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = [...files.map(f => f.file), ...Array.from(e.target.files ?? [])].slice(0, 10)
    const next = picked.map(f => ({ file: f, kind: M.kindOf(f) }))
    setFiles(next); setPreviews(picked.map(f => URL.createObjectURL(f)))
    if (fileRef.current) fileRef.current.value = '' // allow re-picking the same file
  }
  const toggleTag = (id: string) => setTags(t => t.includes(id) ? t.filter(x => x !== id) : [...t, id])

  const share = async () => {
    setBusy(true); setErr(null)
    try {
      const kind = files[0]?.kind === 'video' ? 'video' : files.length ? 'photo' : 'text'
      const id = await M.postMoment({ circleId: circle.id, kind, body, audience, audienceIds: audience === 'custom' ? tags : [], media: files, tags })
      if (rewardOn && tags.length) await M.rewardMoment(id, amt).catch(() => {})
      onPosted()
    } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }

  return (
    <Sheet title="New moment" accent={accent} onClose={onClose} action={<button className="mom2-share" disabled={busy || (!files.length && !body.trim())} onClick={share}>{busy ? 'Sharing…' : 'Share'}</button>}>
      <input ref={fileRef} type="file" accept="image/*,video/*" multiple hidden onChange={onPick} />
      <button className="mom2-picker" onClick={() => fileRef.current?.click()}>
        {previews[0] ? (files[0].kind === 'video' ? <video src={previews[0]} className="mom2-picker-media" /> : <img src={previews[0]} className="mom2-picker-media" alt="" />)
          : <span className="mom2-picker-empty"><IconPhoto width={30} height={30} /><span>Photo · Video · Upload</span></span>}
      </button>
      {previews.length > 1 && <div className="mom2-strip">{previews.map((p, i) => <img key={i} src={p} alt="" />)}</div>}

      <textarea className="field mom2-cap" placeholder={`Share a moment with ${circle.name}…`} value={body} onChange={e => setBody(e.target.value)} rows={2} />

      <div className="sheet-lbl">Tag</div>
      <div className="mom2-tagrow">
        {taggable.length === 0 && <span className="mom2-reward-hint">No members to tag yet.</span>}
        {taggable.map(f => (
          <button key={f.id} className={`mom2-tagchip${tags.includes(f.id) ? ' on' : ''}`} onClick={() => toggleTag(f.id)}>
            <span className="mom2-tagav" style={{ background: f.color || 'var(--grad)' }}>{f.emoji || initials(f.name)}</span>{f.name.split(' ')[0]}
          </button>
        ))}
      </div>

      <div className="sheet-lbl">Who can see this</div>
      <div className="mom2-aud-seg">
        {(['circle', 'grownups', 'custom'] as const).map(a => (
          <button key={a} className={`mom2-aud-btn${audience === a ? ' on' : ''}`} onClick={() => setAudience(a)}>{a === 'circle' ? 'Whole circle' : a === 'grownups' ? 'Grown-ups' : 'Custom'}</button>
        ))}
      </div>

      <button className={`mom2-reward-card${rewardOn ? ' on' : ''}`} onClick={() => setRewardOn(v => !v)}>
        <span className="mom2-reward-ic"><IconDiamond width={17} height={17} /></span>
        <div className="mom2-reward-txt"><b>Reward this moment</b><small>Send diamonds to those tagged</small></div>
        {rewardOn ? (
          <span className="mom2-reward-stepper" onClick={e => e.stopPropagation()}>
            <button onClick={() => setAmt(a => Math.max(1, a - 5))}>−</button><b>{amt}</b><button onClick={() => setAmt(a => a + 5)}>+</button>
          </span>
        ) : <span className="mom2-toggle" />}
      </button>

      {err && <div className="me3-error">{err}</div>}
    </Sheet>
  )
}

// ── unified post-detail (full-screen on mobile, split modal on desktop) ──
function PostDetail({ post, meId, accent, onClose, onReact, onReward, onDelete, onEditCaption, onEditDate, onAddToAlbum }: {
  post: M.MPost; meId?: string; accent: [string, string]; onClose: () => void
  onReact: (p: M.MPost, e: string) => void; onReward: (p: M.MPost, n: number) => void
  onDelete: () => void; onEditCaption: () => void; onEditDate: () => void; onAddToAlbum: () => void
}) {
  const [p, setP] = useState(post)
  const [list, setList] = useState<M.MComment[] | null>(null)
  const [text, setText] = useState('')
  const [showReacts, setShowReacts] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [mediaIdx, setMediaIdx] = useState(0)
  const [amt, setAmt] = useState(10)
  const [rewardOpen, setRewardOpen] = useState(false)
  const carRef = useRef<HTMLDivElement | null>(null)
  const onCarScroll = () => { const el = carRef.current; if (el) setMediaIdx(Math.round(el.scrollLeft / Math.max(el.clientWidth, 1))) }
  useEffect(() => { M.fetchComments(p.id).then(setList).catch(() => setList([])) }, [p.id])
  const react = (emoji: string) => { const next = p.myReaction === emoji ? null : emoji; setP(applyReaction(p, next)); onReact(post, emoji); setShowReacts(false) }
  const send = async () => {
    if (!text.trim()) return
    const body = text.trim(); setText('')
    setP(x => ({ ...x, commentCount: x.commentCount + 1 }))
    try { await M.addComment(p.id, body); setList(await M.fetchComments(p.id)) } catch { /* ignore */ }
  }
  const delC = async (id: string) => {
    setList(l => l && l.filter(c => c.id !== id)); setP(x => ({ ...x, commentCount: Math.max(x.commentCount - 1, 0) }))
    try { await M.deleteComment(id) } catch { setList(await M.fetchComments(p.id)) }
  }
  const clusters = Object.entries(p.reactions).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1])
  return createPortal(
    <div className="mpd-scrim" onClick={onClose}>
      <div className="mpd" style={{ ['--c0' as any]: accent[0], ['--c1' as any]: accent[1] }} onClick={e => e.stopPropagation()}>
        <div className="mpd-media">
          <div className="mpd-carousel" ref={carRef} onScroll={onCarScroll}>
            {p.media.map((m, i) => (
              <div key={i} className="mpd-slide">
                {m.kind === 'video' ? <video className="mom2-media-el" style={{ objectFit: 'contain' }} src={m.url} controls playsInline />
                  : m.url ? <SmartImg src={m.url} cover={false} /> : <span className="mom2-media-ph2"><IconPhoto width={30} height={30} /></span>}
              </div>
            ))}
          </div>
          {p.media.length > 1 && <span className="mom2-count">{mediaIdx + 1}/{p.media.length}</span>}
          {p.media.length > 1 && <div className="mpd-dots">{p.media.map((_, i) => <span key={i} className={`mom2-dot${i === mediaIdx ? ' on' : ''}`} />)}</div>}
        </div>
        <div className="mpd-side">
          <div className="mpd-head">
            {p.author.photo ? <img className="mom2-av" src={p.author.photo} alt="" referrerPolicy="no-referrer" /> : <span className="mom2-av mom2-av-fb">{initials(p.author.name)}</span>}
            <div className="mom2-id"><b>{p.author.name}</b><small>{p.audience === 'grownups' ? 'Grown-ups' : p.audience === 'custom' ? 'Custom' : 'Whole circle'} · {timeAgo(p.createdAt)}</small></div>
            <div className="mom2-menu-wrap">
              <button className="mom2-kebab" onClick={() => setMenuOpen(v => !v)} aria-label="More">⋯</button>
              {menuOpen && (<>
                <div className="mom2-menu-scrim" onClick={() => setMenuOpen(false)} />
                <div className="mom2-menu">
                  <button onClick={onEditCaption}>Edit caption</button>
                  <button onClick={onEditDate}>Edit date</button>
                  <button onClick={onAddToAlbum}>Add to album</button>
                  <button className="danger" onClick={onDelete}>Delete</button>
                </div>
              </>)}
            </div>
            <button className="mpd-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="mpd-scroll">
            <div className="mom2-acts">
              <button className={`mom2-act${p.myReaction ? ' on' : ''}`} onClick={() => setShowReacts(v => !v)}><IconHeart width={19} height={19} /> {p.reactionCount || ''}</button>
              <button className="mom2-act"><IconComment width={19} height={19} /> {p.commentCount || ''}</button>
              <button className="mom2-act reward" onClick={() => setRewardOpen(v => !v)}><IconDiamond width={17} height={17} /> {p.rewardTotal ? `+${p.rewardTotal}` : 'Reward'}</button>
            </div>
            {showReacts && <div className="mom2-react-row">{REACTIONS.map(e => <button key={e} className={`mom2-emoji${p.myReaction === e ? ' on' : ''}`} onClick={() => react(e)}>{e}</button>)}</div>}
            {rewardOpen && (
              <div className="mom2-reward-row">
                {p.tags.length === 0 ? <span className="mom2-reward-hint">Tag someone to reward.</span> : <>
                  <button className="mom2-step" onClick={() => setAmt(a => Math.max(1, a - 5))}>−</button><b>{amt} 💎 each</b><button className="mom2-step" onClick={() => setAmt(a => a + 5)}>+</button>
                  <button className="mom2-reward-go" onClick={() => { onReward(post, amt); setRewardOpen(false) }}>Send</button>
                </>}
              </div>
            )}
            {clusters.length > 0 && <div className="mom2-cluster">{clusters.slice(0, 5).map(([e, n]) => <span key={e} className="mom2-chip">{e} {n}</span>)}</div>}
            {p.body && <div className="mom2-caption"><b>{p.author.name.split(' ')[0]}</b> {p.body}</div>}
            <div className="mpd-comhead">Comments</div>
            {list === null && <div className="mom2-empty">Loading…</div>}
            {list && list.length === 0 && <div className="mom2-empty">No comments yet. Be the first.</div>}
            {list && list.map(c => (
              <div className="mom2-com" key={c.id}>
                {c.author.photo ? <img className="mom2-com-av" src={c.author.photo} alt="" referrerPolicy="no-referrer" /> : <span className="mom2-com-av mom2-av-fb">{initials(c.author.name)}</span>}
                <div className="mom2-com-body"><b>{c.author.name.split(' ')[0]}</b> {c.body}<div className="mom2-com-time">{timeAgo(c.createdAt)}{c.author.id === meId && <button className="mom2-com-del-link" onClick={() => delC(c.id)}>· delete</button>}</div></div>
              </div>
            ))}
          </div>
          <div className="mpd-reply">
            <input className="field" placeholder="Add a comment…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} />
            <button className="mom2-com-send" disabled={!text.trim()} onClick={send}>Post</button>
          </div>
        </div>
      </div>
    </div>, document.body
  )
}

// ── edit a moment's date ──
function EditDateSheet({ post, accent, onClose, onSaved }: { post: M.MPost; accent: [string, string]; onClose: () => void; onSaved: () => void }) {
  const d0 = new Date(post.createdAt)
  const pad = (n: number) => String(n).padStart(2, '0')
  const [val, setVal] = useState(`${d0.getFullYear()}-${pad(d0.getMonth() + 1)}-${pad(d0.getDate())}`)
  const [busy, setBusy] = useState(false)
  const save = async () => {
    setBusy(true)
    try { await M.updatePost(post.id, { createdAt: new Date(val + 'T12:00:00').toISOString() }); onSaved() } catch { setBusy(false) }
  }
  return (
    <Sheet title="Edit date" accent={accent} onClose={onClose} action={<button className="mom2-share" disabled={busy || !val} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>}>
      <p className="sheet-note">Set when this moment happened — it re-sorts into the feed, albums and timeline.</p>
      <input className="field" type="date" value={val} onChange={e => setVal(e.target.value)} />
    </Sheet>
  )
}

// ── edit a moment's caption ──
function EditCaptionSheet({ post, accent, onClose, onSaved }: { post: M.MPost; accent: [string, string]; onClose: () => void; onSaved: () => void }) {
  const [body, setBody] = useState(post.body ?? '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const save = async () => { setBusy(true); setErr(null); try { await M.updatePost(post.id, { body }); onSaved() } catch (e) { setErr(errMsg(e)); setBusy(false) } }
  return (
    <Sheet title="Edit caption" accent={accent} onClose={onClose} action={<button className="mom2-share" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>}>
      <textarea className="field mom2-cap" placeholder="Write a caption…" value={body} onChange={e => setBody(e.target.value)} rows={3} autoFocus />
      {err && <div className="me3-error" style={{ marginTop: 8 }}>{err}</div>}
    </Sheet>
  )
}

// ── new album ──
function NewAlbumSheet({ circleId, accent, onClose, onCreated }: { circleId: string; accent: [string, string]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const create = async () => { setBusy(true); try { await M.createAlbum(circleId, title.trim()); onCreated() } catch { setBusy(false) } }
  return (
    <Sheet title="New album" accent={accent} onClose={onClose} action={<button className="mom2-share" disabled={busy || !title.trim()} onClick={create}>{busy ? 'Creating…' : 'Create'}</button>}>
      <input className="field" placeholder="Album title — e.g. Summer 2025" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
    </Sheet>
  )
}

// ── add a post to an album (pick or create) ──
function AddToAlbumSheet({ circleId, post, accent, onClose, onDone }: { circleId: string; post: M.MPost; accent: [string, string]; onClose: () => void; onDone: () => void }) {
  const [albums, setAlbums] = useState<M.MAlbum[] | null>(null)
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => { M.fetchAlbums(circleId).then(setAlbums).catch(() => setAlbums([])) }, [circleId])
  const pick = async (album: M.MAlbum) => {
    setBusy(true); setErr(null)
    try {
      await M.addToAlbum(album.id, post.id)
      // give the album a cover the first time something lands in it
      if (!album.coverPath && post.media[0]?.path) await M.setAlbumCover(album.id, post.media[0].path)
      onDone()
    } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  const createAndAdd = async () => {
    if (!title.trim()) return
    setBusy(true); setErr(null)
    try {
      const aid = await M.createAlbum(circleId, title.trim())
      await M.addToAlbum(aid, post.id)
      if (post.media[0]?.path) await M.setAlbumCover(aid, post.media[0].path)
      onDone()
    } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  return (
    <Sheet title="Add to album" accent={accent} onClose={onClose}>
      <div className="mom2-com-input"><input className="field" placeholder="New album…" value={title} onChange={e => setTitle(e.target.value)} /><button className="mom2-com-send" disabled={busy || !title.trim()} onClick={createAndAdd}>Create</button></div>
      {err && <div className="me3-error" style={{ margin: '8px 0' }}>{err}</div>}
      <div className="mom2-albumrows">
        {albums === null && <div className="mom2-empty">Loading…</div>}
        {albums && albums.length === 0 && <div className="mom2-empty">No albums yet — create one above.</div>}
        {albums && albums.map(a => (
          <button key={a.id} className="mom2-album-row" disabled={busy} onClick={() => pick(a)}>
            <span className="mom2-album-row-cover">{a.coverUrl ? <img src={a.coverUrl} alt="" /> : <IconPhoto width={18} height={18} />}</span>
            <span className="mom2-album-row-info"><b>{a.title}</b><small>{a.count} moment{a.count === 1 ? '' : 's'}</small></span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}

// ── add milestone ──
function todayStr() { const d = new Date(); const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
function AddMilestoneSheet({ circleId, kids, accent, onClose, onCreated }: { circleId: string; kids: FamilyMember[]; accent: [string, string]; onClose: () => void; onCreated: () => void }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [kidId, setKidId] = useState<string | null>(null)
  const [date, setDate] = useState(todayStr())
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const create = async () => {
    setBusy(true); setErr(null)
    try {
      const id = await M.addMilestone(circleId, title.trim(), body.trim() || undefined, kidId ?? undefined)
      if (date !== todayStr()) { try { await M.updateMilestone(id, { createdAt: new Date(date + 'T12:00:00').toISOString() }) } catch { /* needs 04c */ } }
      onCreated()
    } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  return (
    <Sheet title="Add milestone" accent={accent} onClose={onClose} action={<button className="mom2-share" disabled={busy || !title.trim()} onClick={create}>{busy ? 'Saving…' : 'Save'}</button>}>
      <input className="field" placeholder="Milestone — e.g. First bike ride" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <textarea className="field mom2-cap" placeholder="A note…" value={body} onChange={e => setBody(e.target.value)} rows={2} />
      <div className="sheet-lbl">Date</div>
      <input className="field" type="date" value={date} onChange={e => setDate(e.target.value)} />
      {err && <div className="me3-error" style={{ marginTop: 8 }}>{err}</div>}
      {kids.length > 0 && <>
        <div className="sheet-lbl">For</div>
        <div className="mom2-tagrow">
          {kids.map(k => <button key={k.id} className={`mom2-tagchip${kidId === k.id ? ' on' : ''}`} onClick={() => setKidId(kidId === k.id ? null : k.id)}><span className="mom2-tagav" style={{ background: k.color || 'var(--grad)' }}>{k.emoji || initials(k.name)}</span>{k.name.split(' ')[0]}</button>)}
        </div>
      </>}
    </Sheet>
  )
}

// ── edit / delete a milestone ──
function EditMilestoneSheet({ ms, kids, accent, onClose, onSaved }: { ms: M.MMilestone; kids: FamilyMember[]; accent: [string, string]; onClose: () => void; onSaved: () => void }) {
  const d0 = new Date(ms.createdAt); const p = (n: number) => String(n).padStart(2, '0')
  const [title, setTitle] = useState(ms.title)
  const [body, setBody] = useState(ms.body ?? '')
  const [kidId, setKidId] = useState<string | null>(ms.kid?.id ?? null)
  const [date, setDate] = useState(`${d0.getFullYear()}-${p(d0.getMonth() + 1)}-${p(d0.getDate())}`)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const save = async () => {
    setBusy(true); setErr(null)
    try { await M.updateMilestone(ms.id, { title: title.trim(), body: body.trim(), kidId: kidId ?? undefined, createdAt: new Date(date + 'T12:00:00').toISOString() }); onSaved() } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  const del = async () => {
    if (!window.confirm('Delete this milestone?')) return
    setBusy(true); setErr(null)
    try { await M.deleteMilestone(ms.id); onSaved() } catch (e) { setErr(errMsg(e)); setBusy(false) }
  }
  return (
    <Sheet title="Edit milestone" accent={accent} onClose={onClose} action={<button className="mom2-share" disabled={busy || !title.trim()} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>}>
      <input className="field" value={title} onChange={e => setTitle(e.target.value)} autoFocus />
      <textarea className="field mom2-cap" placeholder="A note…" value={body} onChange={e => setBody(e.target.value)} rows={2} />
      <div className="sheet-lbl">Date</div>
      <input className="field" type="date" value={date} onChange={e => setDate(e.target.value)} />
      {kids.length > 0 && <>
        <div className="sheet-lbl">For</div>
        <div className="mom2-tagrow">
          {kids.map(k => <button key={k.id} className={`mom2-tagchip${kidId === k.id ? ' on' : ''}`} onClick={() => setKidId(kidId === k.id ? null : k.id)}><span className="mom2-tagav" style={{ background: k.color || 'var(--grad)' }}>{k.emoji || initials(k.name)}</span>{k.name.split(' ')[0]}</button>)}
        </div>
      </>}
      {err && <div className="me3-error" style={{ marginTop: 8 }}>{err}</div>}
      <button className="mom2-del-btn" disabled={busy} onClick={del}>Delete milestone</button>
    </Sheet>
  )
}

// ── story viewer (full-screen, portalled) ──
function StoryViewer({ groups, start, onClose }: { groups: M.MStoryGroup[]; start: number; onClose: () => void }) {
  const [gi, setGi] = useState(start)
  const [ii, setII] = useState(0)
  const group = groups[gi]
  const item = group?.items[ii]
  useEffect(() => { if (item) M.markStoryViewed(item.id) }, [item?.id])
  const next = () => {
    if (group && ii < group.items.length - 1) setII(ii + 1)
    else if (gi < groups.length - 1) { setGi(gi + 1); setII(0) }
    else onClose()
  }
  const prev = () => {
    if (ii > 0) setII(ii - 1)
    else if (gi > 0) { const g = groups[gi - 1]; setGi(gi - 1); setII(Math.max(g.items.length - 1, 0)) }
  }
  useEffect(() => { const t = setTimeout(next, 5000); return () => clearTimeout(t) }, [gi, ii]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!group || !item) return null
  const m0 = item.media[0]
  return createPortal(
    <div className="msv">
      <div className="msv-bars" key={`${gi}-${ii}`}>
        {group.items.map((_, i) => <span key={i} className={`msv-bar${i < ii ? ' done' : ''}${i === ii ? ' active' : ''}`} />)}
      </div>
      <div className="msv-head">
        {group.author.photo ? <img className="msv-av" src={group.author.photo} alt="" referrerPolicy="no-referrer" /> : <span className="msv-av msv-av-fb">{initials(group.author.name)}</span>}
        <b>{group.author.name.split(' ')[0]}</b><small>{timeAgo(item.createdAt)}</small>
        <button className="msv-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      {m0 && (m0.kind === 'video' ? <video className="msv-media" src={m0.url} autoPlay playsInline muted /> : <img className="msv-media" src={m0.url} alt="" />)}
      {item.body && <div className="msv-cap">{item.body}</div>}
      <button className="msv-tap left" onClick={prev} aria-label="Previous" />
      <button className="msv-tap right" onClick={next} aria-label="Next" />
    </div>, document.body)
}

// ── reels player (vertical, autoplay-in-view) ──
function ReelsPlayer({ posts, start, onClose, onReact, onReward, onComments }: {
  posts: M.MPost[]; start: number; onClose: () => void
  onReact: (p: M.MPost, e: string) => void; onReward: (p: M.MPost, n: number) => void; onComments: (p: M.MPost) => void
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => { const el = scrollRef.current?.children[start] as HTMLElement | undefined; el?.scrollIntoView() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return createPortal(
    <div className="mreels">
      <button className="mreels-close" onClick={onClose} aria-label="Close">✕</button>
      <div className="mreels-scroll" ref={scrollRef}>
        {posts.map(p => <ReelItem key={p.id} post={p} onReact={onReact} onReward={onReward} onComments={onComments} />)}
      </div>
    </div>, document.body)
}
function ReelItem({ post, onReact, onReward, onComments }: { post: M.MPost; onReact: (p: M.MPost, e: string) => void; onReward: (p: M.MPost, n: number) => void; onComments: (p: M.MPost) => void }) {
  const vref = useRef<HTMLVideoElement | null>(null)
  const wrap = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const v = vref.current, w = wrap.current
    if (!v || !w) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting && e.intersectionRatio > 0.6) v.play().catch(() => {}); else v.pause() }, { threshold: [0, 0.6, 1] })
    io.observe(w)
    return () => io.disconnect()
  }, [])
  const m0 = post.media[0]
  return (
    <div className="mreel" ref={wrap}>
      {m0?.kind === 'video' ? <video ref={vref} className="mreel-media" src={m0.url} loop playsInline muted /> : <img className="mreel-media" src={m0?.url} alt="" />}
      <div className="mreel-scrim" />
      <div className="mreel-rail">
        <button className={`mreel-act${post.myReaction ? ' on' : ''}`} onClick={() => onReact(post, '❤️')}><IconHeart width={26} height={26} /><small>{post.reactionCount || ''}</small></button>
        <button className="mreel-act" onClick={() => onComments(post)}><IconComment width={25} height={25} /><small>{post.commentCount || ''}</small></button>
        <button className="mreel-act reward" onClick={() => onReward(post, 5)}><span className="mreel-reward"><IconDiamond width={21} height={21} /></span><small>{post.rewardTotal ? `+${post.rewardTotal}` : 'Reward'}</small></button>
      </div>
      <div className="mreel-cap"><b>{post.author.name.split(' ')[0]}</b>{post.body && <p>{post.body}</p>}</div>
    </div>
  )
}

// ── album detail (full-screen grid) ──
function AlbumDetail({ album, onClose, onChanged }: { album: M.MAlbum; onClose: () => void; onChanged: () => void }) {
  const [posts, setPosts] = useState<M.MPost[] | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [pickCover, setPickCover] = useState(false)
  const [busy, setBusy] = useState(false)
  const [viewerAt, setViewerAt] = useState<number | null>(null)
  useEffect(() => { M.fetchAlbumPosts(album.id).then(setPosts).catch(e => { setPosts([]); setErr(errMsg(e)) }) }, [album.id])
  const setCover = async (p: M.MPost) => {
    if (!p.media[0]?.path) return
    setBusy(true)
    try { await M.setAlbumCover(album.id, p.media[0].path); onChanged(); setPickCover(false) } finally { setBusy(false) }
  }
  return createPortal(
    <div className="madet">
      <div className="madet-head">
        <button className="madet-back" onClick={onClose} aria-label="Back">‹</button>
        <b>{album.title}</b>
        <button className="madet-cover-btn" onClick={() => setPickCover(v => !v)}>{pickCover ? 'Done' : 'Cover'}</button>
      </div>
      {pickCover && <div className="madet-hint">Tap a moment to make it the album cover.</div>}
      {err && <div className="me3-error" style={{ margin: 8 }}>{err}</div>}
      {posts === null && <div className="mom2-empty">Loading…</div>}
      {posts && posts.length === 0 && !err && <div className="mom2-empty">No moments in this album yet.</div>}
      {posts && posts.length > 0 && (
        <div className="mom2-grid madet-grid">
          {posts.map((p, idx) => (
            <button key={p.id} className={`mom2-cell${pickCover ? ' pickable' : ''}`} disabled={busy} onClick={() => pickCover ? setCover(p) : setViewerAt(idx)}>
              {p.media[0]?.url
                ? (p.media[0].kind === 'video' ? <video src={p.media[0].url} muted playsInline preload="metadata" /> : <SmartImg src={p.media[0].url} />)
                : <span className="mom2-cell-ph"><IconPhoto width={22} height={22} /></span>}
              {p.media.length > 1 && <span className="mom2-cell-badge"><svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M8 3h11a2 2 0 0 1 2 2v11h-2V5H8V3zM5 7h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2z"/></svg></span>}
              {p.media[0]?.kind === 'video' && p.media.length === 1 && <span className="mom2-cell-badge">▶</span>}
            </button>
          ))}
        </div>
      )}
      {viewerAt !== null && posts && <AlbumViewer posts={posts} start={viewerAt} onClose={() => setViewerAt(null)} />}
    </div>, document.body)
}

// ── open an album straight into the story-style viewer ──
function AlbumStory({ album, onClose }: { album: M.MAlbum; onClose: () => void }) {
  const [posts, setPosts] = useState<M.MPost[] | null>(null)
  useEffect(() => { M.fetchAlbumPosts(album.id).then(setPosts).catch(() => setPosts([])) }, [album.id])
  useEffect(() => { if (posts && posts.length === 0) onClose() }, [posts]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!posts || posts.length === 0) return null
  return <AlbumViewer posts={posts} start={0} onClose={onClose} />
}

// ── album story-style viewer; the reply becomes a comment on the moment ──
function AlbumViewer({ posts, start, onClose }: { posts: M.MPost[]; start: number; onClose: () => void }) {
  const [list, setList] = useState(posts)
  const [i, setI] = useState(start)
  const [reply, setReply] = useState('')
  const post = list[i]
  if (!post) return null
  const m0 = post.media[0]
  const react = async (emoji: string) => {
    const nextE = post.myReaction === emoji ? null : emoji
    setList(l => l.map((x, ix) => ix === i ? applyReaction(x, nextE) : x))
    try { await M.toggleReaction(post.id, nextE) } catch { /* ignore */ }
  }
  const send = async () => {
    if (!reply.trim()) return
    const text = reply.trim(); setReply('')
    setList(l => l.map((x, ix) => ix === i ? { ...x, commentCount: x.commentCount + 1 } : x))
    try { await M.addComment(post.id, text) } catch { /* ignore */ }
  }
  return createPortal(
    <div className="msv">
      <div className="msv-bars">{list.map((_, ix) => <span key={ix} className={`msv-bar${ix <= i ? ' done' : ''}`} />)}</div>
      <div className="msv-head">
        {post.author.photo ? <img className="msv-av" src={post.author.photo} alt="" referrerPolicy="no-referrer" /> : <span className="msv-av msv-av-fb">{initials(post.author.name)}</span>}
        <b>{post.author.name.split(' ')[0]}</b><small>{timeAgo(post.createdAt)}</small>
        <button className="msv-close" onClick={onClose} aria-label="Close">✕</button>
      </div>
      {m0 && (m0.kind === 'video' ? <video className="msv-media" src={m0.url} autoPlay playsInline controls /> : <img className="msv-media" src={m0.url} alt="" />)}
      {post.body && <div className="msv-cap" style={{ bottom: 130 }}>{post.body}</div>}
      <button className="msv-tap left" onClick={() => i > 0 && setI(i - 1)} aria-label="Previous" />
      <button className="msv-tap right" onClick={() => i < list.length - 1 ? setI(i + 1) : onClose()} aria-label="Next" />
      <div className="msv-foot">
        <div className="msv-reacts">{REACTIONS.map(e => <button key={e} className={`msv-emoji${post.myReaction === e ? ' on' : ''}`} onClick={() => react(e)}>{e}</button>)}</div>
        <div className="msv-reply">
          <input placeholder={`Reply to ${post.author.name.split(' ')[0]}…`} value={reply} onChange={e => setReply(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }} />
          <button className="msv-send" onClick={send} aria-label="Send"><svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M3 11l18-8-8 18-2-7-8-3z" /></svg></button>
        </div>
      </div>
    </div>, document.body)
}

// ── shared bits ──
function Sheet({ title, action, accent, onClose, children }: { title: string; action?: ReactNode; accent?: [string, string]; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="sheet-scrim" onClick={onClose}>
      <div className="sheet mom2-sheet" style={accent ? { ['--c0' as any]: accent[0], ['--c1' as any]: accent[1] } : undefined} onClick={e => e.stopPropagation()}>
        <div className="mom2-sheet-head">
          <button className="mom2-cancel" onClick={onClose}>Cancel</button>
          <div className="sheet-title" style={{ margin: 0 }}>{title}</div>
          <span>{action}</span>
        </div>
        <div className="mom2-sheet-body">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="apps-empty">
      <span className="apps-empty-ic"><IconHeart width={26} height={26} /></span>
      <b>No moments yet</b>
      <p>Share a photo or video and it’ll appear here for your circle.</p>
      <button className="btn grad" style={{ marginTop: 12 }} onClick={onCreate}>Create the first</button>
    </div>
  )
}
function SoftEmpty({ label }: { label: string }) { return <div className="mom2-empty" style={{ padding: '34px 0' }}>{label}</div> }
