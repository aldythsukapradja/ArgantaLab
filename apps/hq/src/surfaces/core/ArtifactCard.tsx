// C4b Step 5 — one card renders all six media block kinds (C4a §4). Same
// skeleton, kind-specific body. Provenance chip row matches ModelRack's run
// modal vocabulary exactly ('✓ saved to Supabase' / '⚠ no saved artifact').
import { useEffect, useState } from 'react'
import { mediaAssetPublicUrl } from '../../lib/mediaAssets'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { getPublication, unpublishArtifact, publicArtifactUrl } from '../../builder-core/persist'
import { coreExecuteTool } from '../../lib/core/tools'
import type { CoreBlock } from './blocks'

export function ArtifactCard({ block }: { block: CoreBlock }) {
  const [accepted, setAccepted] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const anyBlock = block as any
  const assetId: string | null = anyBlock.assetId ?? null
  const path: string | null = anyBlock.path ?? null
  const provider: string | null = anyBlock.provider ?? null
  const costUsd: number = anyBlock.costUsd ?? 0
  const saved = !!assetId
  // Direct-to-device download for media artifacts. Supabase public buckets send
  // permissive CORS, so fetch→blob works; if it ever doesn't, fall back to just
  // opening the file (the browser's own save then handles it).
  const downloadUrl = path && (block.kind === 'image' || block.kind === 'audio') ? mediaAssetPublicUrl(path) : null
  const downloadAsset = async () => {
    if (!downloadUrl || downloading) return
    setDownloading(true)
    const ext = (path?.split('.').pop() || '').replace(/[^a-z0-9]/gi, '').slice(0, 4) || (block.kind === 'image' ? 'png' : 'mp3')
    try {
      const res = await fetch(downloadUrl)
      const blob = await res.blob()
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href; a.download = `arganta-${block.kind}-${Date.now()}.${ext}`
      document.body.appendChild(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(href), 1500)
    } catch { window.open(downloadUrl, '_blank', 'noopener') }
    setDownloading(false)
  }
  // Accept/discard wires the media_asset_set_accepted RPC — only image/audio
  // blocks carry a real media_asset id. website/deck/brand/create_* blocks
  // carry an hq_artifact id instead (B1/B3's separate builder store); calling
  // the media RPC on that id would silently update zero rows, so those kinds
  // show the saved chip only, no accept affordance, until B3/C4b reconcile
  // the two artifact stores.
  const acceptable = saved && (block.kind === 'image' || block.kind === 'audio')
  // create_website/create_application (B2/B3) persist a real hq_artifact and
  // share the 'website' block kind (C1's frozen BLOCK_KINDS has no separate
  // 'application' kind — see Single-File-Builder.md); make_website/make_deck
  // are deterministic-only and never carry an assetId. That's the exact,
  // already-established signal for "this is a publishable Builder artifact".
  const isBuilderArtifact = saved && block.kind === 'website'

  const decide = async (value: boolean) => {
    if (!assetId || !cloudEnabled || busy) return
    setBusy(true)
    const { error } = await supabase.rpc('media_asset_set_accepted', { p_id: assetId, p_accepted: value })
    setBusy(false)
    if (!error) setAccepted(value)
  }

  return (
    <div className="core-artifact-card">
      <div className="core-artifact-body">
        <ArtifactBody block={block} path={path} />
      </div>
      <div className="core-artifact-foot">
        <div className="core-artifact-chip mono">
          {provider && <span>{provider}</span>}
          {costUsd > 0 && <span> · ${costUsd.toFixed(4)}</span>}
          <span> · {saved ? '✓ saved to Supabase' : '⚠ no saved artifact'}</span>
        </div>
        <div className="core-artifact-actions">
          {downloadUrl && (
            <button className="core-artifact-btn core-artifact-btn-quiet" onClick={downloadAsset} disabled={downloading} aria-label="Download">
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" style={{ marginRight: 5, verticalAlign: -2 }}><path d="M7 1.5v7M4 6l3 3 3-3M2.5 11.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              {downloading ? 'Saving…' : 'Download'}
            </button>
          )}
          {acceptable && accepted === null && (
            <>
              <button className="core-artifact-btn" onClick={() => decide(true)} disabled={busy}>Accept</button>
              <button className="core-artifact-btn core-artifact-btn-quiet" onClick={() => decide(false)} disabled={busy}>Discard</button>
            </>
          )}
        </div>
        {accepted === true && <div className="core-artifact-accepted mono">✓ accepted</div>}
        {accepted === false && <div className="core-artifact-discarded mono">discarded</div>}
      </div>
      {isBuilderArtifact && <PublishRow artifactId={assetId!} />}
    </div>
  )
}

