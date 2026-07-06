// HQ Vault — Bases-lite: the vault as a founder database. Sortable columns,
// product/status/tag filters, table ⇄ card toggle.

import { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, Table2, LayoutGrid, Database } from 'lucide-react'
import { useVault } from '../store'
import { sortNotes, filterNotes, type SortKey } from '../storage'
import { wordCount } from '../markdown'
import type { Product, NoteStatus } from '../types'
import { PRODUCTS, PRODUCT_COLOR, STATUS_LABEL } from '../types'

const STATUSES: NoteStatus[] = ['seed', 'draft', 'active', 'shipped', 'archived']
const CONF_COLOR = { low: 'var(--v-bad)', medium: 'var(--v-warn)', high: 'var(--v-ok)' } as const

const COLS: { key: SortKey | 'type' | 'tags'; label: string; sortable: boolean }[] = [
  { key: 'title', label: 'Title', sortable: true },
  { key: 'product', label: 'Product', sortable: true },
  { key: 'type', label: 'Type', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'tags', label: 'Tags', sortable: false },
  { key: 'updated', label: 'Updated', sortable: true },
  { key: 'confidence', label: 'Confidence', sortable: true },
]

export function BasesView() {
  const notes = useVault(s => s.notes)
  const openNote = useVault(s => s.openNote)
  const [sortKey, setSortKey] = useState<SortKey>('updated')
  const [dir, setDir] = useState<1 | -1>(-1)
  const [product, setProduct] = useState<Product | 'all'>('all')
  const [status, setStatus] = useState<NoteStatus | 'all'>('all')
  const [tag, setTag] = useState<string>('all')
  const [mode, setMode] = useState<'table' | 'cards'>('table')

  const allTags = useMemo(() => {
    const t = new Set<string>()
    for (const n of Object.values(notes)) for (const g of n.fm.tags) t.add(g)
    return [...t].sort()
  }, [notes])

  const rows = useMemo(() => {
    const filtered = filterNotes(Object.values(notes), { product, status, tag })
    return sortNotes(filtered, sortKey, dir)
  }, [notes, product, status, tag, sortKey, dir])

  const clickSort = (key: SortKey) => {
    if (sortKey === key) setDir(d => (d === 1 ? -1 : 1))
    else { setSortKey(key); setDir(key === 'updated' ? -1 : 1) }
  }

  return (
    <div className="vb">
      <div className="vb-bar">
        <div className="vb-title"><Database size={14} /> <b>Founder base</b> <span className="v-dim">{rows.length} of {Object.keys(notes).length} notes</span></div>
        <div className="vb-filters">
          <select className="vg-select" value={product} onChange={e => setProduct(e.target.value as Product | 'all')} aria-label="Filter by product">
            <option value="all">all products</option>
            {PRODUCTS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select className="vg-select" value={status} onChange={e => setStatus(e.target.value as NoteStatus | 'all')} aria-label="Filter by status">
            <option value="all">all statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
          <select className="vg-select" value={tag} onChange={e => setTag(e.target.value)} aria-label="Filter by tag">
            <option value="all">all tags</option>
            {allTags.map(t => <option key={t} value={t}>#{t}</option>)}
          </select>
          <div className="vb-mode">
            <button className={mode === 'table' ? 'on' : ''} onClick={() => setMode('table')} title="Table"><Table2 size={13} /></button>
            <button className={mode === 'cards' ? 'on' : ''} onClick={() => setMode('cards')} title="Cards"><LayoutGrid size={13} /></button>
          </div>
        </div>
      </div>

      {mode === 'table' ? (
        <div className="vb-tablewrap">
          <table className="vb-table">
            <thead>
              <tr>
                {COLS.map(c => (
                  <th key={c.key} className={c.sortable ? 'sortable' : ''}
                    onClick={c.sortable ? () => clickSort(c.key as SortKey) : undefined}>
                    <span>{c.label}</span>
                    {sortKey === c.key && (dir === 1 ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(n => (
                <tr key={n.id} onClick={() => openNote(n.id)}>
                  <td className="vb-t">
                    <span className="vp-dot" style={{ background: PRODUCT_COLOR[n.fm.product] }} />
                    {n.fm.title}
                  </td>
                  <td><span className="v-badge" style={{ color: PRODUCT_COLOR[n.fm.product] }}>{n.fm.product}</span></td>
                  <td className="v-dim">{n.fm.type}</td>
                  <td><span className={'vb-status s-' + n.fm.status}>{STATUS_LABEL[n.fm.status]}</span></td>
                  <td className="vb-tags">{n.fm.tags.slice(0, 3).map(t => <span key={t} className="v-tag">#{t}</span>)}</td>
                  <td className="v-dim vb-num">{n.fm.updated}</td>
                  <td><span className="vb-conf" style={{ color: CONF_COLOR[n.fm.confidence] }}>● {n.fm.confidence}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && <div className="vg-empty" style={{ position: 'static', padding: 40 }}>No notes match these filters.</div>}
        </div>
      ) : (
        <div className="vb-cards">
          {rows.map(n => (
            <button key={n.id} className="vb-card" onClick={() => openNote(n.id)}>
              <div className="vb-card-top">
                <span className="vp-dot" style={{ background: PRODUCT_COLOR[n.fm.product] }} />
                <span className="vb-card-t">{n.fm.title}</span>
              </div>
              <div className="vb-card-body">
                {n.body.replace(/^#.*$/m, '').replace(/[#>*\[\]`|]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120)}…
              </div>
              <div className="vb-card-foot">
                <span className={'vb-status s-' + n.fm.status}>{STATUS_LABEL[n.fm.status]}</span>
                <span className="v-dim">{wordCount(n.body)}w · {n.fm.updated}</span>
              </div>
            </button>
          ))}
          {rows.length === 0 && <div className="vg-empty" style={{ position: 'static', padding: 40 }}>No notes match these filters.</div>}
        </div>
      )}
    </div>
  )
}
