import { useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { ImagePlus, RefreshCw, Save, Trash2 } from 'lucide-react'
import { blankLashiraArtItem, type LashiraArtItem, type LashiraArtStatus } from '../../data/lashira/art'
import { deleteLashiraArt, fileToDataUrl, loadLashiraArt, loadLashiraArtImage, saveLashiraArt } from '../../data/lashira/artCloud'

const STATUSES: LashiraArtStatus[] = ['wired', 'placeholder', 'needs-polish', 'active', 'published', 'deprecated']

// EGRESS FIX: the list no longer carries `imageData` (see artCloud.ts) — only
// the slot open in the detail panel fetches its real bytes. A grid item that
// HAS art but hasn't been opened yet shows a badge instead of the real pixels;
// the detail panel's own Preview pops in the true thumbnail once it loads.
function Preview({ item }: { item: LashiraArtItem }) {
  if (item.imageData) {
    return <img src={item.imageData} alt={item.label} style={{ width: 64, height: 64, objectFit: 'contain', imageRendering: 'pixelated', background: 'repeating-conic-gradient(#eef 0 25%, #fff 0 50%) 0 0/10px 10px', borderRadius: 8, border: '1px solid var(--bd2)' }} />
  }
  return (
    <div style={{ width: 64, height: 64, display: 'grid', placeItems: 'center', border: '1px dashed var(--bd2)', borderRadius: 8, color: 'var(--tx3)', fontSize: 10, textAlign: 'center', background: 'var(--bg)' }}>
      {item.hasImage ? '🖼 asset' : 'procedural'}
    </div>
  )
}

export function LashiraBloomArt() {
  const [items, setItems] = useState<LashiraArtItem[]>([])
  const [source, setSource] = useState<'cloud' | 'local' | 'seed'>('seed')
  const [selected, setSelected] = useState<LashiraArtItem | null>(null)
  const [query, setQuery] = useState('')
  const [cat, setCat] = useState('all')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  async function refresh() {
    setBusy(true)
    try {
      const res = await loadLashiraArt()
      setItems(res.items)
      setSource(res.source)
      setSelected(s => s ? res.items.find(i => i.slotKey === s.slotKey) ?? s : res.items[0] ?? null)
    } finally { setBusy(false) }
  }

  useEffect(() => { refresh() }, [])

  // Selecting a grid item for editing is the ONE place the real bytes are
  // needed — fetch just this slot's image_data if it has art we haven't
  // loaded yet (list rows never carry it; see the Preview badge above).
  useEffect(() => {
    if (!selected || selected.imageData || !selected.hasImage) return
    let live = true
    const slotKey = selected.slotKey
    loadLashiraArtImage(slotKey).then(imageData => {
      if (live && imageData) setSelected(s => (s && s.slotKey === slotKey ? { ...s, imageData } : s))
    })
    return () => { live = false }
  }, [selected?.slotKey])

  const categories = useMemo(() => ['all', ...Array.from(new Set(items.map(i => i.category))).sort()], [items])
  const filtered = items.filter(i => {
    const text = `${i.slotKey} ${i.label} ${i.category} ${i.notes ?? ''}`.toLowerCase()
    return (cat === 'all' || i.category === cat) && (!query || text.includes(query.toLowerCase()))
  })

  async function save() {
    if (!selected) return
    setBusy(true); setMsg('')
    try {
      await saveLashiraArt(selected)
      setMsg('Saved')
      await refresh()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Save failed')
    } finally { setBusy(false) }
  }

  async function remove() {
    if (!selected) return
    setBusy(true); setMsg('')
    try {
      await deleteLashiraArt(selected)
      setMsg(selected.builtin ? 'Reset to default' : 'Deleted')
      setSelected(null)
      await refresh()
    } catch (err) {
      setMsg(err instanceof Error ? err.message : 'Delete failed')
    } finally { setBusy(false) }
  }

  async function pickFile(file: File | null) {
    if (!file || !selected) return
    const imageData = await fileToDataUrl(file)
    setSelected({ ...selected, imageData, renderer: 'asset', status: 'active' })
  }

  const update = <K extends keyof LashiraArtItem>(key: K, value: LashiraArtItem[K]) => {
    if (selected) setSelected({ ...selected, [key]: value })
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 420px)', gap: 14, alignItems: 'start' }}>
      <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800 }}>LashiraBloom Pixel Art</div>
            <div style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: 2 }}>Manual CRUD for Lashira-only slots. Built-ins reset instead of breaking the game.</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <span className="pill" style={{ fontSize: 9.5, background: source === 'cloud' ? 'rgba(34,197,94,.14)' : 'var(--bg3)', color: source === 'cloud' ? 'var(--ok)' : 'var(--tx3)' }}>{source}</span>
            <button onClick={refresh} disabled={busy} style={{ cursor: 'pointer', border: '1px solid var(--bd2)', borderRadius: 8, padding: '6px 9px', background: 'var(--bg)' }}><RefreshCw size={14} /></button>
          </div>
        </div>
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search Lashira art…" style={{ flex: 1, minWidth: 180, fontSize: 12, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--bd2)', background: 'var(--bg)', color: 'var(--tx)' }} />
          <select value={cat} onChange={e => setCat(e.target.value)} style={{ fontSize: 12, padding: '7px 9px', borderRadius: 8, border: '1px solid var(--bd2)', background: 'var(--bg)', color: 'var(--tx)' }}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => setSelected(blankLashiraArtItem())} style={{ cursor: 'pointer', border: '1px solid var(--bd2)', borderRadius: 8, padding: '7px 10px', background: 'var(--bg)', color: 'var(--acc-text)', fontWeight: 700 }}>Create</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 8 }}>
          {filtered.map(item => (
            <button key={item.slotKey} onClick={() => setSelected(item)} style={{ textAlign: 'left', cursor: 'pointer', border: '1px solid ' + (selected?.slotKey === item.slotKey ? 'var(--acc)' : 'var(--bd2)'), borderRadius: 10, background: selected?.slotKey === item.slotKey ? 'var(--bg3)' : 'var(--bg)', padding: 8, display: 'grid', gridTemplateColumns: '64px 1fr', gap: 9, minWidth: 0 }}>
              <Preview item={item} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                <div style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{item.slotKey}</div>
                <div className="row" style={{ gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  <span className="pill pill-mut" style={{ fontSize: 9 }}>{item.category}</span>
                  <span className="pill" style={{ fontSize: 9, background: item.imageData ? 'rgba(34,197,94,.14)' : 'var(--bg2)', color: item.imageData ? 'var(--ok)' : 'var(--tx3)' }}>{item.imageData ? 'asset' : item.renderer}</span>
                  {item.builtin && <span className="pill" style={{ fontSize: 9, background: 'var(--bg2)', color: 'var(--tx3)' }}>required</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 14, position: 'sticky', top: 8 }}>
        {selected ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="spread" style={{ gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>{selected.builtin ? 'Edit required slot' : 'Edit custom slot'}</div>
              <Preview item={selected} />
            </div>
            <Field label="Key"><input value={selected.slotKey} disabled={selected.builtin} onChange={e => update('slotKey', e.target.value)} /></Field>
            <Field label="Label"><input value={selected.label} onChange={e => update('label', e.target.value)} /></Field>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Category"><input value={selected.category} onChange={e => update('category', e.target.value)} /></Field>
              <Field label="Status">
                <select value={selected.status} onChange={e => update('status', e.target.value as LashiraArtStatus)}>
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <Field label="Width"><input type="number" value={selected.expectedW ?? ''} onChange={e => update('expectedW', e.target.value ? Number(e.target.value) : null)} /></Field>
              <Field label="Height"><input type="number" value={selected.expectedH ?? ''} onChange={e => update('expectedH', e.target.value ? Number(e.target.value) : null)} /></Field>
            </div>
            <Field label="Renderer"><input value={selected.renderer} onChange={e => update('renderer', e.target.value)} /></Field>
            <Field label="Source"><input value={selected.sourceFile ?? ''} onChange={e => update('sourceFile', e.target.value)} /></Field>
            <Field label="Notes"><textarea value={selected.notes ?? ''} onChange={e => update('notes', e.target.value)} rows={3} /></Field>
            <label className="row" style={{ gap: 8, justifyContent: 'center', cursor: 'pointer', border: '1px dashed var(--bd2)', borderRadius: 10, padding: 12, color: 'var(--acc-text)', fontWeight: 700, fontSize: 12 }}>
              <ImagePlus size={15} /> Replace PNG
              <input type="file" accept="image/png,image/webp,image/gif,image/jpeg" onChange={e => pickFile(e.currentTarget.files?.[0] ?? null)} style={{ display: 'none' }} />
            </label>
            <div className="row" style={{ gap: 8 }}>
              <button onClick={save} disabled={busy} className="row" style={{ flex: 1, justifyContent: 'center', gap: 6, cursor: 'pointer', border: 'none', borderRadius: 9, padding: '9px 10px', background: 'var(--acc)', color: '#fff', fontWeight: 800 }}><Save size={14} /> Save</button>
              <button onClick={remove} disabled={busy} className="row" style={{ justifyContent: 'center', gap: 6, cursor: 'pointer', border: '1px solid var(--bd2)', borderRadius: 9, padding: '9px 10px', background: 'var(--bg)', color: 'var(--bad)', fontWeight: 700 }}><Trash2 size={14} /> {selected.builtin ? 'Reset' : 'Delete'}</button>
            </div>
            {msg && <div style={{ fontSize: 11, color: msg === 'Saved' || msg.includes('Reset') || msg.includes('Deleted') ? 'var(--ok)' : 'var(--bad)' }}>{msg}</div>}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 30, color: 'var(--tx3)', fontSize: 12 }}>Pick an art slot or create a new one.</div>
        )}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactElement }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 10.5, color: 'var(--tx3)', fontWeight: 700 }}>
      {label}
      <div style={{ display: 'contents' }}>
        {children}
      </div>
    </label>
  )
}
