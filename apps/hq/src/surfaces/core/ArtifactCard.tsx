// C4b Step 5 — one card renders all six media block kinds (C4a §4). Same
// skeleton, kind-specific body. Provenance chip row matches ModelRack's run
// modal vocabulary exactly ('✓ saved to Supabase' / '⚠ no saved artifact').
import { useEffect, useState } from 'react'
import { mediaAssetPublicUrl } from '../../lib/mediaAssets'
import { supabase, cloudEnabled } from '../../lib/supabase'
import { getPublication, unpublishArtifact, publicArtifactUrl, getArtifact } from '../../builder-core/persist'
import { coreExecuteTool } from '../../lib/core/tools'
import { isPicker, type ChartSpec, type PickerSpec } from '../../lib/core/chartRegistry'
import { ChartCanvas } from '../studios/AnalyticsChart'
import { openPreview } from './previewBus'
import { useHQ } from '../../shell/store'
import type { CoreBlock } from './blocks'

const PREVIEW_TITLE: Record<string, string> = { website: 'Website', deck: 'Deck', brand: 'Brand kit' }

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
  // C5-B4 — website/deck/brand blocks carry their generated HTML inline; those
  // are exactly the ones worth opening in the big pane. Image/audio/chart have
  // no HTML and stay inline.
  const previewableHtml: string | null = (block.kind === 'website' || block.kind === 'deck' || block.kind === 'brand')
    ? ((block as any).html ?? null) : null
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

  // A chart is not a saved asset — it's a live read of a data source, and it
  // carries its own provenance/source line. The generic foot would stamp every
  // chart with "⚠ no saved artifact", which reads as a failure when nothing
  // failed (and is the wrong vocabulary for a chart entirely).
  if (block.kind === 'chart') {
    return (
      <div className="core-artifact-card">
        <div className="core-artifact-body"><ArtifactBody block={block} path={path} /></div>
      </div>
    )
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
          {/* C5-B4 — anything with HTML can open in the side pane, where it gets
              real room plus its code and version history. */}
          {previewableHtml && (
            <button
              className="core-artifact-btn core-artifact-btn-quiet"
              onClick={() => openPreview({ kind: 'artifact', title: PREVIEW_TITLE[block.kind] ?? 'Artifact', html: previewableHtml, artifactId: assetId })}
            >
              Open in pane
            </button>
          )}
          {/* GB-7 — only a persisted Builder artifact can be opened in the
              Forge; a deterministic make_website/deck has no row to load. */}
          {isBuilderArtifact && <OpenInBuilderButton artifactId={assetId!} />}
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

/**
 * GB-7 · the Core → Forge seam. Core built it; the Forge is where it gets
 * refined by hand.
 *
 * The block kind can't tell us WHICH builder to open — C1's frozen BLOCK_KINDS
 * has one 'website' kind covering websites, apps and games alike, and makeBlock
 * drops any extra field we'd try to smuggle through. So we resolve the real
 * kind from the artifact row on click (one RPC, only when the founder actually
 * asks) rather than guessing from the HTML or widening a frozen contract.
 */
function OpenInBuilderButton({ artifactId }: { artifactId: string }) {
  const openInForge = useHQ((s) => s.openInForge)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)

  const open = async () => {
    if (busy) return
    setBusy(true)
    setError(false)
    const a = await getArtifact(artifactId)
    setBusy(false)
    if (!a) { setError(true); return }
    openInForge(a.kind === 'game' ? 'game' : 'app', artifactId)
  }

  return (
    <button
      className="core-artifact-btn core-artifact-btn-quiet"
      onClick={open}
      disabled={busy}
      title="Open this artifact in the Builder to keep refining it by hand"
    >
      {busy ? 'Opening…' : error ? 'Could not open' : 'Open in Builder'}
    </button>
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

// C5-B1b — chart blocks now render through the SAME recharts/d3 renderer the
// Analytics studio uses (ChartCanvas), so a pie is a pie and a map is a map.
// The old code drew every chart — heatmap, geo, everything — as the same grey
// horizontal bar list, which is why "a lot of charts" looked like one chart.
//
// Two shapes arrive here: a ChartSpec, or a PickerSpec (the registry refusing
// to guess). They are deliberately different cards — a picker must never look
// like an answer.
const PROVENANCE_META: Record<string, { label: string; title: string }> = {
  measured: { label: '● measured', title: 'Observed data from live Supabase aggregates.' },
  modeled: { label: '◐ modeled', title: 'A projection from our own assumptions — NOT observed data.' },
  planned: { label: '○ planned', title: 'An intention we have written down — NOT observed data.' },
}

function ChartBody({ spec }: { spec: any }) {
  if (isPicker(spec)) return <ChartPicker spec={spec} />
  return <ChartCard spec={spec as ChartSpec} />
}

function ChartCard({ spec: initial }: { spec: ChartSpec }) {
  const [spec, setSpec] = useState<ChartSpec>(initial)
  const [refreshing, setRefreshing] = useState(false)
  const prov = PROVENANCE_META[spec.provenance] ?? PROVENANCE_META.modeled

  // Refresh goes through coreExecuteTool — the same governed executor the model
  // calls — rather than reaching into the registry directly, so a human clicking
  // refresh and the agent asking for the chart take one code path.
  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    const r = await coreExecuteTool('render_chart', { chartId: spec.chartId })
    const next = (r as any).block?.spec as ChartSpec | undefined
    if (next) setSpec(next)
    setRefreshing(false)
  }

  return (
    <div className="core-chart">
      <div className="core-chart-head">
        <div className="core-chart-heading">
          <b>{spec.title}</b>
          <span className="core-chart-kind mono">{spec.chart}</span>
          <span className={`core-chart-prov core-prov-${spec.provenance} mono`} title={prov.title}>{prov.label}</span>
        </div>
        <button className="core-chart-refresh" onClick={refresh} disabled={refreshing} title="Re-read the live source">
          {refreshing ? '…' : '↻'}
        </button>
      </div>
      {spec.data.length ? (
        <div className="core-chart-canvas"><ChartCanvas a={spec as any} /></div>
      ) : (
        // The honest empty state. The old renderer said only "No chart data."
        // for every cause; the registry's fetchers explain WHY (offline, no
        // operator role, migration not run, no rows yet) and we show that.
        <div className="core-chart-nodata">
          <div className="core-chart-nodata-title">No data to chart</div>
          <p>{spec.note || 'This source returned no rows.'}</p>
        </div>
      )}
      <div className="core-chart-foot mono">{spec.source}</div>
    </div>
  )
}

// The anti-guess card (C5 §3.2). The registry returns this instead of a
// plausible-looking wrong chart when the question doesn't clearly name one.
function ChartPicker({ spec }: { spec: PickerSpec }) {
  const [chosen, setChosen] = useState<ChartSpec | null>(null)
  const [loadingId, setLoadingId] = useState<string | null>(null)

  const choose = async (chartId: string) => {
    setLoadingId(chartId)
    const r = await coreExecuteTool('render_chart', { chartId })
    const next = (r as any).block?.spec as ChartSpec | undefined
    if (next) setChosen(next)
    setLoadingId(null)
  }

  if (chosen) return <ChartCard spec={chosen} />
  return (
    <div className="core-chart-picker">
      <div className="core-chart-picker-head">
        <b>Which one did you mean?</b>
        <p>I'm not sure which chart “{spec.question}” is asking for, so I'd rather ask than show you the wrong one.</p>
      </div>
      <div className="core-chart-picker-grid">
        {spec.options.map(o => (
          <button key={o.chartId} className="core-chart-opt" onClick={() => choose(o.chartId)} disabled={!!loadingId}>
            <span className="core-chart-opt-title">{o.title}</span>
            <span className="core-chart-opt-meta mono">
              {o.office} · {o.chart} · {(PROVENANCE_META[o.provenance] ?? PROVENANCE_META.modeled).label}
            </span>
            {loadingId === o.chartId && <span className="core-chart-opt-load mono">loading…</span>}
          </button>
        ))}
      </div>
    </div>
  )
}
