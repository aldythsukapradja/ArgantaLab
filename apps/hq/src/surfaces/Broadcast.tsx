import { useEffect, useMemo, useState } from 'react'
import {
  Megaphone, Sparkles, Library as LibraryIcon, FlaskConical, LayoutGrid,
  Eye, Heart, Send, CalendarClock, Pencil, Trash2, Plus, Image as ImageIcon,
  Video, Archive, Check, Flame, ArrowUpRight, Wand2, ClipboardPaste, Copy,
  ExternalLink, ListChecks, Minus,
} from 'lucide-react'
import { live, cloudEnabled, type BroadcastRow, type BroadcastInput } from '../data/live'
import {
  FORMATS, THEMES, LIBRARY, RESEARCH, formatDef, themeDef, accentFor, blankDraft,
  type BFormat, type BTheme, type BMediaKind, type BAudience, type LibraryItem,
} from '../data/broadcast'
import {
  GOALS, packsByGoal, buildPrompt, parseImport,
  type PromptPack, type PromptGoal, type ParsedPost,
} from '../data/prompts'
import { Loading, Empty } from '../components/Empty'
import { compact } from '../lib/format'

type Tab = 'catalogue' | 'studio' | 'prompts' | 'import' | 'library' | 'research'
const TABS: { id: Tab; label: string; Icon: typeof Sparkles }[] = [
  { id: 'catalogue', label: 'Catalogue', Icon: LayoutGrid },
  { id: 'studio', label: 'Studio', Icon: Sparkles },
  { id: 'prompts', label: 'Prompts', Icon: Wand2 },
  { id: 'import', label: 'Import', Icon: ClipboardPaste },
  { id: 'library', label: 'Library', Icon: LibraryIcon },
  { id: 'research', label: 'Research', Icon: FlaskConical },
]

interface Draft {
  id?: string
  format: BFormat
  theme: BTheme
  title: string
  body: string
  emoji: string
  source: string
  mediaKind: BMediaKind
  mediaUrl: string
  accent: string
  audience: BAudience
}

function seedToDraft(seed: Partial<Draft>): Draft {
  const format = (seed.format as BFormat) || 'fact'
  const theme = (seed.theme as BTheme) || 'funfacts'
  const base = blankDraft(format, theme)
  return {
    id: seed.id,
    format, theme,
    title: seed.title ?? '',
    body: seed.body ?? '',
    emoji: seed.emoji ?? (base.emoji as string),
    source: seed.source ?? '',
    mediaKind: seed.mediaKind ?? 'none',
    mediaUrl: seed.mediaUrl ?? '',
    accent: seed.accent ?? (base.accent as string),
    audience: seed.audience ?? (base.audience as BAudience),
  }
}

function rowToDraft(r: BroadcastRow): Draft {
  return {
    id: r.id,
    format: r.format as BFormat,
    theme: r.theme as BTheme,
    title: r.title,
    body: r.body ?? '',
    emoji: r.emoji ?? formatDef(r.format as BFormat).emoji,
    source: r.source ?? '',
    mediaKind: (r.media_kind as BMediaKind) || 'none',
    mediaUrl: r.media_url ?? '',
    accent: r.accent ?? accentFor(r.theme as BTheme),
    audience: (r.audience as BAudience) || 'circle',
  }
}

