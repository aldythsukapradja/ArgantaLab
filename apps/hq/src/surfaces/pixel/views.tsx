import { useEffect, useState } from 'react'
import { usageSummary, listPalettes, ingestQueue } from '../../data/pixel/engine'
import { loadIngestQueue, rejectIngest, promoteIngest, type CloudIngestRow } from '../../data/pixel/ingestCloud'
import { signedThumb } from '../../data/pixel/cloud'
import type { UsageSite, Palette, VaultItem } from '../../data/pixel/types'

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
export function PalettesView({ palettes: pals, items }: { palettes: Palette[]; items: VaultItem[] }) {
  const palettes = listPalettes(pals, items)
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

// ── Ingest — generated art awaiting review (S3a contract, verdict-queue) ──────
// Cloud-first: rows written by the media-gen MCP's pixel_vault_ingest tool land
// in pixel_ingest; this view reviews them with the signed-in admin session.
// Offline / signed-out falls back to the read-only seed queue so the tab still
// demonstrates the flow.
function IngestThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => { let live = true; signedThumb(path).then(u => { if (live) setUrl(u) }); return () => { live = false } }, [path])
  return url
    ? <img src={url} alt="" style={{ width: 56, height: 56, objectFit: 'contain', imageRendering: 'pixelated', borderRadius: 6, border: '1px solid var(--bd2)', background: 'var(--bg3)' }} />
    : <div style={{ width: 56, height: 56, borderRadius: 6, border: '1px solid var(--bd2)', background: 'var(--bg3)' }} />
}

export function IngestView() {
  const [cloud, setCloud] = useState<CloudIngestRow[] | null | 'loading'>('loading')
  const [busy, setBusy] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const reload = () => loadIngestQueue().then(setCloud)
  useEffect(() => { reload() }, [])

  async function onReject(id: string) {
    setBusy(id)
    const err = await rejectIngest(id)
    setNote(err ? `Reject failed: ${err}` : `Rejected ${id}.`)
    setBusy(null); reload()
  }
  async function onPromote(row: CloudIngestRow) {
    setBusy(row.id)
    try {
      const assetId = await promoteIngest(row)
      setNote(`Promoted → ${assetId} (draft in Library).`)
    } catch (e: any) { setNote(e?.message || String(e)) }
    setBusy(null); reload()
  }

  const seed = ingestQueue()
  const usingCloud = Array.isArray(cloud)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="insight" style={{ background: 'var(--bg3)', alignItems: 'flex-start' }}>
        <div><div style={{ fontSize: 11.5, lineHeight: 1.5 }}>
          Nothing enters the canonical Library unreviewed. Every generated pixel asset (PixelLab, ComfyUI) is stored in the
          pixel-art bucket and lands here via <code>pixel_vault_ingest</code> — name, tag, then promote or reject.
          {!usingCloud && cloud !== 'loading' && <b> Showing seed examples — sign in (admin) for the live queue.</b>}
        </div></div>
      </div>
      {note && <div className="card" style={{ padding: '8px 12px', fontSize: 11.5, color: 'var(--tx2)' }}>{note}</div>}

      {usingCloud && (cloud as CloudIngestRow[]).map(it => (
        <div key={it.id} className="card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
          <IngestThumb path={it.storage_path} />
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{it.suggested_name}</div>
            <div className="row" style={{ gap: 6, fontSize: 10.5, color: 'var(--tx3)', flexWrap: 'wrap', marginTop: 2 }}>
              <span>via {it.generated_via}</span>
              <span>· {it.kind}</span>
              {it.size?.w ? <span>· {it.size.w}×{it.size.h}</span> : null}
              {it.animations?.length ? <span>· {it.animations.length} anim</span> : null}
              {it.style_ref_id && <span>· ref {it.style_ref_id}</span>}
              <span style={{ fontFamily: 'var(--mono)' }}>· {it.storage_path}</span>
            </div>
            <div className="row" style={{ gap: 4, marginTop: 4, flexWrap: 'wrap' }}>{(it.suggested_tags ?? []).map(t => <span key={t} className="pill pill-mut" style={{ fontSize: 9.5 }}>{t}</span>)}</div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button disabled={busy === it.id} onClick={() => onReject(it.id)}
              style={{ fontSize: 11.5, cursor: 'pointer', color: 'var(--tx3)', border: '1px solid var(--bd2)', borderRadius: 6, padding: '4px 10px', background: 'var(--bg)' }}>Reject</button>
            <button disabled={busy === it.id} onClick={() => onPromote(it)}
              style={{ fontSize: 11.5, cursor: 'pointer', color: 'var(--bg)', background: 'var(--ok)', borderRadius: 6, padding: '4px 10px', fontWeight: 600 }}>
              {busy === it.id ? '…' : 'Promote →'}
            </button>
          </div>
        </div>
      ))}
      {usingCloud && !(cloud as CloudIngestRow[]).length &&
        <div style={{ textAlign: 'center', color: 'var(--tx3)', fontSize: 12, padding: 40 }}>Queue empty — nothing waiting to review.</div>}

      {!usingCloud && cloud !== 'loading' && seed.map(it => (
        <div key={it.id} className="card" style={{ padding: 12, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', opacity: 0.75 }}>
          <div style={{ display: 'flex', gap: 3 }}>{(it.swatch ?? []).map((c, i) => <span key={i} style={{ width: 28, height: 28, borderRadius: 4, background: c, border: '1px solid var(--bd2)' }} />)}</div>
          <div style={{ flex: 1, minWidth: 160 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{it.suggestedName} <span style={{ fontSize: 9.5, color: 'var(--tx3)' }}>seed</span></div>
            <div className="row" style={{ gap: 6, fontSize: 10.5, color: 'var(--tx3)', flexWrap: 'wrap', marginTop: 2 }}>
              <span>via {it.generatedVia}</span><span>· {it.size.w}×{it.size.h}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
