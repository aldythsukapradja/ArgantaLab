// V4 — Video Library: browses the SAME hq_video_asset index Edit's media
// drawer already reads (@arganta/video listAssets/deleteAsset) — no new
// migration needed. "Send to Edit" (Generate/Cinema) and "Approve as
// keyframe" (Soul) both write into this index today; this tab is the visible
// front door onto it, with download/delete and a kind filter.
import { useEffect, useState } from 'react'
import { LibraryBig, Download, Trash2, Loader2, Video, Image as ImageIcon } from 'lucide-react'
import { listAssets, deleteAsset } from '@arganta/video'
import { supabase, cloudEnabled } from '../../lib/supabase'
import './video-library.css'

type KindFilter = 'all' | 'video' | 'image'

export function VideoLibrary() {
  const [assets, setAssets] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [kind, setKind] = useState<KindFilter>('all')
  const [note, setNote] = useState('')

  function refresh() {
    if (!cloudEnabled) return
    setLoading(true)
    listAssets(supabase, { kind: kind === 'all' ? undefined : kind, limit: 100 })
      .then(setAssets)
      .finally(() => setLoading(false))
  }

  useEffect(refresh, [kind])

  async function remove(a: any) {
    const ok = await deleteAsset(supabase, a)
    if (ok) { setAssets((s) => s.filter((x) => x.id !== a.id)); setNote('Removed.') }
    else setNote('Couldn’t remove that asset.')
    setTimeout(() => setNote(''), 3000)
  }

  if (!cloudEnabled) {
    return (
      <div className="vs-shell">
        <LibraryBig size={26} />
        <p>Sign in to browse the Video Library — every clip sent to Edit and every approved Soul keyframe lands here.</p>
      </div>
    )
  }

  return (
    <div className="vlib">
      <div className="vlib-head">
        <div className="vlib-title"><LibraryBig size={14} /> Library</div>
        <div className="seg vlib-filter" role="group" aria-label="Filter">
          <button className={kind === 'all' ? 'on' : ''} onClick={() => setKind('all')}>All</button>
          <button className={kind === 'video' ? 'on' : ''} onClick={() => setKind('video')}><Video size={12} /> Video</button>
          <button className={kind === 'image' ? 'on' : ''} onClick={() => setKind('image')}><ImageIcon size={12} /> Image</button>
        </div>
        {note && <span className="vs-note">{note}</span>}
        {loading && <Loader2 size={14} className="vg-spin" />}
      </div>

      <div className="vlib-grid">
        {!loading && assets.length === 0 && <div className="vg-gallery-empty">Nothing saved yet — send a clip to Edit or approve a Soul keyframe.</div>}
        {assets.map((a) => (
          <div key={a.id} className="vlib-tile">
            {a.kind === 'video' ? <video src={a.url} muted loop onMouseEnter={(e) => (e.target as HTMLVideoElement).play()} onMouseLeave={(e) => (e.target as HTMLVideoElement).pause()} />
              : <img src={a.thumb || a.url} alt={a.name} />}
            <div className="vlib-tile-cap">
              <span>{a.name}</span>
              <span className="vlib-tile-meta">{a.kind} · {a.source}</span>
            </div>
            <div className="vlib-tile-acts">
              <a href={a.url} download={a.name} title="Download"><Download size={12} /></a>
              <button onClick={() => remove(a)} title="Remove"><Trash2 size={12} /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