export function Broadcast() {
  const [tab, setTab] = useState<Tab>('catalogue')
  const [rows, setRows] = useState<BroadcastRow[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState<string | null>(null)

  const reload = () => {
    setRows(null)
    live.publishDueBroadcasts().finally(() => live.listBroadcasts().then(setRows))
  }
  useEffect(reload, [])

  const openStudio = (seed?: Partial<Draft>) => {
    setDraft(seedToDraft(seed ?? {}))
    setTab('studio')
  }

  const k = useMemo(() => {
    const r = rows ?? []
    return {
      published: r.filter(x => x.status === 'published').length,
      scheduled: r.filter(x => x.status === 'scheduled').length,
      views: r.reduce((s, x) => s + (x.view_count || 0), 0),
      reactions: r.reduce((s, x) => s + (x.reaction_count || 0), 0),
    }
  }, [rows])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="spread" style={{ alignItems: 'flex-end', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div className="h1">Content Builder</div>
          <div className="sub">Build the platform-authored “Discover” content that keeps every KinetikCircle feed alive — mix a format with a theme, paste the copy, schedule it.</div>
        </div>
        <div className="seg">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} className={tab === id ? 'on' : ''} onClick={() => setTab(id)}>
              <Icon size={13} style={{ verticalAlign: -2, marginRight: 5 }} />{label}
            </button>
          ))}
        </div>
      </div>

      <div className="kpi-grid">
        <div className="kpi"><div className="kpi-l"><Send size={13} /> Published</div><div className="kpi-v">{rows === null ? '—' : k.published}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>live in feeds</div></div>
        <div className="kpi"><div className="kpi-l"><CalendarClock size={13} /> Scheduled</div><div className="kpi-v">{rows === null ? '—' : k.scheduled}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>queued to post</div></div>
        <div className="kpi"><div className="kpi-l"><Eye size={13} /> Views</div><div className="kpi-v">{rows === null ? '—' : compact(k.views)}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>across all circles</div></div>
        <div className="kpi"><div className="kpi-l"><Heart size={13} /> Reactions</div><div className="kpi-v">{rows === null ? '—' : compact(k.reactions)}</div><div className="kpi-s" style={{ color: 'var(--tx3)' }}>engagement</div></div>
      </div>

      {msg && <div className="insight tl" style={{ alignItems: 'center' }}><Check size={15} /><div>{msg}</div></div>}

      {tab === 'catalogue' && <Catalogue rows={rows} onNew={() => openStudio()} onEdit={r => openStudio(rowToDraft(r))} onReload={reload} onMsg={setMsg} />}
      {tab === 'studio' && <Studio draft={draft} setDraft={setDraft} onNew={() => openStudio()} onSaved={(m) => { setMsg(m); reload(); setTab('catalogue') }} onMsg={setMsg} />}
      {tab === 'prompts' && <PromptsTab onImport={() => setTab('import')} />}
      {tab === 'import' && <ImportTab onSaved={(m) => { setMsg(m); reload(); setTab('catalogue') }} onMsg={setMsg} />}
      {tab === 'library' && <LibraryTab onClone={(it) => openStudio(it)} />}
      {tab === 'research' && <Research onUse={(theme, format) => openStudio({ theme, format })} />}
    </div>
  )
}

// ── KinetikCircle brand mark (matches public/icon.svg) ────────
function KMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" role="img" aria-label="KinetikCircle">
      <defs>
        <linearGradient id="kmg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#22D3EE" /><stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill="url(#kmg)" />
      <circle cx="256" cy="256" r="106" fill="none" stroke="#fff" strokeWidth="40" />
      <circle cx="332" cy="180" r="34" fill="#fff" />
      <circle cx="256" cy="256" r="22" fill="#fff" />
    </svg>
  )
}

// ── Feed-accurate preview (also = what families see) ──────────
function PreviewCard({ d }: { d: Draft }) {
  const f = formatDef(d.format)
  const t = themeDef(d.theme)
  return (
    <div className="card" style={{ overflow: 'hidden', borderTop: `3px solid ${d.accent}` }}>
      <div className="row" style={{ gap: 9, padding: '12px 14px 8px', alignItems: 'center' }}>
        <KMark size={30} />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>KinetikCircle</div>
          <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Discover · {f.label}</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: t.accent, background: 'var(--acc-soft)', padding: '3px 8px', borderRadius: 99 }}>{t.emoji} {t.label}</span>
      </div>
      {d.mediaKind === 'image' && d.mediaUrl && (
        <img src={d.mediaUrl} alt="" style={{ width: '100%', maxHeight: 260, objectFit: 'cover', display: 'block' }} onError={e => ((e.target as HTMLImageElement).style.display = 'none')} />
      )}
      {d.mediaKind === 'video' && d.mediaUrl && (
        <video src={d.mediaUrl} controls style={{ width: '100%', maxHeight: 280, background: '#000', display: 'block' }} />
      )}
      <div style={{ padding: '12px 14px 14px' }}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>{d.emoji} {d.title || <span style={{ color: 'var(--tx3)' }}>Title…</span>}</div>
        <div style={{ fontSize: 13.5, color: 'var(--tx2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{d.body || <span style={{ color: 'var(--tx3)' }}>Body…</span>}</div>
        {d.source && <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 8 }}>— {d.source}</div>}
        <div className="row" style={{ gap: 12, marginTop: 12, fontSize: 13, color: 'var(--tx3)' }}>
          {['❤️', '🏆', '😂', '😍', '🔥'].map(e => <span key={e} style={{ opacity: 0.85 }}>{e}</span>)}
        </div>
      </div>
    </div>
  )
}

// ── Catalogue ─────────────────────────────────────────────────
const STATUS_FILTERS: { id: string; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'published', label: 'Published' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'draft', label: 'Drafts' },
  { id: 'archived', label: 'Archived' },
]

