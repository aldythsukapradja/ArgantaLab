/**
 * POST LIBRARY panel (B4) — the timeline of everything you've made.
 *
 * Reading order matters here: the founder opens this asking "which post was
 * that?", so a row leads with the artwork (a live thumbnail of slide 1), then
 * the title, then WHERE it went and WHEN. The publish badges are the point —
 * they're the difference between a folder of drafts and a record.
 *
 * Opening an entry always loads a CLONE. You can't accidentally edit the
 * archive by clicking it, and a published entry can't be edited at all — the
 * lock badge says so, and postLibrary.savePost forks it if you try.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { X, Lock, Copy as CopyIcon, Trash2, Bookmark, Search as SearchIcon, Heart, Instagram, Download, Rocket } from 'lucide-react'
import { groupByDate } from '../../lib/dateBuckets'
import { drawSlide, postFormat, type PostDoc, type RenderEnv } from './postEngine'
import { listLibrary, deleteEntry, cloneDoc, DEST_LABEL, type LibraryEntry, type PublishDest } from './postLibrary'

const DEST_ICON: Record<PublishDest, typeof Heart> = {
  moment: Heart, buffer: Instagram, feed: Rocket, export: Download,
}

const when = (iso: string) =>
  new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })

export function PostLibrary({ env, openEntryId, onOpen, onSaveStyleFrom, onClose }: {
  env: RenderEnv
  openEntryId: string | null
  onOpen: (doc: PostDoc, entry: LibraryEntry) => void
  onSaveStyleFrom: (doc: PostDoc, name: string) => void
  onClose: () => void
}) {
  const [rows, setRows] = useState<LibraryEntry[] | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')

  const reload = () => listLibrary(60).then(setRows)
  useEffect(() => { reload() }, [])

  const groups = useMemo(() => {
    const s = q.trim().toLowerCase()
    const base = (rows || []).filter(e => !s
      || e.title.toLowerCase().includes(s)
      || e.summary.toLowerCase().includes(s)
      || e.meta.hashtags.toLowerCase().includes(s))
    return groupByDate(base, e => e.createdAt)
  }, [rows, q])

  async function remove(e: LibraryEntry) {
    if (!window.confirm(`Delete “${e.title}”? This one has never been published, so nothing on record is lost.`)) return
    const r = await deleteEntry(e.id)
    if (!r.ok) { setStatus(r.reason || 'Could not delete.'); return }
    reload()
  }
  async function copyJson(e: LibraryEntry) {
    try { await navigator.clipboard.writeText(JSON.stringify(e.doc, null, 2)); setStatus(`Copied “${e.title}” doc JSON.`) }
    catch { setStatus('Clipboard blocked.') }
  }

  return (
    <div className="pbx-modal-backdrop" onClick={onClose}>
      <div className="pbx-lib" onClick={ev => ev.stopPropagation()}>
        <div className="pbx-lib-head">
          <b>Post Library</b>
          <span className="pbx-mini">{rows ? `${rows.length} post${rows.length === 1 ? '' : 's'}` : 'loading…'} · published posts are locked and kept</span>
          <button className="pbx-ic" onClick={onClose} aria-label="Close library"><X size={15} /></button>
        </div>

        <div className="pbx-lib-search">
          <SearchIcon size={13} />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search titles, content, hashtags…" aria-label="Search library" />
          {q && <button className="pbx-ic" onClick={() => setQ('')} aria-label="Clear"><X size={12} /></button>}
        </div>

        {status && <div className="pbx-lib-status">{status}</div>}

        <div className="pbx-lib-body">
          {rows === null && <div className="pbx-lib-empty">Loading…</div>}
          {rows?.length === 0 && (
            <div className="pbx-lib-empty">
              Nothing here yet. Every post you export or publish is saved automatically — and once it's published it's locked, so the record always matches what actually went out.
            </div>
          )}
          {groups.map(g => (
            <div key={g.label} className="pbx-lib-group">
              <div className="pbx-lib-grouphead">{g.label}</div>
              {g.rows.map(e => (
                <LibraryRow
                  key={e.id} entry={e} env={env} active={e.id === openEntryId}
                  onOpen={() => { onOpen(cloneDoc(e.doc), e); onClose() }}
                  onCopy={() => copyJson(e)}
                  onStyle={() => { onSaveStyleFrom(e.doc, e.title); setStatus(`Saved a style recipe from “${e.title}”.`) }}
                  onDelete={() => remove(e)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function LibraryRow({ entry, env, active, onOpen, onCopy, onStyle, onDelete }: {
  entry: LibraryEntry; env: RenderEnv; active: boolean
  onOpen: () => void; onCopy: () => void; onStyle: () => void; onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={'pbx-librow' + (active ? ' on' : '')}>
      <LibThumb doc={entry.doc} env={env} />
      <div className="pbx-libmain" onClick={() => setOpen(o => !o)}>
        <div className="pbx-libtitle">
          {entry.locked && <Lock size={10} className="pbx-liblock" />}
          <span>{entry.title}</span>
        </div>
        <div className="pbx-libmeta mono">
          {entry.meta.slideCount} slide{entry.meta.slideCount === 1 ? '' : 's'} · {postFormat(entry.meta.format).aspect}
          {entry.meta.brandId && ` · ${entry.meta.brandId}`} · {when(entry.createdAt)}
          {entry.derivedFrom && ' · new version'}
        </div>
        <div className="pbx-libbadges">
          {entry.published.length === 0
            ? <span className="pbx-libbadge draft">draft — never published</span>
            : entry.published.map((p, i) => {
              const Icon = DEST_ICON[p.dest]
              return (
                <span key={i} className="pbx-libbadge" title={`${DEST_LABEL[p.dest]} · ${p.label} · ${when(p.at)}`}>
                  <Icon size={9} /> {DEST_LABEL[p.dest]} · {p.label}
                </span>
              )
            })}
        </div>
        {open && <pre className="pbx-libsummary">{entry.summary}</pre>}
      </div>
      <div className="pbx-libacts">
        <button className="pbx-ic" title="Open a copy — the archive is never edited in place" onClick={onOpen}><CopyIcon size={13} /></button>
        <button className="pbx-ic" title="Save a style recipe from this design" onClick={onStyle}><Bookmark size={13} /></button>
        <button className="pbx-ic" title="Copy the doc JSON" onClick={onCopy}>{'{}'}</button>
        <button className="pbx-ic" title={entry.locked ? 'Published posts are kept on purpose' : 'Delete'} disabled={entry.locked} onClick={onDelete}><Trash2 size={13} /></button>
      </div>
    </div>
  )
}

/** Slide 1, small. Same renderer as the stage — a library thumbnail that
 *  disagreed with the artwork would be worse than none. */
function LibThumb({ doc, env }: { doc: PostDoc; env: RenderEnv }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const fmt = postFormat(doc.format)
  const h = 66
  const w = Math.round((fmt.w / fmt.h) * h)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    const dpr = 2
    cv.width = w * dpr; cv.height = h * dpr
    const ctx = cv.getContext('2d')!
    ctx.save()
    ctx.scale((w * dpr) / fmt.w, (h * dpr) / fmt.h)
    drawSlide(ctx, doc, 0, fmt.w, fmt.h, env)
    ctx.restore()
  }, [doc, w, h, fmt.w, fmt.h, env])
  return <canvas ref={ref} className="pbx-libthumb" style={{ width: w, height: h }} />
}
