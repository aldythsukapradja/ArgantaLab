import { useState } from 'react'
import { usageSummary, listPalettes, ingestQueue } from '../../data/pixel/engine'
import type { UsageSite } from '../../data/pixel/types'

// ── Usage — the render-key coverage x-ray over the other Arganta apps ────────
const STATE_META: Record<UsageSite['state'], { c: string; label: string; dot: string }> = {
  wired: { c: 'var(--ok)', label: 'wired', dot: '●' },
  placeholder: { c: 'var(--warn)', label: 'placeholder', dot: '○' },
  missing: { c: 'var(--bad)', label: 'missing', dot: '✕' },
}
const APPS: UsageSite['app'][] = ['argantalab', 'kinetikcircle', 'landing', 'hq']

export function UsageView() {
  const [app, setApp] = useState<UsageSite['app'] | undefined>('argantalab')
  const s = usageSummary(app)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card" style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Render-key coverage</div>
          <div className="seg">
            {APPS.map(a => <button key={a} className={app === a ? 'on' : ''} onClick={() => setApp(a)}>{a}</button>)}
            <button className={app === undefined ? 'on' : ''} onClick={() => setApp(undefined)}>all</button>
          </div>
        </div>
        <div className="row" style={{ gap: 16, flexWrap: 'wrap' }}>
          <Stat n={`${s.pct}%`} label="wired" c="var(--ok)" />
          <Stat n={s.wired} label="wired" c="var(--ok)" />
          <Stat n={s.placeholder} label="placeholder" c="var(--warn)" />
          <Stat n={s.missing} label="missing" c="var(--bad)" />
          <Stat n={s.total} label="sites" />
        </div>
        <div style={{ height: 8, borderRadius: 5, overflow: 'hidden', display: 'flex', background: 'var(--bg3)' }}>
          <div style={{ width: `${(s.wired / s.total) * 100}%`, background: 'var(--ok)' }} />
          <div style={{ width: `${(s.placeholder / s.total) * 100}%`, background: 'var(--warn)' }} />
          <div style={{ width: `${(s.missing / s.total) * 100}%`, background: 'var(--bad)' }} />
        </div>
        <div style={{ fontSize: 10.5, color: 'var(--tx3)' }}>Auto-scanned from each app's source render keys — a placeholder is a procedural shape awaiting a bespoke sprite; missing has no data behind it either.</div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {s.sites.map(site => {
          const m = STATE_META[site.state]
          return (
            <div key={site.id} className="spread" style={{ padding: '9px 14px', borderTop: '1px solid var(--bd)', gap: 10, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div className="row" style={{ gap: 8 }}>
                  <span style={{ color: m.c, fontWeight: 700 }}>{m.dot}</span>
                  <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: 'var(--mono)' }}>{site.key}</span>
                  <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{site.surface}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--tx3)', fontFamily: 'var(--mono)', marginTop: 2 }}>{site.sourceFile}</div>
              </div>
              <div className="row" style={{ gap: 10 }}>
                {site.resolvedAssetId
                  ? <span style={{ fontSize: 11, color: 'var(--ok)', fontFamily: 'var(--mono)' }}>→ {site.resolvedAssetId}</span>
                  : <span style={{ fontSize: 11, color: m.c }}>{m.label === 'missing' ? 'no data + no art' : 'procedural shape'}</span>}
                {site.state !== 'wired' && <button style={{ fontSize: 10.5, cursor: 'pointer', color: 'var(--acc-text)', border: '1px solid var(--bd2)', borderRadius: 6, padding: '2px 8px', background: 'var(--bg)' }}>Wire this ▸</button>}
              </div>
            </div>
          )
        })}
      </div>

      {s.orphans.length > 0 && (
        <div className="card" style={{ padding: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>Orphaned in Library <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>· published but unused — pruning candidates</span></div>
          {s.orphans.map(o => <div key={o.id} style={{ fontSize: 11.5, fontFamily: 'var(--mono)', color: 'var(--tx2)', padding: '3px 0' }}>{o.id} <span style={{ color: 'var(--tx3)' }}>— 0 consumers</span></div>)}
        </div>
      )}
    </div>
  )
}

function Stat({ n, label, c }: { n: string | number; label: string; c?: string }) {
  return <div><div style={{ fontSize: 20, fontWeight: 800, color: c ?? 'var(--tx)', fontFamily: 'var(--mono)' }}>{n}</div><div style={{ fontSize: 10, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>{label}</div></div>
}

// ── Palettes — canonical + Lospec public-domain color systems ────────────────
export function PalettesView() {
  const palettes = listPalettes()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>The shared color systems the catalogue references. Canonical Arganta sets keep art consistent across apps; Lospec palettes are public domain — import any as a starting point.</div>
      {palettes.map(p => (
        <div key={p.id} className="card" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="spread" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="row" style={{ gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
              <span style={{ fontSize: 10.5, color: 'var(--tx3)', fontFamily: 'var(--mono)' }}>{p.id}</span>
              <span className="pill" style={{ fontSize: 9.5, background: p.source === 'canonical' ? 'var(--bg3)' : 'transparent', border: '1px solid var(--bd2)', color: p.source === 'canonical' ? 'var(--acc-text)' : 'var(--tx3)' }}>{p.source}</span>
            </div>
            <div className="row" style={{ gap: 10, fontSize: 10.5, color: 'var(--tx3)' }}>
              <span>{p.colors.length} colors</span>
              <span>· used by {p.usedBy}</span>
              {p.author && <span>· {p.author}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', height: 26, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--bd2)' }}>
            {p.colors.map((c, i) => <div key={i} title={c} style={{ flex: 1, background: c, minWidth: 3 }} />)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Ingest — PixelLab output awaiting review (verdict-queue discipline) ───────
export function IngestView() {
  const queue = ingestQueue()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="insight" style={{ background: 'var(--bg3)', alignItems: 'flex-start' }}>
        <div><div style={{ fontSize: 11.5, lineHeight: 1.5 }}>Nothing enters the canonical Library unreviewed. Generations from the PixelLab MCP land here first — name, tag, then promote or reject. Same discipline as the Command verdict queue.</div></div>
      </div>
      {queue.map(it => (
        <div key={it.id} className="card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 3 }}>{(it.swatch ?? []).map((c, i) => <span key={i} style={{ width: 28, height: 28, borderRadius: 4, background: c, border: '1px solid var(--bd2)' }} />)}</div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{it.suggestedName}</div>
            <div className="row" style={{ gap: 6, fontSize: 10.5, color: 'var(--tx3)', flexWrap: 'wrap', marginTop: 2 }}>
              <span>via {it.generatedVia}</span>
              <span>· {it.size.w}×{it.size.h}</span>
              {it.styleRefId && <span>· ref {it.styleRefId}</span>}
            </div>
            <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>{it.suggestedTags.map(t => <span key={t} className="pill pill-mut" style={{ fontSize: 9.5 }}>{t}</span>)}</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button style={{ fontSize: 11.5, cursor: 'pointer', color: 'var(--tx3)', border: '1px solid var(--bd2)', borderRadius: 6, padding: '4px 10px', background: 'var(--bg)' }}>Reject</button>
            <button style={{ fontSize: 11.5, cursor: 'pointer', color: 'var(--bg)', background: 'var(--ok)', borderRadius: 6, padding: '4px 10px', fontWeight: 600 }}>Promote →</button>
          </div>
        </div>
      ))}
      {!queue.length && <div style={{ textAlign: 'center', color: 'var(--tx3)', fontSize: 12, padding: 40 }}>Queue empty — nothing waiting to review.</div>}
    </div>
  )
}