function fmtWhen(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Catalogue({ rows, onNew, onEdit, onReload, onMsg }: {
  rows: BroadcastRow[] | null
  onNew: () => void
  onEdit: (r: BroadcastRow) => void
  onReload: () => void
  onMsg: (m: string) => void
}) {
  const [filter, setFilter] = useState('all')
  if (rows === null) return <Loading label="Loading broadcast catalogue…" />

  const upcoming = rows
    .filter(r => r.status === 'scheduled' && r.publish_at)
    .sort((a, b) => (a.publish_at! < b.publish_at! ? -1 : 1))
  const shown = filter === 'all' ? rows : rows.filter(r => r.status === filter)

  const act = async (fn: () => Promise<boolean>, ok: string) => {
    const done = await fn()
    if (done) { onMsg(ok); onReload() }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
        <div className="seg">
          {STATUS_FILTERS.map(s => (
            <button key={s.id} className={filter === s.id ? 'on' : ''} onClick={() => setFilter(s.id)}>{s.label}</button>
          ))}
        </div>
        <button className="chip" style={{ gap: 6, background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }} onClick={onNew}>
          <Plus size={13} /> New post
        </button>
      </div>

      {!cloudEnabled && (
        <div className="banner" style={{ position: 'static', borderRadius: 12 }}>
          Offline preview — connect Supabase &amp; sign in as operator to publish to live feeds. The Studio, Library and Research all work offline.
        </div>
      )}

      {upcoming.length > 0 && (
        <div className="card" style={{ padding: 14 }}>
          <div className="row" style={{ gap: 7, fontSize: 12, fontWeight: 700, color: 'var(--tx2)', marginBottom: 10 }}>
            <CalendarClock size={14} /> Up next
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 2 }}>
            {upcoming.slice(0, 8).map(r => (
              <button key={r.id} className="card" style={{ flex: 'none', width: 200, padding: 10, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 4 }} onClick={() => onEdit(r)}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: accentFor(r.theme as BTheme) }}>{fmtWhen(r.publish_at)}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.emoji} {r.title}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {shown.length === 0 ? (
        <Empty icon={<Megaphone />} title={cloudEnabled ? 'No posts here yet' : 'Catalogue is empty offline'}>
          Compose your first Discover post in the <b>Studio</b>, or clone a starter from the <b>Library</b>. Published posts appear in every circle’s feed authored by KinetikCircle.
        </Empty>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
          {shown.map(r => (
            <CatalogueCard key={r.id} r={r} onEdit={() => onEdit(r)}
              onPublish={() => act(() => live.setBroadcastStatus(r.id, 'published'), 'Published to all feeds')}
              onArchive={() => act(() => live.setBroadcastStatus(r.id, 'archived'), 'Archived')}
              onDelete={() => { if (confirm('Delete this broadcast permanently?')) act(() => live.deleteBroadcast(r.id), 'Deleted') }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 10px', fontSize: 13, fontFamily: 'inherit',
  background: 'var(--bg)', color: 'var(--tx)', border: '1px solid var(--bd2)', borderRadius: 8,
}

const STATUS_TONE: Record<string, string> = {
  published: 'pill-ok', scheduled: 'pill-tl', draft: 'pill-mut', archived: 'pill-mut',
}

function CatalogueCard({ r, onEdit, onPublish, onArchive, onDelete }: {
  r: BroadcastRow; onEdit: () => void; onPublish: () => void; onArchive: () => void; onDelete: () => void
}) {
  const t = themeDef(r.theme as BTheme)
  const f = formatDef(r.format as BFormat)
  return (
    <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9, borderTop: `3px solid ${r.accent || t.accent}` }}>
      <div className="spread" style={{ alignItems: 'center' }}>
        <span className="row" style={{ gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: t.accent }}>
          {f.emoji} {f.label} · {t.label}
        </span>
        <span className={'pill ' + (STATUS_TONE[r.status] || '')} style={{ fontSize: 10 }}>{r.status}</span>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{r.emoji} {r.title}</div>
      {r.body && <div style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap' }}>{r.body}</div>}
      <div className="row" style={{ gap: 12, fontSize: 11.5, color: 'var(--tx3)', marginTop: 2 }}>
        <span className="row" style={{ gap: 4 }}><Eye size={12} /> {compact(r.view_count)}</span>
        <span className="row" style={{ gap: 4 }}><Heart size={12} /> {compact(r.reaction_count)}</span>
        {r.media_kind === 'image' && <span className="row" style={{ gap: 4 }}><ImageIcon size={12} /> image</span>}
        {r.media_kind === 'video' && <span className="row" style={{ gap: 4 }}><Video size={12} /> video</span>}
        {r.status === 'scheduled' && r.publish_at && <span className="row" style={{ gap: 4 }}><CalendarClock size={12} /> {fmtWhen(r.publish_at)}</span>}
      </div>
      <div className="row" style={{ gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
        <button className="chip" style={{ gap: 5 }} onClick={onEdit}><Pencil size={12} /> Edit</button>
        {r.status !== 'published' && <button className="chip" style={{ gap: 5, background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }} onClick={onPublish}><Send size={12} /> Publish</button>}
        {r.status === 'published' && <button className="chip" style={{ gap: 5 }} onClick={onArchive}><Archive size={12} /> Archive</button>}
        <button className="chip" style={{ gap: 5, marginLeft: 'auto' }} onClick={onDelete} title="Delete"><Trash2 size={12} /></button>
      </div>
    </div>
  )
}

// ── Studio ────────────────────────────────────────────────────
function Studio({ draft, setDraft, onNew, onSaved, onMsg }: {
  draft: Draft | null
  setDraft: (d: Draft) => void
  onNew: () => void
  onSaved: (m: string) => void
  onMsg: (m: string) => void
}) {
  const [when, setWhen] = useState('')
  const [busy, setBusy] = useState(false)

  if (!draft) {
    return (
      <Empty icon={<Sparkles />} title="Compose a Discover post">
        Start fresh, or clone a ready-made one from the Library.
        <div style={{ marginTop: 14 }}>
          <button className="chip" style={{ gap: 6, background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }} onClick={onNew}><Plus size={13} /> New post</button>
        </div>
      </Empty>
    )
  }

  const set = (patch: Partial<Draft>) => setDraft({ ...draft, ...patch })
  const setTheme = (theme: BTheme) => set({ theme, accent: accentFor(theme) })
  const setFormat = (format: BFormat) => set({ format, emoji: draft.emoji || formatDef(format).emoji })

  const toInput = (status: string, publishAt?: string | null) => ({
    id: draft.id ?? null,
    format: draft.format, theme: draft.theme, title: draft.title.trim(), body: draft.body,
    media_kind: draft.mediaKind, media_url: draft.mediaUrl.trim() || null,
    source: draft.source.trim() || null, emoji: draft.emoji || null, accent: draft.accent,
    audience: draft.audience, status, publish_at: publishAt ?? null,
  })

  const save = async (status: string, publishAt?: string | null, okMsg?: string) => {
    if (!draft.title.trim()) { onMsg('Add a title first.'); return }
    if (!cloudEnabled) { onMsg('Offline — connect Supabase to publish. The preview is exactly what families will see.'); return }
    setBusy(true)
    const id = await live.saveBroadcast(toInput(status, publishAt))
    setBusy(false)
    if (id) onSaved(okMsg || 'Saved')
    else onMsg('Could not save — are you signed in as an operator?')
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(280px,360px)', gap: 16, alignItems: 'start' }} className="bc-studio">
      {/* form */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Format" hint={formatDef(draft.format).hint}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {FORMATS.map(f => (
                <button key={f.key} className={'chip' + (draft.format === f.key ? ' on' : '')}
                  style={draft.format === f.key ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : undefined}
                  onClick={() => setFormat(f.key)}>{f.emoji} {f.label}</button>
              ))}
            </div>
          </Field>

          <Field label="Theme" hint={themeDef(draft.theme).blurb}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {THEMES.map(t => (
                <button key={t.key} className={'chip' + (draft.theme === t.key ? ' on' : '')}
                  style={draft.theme === t.key ? { background: t.accent, color: '#fff', borderColor: t.accent } : undefined}
                  onClick={() => setTheme(t.key)}>{t.emoji} {t.label}</button>
              ))}
            </div>
          </Field>

          <div className="row" style={{ gap: 10 }}>
            <Field label="Emoji" style={{ width: 88, flex: 'none' }}>
              <input style={inp} value={draft.emoji} onChange={e => set({ emoji: e.target.value })} maxLength={4} placeholder="💡" />
            </Field>
            <Field label="Title" style={{ flex: 1 }}>
              <input style={inp} value={draft.title} onChange={e => set({ title: e.target.value })} placeholder="The surprising headline" />
            </Field>
          </div>

          <Field label="Body">
            <textarea value={draft.body} onChange={e => set({ body: e.target.value })} rows={5}
              placeholder="The content. For Top-10s, put each item on its own line." style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
          </Field>

          <Field label="Source / attribution (optional)">
            <input style={inp} value={draft.source} onChange={e => set({ source: e.target.value })} placeholder="via NASA · — C.S. Lewis" />
          </Field>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field label="Media" hint="Paste a URL you generated elsewhere — image or short video.">
            <div style={{ display: 'flex', gap: 6 }}>
              {(['none', 'image', 'video'] as BMediaKind[]).map(m => (
                <button key={m} className={'chip' + (draft.mediaKind === m ? ' on' : '')}
                  style={draft.mediaKind === m ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : undefined}
                  onClick={() => set({ mediaKind: m })}>
                  {m === 'none' ? 'None' : m === 'image' ? <><ImageIcon size={12} /> Image</> : <><Video size={12} /> Video</>}
                </button>
              ))}
            </div>
          </Field>
          {draft.mediaKind !== 'none' && (
            <Field label={draft.mediaKind === 'image' ? 'Image URL' : 'Video URL'}>
              <input style={inp} value={draft.mediaUrl} onChange={e => set({ mediaUrl: e.target.value })} placeholder="https://…" />
            </Field>
          )}
          <Field label="Audience">
            <div style={{ display: 'flex', gap: 6 }}>
              <button className={'chip' + (draft.audience === 'circle' ? ' on' : '')} style={draft.audience === 'circle' ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : undefined} onClick={() => set({ audience: 'circle' })}>Everyone</button>
              <button className={'chip' + (draft.audience === 'grownups' ? ' on' : '')} style={draft.audience === 'grownups' ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : undefined} onClick={() => set({ audience: 'grownups' })}>Grown-ups only</button>
            </div>
          </Field>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <button className="chip" style={{ gap: 5 }} disabled={busy} onClick={() => save('draft', null, 'Saved to drafts')}><Check size={13} /> Save draft</button>
            <button className="chip" style={{ gap: 5, background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }} disabled={busy} onClick={() => save('published', null, 'Published to all feeds')}><Send size={13} /> Publish now</button>
          </div>
          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <input type="datetime-local" value={when} onChange={e => setWhen(e.target.value)} style={{ ...inp, width: 'auto', flex: 1, minWidth: 180 }} />
            <button className="chip" style={{ gap: 5 }} disabled={busy || !when} onClick={() => save('scheduled', new Date(when).toISOString(), 'Scheduled')}><CalendarClock size={13} /> Schedule</button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--tx3)' }}>Scheduled posts go live automatically at their time (via <span className="src">hq_broadcast_publish_due</span>).</div>
        </div>
      </div>

      {/* live preview */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, position: 'sticky', top: 8 }}>
        <div className="row" style={{ gap: 6, fontSize: 11, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          <Eye size={13} /> Feed preview
        </div>
        <PreviewCard d={draft} />
        <div style={{ fontSize: 11, color: 'var(--tx3)', lineHeight: 1.5 }}>This is exactly how it appears in the KinetikCircle feed — authored by KinetikCircle, reactable, no action required.</div>
      </div>
    </div>
  )
}

function Field({ label, hint, children, style }: { label: string; hint?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, ...style }}>
      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--tx2)' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{hint}</span>}
    </label>
  )
}

// ── Library ───────────────────────────────────────────────────
function LibraryTab({ onClone }: { onClone: (it: LibraryItem) => void }) {
  const [fFormat, setFFormat] = useState<BFormat | 'all'>('all')
  const [fTheme, setFTheme] = useState<BTheme | 'all'>('all')
  const items = LIBRARY.filter(i => (fFormat === 'all' || i.format === fFormat) && (fTheme === 'all' || i.theme === fTheme))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <LibraryIcon size={15} />
        <div>A starter bank you <b>mix &amp; match</b> — {FORMATS.length} formats × {THEMES.length} themes. Clone one, tweak the copy, add your media, schedule. Grow the bank freely in <span className="src">data/broadcast.ts</span>.</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className={'chip' + (fFormat === 'all' ? ' on' : '')} style={fFormat === 'all' ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : undefined} onClick={() => setFFormat('all')}>All formats</button>
          {FORMATS.map(f => <button key={f.key} className={'chip' + (fFormat === f.key ? ' on' : '')} style={fFormat === f.key ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : undefined} onClick={() => setFFormat(f.key)}>{f.emoji} {f.label}</button>)}
        </div>
        <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
          <button className={'chip' + (fTheme === 'all' ? ' on' : '')} style={fTheme === 'all' ? { background: 'var(--tx)', color: 'var(--bg)', borderColor: 'var(--tx)' } : undefined} onClick={() => setFTheme('all')}>All themes</button>
          {THEMES.map(t => <button key={t.key} className={'chip' + (fTheme === t.key ? ' on' : '')} style={fTheme === t.key ? { background: t.accent, color: '#fff', borderColor: t.accent } : undefined} onClick={() => setFTheme(t.key)}>{t.emoji} {t.label}</button>)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
        {items.map(it => {
          const t = themeDef(it.theme), f = formatDef(it.format)
          return (
            <div key={it.id} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8, borderTop: `3px solid ${t.accent}` }}>
              <span className="row" style={{ gap: 6, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: t.accent }}>{f.emoji} {f.label} · {t.label}</span>
              <div style={{ fontSize: 14, fontWeight: 700 }}>{it.emoji} {it.title}</div>
              <div style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5, whiteSpace: 'pre-wrap', flex: 1 }}>{it.body}</div>
              {it.source && <div style={{ fontSize: 11, color: 'var(--tx3)' }}>— {it.source}</div>}
              <button className="chip" style={{ gap: 5, alignSelf: 'flex-start', background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }} onClick={() => onClone(it)}><Pencil size={12} /> Clone &amp; edit</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Research ──────────────────────────────────────────────────
function Research({ onUse }: { onUse: (theme: BTheme, format: BFormat) => void }) {
  const byWeek = useMemo(() => {
    const m = new Map<string, typeof RESEARCH>()
    for (const r of RESEARCH) { const a = m.get(r.week) || []; a.push(r); m.set(r.week, a) }
    return Array.from(m.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="insight tl" style={{ alignItems: 'center' }}>
        <FlaskConical size={15} />
        <div>The <b>research desk</b> tracks what’s going viral each week so you can steer the format. Update the weekly list in <span className="src">data/broadcast.ts</span>, then author straight from a trend.</div>
      </div>

      {byWeek.map(([week, items]) => (
        <div key={week} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="row" style={{ gap: 8, fontSize: 12, fontWeight: 700, color: 'var(--tx2)' }}>
            <span className="src">{week}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
            {items.map((r, i) => {
              const t = themeDef(r.theme)
              return (
                <div key={i} className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9, borderTop: `3px solid ${t.accent}` }}>
                  <div className="spread" style={{ alignItems: 'center' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: t.accent }}>{t.emoji} {t.label}</span>
                    {r.hot && <span className="pill" style={{ fontSize: 10, color: '#EF4444' }}><Flame size={11} style={{ verticalAlign: -1 }} /> trending</span>}
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{r.trend}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.5 }}>{r.note}</div>
                  <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
                    {r.formats.map(fk => (
                      <button key={fk} className="chip" style={{ gap: 5 }} onClick={() => onUse(r.theme, fk)}>
                        {formatDef(fk).emoji} {formatDef(fk).label} <ArrowUpRight size={11} />
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Shared bits ───────────────────────────────────────────────
function Stepper({ value, set, min = 1, max = 40, step = 1 }: { value: number; set: (n: number) => void; min?: number; max?: number; step?: number }) {
  const clamp = (n: number) => Math.max(min, Math.min(max, n))
  return (
    <div className="row" style={{ gap: 0, border: '1px solid var(--bd2)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
      <button className="chip" style={{ border: 'none', borderRadius: 0, padding: '7px 11px' }} onClick={() => set(clamp(value - step))}><Minus size={13} /></button>
      <span style={{ minWidth: 40, textAlign: 'center', fontSize: 13, fontWeight: 700 }}>{value}</span>
      <button className="chip" style={{ border: 'none', borderRadius: 0, padding: '7px 11px' }} onClick={() => set(clamp(value + step))}><Plus size={13} /></button>
    </div>
  )
}

function CopyButton({ text, label = 'Copy prompt', big }: { text: string; label?: string; big?: boolean }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try { await navigator.clipboard.writeText(text) }
    catch {
      const ta = document.createElement('textarea'); ta.value = text
      ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* ignore */ }
      document.body.removeChild(ta)
    }
    setDone(true); setTimeout(() => setDone(false), 1800)
  }
  return (
    <button className="chip" style={{ gap: 6, padding: big ? '9px 16px' : undefined, fontSize: big ? 13 : undefined, fontWeight: 700, background: done ? '#10B981' : 'var(--acc)', color: '#fff', borderColor: 'transparent' }} onClick={copy}>
      {done ? <><Check size={14} /> Copied to clipboard</> : <><Copy size={big ? 14 : 13} /> {label}</>}
    </button>
  )
}

// ── Prompts (the LLM content engine) ──────────────────────────
const LLM_LINKS = [
  { label: 'ChatGPT', url: 'https://chat.openai.com/' },
  { label: 'Claude', url: 'https://claude.ai/new' },
  { label: 'Gemini', url: 'https://gemini.google.com/app' },
]

function PromptsTab({ onImport }: { onImport: () => void }) {
  const [goal, setGoal] = useState<PromptGoal>('virality')
  const [packId, setPackId] = useState<string>(packsByGoal('virality')[0].id)
  const [count, setCount] = useState(10)
  const [format, setFormat] = useState<BFormat>('fact')
  const [theme, setTheme] = useState<BTheme>('funfacts')

  const packs = packsByGoal(goal)
  const pack: PromptPack = packs.find(p => p.id === packId) || packs[0]
  const pickGoal = (g: PromptGoal) => { setGoal(g); setPackId(packsByGoal(g)[0].id) }
  const prompt = buildPrompt(pack, { count, format, theme })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="insight tl" style={{ alignItems: 'flex-start' }}>
        <Wand2 size={15} style={{ marginTop: 2 }} />
        <div>
          <b>The content engine.</b> No API needed — pick a goal &amp; pack, copy the prompt, paste it into any LLM, then bring its answer to the <b>Import</b> tab to drip-schedule weeks of feed. Every prompt is tuned for stop-the-scroll hooks &amp; re-shares.
          <div className="row" style={{ gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--tx3)' }}>Open an LLM:</span>
            {LLM_LINKS.map(l => (
              <a key={l.label} className="chip" style={{ gap: 5, textDecoration: 'none' }} href={l.url} target="_blank" rel="noreferrer">
                {l.label} <ExternalLink size={11} />
              </a>
            ))}
          </div>
        </div>
      </div>

      {/* goal picker */}
      <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
        {GOALS.map(g => (
          <button key={g.key} className={'chip' + (goal === g.key ? ' on' : '')}
            style={goal === g.key ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : undefined}
            onClick={() => pickGoal(g.key)} title={g.blurb}>{g.emoji} {g.label}</button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,340px) minmax(0,1fr)', gap: 16, alignItems: 'start' }} className="bc-studio">
        {/* pack list */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {packs.map(p => {
            const on = p.id === pack.id
            return (
              <button key={p.id} className="card" onClick={() => setPackId(p.id)}
                style={{ padding: 13, textAlign: 'left', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5, borderColor: on ? 'var(--acc)' : undefined, boxShadow: on ? '0 0 0 1px var(--acc) inset' : undefined }}>
                <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.emoji} {p.title}</div>
                <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.45 }}>{p.blurb}</div>
                <div style={{ fontSize: 10.5, color: 'var(--tx3)', lineHeight: 1.4, fontStyle: 'italic' }}>{p.why}</div>
              </button>
            )
          })}
        </div>

        {/* composer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 8 }}>
          <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {pack.usesCount && (
                <Field label="How many?" style={{ flex: 'none' }}>
                  <Stepper value={count} set={setCount} min={1} max={40} />
                </Field>
              )}
            </div>
            {pack.usesFormat && (
              <Field label="Format" hint={formatDef(format).hint}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {FORMATS.map(f => (
                    <button key={f.key} className={'chip' + (format === f.key ? ' on' : '')}
                      style={format === f.key ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : undefined}
                      onClick={() => setFormat(f.key)}>{f.emoji} {f.label}</button>
                  ))}
                </div>
              </Field>
            )}
            {pack.usesTheme && (
              <Field label="Theme" hint={themeDef(theme).blurb}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {THEMES.map(t => (
                    <button key={t.key} className={'chip' + (theme === t.key ? ' on' : '')}
                      style={theme === t.key ? { background: t.accent, color: '#fff', borderColor: t.accent } : undefined}
                      onClick={() => setTheme(t.key)}>{t.emoji} {t.label}</button>
                  ))}
                </div>
              </Field>
            )}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="spread" style={{ alignItems: 'center', padding: '11px 14px', borderBottom: '1px solid var(--bd)' }}>
              <span className="row" style={{ gap: 6, fontSize: 11.5, fontWeight: 700, color: 'var(--tx2)' }}><Wand2 size={13} /> Your prompt</span>
              <CopyButton text={prompt} />
            </div>
            <pre style={{ margin: 0, padding: 14, fontSize: 11.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 360, overflowY: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', color: 'var(--tx2)' }}>{prompt}</pre>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <CopyButton text={prompt} big />
            {pack.goal !== 'research' && (
              <button className="chip" style={{ gap: 6 }} onClick={onImport}>
                Paste the answer into Import <ArrowUpRight size={13} />
              </button>
            )}
            {pack.goal === 'research' && (
              <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Use the results to update the Research desk &amp; steer what you author.</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Import (paste LLM output → drip-schedule) ─────────────────
type ImportMode = 'draft' | 'publish' | 'drip'

function ImportTab({ onSaved, onMsg }: { onSaved: (m: string) => void; onMsg: (m: string) => void }) {
  const [raw, setRaw] = useState('')
  const [parsed, setParsed] = useState<ReturnType<typeof parseImport> | null>(null)
  const [mode, setMode] = useState<ImportMode>('drip')
  const [start, setStart] = useState('')
  const [gapHours, setGapHours] = useState(12)
  const [busy, setBusy] = useState(false)

  const posts: ParsedPost[] = parsed?.posts ?? []
  const doParse = () => setParsed(parseImport(raw))

  const scheduleAt = (i: number): string | null => {
    if (mode !== 'drip') return null
    const base = start ? new Date(start) : new Date()
    return new Date(base.getTime() + i * gapHours * 3600_000).toISOString()
  }
  const lastWhen = posts.length > 1 ? scheduleAt(posts.length - 1) : null

  const save = async () => {
    if (!posts.length) return
    if (!cloudEnabled) { onMsg('Offline — connect Supabase & sign in as operator to import to live feeds.'); return }
    if (mode === 'drip' && !start) { onMsg('Pick a start time for the drip schedule first.'); return }
    setBusy(true)
    const status = mode === 'publish' ? 'published' : mode === 'drip' ? 'scheduled' : 'draft'
    const items: BroadcastInput[] = posts.map((p, i) => ({
      format: p.format, theme: p.theme, title: p.title, body: p.body || null,
      media_kind: 'none', media_url: null, source: p.source || null,
      emoji: p.emoji || null, accent: p.accent, audience: p.audience,
      status, publish_at: scheduleAt(i),
    }))
    const { ok, fail } = await live.saveBroadcastBatch(items)
    setBusy(false)
    const tail = mode === 'drip' ? ' — drip-scheduled' : mode === 'publish' ? ' — live in every feed now' : ' — saved as drafts'
    onSaved(`Imported ${ok} post${ok === 1 ? '' : 's'}${fail ? ` (${fail} failed)` : ''}${tail}.`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="insight tl" style={{ alignItems: 'flex-start' }}>
        <ClipboardPaste size={15} style={{ marginTop: 2 }} />
        <div><b>Bulk import.</b> Paste the JSON the LLM returned (from a <b>Prompts</b> pack). We parse it into ready cards, then you drip-schedule them so the feed stays fresh daily — the heart of the retention loop.</div>
      </div>

      <Field label="Paste the LLM output (the JSON array)">
        <textarea value={raw} onChange={e => setRaw(e.target.value)} rows={8}
          placeholder='[ { "format": "fact", "theme": "animals", "emoji": "🐙", "title": "...", "body": "...", "source": "" } ]'
          style={{ ...inp, resize: 'vertical', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: 1.5 }} />
      </Field>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
        <button className="chip" style={{ gap: 6, background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }} onClick={doParse}><ListChecks size={13} /> Parse cards</button>
        {raw && <button className="chip" style={{ gap: 6 }} onClick={() => { setRaw(''); setParsed(null) }}>Clear</button>}
      </div>

      {parsed?.error && (
        <div className="banner" style={{ position: 'static', borderRadius: 12 }}>{parsed.error}</div>
      )}

      {posts.length > 0 && (
        <>
          <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="row" style={{ gap: 8, fontSize: 13, fontWeight: 700 }}>
              <Check size={15} style={{ color: '#10B981' }} /> {posts.length} card{posts.length === 1 ? '' : 's'} ready
              {parsed && parsed.skipped > 0 && <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--tx3)' }}>· {parsed.skipped} skipped (missing title)</span>}
            </div>

            <Field label="How should they go out?">
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {([['drip', 'Drip-schedule'], ['draft', 'Save as drafts'], ['publish', 'Publish all now']] as [ImportMode, string][]).map(([m, label]) => (
                  <button key={m} className={'chip' + (mode === m ? ' on' : '')}
                    style={mode === m ? { background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' } : undefined}
                    onClick={() => setMode(m)}>{label}</button>
                ))}
              </div>
            </Field>

            {mode === 'drip' && (
              <div className="row" style={{ gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                <Field label="First post goes live" style={{ flex: 'none' }}>
                  <input type="datetime-local" value={start} onChange={e => setStart(e.target.value)} style={{ ...inp, width: 'auto' }} />
                </Field>
                <Field label="Then every (hours)" style={{ flex: 'none' }}>
                  <Stepper value={gapHours} set={setGapHours} min={1} max={168} />
                </Field>
                {start && lastWhen && (
                  <div style={{ fontSize: 11.5, color: 'var(--tx3)', paddingBottom: 8 }}>
                    Spreads to <b>{fmtWhen(lastWhen)}</b> · ~{(24 / gapHours).toFixed(gapHours >= 24 ? 1 : 0)}/day
                  </div>
                )}
              </div>
            )}
            {mode === 'publish' && <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>All {posts.length} go live in every circle’s feed immediately.</div>}
            {mode === 'draft' && <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Saved to drafts — review &amp; publish from the Catalogue.</div>}

            <div>
              <button className="chip" disabled={busy} onClick={save}
                style={{ gap: 6, padding: '9px 16px', fontWeight: 700, background: 'var(--acc)', color: '#fff', borderColor: 'var(--acc)' }}>
                <Send size={14} /> {busy ? 'Importing…' : `Import ${posts.length} card${posts.length === 1 ? '' : 's'}`}
              </button>
              {!cloudEnabled && <span style={{ fontSize: 11, color: 'var(--tx3)', marginLeft: 10 }}>Connect Supabase &amp; sign in as operator to enable.</span>}
            </div>
          </div>

          {/* preview of parsed cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 12 }}>
            {posts.map((p, i) => {
              const t = themeDef(p.theme), f = formatDef(p.format)
              return (
                <div key={i} className="card" style={{ padding: 13, display: 'flex', flexDirection: 'column', gap: 7, borderTop: `3px solid ${p.accent}` }}>
                  <div className="spread" style={{ alignItems: 'center' }}>
                    <span className="row" style={{ gap: 6, fontSize: 10, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase', color: t.accent }}>{f.emoji} {f.label} · {t.label}</span>
                    {mode === 'drip' && start && <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{fmtWhen(scheduleAt(i))}</span>}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700 }}>{p.emoji} {p.title}</div>
                  {p.body && <div style={{ fontSize: 12, color: 'var(--tx2)', lineHeight: 1.45, whiteSpace: 'pre-wrap', display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.body}</div>}
                  {p.source && <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>— {p.source}</div>}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
