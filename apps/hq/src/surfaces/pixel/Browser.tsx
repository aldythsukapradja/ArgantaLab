import { useMemo, useState } from 'react'
import { X, ExternalLink } from 'lucide-react'
import { vaultQuery, vaultFacets, vaultSimilar, TIERS } from '../../data/pixel/engine'
import type { QueryFilter, VaultItem } from '../../data/pixel/types'
import { Swatch, TierChip, AnimBadge } from './parts'

// Facet keys shown in the rail, in order. `animated` is boolean-ish via a value.
const FACET_ORDER = ['domain', 'kind', 'theme', 'characterType', 'style', 'tier', 'source'] as const
type FacetKey = typeof FACET_ORDER[number]

// map a facet click to a QueryFilter key
const FILTER_KEY: Record<FacetKey, keyof QueryFilter> = {
  domain: 'domain', kind: 'kind', theme: 'theme', characterType: 'characterType', style: 'style', tier: 'tier', source: 'source',
}

export function Browser({ base, data, title, blurb }: { base: QueryFilter; data: VaultItem[]; title: string; blurb: string }) {
  const [sel, setSel] = useState<Partial<Record<FacetKey, string>>>({})
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<VaultItem | null>(null)

  const filter: QueryFilter = useMemo(() => {
    const f: QueryFilter = { ...base, q: q || undefined, includeUnverified: true }
    for (const k of FACET_ORDER) { const v = sel[k]; if (v) (f as Record<string, unknown>)[FILTER_KEY[k]] = k === 'tier' ? v : v }
    return f
  }, [base, sel, q])

  const facets = useMemo(() => vaultFacets({ ...filter, q: undefined }, data), [filter, data])
  const res = useMemo(() => vaultQuery(filter, data), [filter, data])

  const toggle = (k: FacetKey, v: string) => setSel(s => ({ ...s, [k]: s[k] === v ? undefined : v }))
  const activeCount = Object.values(sel).filter(Boolean).length

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '210px 1fr', gap: 14, alignItems: 'start' }}>
      {/* facet rail */}
      <div className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 8 }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: 2, lineHeight: 1.4 }}>{blurb}</div>
        </div>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name / tag / id…" style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid var(--bd2)', background: 'var(--bg)', color: 'var(--tx)' }} />
        {activeCount > 0 && <button onClick={() => setSel({})} style={{ fontSize: 10.5, color: 'var(--acc-text)', cursor: 'pointer', textAlign: 'left' }}>✕ clear {activeCount} filter{activeCount > 1 ? 's' : ''}</button>}
        {FACET_ORDER.map(k => {
          const rows = facets.facets[k] ?? []
          if (!rows.length) return null
          return (
            <div key={k}>
              <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--tx3)', marginBottom: 4 }}>{k}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {rows.slice(0, 8).map(r => {
                  const on = sel[k] === r.value
                  return (
                    <button key={r.value} onClick={() => toggle(k, r.value)} style={{ display: 'flex', justifyContent: 'space-between', gap: 6, fontSize: 11.5, padding: '3px 6px', borderRadius: 6, cursor: 'pointer', border: '1px solid ' + (on ? 'var(--acc)' : 'transparent'), background: on ? 'var(--bg3)' : 'transparent', color: on ? 'var(--acc-text)' : 'var(--tx2)' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{on ? '☑ ' : ''}{r.value}</span>
                      <span style={{ fontFamily: 'var(--mono)', color: 'var(--tx3)' }}>{r.count}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="spread" style={{ fontSize: 12, color: 'var(--tx2)' }}>
          <span><b style={{ color: 'var(--tx)', fontFamily: 'var(--mono)' }}>{res.total}</b> item{res.total !== 1 ? 's' : ''}{activeCount || q ? ' · filtered' : ''}</span>
          <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>real art where owned/CC0 · generated stand-in for un-downloaded refs</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(132px,1fr))', gap: 10 }}>
          {res.items.map(it => (
            <button key={it.id} onClick={() => setOpen(it)} style={{ cursor: 'pointer', textAlign: 'left', border: '1px solid var(--bd2)', borderRadius: 'var(--r-lg)', background: 'var(--bg)', padding: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'center' }}><Swatch item={it} px={100} /></div>
              <div style={{ fontSize: 11.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.name}</div>
              <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>
                <TierChip tier={it.source.tier} small />
                <span style={{ fontSize: 9.5, color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>{it.form.size.w}×{it.form.size.h}</span>
              </div>
              <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
                <span className="pill pill-mut" style={{ fontSize: 9 }}>{it.curated.kind}</span>
                {it.curated.groupId && <span className="pill" style={{ fontSize: 9, background: 'var(--bg3)', color: 'var(--acc-text)' }}>◇ {it.curated.groupId}</span>}
                <AnimBadge item={it} />
              </div>
            </button>
          ))}
          {!res.items.length && <div style={{ gridColumn: '1/-1', textAlign: 'center', color: 'var(--tx3)', fontSize: 12, padding: 40 }}>No items match. Clear a filter to widen.</div>}
        </div>
      </div>

      {open && <Inspector item={open} data={data} onClose={() => setOpen(null)} onPick={setOpen} />}
    </div>
  )
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', gap: 12, padding: '6px 0', borderTop: '1px solid var(--bd)' }}>
      <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{k}</span>
      <span style={{ fontSize: 11.5, fontWeight: 600, textAlign: 'right', fontFamily: mono ? 'var(--mono)' : 'inherit' }}>{v}</span>
    </div>
  )
}

function Inspector({ item, data, onClose, onPick }: { item: VaultItem; data: VaultItem[]; onClose: () => void; onPick: (i: VaultItem) => void }) {
  const t = TIERS[item.source.tier]
  const sim = vaultSimilar(item.id, 8, data)
  const similar = (sim as { similar?: VaultItem[] }).similar ?? []
  const promptText = `pixel art, ${item.curated.kind}${item.curated.characterType ? ' (' + item.curated.characterType + ')' : ''}, ${item.curated.theme.join('/')}, ${item.curated.style ?? ''} style, ${item.form.size.w}x${item.form.size.h}, style reference: ${item.name} [${item.source.name}]`
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)', zIndex: 60 }}>
      <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 'min(460px,100vw)', background: 'var(--bg2)', borderLeft: '1px solid var(--bd2)', display: 'flex', flexDirection: 'column' }}>
        <div className="spread" style={{ padding: '12px 14px', borderBottom: '1px solid var(--bd)' }}>
          <div className="row" style={{ gap: 8 }}><Swatch item={item} px={40} /><div><div style={{ fontSize: 13, fontWeight: 700 }}>{item.name}</div><div style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>{item.id}</div></div></div>
          <button onClick={onClose} aria-label="Close" style={{ cursor: 'pointer', color: 'var(--tx2)' }}><X size={16} /></button>
        </div>
        <div style={{ padding: 14, overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="row" style={{ gap: 8 }}><TierChip tier={item.source.tier} /><span style={{ fontSize: 11, color: t.shippable ? 'var(--ok)' : 'var(--warn)' }}>{t.shippable ? 'shippable as-is' : 'reference only'}{t.attribution ? ' · credit required' : ''}</span></div>
          <div className={'insight ' + (t.shippable ? 'ok' : 'warn')} style={{ alignItems: 'flex-start' }}><div><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--tx3)' }}>License policy</div><div style={{ fontSize: 11.5, marginTop: 2, lineHeight: 1.5 }}>{t.rule}</div></div></div>

          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--tx3)', marginBottom: 4 }}>Curated</div>
            <Row k="domain" v={item.curated.domain.join(', ')} />
            <Row k="kind" v={item.curated.kind} />
            {item.curated.characterType && <Row k="character" v={item.curated.characterType} />}
            <Row k="theme" v={item.curated.theme.join(', ')} />
            {item.curated.style && <Row k="style" v={item.curated.style} />}
            {item.curated.groupId && <Row k="group" v={item.curated.groupId} mono />}
            <Row k="verified" v={item.curated.verified ? '✓ classified' : '~ adapter-guessed'} />
          </div>
          <div className="row" style={{ gap: 5, flexWrap: 'wrap' }}>{item.curated.tags.map(tg => <span key={tg} className="pill pill-mut" style={{ fontSize: 10 }}>{tg}</span>)}</div>

          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--tx3)', marginBottom: 4 }}>Form</div>
            <Row k="size" v={`${item.form.size.w}×${item.form.size.h}`} mono />
            {item.form.perspective && <Row k="perspective" v={item.form.perspective} />}
            {item.form.swatch && <div className="row" style={{ gap: 3, paddingTop: 8 }}>{item.form.swatch.map((c, i) => <span key={i} title={c} style={{ width: 20, height: 20, borderRadius: 4, background: c, border: '1px solid var(--bd2)' }} />)}</div>}
          </div>

          {item.animations.length > 0 && (
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--tx3)', marginBottom: 4 }}>Animations</div>
              {item.animations.map(a => <Row key={a.name} k={a.name} v={`${a.frames}f · ${a.fps}fps · ${a.directions}dir${a.loop ? ' · loop' : ''}`} mono />)}
            </div>
          )}

          <div>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--tx3)', marginBottom: 4 }}>Source</div>
            <Row k="source" v={item.source.name} />
            {item.source.pack && <Row k="pack" v={item.source.pack} />}
            {item.source.author && <Row k="author" v={item.source.author} />}
            <Row k="license" v={item.source.license} mono />
            <a href={item.source.url} target="_blank" rel="noreferrer" className="row" style={{ gap: 5, fontSize: 11, color: 'var(--acc-text)', paddingTop: 8 }}>{item.source.url} <ExternalLink size={11} /></a>
          </div>

          <div className="insight" style={{ background: 'var(--bg3)', alignItems: 'flex-start' }}>
            <div style={{ width: '100%' }}><div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--tx3)' }}>PixelLab generation prompt</div>
              <div style={{ fontSize: 11, marginTop: 4, fontFamily: 'var(--mono)', lineHeight: 1.5, color: 'var(--tx2)', wordBreak: 'break-word' }}>{promptText}</div>
              <button onClick={() => navigator.clipboard?.writeText(promptText)} style={{ marginTop: 6, fontSize: 11, cursor: 'pointer', color: 'var(--acc-text)', border: '1px solid var(--bd2)', borderRadius: 6, padding: '3px 8px', background: 'var(--bg)' }}>Copy prompt</button>
            </div>
          </div>

          {similar.length > 0 && (
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--tx3)', marginBottom: 6 }}>Similar / same group</div>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap' }}>
                {similar.map(s => <button key={s.id} onClick={() => onPick(s)} title={s.name} style={{ cursor: 'pointer', border: '1px solid var(--bd2)', borderRadius: 8, padding: 3, background: 'var(--bg)' }}><Swatch item={s} px={40} /></button>)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