// B5 (ADR-0006) — publish reuses the SAME validated executor the chat loop
// calls (coreExecuteTool('publish_artifact', ...)), so a human clicking this
// button and the model calling the tool go through one code path, one
// validation gate, never two. Unpublish is UI-only (not a chat tool) — B1's
// frozen BUILDER_TOOL_SPECS never defined an unpublish tool, and takedown is
// exactly the kind of instant, low-stakes, founder-initiated action that
// doesn't need agent governance wrapped around it.
function PublishRow({ artifactId }: { artifactId: string }) {
  const [state, setState] = useState<'checking' | 'idle' | 'publishing' | 'published' | 'unpublishing' | 'error'>('checking')
  const [url, setUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!cloudEnabled) { setState('idle'); return }
    getPublication(artifactId).then((pub) => {
      if (cancelled) return
      if (pub && pub.isLive) { setUrl(publicArtifactUrl(pub.kind, pub.slug)); setState('published') }
      else setState('idle')
    })
    return () => { cancelled = true }
  }, [artifactId])

  const publish = async () => {
    setState('publishing'); setError(null)
    const result = await coreExecuteTool('publish_artifact', { artifactId })
    const data = result.data as any
    if (data?.ok && data?.url) { setUrl(data.url); setState('published') }
    else { setError(data?.error || data?.note || data?.errors?.[0]?.message || 'publish failed'); setState('error') }
  }

  const unpublish = async () => {
    setState('unpublishing')
    const ok = await unpublishArtifact(artifactId)
    if (ok) { setUrl(null); setState('idle') } else { setState('error'); setError('could not unpublish') }
  }

  if (state === 'checking') return null
  const unpublishing = state === 'unpublishing'
  return (
    <div className="core-artifact-publish">
      {state === 'published' && url ? (
        <>
          <a className="core-artifact-publink mono" href={url} target="_blank" rel="noopener noreferrer">{url.replace('https://', '')}</a>
          <button className="core-artifact-btn core-artifact-btn-quiet" onClick={unpublish} disabled={unpublishing}>
            Unpublish
          </button>
        </>
      ) : (
        <>
          <button className="core-artifact-btn" onClick={publish} disabled={state === 'publishing'}>
            {state === 'publishing' ? 'Publishing…' : 'Publish'}
          </button>
          {state === 'error' && error && <span className="core-artifact-pub-error">{error}</span>}
        </>
      )}
    </div>
  )
}

function ArtifactBody({ block, path }: { block: CoreBlock; path: string | null }) {
  switch (block.kind) {
    case 'image': {
      const url = path ? mediaAssetPublicUrl(path) : null
      return url
        ? <img src={url} alt="Generated" className="core-artifact-img" />
        : <div className="core-artifact-empty">Image unavailable — nothing was persisted.</div>
    }
    case 'audio': {
      const url = path ? mediaAssetPublicUrl(path) : null
      return url
        ? <audio className="core-artifact-audio" src={url} controls />
        : <div className="core-artifact-empty">Audio unavailable — nothing was persisted.</div>
    }
    case 'website':
    case 'deck': {
      const html = (block as any).html as string | null
      if (!html) return <div className="core-artifact-empty">No preview available.</div>
      return (
        <iframe
          className="core-artifact-frame"
          srcDoc={html}
          sandbox="allow-scripts allow-same-origin"
          title={block.kind === 'deck' ? 'Deck preview' : 'Website preview'}
        />
      )
    }
    case 'brand': {
      const html = (block as any).html as string | null
      if (html) {
        return <iframe className="core-artifact-frame" srcDoc={html} sandbox="allow-scripts allow-same-origin" title="Brand kit preview" />
      }
      return <div className="core-artifact-empty">No brand preview available.</div>
    }
    case 'chart': {
      const spec = (block as any).spec
      if (!spec) return <div className="core-artifact-empty">No chart data.</div>
      return <ChartBody spec={spec} />
    }
    default:
      return <div className="core-artifact-empty">Unsupported artifact.</div>
  }
}

// Renders the `analyze` tool's REAL spec shape (surfaces/studios/analytics.ts
// Analysis: {chart, title, source, data:any[], encoding:{label|x, value|y}}) —
// a quiet horizontal-bar rendering regardless of the declared chart type
// (v1 doesn't attempt heatmap/geo rendering honestly, so it degrades to the
// same bar list rather than faking a map). Cites its source, never invents one.
function ChartBody({ spec }: { spec: any }) {
  const rows: any[] = Array.isArray(spec?.data) ? spec.data : []
  const labelKey = spec?.encoding?.label ?? spec?.encoding?.x
  const valueKey = spec?.encoding?.value ?? spec?.encoding?.y
  const pairs = rows
    .map(r => ({ label: labelKey ? r?.[labelKey] : undefined, value: valueKey ? Number(r?.[valueKey]) : undefined }))
    .filter(p => p.label != null && Number.isFinite(p.value))
  if (!pairs.length) return <div className="core-artifact-empty">No chart data.</div>
  const max = Math.max(...pairs.map(p => p.value as number), 1)
  return (
    <div className="core-artifact-chart">
      {spec?.title && <div className="core-chart-title">{spec.title}</div>}
      {pairs.slice(0, 8).map((p, i) => (
        <div key={i} className="core-chart-bar-row">
          <span className="core-chart-bar-label">{String(p.label)}</span>
          <div className="core-chart-bar-track">
            <div className="core-chart-bar-fill" style={{ width: `${((p.value as number) / max) * 100}%` }} />
          </div>
          <span className="core-chart-bar-value mono">{p.value}</span>
        </div>
      ))}
      {spec?.source && <div className="core-chart-source">{spec.source}</div>}
    </div>
  )
}
